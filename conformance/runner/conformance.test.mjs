/**
 * TORPC conformance suite.
 *
 * Two things run here:
 *
 *   1. Vector validation, always. Every case file must satisfy the case schema
 *      and be internally coherent (envelope preserved, tier 0 verbatim, the
 *      declared response header equal to the declared tier, coverage never
 *      implied). This is what CI enforces in the spec repository, where no
 *      implementation is present.
 *
 *   2. Implementation comparison, when an adapter is configured. Set TORPC_CMD
 *      or TORPC_URL (see runner/lib/adapters.mjs) and every eligible case is
 *      driven against that implementation and compared structurally.
 *
 * Without an adapter the suite reports that no implementation was exercised.
 * It does not silently pass as if one had been.
 */

import { test, describe, before } from 'node:test';
import { strict as assert } from 'node:assert';

import { listCases, loadCase, validateCase } from './lib/cases.mjs';
import { diff, formatDiff } from './lib/compare.mjs';
import { resolveAdapter, obtainActual } from './lib/adapters.mjs';

const adapter = resolveAdapter();
let cases = [];

before(async () => {
  cases = await listCases();
});

describe('vectors', () => {
  test('at least one case exists', async () => {
    const found = await listCases();
    assert.ok(found.length > 0, 'no case files found under golden/');
  });

  test('every case satisfies the case schema', async () => {
    const found = await listCases();
    const problems = [];
    for (const ref of found) {
      const c = await loadCase(ref.path);
      problems.push(...validateCase(c, `${ref.method}/${ref.name}`));
      if (c.case !== `${ref.method}/${ref.name}`) {
        problems.push(`${ref.method}/${ref.name}: case field does not match its path`);
      }
    }
    assert.equal(problems.length, 0, problems.length ? `\n${problems.join('\n')}` : '');
  });
});

describe('implementation', () => {
  test('adapter status', async () => {
    if (adapter.kind === 'none') {
      console.log(
        'No adapter configured, so no implementation was exercised. ' +
          'This run validated the vectors only. Set TORPC_CMD or TORPC_URL to check an implementation.',
      );
    } else {
      console.log(`Adapter: ${adapter.kind}`);
    }
    assert.ok(true);
  });

  if (adapter.kind !== 'none') {
    test('every eligible case matches the implementation', async (t) => {
      const found = await listCases();
      const failures = [];
      for (const ref of found) {
        const c = await loadCase(ref.path);
        if (adapter.kind === 'http' && c.live_capable !== true) {
          t.diagnostic(`skipped ${c.case} for the http adapter: ${c.live_capable_reason}`);
          continue;
        }
        for (const e of c.expect) {
          const actual = await obtainActual(adapter, c, e);
          if (actual.unsupportedTier !== undefined) {
            t.diagnostic(`${c.case}: implementation does not support tier ${e.tier}, expectation skipped`);
            continue;
          }
          const { response, tokenTier } = actual;
          const differences = diff(e.response, response, c.normalize ?? []);
          if (differences.length) {
            failures.push(`${c.case} tier ${e.tier}\n${formatDiff(differences)}`);
          }
          if (tokenTier !== null && tokenTier !== e.token_tier_header) {
            failures.push(`${c.case} tier ${e.tier}: Token-Tier header expected ${e.token_tier_header}, got ${tokenTier}`);
          }
        }
      }
      assert.equal(failures.length, 0, failures.length ? `\n${failures.join('\n\n')}` : '');
    });
  }
});
