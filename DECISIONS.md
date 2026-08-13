# Decisions log

The decisions behind TORPC that were genuinely contested, with the reasoning and the alternatives
that were rejected. It exists so a reader can see why the format is shaped the way it is, and so a
question that was already settled does not have to be argued twice.

This is deliberately not a changelog. Choices that turned out to be uncontroversial, superseded
mechanisms, naming iterations and the order in which files appeared are not recorded here: the
published spec is the current answer, and the git history of this repository holds the rest.

---

## 2026-05-14 — Spec licensing: CC0 for the specs, a permissive licence for code

CC0 is required if specs are submitted as EIPs. A permissive licence keeps reference implementation code contribution-friendly. (Superseded by the 2026-07-27 entry, which fixes one licence per repository.)

## 2026-05-15 — Finality vocabulary deliberately does NOT overload `reverted`

`finality` carries only chain-position status: `confirmed | safe | latest | pending`. Execution outcome (`success | reverted`) is a separate field in `data.execution`. Post-reorg outcomes get their own taxonomy: `relocated | orphaned | execution_changed`.

- **Why:** in Ethereum semantics "reverted" already means "tx was included but execution failed (REVERT opcode)". Overloading it to also mean "tx was reorged out" would conflate three meaningfully different scenarios for agents — and the agent's response should differ in each (re-broadcast / accept new outcome / take no action on `confirmed`).
- **Alternatives considered:** single `status: confirmed | reverted | reorged` (rejected — buries detail an agent needs); `finality: confirmed | reverted_by_reorg` (rejected — still ambiguous about execution failure vs reorg-out).

## 2026-05-15 — Drop `logsBloom` is a TOEVM hard MUST, not opt-in

