# Per-method mappings

One document per JSON-RPC method, describing the exact field-level mapping at each tier defined by [`../evm-v1.md`](../evm-v1.md).

A method documented here is in-scope for compression. Methods not present here **MUST** be returned raw by conforming servers (`Token-Tier: 0`).

## v1 method coverage

| Method | T1 | T2 | Mapping doc |
|--------|:--:|:--:|---|
| `eth_blobBaseFee` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_blockNumber` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_chainId` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_estimateGas` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_feeHistory` | ✓ | — | [eth_feeHistory.md](./eth_feeHistory.md) |
| `eth_gasPrice` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getBalance` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getBlockByHash` | ✓ | ✓ | [eth_getBlockByHash.md](./eth_getBlockByHash.md) |
| `eth_getBlockByNumber` | ✓ | ✓ | [eth_getBlockByHash.md](./eth_getBlockByHash.md) (same response shape as `eth_getBlockByHash`) |
| `eth_getBlockReceipts` | ✓ | ✓ | [eth_getBlockReceipts.md](./eth_getBlockReceipts.md) |
| `eth_getBlockTransactionCountByHash` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getBlockTransactionCountByNumber` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getLogs` | ✓ | ✓ | [eth_getLogs.md](./eth_getLogs.md) |
| `eth_getTransactionByHash` | ✓ | ✓ | [eth_getTransactionByHash.md](./eth_getTransactionByHash.md) (also covers `eth_getTransactionByBlockHashAndIndex` / `eth_getTransactionByBlockNumberAndIndex`) |
| `eth_getTransactionCount` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getTransactionReceipt` | ✓ | ✓ | [eth_getTransactionReceipt.md](./eth_getTransactionReceipt.md) |
| `eth_getUncleByBlockHashAndIndex` | ✓ | ✓ [^uncle] | [eth_getUncleByBlockHashAndIndex.md](./eth_getUncleByBlockHashAndIndex.md) |
| `eth_getUncleByBlockNumberAndIndex` | ✓ | ✓ [^uncle] | [eth_getUncleByBlockHashAndIndex.md](./eth_getUncleByBlockHashAndIndex.md) (same response shape as `eth_getUncleByBlockHashAndIndex`) |
| `eth_getUncleCountByBlockHash` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_getUncleCountByBlockNumber` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |
| `eth_maxPriorityFeePerGas` | ✓ | — | [eth_hexInteger.md](./eth_hexInteger.md) |

— = no measurable savings at that tier for this method. The `+tabular` and `+aggregate` array-sub-variants — strongest compression candidates on uniform-shape array responses like `eth_getLogs` — are deferred to v1.1+.

Until a method has an entry in this directory, conforming servers **MUST** return it raw (`Token-Tier: 0`).

## Not in spec for now

Methods deliberately left out of v1. Each row records *why* — the decision is part of the spec corpus, even though the per-method doc is not.

| Method | Reason |
|---|---|
| `eth_call` | Out of scope per [`../evm-v1.md`](../evm-v1.md) §T2 — requester-known ABI. The caller built the calldata; decoding the return adds no value to that caller and risks divergence when the server's ABI cache differs from the caller's. |
| `eth_getCode` | Opaque bytecode at root, typically multi-kilobyte. No T1 transform possible without disassembly; consumers that need to read bytecode use a disassembler / decompiler, not LLM prompts. |
| `eth_getStorageAt` | 32-byte hex slot value. Semantic layout depends entirely on the caller's storage map; the server cannot transform without that map. |
| `eth_getProof` | Merkle proof envelope, typically multi-kilobyte. Consumer needs a proof-verification library to make use of the response; byte-level compression would obstruct verification. |
| `eth_sendRawTransaction` / `eth_sendTransaction` / `eth_sign` / `eth_signTransaction` | Write path / wallet-only. Response is a 32-byte tx hash or signature; nothing to transform. |
| `eth_subscribe` / `eth_unsubscribe` | WebSocket-only, no HTTP semantics in scope. v1 transport is JSON-RPC 2.0 over HTTP. |
| `eth_newFilter` / `eth_newBlockFilter` / `eth_newPendingTransactionFilter` / `eth_uninstallFilter` / `eth_getFilterChanges` / `eth_getFilterLogs` | Stateful filter subscription family. Response shapes per-filter; out of scope until subscription semantics are addressed separately. |
| `debug_traceTransaction` / `debug_traceBlockByNumber` | `debug_*` namespace — denied on the public RPC tier; separate scope when archive / trace workloads are addressed. |
| `web3_clientVersion` | Freeform short text identifier. No deterministic transform possible. |
| `net_version` | Already a decimal string in raw. Nothing to transform. |
| `net_listening` | Boolean `true` / `false`. Nothing to transform. |
| `net_peerCount` | Tiny hex int; near-zero traffic. Same shape as the `eth_hexInteger.md` group but operational rather than EVM-semantic — deferred. |
| `eth_protocolVersion` | Deprecated; most clients no longer implement. Near-zero traffic. |
| `eth_coinbase` / `eth_mining` / `eth_hashrate` | Mining-era methods; post-merge they return trivial constants (`false` / `0`) on Ethereum mainnet. Near-zero traffic. |
| `web3_sha3` | Server-side hashing utility; response is a 32-byte hash with no compressible structure. Near-zero traffic. |
| `eth_syncing` | Returns `false` on healthy nodes; the object-shaped sync-progress response sees < 0.01% of calls. Deferred until per-node operational monitoring is in scope. |
| `eth_accounts` | Wallet-only; public RPC nodes return `[]`. Near-zero traffic. |
| `eth_createAccessList` / `eth_simulateV1` / `eth_getBlobSidecars` / `eth_fillTransaction` / `eth_pendingTransactions` | Niche / non-standard methods (most are client-specific extensions). Deferred until traffic data supports a per-method doc.

## Document structure (per method)

Per-method docs follow the layout established by [`eth_getTransactionReceipt.md`](./eth_getTransactionReceipt.md):

1. **Status block** — coverage and traffic rank.
2. **How it works** — prose framing of the response shape, a worked-example request, the raw success-path response, and the structural compression opportunities visible by inspection.
3. **T1 — Mechanical** — method-specific application of the [`evm-v1.md`](../evm-v1.md) T1 toolkit (drop list, hex → decimal, hoists, topic unpadding, EIP-55), with a per-tier action table for each field / sub-shape.
4. **T2 — Semantic** — method-specific ABI decoding rules + the per-element and whole-response ABI-unknown fallbacks.
5. **Edge cases** — empty results, mixed-success batches, selector collisions, very large payloads, etc.
6. **Open questions (method-specific)** — items to resolve before promoting beyond v1.

[^uncle]: The uncle pair reaches tier 2 in the sense that the tier is applied and echoed, but post-merge Ethereum mainnet produces no new uncles and the lookup returns `null`, so in practice there is no payload to decode. Coverage counted by what the server applies: ten methods at tier 2, thirteen at tier 1.
