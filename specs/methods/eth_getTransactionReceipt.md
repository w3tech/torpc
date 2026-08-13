# `eth_getTransactionReceipt` — per-method mapping

| | |
|---|---|
| **Status** | T1 + T2 normative |
| **Traffic** | Rank #8 by call volume on the public RPC tier. |

> Address values in the worked example below are shown in lowercase for readability; conformant output applies EIP-55 checksum casing to **dedicated address-typed fields** (`from`, `to`, `contractAddress`, log `address` / `contract`). Topic values are emitted **lowercase** at T1 per the structural zero-block strip primitive in [`../evm-v1.md`](../evm-v1.md) §T1 — the strip makes no semantic claim, so EIP-55 does not apply there even when the underlying value happens to be an address. The bytes / token counts cited per tier are computed against the spec-conformant compact JSON.

---

## 1. How it works

`eth_getTransactionReceipt(txHash)` returns the post-execution record of a mined transaction: status (success / revert), gas accounting, the log entries emitted during execution, and a block of node-internal bookkeeping (`logsBloom`, `cumulativeGasUsed`, `transactionIndex`, `type`, per-log redundancy).

Worked example throughout this doc: an ERC-20 USDC transfer on Ethereum mainnet, block 25,093,593, tx `0x4d415bcf…09dccbc0`.

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getTransactionReceipt",
  "params": ["0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0"]
}
```

### Raw response (1,665 compact bytes / 696 o200k tokens)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "blockHash":         "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "blockNumber":       "0x17ee5d9",
    "contractAddress":   null,
    "cumulativeGasUsed": "0x2ace4d",
    "effectiveGasPrice": "0x8b485351",
    "from":              "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381",
    "gasUsed":           "0x135b3",
    "logs": [
      {
        "address":          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "topics": [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000002744dfd9898f0babbc570cc594bbbc84b487a22b",
          "0x000000000000000000000000fa21f001ef54ac2510d72e854a492b8731c3e7fa"
        ],
        "data":             "0x00000000000000000000000000000000000000000000000000000006fc23ac00",
        "blockNumber":      "0x17ee5d9",
        "transactionHash":  "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
        "transactionIndex": "0x14",
        "blockHash":        "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
        "blockTimestamp":   "0x6a05ca1f",
        "logIndex":         "0x4d",
        "removed":          false
      }
    ],
    "logsBloom":         "0x0000…0000",   // 256 bytes — Bloom filter index, abbreviated here
    "status":            "0x1",
    "to":                "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
    "transactionHash":   "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "transactionIndex":  "0x14",
    "type":              "0x2"
  }
}
```

Two structural compression opportunities are visible by inspection:

1. **Service / node-internal bookkeeping** at the receipt top level — `logsBloom` (256 bytes / ~75 tokens by itself), `cumulativeGasUsed`, `type`. Useful to the consensus client; dead weight to a downstream consumer.
2. **Per-log redundancy** — every log entry repeats `blockNumber`, `blockHash`, `transactionHash`, all three already on the receipt. Those three are strictly redundant. The remaining per-log fields `logIndex`, `transactionIndex`, `blockTimestamp`, `removed` are not redundant with anything on the receipt; §T1 drops them by policy, and only a raw re-query brings them back.

A reverted transaction returns the same shape with `status: "0x0"` and `logs: []` — still a JSON-RPC success response. An unknown tx hash returns `result: null` (also a success response, passed through verbatim).

---

## 2. T1 — Mechanical (normative)

Field-level transforms, no external lookup. Transforms on carried fields (renames, hex to decimal, EIP-55 casing, the structural zero-block strip) are mechanically reversible. The fields marked **drop** below are dropped by policy and are recovered only by re-issuing the request without the opt-in header, against the same block, per [`../evm-v1.md`](../evm-v1.md) §Behavior rule 5. Of those, `cumulativeGasUsed`, per-log `blockTimestamp`, and per-log `logIndex` cannot be derived from what remains in a single-receipt response.

### Receipt-level fields

