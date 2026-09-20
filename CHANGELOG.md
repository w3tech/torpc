# Changelog

Notable changes to the TORPC specification, its per-method mappings and its conformance vectors.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is the
specification's own, defined in [GOVERNANCE.md](./GOVERNANCE.md): an editorial change gets a dated
entry and no version bump, a backward-compatible addition gets a minor bump, and anything that can
make a conforming implementation non-conforming gets a major one. Governance also states that
merging the text is not a release — a release is a tag plus the version bump — which makes this file
the release notes that policy refers to.

No tag has been cut in this repository yet, so everything below sits under Unreleased. v1 is being
tagged separately: rather than date a v1 entry to a tag that does not exist, this file keeps v1
unreleased, and the section will be renamed with the tag's own date when the tag lands.

## Unreleased

### Added

- **EVM RPC Compression v1**, status **Draft**, in [`specs/evm-v1.md`](./specs/evm-v1.md). Opt-in
  per request through two HTTP headers, `Accept-Token-Tier` on the request and `Token-Tier` on the
  response, with no change to the JSON-RPC 2.0 envelope and no new methods or error codes. Tiers 0
  through 2 are normative; tiers at or above 3 are reserved and can only be given meaning by a
  specification release. The document fixes best-effort downgrade, transformation-failure
  passthrough, verbatim passthrough of JSON-RPC errors and of methods carrying no ruleset,
  reversibility by re-query, determinism, and the minimum-tier rule for batched responses.
- **Per-method mappings** under [`specs/methods/`](./specs/methods/): eight mapping documents
  covering **23 JSON-RPC methods**, each stating the field-level transform at T1 and at T2. Of those
  23 methods, ten reach tier 2 and the remaining thirteen are tier 1 only. The coverage table in
  [`specs/methods/README.md`](./specs/methods/README.md) lists 21 rows, because
  `eth_getTransactionByHash.md` also covers `eth_getTransactionByBlockHashAndIndex` and
  `eth_getTransactionByBlockNumberAndIndex`, which have no row of their own. The same directory
  carries the table of methods deliberately left out of v1, with the reason for each.
- **Conformance vectors and runner** in [`conformance/`](./conformance/): a dependency-free runner
  that drives an implementation through an adapter, and one golden vector,
  `conformance/golden/eth_getTransactionReceipt/hex-strip-and-drop-service.json`. One case is not
  coverage. Certification is not open, no implementation is certified, and nothing may be described
  as "TORPC Conformant" yet; the gate for opening it is in [GOVERNANCE.md](./GOVERNANCE.md).
- Repository documents: [README.md](./README.md), [GOVERNANCE.md](./GOVERNANCE.md),
  [DECISIONS.md](./DECISIONS.md), [CONTRIBUTING.md](./CONTRIBUTING.md),
  [TRADEMARKS.md](./TRADEMARKS.md), [SECURITY.md](./SECURITY.md), and the non-normative whitepaper
  under [`whitepaper/`](./whitepaper/). Everything in this repository is CC0-1.0.

### Changed

- The reference packages are named as they are actually published, both under the `@w3tech.io`
  scope. The codec is
  [`@w3tech.io/torpc-decoder`](https://www.npmjs.com/package/@w3tech.io/torpc-decoder) on npm, with
  the install line in the README. The ruleset library is renamed from `@torpc/toevm-rules` to
  `@w3tech.io/torpc-toevm-rules`; it stays unpublished, so that name is the in-repository name and
  no package stands behind it on any registry. README, GOVERNANCE and TRADEMARKS previously used the
  names `@torpc/decoder` and `@torpc/toevm-rules`; neither exists on any registry, and the `@torpc`
  scope is not used at all.
- The reserved npm scope in [TRADEMARKS.md](./TRADEMARKS.md) is `@w3tech.io`, which is where the
  reference packages are published. The previous text reserved a scope that holds nothing.
