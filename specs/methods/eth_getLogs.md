# `eth_getLogs` — per-method mapping

| | |
|---|---|
| **Status** | T1 + T2 normative |
| **Traffic** | Rank #5 by call volume on the public RPC tier. |

> Address values in the worked examples below are shown lowercase / abbreviated for readability; conformant output applies EIP-55 checksum casing to dedicated address-typed fields (log `address` / `contract`, and decoded `address` parameters inside `args`). Topic values are emitted lowercase per the structural zero-block strip primitive in [`../evm-v1.md`](../evm-v1.md) §T1. Hex-decoded numerics are emitted as decimal strings per the same spec.

---

## 1. How it works

`eth_getLogs` returns a **flat array** of event logs matching a filter (`address`, `topics`, `fromBlock`/`toBlock` range). Unlike `eth_getTransactionReceipt`, there is no enclosing envelope — the response shape is `result: [Log, Log, ...]`. Each log entry carries its own block / transaction / position metadata because logs in one response can span multiple blocks and multiple transactions; these fields are **load-bearing**, not redundant.

The per-log object is the same shape as the elements inside a receipt's `logs[]` array, but with three structural differences:

1. **No envelope to hoist into.** The result IS the array.
2. **Per-log `block`, `block_hash`, `tx`, `tx_index`, `log_index` can't be dropped.** They vary across elements.
3. **Result uniformity is common.** Typical filter queries (one address + one topic) return logs with a single event signature across the entire result, opening up tabular compression. v1 codifies T1 + T2 only; the `+tabular` sub-variant captures the empirically-measured 15+ pp additional saving over T2 and is deferred to v1.1+.

Worked example throughout this doc: a DAI ERC-20 `Transfer` log from the `02-dai-range-uniform` scenario (48 logs over 21 blocks, block 25,093,824–25,093,843; one log shown).

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getLogs",
  "params": [{
    "address": "0x6b175474e89094c44da98b954eedeac495271d0f",
    "topics":  ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
    "fromBlock": "0x17ee6c0",
    "toBlock":   "0x17ee6d3"
  }]
}
```

### Raw response (one log of 48 shown)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": [
    {
      "address":          "0x6b175474e89094c44da98b954eedeac495271d0f",
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000c2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8",
        "0x00000000000000000000000092f8a1b2c3d4e5f60718293a4b5c6d7e8f9026a7"
      ],
      "data":             "0x0000000000000000000000000000000000000000000000000f9c2a3b4c5d6e7f",
      "blockNumber":      "0x17ee6c0",
      "blockHash":        "0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192",
      "transactionHash":  "0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790",
      "transactionIndex": "0x14",
      "logIndex":         "0x234",
      "removed":          false
    }
    // ... 47 more
  ]
}
```

Structural compression opportunities, by inspection:

