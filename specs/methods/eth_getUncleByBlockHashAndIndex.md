# `eth_getUncleByBlockHashAndIndex` / `eth_getUncleByBlockNumberAndIndex` — per-method mapping

| | |
|---|---|
| **Status** | T1 normative |
| **Covers** | `eth_getUncleByBlockHashAndIndex` and `eth_getUncleByBlockNumberAndIndex` — identical response shape; only the parent-block lookup parameter differs (32-byte hash vs block tag / number). |
| **Traffic** | Negligible on the public RPC tier (rank #546 / #554 by call volume). Spec entry exists for completeness: uncle data is a pre-merge historical artifact and consumers tend to fetch raw. |

> Address values are emitted in EIP-55 checksum casing in the **`miner` field**. Hex-decoded numerics are emitted as **decimal strings** per the global hex-to-decimal numeric encoding primitive in [`../evm-v1.md`](../evm-v1.md) §T1.

---

## 1. How it works

Both methods return a **single uncle header** identified by its parent block plus a positional index. The response is **header-only** — no `transactions[]` field, no per-tx walk. Conceptually it's a strict subset of the block-header shape covered by [`eth_getBlockByHash.md`](./eth_getBlockByHash.md): same field names, same semantics, but the transaction list is absent and the post-merge fields (`baseFeePerGas`, `withdrawalsRoot`, `blobGasUsed`, `excessBlobGas`, `parentBeaconBlockRoot`, `requestsHash`) never appear because uncles are a pre-merge PoW artifact.

Compression value is the same as the block-header subset of [`eth_getBlockByHash.md`](./eth_getBlockByHash.md):

1. **Header service noise** — `sha3Uncles`, `stateRoot`, `transactionsRoot`, `receiptsRoot`, `logsBloom` (256 bytes), `mixHash`, `nonce`, `extraData`.
2. **Hex → decimal across header numerics** — `number`, `timestamp`, `gasLimit`, `gasUsed`, `size`, plus `difficulty` if it survives the drop policy (see §4).

Worked example throughout this doc: the uncle at index 0 of Ethereum mainnet block **12,951,411** (hash `0xe429b1e5…311c90`), a representative pre-merge PoW block.

### Request

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "method": "eth_getUncleByBlockNumberAndIndex",
  "params": ["0xc59f73", "0x0"]
}
```

### Raw response (~1,400 compact bytes)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "hash":             "0xd13e27ec74fef9dd42742daecda760def1a9bb836f4342230fef4195c187fdfd",
    "parentHash":       "0x63a9c78cb84cc8ff33371c31a1c8efb24c044694a20bfb920f96c58cab512cd9",
    "sha3Uncles":       "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",   // service — empty-uncles constant
    "miner":            "0x6a86bbe22d73cbf0df82ef96d78d99ce585e690c",
    "stateRoot":        "0x91aec9a9dbbb60ce9302601f8e44075f17ac2f6b8ad3aba0b920b9587032c3a2",   // service
    "transactionsRoot": "0xc59b5ce80c7e1857963794c3a87f11e0674f54b014b0c40ec93dd00e5b45ceb4",   // service
    "receiptsRoot":     "0xb8c01c51e89e42f595c11db95cd18a856ce031968fe27797415ac8b5a68f80db",   // service
    "logsBloom":        "0x7ea0c11a…7d60d",                                                     // 256 bytes — service
    "difficulty":       "0x1a4d099aca7ec9",
    "number":           "0xc59f72",
    "gasLimit":         "0xe4a889",
    "gasUsed":          "0xe47488",
    "timestamp":        "0x610907a4",
    "extraData":        "0x",                                                                   // service (often empty / miner graffiti)
    "mixHash":          "0xcb95fd7f358e5118d95f98265f049e9955cc068bb6ccbcd90084948b633f342a",   // service (PoW seed)
    "nonce":            "0xcf830b788056f55b",                                                   // PoW nonce
    "size":             "0x209",
    "uncles":           []
  }
}
```

The shape is **strictly a subset of the block-header shape**. No `transactions[]`. No post-merge EIP fields. The `uncles[]` field is invariably empty on an uncle (uncles cannot themselves carry uncles).

---

## 2. T1 — Mechanical (normative)

Apply the **block-header subset of [`eth_getBlockByHash.md`](./eth_getBlockByHash.md) §T1 verbatim** — same drop list, same renames, same hex → decimal rules, same EIP-55 on `miner`. The per-tx walk does not apply (no `transactions` field on an uncle).

