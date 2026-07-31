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
