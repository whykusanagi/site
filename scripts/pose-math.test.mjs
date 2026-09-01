/**
 * Unit tests for the pure pose math. No THREE, no DOM, no GPU - this is
 * exactly why pose-math.js is split out of pose-controller.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  eulerDegreesToRadians,
  normalizeBoneRotation,
  resolvePose,
  blendFactor,
  validatePoseDoc,
} from '../src/3d/pose-math.js';
import { hipsTargetY, resolveCameraUp } from '../src/3d/pose-controller.js';

test('euler degrees convert to radians preserving XYZ order', () => {
  const [x, y, z] = eulerDegreesToRadians([180, 90, -45]);
  assert.ok(Math.abs(x - Math.PI) < 1e-12);
  assert.ok(Math.abs(y - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(z + Math.PI / 4) < 1e-12);
});

test('euler bone entry normalizes to radians', () => {
  const r = normalizeBoneRotation({ euler: [90, 0, 0] });
  assert.equal(r.type, 'euler');
  assert.ok(Math.abs(r.value[0] - Math.PI / 2) < 1e-12);
});

test('quaternion bone entry passes through unchanged', () => {
  const r = normalizeBoneRotation({ quat: [0, 0.7071, 0, 0.7071] });
  assert.equal(r.type, 'quat');
  assert.deepEqual(r.value, [0, 0.7071, 0, 0.7071]);
});

test('a bone specifying both euler and quat is rejected', () => {
  assert.throws(() => normalizeBoneRotation({ euler: [0, 0, 0], quat: [0, 0, 0, 1] }));
});

test('a bone specifying neither euler nor quat is rejected', () => {
  assert.throws(() => normalizeBoneRotation({}));
});

test('wrong component counts are rejected', () => {
  assert.throws(() => normalizeBoneRotation({ euler: [0, 0] }));
  assert.throws(() => normalizeBoneRotation({ quat: [0, 0, 0] }));
});

test('non-numeric euler components are rejected', () => {
  assert.throws(() => normalizeBoneRotation({ euler: ['a', 'b', 'c'] }));
});

test('non-numeric quat components are rejected', () => {
  assert.throws(() => normalizeBoneRotation({ quat: ['a', 'b', 'c', 'd'] }));
});

test('NaN and Infinity components are rejected', () => {
  assert.throws(() => normalizeBoneRotation({ euler: [NaN, 0, 0] }));
  assert.throws(() => normalizeBoneRotation({ euler: [Infinity, 0, 0] }));
  assert.throws(() => normalizeBoneRotation({ quat: [0, 0, 0, NaN] }));
  assert.throws(() => normalizeBoneRotation({ quat: [0, 0, 0, Infinity] }));
});

test('a missing pose name resolves to null rather than throwing', () => {
  const doc = { blend: 12, poses: {} };
  assert.equal(resolvePose(doc, 'crown'), null);
  assert.equal(resolvePose(null, 'crown'), null);
  assert.equal(resolvePose({}, 'crown'), null);
});

test('blend is frame-rate independent', () => {
  // Converging on the same target over one second must land in the same place
  // whether that second is 30 frames or 144. A naive `rate * dt` fails this.
  const simulate = (fps) => {
    let v = 0;
    const dt = 1 / fps;
    for (let i = 0; i < fps; i++) v += (1 - v) * blendFactor(12, dt);
    return v;
  };
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-6);
});

test('the shipped pose file is valid', () => {
  const doc = JSON.parse(readFileSync(new URL('../static/data/celeste-poses.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePoseDoc(doc), []);
});

test('validatePoseDoc reports a bad bone entry', () => {
  const doc = { blend: 12, poses: { crown: { bones: { head: {} } } } };
  assert.equal(validatePoseDoc(doc).length, 1);
});

test('validatePoseDoc reports a non-object pose', () => {
  const doc = { blend: 12, poses: { crown: 'oops' } };
  assert.equal(validatePoseDoc(doc).length, 1);
});

test('hipsTargetY adds the offset onto the rest Y', () => {
  assert.equal(hipsTargetY(0.92, -0.735), 0.92 - 0.735);
  assert.equal(hipsTargetY(0.92, 0), 0.92);
});

test('hipsTargetY treats a missing or non-finite offset as zero', () => {
  assert.equal(hipsTargetY(0.92, undefined), 0.92);
  assert.equal(hipsTargetY(0.92, null), 0.92);
  assert.equal(hipsTargetY(0.92, NaN), 0.92);
  assert.equal(hipsTargetY(0.92, 'oops'), 0.92);
});

test('resolveCameraUp passes through a valid [x,y,z]', () => {
  assert.deepEqual(resolveCameraUp([0, 0, -1]), [0, 0, -1]);
});

test('resolveCameraUp defaults to world-up when absent or malformed', () => {
  assert.deepEqual(resolveCameraUp(undefined), [0, 1, 0]);
  assert.deepEqual(resolveCameraUp(null), [0, 1, 0]);
  assert.deepEqual(resolveCameraUp([0, 1]), [0, 1, 0]);
  assert.deepEqual(resolveCameraUp([0, 1, NaN]), [0, 1, 0]);
  assert.deepEqual(resolveCameraUp('up'), [0, 1, 0]);
});
