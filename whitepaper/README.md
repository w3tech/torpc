# TORPC - whitepaper

LaTeX source for **Token Optimized RPC: Reading a Blockchain Without Drowning an Agent in Tokens** (draft v0.9).

Authors: Mike Kondratev, Alexander Kolesov, Roman Fasakhov, Stanley Wu. Same author list as
[the spec](../specs/evm-v1.md) and the paper's own title page.

The paper is self-contained - TikZ diagrams are inline, no external images or bibliography files.

## Build

Needs [Tectonic](https://tectonic-typesetting.github.io/).

```
brew install tectonic   # macOS
./build.sh
```

Output: `torpc.pdf`.

You can also run `tectonic torpc.tex` directly.

## Files

- `torpc.tex` - the paper source (edit this)
- `torpc.pdf` - build artifact. Any edit to `torpc.tex` requires a rebuild (`./build.sh`), otherwise the committed render no longer matches the source
- `build.sh` - build wrapper

## What the paper cites, and where it lives

- Spec and per-method rulesets: [`../specs/`](../specs/), conformance vectors: [`../conformance/`](../conformance/) (both in this repository).
- Benchmark corpus, accuracy suite, and the 2026-07-17 live production measurement (script plus per-method table): the `bench/` folder of the code repository, <https://github.com/w3tech/torpc-js>.

Numbers in the paper are quoted from those published artifacts with their run label. If a figure changes, change it in the artifact first, then here.

### The measurements the paper is allowed to quote

Four sources, each with its own scope. They are not interchangeable, and every figure in the paper names its own.

- **Live production run, 2026-07-17.** 21 measured methods (of 23 transformable), 525 raw/T1/T2 triples over 25 random ETH mainnet blocks, `o200k_base` counted over the full HTTP response body: **-35.3%** at T1 and **-48.4%** at T2, token-weighted, or **-17.4%** and **-24.5%** unweighted per method. Per-method figures come from `bench/results/live-token-savings-2026-07-17.md` as published, never from arithmetic performed here.
- **Earlier six-method run, 2026-05-27.** -34.0% at T1, -45.6% at T2, against the pre-canonical alias header. Quoted only as a consistency check on the newer run.
- **Public bench corpus.** -45.0% overall at T2 over 114 pinned fixtures, plus the three-model retrieval-accuracy suite: `bench/results/BENCHMARK.md` and `bench/results/SUMMARY.md`.
- **The spec's worked receipt.** 696 tokens raw, 342 at T1, 292 at T2, from `../specs/methods/eth_getTransactionReceipt.md`. A single response measured against the production endpoint, outside both runs.

Never attribute a bench-corpus number to production traffic, or the reverse, and never quote a per-method figure that is not in one of those tables.

## Licence

CC0 1.0 Universal, like everything else in this repository. See [`../LICENSE`](../LICENSE).

## Contributing

Open a PR against `main` with your changes to `torpc.tex`. Rebuild `torpc.pdf` before pushing so the render matches the source.