| Raw field | Transformation | Example result |
|---|---|---|
| `transactionHash` | rename → `tx` | `"tx": "0x4d415bcf…09dccbc0"` |
| `blockNumber` | rename → `block`, apply the **hex-to-decimal numeric encoding** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 (always decimal string in v1) | `"block": "25093593"` |
| `blockHash` | rename → `block_hash`; keep verbatim. Required: at any moment multiple blocks can exist at the same height across forks / reorgs — `block` alone is not a unique block identifier; `block_hash` is. | `"block_hash": "0x84d0b97c…0398b4"` |
| `from` | EIP-55 checksum casing | `"from": "0x05ff6964…f381"` |
| `to` | EIP-55 checksum casing; `null` preserved for contract creation | `"to": "0x2744dfd9…a22b"` |
| `contractAddress` | **drop** when `null`; EIP-55 casing when set | — (null here) |
| `status` | `"0x0"` → `"failed"`, `"0x1"` → `"success"` | `"status": "success"` |
| `gasUsed` | rename → `gas_used`, hex → decimal (always string per the global primitive) | `"gas_used": "79283"` |
| `effectiveGasPrice` | rename → `gas_price`, hex → decimal (always string) | `"gas_price": "2336772945"` |
| `cumulativeGasUsed` | **drop** by policy (running gas total for every transaction up to this one in the block; not used by consumers of a single receipt). Not derivable from this response: it needs the receipts of the preceding transactions. | — |
| `transactionIndex` | rename → `tx_index`, hex → decimal (always string). Kept because it's a property of the transaction's place in consensus history (ordering, MEV / sandwich reasoning, state-proof Merkle paths) and is not reconstructible from other fields. | `"tx_index": "20"` |
| `type` | **drop** (EIP-2718 envelope type; not used downstream) | — |
| `logsBloom` | **drop** (filter index over each log's `address` and `topics`, recomputable at T1 from the retained `logs` array; at T2 `topics[0]` is replaced by `event`, so recomputation there needs the ABI) | — |
| `logs` | keep the array; transform each element per the per-log table below | (see below) |

Chain-specific receipt extensions (Optimism `l1Fee*`, Arbitrum `gasUsedForL1`, sequencer metadata, etc.) — **pass through verbatim**. Servers MUST NOT ad-hoc rename or hex-decimal-convert unenumerated fields. See [`../evm-v1.md`](../evm-v1.md) §T1 "Unknown-field passthrough".

### Per-log fields (each element of `logs[]`)

| Raw field | Transformation | Example result |
|---|---|---|
| `address` | EIP-55 checksum casing | `"address": "0xa0b86991…eb48"` |
| `topics[0]` | keep verbatim (raw 32-byte event-signature hash) | `"0xddf252ad…23b3ef"` |
| `topics[1..N]` | apply the **structural zero-block strip** primitive from [`../evm-v1.md`](../evm-v1.md) §T1 — emit the trailing 8 or 20 bytes (lowercase hex) when leading-zero-byte count is exactly 24 or 12 respectively, otherwise keep verbatim. No EIP-55 (the strip carries no type claim). | `"0x2744dfd9…a22b"` (was 32-byte padded address — 12 zero bytes stripped) |
| `data` | keep verbatim | `"0x00000…6fc23ac00"` |
| `blockNumber` | **drop** (= receipt-level `block`) | — |
| `transactionHash` | **drop** (= receipt-level `tx`) | — |
| `blockHash` | **drop** (= receipt-level `block_hash`) | — |
| `transactionIndex` | **drop** (= receipt-level `tx_index`, which is retained) | — |
| `blockTimestamp` | **drop** by policy. This is the block-header timestamp, consensus data rather than node-internal bookkeeping, and the transformed receipt carries no timestamp field at all, so it is **not** recoverable from the output. A consumer that needs it fetches the block by `block_hash`, or re-issues the receipt request without the opt-in header. | — |
| `logIndex` | **drop** by policy (position of the log within the block). Array order inside `logs` is preserved, but the block-wide index is **not** derivable from a single receipt, which carries only this transaction's logs. | — |
| `removed` | **drop** (always `false` on confirmed receipts; only meaningful for log subscriptions across reorgs). Recoverable by policy: an absent `removed` means `false`. | — |

### Result (703 compact bytes / 342 o200k tokens — **−50.9%** vs raw)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tx":         "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "tx_index":   "20",
    "block":      "25093593",
    "block_hash": "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "from":       "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381",
    "to":         "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
    "status":     "success",
    "gas_used":   "79283",
    "gas_price":  "2336772945",
    "logs": [
      {
        "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "topics": [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
          "0xfa21f001ef54ac2510d72e854a492b8731c3e7fa"
        ],
        "data": "0x00000000000000000000000000000000000000000000000000000006fc23ac00"
      }
    ]
  }
}
```

Most of the saving comes from the three-field service-noise drop at the top level (`logsBloom` alone is ~75 tokens) and the per-log redundancy collapse (≥7 fields dropped per log). EIP-55, hex → decimal, topic strip, and the renames contribute the remainder. Hex-decoded numerics are emitted as decimal strings — see [`../evm-v1.md`](../evm-v1.md) §T1 and the [Open questions](#5-open-questions).

---

## 3. T2 — Semantic (normative)

T1 + ABI-aware decoding of every log entry. **The receipt-level field set is identical to T1.** Only the per-log object changes:

### Per-field rules (delta vs T1; per-log only)

| Raw field | Transformation | Example result |
|---|---|---|
| `address` | rename → `contract`, EIP-55 casing | `"contract": "0xa0b86991…eb48"` |
| `topics[0]` | resolve via 4byte registry → event-signature name; emitted as new field `event`; raw `topics[0]` hash discarded | `"event": "Transfer"` |
| `topics[1..N]` + `data` | ABI-decode **all** event parameters (indexed + non-indexed) into a single `args` object, keyed by ABI parameter name, in ABI parameter order; raw `topics[1..N]` and `data` discarded | `"args": {"from": "0x2744…", "to": "0xfa21…", "value": "30000000000"}` |

**Indexed parameters of dynamic type.** For an indexed `string`, `bytes` or array parameter, the topic carries `keccak256` of the value, not the value: the EVM discards the preimage, so there is nothing to recover. The server emits the 32-byte topic value as that parameter's value in `args` and the decode **MUST NOT** be treated as a failure. A consumer that needs the preimage has to obtain it elsewhere, typically from the non-indexed data of another event or from the calldata.

**Anonymous events.** An anonymous event has no signature hash in `topics[0]`, so registry resolution misses and the log takes the ABI-unknown fallback below: it stays in its T1 form and carries `_event_unknown`.

Inside `args`:

- numeric values (`uint*`, `int*`) → decimal string (always — per the hex-to-decimal numeric encoding primitive in [`../evm-v1.md`](../evm-v1.md) §T1);
- addresses → EIP-55 casing;
- `bytes` / `bytes<N>` → `0x`-prefixed hex string;
- `bool` → JSON boolean;
- arrays / structs → JSON array / object preserving ABI shape.

### Result (610 compact bytes / 292 o200k tokens — **−58.0%** vs raw, −14.6% vs T1)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tx":         "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "tx_index":   "20",
    "block":      "25093593",
    "block_hash": "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "from":       "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381",
    "to":         "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
    "status":     "success",
    "gas_used":   "79283",
    "gas_price":  "2336772945",
    "logs": [
      {
        "contract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "event":    "Transfer",
        "args": {
          "from":  "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
          "to":    "0xfa21f001ef54ac2510d72e854a492b8731c3e7fa",
          "value": "30000000000"
        }
      }
    ]
  }
}
```

