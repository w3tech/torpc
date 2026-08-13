# Conformance cases: schema and conventions

Each `.json` file under `golden/<method>/<name>.json` is one conformance case: a fixed raw
JSON-RPC response plus the exact response a conforming implementation returns at each declared
tier. Nothing in a case names a language, a package or a function, which is what lets one file test
a Go server, a Rust library and a TypeScript package alike.

> **Coverage today: Scaffold v0.0.1, one case, tiers 1 and 2.**
> `eth_getTransactionReceipt/hex-strip-and-drop-service.json` pins the tier-1 and tier-2 receipt
> mapping for one ERC-20 Transfer receipt, captured from Ethereum mainnet block 25,093,593. The
> transaction is immutable, so the case sets `live_capable: true` and replays against a live
> endpoint. Every other method is uncovered, as are the tier-2 ABI-unknown fallback, the ERC-721
> branch of the `Transfer` signature collision, reverted and contract-creation receipts, batching
> and the `Vary` requirement. The conventions below describe the format cases should follow, not a
> body of cases that exists.

Normative reference for every expectation here: [`specs/evm-v1.md`](../../specs/evm-v1.md) and the
per-method document under [`specs/methods/`](../../specs/methods/).

## Shape

```jsonc
{
  "case_version": 1,
  "case": "eth_getTransactionReceipt/hex-strip-and-drop-service",
  "description": "Human-readable one-liner.",
  "spec": {
    "document": "specs/evm-v1.md",
    "sections": ["T1"],
    "method_document": "specs/methods/eth_getTransactionReceipt.md"
  },
  "method": "eth_getTransactionReceipt",
  "request":      { "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionReceipt", "params": ["0x…"] },
  "raw_response": { "jsonrpc": "2.0", "id": 1, "result": {} },
  "expect": [
    { "tier": 1, "token_tier_header": "1",
      "response": { "jsonrpc": "2.0", "id": 1, "result": {} } }
  ],
  "normalize": ["address-case"],
  "live_capable": false,
  "live_capable_reason": "Why this case cannot be replayed against a live endpoint.",
  "asserts":      ["every normative behaviour this case pins"],
  "not_asserted": ["everything a reader might otherwise assume it pins"]
}
```

## Field semantics

- **`case_version`**: `1`. Bumped only when the case schema itself changes.
- **`case`**: must equal `<directory>/<filename without .json>`. The suite checks this, so a
  renamed file cannot keep a stale identity.
- **`description`**: what this case pins, in one sentence of plain English.
- **`spec`**: the document and sections that make the expectation normative, plus the per-method
  document. A case with no citation cannot be reviewed.
- **`method`**: the JSON-RPC method under test. Determines which mapping document applies.
- **`request`**: the request an agent would issue. The HTTP adapter replays it verbatim, adding
  `Accept-Token-Tier` for the tier under test, so it must be a real request for the raw response.
- **`raw_response`**: what a client with no opt-in header receives. Pinned to a specific block or
  transaction at capture time. This is the source of truth for "what does raw look like here".
- **`expect`**: one entry per tier. `response` is the **whole** JSON-RPC response, envelope
  included, not a fragment and not a per-rule snapshot. `token_tier_header` must be the string form
  of `tier`, because the spec defines that header as the applied tier. A `tier: 0` entry must
  reproduce `raw_response` verbatim; the suite enforces it.
- **`normalize`**: optional list of comparison relaxations. Only `address-case` exists, which
  lowercases address-shaped values on both sides. Use it when a case is not trying to pin EIP-55,
  and list EIP-55 under `not_asserted` when you do.
- **`live_capable`**: whether the case can be replayed against a live endpoint. `false` requires
  `live_capable_reason`, so a case never silently skips.
- **`asserts`** and **`not_asserted`**: what the case does and does not pin. `not_asserted` is
  mandatory even when empty, so a case can never imply coverage it does not have.

Keep capture provenance out of the file. No API keys, no endpoint URLs, no internal hostnames: a
case is public-domain input data, and where it was captured is not part of the contract.

## What the comparison enforces

From `specs/evm-v1.md` Behavior rule 6, the cross-server contract is structural equivalence: the
same field set and the same values. So:

- **Key order is not compared.** JSON serializers do not agree on it, Go's notably does not, and the
  spec deliberately does not make byte layout normative. Per-server byte stability is what makes
  prompt caching work, and that is a server property, not a cross-implementation one.
- **Presence and absence of every field, at every depth.** A dropped field that reappears fails.
- **Value types, strictly.** Hex-decoded numerics are decimal strings at every magnitude in v1. A
  JSON number in that position fails, and that is the point: a magnitude-dependent type makes the
  same field a string in one array element and a number in the next.
- **Array order**, which is significant.
- **Addresses** carry EIP-55 checksum casing on address-typed fields unless the case normalises
  address case.
- **Structurally stripped 32-byte values** (for example unpadded `topics[1..N]`) stay lowercase.
  EIP-55 must not be applied to them, even when the result is address-shaped, because the strip
  makes no claim about the semantic type.
- **Unenumerated fields** pass through verbatim. A case may assert this, and one eventually should:
  chain-specific extensions are exactly where implementations drift.

## Per-method conventions

Field names and per-tier actions are defined in the per-method documents, which are the source of
truth. The list below is only what the current case relies on.

### `eth_getTransactionReceipt`

See [`specs/methods/eth_getTransactionReceipt.md`](../../specs/methods/eth_getTransactionReceipt.md).
The existing case pins, at tier 1:

- Renames: `transactionHash` to `tx`, `transactionIndex` to `tx_index`, `blockNumber` to `block`,
  `blockHash` to `block_hash`, `gasUsed` to `gas_used`, `effectiveGasPrice` to `gas_price`. Note
  that the receipt-level `transactionIndex` is **kept** under its new name; only the per-log copy is
  dropped.
- Drops: `logsBloom`, `cumulativeGasUsed`, `type`, and the per-log duplicates of `blockHash`,
  `blockNumber`, `transactionHash`, `transactionIndex`, `blockTimestamp` (EIP-7642), `logIndex`,
  `removed`. `contractAddress` is dropped when null.
- `status` becomes `"success"` or `"failed"`.
- `topics[0]`, the event signature hash, survives unchanged. `topics[1..N]` carrying exactly 12
  leading zero bytes are stripped to their trailing 20 bytes, lowercase.
- `block`, `tx_index`, `gas_used` and `gas_price` are decimal strings.

And, at tier 2:

- The receipt-level field set is identical to tier 1. Only the per-log object changes.
- Per-log `address` becomes `contract`.
- `topics[0]` is resolved to an event name in `event`, and the raw signature hash is discarded.
- `topics[1..N]` and `data` are decoded into one `args` object, keyed by ABI parameter name in ABI
  parameter order. The raw `topics` and `data` are discarded.
- The `Transfer` signature collision is disambiguated by topic count: three topics with a 32-byte
  `data` word is ERC-20, so `value` is decoded from `data`. The four-topic ERC-721 branch has no
  case yet.
- Numeric `args` values are decimal strings, the same primitive tier 1 applies.

### Other methods

No cases yet. When adding the first case for a method, follow the field names in that method's
document under `specs/methods/` rather than inventing new ones here, and update the coverage note
at the top of this file so the honest count stays honest.
