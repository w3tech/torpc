/**
 * Structural comparison for conformance cases.
 *
 * The spec (evm-v1.md, Behavior rule 6) makes structural equivalence the
 * cross-server contract: the same field set and the same transformed values.
 * Byte layout is explicitly not normative, because JSON serializers do not
 * agree on key order. So this comparison ignores object key order and compares
 * values type-strictly: a numeric emitted as a JSON number where the spec
 * mandates a decimal string is a failure, not a formatting difference.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Apply the case's declared normalisations to a leaf value. */
function normalizeLeaf(value, normalize) {
  if (typeof value === 'string' && normalize.includes('address-case') && ADDRESS_RE.test(value)) {
    return value.toLowerCase();
  }
  return value;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Deep-compare expected against actual, collecting every difference.
 * Returns an array of { path, expected, actual, reason }.
 */
export function diff(expected, actual, normalize = [], path = '$') {
  const out = [];
  const te = typeOf(expected);
  const ta = typeOf(actual);

  if (te !== ta) {
    out.push({ path, expected, actual, reason: `type mismatch: expected ${te}, got ${ta}` });
    return out;
  }

  if (te === 'object') {
    const ke = Object.keys(expected).sort();
    const ka = Object.keys(actual).sort();
    for (const k of ke) {
      if (!ka.includes(k)) {
        out.push({ path: `${path}.${k}`, expected: expected[k], actual: undefined, reason: 'field missing from actual' });
      }
    }
    for (const k of ka) {
      if (!ke.includes(k)) {
        out.push({ path: `${path}.${k}`, expected: undefined, actual: actual[k], reason: 'unexpected field in actual' });
      }
    }
    for (const k of ke) {
      if (ka.includes(k)) out.push(...diff(expected[k], actual[k], normalize, `${path}.${k}`));
    }
    return out;
  }

  if (te === 'array') {
    if (expected.length !== actual.length) {
      out.push({ path, expected: expected.length, actual: actual.length, reason: 'array length mismatch (element order is significant)' });
    }
    const n = Math.min(expected.length, actual.length);
    for (let i = 0; i < n; i++) out.push(...diff(expected[i], actual[i], normalize, `${path}[${i}]`));
    return out;
  }

  const ne = normalizeLeaf(expected, normalize);
  const na = normalizeLeaf(actual, normalize);
  if (ne !== na) {
    out.push({ path, expected: ne, actual: na, reason: 'value mismatch' });
  }
  return out;
}

/** Render a diff list as a readable multi-line report. */
export function formatDiff(differences) {
  return differences
    .map((d) => {
      const e = JSON.stringify(d.expected);
      const a = JSON.stringify(d.actual);
      return `  ${d.path}\n    ${d.reason}\n    expected: ${e}\n    actual:   ${a}`;
    })
    .join('\n');
}
