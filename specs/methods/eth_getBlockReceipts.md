# `eth_getBlockReceipts` — per-method mapping

| | |
|---|---|
| **Status** | T1 + T2 normative |
| **Covers** | `eth_getBlockReceipts(block_tag_or_hash)` — returns a flat array of every transaction receipt in the block. Per-receipt shape is **byte-for-byte identical** to the result of [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md). |
| **Traffic** | Indexer / archive workload — relatively low single-call frequency but large per-call payload. Canonical block (25,093,593) ships ≈ 95 KB raw across 329 receipts. |

> Address values are emitted in EIP-55 checksum casing in **dedicated address-typed fields** (`from`, `to`, `contractAddress`, log `address` / `contract`). Topic values are emitted **lowercase** at T1 per the structural zero-block strip primitive in [`../evm-v1.md`](../evm-v1.md) §T1. Hex-decoded numerics are emitted as **decimal strings**.

---

## 1. How it works

`eth_getBlockReceipts` returns a **flat array** of transaction receipts, one per mined transaction in the block, in transaction-index order:

```jsonc
{ "jsonrpc": "2.0", "id": 1, "result": [ Receipt, Receipt, … ] }
```

Each `Receipt` element is shape-identical to the success-path `result` of `eth_getTransactionReceipt`: top-level fields (`transactionHash`, `transactionIndex`, `blockHash`, `blockNumber`, `from`, `to`, `contractAddress`, `status`, `gasUsed`, `effectiveGasPrice`, `cumulativeGasUsed`, `type`, `logsBloom`) plus a `logs[]` array.

Compression value comes from three places:

1. **Per-receipt redundancy at scale** — every receipt drops `logsBloom` (~256 bytes), `cumulativeGasUsed`, `type`; every log drops 7 position fields. On a 329-tx block, those drops alone account for ~50 KB of byte savings.
2. **Cross-receipt redundancy** — every receipt in the response shares the same `blockHash` and `blockNumber`. v1 does **not** hoist these to a top-level object (would break the `Receipt[]` array shape consumers depend on); the `+tabular` sub-variant tracked in [`eth_getLogs.md`](./eth_getLogs.md) §5 is the natural home for that saving.
3. **Per-log ABI decoding** — at T2, every log entry across every receipt resolves to a compact `{contract, event, args}` triple per the per-log T2 transform.

Worked example throughout this doc: the same Ethereum mainnet block (25,093,593, hash `0x84d0…0398b4`) used in [`eth_getBlockByHash.md`](./eth_getBlockByHash.md). 329 receipts; the canonical USDC-transfer receipt sits at index 20.

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getBlockReceipts",
  "params": ["0x17ee5d9"]
}
```

### Raw response shape (one receipt of 329 shown)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": [
    // … 20 receipts elided …
    {
      "type":              "0x2",
      "status":            "0x1",
      "cumulativeGasUsed": "0x2ace4d",
      "logs": [
        {
          "address":         "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "topics": [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000002744dfd9898f0babbc570cc594bbbc84b487a22b",
            "0x000000000000000000000000fa21f001ef54ac2510d72e854a492b8731c3e7fa"
          ],
          "data":            "0x00000000000000000000000000000000000000000000000000000006fc23ac00",
          "blockHash":       "0x84d0b97c…0398b4",
          "blockNumber":     "0x17ee5d9",
          "blockTimestamp":  "0x6a05ca1f",
          "transactionHash": "0x4d415bcf…09dccbc0",
          "transactionIndex":"0x14",
          "logIndex":        "0x4d",
          "removed":         false
        }
      ],
      "logsBloom":         "0x0000…0000",                                  // 256 bytes
      "transactionHash":   "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
      "transactionIndex":  "0x14",
      "blockHash":         "0x84d0b97c…0398b4",
      "blockNumber":       "0x17ee5d9",
      "gasUsed":           "0x135b3",
      "effectiveGasPrice": "0x8b485351",
      "from":              "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381",
      "to":                "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
      "contractAddress":   null
    }
    // … 308 more receipts
  ]
}
```

---

## 2. T1 — Mechanical (normative)

`result` stays a flat `Receipt[]` array unconditionally — no top-level hoist of shared `blockHash` / `blockNumber`, no top-level wrapper object. Consumer type stability beats the ~5–7 pp saving a hoist would unlock; the `+tabular` sub-variant captures that saving more cleanly without breaking the array shape.

