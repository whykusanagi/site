/**
 * micro-gfx tool — state model and URL bridge.
 *
 * Pure: no DOM, no imports. Kept out of index.html so it can be unit-tested in
 * Node directly rather than scraped out of the page source.
 */

/**
 * Every knob except `seed`, which has no default — it is always emitted, since
 * a shared link that re-rolls is not a link to the artwork.
 *
 * `serial: ''` is the sentinel for "derive it": the page renders `SEED <n>` when
 * the field is empty, so the serial tracks the seed unless you override it.
 */
export const DEFAULTS = {
  format: 'card',
  theme: 'magenta',
  polarity: 'seeded',
  warp: 0.2,
  erode: 0,
  grain: 0.06,
  eyebrow: 'CORRUPTED // INSTRUMENT SERIES',
  title: 'SIGNAL DECAY',
  serial: '',
  nameplate: 'whykusanagi',
  nsfw: false,
};

/** 'seeded' is the page's word for "let the seed choose" — it maps to undefined. */
export const POLARITIES = ['seeded', 'dark', 'paper'];

/** Inclusive [min, max] for each float knob, matching the slider ranges. */
export const NUM_RANGES = {
  warp:  [0, 1],
  erode: [0, 1],
  grain: [0, 0.4],
};

export const TEXT_KEYS = ['eyebrow', 'title', 'serial', 'nameplate'];

/** Caller text is capped before it reaches MicroGfx.generate. */
export const MAX_TEXT = 256;

/**
 * State -> URL. Omits anything at its default so a shared link is short, but
 * always emits `seed`: a link that re-rolls is not a link to the artwork.
 */
export function encodeState(state) {
  const p = new URLSearchParams();
  p.set('seed', String(state.seed >>> 0));
  for (const k of Object.keys(DEFAULTS)) {
    const v = state[k];
    if (v === DEFAULTS[k]) continue;
    p.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return p;
}

/**
 * URL -> partial state. Returns only the keys that were present AND valid, so
 * the caller can spread it over DEFAULTS and have anything invalid or missing
 * fall back rather than reaching MicroGfx.generate.
 *
 * `formats` and `themes` are passed in rather than imported so this module
 * stays free of theme dependencies and testable on its own.
 */
export function decodeState(params, formats, themes) {
  const out = {};

  const rawSeed = params.get('seed');
  if (rawSeed !== null && rawSeed.trim() !== '') {
    const n = Number(rawSeed);
    if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) out.seed = n;
  }

  const format = params.get('format');
  if (formats.includes(format)) out.format = format;

  const theme = params.get('theme');
  if (themes.includes(theme)) out.theme = theme;

  const polarity = params.get('polarity');
  if (POLARITIES.includes(polarity)) out.polarity = polarity;

  for (const [k, [lo, hi]] of Object.entries(NUM_RANGES)) {
    const raw = params.get(k);
    if (raw === null || raw.trim() === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= lo && n <= hi) out[k] = n;
  }

  for (const k of TEXT_KEYS) {
    const raw = params.get(k);
    if (raw !== null) out[k] = raw.slice(0, MAX_TEXT);
  }

  const nsfw = params.get('nsfw');
  if (nsfw === '1' || nsfw === '0') out.nsfw = nsfw === '1';

  return out;
}
