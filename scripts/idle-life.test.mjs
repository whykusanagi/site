/**
 * Tests for src/3d/idle-life.js - the blink/breathe/wink idle motion.
 *
 * Worth testing in Node rather than the browser: the module is pure given a
 * VRM-shaped object, and the property that actually matters (breathing must
 * not integrate into a drift when the pose clip does not rewrite the bone) is
 * invisible over a few seconds of eyeballing but obvious over simulated
 * minutes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { IdleLife } from '../src/3d/idle-life.js';

/**
 * @param {object} opts
 * @param {boolean} [opts.clipDrivesBones] whether the "animation mixer"
 *   rewrites spine/chest every frame, as createVRMAnimationClip normally does.
 */
function fakeVrm({ clipDrivesBones = true, expressions = ['blink', 'blinkLeft', 'blinkRight'] } = {}) {
  const nodes = {
    spine: { rotation: { x: 0, y: 0, z: 0 } },
    chest: { rotation: { x: 0, y: 0, z: 0 } },
  };
  const values = Object.fromEntries(expressions.map((n) => [n, 0]));
  return {
    nodes,
    clipDrivesBones,
    humanoid: { getNormalizedBoneNode: (n) => nodes[n] ?? null },
    expressionManager: {
      expressionMap: Object.fromEntries(expressions.map((n) => [n, {}])),
      setValue: (n, v) => { values[n] = v; },
      getValue: (n) => values[n] ?? 0,
    },
    values,
  };
}

/** Runs `seconds` of frames at 60fps, re-applying the clip's base each frame. */
function run(life, vrm, seconds, { base = 0 } = {}) {
  const dt = 1 / 60;
  const samples = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    if (vrm.clipDrivesBones) {
      vrm.nodes.spine.rotation.x = base;
      vrm.nodes.chest.rotation.x = base;
    }
    life.update(dt);
    samples.push({
      spine: vrm.nodes.spine.rotation.x,
      blink: vrm.expressionManager.getValue('blink'),
      left: vrm.expressionManager.getValue('blinkLeft'),
      right: vrm.expressionManager.getValue('blinkRight'),
    });
  }
  return samples;
}

test('breathing oscillates around the pose clip base', () => {
  const vrm = fakeVrm();
  const s = run(new IdleLife(vrm), vrm, 6).map((x) => x.spine);
  const min = Math.min(...s);
  const max = Math.max(...s);
  assert.ok(max - min > 0.02, `expected visible breathing travel, got ${max - min}`);
  // Symmetric about the base it was handed.
  assert.ok(Math.abs(max + min) < 0.005, `breathing should centre on 0, got [${min}, ${max}]`);
});

test('breathing respects a non-zero base from the pose clip', () => {
  const vrm = fakeVrm();
  const s = run(new IdleLife(vrm), vrm, 6, { base: 0.5 }).map((x) => x.spine);
  assert.ok(Math.min(...s) > 0.45 && Math.max(...s) < 0.55,
    `expected oscillation about 0.5, got [${Math.min(...s)}, ${Math.max(...s)}]`);
});

test('breathing does not drift when the clip leaves the bone alone', () => {
  // The regression this guards: a naive `rotation.x += delta` integrates its
  // own output when nothing resets the bone, and the model slowly folds over.
  const vrm = fakeVrm({ clipDrivesBones: false });
  const s = run(new IdleLife(vrm), vrm, 120).map((x) => x.spine);
  assert.ok(Math.max(...s) < 0.05 && Math.min(...s) > -0.05,
    `expected bounded rotation over two minutes, got [${Math.min(...s)}, ${Math.max(...s)}]`);
});

test('blinks fully close and fully reopen', () => {
  const vrm = fakeVrm();
  const s = run(new IdleLife(vrm), vrm, 40);
  const peak = Math.max(...s.map((x) => Math.max(x.blink, x.left, x.right)));
  assert.ok(peak > 0.95, `expected at least one full blink in 40s, got peak ${peak}`);
  // And it always returns to open rather than sticking shut.
  const tail = s.slice(-1)[0];
  assert.ok(tail.blink < 1 && tail.left < 1 && tail.right < 1, 'eyes left closed');
});

test('a wink never leaves the other eye set', () => {
  const vrm = fakeVrm();
  const s = run(new IdleLife(vrm), vrm, 240);
  const winked = s.some((x) => Math.abs(x.left - x.right) > 0.5);
  assert.ok(winked, 'expected at least one wink over four minutes');
  // Both eyes closed hard at once is a blink, never a wink artefact.
  for (const x of s) {
    if (x.left > 0.5 && x.right > 0.5) {
      assert.ok(Math.abs(x.left - x.right) < 0.01, 'asymmetric double-close');
    }
  }
});

test('reduced motion leaves the model entirely alone', () => {
  const vrm = fakeVrm();
  const s = run(new IdleLife(vrm, true), vrm, 30);
  assert.ok(s.every((x) => x.spine === 0), 'breathing ran under reduced motion');
  assert.ok(s.every((x) => x.blink === 0 && x.left === 0 && x.right === 0),
    'blinking ran under reduced motion');
});

test('a model without blink shapes still breathes', () => {
  const vrm = fakeVrm({ expressions: [] });
  const s = run(new IdleLife(vrm), vrm, 6).map((x) => x.spine);
  assert.ok(Math.max(...s) - Math.min(...s) > 0.02, 'breathing needs no expressions');
});

test('a huge delta (backgrounded tab) does not jump the breath', () => {
  const vrm = fakeVrm();
  const life = new IdleLife(vrm);
  life.update(1 / 60);
  const before = vrm.nodes.spine.rotation.x;
  vrm.nodes.spine.rotation.x = 0;
  life.update(30); // tab was hidden for half a minute
  assert.ok(Math.abs(vrm.nodes.spine.rotation.x - before) < 0.01,
    'a 30s delta should be clamped, not applied whole');
});
