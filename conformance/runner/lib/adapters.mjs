/**
 * Adapters: how an implementation under test is driven.
 *
 * The runner ships no transform of its own. It asks an implementation for the
 * transformed response and compares that against the case. Two adapters cover
 * the realistic shapes, and neither is language-specific:
 *
 *   TORPC_CMD  a command that reads a JSON job on stdin and writes the
 *              transformed JSON-RPC response on stdout, or {"unsupported_tier": N}
 *              when it does not implement that tier. Works for a Go binary,
 *              a Rust binary, a Node script, anything runnable.
 *
 *   TORPC_URL  a live TORPC endpoint. The runner replays the case request with
 *              Accept-Token-Tier and reads the response plus its Token-Tier
 *              header. Only cases with live_capable true are eligible.
 *
 * With neither set, the runner validates the vectors and reports that no
 * implementation was exercised. That is a meaningful CI run for a spec
 * repository, and it never pretends to be a conformance pass.
 */

import { spawn } from 'node:child_process';

export function resolveAdapter(env = process.env) {
  if (env.TORPC_CMD) return { kind: 'cmd', cmd: env.TORPC_CMD };
  if (env.TORPC_URL) return { kind: 'http', url: env.TORPC_URL, header: env.TORPC_TIER_HEADER || 'Accept-Token-Tier' };
  return { kind: 'none' };
}

/**
 * Run the command adapter for one tier.
 * stdin:  {"tier": N, "request": {...}, "raw_response": {...}}
 * stdout: either the transformed JSON-RPC response object, or
 *         {"response": {...}, "token_tier": "N"} when the implementation wants
 *         to report the tier it actually applied.
 */
export function runCmd(cmd, job) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`adapter command exited ${code}\nstderr:\n${err.trim()}`));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(out);
      } catch {
        reject(new Error(`adapter stdout is not JSON:\n${out.slice(0, 500)}`));
        return;
      }
      if (parsed && typeof parsed === 'object' && 'unsupported_tier' in parsed) {
        resolvePromise({ unsupportedTier: Number(parsed.unsupported_tier) });
      } else if (parsed && typeof parsed === 'object' && 'response' in parsed) {
        resolvePromise({ response: parsed.response, tokenTier: parsed.token_tier ?? null });
      } else {
        resolvePromise({ response: parsed, tokenTier: null });
      }
    });
    child.stdin.end(JSON.stringify(job));
  });
}

/** Replay the case request against a live endpoint at one tier. */
export async function runHttp(url, header, tier, request) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [header]: String(tier) },
    body: JSON.stringify(request),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`endpoint returned non-JSON (HTTP ${res.status}):\n${text.slice(0, 500)}`);
  }
  return { response: body, tokenTier: res.headers.get('token-tier') };
}

export async function obtainActual(adapter, c, expectation) {
  if (adapter.kind === 'cmd') {
    return runCmd(adapter.cmd, { tier: expectation.tier, request: c.request, raw_response: c.raw_response });
  }
  if (adapter.kind === 'http') {
    return runHttp(adapter.url, adapter.header, expectation.tier, c.request);
  }
  throw new Error('no adapter configured');
}
