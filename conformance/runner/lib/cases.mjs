/**
 * Case discovery and schema validation.
 *
 * A conformance case is a JSON file under golden/<method>/<name>.json that
 * carries a raw JSON-RPC response and the exact response a conforming server
 * returns at each declared tier. Nothing about our own implementation appears
 * in it, which is the point: any implementation in any language can be driven
 * against these files through an adapter.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GOLDEN_DIR = resolve(HERE, '..', '..', 'golden');

const KNOWN_NORMALIZERS = ['address-case'];

/** List every case file, as { method, name, path }. */
export async function listCases() {
  const out = [];
  const methods = await readdir(GOLDEN_DIR, { withFileTypes: true });
  for (const m of methods) {
    if (!m.isDirectory()) continue;
    const files = await readdir(join(GOLDEN_DIR, m.name));
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      out.push({ method: m.name, name: f.replace(/\.json$/, ''), path: join(GOLDEN_DIR, m.name, f) });
    }
  }
  return out.sort((a, b) => `${a.method}/${a.name}`.localeCompare(`${b.method}/${b.name}`));
}

export async function loadCase(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

/**
 * Validate one case against the case schema. Returns an array of problem
 * strings; empty means valid. This runs in CI even with no implementation
 * configured, so a malformed or self-contradictory vector cannot land.
 */
export function validateCase(c, ref) {
  const p = [];
  const req = (cond, msg) => { if (!cond) p.push(`${ref}: ${msg}`); };

  req(c.case_version === 1, 'case_version must be 1');
  req(typeof c.case === 'string' && c.case.length > 0, 'case must be a non-empty string');
  req(typeof c.description === 'string' && c.description.length > 0, 'description must be a non-empty string');
  req(c.spec && typeof c.spec.document === 'string', 'spec.document must name the normative document');
  req(Array.isArray(c.spec?.sections) && c.spec.sections.length > 0, 'spec.sections must list at least one section');
  req(typeof c.method === 'string' && c.method.startsWith('eth_'), 'method must be a JSON-RPC method name');
  req(Array.isArray(c.asserts) && c.asserts.length > 0, 'asserts must list what the case pins');
  req(Array.isArray(c.not_asserted), 'not_asserted must be present, even if empty, so coverage is never implied');
  req(typeof c.live_capable === 'boolean', 'live_capable must be a boolean');
  if (c.live_capable === false) {
    req(typeof c.live_capable_reason === 'string' && c.live_capable_reason.length > 0,
      'live_capable false requires live_capable_reason');
  }

  for (const n of c.normalize ?? []) {
    req(KNOWN_NORMALIZERS.includes(n), `unknown normalizer "${n}" (known: ${KNOWN_NORMALIZERS.join(', ')})`);
  }

  // Request and raw response must be a coherent JSON-RPC pair.
  req(c.request?.jsonrpc === '2.0', 'request.jsonrpc must be "2.0"');
  req(c.request?.method === c.method, 'request.method must equal the case method');
  req(c.raw_response?.jsonrpc === '2.0', 'raw_response.jsonrpc must be "2.0"');
  req(c.raw_response?.id === c.request?.id, 'raw_response.id must match request.id');
  req('result' in (c.raw_response ?? {}) || 'error' in (c.raw_response ?? {}),
    'raw_response must carry result or error');

  req(Array.isArray(c.expect) && c.expect.length > 0, 'expect must list at least one tier expectation');
  const tiers = new Set();
  for (const [i, e] of (c.expect ?? []).entries()) {
    const at = `${ref} expect[${i}]`;
    if (!Number.isInteger(e.tier) || e.tier < 0 || e.tier > 5) p.push(`${at}: tier must be an integer in 0..5`);
    if (tiers.has(e.tier)) p.push(`${at}: duplicate expectation for tier ${e.tier}`);
    tiers.add(e.tier);
    if (e.token_tier_header !== String(e.tier)) {
      p.push(`${at}: token_tier_header must be the string form of tier (spec: the response header is the applied tier)`);
    }
    if (e.response?.jsonrpc !== '2.0') p.push(`${at}: response.jsonrpc must be "2.0"`);
    if (e.response?.id !== c.request?.id) p.push(`${at}: response.id must match request.id (the envelope is preserved)`);
    if (e.tier === 0) {
      const same = JSON.stringify(e.response) === JSON.stringify(c.raw_response);
      if (!same) p.push(`${at}: tier 0 must be the raw response verbatim`);
    }
  }
  return p;
}