**For each element of `result[]`**, apply the receipt T1 transform from [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md) §T1 verbatim — same receipt-level renames / drops / EIP-55 / status mapping, same per-log structural zero-block strip and position-field drops. The reversibility statement in that section applies here per element: carried fields are mechanically reversible, the enumerated drops are policy drops, and the raw form is a re-query without the opt-in header, against the same block. Two of those drops are derivable at this method's whole-block scope even though they are not derivable from a lone receipt, see [§5](#5-open-questions).

No additional array-level transformations in v1.

### Result (canonical receipt shown, others elided)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": [
    // … 20 receipts elided …
    {
      "tx":         "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
      "tx_index":   "20",
      "block":      "25093593",
      "block_hash": "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
      "from":       "0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381",
      "to":         "0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b",
      "status":     "success",
      "gas_used":   "79283",
      "gas_price":  "2336772945",
      "logs": [
        {
          "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "topics": [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
            "0xfa21f001ef54ac2510d72e854a492b8731c3e7fa"
          ],
          "data":    "0x00000000000000000000000000000000000000000000000000000006fc23ac00"
        }
      ]
    }
    // … 308 more
  ]
}
```

T1 saving on the worked block is dominated by the **`logsBloom` drop × 329 receipts** (~75 tokens each → ~25 K tokens saved at o200k) plus the per-log position-field drop across all logs in the block. Net T1 ≈ **−50% tokens** on this block.

---

## 3. T2 — Semantic (normative)

**For each element of `result[]`**, apply the receipt T2 transform from [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md) §T2 verbatim — per-log `address` → `contract`, `topics[0]` → `event` via 4byte, `args` decoding, ABI-unknown per-log `_event_unknown: true` fallback, ERC-20 / ERC-721 `Transfer` disambiguation by topic count.

Whole-response downgrade is **never** triggered by an ABI gap — the surrounding receipt metadata stays useful regardless. The block-level response remains an array of receipts in T2 form even when individual logs fall back to T1.

T2 ≈ **−60% tokens** on the worked block; the saving compounds across receipts because every well-known ERC-20 `Transfer` / Uniswap `Swap` / etc. decodes uniformly.

---

## 4. Edge cases

- **Block not found (`result: null`).** Pass through verbatim at every tier. (Some clients return an empty array instead; both pass through unchanged at T0.)
- **Empty block (`result: []`).** Pass through verbatim. T0 = T1 = T2 by definition.
- **Block with no logs across all txs** (e.g., pure ETH transfer block). Per-receipt T1 still applies; T2 is effectively a no-op because there are no logs to decode. Common on early-history blocks.
- **Mixed known / unknown events across receipts.** Unknown logs tagged `_event_unknown: true` in-place; known logs remain decoded. No whole-response downgrade.
- **Per-log `blockTimestamp`.** Conditional in the raw response; always dropped at T1, same rule as receipt §T1. The receipt-level fields do **not** cover it: there is no timestamp field anywhere in the T1 output, so the value is not recoverable from the response. A consumer that needs it fetches the block by `block_hash`, or re-issues the request without the opt-in header, against the same block.
- **Chain-specific receipt extensions.** Pass through verbatim per the unknown-field passthrough rule.

---

## 5. Open questions

- **Top-level block-context hoist.** Hoisting the shared `blockHash` / `blockNumber` to a top-level wrapper (`{block, block_hash, receipts: [...]}`) would save ~5–7 pp T1 tokens on multi-tx blocks but changes `result`'s type from array to object — a breaking-shape conditional that the always-array choice declines to take in v1. Re-evaluate when the `+tabular` sub-variant lands; the tabular shape is non-array-typed by construction, so the hoist composes naturally into it.
- **`+tabular` sub-variant promotion.** A typical block has 100–400 receipts of broadly similar shape (one transfer-style log each, plus header fields). The per-receipt key repetition (`tx`, `tx_index`, `from`, `to`, `gas_used`, …) is ~70% of the byte budget after T2. Combined with the per-log tabularisation tracked in [`eth_getLogs.md`](./eth_getLogs.md) §5, this is the single largest deferred win for indexer / archive workloads. Deferred to v1.1+.
- **Cross-receipt log-index continuity.** Each receipt's per-log `logIndex` is dropped at T1 (per the receipt spec). Because this method returns every receipt of the block in transaction-index order, the block-wide log index is reconstructible here by counting the logs of all preceding receipts in the array and adding the log's position within its own receipt. That derivation holds only at this method's whole-block scope; it does not hold for a single `eth_getTransactionReceipt` response. Worth stating for consumers in v1.1+.
- **Per-receipt `cumulativeGasUsed` reconstruction.** Dropped at T1, and derivable here by summing `gas_used` across the receipts up to and including the current one. Same whole-block-scope caveat as above. Worth documenting once the v1 corpus settles.
