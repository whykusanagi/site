/**
 * Pure pose math. No THREE, no DOM - deliberately dependency-free so it runs
 * under `node --test`. Anything needing a GPU lives in pose-controller.js.
 */

const DEG2RAD = Math.PI / 180;

/** Euler degrees [x,y,z] -> radians [x,y,z]. XYZ order preserved. */
export function eulerDegreesToRadians(deg) {
  return [deg[0] * DEG2RAD, deg[1] * DEG2RAD, deg[2] * DEG2RAD];
}

/**
 * One bone entry -> { type, value }. Accepts exactly one of `euler` (degrees)
 * or `quat` ([x,y,z,w]); VRM pose tools differ on which they export.
 */
export function normalizeBoneRotation(entry) {
  const hasEuler = Array.isArray(entry?.euler);
  const hasQuat = Array.isArray(entry?.quat);
  if (hasEuler === hasQuat) {
    throw new Error('bone must specify exactly one of euler or quat');
  }
  if (hasEuler) {
    if (entry.euler.length !== 3) throw new Error('euler must have 3 components');
    if (!entry.euler.every(Number.isFinite)) throw new Error('euler components must be finite numbers');
    return { type: 'euler', value: eulerDegreesToRadians(entry.euler) };
  }
  if (entry.quat.length !== 4) throw new Error('quat must have 4 components');
  if (!entry.quat.every(Number.isFinite)) throw new Error('quat components must be finite numbers');
  return { type: 'quat', value: [...entry.quat] };
}

/**
 * Look up a pose by name. A missing pose is the normal day-one state (the file
 * ships empty), so this returns null rather than throwing.
 */
export function resolvePose(doc, name) {
  if (!doc || typeof doc !== 'object' || !doc.poses) return null;
  return doc.poses[name] ?? null;
}

/**
 * Frame-rate independent blend factor for exponential smoothing.
 * `1 - e^(-rate*dt)` converges identically regardless of frame rate; the naive
 * `rate * dt` does not, and makes transitions faster on faster machines.
 */
export function blendFactor(rate, deltaSeconds) {
  return 1 - Math.exp(-rate * deltaSeconds);
}

/** Returns an array of human-readable problems. Empty array means valid. */
export function validatePoseDoc(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') return ['document is not an object'];
  if (typeof doc.blend !== 'number') errors.push('blend must be a number');
  if (!doc.poses || typeof doc.poses !== 'object') {
    errors.push('poses must be an object');
    return errors;
  }
  for (const [poseName, pose] of Object.entries(doc.poses)) {
    if (pose === null || typeof pose !== 'object') {
      errors.push(`${poseName}: pose must be an object`);
      continue;
    }
    for (const [boneName, entry] of Object.entries(pose.bones ?? {})) {
      try {
        normalizeBoneRotation(entry);
      } catch (e) {
        errors.push(`${poseName}.${boneName}: ${e.message}`);
      }
    }
  }
  return errors;
}
