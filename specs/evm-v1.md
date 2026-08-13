# EVM RPC Compression — v1

| | |
|---|---|
| **Status** | Draft |
| **MVP scope** | T1 + T2 normative; tiers ≥ 3 reserved for future revisions |
| **Transport** | JSON-RPC 2.0 over HTTP. Other transports out of scope. |
| **Protocol changes** | None. Opt-in via HTTP headers only. |
| **Authors** | Mike Kondratev, Alexander Kolesov, Roman Fasakhov, Stanley Wu |
| **License** | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Goal

Reduce LLM-token cost of EVM JSON-RPC responses without altering the JSON-RPC 2.0 protocol. Compression is opt-in per request, best-effort, and the raw response is recovered by repeating the request with no opt-in headers, against the same block. See [Behavior](#behavior) rule 5 for what that recovery does and does not guarantee.

## Scope

This spec layers on top of JSON-RPC 2.0 and does not modify the wire envelope. The top-level fields of a JSON-RPC 2.0 response (`jsonrpc`, `id`, `result` / `error`) are preserved verbatim. A batched response keeps its array form; see [Batched requests](#batched-requests). The shape of the envelope, error-code conventions, and request matching by `id` are all unchanged.

**Success responses only.** Tier transformations apply only to the **payload inside `result`** on successful responses. JSON-RPC error responses (those carrying `error` instead of `result`) are returned verbatim at every tier — per-method rulesets **MUST NOT** define transformations over the `error` object. An implementing server that receives `Accept-Token-Tier: <N>` and replies with an error response **MUST** still echo `Token-Tier: 0` on that response, signaling "the spec is supported but nothing was transformed on this response". In a batched response the same rule applies per element: an element carrying `error` has an applied tier of `0`, see [Batched requests](#batched-requests).

## Mechanism

Two HTTP headers — one request-side hint and one response-side acknowledgment. No new RPC methods, no envelope, no new error codes.

**Request:**

```
Accept-Token-Tier: <N>
```

`N` is an integer in `0..2`; higher values are **reserved** and a v1 server answering one serves its highest supported tier. The header is a **ceiling**, not a demand: the client states the highest tier it will accept, and the server may serve any tier `M <= N`. Servers that do not implement this spec ignore the header and return the standard JSON-RPC 2.0 response with no response-side header (no special handling required from them).

**Response:**

```
Token-Tier: <M>
```

`M` is the **tier actually applied**, an integer in `0..N`. Servers that implement this spec **MUST** include this header on every response to a request that carried a recognised opt-in header, including when no compression was applied (`M = 0`). A server **MUST NOT** return a body transformed under this specification without emitting `Token-Tier`: a transformed body that a client is entitled to read as raw is the failure mode this header exists to prevent. A deployment **MAY** carry unrelated legacy opt-in mechanisms with their own request and response vocabulary; those are outside this specification, and a response produced by one of them is not a TORPC response. Servers **MUST NOT** return `M > N`. Absence of `Token-Tier` on the response signals that the server does not implement this spec — clients **MUST** treat the body as a standard JSON-RPC 2.0 response. On a batched response `M` is defined by [Batched requests](#batched-requests).

## Behavior

1. **Best-effort.** The server **MAY** return a tier lower than requested. Reasons may include: the method has no rules at tier `N`; the ABI is unavailable; tier `N` would regress vs a lower tier on this response.
2. **Transformation-failure passthrough.** When a per-method ruleset specifies a transformation on an enumerated field and applying it fails — the field is absent from the raw response, its value is not in the expected format, or its type is unexpected — the server **MUST** preserve that field verbatim (original key, original value, original type) in the output and continue processing the rest of the response. The failure **MUST NOT** cause the server to drop the field, invent a value, or downgrade the entire response to `Token-Tier: 0`. Per-method rulesets **MAY** define more specific fallback behaviors (e.g. the T2 ABI-unknown per-log tagging in §T2); those override this default. Servers **MAY** log the failure out-of-band; no in-body marker is required. *Rationale: a single malformed or unexpected field — typically a chain-specific extension or a node-implementation quirk — should not invalidate compression of the rest of the response.*
3. **Unsupported methods pass through raw.** If an implementing server has no compression rules for the method at any tier ≥ 1, it **MUST** return the unmodified JSON-RPC response with `Token-Tier: 0`. Servers **MUST NOT** apply ad-hoc field-level transforms to methods without a defined ruleset.
4. **Non-implementing servers stay silent.** A server that does not implement this spec ignores `Accept-Token-Tier` and returns a standard JSON-RPC response with no `Token-Tier` header. Clients **MUST** handle this case — the absence of the response header is equivalent to "raw" from the consumer's point of view.
5. **Reversibility.** T1 transforms on carried fields are mechanically reversible. Enumerated service fields are dropped by policy and are recovered only by re-issuing the request without the opt-in header, against the same block. v1 defines no in-response raw-pointer field, so re-query is the only recovery path, and it inherits that path's limits: the node must still serve the block. For a recent block that is a routine request; for older state it requires an archive node, and archival availability is not a retention contract. A consumer that needs reproducibility **SHOULD** pin a block, by hash or by number, rather than rely on `latest`, so that the raw re-query and the transformed response describe the same state.
6. **Determinism.** The T1 (mechanical) transform is a pure function of the raw response: deterministic, side-effect-free, and dependent on nothing outside its input. It is **not** injective: the enumerated drops in §T1 mean the raw response cannot be reconstructed from the transformed output alone, see rule 5. Across servers, two conforming implementations **MUST** produce the same field set and the same transformed values (structural equivalence); byte layout is **not** normative, because JSON serializers do not guarantee key order. A single server **SHOULD** be byte-stable for a given raw response, which is what makes shared LLM prompt-caching work in practice. T2 output is deterministic given the same decoded input; because decoding is provider-defined (and may vary with ABI availability), T2 equivalence across servers holds only when they share the same decoding.

## Batched requests

JSON-RPC 2.0 permits a request array (`[req1, req2, …]`), answered by a response array (`[resp1, resp2, …]`). This spec changes neither array ordering nor `id` matching.

**Per-element evaluation.** A server **MUST** evaluate the rules in [Behavior](#behavior) and the per-method rulesets independently for each element of the array. The **applied tier** of an element is the tier the server actually rendered that element at: it is bounded above by the lower of the requested tier `N` and the highest tier at which that element's method carries a ruleset in [`specs/methods/`](./methods/), and it is lower still whenever [Behavior](#behavior) rule 1 (best-effort) applies, for example when the ABI needed for T2 is unavailable. An element whose method carries no ruleset, and an element that carries `error` instead of `result`, each have an applied tier of `0` and **MUST** be returned verbatim. Because the value is what was rendered rather than what coverage would permit, a server cannot declare a tier that no element reached.

**One header for the whole array.** A batched response carries a single `Token-Tier` header. Its value `M` is the **minimum applied tier across every element of the array**. v1 defines no per-element tier signal.

**Elements may exceed the declared minimum.** A server **MAY** render an individual element above the tier declared for the array. The header is a floor, not a per-element contract: it tells a client the weakest transform any element received, and nothing more. A server **MUST NOT** render any element above the requested tier `N`.

**A client parsing a batch MUST determine each element's tier from its shape, not from the header.** The transforms are self-identifying by construction: T1 renames fields, so `tx` and `block` cannot be confused with `transactionHash` and `blockNumber`, and hex-decoded numerics are decimal strings rather than `0x`-prefixed; T2 additionally replaces raw log fields with `event` and `args`. A client that assumes every element sits at the declared minimum will mis-parse the elements that sit above it.

*Rationale: clamping every element down to the array minimum is worse than the alternative. A batch of `[eth_blockNumber, eth_getLogs]` requested at tier 2 would have its logs dragged back to tier 1 because a scalar method has no tier-2 ruleset, and that batch is a common shape, so the clamp would remove the saving exactly where it matters. Per-element shape detection is also not a new obligation: `_event_unknown` already means a tier-2 response carries tier-1 log entries inside it, so a conforming client must already handle mixed shapes within one response.*

## HTTP caching

The transform is selected by request headers, so a response is cacheable only if every cache on the path keys on those headers.

**`Vary` is mandatory.** A server that implements this spec **MUST** send a `Vary` response header naming every request header that can influence the transform, at minimum `Accept-Token-Tier`:

```
Vary: Accept-Token-Tier
```

**The list MUST be complete.** A deployment that honors further transform-influencing request headers, for example a deployment-specific legacy opt-in header, a per-request decode toggle, or the media-type opt-in under [Open questions](#open-questions) which brings in `Accept`, **MUST** name each of them in the same `Vary` list. Any header that can change the response body and is absent from `Vary` is a cache-poisoning vector. Non-normative example: a deployment that accepts `Accept-Token-Tier`, still honors a legacy opt-in header of its own, and offers a decode toggle sends all three, alongside any name it already varies on:

```
Vary: Accept-Token-Tier, X-Legacy-Opt-In, X-Decode-Toggle, Origin
```

**Unconditional.** The `Vary` header **MUST** be present on every response the endpoint emits, including responses to requests that carried no `Accept-Token-Tier` and responses that carry `Token-Tier: 0`. A server **MUST NOT** emit it only when the client opted in.

**Additive with other uses of `Vary`.** A server that already varies on `Origin` for CORS, on `Accept-Encoding`, or on anything else **MUST** merge those names into one list rather than replace them.

*Rationale: a shared cache that stores a response without `Vary` reuses that entry for requests carrying different transform headers, and both directions break. A transformed body served to a client that did not opt in is parsed as a standard JSON-RPC 2.0 response, silently, because that client never reads `Token-Tier`. A body transformed above the tier the current request asked for also violates the `M ≤ N` rule in [Mechanism](#mechanism). Emitting `Vary` only on opted-in responses leaves the non-opted entry unmarked, and the unmarked entry is the one a cache reuses across opt-in states.*

## Tier landscape

| Tier | Name | Loss | Status in v1 |
|:---:|---|---|---|
| 0 | Raw | None | Reserved — no compression applied |
| 1 | Mechanical | Carried fields mechanically reversible; enumerated service fields dropped by policy | **Normative — MVP** |
| 2 | Semantic | T1 drops, plus the raw encoding of the decoded payload replaced by the decoded shape | **Normative — MVP** |
| ≥3 | — | — | Reserved for future revisions |

Sub-variants for array-shaped responses (`+tabular`, `+aggregate`) are orthogonal to the tier number and are deferred to v1.1+.

**Default tier.** T2 is the default across every method that carries a ruleset in `methods/`. Servers SHOULD apply T2 when the request opts in via `Accept-Token-Tier ≥ 2`; the T2 ABI-unknown fallback (per-element `_event_unknown` tagging) handles ABI gaps without forcing T1 across the rest of the payload. Per-method documents specify only the T1 and T2 transformations — the default-tier policy is uniform and lives here.

## T1 — Mechanical (normative)

Field-level transformations that need no external lookup, computed from the raw response alone.

T1 transforms on carried fields are mechanically reversible. Enumerated service fields are dropped by policy and are recovered only by re-issuing the request without the opt-in header, against the same block (see [Behavior](#behavior) rule 5). The per-method drop lists in [`specs/methods/`](./methods/) are normative, and they are not derivations: a dropped field is absent from the output, and several of them cannot be computed from the fields that remain, including `extraData`, `mixHash`, pre-merge `difficulty` and `nonce`, the consensus Merkle roots, `cumulativeGasUsed`, and per-log `logIndex` and `blockTimestamp`. Nothing in the output is invented; the raw form is one re-query away, under the limits stated in rule 5.

- **Drop service / dead fields.** Examples (per-method list in [`specs/methods/`](./methods/)): `logsBloom`, `cumulativeGasUsed`, `transactionIndex`, `type`, `removed: false`, `blockTimestamp`.
- **Hex-to-decimal numeric encoding.** A primitive used for all hex-encoded integer fields in this spec — T1 receipt-level fields (`blockNumber`, `gasUsed`, `effectiveGasPrice`, `logIndex`, `transactionIndex`, …), T2 ABI-decoded `uint*` / `int*` values inside `args` for decoded events, and any future numeric field. The hex value is converted to its decimal representation and emitted as a **decimal string** (with leading `-` for signed negatives). v1 emits **always string**, regardless of magnitude — see [Open questions](#open-questions) for the rationale and the deferred type-stability discussion. The receipt `status` field is **not** subject to this primitive — it follows a method-specific boolean rename defined in [`methods/eth_getTransactionReceipt.md`](./methods/eth_getTransactionReceipt.md) §T1.
- **Structural zero-block strip on 32-byte hex values.** A primitive used for fixed-width 32-byte hex values whose payload is left-padded with zero bytes (e.g. `topics[1..N]` in log entries). Count the leading zero bytes; if **exactly 24 leading zero bytes** are present → emit the trailing 8 bytes as `0x` + 16 hex chars; else if **exactly 12 leading zero bytes** are present → emit the trailing 20 bytes as `0x` + 40 hex chars; otherwise keep verbatim. Output is **lowercase hex** — the strip makes no claim about the semantic type of the value (address, uint, bytes32, etc.) and **MUST NOT** apply EIP-55 or any other case-altering transform. The transform is fully reversible: a consumer reconstructs the original 32-byte value by left-padding the result to 32 bytes with zero bytes. Per-method rulesets reference this primitive by name when they enumerate the fields it applies to.
- **Hoist shared fields.** When all log entries in a response share `blockNumber` / `blockHash` / `transactionHash`, the field is hoisted to the top of `result` and removed from per-log entries.

EIP-55 checksum casing **MUST** be applied to dedicated address-typed fields in the output (e.g. transaction `from` / `to` / `contractAddress`, log `address` / `contract`). It **MUST NOT** be applied to values produced by the structural zero-block strip — those are lowercase, regardless of whether they happen to be address-shaped.

**Unknown-field passthrough.** Fields not enumerated in the per-method ruleset **MUST** be preserved verbatim at all tiers. Servers **MUST NOT** apply ad-hoc transforms (hex → decimal, renames, dropping, address checksumming) to unenumerated fields. This rule covers chain-specific extensions (Optimism `l1Fee*`, Arbitrum `gasUsedForL1`, sequencer metadata, etc.) and post-spec-publication EIP additions. Determinism is preserved because passthrough is the identity transform.

## T2 — Semantic (normative)

T2 builds on T1 by mapping **already-decoded** on-chain data into a compact, named shape. **How** a server obtains the decoding — signature resolution, ABI lookup, registries, caching — is an implementation concern and is explicitly **out of scope** for this spec. Producing the decoding is the responsibility of the server or its upstream RPC provider; the spec defines only the *shape* the decoded payload MUST take and which fields it carries. T2 carries the T1 drops forward and additionally replaces the raw encoding of the decoded payload (calldata, `topics[0]`, indexed topics, log `data`) with the decoded shape. Given the same ABI a consumer can re-encode that shape back to the raw encoding, so T2 invents nothing, but the spec does not require a server to guarantee byte-exact re-encodability, and re-encoding does not restore the T1 drops. Recovering the raw form is a re-query without the opt-in header, against the same block (see [Behavior](#behavior) rule 5).

A T2 server MUST represent decoded on-chain data in this minimal shape:

- **Decoded event** (from a log): `{ "event": <event signature name>, "args": <named-argument object> }` (see [`methods/eth_getTransactionReceipt.md`](./methods/eth_getTransactionReceipt.md)).
- **Decoded call** (from transaction `input` calldata): `{ "function": <function signature name>, "args": <named-argument object> }` (see [`methods/eth_getTransactionByHash.md`](./methods/eth_getTransactionByHash.md)).

**Scope rule.** T2 decoding targets only payload that the requester is unlikely to already understand — emitted events and observed transaction calldata from contracts the requester didn't deploy. Response payloads where the requester supplied the ABI on the request side (e.g. `eth_call` return values, where the same caller built the encoded calldata and therefore owns the matching ABI) **MUST NOT** be decoded by the server; doing so adds no value to the requester and risks divergence when the server's ABI cache differs from the caller's. v1 does not decode such payloads at any tier.

**ABI-unknown fallback.** When the ABI cannot be resolved for an in-scope payload, the server **MUST** preserve the raw element in place and add an in-band flag — `_event_unknown: true` per log, `_function_unknown: true` per transaction. Other elements in the same response remain decoded.

Servers **MUST NOT** invent a decoding.

**No request echo.** T2 transformations **MUST NOT** include fields that merely echo the request — target contract address, function selector, decoded input parameters, block tag, or any other request-derived value — in the response payload. Correlation between request and response is the responsibility of the JSON-RPC `id` field and any client-side in-flight map.

*Rationale: the dominant consumer of a TORPC (Token Optimized RPC) response is an LLM or LLM-driven tool that issued the request and still holds it in context. Duplicating request data in the response is pure overhead in that scenario — on small returns the measured echo cost is +25–40 o200k tokens per response, often larger than the decoded payload itself. Archive / replay scenarios where the consumer holds only the response and not the request are out of scope for v1; consumers in those scenarios correlate via `id` or external indexing, not via redundant in-body echo.*

## Reserved tiers (≥ 3)

Tiers ≥ 3 are **reserved for future revisions** and are not defined in v1. A v1 server **MUST NOT** emit `Token-Tier > 2`. Directions under exploration — action classification, ultra-compact encodings, natural-language summaries — are intentionally left unspecified until they have a normative design and a determinism contract.

## Per-method mapping

Per-method T1 / T2 transformation rules live in separate documents under [`specs/methods/`](./methods/) — one file per method. The main spec stays method-agnostic; each per-method document carries the exact field-level mapping, edge cases, and conformance examples.

Methods without an entry in `specs/methods/` are not yet covered by this spec and **MUST** return raw (`Token-Tier: 0`).

## Open questions

- **ABI version exposure.** T2 determinism depends on the provider's decoding (e.g. ABI availability). Whether to surface a version signal (response header? in-result field?) is open.
- **Media-type alternative.** A future revision may add `Accept: application/vnd.evm+tier<N>;v=1` as an equivalent opt-in mechanism, especially for clients that already drive content negotiation. Servers offering it would add `Accept` to the `Vary` list required by [HTTP caching](#http-caching).
- **Per-element tier signaling in batches.** v1 declares one `Token-Tier` for the whole array, so the array is capped by its weakest element (see [Batched requests](#batched-requests)). A per-element signal, either a parallel header value or an in-element marker, would recover the lost savings at the cost of a new wire-visible construct. Deferred to v1.1+.
- **Method-coverage policy.** When does a method graduate from "T0 only" to T1/T2? Criteria TBD — likely volume + response-size threshold.
- **Numeric type stability — string-vs-number trade-off.** v1 emits all hex-decoded numerics as decimal strings (uniform, safe). The alternative — emit as JSON number when the value fits in `< 2⁵³`, otherwise string — saves ~2 tokens per small numeric but creates **per-array type heterogeneity**: two entries in `receipt.logs[]`, `eth_getBlockReceipts[]`, or `eth_getLogs[]` can have the same logical field typed differently (number vs string). This breaks naive aggregation, DB-column inserts, comparison operators (`"100" < "99"` lexicographically vs `100 < 99` numerically), and any code path that doesn't pre-normalize types. Options under consideration for v1.1+: (a) keep always-string (current); (b) per-array-element-context check (pre-scan a slot; if any element ≥ 2⁵³, all elements in that slot ship as strings); (c) per-field / per-ABI-type declaration in the spec (e.g., `uint8`–`uint48` → number; `uint64`+ → string; T1 fields declared per-name). Each has a different trade between compactness, type stability, and spec complexity. Decision deferred to v1.1+ once a real-world consumer corpus exists to measure aggregation patterns.

## Authors

- Mike Kondratev, Ankr
- Alexander Kolesov, Ankr
- Roman Fasakhov, Ankr
- Stanley Wu, Ankr
