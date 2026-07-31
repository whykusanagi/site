/**
 * micro-gfx: URL round-trip and registry-drift checks.
 *
 * Run: node tools/micro-gfx/test-micro-gfx.mjs
 *
 * state.js is a real module with no DOM dependency, so it imports directly —
 * no scraping functions out of index.html.
 */
import { strict as assert } from 'node:assert';
import { MicroGfx } from '@whykusanagi/corrupted-theme/micro-gfx';
import { DEFAULTS, MAX_TEXT, encodeState, decodeState } from './state.js';

const FORMATS = Object.keys(MicroGfx.formats);
const THEMES = MicroGfx.themes;
const decode = p => decodeState(p, FORMATS, THEMES);

// 1. Round-trip: every field set to a non-default survives encode -> decode
//    with its type intact.
{
  const s = {
    seed: 4242, format: 'poster', theme: 'void', polarity: 'paper',
    warp: 0.55, erode: 0.3, grain: 0.22,
    eyebrow: 'EYEBROW', title: 'TITLE', serial: 'SERIAL', nameplate: 'NAMEPLATE',
    nsfw: true,
  };
  const back = decode(encodeState(s));
  assert.deepEqual(back, s, 'full round-trip must preserve every field');
  assert.equal(typeof back.nsfw, 'boolean', 'booleans must survive as booleans');
  assert.equal(typeof back.warp, 'number', 'numbers must survive as numbers');
  assert.equal(typeof back.seed, 'number', 'seed must survive as a number');
}

// 2. Defaults are omitted so shared links stay short — but seed is always
//    emitted, because a link that re-rolls is not a link to the artwork.
{
  const p = encodeState({ ...DEFAULTS, seed: 7 });
  assert.equal(p.toString(), 'seed=7', 'only seed should be emitted for a default state');
}

// 3. Invalid values are dropped, leaving the page's defaults in place, rather
//    than throwing or reaching MicroGfx.generate.
{
  const p = new URLSearchParams({
    seed: 'abc', format: 'nope', theme: '<script>', polarity: 'sideways',
    warp: '99', erode: '-1', grain: 'NaN', nsfw: 'maybe',
  });
  assert.deepEqual(decode(p), {}, 'every invalid param must be dropped');
}

// 4. An out-of-range seed is rejected rather than wrapping silently.
{
  assert.deepEqual(decode(new URLSearchParams('seed=-1')), {});
  assert.deepEqual(decode(new URLSearchParams('seed=4294967296')), {});
  assert.deepEqual(decode(new URLSearchParams('seed=0')), { seed: 0 }, 'seed 0 is valid');
}

// 5. Text is length-capped at decode, so a hostile link cannot push a
//    megabyte of text into the SVG.
{
  const p = new URLSearchParams();
  p.set('title', 'x'.repeat(10000));
  assert.equal(decode(p).title.length, MAX_TEXT);
}

// 6. Registry drift: the size table in render-api.js must match the theme's
//    own format table. A mismatch produces letterboxed or cropped PNGs rather
//    than an error, so nothing else would catch it.
{
  const { TOOLS } = await import('../../src/lib/render-api.js');
  const registry = TOOLS['micro-gfx'].sizes;
  assert.deepEqual(
    Object.keys(registry).sort(), FORMATS.slice().sort(),
    'registry must list exactly the theme\'s formats',
  );
  for (const [name, { w, h }] of Object.entries(MicroGfx.formats)) {
    assert.deepEqual(
      registry[name], { width: w, height: h },
      `registry size for "${name}" must match MicroGfx.formats`,
    );
  }
}

console.log('✅ micro-gfx url round-trip + registry OK');
