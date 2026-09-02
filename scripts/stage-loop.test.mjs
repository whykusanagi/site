/**
 * Pins the order of operations inside CelesteStage's render loop.
 *
 * Three separate behaviours depend on that order, and two of them have already
 * regressed once each:
 *
 *   1. Pose clips write NORMALIZED humanoid bones. `vrm.update()` is what
 *      copies those onto the raw skeleton, so anything writing bones has to
 *      run BEFORE it or the write silently does nothing.
 *   2. Idle life (blink/breathe) writes bones and expressions, so it sits in
 *      the same window as the pose clips - after the mixer, which would
 *      otherwise overwrite it, and before vrm.update().
 *   3. The root rotation must be eased BEFORE vrm.update(), so spring bones
 *      simulate against the root they are attached to this frame. Rotating it
 *      afterwards moved the whole rig out from under springs that had already
 *      integrated, which is what deformed the mesh on a section 05 -> 01 jump.
 *
 * These are source-order assertions rather than behavioural ones, and that is
 * a deliberate trade: exercising this loop needs WebGL, a 36 MiB VRM, and a
 * theme CDN that is CORS-locked to the apex domain. The ORDER is the invariant
 * and it is legible in the source, so pinning it there is worth more than not
 * pinning it at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/3d/celeste-stage.js', 'utf8');

/** The body of `tick()`, so a match elsewhere in the file cannot fool us. */
const loop = (() => {
  const start = src.indexOf('const tick = () => {');
  assert.notEqual(start, -1, 'could not find the render loop — this test needs updating');
  const end = src.indexOf('tick();', start);
  assert.notEqual(end, -1, 'could not find the end of the render loop');
  return src.slice(start, end);
})();

/** Index of a call inside the loop, asserted to exist. */
function at(needle, label) {
  const i = loop.indexOf(needle);
  assert.notEqual(i, -1, `${label} is missing from the render loop (looked for \`${needle}\`)`);
  return i;
}

test('the mixer runs before idle life', () => {
  // Otherwise the pose clip overwrites the breathing offset in the same frame
  // and nothing moves.
  assert.ok(
    at('this.mixer?.update(dt)', 'mixer update') < at('this.idleLife?.update(dt)', 'idle life'),
    'idle life runs before the mixer, so the clip will overwrite it',
  );
});

test('idle life runs before vrm.update', () => {
  // vrm.update() is what copies normalized bones onto the raw skeleton and
  // applies expression weights. Writing after it paints into a buffer nobody
  // reads until the next frame.
  assert.ok(
    at('this.idleLife?.update(dt)', 'idle life') < at('this.vrm?.update(dt)', 'vrm update'),
    'idle life runs after vrm.update, so blinking and breathing never reach the skeleton',
  );
});

test('the root is eased before vrm.update, not after', () => {
  // The regression this guards: with the slerp after vrm.update, every frame
  // of a large swing moved the rig out from under springs that had already
  // been integrated, injecting fresh velocity each time. Section 05 -> 01
  // swings ~44 degrees and deformed the mesh into cones.
  assert.ok(
    at('this.vrm.scene.quaternion.slerp', 'root slerp') < at('this.vrm?.update(dt)', 'vrm update'),
    'the root is rotated after vrm.update — spring bones will lash on a big pose jump',
  );
});

test('spring bones are re-seated only after a large root swing', () => {
  const reset = at('springBoneManager?.reset()', 'spring reset');
  const vrmUpdate = at('this.vrm?.update(dt)', 'vrm update');
  assert.ok(reset > vrmUpdate,
    'springs are reset before vrm.update, so the simulation immediately overwrites the reset');

  // It must be conditional. Resetting every frame would disable secondary
  // motion entirely — no hair sway, no settle.
  const tail = loop.slice(vrmUpdate);
  assert.match(tail, /if\s*\(\s*rootSwing\s*>\s*ROOT_SWING_RESET_RAD\s*\)/,
    'the spring reset is not gated on the size of the root swing');
});

test('the swing threshold is above idle motion and below a pose jump', () => {
  const m = src.match(/const ROOT_SWING_RESET_RAD\s*=\s*([\d.]+)/);
  assert.ok(m, 'ROOT_SWING_RESET_RAD is gone');
  const rad = Number(m[1]);
  // Idle life moves spine and chest, never the root, so idle produces ~0.
  // A 44-degree swing at the loop's easing rate starts near 0.073 rad/frame.
  assert.ok(rad > 0, 'threshold must be positive or every frame resets');
  assert.ok(rad < 0.07, `threshold ${rad} is above the start of a real pose jump — it would never fire`);
});

test('the loop allocates nothing per frame', () => {
  // A `new` inside the loop is a garbage-collection pause at 60fps. The swing
  // measurement uses a module-level scratch quaternion for this reason.
  const news = loop.match(/\bnew [A-Z]/g) ?? [];
  assert.deepEqual(news, [], `render loop allocates per frame: ${news.join(', ')}`);
});
