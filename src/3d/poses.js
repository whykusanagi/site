/**
 * poses.js — one record per pose. The single place a pose is described.
 *
 * ## Why this file exists
 *
 * These fields used to be five sibling object literals in celeste-stage.js
 * plus a sixth table in caution-bands.js. Adding one pose meant editing eight
 * places across three files, and two of those failed *silently* when missed:
 * a pose absent from the clip table fell back to idle with no warning, and a
 * section beyond the end of the band table silently reused the last row.
 *
 * Worse, the tables used two different coordinate systems. The POSE_* tables
 * were keyed by pose NAME; the band layouts were indexed by section ORDINAL.
 * Nothing joined them but DOM order, so reordering two sections moved their
 * poses and not their tape, and a sixth section inherited the fifth's.
 *
 * One record per pose deletes the ordinal system outright, and
 * scripts/poses.test.mjs turns all three silent failures into red CI.
 *
 * ## Fields
 *
 *   clip         REQUIRED. Filename under assets/animations/poses/.
 *   expressions  Blendshape weights: face AND wardrobe, same channel.
 *   root         Extra root rotation in degrees, composed onto the model's
 *                baseline - never replacing it. Omit for none.
 *   camera       Partial. Merged over the default framing, so a pose can set
 *                just the one value it cares about.
 *   wind         Spring-bone gravity direction + power. Omit for none.
 *   bands        One entry per caution band, as height offsets from whatever
 *                the camera is looking at, plus tilt and yaw.
 *
 * Only `clip` is required. Everything else falls back to a sane default, so a
 * new pose can start as a one-line record and be tuned in the ?dev=1 panel.
 *
 * ## Tuning
 *
 * root, camera, wind and expressions are all tuned by eye in the dev panel and
 * dumped from it - they are not derived. Reasoning about the root axes in
 * particular is unreliable: they compose onto a baseline that already carries
 * rotateVRM0's 180-degree Y flip, so screen-space intuition misleads.
 *
 * Expression weights interact rather than compose independently. Blush carries
 * an eyelid component and closes the eyes past ~0.45; Smug narrows the lids;
 * Menace widens them but blanks the iris above ~0.4. Freeze idle blinking
 * (idleLife.reducedMotion = true) before judging any of it, or a blink caught
 * mid-frame reads exactly like a bad weight.
 *
 * Never set blink / blinkLeft / blinkRight here - idle-life.js drives those
 * every frame and would overwrite them.
 */

/** Framing used by any pose that does not override it. */
export const CAMERA_DEFAULTS = { lookY: 1.20, dist: 3.50, elevation: 12 };

/** Spring-bone wind for any pose that does not ask for one. */
export const WIND_DEFAULT = { dir: [0, -1, 0], power: 0 };

/** Root rotation for any pose that does not ask for one. */
export const ROOT_DEFAULT = { x: 0, y: 0, z: 0 };

/** Band placement for a pose with no `bands` of its own. */
export const BANDS_DEFAULT = [
  { dy: 0.95, rot: -0.16, yaw: 0.10 },
  { dy: -0.62, rot: 0.11, yaw: -0.08 },
];

export const POSES = {
  makima: {
    clip: 'makima_pose.vrma',
    // Delighted you came. Heart pupils read through the gap in her hands,
    // which is what the root yaw below exists to open up.
    expressions: { Blush: 0.2, 'Heart Pupils': 1, happy: 1 },
    // A few degrees of yaw so her eye reads between the hands rather than
    // being covered by them.
    root: { y: -4 },
    camera: { lookY: 1.20, dist: 3.50, elevation: 14 },
    bands: [
      { dy: 0.95, rot: -0.16, yaw: 0.10 },
      { dy: -0.62, rot: 0.11, yaw: -0.08 },
    ],
  },

  standing: {
    clip: 'base_standing_pose.vrma',
    // The inheritance section is the one place she is not performing: settled
    // rather than playing to the room, with Sparkle doing the work instead of
    // a smirk.
    expressions: { relaxed: 0.35, Sparkle: 1 },
    bands: [
      { dy: 0.82, rot: -0.30, yaw: 0.18 },
      { dy: -0.48, rot: 0.20, yaw: -0.14 },
    ],
  },

  jacko: {
    clip: 'jacko_pose.vrma',
    // "You may look. Only look." Teasing at full weight closes the eyes into
    // arcs, which is the intent here rather than a mis-tune.
    expressions: { 'Skirt OFF': 1, Teasing: 1 },
    root: { x: -15 },
    camera: { lookY: 0.54, dist: 3.50, elevation: 5 },
    wind: { dir: [0.00, 0.00, -0.55], power: 1.00 },
    bands: [
      { dy: 1.05, rot: -0.07, yaw: 0.05 },
      { dy: -0.72, rot: 0.06, yaw: -0.04 },
    ],
  },

  suggestive: {
    clip: 'suggestive_pose.vrma',
    // No Smug and Blush held low: both narrow the lids, and the heart pupils
    // are the point here so the eyes want to stay open.
    expressions: { 'Skirt OFF': 1, 'Heart Pupils': 1, Blush: 0.2, Surprised: 0.55 },
    root: { x: -70, y: 15 },
    // The floor poses cannot share a frame with the standing ones: this wants
    // the camera low and pitched down, which would crop a standing pose.
    camera: { lookY: 0.12, dist: 3.65, elevation: 40 },
    // No wind - the angle already reads correctly without it.
    bands: [
      { dy: 0.70, rot: 0.24, yaw: -0.16 },
      { dy: -0.40, rot: -0.17, yaw: 0.12 },
    ],
  },

  prone: {
    clip: 'laying_side_wind.vrma',
    // Holding her own domain, unbothered. Smug at full weight is deliberate.
    expressions: { 'Skirt OFF': 1, Smug: 1, relaxed: 0.1 },
    // Authored head-up, which leaves her standing on end; this lays her
    // across the frame instead.
    root: { y: 40 },
    wind: { dir: [-0.40, -0.20, -1.00], power: 0.85 },
    bands: [
      { dy: 0.90, rot: -0.37, yaw: 0.22 },
      { dy: -0.68, rot: 0.27, yaw: -0.18 },
    ],
  },
};

/** @returns {string[]} pose names, in authored order. */
export const poseNames = () => Object.keys(POSES);

/**
 * Reads one field off a pose with its default applied.
 *
 * Camera merges (a partial entry sets only what it names); the others replace.
 * Merging matters: a camera entry of `{ elevation: 20 }` that replaced instead
 * of merging would leave `dist` undefined, which reaches the camera math as
 * NaN and blanks the canvas.
 */
export function poseConfig(name, field) {
  const pose = (name && POSES[name]) || null;
  switch (field) {
    case 'camera':      return { ...CAMERA_DEFAULTS, ...(pose?.camera ?? {}) };
    case 'root':        return { ...ROOT_DEFAULT, ...(pose?.root ?? {}) };
    case 'wind':        return pose?.wind ? { ...pose.wind } : { ...WIND_DEFAULT };
    case 'expressions': return { ...(pose?.expressions ?? {}) };
    case 'bands':       return pose?.bands ?? BANDS_DEFAULT;
    case 'clip':        return pose?.clip ?? null;
    default:            throw new Error(`unknown pose field "${field}"`);
  }
}
