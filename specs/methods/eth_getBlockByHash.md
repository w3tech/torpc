# `eth_getBlockByHash` / `eth_getBlockByNumber` — per-method mapping

| | |
|---|---|
| **Status** | T1 + T2 normative |
| **Covers** | `eth_getBlockByHash` and `eth_getBlockByNumber` — identical response shape; only the lookup parameter differs (32-byte hash vs block tag / number). All transformations below apply uniformly. |
| **Traffic** | Rank #3 (`eth_getBlockByNumber`) and Rank #11 (`eth_getBlockByHash`) by call volume on the public RPC tier. |

> Address values are emitted in EIP-55 checksum casing in **dedicated address-typed fields** (`miner`, plus per-tx `from` / `to` when transactions are returned in full mode). Topic-like values are emitted lowercase per the structural zero-block strip primitive in [`../evm-v1.md`](../evm-v1.md) §T1. Hex-decoded numerics are emitted as **decimal strings**.

---

## 1. How it works

Both methods take a second boolean parameter that selects between two response modes:

- `fullTransactions: false` (default in most clients) — `transactions[]` is an array of **transaction hashes**.
- `fullTransactions: true` — `transactions[]` is an array of full transaction objects, each shape-identical to the result of [`eth_getTransactionByHash.md`](./eth_getTransactionByHash.md).

The remaining block-level fields are the same in both modes: header data, consensus / state roots, block-level gas accounting, optional EIP-1559 / EIP-4844 / EIP-4895 (withdrawals) fields, and `uncles[]`.

Compression value comes from three places:

1. **Header service noise** — `sha3Uncles`, `stateRoot`, `transactionsRoot`, `receiptsRoot`, `logsBloom`, `mixHash`, `nonce`, `extraData`, `withdrawalsRoot`, `parentBeaconBlockRoot`, `requestsHash` — the Merkle / consensus bookkeeping that proves the block but isn't load-bearing for a downstream consumer.
2. **Hex → decimal across block-level numerics** — `number`, `timestamp`, `gasLimit`, `gasUsed`, `size`, `baseFeePerGas`, `blobGasUsed`, `excessBlobGas`.
3. **Per-tx redundancy when `fullTransactions: true`** — every full-tx entry repeats `blockHash`, `blockNumber`, `blockTimestamp` (already on the block header) and carries its own signature material. Dropping those cuts per-tx cost by ~30%, before any `input` decoding.

Worked example throughout this doc: Ethereum mainnet block **25,093,593** (hash `0x84d0…0398b4`), 329 transactions, post-Shapella/Cancun (carries `withdrawals[]`, `blobGasUsed`, `excessBlobGas`).

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getBlockByNumber",
  "params": ["0x17ee5d9", true]
}
```

### Raw response shape (one tx of 329 shown)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "hash":                "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "parentHash":          "0xc0d2b8e9…",
    "sha3Uncles":          "0x1dcc4de8…",                                  // 32-byte constant — service
    "miner":               "0x1f9090aae28b8a3dceadf281b0f12828e676c326",
    "stateRoot":           "0x…",                                            // service
    "transactionsRoot":    "0x…",                                            // service
    "receiptsRoot":        "0x…",                                            // service
    "logsBloom":           "0x0000…",                                        // 256 bytes — service
    "difficulty":          "0x0",                                            // PoS — always zero
    "number":              "0x17ee5d9",
    "gasLimit":            "0x223995a",
    "gasUsed":             "0x23089ed",
    "timestamp":           "0x6a05ca1f",
    "extraData":           "0xd883010f0e…",                                  // service
    "mixHash":             "0x…",                                            // service
    "nonce":               "0x0000000000000000",                             // PoS — always zero
    "baseFeePerGas":       "0x4f81e30",
    "withdrawalsRoot":     "0x…",                                            // service
    "blobGasUsed":         "0x40000",
    "excessBlobGas":       "0x6c80000",
    "parentBeaconBlockRoot":"0x…",                                           // service
    "requestsHash":        "0xe3b0c44…",                                     // service
    "size":                "0x26f71",
    "uncles":              [],
    "transactions": [
      {
        "type":             "0x2",
        "chainId":          "0x1",
        "nonce":            "0x108780",
        "gas":              "0x1db12",
        "maxFeePerGas":     "0x8dd57fc4",
        "maxPriorityFeePerGas":"0x77359400",
        "to":               "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
        "value":            "0x0",
        "accessList":       [],
        "input":            "0xb61d27f6…",
        "r":                "0x…", "s": "0x…", "yParity": "0x1", "v": "0x1",
        "hash":             "0x4d415bcf…",
        "blockHash":        "0x84d0b97c…",                                   // duplicate of block.hash
        "blockNumber":      "0x17ee5d9",                                     // duplicate of block.number
        "transactionIndex": "0x14",
        "from":             "0x05ff6964…",
        "gasPrice":         "0x8b485351",
        "blockTimestamp":   "0x6a05ca1f"                                     // duplicate of block.timestamp
      }
      // … 328 more
    ],
    "withdrawals": [
      { "index": "0x4f0b6c1", "validatorIndex": "0x123abc", "address": "0x…", "amount": "0x3f4a7c2" },
      // …
    ]
  }
}
```

