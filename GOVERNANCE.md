# Governance

How the TORPC specification is maintained: who decides, how a change is proposed, what counts as a normative change, how versions are numbered, and how the "TORPC Conformant" designation works.

**Last updated:** 2026-07-27

## What this document governs

This repository holds the specification and the artefacts that pin its meaning:

| Path | Contents |
|---|---|
| [`specs/`](./specs/) | The normative specification: [`specs/evm-v1.md`](./specs/evm-v1.md) plus per-method mappings under [`specs/methods/`](./specs/methods/). Everything under `specs/` is normative. Superseded drafts are not republished here; the consolidation that replaced them is recorded in [DECISIONS.md](./DECISIONS.md). |
| [`conformance/`](./conformance/) | Golden vectors that fix the required output, plus a runner. See [`conformance/README.md`](./conformance/README.md). |
| [`whitepaper/`](./whitepaper/) | Non-normative background and measurements. |
| Root documents | [README.md](./README.md), [DECISIONS.md](./DECISIONS.md), this file, [TRADEMARKS.md](./TRADEMARKS.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md). |

Everything in this repository is CC0-1.0.

Reference code lives in a separate repository, `w3tech/torpc-js`, under Apache-2.0, and follows its own release process. This document does not govern it. Where a decision touches both, the specification is the authority and the code is expected to follow, not the other way round.

## Maintainers

Current maintainers, both at Web3 Technologies, Inc. (dba Ankr):

- Mike Kondratev
- Alexander Kolesov

They are also the authors of the specification as published. Author credit belongs in the specification document itself and is not a governance role.

Maintainers are responsible for:

- triaging issues and pull requests;
- ruling whether a proposed change is normative or editorial;
- approving and merging changes;
- keeping [DECISIONS.md](./DECISIONS.md) current, one entry per normative decision, with the reasoning and the alternatives that were rejected;
- cutting specification releases;
- maintaining the conformant listing described below;
- handling reports received under [SECURITY.md](./SECURITY.md).

The maintainer set changes by agreement of the current maintainers. Additions and removals are recorded in this file with the date. Contributors with a sustained record of merged normative work can be proposed as maintainers by anyone, including themselves, by opening an issue.

Maintainers are reachable by opening an issue on this repository. For anything that must stay private, use the private reporting channel in [SECURITY.md](./SECURITY.md).

## Proposing a change

1. **Open an issue first** for anything that could change what an implementation must do. Describe the problem, not only the fix. Include a concrete request and response pair. For a change to existing behaviour, state what it does to implementations already deployed against the current text.
2. **A maintainer labels it** normative or editorial, using the test in the next section. If the label is wrong, argue it in the issue before writing the pull request.
3. **Open a pull request against `specs/`.** A normative change must also carry at least one golden vector under `conformance/golden/`, and an entry appended to [DECISIONS.md](./DECISIONS.md). Sign-off is required, see [CONTRIBUTING.md](./CONTRIBUTING.md).
4. **Review.** Editorial changes need approval from one maintainer. Normative changes need approval from at least two maintainers, which while the maintainer set is two people means both of them. A maintainer does not approve their own normative change.
5. **Merge, then release.** Merging the text is not a release. A release is a tag plus the version bump described below.

Purely editorial fixes, typos, dead links, formatting, may skip step 1 and go straight to a pull request.

Discussion happens in public, in the issue or the pull request. A decision reached anywhere else is not a decision until it is written into the issue thread and, if normative, into DECISIONS.md. That rule exists so the reasoning survives the people.

Where the maintainers cannot agree, the change does not land. There is no tie-break vote and no casting vote. A blocked normative proposal stays open with the disagreement recorded.

## Normative versus editorial

A change is **normative** if it can change the set of behaviours that count as conforming. In practice that includes:

- header names, header semantics, or the values a header may carry, including the canonical request header `Accept-Token-Tier`, the canonical response header `Token-Tier`, and the handling of the deprecated alias;
- tier definitions, tier numbering, or what a tier is permitted to do to a payload;
- any requirement expressed with an RFC 2119 keyword (MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, OPTIONAL), including adding one, removing one, or changing its strength;
- per-method field mappings: which fields are dropped, renamed, reformatted, decoded or truncated, and how;
- cross-cutting response behaviour: batch handling, cache-relevant headers, error passthrough, unsupported-method passthrough, transformation-failure passthrough, determinism guarantees;
- the expected output in any golden vector, and the addition or removal of a vector;
- the conformance criteria and the certification requirements in this document.

A change is **editorial** if it cannot: wording, punctuation, section order, formatting, link fixes, added rationale that restates an existing requirement, examples that illustrate behaviour the text already requires, and corrections to non-normative background.

Two rules resolve the edge cases:

