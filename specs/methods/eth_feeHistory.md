# `eth_feeHistory` — per-method mapping

| | |
|---|---|
| **Status** | T1 normative |
| **Traffic** | Rank #48 by call volume on the public RPC tier. Wallet and aggregator workload, quoting gas-price suggestions across recent history. |

> Hex-decoded numerics are emitted as **decimal strings** per the global hex-to-decimal numeric encoding primitive in [`../evm-v1.md`](../evm-v1.md) §T1. Ratio fields are already JSON floats in the raw response and pass through verbatim.

---

## 1. How it works

`eth_feeHistory(blockCount, newestBlock, rewardPercentiles?)` returns a window of recent block-level fee statistics. The response carries five-to-seven parallel arrays plus a single `oldestBlock` anchor — every other array indexes into the same `[oldestBlock, oldestBlock + N - 1]` block range that the request defined.

Two of the array families are post-EIP-4844 (`baseFeePerBlobGas`, `blobGasUsedRatio`); the rest are EIP-1559 (`baseFeePerGas`, `gasUsedRatio`, optional `reward`).

Compression value comes from two places:

1. **Hex → decimal across two-to-three numeric arrays** — `baseFeePerGas[]` (N+1 entries), `baseFeePerBlobGas[]` (N+1 entries, post-Cancun), and `reward[][]` (N × P entries when percentiles requested). The `reward` 2D array dominates byte budget on calls that request percentiles; per-entry hex → decimal saving compounds.
2. **Top-level field rename to snake_case** — uniform with the rest of the spec; aligns LLM-prompt formatting across methods.

Worked example throughout this doc: an Ethereum mainnet call requesting 4 blocks ending at block `0x180fc7c` (25,230,460) with the `[25, 50, 75]` reward percentiles. Post-Cancun, so blob fee fields are present.

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_feeHistory",
  "params": ["0x4", "0x180fc7c", [25, 50, 75]]
}
```

### Raw response (650 compact bytes)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "oldestBlock":       "0x180fc79",
    "baseFeePerGas":     ["0x724c4103", "0x78e3978d", "0x7a47805d", "0x875f1911", "0x880ef471"],
    "gasUsedRatio":      [0.7306662199192918, 0.546001558742848, 0.928271117493123, 0.5202979599356182],
    "baseFeePerBlobGas": ["0x4ed2445", "0x527047a", "0x527047a", "0x56de794", "0x56de794"],
    "blobGasUsedRatio":  [0.5714285714285714, 0.0, 0.6666666666666666, 0.0],
    "reward": [
      ["0xbebc200",  "0x3c2d38a3", "0x621d21e0"],
      ["0x9f2b120",  "0x448b9b80", "0x77359400"],
      ["0xa7d8c2",   "0xdc88fb1",  "0x5df55f27"],
      ["0xa852d20",  "0x3b9aca00", "0x715bfc75"]
    ]
  }
}
```

Two structural compression opportunities are visible by inspection:

1. **Two arrays of `N+1` hex-encoded base-fee values** (`baseFeePerGas`, `baseFeePerBlobGas`). At the worked-example size each entry is 8–11 chars hex; hex → decimal cuts to 4–10 chars decimal with no information loss.
2. **The `reward` 2D array** — `N × P` hex-encoded integers. The example carries 12 entries; at the API's typical `blockCount` of 4–10 and 3–5 percentiles, this is 12–50 entries per call. Per-call dominant when percentiles are requested.

---

## 2. T1 — Mechanical (normative)

Field-level transforms, no external lookup. This method has **no drop rules**: every transformation below is either a rename or the hex-to-decimal numeric encoding primitive, both mechanically reversible, so the T1 output carries every field of the raw response. Nothing here needs a re-query to reconstruct.

### Top-level fields

