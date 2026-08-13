#!/usr/bin/env node
/**
 * Run one case against a configured implementation and print the diff.
 *
 * Usage:
 *   TORPC_CMD='./my-encoder' node runner/run-case.mjs eth_getTransactionReceipt/hex-strip-and-drop-service
 *   TORPC_URL='https://rpc.example.com/eth/KEY' node runner/run-case.mjs <case>
 *
 * With no adapter configured it prints the case summary and what it pins, which
 * is the useful view when authoring a new vector.
 */

import { resolve } from 'node:path';
import { listCases, loadCase, validateCase, GOLDEN_DIR } from './lib/cases.mjs';
import { diff, formatDiff } from './lib/compare.mjs';
import { resolveAdapter, obtainActual } from './lib/adapters.mjs';

const arg = process.argv[2];
if (!arg) {
  const all = await listCases();
  console.error('Usage: node runner/run-case.mjs <method>/<name>\n\nAvailable cases:');
  for (const c of all) console.error(`  ${c.method}/${c.name}`);
  process.exit(2);
}

const [method, name] = arg.split('/');
if (!method || !name) {
  console.error('Argument must be <method>/<name>');
  process.exit(2);
}

const path = resolve(GOLDEN_DIR, method, `${name}.json`);
const c = await loadCase(path);

const problems = validateCase(c, arg);
if (problems.length) {
  console.error('Case does not satisfy the schema:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(`Case:    ${c.case}`);
console.log(`Spec:    ${c.spec.document} ${c.spec.sections.join(', ')}`);
console.log(`Method:  ${c.method}`);
console.log(`Tiers:   ${c.expect.map((e) => e.tier).join(', ')}`);
console.log(`Pins:\n${c.asserts.map((a) => `  - ${a}`).join('\n')}`);
if (c.not_asserted.length) {
  console.log(`Not asserted:\n${c.not_asserted.map((a) => `  - ${a}`).join('\n')}`);
}

const adapter = resolveAdapter();
if (adapter.kind === 'none') {
  console.log('\nNo adapter configured (set TORPC_CMD or TORPC_URL), so nothing was compared.');
  process.exit(0);
}
if (adapter.kind === 'http' && c.live_capable !== true) {
  console.log(`\nThis case cannot run against a live endpoint: ${c.live_capable_reason}`);
  process.exit(0);
}

let failed = false;
for (const e of c.expect) {
  const { response, tokenTier } = await obtainActual(adapter, c, e);
  const differences = diff(e.response, response, c.normalize ?? []);
  const headerOk = tokenTier === null || tokenTier === e.token_tier_header;
  if (differences.length === 0 && headerOk) {
    console.log(`\ntier ${e.tier}: PASS`);
  } else {
    failed = true;
    console.log(`\ntier ${e.tier}: FAIL`);
    if (!headerOk) console.log(`  Token-Tier header expected ${e.token_tier_header}, got ${tokenTier}`);
    if (differences.length) console.log(formatDiff(differences));
  }
}
process.exit(failed ? 1 : 0);
