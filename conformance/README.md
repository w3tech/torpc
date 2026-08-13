# TORPC conformance suite

Spec-compliance vectors for implementations of [EVM RPC Compression v1](../specs/evm-v1.md)
(`specs/evm-v1.md`) and its [per-method mappings](../specs/methods/). A case asserts that a
candidate implementation, given a fixed raw JSON-RPC response, produces exactly the response the
spec mandates at a given tier.

> **Status: Scaffold v0.0.1.** The suite contains **one** case:
> `golden/eth_getTransactionReceipt/hex-strip-and-drop-service.json`, which pins the tier-1 receipt
> mapping at tier 1 and tier 2, captured from the production endpoint, so both tiers are
> machine-checked on that one receipt. That is the whole of the current coverage. Nothing
> here should be read as evidence that an implementation is spec-complete, and the "TORPC
> Conformant" designation defined in [`GOVERNANCE.md`](../GOVERNANCE.md) opens when coverage lands,
> not now. Until then no implementation may claim it, Ankr's included.

## Goal

Conformance is not a benchmark.

- **Conformance** (this suite): does the candidate produce the exact output the spec mandates?
  Pass or fail, strict.
- **Benchmark** (the `bench/` harness in [w3tech/torpc-js](https://github.com/w3tech/torpc-js)):
  how token-efficient is the candidate, and how accurately can a model answer questions from its
  output? Quantitative.

Two servers can reach T2 through completely different ABI sources and 4byte mirrors. The spec
allows that. What it does not allow is a different output shape. These vectors are where "same
shape" is pinned down in operational terms.

## The vectors are implementation-agnostic, the runner has no dependencies

A case file contains only the spec's own material: a request, a raw response, and the exact
response expected at each tier. It never mentions a language, a package or a function. The runner
ships no transform of its own either: it asks an implementation for the transformed response
through an **adapter** and compares the answer. So a Go server, a Rust library and a TypeScript
package are all tested by the same files, and a passing run means the implementation matches the
spec rather than matching us.

The runner is plain JavaScript with zero dependencies. There is nothing to install.

## How to run

Requires Node 22.6 or newer.

```bash
npm test                                                            # validate the vectors
npm run test:case eth_getTransactionReceipt/hex-strip-and-drop-service   # inspect one case
```

With no adapter configured, the run validates every vector against the case schema and says plainly
that no implementation was exercised. That is the useful CI signal for this repository, which holds
no implementation. It never reports a conformance pass that did not happen.

### Adapters

**Command adapter** (any language). Set `TORPC_CMD` to a command that reads a job on stdin and
writes the transformed JSON-RPC response on stdout:

```bash
TORPC_CMD='./my-encoder --conformance' npm test
```

```jsonc
// stdin
{ "tier": 1, "request": { "jsonrpc": "2.0", "id": 1, "method": "...", "params": [] },
  "raw_response": { "jsonrpc": "2.0", "id": 1, "result": {} } }

// stdout: either the transformed response object, or this envelope when the
// implementation wants to report the tier it actually applied
{ "response": { "jsonrpc": "2.0", "id": 1, "result": {} }, "token_tier": "1" }
```

A worked adapter for the reference TypeScript decoder lives at
`codec/scripts/conformance-adapter.ts` in [w3tech/torpc-js](https://github.com/w3tech/torpc-js);
it is about thirty lines and is the template to copy.

**HTTP adapter** (a live endpoint). Set `TORPC_URL` and the runner replays each case request with
`Accept-Token-Tier`, then compares the response body and the `Token-Tier` response header:

```bash
TORPC_URL='https://rpc.example.com/eth/YOUR_KEY' npm test
```

Only cases with `live_capable: true` run this way. A case built on a synthetic transaction cannot
be replayed against a live node, and says so in `live_capable_reason` rather than silently passing.

## When a case passes or fails

A case passes when the implementation's response is **structurally equivalent** to the expected
response: the same field set and the same values, compared type-strictly. Per
[`specs/evm-v1.md`](../specs/evm-v1.md) Behavior rule 6, byte layout is not normative, because JSON
serializers do not agree on key order, so key order is not compared. What is compared:

- Presence and absence of every field, at every depth. A dropped field that reappears is a failure.
- Value types. A numeric emitted as a JSON number where v1 mandates a decimal string is a failure,
  not a formatting difference.
- Array order, which is significant.
- The `Token-Tier` response header, when the adapter reports one.

Address casing is normalised on both sides when a case declares `"normalize": ["address-case"]`,
because EIP-55 needs keccak and the runner is deliberately dependency-free. Such a case lists
EIP-55 under `not_asserted`, and a dedicated casing vector will assert it.

A failure is a contract violation with exactly two honest resolutions: fix the implementation, or
change the case in a pull request that cites the spec section justifying the new expectation.

## Case format

One case per file, at `golden/<method>/<name>.json`.

```jsonc
{
  "case_version": 1,
  "case": "eth_getTransactionReceipt/hex-strip-and-drop-service", // must equal <dir>/<file>
  "description": "What this case pins, in one sentence.",
  "spec": {
    "document": "specs/evm-v1.md",
    "sections": ["T1"],
    "method_document": "specs/methods/eth_getTransactionReceipt.md"
  },
  "method": "eth_getTransactionReceipt",
  "request":      { "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionReceipt", "params": ["0x…"] },
  "raw_response": { "jsonrpc": "2.0", "id": 1, "result": { } },
  "expect": [
    { "tier": 1, "token_tier_header": "1",
      "response": { "jsonrpc": "2.0", "id": 1, "result": { } } }
  ],
  "normalize": ["address-case"],
  "live_capable": false,
  "live_capable_reason": "Why this case cannot be replayed live.",
  "asserts":      ["every normative behaviour this case pins"],
  "not_asserted": ["everything a reader might otherwise assume it pins"]
}
```

The schema is enforced by the suite: a tier-0 expectation must reproduce the raw response verbatim,
`token_tier_header` must equal its tier, the envelope `id` must survive, and `not_asserted` must be
present even when empty, so a case can never imply coverage it does not have. See
[`golden/README.md`](golden/README.md) for per-method conventions.

## Adding a case

1. Create `golden/<method>/<name>.json`.
2. Capture `raw_response` once from a node, pinned to a specific block or transaction, so the input
   never changes under you. Do not include API keys, endpoint URLs, or anything about where you
   captured it. If the transaction is real and immutable, set `live_capable: true`.
3. Derive the expected response from the spec and its per-method document, not from a
   convenient implementation. Cite the sections in `spec`. A case that cannot cite the spec is not
   a conformance case.
4. Fill `asserts` and `not_asserted` honestly.
5. Run `npm test`, then run it again with an adapter pointed at a real implementation.
6. Open a pull request. The reviewer checks the expectation against the cited spec section, not
   against any implementation.

Cases that pin a normative edge (batching, the `Vary` requirement, an ABI-unknown fallback, an
error element inside a batch) are worth more than another happy-path receipt.

## Licence

CC0 1.0 Universal, like everything else in this repository, including this runner. See
[`LICENSE`](../LICENSE). Anyone implementing TORPC may run, copy, modify or vendor this suite
without restriction and without attribution. Use of the TORPC name and of the "TORPC Conformant"
claim is addressed in [`TRADEMARKS.md`](../TRADEMARKS.md) and [`GOVERNANCE.md`](../GOVERNANCE.md).
