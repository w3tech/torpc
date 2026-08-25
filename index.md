---
title: TORPC
---

# TORPC

**TORPC (Token Optimized RPC) is an opt-in compression layer for blockchain JSON-RPC.** A client
asks for a compression tier with one request header, and the server states the tier it actually
applied with one response header. No new methods, no envelope, no new error codes, and no change to
JSON-RPC 2.0 itself.

JSON-RPC was designed for clients that render into an interface. A fast growing class of consumer is
an LLM-driven agent that pays per token and has a finite context window. For that consumer most of a
raw response is waste: hex padding, service fields it never reads, and undecoded calldata it cannot
interpret. TORPC does that work once, on the way out.

The specification is published under **CC0 1.0**, so anyone may implement it, and implementing it
requires no permission from and no relationship with any provider.

## Try it in one command

Any endpoint that implements TORPC answers an ordinary JSON-RPC request. This one is public and
needs no key:

```bash
curl -sS -i -X POST "https://rpc.ankr.com/monad_mainnet" \
  -H 'Content-Type: application/json' \
  -H 'Accept-Token-Tier: 2' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBlockByNumber","params":["latest",false]}'
```

The response carries `token-tier: 2`, and the body comes back renamed and in decimal:

```json
{"id":1,"jsonrpc":"2.0","result":{"base_fee_per_gas":"100000000000","block":"90785283",
"gas_limit":"150000000","gas_used":"22917133","size":"800","timestamp":"1785159403"}}
```

## The documents

| Document | What it is | Status |
| --- | --- | --- |
| [EVM RPC Compression v1](specs/evm-v1.md) | The normative specification | Draft. Tiers 1 and 2 normative, tiers 3 and above reserved |
| [Per-method mappings](specs/methods/) | What each method's response becomes at each tier | 23 methods carry a v1 mapping, described by 8 documents |
| [Conformance suite](https://github.com/w3tech/torpc/tree/main/conformance) | Golden cases an implementation must reproduce | Scaffold v0.0.1, one case. Not a coverage claim |
| [Whitepaper](https://github.com/w3tech/torpc/tree/main/whitepaper) | Design rationale and measurements | Draft |
| [Governance](GOVERNANCE.md) | How the specification changes | Current |
| [Decisions](DECISIONS.md) | Why the design is what it is | Current |

## Nobody is conformant yet

The conformance suite holds exactly one golden case. Until it covers the specification, **no
implementation, including Ankr's, may describe itself as TORPC conformant.** The word is reserved
for something the suite can demonstrate.

## Implementations

- [w3tech/torpc-js](https://github.com/w3tech/torpc-js) is the reference decoder, the typed ruleset
  and the benchmark harness, under Apache-2.0.
- Ankr RPC applies tiers 1 and 2 on its endpoints. It is one implementation of this specification,
  not the specification itself.

Building another one? Open an issue in [w3tech/torpc](https://github.com/w3tech/torpc). Interop
reports are the most useful thing the project can receive right now.
