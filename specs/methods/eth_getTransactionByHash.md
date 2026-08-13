# `eth_getTransactionByHash` — per-method mapping

| | |
|---|---|
| **Status** | T1 + T2 normative |
| **Covers** | `eth_getTransactionByHash`, `eth_getTransactionByBlockHashAndIndex`, `eth_getTransactionByBlockNumberAndIndex` — all three return the same transaction-object shape and use the same transformations. |
| **Traffic** | Rank #6 by call volume on the public RPC tier. |

> Address values are emitted in EIP-55 checksum casing in **dedicated address-typed fields** (`from`, `to`, and any decoded `address` parameters inside `args`). Hex-decoded numerics are emitted as decimal strings per the global hex-to-decimal numeric encoding primitive in [`../evm-v1.md`](../evm-v1.md) §T1.

---

## 1. How it works

The method returns a single mined-or-pending transaction object. The response carries three kinds of content:

1. **Identity / position** — `hash`, `blockHash`, `blockNumber`, `transactionIndex`. Null on the position fields when the transaction is pending (not yet mined).
2. **Economic intent** — `from`, `to`, `value`, `nonce`, `gas`, `gasPrice` and the EIP-1559 / EIP-4844 fee fields (`maxFeePerGas`, `maxPriorityFeePerGas`, `maxFeePerBlobGas`), `accessList`, `blobVersionedHashes`.
3. **Calldata + service noise** — `input` (the function call), `type`, `chainId`, `v`/`r`/`s`/`yParity` (signature).

`input` is opaque hex at T1 and the primary T2 target: the first 4 bytes are the function selector, the remainder is the ABI-encoded argument tuple.

Worked example throughout this doc: the same USDC-transfer transaction used in [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md). The outer call here is an account-abstraction `execute(address,uint256,bytes,uint8)` wrapping an inner ERC-20 `transfer`.

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getTransactionByHash",
  "params": ["0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0"]
}
```

### Raw response (1,107 compact bytes)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "type":                 "0x2",
    "chainId":              "0x1",
    "nonce":                "0x108780",
    "gas":                  "0x1db12",
    "maxFeePerGas":         "0x8dd57fc4",
    "maxPriorityFeePerGas": "0x77359400",
    "to":                   "0x2744dfd9898f0babbc570cc594bbbc84b487a22b",
    "value":                "0x0",
    "accessList":           [],
    "input":                "0xb61d27f6000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044a9059cbb000000000000000000000000fa21f001ef54ac2510d72e854a492b8731c3e7fa00000000000000000000000000000000000000000000000000000006fc23ac0000000000000000000000000000000000000000000000000000000000",
    "r":                    "0x5861285dfe268bc03958a2bdc5bc00b153af4d1aafc125713a53310b9a449885",
    "s":                    "0x211bf302e2e55352a9daa95f179fd4320ed28b5e6b01544a936a56701e526cb5",
    "yParity":              "0x1",
    "v":                    "0x1",
    "hash":                 "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "blockHash":            "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "blockNumber":          "0x17ee5d9",
    "transactionIndex":     "0x14",
    "from":                 "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381",
    "gasPrice":             "0x8b485351",
    "blockTimestamp":       "0x6a05ca1f"
  }
}
```

Structural compression opportunities, by inspection:

