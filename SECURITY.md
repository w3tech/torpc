# Security Policy

**Last updated:** 2026-07-27

## How to report

Use **GitHub private vulnerability reporting** on this repository: the **Security** tab, then **Report a vulnerability**. That opens a draft advisory visible only to the maintainers and to you.

**Do not open a public issue, pull request or discussion for an unfixed vulnerability**, and do not post one in a public chat channel.

There is no security email address for this repository, deliberately, so that reports land in one auditable place. If private reporting is not available to you for any reason, open a public issue that says only that you have a security report and asks a maintainer to contact you, with no technical detail in it, and a maintainer will open a private channel.

## What to include

- Which document and section, or which file and commit, the report concerns.
- The requirement or the code path being exploited.
- A concrete request and response pair, with headers, showing the behaviour.
- The impact: what an attacker gains, and what a victim loses.
- Whether this affects **every conforming implementation** (a defect in the specification) or **one implementation** (a defect in code). Say which you think it is, and say if you are unsure.

Reports about the specification are the most valuable ones we get, and they are also the easiest to dismiss by accident, so be explicit about the "every conforming implementation" case when that is what you mean.

## Scope

**In scope:**

- **The specification** in [`specs/`](./specs/), where the specified behaviour itself creates a vulnerability in an implementation that follows it correctly. A requirement that is unsafe, or a requirement that is missing and whose absence is unsafe, both count.
- **The conformance vectors and runner** in [`conformance/`](./conformance/), including a vector that pins unsafe output as correct.
- **The reference code** in `w3tech/torpc-js`, including the decoder and the rules library. Report it in whichever of the two repositories you prefer, both reach the same maintainers.

**Out of scope:**

- **The hosted Ankr RPC endpoint and every other Ankr production service.** This repository publishes a specification. It does not operate an endpoint, and the maintainers here are not the security contact for Ankr's production services. Report anything about a live Ankr endpoint, account, key, dashboard or API through the security reporting route Ankr publishes for its production services at <https://www.ankr.com>. If a hosted-service report arrives here, we will ask you to refile it there, and we may forward it internally as a courtesy, but this repository carries no response commitment for it.
- Anything about a third-party implementation of the specification. Report it to whoever ships it. Tell us as well if the root cause turns out to be our text.

**Not security issues.** Use a normal issue for these: token savings lower than you expected, a method that has no mapping yet, a disagreement about benchmark methodology, missing conformance coverage, or a tier that does not compress as much as you hoped.

## Specification-level classes we treat as security relevant

These are the failure classes we actively want reports about. The common shape is an agent that trusts a declared property of a response and gets something else.

**Cache poisoning.** A response transformed under one set of request headers, served from a shared cache to a client that sent different headers, or none. The specification requires a server to emit a `Vary` header listing every request header that influences the transform, and to do so unconditionally on every response from the endpoint, not only when a client opted in. The unconditional part matters: a response to a request that did not opt in, cached without `Vary`, is exactly the poisoning case. Reports about a missing, incomplete or conditionally emitted `Vary` are in scope. See [`specs/evm-v1.md`](./specs/evm-v1.md).

**Tier confusion.** A client parses a payload at a tier the payload is not in. This includes:

- a batch response where an individual element is transformed above the tier the response header declares. The response `Token-Tier` header carries the **minimum** applied tier across the batch, and no element may be transformed above the tier declared in that header. A violation makes a header-trusting client mis-parse that element.
- a server returning a tier higher than the client requested.
- a missing response tier header on a transformed response, which a correct client reads as raw.
- a deprecated header alias resolving to a different tier than the canonical header would.

**Declared-versus-actual mismatch generally.** Any path where the headers describe one thing and the body is another, including partial transforms, a transform aborted midway, and a downgrade that is not reflected in the response header.

**Semantic corruption.** A mapping that changes meaning while looking valid: lost precision or a lost unit, truncation with no marker that truncation happened, or a decode presented as authoritative when the source of the decode was not trustworthy for that contract.

**Injection through decoded content.** On-chain data is attacker-controlled. A mapping that lifts decoded strings, names, symbols or labels into a position where a consuming agent treats them as instructions, identifiers or trusted metadata is a specification-level defect, not just an implementation bug.

## What happens next

- **Acknowledgement** within 5 business days.
- **An assessment and a plan** within 15 business days: whether we agree it is a vulnerability, whether it is specification-level or code-level, and what the fix looks like.
- **Fixing a specification issue** means a new specification version under the process in [GOVERNANCE.md](./GOVERNANCE.md), and, where the required behaviour changed, a golden vector that pins the safe behaviour. There is no in-place edit of published text.
- **Disclosure is coordinated.** We prefer to publish once a fix is available. Where the fix needs implementers to act, we publish a note describing the risk and the mitigation at the same time, because a specification fix does nothing until deployments follow it. Default window is 90 days from acknowledgement, shorter if the issue is already public or being exploited, longer only by agreement with you.
- **Credit.** Reporters are credited in the advisory and in the [DECISIONS.md](./DECISIONS.md) entry unless they ask not to be.
- **No bug bounty** for this repository. Nothing here is a paid programme, and the scope statement above is not an authorisation to test any live service.

## Related documents

- [README.md](./README.md), repository overview
- [`specs/evm-v1.md`](./specs/evm-v1.md), the normative specification
- [`conformance/README.md`](./conformance/README.md), the vectors and how to run them
- [GOVERNANCE.md](./GOVERNANCE.md), maintenance, versioning and certification
- [CONTRIBUTING.md](./CONTRIBUTING.md), contribution terms and DCO sign-off
- [TRADEMARKS.md](./TRADEMARKS.md), permitted and reserved uses of the marks
