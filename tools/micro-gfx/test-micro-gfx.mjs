/**
 * micro-gfx: URL round-trip and registry-drift checks.
 *
 * Run: node tools/micro-gfx/test-micro-gfx.mjs
 *
 * state.js is a real module with no DOM dependency, so it imports directly —
 * no scraping functions out of index.html.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MicroGfx } from '@whykusanagi/corrupted-theme/micro-gfx';
import { DEFAULTS, MAX_TEXT, encodeState, decodeState } from './state.js';

const HERE = dirname(fileURLToPath(import.meta.url));

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

// 5b. Empty-value params are skipped, not coerced. Number('') is 0, so an
//     unguarded `?seed=` would silently pin the artwork to seed 0.
{
  assert.deepEqual(decode(new URLSearchParams('seed=')), {});
  assert.deepEqual(decode(new URLSearchParams('warp=&erode=&grain=')), {});
}

// 5c. nsfw='0' must decode to false, not be dropped as invalid — an explicit
//     opt-out has to survive the round trip.
{
  assert.deepEqual(decode(new URLSearchParams('nsfw=0')), { nsfw: false });
  assert.equal(typeof decode(new URLSearchParams('nsfw=0')).nsfw, 'boolean');
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

  // 6a. Same drift check for the *other* tool. render-api.js's TOOLS comment
  //     claims both tables are asserted against their source pages — this is
  //     what makes that claim true for thumbnail (whose own test file,
  //     test-url-params.mjs, never references this table). Extracted from
  //     tools/thumbnail-generator/index.html's own ASPECT_RATIOS the same way
  //     test-url-params.mjs extracts its specs, so this can't drift from the
  //     page either.
  const thumbHtml = readFileSync(join(HERE, '../thumbnail-generator/index.html'), 'utf8');
  const aspectRatiosMatch = thumbHtml.match(/const ASPECT_RATIOS = \{[\s\S]*?\n {8}\};/);
  if (!aspectRatiosMatch) throw new Error('could not extract ASPECT_RATIOS from thumbnail-generator/index.html');
  const { ASPECT_RATIOS } = new Function(`${aspectRatiosMatch[0]}\nreturn { ASPECT_RATIOS };`)();
  const thumbRegistry = TOOLS.thumbnail.sizes;
  assert.deepEqual(
    Object.keys(thumbRegistry).sort(), Object.keys(ASPECT_RATIOS).sort(),
    'thumbnail registry must list exactly the page\'s aspect ratios',
  );
  for (const [key, dims] of Object.entries(ASPECT_RATIOS)) {
    assert.deepEqual(
      thumbRegistry[key], dims,
      `thumbnail registry size for "${key}" must match ASPECT_RATIOS`,
    );
  }

  // 6b. defaultSize / DEFAULTS.format coupling: encodeState omits `format`
  //     when it equals the default, so the API URL for a default-format
  //     state relies on these two agreeing. A divergence silently
  //     letterboxes that URL's render.
  assert.equal(
    TOOLS['micro-gfx'].defaultSize, DEFAULTS.format,
    'TOOLS[micro-gfx].defaultSize must equal DEFAULTS.format',
  );
  assert.ok(
    Object.hasOwn(MicroGfx.formats, DEFAULTS.format),
    'DEFAULTS.format must be a real MicroGfx format',
  );
  assert.ok(
    MicroGfx.themes.includes(DEFAULTS.theme),
    'DEFAULTS.theme must be a real MicroGfx theme',
  );

  // 6c. Ready-selector coupling: TOOLS[tool].ready is a body[data-*]
  //     attribute selector that waitForSelector polls for. If the page's own
  //     dataset write ever drifts from the registry's selector, the selector
  //     never appears — 55s hang, then a 502 on every uncached request. Tie
  //     each registry selector to the attribute its page actually sets.
  const assertReadySelectorMatchesPage = (toolName, htmlPath) => {
    const selector = TOOLS[toolName].ready;
    const m = selector.match(/^body\[data-([a-z0-9-]+)\]$/);
    assert.ok(m, `TOOLS[${toolName}].ready must be a body[data-*] selector, got "${selector}"`);
    const camel = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const html = readFileSync(htmlPath, 'utf8');
    assert.ok(
      // Requires an assignment (`=`), not just a mention, so a stray comment
      // referencing the old name can't make this pass vacuously after a rename.
      new RegExp(`dataset\\.${camel}\\s*=`).test(html),
      `${toolName}'s page must set document.body.dataset.${camel} to match registry selector "${selector}"`,
    );
  };
  assertReadySelectorMatchesPage('micro-gfx', join(HERE, 'index.html'));
  assertReadySelectorMatchesPage('thumbnail', join(HERE, '../thumbnail-generator/index.html'));
}

// 7. handleRender's target-building step (new URL(cfg.url) +
//    searchParams.append per caller param) is pure URL-building with no env
//    dependency, but has no test elsewhere because handleRender itself needs
//    a Worker runtime (env.BROWSER) to run. This mirrors that construction
//    rather than importing it, pinning the subtlest decision on the branch:
//    forwarding with .append() rather than .set(), so duplicate keys survive
//    and a caller cannot override a tool's baked-in query (e.g. embed=1).
{
  // Duplicate keys survive, in relative order, onto a no-query base — and
  // .get() (what both the page and handleRender's own size lookup read)
  // returns the first occurrence.
  const params = new URLSearchParams('aspectRatio=16:9&aspectRatio=9:16');
  const target = new URL('https://whykusanagi.xyz/tools/thumbnail-generator/index.html');
  for (const [k, v] of params) target.searchParams.append(k, v);
  assert.equal(target.searchParams.toString(), params.toString());
  assert.equal(target.searchParams.get('aspectRatio'), '16:9');

  // A caller cannot override a tool's baked-in query default: appending
  // embed=0 onto a base already carrying ?embed=1 leaves the baked-in
  // occurrence winning on .get().
  const overrideAttempt = new URLSearchParams('embed=0');
  const embedTarget = new URL('https://whykusanagi.xyz/tools/micro-gfx/index.html?embed=1');
  for (const [k, v] of overrideAttempt) embedTarget.searchParams.append(k, v);
  assert.equal(embedTarget.searchParams.get('embed'), '1');
}

console.log('✅ micro-gfx url round-trip + registry OK');
