/**
 * Round-trip check for the URL <-> nested-state bridge in index.html.
 *
 * Pulls the specs and the two pure functions straight out of index.html so the
 * test cannot drift from the source. Run: node tools/thumbnail-generator/test-url-params.mjs
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

/** Extracts a top-level `const NAME = [...];` or `function NAME(...) {...}` block. */
function extract(pattern) {
  const m = html.match(pattern);
  if (!m) throw new Error(`could not extract ${pattern}`);
  return m[0];
}

const src = [
  extract(/const WARNING_URL_SPEC = \[[\s\S]*?\n {8}\];/),
  extract(/const LEWD_URL_SPEC = \[[\s\S]*?\n {8}\];/),
  extract(/function parseGroupParams\([\s\S]*?\n {8}\}/),
  extract(/function encodeGroupParams\([\s\S]*?\n {8}\}/),
  'return { WARNING_URL_SPEC, LEWD_URL_SPEC, parseGroupParams, encodeGroupParams };',
].join('\n');

const { WARNING_URL_SPEC, LEWD_URL_SPEC, parseGroupParams, encodeGroupParams } =
  new Function(src)();

// A disabled group emits nothing — both groups default to enabled:false.
{
  const p = new URLSearchParams();
  encodeGroupParams(p, WARNING_URL_SPEC, { enabled: false, topBanner: 'IGNORED' });
  assert.equal(p.toString(), '', 'disabled group must emit no params');
}

// Absent params decode to undefined, so loadState() leaves defaults alone.
assert.equal(parseGroupParams(new URLSearchParams('title=x'), WARNING_URL_SPEC), undefined);
assert.equal(parseGroupParams(new URLSearchParams(''), LEWD_URL_SPEC), undefined);

// Full round-trip: encode -> decode returns the original values and types.
{
  const warn = {
    enabled: true, topBanner: 'DANGER ZONE', bossName: 'CELESTE AI',
    bottomBanner: 'ABYSS BREACH', colorTheme: 'cyan',
  };
  const p = new URLSearchParams();
  encodeGroupParams(p, WARNING_URL_SPEC, warn);
  assert.deepEqual(parseGroupParams(p, WARNING_URL_SPEC), warn);
}
{
  const lewd = {
    enabled: true, nsfw: false, showPhrases: true, glow: false,
    colorPreset: 'dual', fontSize: 32, inset: 24, cornerRadius: 36,
  };
  const p = new URLSearchParams();
  encodeGroupParams(p, LEWD_URL_SPEC, lewd);
  const back = parseGroupParams(p, LEWD_URL_SPEC);
  assert.deepEqual(back, lewd);
  // Types matter: loadState() gates on typeof boolean / Number.isFinite.
  assert.equal(typeof back.nsfw, 'boolean', 'booleans must survive as booleans');
  assert.equal(typeof back.fontSize, 'number', 'numbers must survive as numbers');
}

// nsfw/showPhrases/glow default to true — an explicit opt-out must survive.
{
  const p = new URLSearchParams();
  encodeGroupParams(p, LEWD_URL_SPEC, { enabled: true, nsfw: false, glow: false });
  assert.equal(p.get('lewdNsfw'), '0');
  assert.equal(parseGroupParams(p, LEWD_URL_SPEC).nsfw, false, 'false must not be dropped');
}

// Garbage numbers are dropped rather than becoming NaN.
assert.equal(
  parseGroupParams(new URLSearchParams('lewdEnabled=1&lewdFontSize=abc'), LEWD_URL_SPEC).fontSize,
  undefined,
);

console.log('✅ url param round-trip OK');