`logsBloom` is a 256-byte (~100 LLM tokens) Bloom filter used for node-internal optimization. It has no agent-side use case (the indexer's own filter is what serves agent queries). TOEVM 1.0 **MUST** omit it from compressed responses; clients that need it fetch via `raw_pointer`.

- **Why:** the single largest contributor to receipt response size. Dropping it is the largest single token win in TOEVM. Keeping it opt-out (rather than opt-in) would invite every-customer-keeps-it-by-default, which defeats the spec's reason to exist.

## 2026-05-19 — v1.1: drop envelope, compressed payload lives in JSON-RPC `result`

Engineering review (Alexander Kolesov) identified the 11-field envelope from v1.0 as over-engineered: most envelope fields are metadata that belongs in HTTP response headers (per HTTP idiom and observability convention), not in the response body. The body should stay a standard JSON-RPC 2.0 response with `result` carrying the compressed payload — drop-in compatible with every existing JSON-RPC client library.

Specifically retired from the envelope:

- `torpc: "1.0"` field — replaced by `Content-Type: application/vnd.ankr.torpc+json; version=1.1` response header
- `_tokenizer` / `_token_count` fields — replaced by `X-Tokenizer` and `X-Token-Count` response headers
- `compression{}` block — replaced by optional `X-Compression-Ratio` / `X-Compression-Rules` headers (opt-in via `X-Include-Compression: true`)
- `provenance{}` block — replaced by optional `X-Ankr-Node` / `X-Indexer-Version` / `X-Freshness-Ms` / `X-Action-Classifier-Version` / `X-ABI-Source` headers (opt-in via `X-Include-Provenance: true`)
- `finality` field — replaced by optional `X-Finality` header (opt-in via `X-Include-Finality: true`)
- `as_of` block — block reference travels inside `result` per chain spec (e.g., `result.block`, `result.block_time`)
- `query` field — JSON-RPC `method` carries this
- `params` echo — JSON-RPC client library knows the request; echo is noise

**Why:** envelope wrapping inflates body by ~50-100 tokens of metadata that clients almost never act on. Moving observability to headers keeps the body clean (LLM context stays minimal) while giving clients full control via opt-in. The drop-in JSON-RPC 2.0 shape means every existing ethers.js / viem / web3.js client works without modification.

**Alternatives considered:**
- Keep envelope, mark fields optional via projection (rejected — even when projected away, the envelope wrapper adds shape that clients must handle).
- Move only `_tokenizer` to headers but keep `finality` / `provenance` in body (rejected — half-measure, doesn't fix the "body has metadata" problem cleanly).
- Separate body shape for TORPC vs JSON-RPC (rejected — breaks drop-in compatibility and forces client library updates).

---

## 2026-05-19 — v1.1: drop `raw_pointer`, raw = same URL without opt-in

The v1.0 `raw_pointer` mandate (24h retention contract, blob storage, separate URL) is removed. To retrieve the raw response, the client re-issues the same request without the `Accept: application/vnd.ankr.torpc+json` header (or without `?torpc=1` parameter). The same URL with the same authentication returns the standard JSON-RPC response.

**Why:** the raw escape hatch was conflated with retention contract in v1.0. They're separate concerns. The escape hatch only needs "give me raw" semantics, which HTTP content negotiation already provides — the server's underlying RPC node has the data either way. The 24h retention contract added significant infrastructure burden (blob storage with TTL, lifecycle policies, separate fetch endpoint, access control) for a use case that re-querying already covers.

Edge case: if a reorg occurs between TORPC response and raw re-query, the responses won't be byte-identical. For snapshot consistency, clients **SHOULD** use explicit `blockTag` or block number in the underlying `eth_*` call. This is a property of Ethereum JSON-RPC, not a TORPC concern.

**Alternatives considered:**
- Optional retention contract behind a per-customer subscription tier (rejected — re-introduces complexity and creates two TORPC modes, breaking determinism guarantees).
- Retention only for `pending`/`latest` blocks (rejected — these are exactly the blocks where re-query gives different data; retention adds nothing).
- Cryptographic commitment of TORPC response → raw (rejected — overkill for the use case; standard SLA + re-query covers it).

---

## 2026-05-19 — v1.1: finality / provenance / compression observability moved to opt-in headers

Previously v1.0 mandated `finality` and `provenance` fields in every envelope. v1.1 makes them opt-in via request headers:

- `X-Include-Finality: true` → server adds `X-Finality: confirmed|safe|latest|pending` response header
- `X-Include-Provenance: true` → server adds `X-Ankr-Node`, `X-Indexer-Version`, `X-Freshness-Ms`, `X-Action-Classifier-Version`, `X-ABI-Source`, `X-Price-Source` response headers
- `X-Include-Compression: true` → server adds `X-Compression-Rules` response header (rule attribution list)

`X-Token-Count`, `X-Tokenizer`, `X-Compression-Ratio` are always emitted (zero-cost observability, no agent semantics).

**Why:** most clients don't read provenance, action classifier version, or freshness fields. Mandating them in body inflates every response by ~50 tokens for metadata that's only useful to a minority of clients (compliance-tier, debug, observability dashboards). Opt-in headers let those clients ask while keeping the default response minimal.

Finality specifically: clients that care about finality already have standard `eth_getBlockByNumber("finalized")` available in EVM JSON-RPC; they can compute finality client-side. The header-based opt-in is an affordance for clients that want server-computed convenience.

**Alternatives considered:**
- Keep mandatory body fields (rejected — defeats v1.1 design goal of clean body).
- Make them opt-in via JSON:API field projection inside body (rejected — they're metadata, not data; headers are the right idiom).

**Status:** none of these observability headers survive in v1. The vendor-specific ones (node identity, indexer version, freshness, classifier version, price source) were the first to go: a spec that mandates vendor-shaped headers cannot be implemented by a second provider without pretending to be the first. Freshness in particular was never implemented anywhere and the header name is dead.

---

## 2026-06-04: canonical header names, `Accept-Token-Tier` and `Token-Tier`

The request header is `Accept-Token-Tier` and the response header is `Token-Tier`. The earlier name was `X-Rpc-Compress`, later `Rpc-Compress`, which remains accepted as a deprecated request alias so that clients written before this date keep working.

- **Why:** the header is a content-negotiation hint, so it should read like one. `Accept-*` on the request and a bare acknowledgment on the response match how HTTP already expresses "here is what I will take" and "here is what you got". The old name described an implementation ("compress") rather than the contract ("which tier").
- **Why drop the `X-` prefix:** deprecated for new headers by RFC 6648.
- **Cost:** two names to accept on the request side, indefinitely. Cheap, and the deprecated alias keeps early integrators from breaking.
- **Consequence for measurements:** any measurement taken before this date was taken through the old header. Published numbers must say which header the run used, because that also fixes which server behaviour was measured.

---

## 2026-07-27: publish as two repositories, one licence each

The specification and the code are published separately, and each repository carries exactly one licence for everything inside it.

- **Spec repository, CC0 1.0 for everything.** The spec text, the whitepaper, this log, the conformance vectors **and** the conformance runner. Public domain, no attribution obligation, no header to carry.
- **Code repository, Apache-2.0 for everything.** The reference decoder, the ruleset package and the benchmark harness.

- **Why one licence per repository:** an earlier reading held that the conformance tooling should be licensed separately from the vectors it exercises, because tooling is code. Rejected. A contributor deciding whether to add a golden case should not have to work out which of two licences applies to the file they are touching, and a mixed-licence repository invites exactly that mistake. Uniformity per repository is worth more than the theoretical tidiness of licensing code as code.
- **Why CC0 and not a permissive code licence for the spec side:** a specification carrying attribution obligations cannot be pasted into a standards submission without friction, and friction at that step is fatal. CC0 also removes the question entirely for anyone vendoring a golden vector into their own test suite.
- **Why Apache-2.0 and not MIT for the code:** the explicit patent grant and the contribution terms. MIT was the earlier choice, made when "keep contributor friction low" was the only criterion.
- **Why two repositories and not one:** the licences differ, and so do the audiences and the release cadences. A spec reader should not have to clone a benchmark harness, and an npm consumer should not pull the whitepaper.
- **Cost:** the conformance runner lives in the spec repository while the ruleset it asserts against lives in the code repository, so the default test path crosses a repository boundary. Accepted: the golden vectors are implementation independent, which is the property that matters, and any implementer can point the runner at their own library.
- **Not published:** the production encoder, the action classifier implementation, the live contract registry, and the research notes behind the design. The spec, the vectors and the measurements are public; the operational implementation is not. The published format is complete enough to implement from scratch without any of it.

## 2026-07-27: no separate patent covenant, trademark handled outside the licence

CC0 covers copyright and nothing else. The patent gap is closed by the licence on the reference implementation rather than by a bespoke document: the code repository is Apache-2.0, whose section 3 grants an express patent licence to every user of that code. A standalone non-assertion covenant was drafted and then dropped: a bespoke legal instrument needs counsel behind it to be worth anything, and an unbacked one is worse than the well-understood Apache grant.

- **Alternative considered:** an irrevocable non-assertion covenant with a defensive-termination clause in the spec repository (rejected as above).
- **`TRADEMARKS.md`** plus a "TORPC Conformant" claim defined in `GOVERNANCE.md`: the format is free for anyone to copy, and the claim that an implementation conforms is not free to fake. This is the only defence against an incompatible fork carrying the name, since the licence deliberately permits every kind of copying.

- **Alternative considered:** a copyleft or share-alike licence to prevent divergent forks (rejected: it would not prevent them, it would only prevent adoption, and a spec with adoption conditions is a spec nobody adopts).
