# Trademarks

**Marks owner:** Web3 Technologies, Inc. (dba Ankr) ("Ankr")
**Last updated:** 2026-07-27

## CC0 and trademarks

Everything in this repository is dedicated to the public domain under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). CC0 dedicates copyright and related rights. CC0 section 4(a) states expressly that trademark and patent rights are not licensed, waived or otherwise affected by the dedication.

So the text of the specification is free for anyone to copy, modify, republish and implement, and none of that transfers any right in the names. The patent position is carried by the Apache-2.0 licence on the reference implementation, which has an express patent grant. This document covers the names.

## The marks

"TORPC" and "Ankr" are marks of Web3 Technologies, Inc. (dba Ankr).

Correct usage of the TORPC mark:

- **TORPC** in prose, headings and titles. Always all caps.
- **torpc** in repository names, package names, URLs and code identifiers. Lowercase in those positions is correct and is not a misuse of the mark.
- TORPC expands to **"Token Optimized RPC"**. Do not expand it any other way.

Not our marks, and out of scope for this document:

- **TOON** ("Token-Oriented Object Notation") is a separate, third-party format published at <https://github.com/toon-format/toon>. It is referenced in this repository for comparison only. It is not a TORPC name, not a TORPC variant, and nothing here grants or restricts anything in relation to it.
- **Agent RPC** and **Ankr Agent RPC** name an Ankr product, not this specification. The product name is always two words. Do not write it as one word.

## What you may do, with no permission needed

You do not need a licence, a signature or a conversation with anyone at Ankr to do any of the following:

- Implement the specification, in whole or in part, in any language, for any purpose, commercial or not.
- Fork, republish, translate or extend the specification text. It is CC0.
- State truthfully that your product, library, proxy or endpoint **"implements TORPC"**, is **"TORPC compatible"**, **"supports TORPC tier 1"**, **"speaks TORPC"** or is **"based on the TORPC specification"**.
- Use the word TORPC in documentation, comparison tables, blog posts, talks, academic papers and marketing copy to refer to this specification, including where you are describing a competing product.
- Use `torpc` descriptively inside your own package or repository name where the relationship it describes is true, for example `torpc-decoder-rust` or `myproxy-torpc-adapter`.

The condition on all of the above is that the statement is accurate and does not suggest that Ankr publishes, sponsors, endorses, reviews or supports your implementation.

## What is reserved

**The `@torpc` npm scope and the `w3tech/torpc*` repositories** are controlled by the maintainers. Do not publish under that scope.

**"TORPC Conformant"** is a reserved designation. It may be used only by an implementation that both:

1. passes the published conformance vectors in [`conformance/`](./conformance/) at the tiers it claims, and
2. is listed as conformant by the maintainers.

Both conditions are required. Passing the vectors privately is not enough, and being listed without passing is not a state that can occur. The process, the current status of the conformance suite and the gate for opening certification are all in [GOVERNANCE.md](./GOVERNANCE.md#torpc-conformant-certification). At the time of writing the suite is a scaffold, certification is not open, and nobody may use the designation, Ankr included.

**Divergent forks may not be called TORPC.** If you change the wire behaviour so that your implementation no longer follows the published specification, you must not present the result as TORPC, as a version of TORPC, or under a name built from the mark such as TORPC 2, TORPC Plus, TORPC Pro or OurCo TORPC. Pick your own name. You may still say, accurately, "derived from the TORPC specification" or "a fork of TORPC, not wire compatible with it". The specification text is public domain and you are free to build on it. What you may not do is keep the name while changing the behaviour it identifies.

**Do not use the marks as identity.** Do not use TORPC or Ankr, or anything confusingly similar, as or within your company name, product name, logo, app-store listing, domain name or social-media handle. Do not use Ankr's logos or visual identity at all. Do not register the marks, or marks confusingly similar to them, anywhere.

**Do not modify the marks.** No hyphenation, no internal spacing, no possessive form, no mixed casing beyond the two correct forms above.

## Why the marks are held back

Because the specification is public domain, the mark is the only mechanism that keeps the name attached to the published behaviour. The failure mode being guarded against is a shipped product that calls itself TORPC, behaves differently on the wire, and makes "TORPC" mean whatever the largest shipper says it means. Agents that trust the tier declared in a response are the parties harmed by that, so the defence is narrow and behavioural: implement it any way you like, say so freely, and the name plus the conformant designation stay tied to the vectors.

## Reporting misuse, and asking

If you are unsure whether a specific use is permitted, open an issue on this repository and ask before shipping. If you believe someone is misusing the marks, open an issue or contact the maintainers through the path in [GOVERNANCE.md](./GOVERNANCE.md).

**This document is not legal advice**, and it is not an exhaustive statement of Ankr's rights. Nothing in it waives any right not expressly addressed.

## Related documents

- [README.md](./README.md), repository overview
- [`specs/evm-v1.md`](./specs/evm-v1.md), the normative specification
- [`conformance/README.md`](./conformance/README.md), the conformance vectors and how to run them
- [GOVERNANCE.md](./GOVERNANCE.md), maintenance, versioning and the certification process
- [CONTRIBUTING.md](./CONTRIBUTING.md), contribution terms and DCO sign-off
- [SECURITY.md](./SECURITY.md), how to report a vulnerability
