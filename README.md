# TORPC

**TORPC (Token Optimized RPC)** is an opt-in compression layer for blockchain JSON-RPC.
It cuts the number of LLM tokens a JSON-RPC response costs, without changing the JSON-RPC 2.0
protocol: no new methods, no envelope, no new error codes. A client asks for a compression tier
with one HTTP request header, and the server states the tier it actually applied with one HTTP
response header.

JSON-RPC was designed for dApp clients rendering into a UI. A fast growing class of consumer is
an LLM-driven agent that pays per token and has a finite context window. For that consumer, most
of a raw response is waste: hex padding, service fields it never reads, and undecoded calldata it
cannot interpret.

This repository is the **specification**. The reference decoder, the typed ruleset package and the
benchmark harness live in [w3tech/torpc-js](https://github.com/w3tech/torpc-js).

## Status

| Component | Status |
|---|---|
| [EVM RPC Compression v1](specs/evm-v1.md) (`specs/evm-v1.md`) | **Draft.** T1 and T2 normative, tiers 3 and above reserved. |
| [Per-method mappings](specs/methods/) (`specs/methods/`) | 23 methods carry a v1 mapping, described by 8 documents, because methods that share a response shape share a document. The coverage table lists 21 rows: the two transaction-by-block-and-index forms are covered inside the `eth_getTransactionByHash` row. See [`specs/methods/README.md`](specs/methods/README.md) for that table and the explicit out-of-scope list. |
| [Conformance suite](conformance/) (`conformance/`) | **Scaffold v0.0.1.** Exactly one golden case (`eth_getTransactionReceipt/hex-strip-and-drop-service`), which pins the tier-1 and tier-2 expectations for one production-captured receipt. One case is the whole suite. Not a coverage claim, and no implementation, Ankr's included, may call itself "TORPC Conformant" today. |
| [Whitepaper](whitepaper/) (`whitepaper/`) | Design rationale and measurements. |

The canonical headers are `Accept-Token-Tier` on the request and `Token-Tier` on the response,
canonical since 2026-06-04. `Rpc-Compress` (originally `X-Rpc-Compress`) is a deprecated request
alias that servers may still accept from older clients. Send the canonical header: a request
carrying only the alias may be transformed without a `Token-Tier` response header, which leaves the
client unable to tell what it received.

## Quickstart

Any endpoint that implements TORPC answers a normal JSON-RPC request. Add one header, read one
header back. Ankr's Monad mainnet endpoint is public and needs no API key, so this runs exactly as
pasted:

```bash
curl -sS -i -X POST "https://rpc.ankr.com/monad_mainnet" \
  -H 'Content-Type: application/json' \
  -H 'Accept-Token-Tier: 2' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBlockByNumber","params":["latest",false]}'
```

The response headers tell you what happened (TORPC-relevant lines only):

```
HTTP/2 200
content-type: application/json
token-tier: 2
vary: Accept-Token-Tier, Rpc-Compress, Rpc-Decode
```

and the body comes back renamed and in decimal (trimmed here):

```json
{"id":1,"jsonrpc":"2.0","result":{"base_fee_per_gas":"100000000000","block":"90785283",
"gas_limit":"150000000","gas_used":"22917133","size":"800","timestamp":"1785159403"}}
```

Ankr's other endpoints are keyed. The exchange is identical, with a key in the path:

```bash
curl -sS -i -X POST "https://rpc.ankr.com/eth/YOUR_ANKR_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept-Token-Tier: 1' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
```

Reading the exchange:

- `Accept-Token-Tier: 2` is a **ceiling**. The client accepts any tier from 0 up to 2.
- `Token-Tier: 2` is the tier **actually applied**. A server may answer with a lower tier, for
  example `Token-Tier: 1` when it has no T2 ruleset for that method, or `Token-Tier: 0` when the
  method is not covered at all or the response carries a JSON-RPC `error`.
- No `Token-Tier` header at all means the server does not implement TORPC. Treat the body as a
  standard JSON-RPC 2.0 response.
- `Vary` names every request header that changes the body, so a shared cache cannot hand a raw
  response to a client that asked for a rendered one, or the reverse.
- To get the raw response back, repeat the request without `Accept-Token-Tier`. There is no
  separate raw endpoint and no retention contract to rely on: archival availability is a property
  of the node behind the endpoint, so pin a block number or hash when you need the two answers to
  line up.

Tier 1 is mechanical: service fields dropped, hex integers converted to decimal, zero-padded 32
byte values stripped, shared fields hoisted. T1 transforms on carried fields are mechanically
reversible. Enumerated service fields are dropped by policy and are recovered only by re-issuing
the request without the opt-in header, against the same block. Tier 2 adds semantic shape on top,
mapping already decoded events and calldata into `{event, args}` and `{function, args}`.
Full normative text: [`specs/evm-v1.md`](specs/evm-v1.md).

## Coverage

Probed against Ankr's production EVM endpoint on 2026-07-17: **23 transformable methods**, 10
answering at tier 2 and 13 at tier 1. Every other method returns raw with `Token-Tier: 0` rather
than erroring. The two uncle-by-index methods echo tier 2 but return `null` on post-merge mainnet,
so they carry no measurable saving, which is why the mapping table records no tier-2 gain for them.
Coverage is a property of a deployment, not of the spec, so re-probe before quoting it. The
method-to-document table is [`specs/methods/README.md`](specs/methods/README.md).

## Measured savings

Separate measurements, each with its own scope. They are not interchangeable, so the source is
named every time.

| Measurement | Scope | T1 | T2 |
|---|---|--:|--:|
| Live production run, 2026-07-17 | 21 measured methods (of the 23 transformable; the two uncle-by-index methods return `null` and produce no triple), 525 raw/T1/T2 triples over 25 random ETH mainnet blocks, `o200k_base` counted over the full HTTP response body, token-weighted | **-35.3%** | **-48.4%** |
| Same run, unweighted per-method means | as above, each method counted once | -17.4% | -24.5% |
| Earlier six-method run, 2026-05-27 | six methods, pre-canonical alias header, same protocol | -34.0% | -45.6% |
| Public bench corpus | 114 pinned fixtures in the harness in [w3tech/torpc-js](https://github.com/w3tech/torpc-js) | not quoted here | **-45.0%** |

Worked single-response example from the spec, `eth_getTransactionReceipt`: **696 tokens raw, 292 at
T2**, a 58.0% reduction. The field-by-field derivation is in
[`specs/methods/eth_getTransactionReceipt.md`](specs/methods/eth_getTransactionReceipt.md).

The per-method table for the live run is published beside the script it came from,
`bench/results/live-token-savings-2026-07-17.md` in
[w3tech/torpc-js](https://github.com/w3tech/torpc-js). Quote per-method figures from there rather
than deriving them.

Token-weighted and unweighted numbers differ a lot because savings are payload dependent. Small
scalar responses have little to give up, while decode heavy responses such as receipts, logs and
transactions carry most of the waste. Any claim taken from this repository should carry the scope
it was measured on.

## Repository layout

```
specs/evm-v1.md      normative spec, Draft
specs/methods/       per-method T1 / T2 field mappings
conformance/         golden vectors + runner, Scaffold v0.0.1
whitepaper/          design rationale (LaTeX source + built PDF)
DECISIONS.md         decision log: what was decided, why, what was rejected
GOVERNANCE.md        versioning, change process, the "TORPC Conformant" claim
TRADEMARKS.md        trademark and certification-mark policy
CONTRIBUTING.md      how to propose a spec change or a conformance case
SECURITY.md          how to report a security issue
LICENSE              CC0 1.0 Universal, covering everything above
```

## Implementations and tooling

Code lives in [w3tech/torpc-js](https://github.com/w3tech/torpc-js), licensed Apache-2.0:

- **[`@w3tech.io/torpc-decoder`](https://www.npmjs.com/package/@w3tech.io/torpc-decoder)**
  (`codec/`), the reference bidirectional mapper between standard EVM JSON-RPC responses and the
  TORPC compact form. Structural only, no ABI resolution.
- **`@w3tech.io/torpc-toevm-rules`** (`packages/torpc-toevm-rules/`), the typed ruleset library
  that names each normative transformation as a pure function.
- **`bench/`**, the benchmark harness: token efficiency plus retrieval accuracy over pinned ETH
  mainnet fixtures.

The decoder is on npm:

```
npm install @w3tech.io/torpc-decoder
```

The ruleset library is not published. `@w3tech.io/torpc-toevm-rules` is its in-repository name and
no package under that name exists on any registry, so build it from source.

The conformance runner in this repository ships no transform of its own. It validates the golden
vectors, and it exercises an implementation only through an adapter you point at one, in any
language. See [`conformance/README.md`](conformance/README.md).

## Contributing

Spec changes, new per-method mappings and new conformance cases are all welcome. Read
[`CONTRIBUTING.md`](CONTRIBUTING.md) first, and for a new conformance case follow the checklist in
[`conformance/README.md`](conformance/README.md).

Authors of the specification: Mike Kondratev, Alexander Kolesov, Roman Fasakhov, Stanley Wu.

## Licence

**Everything in this repository is released under [CC0 1.0 Universal](LICENSE)**, including the
specification text, the conformance vectors and the conformance runner. Public domain, no
attribution required, no licence header to carry around. This is deliberate: an implementer should
never have to consult a lawyer before writing a TORPC server.

The CC0 dedication is made by Web3 Technologies, Inc. (dba Ankr).

Two things CC0 does not cover:

- **Patents.** CC0 waives copyright and grants no patent rights. The patent position lives in the
  reference implementation's licence: [`w3tech/torpc-js`](https://github.com/w3tech/torpc-js) is
  Apache-2.0, which carries an express patent grant (section 3) from every contributor, including
  Ankr. There is no separate covenant document.
- **Trademark.** CC0 does not touch trademark. [`TRADEMARKS.md`](TRADEMARKS.md) sets out how the
  TORPC name may be used, and [`GOVERNANCE.md`](GOVERNANCE.md) defines the "TORPC Conformant"
  claim. The format is free to copy, the claim of conformance is not free to fake.