1. **Signature material** — `v`, `r`, `s`, `yParity` are validation evidence consumed by the node, dead weight to an LLM consumer (~140 bytes / ~95 tokens).
2. **Envelope service fields** — `type` (EIP-2718 envelope byte), `chainId` (echoes the request's network).
3. **`input` opacity** — at T1 the calldata is a raw hex string; at T2 it becomes a decoded `function` + `args` shape, often dropping 50–80% of the byte cost.

---

## 2. T1 — Mechanical (normative)

Field-level transforms, no external lookup. Transforms on carried fields (renames, hex to decimal, EIP-55 casing) are mechanically reversible. The fields marked **drop** below are dropped by policy and are recovered only by re-issuing the request without the opt-in header, against the same block, per [`../evm-v1.md`](../evm-v1.md) §Behavior rule 5. `v` / `r` / `s` / `yParity` are not derivable from anything that remains, so a consumer that needs to verify the signature or re-broadcast the transaction must re-query raw.

Position fields (`blockHash`, `blockNumber`, `transactionIndex`, `blockTimestamp`) are `null` for pending transactions; preserve null verbatim.

| Raw field | Transformation | Example result |
|---|---|---|
| `hash` | rename → `tx` | `"tx": "0x4d415bcf…09dccbc0"` |
| `blockHash` | rename → `block_hash`; keep verbatim (null preserved for pending) | `"block_hash": "0x84d0b97c…0398b4"` |
| `blockNumber` | rename → `block`, hex → decimal (null preserved) | `"block": "25093593"` |
| `transactionIndex` | rename → `tx_index`, hex → decimal (null preserved) | `"tx_index": "20"` |
| `from` | EIP-55 checksum casing | `"from": "0x05ff…F381"` |
| `to` | EIP-55 casing; `null` preserved for contract creation | `"to": "0x2744…a22b"` |
| `nonce` | hex → decimal | `"nonce": "1083264"` |
| `value` | hex → decimal | `"value": "0"` |
| `gas` | rename → `gas_limit`, hex → decimal | `"gas_limit": "121618"` |
| `gasPrice` | rename → `gas_price`, hex → decimal | `"gas_price": "2336772945"` |
| `maxFeePerGas` | rename → `max_fee_per_gas`, hex → decimal (EIP-1559 only — drop when absent) | `"max_fee_per_gas": "2379579332"` |
| `maxPriorityFeePerGas` | rename → `max_priority_fee_per_gas`, hex → decimal (EIP-1559 only) | `"max_priority_fee_per_gas": "2000000000"` |
| `maxFeePerBlobGas` | rename → `max_fee_per_blob_gas`, hex → decimal (EIP-4844 only) | — |
| `blobVersionedHashes` | rename → `blob_versioned_hashes`; keep verbatim (32-byte hashes; EIP-4844 only) | — |
| `accessList` | rename → `access_list`; EIP-55 on each entry's `address`; keep `storageKeys` verbatim. **Drop** when empty array. | — (empty here) |
| `authorizationList` | rename → `authorization_list`; keep verbatim (EIP-7702 type-4 only) | — |
| `input` | keep verbatim at T1 (the T2 target) | `"input": "0xb61d27f6…"` |
| `blockTimestamp` | rename → `block_timestamp`, hex → decimal. **Conditional**: present in output if and only if present in the raw response; presence is client-dependent. | `"block_timestamp": "1778764319"` |
| `chainId` | **drop** (echoes the request's network context) | — |
| `type` | **drop** (EIP-2718 envelope byte, not used downstream) | — |
| `v`, `r`, `s`, `yParity` | **drop** (signature; validation evidence, dead weight to LLM consumers). Not derivable from the output: signature-verification and re-broadcast consumers re-query raw. | — |

Chain-specific transaction extensions (Optimism `l1*`, Arbitrum sequencer metadata, etc.) — **pass through verbatim** per [`../evm-v1.md`](../evm-v1.md) §T1 unknown-field passthrough.

### Result (605 compact bytes — **−45.3%** vs raw)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tx":                          "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "tx_index":                    "20",
    "block":                       "25093593",
    "block_hash":                  "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "from":                        "0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381",
    "to":                          "0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b",
    "nonce":                       "1083264",
    "value":                       "0",
    "gas_limit":                   "121618",
    "gas_price":                   "2336772945",
    "max_fee_per_gas":             "2379579332",
    "max_priority_fee_per_gas":    "2000000000",
    "input":                       "0xb61d27f6000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48…00000000000000",
    "block_timestamp":             "1778764319"
  }
}
```

Most of the saving comes from the four signature-field drop (`v`, `r`, `s`, `yParity`) and the two envelope drops (`type`, `chainId`). EIP-55 casing and hex → decimal contribute the remainder. `input` is unchanged at T1.

---

## 3. T2 — Semantic (normative)

T1 + ABI-aware decoding of `input`. The other receipt-shaped fields are **identical to T1**; only the `input` field is transformed.

### Per-field rules (delta vs T1)

| Raw field | Transformation | Example result |
|---|---|---|
| `input` (first 4 bytes) | resolve via 4byte registry → function-signature name; emitted as new field `function`; raw selector bytes discarded | `"function": "execute"` |
| `input` (remaining bytes) | ABI-decode the argument tuple against the resolved function signature into a single `args` object, keyed by ABI parameter name, in ABI parameter order; raw calldata discarded | `"args": {"to": "0xA0b86991…eb48", "value": "0", "data": "0xa9059cbb…", "operation": 0}` |

Inside `args`:

- numeric values (`uint*`, `int*`) → decimal string (per the hex-to-decimal numeric encoding primitive);
- addresses → EIP-55 casing;
- `bytes` / `bytes<N>` → `0x`-prefixed hex string;
- `bool` → JSON boolean;
- arrays / structs → JSON array / object preserving ABI shape.

### Result (565 compact bytes — **−49.0%** vs raw)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tx":                          "0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0",
    "tx_index":                    "20",
    "block":                       "25093593",
    "block_hash":                  "0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4",
    "from":                        "0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381",
    "to":                          "0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b",
    "nonce":                       "1083264",
    "value":                       "0",
    "gas_limit":                   "121618",
    "gas_price":                   "2336772945",
    "max_fee_per_gas":             "2379579332",
    "max_priority_fee_per_gas":    "2000000000",
    "function":                    "execute",
    "args": {
      "to":        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "value":     "0",
      "data":      "0xa9059cbb000000000000000000000000fa21f001ef54ac2510d72e854a492b8731c3e7fa00000000000000000000000000000000000000000000000000000006fc23ac00",
      "operation": "0"
    },
    "block_timestamp":             "1778764319"
  }
}
```

