# Hex-integer scalar methods — per-method mapping

| | |
|---|---|
| **Status** | T1 normative |
| **Covers** | Methods whose success-path `result` is a single hex-encoded integer at the JSON root. Twelve methods share this shape and a single T1 rule. |
| **Traffic** | Highest entrant `eth_getBalance` (rank #4 by call volume on the public RPC tier). Lowest entrant `eth_getUncleCountByBlockNumber` (rank #543). This response shape is collectively one of the highest-volume families on the tier. |

> Hex-decoded numerics are emitted as **decimal strings** per the global hex-to-decimal numeric encoding primitive in [`../evm-v1.md`](../evm-v1.md) §T1. The transform is uniform; this document collects the methods that share it.

---

## 1. How it works

Every method in this group returns a JSON-RPC success response whose `result` is a single `"0x"`-prefixed integer:

```jsonc
{ "jsonrpc": "2.0", "id": 1, "result": "0x180fcbd" }
```

That value carries the entire semantic payload — there is no envelope, no nested object, no array. Compression value is purely the hex-to-decimal saving on the literal: `"0x180fcbd"` (10 bytes / 6 o200k tokens) → `"25230525"` (10 bytes / 4 o200k tokens). Per-call saving is small in absolute terms; the volume across the twelve methods is large.

### Methods covered

| Method | Worked-example raw result | Notes |
|---|---|---|
| `eth_blockNumber()` | `"0x180fcbd"` | current head block — pure polling traffic |
| `eth_chainId()` | `"0x1"` | network identifier — boot / probe traffic |
| `eth_gasPrice()` | `"0x719171a3"` | legacy gas price (gwei) |
| `eth_maxPriorityFeePerGas()` | `"0xf4240"` | EIP-1559 priority fee suggestion (wei) |
| `eth_blobBaseFee()` | `"0x6a4e228"` | EIP-4844 blob base fee (wei) |
| `eth_getBalance(addr, block)` | `"0x1f5d275aa12bbfc77fbf4"` | account balance (wei) — values routinely > 2⁵³ |
| `eth_getTransactionCount(addr, block)` | `"0x1"` | account nonce |
| `eth_estimateGas(tx)` | `"0x5208"` | gas estimate |
| `eth_getBlockTransactionCountByHash(hash)` | `"0x100"` | tx count for a given block hash |
| `eth_getBlockTransactionCountByNumber(block)` | `"0x100"` | tx count for a given block tag / number |
| `eth_getUncleCountByBlockHash(hash)` | `"0x0"` | uncle count for a given block hash |
| `eth_getUncleCountByBlockNumber(block)` | `"0x0"` | uncle count for a given block tag / number |

All twelve methods share the same response shape; the lookup parameter set differs but does not affect the result.

### Worked example

```jsonc
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] }

// Raw response
{ "jsonrpc": "2.0", "id": 1, "result": "0x180fcbd" }
```

---

## 2. T1 — Mechanical (normative)

Single rule. Apply the **hex-to-decimal numeric encoding** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 to `result`. Output is a decimal string — always string, regardless of magnitude.

| Raw shape | Transformation | Example result |
|---|---|---|
| `result: "0x"`-prefixed integer | hex → decimal string | `"result": "25230525"` |
| `result: "0x"` (degenerate empty) | decode to `"0"` per the primitive | `"result": "0"` |
| `result: null` (see Edge cases) | passthrough verbatim | `"result": null` |
| `result` of any other shape | passthrough verbatim — per `evm-v1.md` §T1 "Unknown-field passthrough"; the per-method ruleset only fires when the shape matches | unchanged |

Hex values exceeding `2⁵³` are common (balance fields routinely sit in the `1e20`–`1e22` wei range). The always-string output makes type behavior uniform across magnitudes — see [`../evm-v1.md`](../evm-v1.md) §Open questions for the rationale.

### Result (worked example)

```jsonc
{ "jsonrpc": "2.0", "id": 1, "result": "25230525" }
```

T1 saving is ≈ 2 o200k tokens per call. Negligible per call; meaningful at aggregate volume.

---

## 3. T2 — Semantic

**Not applicable.** The result is a scalar with no ABI-decodable shape. T2 ≡ T1 for every method in this group.

---

## 4. Edge cases

- **`null` result.** `eth_getBlockTransactionCountByHash`, `eth_getBlockTransactionCountByNumber`, `eth_getUncleCountByBlockHash`, and `eth_getUncleCountByBlockNumber` return `null` when the block can't be resolved (unknown hash, future block number, pruned history). Other methods in the group can also return `null` in equivalent unknown-target conditions. Always passthrough verbatim.
- **`eth_estimateGas` failure.** When the estimated transaction would revert, clients return a JSON-RPC **error response** (not a success response with a numeric result). Errors are returned verbatim per the spec-wide success-only scope; `Token-Tier: 0` on the response.
- **Pre-merge uncle counts.** `eth_getUncleCountByBlock*` returns `"0x1"`, `"0x2"` on rare pre-merge blocks; post-merge blocks always return `"0x0"`. Transform is identical either way.
- **Trailing-zero counts.** `eth_chainId` on most mainnets is `"0x1"`–`"0x100"`; transform produces the obvious decimal. No special handling.
- **Unsupported method on this chain.** Some chains do not implement every method (e.g., `eth_blobBaseFee` only post-Cancun). The node returns a JSON-RPC error; passes through verbatim at T0.

---

## 5. Open questions

- **`eth_chainId` as a numeric vs identifier.** `eth_chainId` returns a value that consumers conceptually treat as an identifier (`1`, `10`, `42161`) rather than a numeric to do arithmetic with. The hex → decimal rule still applies — uniform handling beats per-method exceptions — but a future revision could declare specific methods "identifier-typed" and keep their hex form. Tracked.
- **Per-method renames.** None of the twelve methods rename `result` (it stays at the root). Other methods in the spec rename top-level fields freely (e.g., `eth_getTransactionReceipt` renames `transactionHash` → `tx`); the scalar group has no equivalent flexibility because the field is the result itself. If `+ultra-compact` (T4) ever lands, this is where it would diverge — e.g., emit the raw decimal at the root with no JSON envelope.