| Raw field | Transformation | Example result |
|---|---|---|
| `oldestBlock` | rename → `oldest_block`, apply the **hex-to-decimal numeric encoding** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 | `"oldest_block": "25230457"` |
| `baseFeePerGas` | rename → `base_fee_per_gas`, hex → decimal on **each array element** | `["1917600003", "2028181389", …]` |
| `gasUsedRatio` | rename → `gas_used_ratio`, keep array elements verbatim (already JSON floats in `[0, 1]`) | `[0.7306662…, 0.546001…, …]` |
| `baseFeePerBlobGas` | rename → `base_fee_per_blob_gas`, hex → decimal on each array element (EIP-4844 only — pass through verbatim when absent) | `["82650181", "86443130", …]` |
| `blobGasUsedRatio` | rename → `blob_gas_used_ratio`, keep array elements verbatim (EIP-4844 only) | `[0.5714…, 0.0, …]` |
| `reward` | keep field name (already concise, semantically anchored); hex → decimal on **every entry of every inner array** (omitted from raw when `rewardPercentiles` was not requested) | `[["200000000", "1009596579", …], …]` |

Chain-specific extension fields — **pass through verbatim** per the global unknown-field passthrough rule.

### Result (504 compact bytes — **−22.5%** vs raw)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "oldest_block":          "25230457",
    "base_fee_per_gas":      ["1917600003", "2028181389", "2051506269", "2271156497", "2282681457"],
    "gas_used_ratio":        [0.7306662199192918, 0.546001558742848, 0.928271117493123, 0.5202979599356182],
    "base_fee_per_blob_gas": ["82650181", "86443130", "86443130", "91088788", "91088788"],
    "blob_gas_used_ratio":   [0.5714285714285714, 0.0, 0.6666666666666666, 0.0],
    "reward": [
      ["200000000",  "1009596579", "1646076384"],
      ["166900000",  "1150000000", "2000000000"],
      ["11000002",   "231247793",  "1576361767"],
      ["176500000",  "1000000000", "1901853813"]
    ]
  }
}
```

T1 saving is dominated by the `reward` 2D array on calls that request percentiles, then `baseFeePerGas` and `baseFeePerBlobGas`. The renames are free in byte terms (same length) but unify nomenclature with the rest of the spec.

---

## 3. T2 — Semantic

**Not applicable.** Every field is a pure numeric or ratio; no ABI-decodable payload, no event signatures, no calldata. T2 ≡ T1 for this method.

---

## 4. Edge cases

- **`rewardPercentiles` omitted from request.** The raw response omits the `reward` field entirely. Unknown-field passthrough — no `reward` in the output either.
- **Pre-Cancun block range.** The raw response omits `baseFeePerBlobGas` and `blobGasUsedRatio`. Same rule — fields absent in raw stay absent in output.
- **`blockCount = 0` (some clients reject; others return empty arrays).** When arrays are empty, the renames still apply; hex → decimal is a no-op on zero-length arrays.
- **`baseFeePerGas[N]` lookahead semantics.** The `baseFeePerGas` array has `N+1` entries while `gasUsedRatio` has `N` — the trailing entry is the **next** block's base fee. Both arrays carry their full length through the transform; the off-by-one relationship is preserved.
- **Reward percentile bounds.** Clients vary on how they handle percentiles like `0` or `100` (some snap to the lowest / highest tip in the block; others reject). The numeric is preserved as-returned; transform is shape-agnostic.
- **Pending / future-block range.** Some clients accept a `"pending"` tag in `newestBlock`. The response shape is the same; per-block-tag handling is the client's concern.

---

## 5. Open questions

- **`reward` field rename.** Kept verbatim because the name is already concise and semantically anchored. Renaming to `tip_percentiles` or `rewards` would be cosmetic; deferred.
- **Ratio field precision.** `gasUsedRatio` and `blobGasUsedRatio` ship as full IEEE 754 doubles in raw. Some downstream consumers don't need more than 4–5 significant digits. Truncating to a configurable precision is a candidate T1 enhancement but breaks bit-exact round-tripping — deferred to v1.1+ once tabular sub-variants land and the loss-vs-savings policy is settled.
- **`+tabular` for the four-array shape.** The five-array body of `eth_feeHistory` is a natural tabular candidate — every parallel array indexes into the same block range. A `+tabular` variant would emit a single block-indexed row set (one row per block, columns `base_fee_per_gas`, `gas_used_ratio`, `base_fee_per_blob_gas`, `blob_gas_used_ratio`, `reward_p25`, `reward_p50`, `reward_p75`). Composes with the `+tabular` sub-variant tracked in [`eth_getLogs.md`](./eth_getLogs.md) §5. Deferred to v1.1+.