Transforms on carried fields are mechanically reversible. The drops below are policy drops and are recovered only by re-issuing the request without the opt-in header, against the same parent block and index, per [`../evm-v1.md`](../evm-v1.md) §Behavior rule 5. On an uncle the drops bite harder than on a canonical block, because an uncle is pre-merge PoW: `difficulty`, `nonce`, and `mixHash` all carry real values here, and none of them is derivable from what remains. See [§4](#4-edge-cases).

| Raw field | Transformation | Notes |
|---|---|---|
| `hash` | rename → `block_hash` | Same as the block-header rule. |
| `parentHash` | rename → `parent_hash` | |
| `number` | rename → `block`, hex → decimal | |
| `miner` | EIP-55 casing | |
| `timestamp` | hex → decimal | |
| `gasUsed` | rename → `gas_used`, hex → decimal | |
| `gasLimit` | rename → `gas_limit`, hex → decimal | |
| `size` | hex → decimal | |
| `uncles` | keep verbatim (always empty array on an uncle response) | |
| `difficulty` | **drop** | Same rule as block-header; deterministic-drop policy applies even though uncles carry meaningful PoW difficulty. See [`eth_getBlockByHash.md`](./eth_getBlockByHash.md) §5 open question for the rationale. |
| `nonce` | **drop** | PoW nonce — opaque to consumers; deterministic-drop. |
| `mixHash` | **drop** | PoW seed — opaque to consumers; deterministic-drop. |
| `sha3Uncles` | **drop** | Empty-uncles constant, and recomputable as such: `uncles[]` on an uncle response is always empty, so the value is `keccak256(rlp([]))`. |
| `stateRoot`, `transactionsRoot`, `receiptsRoot` | **drop** | Consensus Merkle roots: proof material, dead weight for an LLM consumer. Not derivable from the output. |
| `logsBloom` | **drop** | Filter index over the uncle's **own** logs. Not derivable from this response, and not from the canonical block either: an uncle's transactions were never executed in the canonical chain, and an uncle body is not served over JSON-RPC. A consumer that needs the uncle's bloom re-issues this request without the opt-in header. |
| `extraData` | **drop** | Miner graffiti: variable, opaque. Not derivable from the output. |

Post-merge fields (`baseFeePerGas`, `withdrawalsRoot`, `blobGasUsed`, `excessBlobGas`, `parentBeaconBlockRoot`, `requestsHash`) never appear in an uncle response — uncles are pre-merge PoW only. The block-header rules that name them are no-ops here.

### Result (~280 compact bytes — **−80%** vs raw)

```jsonc
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "block":       "12951410",
    "block_hash":  "0xd13e27ec74fef9dd42742daecda760def1a9bb836f4342230fef4195c187fdfd",
    "parent_hash": "0x63a9c78cb84cc8ff33371c31a1c8efb24c044694a20bfb920f96c58cab512cd9",
    "miner":       "0x6A86BBe22d73CBf0dF82eF96d78d99cE585E690C",
    "timestamp":   "1627981732",
    "gas_used":    "14972040",
    "gas_limit":   "14985353",
    "size":        "521",
    "uncles":      []
  }
}
```

T1 saving on the worked uncle is dominated by the **`logsBloom` drop** (256 bytes / ~75 tokens) plus the five Merkle-root drops and the three PoW-field drops. Net T1 ≈ **−80% bytes** on the canonical uncle.

---

## 3. T2 — Semantic

**Not applicable.** Uncles carry no transactions and no logs; there is no calldata to decode and no event signatures to resolve. T2 ≡ T1 for these methods.

---

## 4. Edge cases

- **Out-of-range uncle index (`result: null`).** Both methods return `null` when the index is beyond the parent block's uncle count, when the parent block has zero uncles (every post-merge block on Ethereum mainnet), or when the parent block doesn't resolve. Pass through verbatim at every tier.
- **Post-merge parent block.** No uncles exist; both methods return `null` regardless of index. Same passthrough rule.
- **Pre-merge `difficulty` drop is lossy by deterministic-drop policy.** Uncle difficulty is meaningful (it's part of the canonical block's reward calculus), but the drop is uniform with block-header §T1 because conditional-presence drops violate the spec-wide determinism contract. Consumers who index historical uncle data set `Accept-Token-Tier: 0` to retain raw.
- **`uncles[]` always empty on an uncle response.** Uncles cannot themselves carry uncles (one level of uncle nesting per the consensus protocol). The empty array is part of the canonical shape; passthrough is the rule even though it's redundant.
- **Chain-specific extension fields.** Pass through verbatim per the global unknown-field passthrough rule.

---

## 5. Open questions

- **Whether to spec uncles at all in v1.** Post-merge there are no new uncles on Ethereum mainnet, and both methods sit at the very bottom of the public-tier call-volume ranking. Coverage exists for completeness with [`eth_getBlockByHash.md`](./eth_getBlockByHash.md) rather than impact. A future revision may demote uncles to "raw passthrough" if the maintenance burden of mirroring block-header rule changes outweighs the spec-symmetry value.
- **`difficulty` / `nonce` / `mixHash` retention.** Same open question as the block-header doc — historical-archive consumers want them; LLM-prompt consumers don't. Deterministic-drop keeps them out for now. Tracked.