T2 ≈ **−49%** bytes on this example. Inner-call decoding (e.g., the `bytes data` argument here being itself a `transfer(...)` calldata) is **out of scope at v1** — the consumer can re-feed the inner blob through a second decoding pass if needed.

### Unknown function selector — fallback

When the 4byte registry cannot resolve the selector, **keep `input` verbatim** and add `_function_unknown: true` at the top level. The rest of the response stays in its T1 form.

```jsonc
{
  "tx":    "0x…",
  "from":  "0x…",
  "to":    "0x…",
  // … other T1 fields …
  "input": "0x<unresolved>",
  "_function_unknown": true
}
```

Servers **MUST NOT** invent a decoding. Whole-response downgrade to T0 is **NOT** triggered for an unknown selector — the surrounding transaction metadata is still useful to the consumer.

### Selector collision

When more than one signature shares the same selector, the choice among them is **implementation-defined**: this spec fixes where a decode is placed, not how the signature is resolved. A server **MUST** pick deterministically, so that the same request against the same server yields the same variant, and **MUST NOT** invent a decoding when no candidate decodes cleanly. No `_function_inferred` flag is emitted.

Two servers resolving from different signature sources may therefore disagree on a colliding selector. That is a known limit of tier 2 and the reason [`../evm-v1.md`](../evm-v1.md) scopes cross-server equivalence to the decoding being shared.

> Non-normative, how Ankr's deployment resolves collisions today: candidates are filtered by the number of indexed parameters, then ordered by popularity, and the first variant that decodes the argument tuple cleanly wins. The ordering is a property of the server's signature bundle rather than of the request, so repeated calls against one server are stable.

---

## 4. Edge cases

- **Pending transaction (`blockHash`, `blockNumber`, `transactionIndex`, `blockTimestamp` all `null`).** Preserve null verbatim at every tier. T2 still decodes `input` — pending txs have valid calldata.
- **Contract creation (`to: null`).** Preserve `to: null`. `input` is the deploy bytecode + constructor args, not a function call; **T2 keeps `input` verbatim** (deploy-time decoding requires the contract's compiler artifact, not a 4byte selector). No `_function_unknown` flag — `to: null` is the unambiguous signal that this is a creation.
- **Pure ETH transfer (`input: "0x"`).** **Drop the `input` field at T1** (it carries no information) and emit no `function` / `args` at T2. Recoverable by policy: at T1, an absent `input` on a transaction with a non-null `to` means empty calldata. At T2 absence carries no such meaning, because a decoded call replaces `input` with `function` / `args`.
- **Unknown tx hash (`result: null`).** Pass through verbatim at every tier.
- **EIP-2930 access list with empty entries.** Drop the `access_list` field entirely when the raw array is empty; preserve verbatim when populated.
- **EIP-4844 blob transactions (type `0x3`).** `blobVersionedHashes` and `maxFeePerBlobGas` carry through per the table above. `blobGasUsed` lives on the receipt, not the transaction.
- **EIP-7702 type-4 transactions.** `authorizationList` carries through verbatim. Decoding the per-authorization entries (`chainId`, `address`, `nonce`, `yParity`, `r`, `s`) into a decoded shape is deferred to v1.1+.
- **Chain-specific extension fields** (Optimism `sourceHash` / `mint` / `isSystemTx`, Arbitrum `requestId`, etc.). Pass through verbatim at every tier.

---

## 5. Open questions

- **Nested calldata decoding.** Common wrapping patterns — Safe `execTransaction`, account-abstraction `execute`, Multicall3 `aggregate3` — embed an inner call's calldata as a `bytes` argument. v1 does not recursively decode; the inner blob ships as a hex string inside `args`. A future revision could chain decoding when the wrapping function's ABI declares the `bytes` argument as "callvalue" semantically (no standard way to declare this today).
- **Constructor-args decoding for contract creation.** Requires the contract's compiler artifact (deploy bytecode + constructor ABI). Out of scope for a 4byte-registry-based decoder; deferred.
- **EIP-7702 `authorizationList` decoding.** Today the auth list ships verbatim. Once consumption patterns settle, the per-auth tuple could be reshaped to `{chain, account, nonce, sig}` — pending real-world traffic.
- **Tabular form for batched lookups.** When a consumer fetches multiple transactions in sequence and pipelines them into an LLM, the cross-tx repetition of keys (`tx`, `block`, `from`, `to`, …) is wasteful. The `+tabular` sub-variant tracked in [`eth_getLogs.md`](./eth_getLogs.md) §5 likely composes naturally here.