- **When in doubt, normative.** The cost of over-labelling is one extra approval. The cost of under-labelling is a silent wire change.
- **Ambiguity is a normative bug.** If two careful readers of the published text implement it differently, that is not a wording problem to be tidied editorially. It is a defect in a requirement, and the fix is a normative change with a vector that pins the intended reading.

An example added to explain existing behaviour is editorial. An example that shows behaviour the normative text does not require is a normative change dressed as an example, and is treated as one.

## Versioning

**The specification versions independently from the reference code.** They are separate repositories with separate release cadences, and a code release is never a specification release. A package release states which specification version it targets. The specification never states which package version implements it.

Specification versioning:

| Change | Effect |
|---|---|
| Editorial only | No version bump. Dated entry in the release notes. |
| Backward-compatible addition: a new per-method mapping, a new optional header, a newly defined reserved tier | Minor bump, for example v1 to v1.1. An implementation conforming to the previous version still conforms. |
| Anything that can make a currently conforming implementation non-conforming, or that changes the bytes on the wire for a method and tier already specified | Major bump, for example v1 to v2. |

The current normative document is [`specs/evm-v1.md`](./specs/evm-v1.md), at Draft v1. While a version carries the status Draft, normative changes may land within it, and the status table in the document records that. Once a version is published as final, its text is immutable: corrections go into the next version, and the published text is never edited in place. Filenames carry the major version, so a v2 arrives as a new document rather than a rewrite of the v1 file.

Tiers at or above 3 are reserved. A reserved tier can only be given meaning by a specification release, never by an implementation choosing one unilaterally.

Reference packages, currently the published `@w3tech.io/torpc-decoder` and the unpublished in-repository `@torpc/toevm-rules`, use semantic versioning in their own repository and declare their target specification version in their README and package metadata.

## TORPC Conformant certification

"TORPC Conformant" is a designation controlled through the trademark, described in [TRADEMARKS.md](./TRADEMARKS.md). The specification text is public domain, so the mark is the only thing that keeps the name attached to the published behaviour. The model is the CNCF Certified Kubernetes pattern: a public, self-run test suite, a maintainer-controlled listing, and a name gated on both.

### Current status: not open

The conformance suite is **Scaffold v0.0.1**. It contains exactly one golden case, `conformance/golden/eth_getTransactionReceipt/hex-strip-and-drop-service.json`, exercising a subset of the T1 rules on a single fixture. Passing it does not demonstrate conformance in any useful sense.

Therefore: **certification is not open, no implementation is certified, the listing does not yet exist, and nobody may claim "TORPC Conformant" today, Ankr included.** Until it opens, describe your implementation as "implements TORPC" or "TORPC compatible", which needs no permission.

### The gate for opening certification

Certification opens when the suite covers the contract, which means all of:

- at least one golden vector per normative per-method mapping in [`specs/methods/`](./specs/methods/), at each of T1 and T2;
- vectors for the cross-cutting requirements: batch responses and the tier floor they declare, the cache-relevant `Vary` requirement, JSON-RPC error passthrough, unsupported-method passthrough, and transformation-failure passthrough;
- a runner that a third party can execute against their own implementation without modifying the vectors.

That gate is tracked in the open issues on this repository. When it is met, this section is updated in the same pull request that lands the last of it, and the listing opens.

### The process, once open

1. **Run the suite.** Execute every published golden vector at the tiers you claim, against an unmodified checkout of the vectors, and capture the output.
2. **Submit a listing request** as an issue containing: implementation name and version, the specification version targeted, the tiers claimed, the runner output, and a public URL for the implementation or its documentation.
3. **Maintainer review.** A maintainer checks that the run covers the claimed tiers and that the output is complete. Review confirms the vectors pass. It is not an audit, a security review, or an endorsement of the implementation.
4. **Listing.** Accepted implementations are listed publicly, with the specification version and tiers they were certified against.
5. **Re-certification** is required on each specification minor or major release. A listing that has not been re-certified against the current version is marked stale and then removed.
6. **Removal.** Maintainers remove a listing that no longer passes, that claims tiers it does not implement, or whose holder uses the designation outside the terms in [TRADEMARKS.md](./TRADEMARKS.md).

Certification is free. There is no fee, no membership and no commercial relationship attached to it, and an Ankr implementation gets no different treatment from anyone else's.

## Related documents

- [README.md](./README.md), repository overview
- [`specs/evm-v1.md`](./specs/evm-v1.md), the normative specification
- [`conformance/README.md`](./conformance/README.md), the vectors and how to run them
- [DECISIONS.md](./DECISIONS.md), the decision log
- [CONTRIBUTING.md](./CONTRIBUTING.md), contribution terms and DCO sign-off
- [TRADEMARKS.md](./TRADEMARKS.md), permitted and reserved uses of the marks
- [SECURITY.md](./SECURITY.md), how to report a vulnerability