---

## 2. T1 — Mechanical (normative)

Field-level transforms, no external lookup. Transforms on carried fields (renames, hex to decimal, EIP-55 casing) are mechanically reversible. The fields marked **drop** below are dropped by policy and are recovered only by re-issuing the request without the opt-in header, against the same block, per [`../evm-v1.md`](../evm-v1.md) §Behavior rule 5. This drop list is where the block-header response loses information that nothing in the output can rebuild: `extraData`, `mixHash`, the consensus Merkle roots, `logsBloom`, and, on pre-merge blocks, `difficulty` and `nonce`. The three **additional** drops in the per-transaction table are different in kind: those values are carried by the enclosing block and are read straight off it. The rest of the per-tx walk inherits [`eth_getTransactionByHash.md`](./eth_getTransactionByHash.md) §T1, whose drops (`v` / `r` / `s` / `yParity`, `type`, `chainId`) are policy drops with no derivation, exactly as they are there.

The same drop list applies in both response modes (hashes-only and full-tx); the per-tx walk only fires when `transactions[]` contains objects.

### Block-level fields

| Raw field | Transformation | Example result |
|---|---|---|
| `hash` | rename → `block_hash` | `"block_hash": "0x84d0b97c…0398b4"` |
| `parentHash` | rename → `parent_hash` | `"parent_hash": "0xc0d2b8e9…"` |
| `number` | rename → `block`, hex → decimal | `"block": "25093593"` |
| `miner` | EIP-55 casing | `"miner": "0x1f9090…c326"` |
| `timestamp` | hex → decimal | `"timestamp": "1778764319"` |
| `gasUsed` | rename → `gas_used`, hex → decimal | `"gas_used": "36735469"` |
| `gasLimit` | rename → `gas_limit`, hex → decimal | `"gas_limit": "35887450"` |
| `size` | hex → decimal | `"size": "159601"` |
| `baseFeePerGas` | rename → `base_fee_per_gas`, hex → decimal (EIP-1559 only — pass through verbatim when absent) | `"base_fee_per_gas": "83369520"` |
| `blobGasUsed` | rename → `blob_gas_used`, hex → decimal (EIP-4844 only) | `"blob_gas_used": "262144"` |
| `excessBlobGas` | rename → `excess_blob_gas`, hex → decimal (EIP-4844 only) | `"excess_blob_gas": "113770496"` |
| `transactions` | hashes-only: keep verbatim. Full-tx: apply per-tx T1 (see below). | (see below) |
| `uncles` | keep verbatim (always empty post-merge — but the field is part of the consensus shape; passthrough is the safe rule) | `"uncles": []` |
| `withdrawals` | per-withdrawal: hex → decimal on `index`, `validatorIndex`, `amount`; EIP-55 on `address`. Keep the array. | (see below) |
| `difficulty` | **drop** (PoS — always `"0x0"` on Ethereum mainnet and most L2s). On a pre-merge block the value is real and is not derivable from the output; see [§4](#4-edge-cases) and [§5](#5-open-questions). | — |
| `nonce` | **drop** (PoS — always zero; not the same as transaction nonce). Pre-merge: real PoW nonce, not derivable from the output. | — |
| `mixHash` | **drop** (PoS — `prevRandao` placeholder, opaque to consumers). Pre-merge: PoW seed hash, not derivable from the output. | — |
| `sha3Uncles` | **drop**. Recomputable **only** when `uncles[]` is empty, which is every post-merge block: the value is then the known constant `keccak256(rlp([]))`. On a block with uncles it is the hash of the uncle *headers*, which the retained hash list does not carry, so there it is a policy drop with no derivation. | — |
| `stateRoot`, `transactionsRoot`, `receiptsRoot`, `withdrawalsRoot`, `parentBeaconBlockRoot`, `requestsHash` | **drop** by policy (consensus Merkle roots: useful for proofs, dead weight for an LLM consumer). Not derivable from the output; a consumer that needs proof-of-inclusion re-issues the request without the opt-in header. | — |
| `logsBloom` | **drop** by policy (filter index over the block's log addresses and topics). **Not** derivable from this response: a block response carries no logs at any tier. Recomputing it needs a separate `eth_getBlockReceipts` (or per-tx receipt) fetch, so a consumer that needs the bloom itself re-queries this method without the opt-in header. | — |
| `extraData` | **drop** by policy (miner / builder graffiti: variable size, opaque). Not derivable from the output. | — |

Chain-specific block-level extensions (Arbitrum `l1BlockNumber`, Optimism `sendCount` / `sendRoot`, etc.) — **pass through verbatim**.

### Per-transaction fields (each element of `transactions[]` when `fullTransactions: true`)

The per-tx transform is **identical to [`eth_getTransactionByHash.md`](./eth_getTransactionByHash.md) §T1**, with three additional drops because the surrounding block carries those values:

| Raw field | Transformation | Reason |
|---|---|---|
| `blockHash` | **drop** | duplicate of block-level `block_hash`, which is retained |
| `blockNumber` | **drop** | duplicate of block-level `block`, which is retained |
| `blockTimestamp` | **drop** | duplicate of block-level `timestamp`, which is retained |

All other per-tx fields follow the [`eth_getTransactionByHash.md`](./eth_getTransactionByHash.md) §T1 table verbatim — same renames, same hex → decimal, same signature / envelope drops.

### Withdrawals (each element of `withdrawals[]`)

| Raw field | Transformation | Example result |
|---|---|---|
| `index` | hex → decimal | `"index": "82884289"` |
| `validatorIndex` | rename → `validator_index`, hex → decimal | `"validator_index": "1194684"` |
| `address` | EIP-55 casing | `"address": "0x…"` |
| `amount` | hex → decimal (gwei) | `"amount": "66365378"` |

### Result (one tx of 329 shown, withdrawals abbreviated)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "block":              "25093593",
    "block_hash":         "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "parent_hash":        "0xc0d2b8e9…",
    "miner":              "0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326",
    "timestamp":          "1778764319",
    "gas_used":           "36735469",
    "gas_limit":          "35887450",
    "size":               "159601",
    "base_fee_per_gas":   "83369520",
    "blob_gas_used":      "262144",
    "excess_blob_gas":    "113770496",
    "uncles":             [],
    "transactions": [
      {
        "tx":                       "0x4d415bcf…09dccbc0",
        "tx_index":                 "20",
        "from":                     "0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381",
        "to":                       "0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b",
        "nonce":                    "1083264",
        "value":                    "0",
        "gas_limit":                "121618",
        "gas_price":                "2336772945",
        "max_fee_per_gas":          "2379579332",
        "max_priority_fee_per_gas": "2000000000",
        "input":                    "0xb61d27f6…"
      }
      // … 328 more
    ],
    "withdrawals": [
      { "index": "82884289", "validator_index": "1194684", "address": "0xb9D7…", "amount": "66365378" }
      // …
    ]
  }
}
```

T1 saving on the worked example is dominated by the **eleven block-header drops** (~580 bytes) plus the per-tx signature / envelope drops (~140 bytes × 329 = ~46 KB across the full block). Net T1 ≈ **−35% bytes** on this block in full-tx mode, **−18%** in hashes-only mode.

---

## 3. T2 — Semantic (normative)

T2 fires **only when `transactions[]` contains full transaction objects** (i.e., the request had `fullTransactions: true`). Block-level fields are unchanged from T1.

**For each element of `transactions[]`**, apply the per-tx T2 transform from [`eth_getTransactionByHash.md`](./eth_getTransactionByHash.md) §T2 verbatim — decode `input` via 4byte → `function` + `args`, `_function_unknown: true` per-tx fallback on unresolved selectors, contract-creation and empty-input edge cases, selector-collision rule.

**Hashes-only mode**: T2 ≡ T1 — there is nothing to decode in an array of hex strings.

Whole-response downgrade is **never** triggered by an ABI gap — the surrounding block metadata stays useful regardless. T2 on the worked example brings full-tx-mode saving to roughly **−55% bytes** on the canonical block: every ERC-20 / ERC-721 / Uniswap call in the 329-tx set decodes to a much smaller `function` + `args` shape than the raw calldata.

---

## 4. Edge cases

- **Block not found (`result: null`).** Pass through verbatim at every tier.
- **Pending block** (some clients return one when given the `"pending"` tag). `hash` / `miner` / `nonce` may be null; preserve verbatim. T2 still decodes pending-tx `input` when full-tx mode is requested.
- **Genesis block.** No `baseFeePerGas`, no `withdrawals`, no blob fields — all those drops in the table are conditional on field presence. Per the global unknown-field passthrough rule, absent fields stay absent.
- **Pre-merge blocks (PoW).** `difficulty` is non-zero, `nonce` is non-zero, `mixHash` is meaningful. **All three are still dropped per the table** — the spec is forward-looking and drops are deterministic. Consumers that need PoW header data re-fetch raw. (Implementations targeting historical-archive workloads MAY override this with `Accept-Token-Tier: 0`.)
- **Uncles populated** (rare, pre-merge only). `uncles[]` is an array of 32-byte hashes; pass through verbatim. Resolving each uncle requires a separate `eth_getUncleByBlockHashAndIndex` call.
- **`withdrawals[]` absent** (pre-Shapella). Field is omitted from raw; unknown-field passthrough → it's also omitted from output. No special handling required.
- **Hashes-only response (`fullTransactions: false`).** `transactions[]` is `string[]`; keep verbatim. T2 is a no-op.
- **Chain-specific extension fields** (Arbitrum `l1BlockNumber` / `sendCount` / `sendRoot`, Optimism `dataGasUsed`, etc.). Pass through verbatim at every tier.

---

## 5. Open questions

- **`difficulty` drop on pre-merge blocks.** The deterministic-drop rule above means historical PoW headers lose their `difficulty` / `nonce` / `mixHash`. Consumers indexing pre-merge history would notice. A future revision could make the drop conditional on `difficulty == "0x0"`, but conditional-presence drops violate the determinism contract (two consumers reading the same field name see different shapes). Tracked.
- **Withdrawal-amount unit declaration.** `amount` is in **gwei** (not wei) per EIP-4895. v1 emits it as a decimal string with no unit annotation; a consumer that doesn't know the EIP will misread it as wei. Adding a `_unit: "gwei"` field or renaming to `amount_gwei` is under discussion.
- **`+tabular` for full-tx blocks.** A block with 200+ transactions of similar shape (Uniswap-heavy DEX blocks, NFT mint blocks) is a textbook tabular candidate — the per-tx key repetition (`tx`, `tx_index`, `from`, `to`, `value`, …) is ~80% of the tx-array byte budget. Composes with the `+tabular` sub-variant tracked in [`eth_getLogs.md`](./eth_getLogs.md) §5.
- **EIP-7685 `requestsHash`.** Currently dropped as service noise. If consensus / withdrawal-style request types start landing in `result.requests[]` per EIP-7685's follow-ups, the drop becomes lossy. Revisit when the EIP's body shape stabilises.
- **Per-tx redundancy drop semantics.** Dropping `blockHash` / `blockNumber` / `blockTimestamp` from each tx is safe because the block carries them — but a consumer that destructures `result.transactions[0]` in isolation loses that context. The trade-off (always-redundant vs always-contextual) deserves a deliberate call once consumer patterns settle.