1. **Per-log redundancy when result is multi-block / multi-tx** — `removed: false` is constant (HTTP `eth_getLogs` never streams reorg'd logs); address-topic padding repeats per log.
2. **Per-log redundancy when result is single-block / same-tx** — additional candidates open up but v1 keeps the array shape unconditionally; see [§5](#5-open-questions).
3. **Schema repetition when result is uniform-shape** — for a typical filter (one address + one topic) every log emits the same JSON keys (`"contract"`, `"event"`, `"args"`, `"block"`, …). Killing repeated keys is the `+tabular` win (v1.1+); on the 416-log fixture (`06-large-erc20-range`), it cuts another 53 KB / 21 K tokens out of T2.

There is **no `logsBloom`** in this response shape (the bloom belongs to the block / receipt envelope, not to individual logs), so the mechanical-removable budget in v1 caps at ~−30% tokens. The bigger win at T2 comes from ABI-decoding; the bigger win in v1.1+ comes from `+tabular`.

---

## 2. T1 — Mechanical (normative)

Per-log transforms, no external lookup. Every carried field here is mechanically reversible (renames, hex to decimal, EIP-55 casing, the structural zero-block strip). This method's **only** drop is `removed: false`, and that one is recoverable by policy: an absent `removed` means `false`. No position or block-context field is dropped, so T1 output for `eth_getLogs` needs no re-query to reconstruct the raw field set.

No top-level hoisting; `result` stays a flat `Log[]` array unconditionally.

### Per-log fields

| Raw field | Transformation | Example result |
|---|---|---|
| `address` | EIP-55 checksum casing | `"address": "0x6B175474E89094C44Da98b954EedeAC495271d0F"` |
| `topics[]` (each element) | apply the **structural zero-block strip** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 to each topic value. No EIP-55 (the strip carries no type claim). In practice the strip is a no-op for `topics[0]` (a keccak256 event-signature hash; probability of ≥12 leading zero bytes is ~2⁻⁹⁶) and meaningful only for the indexed-parameter topics in `topics[1..N]`. | `topics[0]`: unchanged · `topics[1]`: `"0xc2e9eb3d…25f8"` (12 zero bytes stripped) |
| `data` | keep verbatim | `"data": "0x0000…6e7f"` |
| `blockNumber` | rename → `block`, apply the **hex-to-decimal numeric encoding** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 (always decimal string in v1) | `"block": "25093824"` |
| `blockHash` | rename → `block_hash`, keep verbatim. Required per-log: the same block height can have multiple `blockHash` values during a reorg — `block_hash` uniquely identifies which block this log came from. | `"block_hash": "0xa1b2c3d4…8192"` |
| `transactionHash` | rename → `tx`, keep verbatim. Required per-log because logs in one response come from different transactions. | `"tx": "0xd1f6e7a8…2790"` |
| `transactionIndex` | rename → `tx_index`, hex → decimal (always string). Kept because `(block, tx_index)` identifies the transaction's position in consensus history (ordering, MEV / sandwich reasoning, state-proof Merkle paths). | `"tx_index": "20"` |
| `logIndex` | rename → `log_index`, hex → decimal (always string). Kept because `(block, log_index)` is the canonical unique identifier of a log within a block — needed for stable sorting, dedupe across reorgs, and indexer cursor advancement. | `"log_index": "564"` |
| `blockTimestamp` | rename → `block_timestamp`, hex → decimal (always string). **Conditional**: present in output if and only if it was present in the raw response. Presence is client-dependent: some clients populate the field on every log, others omit it entirely. | `"block_timestamp": "1761823263"` |
| `removed: false` | **drop** (always `false` for HTTP `eth_getLogs`; only meaningful for WebSocket subscriptions on reorg) | — |
| `removed: true` | keep verbatim — signals that this log was reorged out (rare on HTTP but spec-legal) | `"removed": true` |

Chain-specific log extension fields — **pass through verbatim** per the unknown-field passthrough rule in [`../evm-v1.md`](../evm-v1.md) §T1.

### Result (one log shown of 48)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": [
    {
      "address":    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0xc2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8",
        "0x92f8a1b2c3d4e5f60718293a4b5c6d7e8f9026a7"
      ],
      "data":       "0x0000000000000000000000000000000000000000000000000f9c2a3b4c5d6e7f",
      "block":      "25093824",
      "block_hash": "0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192",
      "tx":         "0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790",
      "tx_index":   "20",
      "log_index":  "564"
    }
    // ... 47 more
  ]
}
```

Most of the saving comes from the `removed: false` drop, the structural zero-block strip on indexed-address topics (24 hex chars per padded address), and the rename compaction (`transactionHash` → `tx`, `blockNumber` → `block`, …). Hex-decoded numerics ship as decimal strings per the global primitive. T1 ≈ **−30% tokens** across the 6-fixture corpus (lower than the ~−50% on receipts because there's no `logsBloom` to delete).

---

## 3. T2 — Semantic (normative)

T1 + ABI-aware decoding of every log entry. The per-log block / tx / position metadata (`block`, `block_hash`, `tx`, `tx_index`, `log_index`, optional `block_timestamp` / `removed: true`) is **identical to T1** and carries through unchanged. Only the event-shape portion (`address`, `topics`, `data`) changes.

**For each element of `result[]`**, apply the per-log T2 transform from [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md) §T2 verbatim — `address` → `contract` (EIP-55), `topics[0]` → `event` via 4byte, `topics[1..N]` + `data` → `args` (keyed by ABI parameter name in ABI order), `_event_unknown: true` per-log fallback for unresolved topic0, ERC-20 / ERC-721 `Transfer` disambiguation by topic count.

Whole-response downgrade is **never** triggered for a single unknown log — `eth_getLogs` results commonly mix well-known events with chain- or protocol-specific ones.

### Result (one log shown of 48)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": [
    {
      "contract":   "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "event":      "Transfer",
      "args": {
        "from":  "0xc2E9eB3D2F1a3B4c5D6E7F8091A2b3C4D5e625F8",
        "to":    "0x92F8a1B2c3D4e5F60718293a4b5C6D7E8F9026a7",
        "value": "1124671966097645359"
      },
      "block":      "25093824",
      "block_hash": "0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192",
      "tx":         "0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790",
      "tx_index":   "20",
      "log_index":  "564"
    }
    // ... 47 more
  ]
}
```

