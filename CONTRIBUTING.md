# Contributing

Thanks for looking. This repository holds the TORPC specification, the conformance vectors and the governance documents. Reference code lives elsewhere, see "Where code goes" below.

Read [GOVERNANCE.md](./GOVERNANCE.md) before proposing anything that changes what an implementation must do. It defines the normative versus editorial test, who approves what, and how versions are numbered.

## Licensing of contributions

Everything in this repository is dedicated to the public domain under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). That includes the specification text, the conformance vectors and the runner that ships with them.

By opening a pull request against this repository you:

1. **dedicate your contribution to the public domain under CC0-1.0**, on the same terms as the rest of the repository; and
2. **confirm you have the right to do that.** Either you wrote it yourself, or you have permission from whoever holds the rights. If you are contributing in the course of employment, that usually means your employer holds the rights and you need their sign-off.

Two things that are not contributable here:

- **Text copied from somewhere else.** Do not paste from other specifications, vendor documentation, standards drafts, RFC text, blog posts or generated output whose terms you have not checked. CC0 is a dedication, and you cannot dedicate what you do not own. Quote and cite instead, briefly, or describe the idea in your own words.
- **Anything you know to be patent-encumbered.** CC0 does not grant patent rights, from Ankr or from you, so a contribution that can only be implemented under someone's patent would leave implementers exposed. The reference implementation is Apache-2.0, whose section 3 patent grant covers contributions made there. If you know of a patent that reads on something you are proposing, say so in the issue. Maintainers may decline a contribution on that basis.

There is no CLA to sign. CC0 plus the sign-off below is the whole arrangement.

## Developer Certificate of Origin

Every commit must carry a `Signed-off-by` line. Use:

```
git commit -s -m "spec: clarify batch tier floor"
```

which appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

The line certifies the [Developer Certificate of Origin 1.1](https://developercertificate.org/). Use a real name and a working email address, matching your git `user.name` and `user.email`. Sign-off is per commit, not per pull request.

If you forget it:

```
git commit --amend -s          # last commit
git rebase --signoff main      # every commit on the branch
```

A pull request with unsigned commits is not merged until they are signed off.

## Where code goes

| You want to change | Repository | Licence |
|---|---|---|
| Specification text, per-method mappings | this repository, `specs/` | CC0-1.0 |
| Golden vectors, conformance runner | this repository, `conformance/` | CC0-1.0 |
| Governance, patent, trademark, security documents | this repository, root | CC0-1.0 |
| Whitepaper | this repository, `whitepaper/` | CC0-1.0 |
| Decoder, rules library, benchmark harness | `w3tech/torpc-js` | Apache-2.0 |

**Do not add implementation code to this repository.** A decoder, an encoder, a proxy, a client SDK, a plugin, a language port: all of those belong in `w3tech/torpc-js` or in your own repository under whatever licence you prefer, and they get the Apache-2.0 express patent grant there. The conformance runner is the one piece of executable code here, because it is test tooling that only has meaning next to the vectors it runs, and it stays CC0-1.0 with the rest of this repository.

If you are unsure which repository a change belongs in, open an issue here and ask. Cross-repository work is normal: a normative change usually lands as a specification pull request here and a follow-up pull request there.

## What each kind of contribution needs

| Contribution | What to submit |
|---|---|
| Typo, dead link, formatting | Pull request. No issue needed. |
| New or improved golden vector | Pull request. Always welcome on its own, especially for behaviour the current single scaffold case does not reach. |
| Clarifying an ambiguous requirement | Issue first. Ambiguity counts as a normative bug, so the fix carries a vector. |
| New per-method mapping | Issue first, then a pull request with the mapping document under `specs/methods/` **and** at least one golden vector. |
| Change to existing normative behaviour | Issue first, then a pull request with the text change, at least one golden vector, and a [DECISIONS.md](./DECISIONS.md) entry. |
| Reporting a vulnerability | Not a pull request. See [SECURITY.md](./SECURITY.md) and do not open a public issue. |

**Normative changes come with a golden vector.** This is the one hard expectation beyond sign-off. Prose alone is arguable and vectors are not, and a requirement that no vector pins is a requirement two implementers will read two ways. If you cannot express the change as a vector, say so in the issue and explain why, because that usually means the requirement is not yet precise enough to publish.

## Running the conformance suite

Requires Node 22.6 or newer. There is nothing to install: the runner is plain JavaScript with zero dependencies.

```
cd conformance
npm test
npm run test:case eth_getTransactionReceipt/hex-strip-and-drop-service
```

`npm test` validates every case against the case schema and, when an adapter is configured, drives an implementation against them. `npm run test:case <method>/<name>` prints one case, what it pins and what it deliberately does not, which is the useful view while writing a new vector.

Point it at an implementation with an adapter, in any language:

```
TORPC_CMD='./my-encoder --conformance' npm test        # stdin job, stdout transformed response
TORPC_URL='https://rpc.example.com/eth/KEY' npm test   # replay against a live endpoint
```

Two things to know before you rely on it:

- The suite is **Scaffold v0.0.1** with a single case. It is not a coverage claim. See [`conformance/README.md`](./conformance/README.md) for what it does and does not assert, and [GOVERNANCE.md](./GOVERNANCE.md#torpc-conformant-certification) for the gate that has to be met before conformance can be certified.
- With no adapter configured the run validates the vectors and says plainly that no implementation was exercised. It never reports a conformance pass that did not happen.

When adding a vector, capture the raw response from a real node against a pinned block, keep the case minimal, and cite the specification section it pins in the `spec_section` field. The per-file schema is documented in `conformance/golden/README.md`.

## Style

- **Requirement keywords** in the specification are uppercase and used per RFC 2119 and RFC 8174: MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, OPTIONAL. Do not use them in lowercase for emphasis, and do not use them at all in non-normative sections.
- **Header names** exactly as the specification defines them: `Accept-Token-Tier` on the request, `Token-Tier` on the response. Where a deprecated alias has to be mentioned, mark it as deprecated and never present it as an option for new implementations.
- **Naming.** TORPC in prose and titles, `torpc` in paths, packages and identifiers. TORPC expands to "Token Optimized RPC", never anything else. The Ankr product is "Agent RPC" or "Ankr Agent RPC", always two words. TOON is a separate third-party format and is not a TORPC variant. See [TRADEMARKS.md](./TRADEMARKS.md).
- **Numbers.** Any measurement in the text carries its source and its date, and the same figure is never quoted from two different runs. If you cannot point at where a number came from, leave it out.
- **No em dashes** in prose. Commas, colons and periods do the job.
- Keep examples short, pinned to real data, and valid JSON.

## Code of conduct

Be straightforward and technical. Argue about the text, not about the person writing it. Maintainers may close threads and, for repeated behaviour, block accounts.

## Related documents

- [README.md](./README.md), repository overview
- [`specs/evm-v1.md`](./specs/evm-v1.md), the normative specification
- [GOVERNANCE.md](./GOVERNANCE.md), maintenance, versioning and certification
- [DECISIONS.md](./DECISIONS.md), the decision log
- [TRADEMARKS.md](./TRADEMARKS.md), permitted and reserved uses of the marks
- [SECURITY.md](./SECURITY.md), how to report a vulnerability