### ABI-unknown fallback (per log)

When the 4byte registry cannot resolve `topics[0]`, the **single offending log** is preserved in its T1 form (post-drop, post-unpad) and tagged with `_event_unknown: true`. Other logs in the same receipt that *did* resolve remain decoded.

```jsonc
{
  "address": "0x…",
  "topics":  ["0x<unresolved-topic0>", "…"],
  "data":    "0x…",
  "_event_unknown": true
}
```

T2 **never** downgrades the whole receipt to T0 for a single unknown log — receipts often mix well-known events (ERC-20 `Transfer`) with chain-specific or protocol-specific events outside the ABI cache.

### Same-signature collision (`Transfer`)

ERC-20 and ERC-721 both emit `Transfer(address,address,uint256)` and therefore share `topics[0] = 0xddf252ad…23b3ef`. They differ in parameter indexing: ERC-20's `value` is non-indexed (in `data`); ERC-721's `tokenId` is indexed (in `topics[3]`). The server **MUST** disambiguate by **topic count**:

- 3 topics → ERC-20: `args = {from, to, value}`, `value` decoded from `data`.
- 4 topics → ERC-721: `args = {from, to, tokenId}`, `tokenId` decoded from `topics[3]`; `data` MUST be `0x`.

If neither shape matches (4 topics with non-empty `data`, or 3 topics with `data` length ≠ 32 bytes), the log MUST fall back to `_event_unknown: true`.

---

## 4. Edge cases

- **Unknown tx hash (`result: null`).** Pass through verbatim at every tier. No transformations apply.
- **Reverted transaction (`status: "failed"`, `logs: []`).** Receipt is real and well-formed; `status` flips, `logs` is empty. T2 collapses to T1 (no events to decode). Decoded revert reason is not part of v1 — see [Open questions](#5-open-questions).
- **Contract creation.** `to` is `null`, `contractAddress` is the newly-deployed address. T1 keeps both (`to: null` carries "not a call" semantics; not equivalent to dropping the field).
- **Receipt with mixed known / unknown events.** Unknown logs tagged `_event_unknown: true`; known logs remain decoded. No whole-response downgrade.
- **Chain-specific extension fields** (Optimism `l1Fee*`, Arbitrum `gasUsedForL1`, sequencer metadata). Pass through verbatim at every tier; servers MUST NOT ad-hoc rename or hex-decimal-convert them.
- **Indexed `bytes32` topics whose leading 12 or 24 bytes happen to be zero.** The structural zero-block strip is shape-based and type-agnostic: a `bytes32` indexed parameter whose first 12 bytes are zero is byte-indistinguishable from a padded address, and one whose first 24 bytes are zero is byte-indistinguishable from a padded 8-byte value. The strip applies regardless — the transform is **fully reversible** (left-pad to 32 bytes), so no information is lost. A consumer that needs to treat such a topic as `bytes32` rather than the stripped form re-pads it; T2 handles this correctly when the ABI declares the parameter type.

---

## 5. Open questions

- **Decoded revert reason on failed receipts.** Revert reason lives in transaction trace data, not in the receipt itself — would require a trace lookup or a call-replay pass. Deferred to v1.1+.
- **Tabular form for many-log receipts.** A receipt with 12+ logs of uniform shape (`{contract, event, args}` with same `event`) is a candidate for `+tabular` — column-oriented encoding. Likely shares mechanics with the upcoming `eth_getLogs` `+tabular` sub-variant. Deferred to v1.1+.
