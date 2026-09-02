/**
 * models.js — the outfits you can swap between on the stage.
 *
 * ## Why these load lazily
 *
 * Each model is ~36 MiB. Fetching all three up front would be 108 MiB before
 * the page draws anything, which would undo the entire point of deduping them
 * in the first place. So only the default is fetched on load; the others are
 * fetched the first time someone picks them, and the previous model is
 * disposed on the way out.
 *
 * That last part is why CelesteStage.dispose() had to become real. Before this
 * feature the page was a single full-page load with exactly one model, and
 * teardown was dead code worth deleting. Swapping creates the lifecycle that
 * makes it load-bearing: without disposal each swap strands a full model's
 * geometry, materials and textures on the GPU, on a page that was already at
 * the VRAM limit.
 *
 * ## Wardrobe blendshapes are NOT portable between these
 *
 * The face half of POSE_EXPRESSIONS travels fine - Smug, Teasing, Blush,
 * Heart Pupils, Sparkle and Surprised exist on all three, and happy/relaxed
 * are VRM 0.x presets (joy/fun) all three carry.
 *
 * The wardrobe half does not. `Skirt OFF` exists only on the default model;
 * bodycon and bunny have their own shapes (Nude, Hide Thong, Hide Heels,
 * Tanlines...). Three poses set `Skirt OFF`, so on the other two models it
 * simply does not apply - which is correct, not a bug. There is no skirt on a
 * bunny suit. _setPoseExpressions warns once per missing shape rather than
 * once per pose change, so browsing five sections does not print five warnings
 * about the same absent shape.
 */

/**
 * Resolved lazily rather than at module load, so this file can be imported in
 * Node and its logic tested for real. A top-level `window.location` read would
 * make the whole module unimportable outside a browser and push its tests back
 * to asserting on source text, which is what the audit criticised elsewhere.
 */
function base() {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  return ['localhost', '127.0.0.1'].includes(host)
    ? '/models/'
    : 'https://s3.whykusanagi.xyz/models/';
}

/**
 * `key` is what gets persisted, so renaming one silently resets a visitor's
 * choice. `label` is what they read.
 */
export const MODELS = {
  queen: {
    label: 'Corrupted Queen',
    file: 'CorruptedQueenCelestePhairWetB.vrm',
  },
  bodycon: {
    label: 'Bodycon',
    file: 'CelesteBodyconPhairWetB.vrm',
  },
  bunny: {
    label: 'Bunny',
    file: 'CelesteBunnyGirlPhairWetB.vrm',
  },
};

/** The one fetched on load. Every other model is opt-in. */
export const DEFAULT_MODEL = 'queen';

export const modelKeys = () => Object.keys(MODELS);

/**
 * A key we still recognise, or the default.
 *
 * Object.hasOwn, not truthiness: `MODELS['__proto__']` returns
 * Object.prototype, which is truthy, so a bare `MODELS[key]` check lets
 * '__proto__', 'constructor' and 'toString' through as if they were models -
 * and modelUrl then builds `/models/undefined`. This value comes out of
 * localStorage, where it survives deploys and can be edited by hand, so it is
 * genuinely untrusted input.
 */
export const normalizeModel = (key) =>
  (typeof key === 'string' && Object.hasOwn(MODELS, key) ? key : DEFAULT_MODEL);

export function modelUrl(key) {
  return base() + MODELS[normalizeModel(key)].file;
}

export const modelLabel = (key) => MODELS[normalizeModel(key)].label;
