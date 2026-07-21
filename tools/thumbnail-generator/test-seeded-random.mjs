/**
 * Checks the seeded-RNG install block in index.html: same seed reproduces the
 * same stream, different seeds diverge, and no seed leaves Math.random alone.
 *
 * The block is extracted from index.html rather than copied so it cannot drift.
 * Run: node tools/thumbnail-generator/test-seeded-random.mjs
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

const seedBlock = html.match(/const RENDER_SEED = \(\(\) => \{[\s\S]*?\n {8}\}\)\(\);/);
const installBlock = html.match(/if \(RENDER_SEED !== null\) \{\n {12}\/\/ mulberry32[\s\S]*?\n {8}\}/);
if (!seedBlock || !installBlock) throw new Error('could not extract seed blocks from index.html');

/** Runs the extracted blocks against a fake ?seed= and returns n randoms. */
function draw(search, n) {
  // Object.create so imul/etc are inherited (Math's methods are non-enumerable,
  // so a spread would drop them) while `random` is shadowed on the local copy —
  // the install block then patches our object, never the global Math.
  const localMath = Object.create(Math);
  localMath.random = Math.random;
  const fn = new Function(
    'window', 'URLSearchParams', 'Math', 'console',
    `${seedBlock[0]}\n${installBlock[0]}\n` +
      'return { seed: RENDER_SEED, draws: Array.from({length: ' + n + '}, () => Math.random()) };',
  );
  return fn({ location: { search } }, URLSearchParams, localMath, { log() {} });
}

// No seed -> RENDER_SEED is null and Math.random is untouched.
{
  const { seed } = draw('', 1);
  assert.equal(seed, null, 'absent seed must yield null');
  assert.equal(draw('?title=x', 1).seed, null, 'unrelated params must not seed');
  assert.equal(draw('?seed=', 1).seed, null, 'empty seed must yield null');
}

// Same seed -> identical stream. This is the property the whole feature rests on.
{
  const a = draw('?seed=42', 20).draws;
  const b = draw('?seed=42', 20).draws;
  assert.deepEqual(a, b, 'same seed must reproduce the same stream');
}

// Different seeds -> different streams.
{
  const a = draw('?seed=42', 20).draws;
  const b = draw('?seed=43', 20).draws;
  assert.notDeepEqual(a, b, 'different seeds must diverge');
}

// Non-numeric seeds are hashed, so ?seed=celeste is valid and stable.
{
  const a = draw('?seed=celeste', 10).draws;
  const b = draw('?seed=celeste', 10).draws;
  assert.deepEqual(a, b, 'string seeds must be stable');
  assert.notDeepEqual(a, draw('?seed=abyss', 10).draws, 'distinct strings must diverge');
}

// Output must be usable as a drop-in for Math.random: [0, 1) and not constant.
{
  const draws = draw('?seed=7', 500).draws;
  assert.ok(draws.every(v => v >= 0 && v < 1), 'all draws must be in [0, 1)');
  assert.ok(new Set(draws).size > 400, 'stream must not collapse to a few values');
}

console.log('✅ seeded random OK');