T2 ≈ **−48% tokens** across the 6-fixture corpus.

---

## 4. Edge cases

- **Empty result (`result: []`).** Pass through verbatim at every tier. No transforms apply. T0 = T1 = T2 by definition.
- **Multi-block, multi-transaction result.** The default case. Each log carries its own `block`, `block_hash`, `tx`, `tx_index`, `log_index`. No hoisting.
- **All logs from one block.** Could theoretically hoist `block` / `block_hash` to a top-level wrapper (saving ~3–4 pp T1 tokens per the research), but that would change `result`'s type from array to object — breaking consumer type stability. v1 keeps `result` as `Log[]` unconditionally; see [§5](#5-open-questions). The `+tabular` sub-variant in v1.1+ captures this saving more cleanly because the tabular shape is already non-array-typed.
- **Reorged log (`removed: true`).** Kept verbatim at T1 with the `removed: true` flag preserved. At T2, decoded normally with the `removed: true` flag preserved as a sibling of `event` / `args`. Rare on HTTP `eth_getLogs` but spec-legal.
- **Mixed known / unknown events** (`03-multi-contract` exercises this). Unknown logs tagged `_event_unknown: true`; known logs remain decoded. No whole-response downgrade.
- **`blockTimestamp` absent.** Some clients omit the field entirely; others emit it on every log. v1 follows the raw response — present in output if and only if present in input. Cross-server determinism therefore requires consumers to know which client populated the response.
- **Chain-specific log extension fields.** Pass through verbatim at every tier per [`../evm-v1.md`](../evm-v1.md) §T1 unknown-field passthrough. Servers MUST NOT rename or hex-decimal-convert them.
- **Indexed `bytes32` topics whose leading 12 or 24 bytes happen to be zero.** The structural zero-block strip is shape-based and type-agnostic, so a `bytes32` topic that fits the pattern will be stripped. The transform is **fully reversible** (left-pad to 32 bytes) so no information is lost; at T2 the ABI declares the parameter type and decoding proceeds correctly.

---

## 5. Open questions

- **`+tabular` sub-variant promotion.** Empirical evidence shows tabular encoding beats T2 by 15+ pp tokens on uniform-shape responses with no information loss (reversible to T2). The remaining work is the cross-method generalization of the `{fields, rows}` shape — the same pattern fits `eth_feeHistory` and certain trace-method results — and the `Accept` / `Token-Tier` header semantics for opting into sub-variants. Deferred to v1.1+.
- **`+aggregate` sub-variant.** Lossy summary shape useful for analytics. Vocabulary is small for a v1.1 starter coverage (ERC-20 `Transfer` sum, `Approval` count); grows from there. Deferred to v1.1+. Requires a `raw_pointer` mechanism since aggregation is lossy — that mechanism is also deferred.
- **Block-level hoisting when all logs share one block.** Would save ~3–4 pp of T1 tokens on single-block-uniform responses, but changes `result`'s type from array to object — a breaking-shape conditional that the always-array choice in v1 declines to take. Re-evaluate once `+tabular` lands; the tabular shape is non-array-typed by construction, so the block hoist composes naturally into it.
- **Partial-uniformity tabular.** Heterogeneous results with one dominant event signature (e.g., 90% `Transfer` + a few odd events) could emit a partial-tabular section plus a stragglers array. Worth measuring vs vanilla T2 on a real heterogeneous corpus.
- **`blockTimestamp` standardization.** Currently conditional on raw-response presence, because client support is uneven. Once the field is populated consistently across client implementations, it may become a normatively-required field at T1 (would simplify consumers, at the cost of one extra hex → decimal per log on chains that didn't previously emit it).
- **Batched JSON-RPC requests.** Resolved in v1: see [Batched requests](../evm-v1.md#batched-requests) in the core spec. Each element is evaluated independently, the single response header carries the minimum applied tier across the array, and no element may be transformed above that declared tier.
