/**
 * Drift tests for the pose records.
 *
 * These exist because the three ways a pose used to break were all SILENT:
 *
 *   - a pose missing from the clip table fell back to the idle loop with no
 *     warning, so the section just showed the wrong body;
 *   - a section past the end of the band table silently reused the last row,
 *     so a sixth section inherited the fifth's tape;
 *   - a `.vrma` could sit in the repo referenced by nothing, or a record could
 *     name a file that was never committed, and neither showed up until the
 *     page was open.
 *
 * Each of those is now a failing test instead. That is the actual deliverable
 * of the pose-record refactor: adding a pose is two files and three edits, and
 * getting it wrong is red CI rather than a page that looks subtly off.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSE_DIR = join(ROOT, 'assets/animations/poses');

const html = readFileSync(join(ROOT, 'celeste.html'), 'utf8');
const posesSrc = readFileSync(join(ROOT, 'src/3d/poses.js'), 'utf8');
const bandsSrc = readFileSync(join(ROOT, 'src/3d/caution-bands.js'), 'utf8');

const { POSES, poseConfig, CAMERA_DEFAULTS } = await import(
  join(ROOT, 'src/3d/poses.js')
);

/** Pose names the page actually asks for, in DOM order. */
const sectionPoses = [...html.matchAll(/<section data-pose="([^"]+)"/g)].map((m) => m[1]);

/** How many bands caution-bands.js builds. */
const bandCount = (bandsSrc.match(/const BANDS = \[([\s\S]*?)\];/)?.[1] ?? '')
  .split('\n')
  .filter((l) => l.trim().startsWith('{ key:')).length;

test('celeste.html declares at least one pose section', () => {
  assert.ok(sectionPoses.length > 0, 'no data-pose sections found — the regex may have drifted');
});

test('every section on the page has a pose record', () => {
  for (const name of sectionPoses) {
    assert.ok(POSES[name], `section data-pose="${name}" has no entry in POSES`);
  }
});

test('every pose record names a clip that exists on disk', () => {
  const onDisk = new Set(readdirSync(POSE_DIR).filter((f) => f.endsWith('.vrma')));
  for (const [name, pose] of Object.entries(POSES)) {
    assert.ok(pose.clip, `pose "${name}" has no clip`);
    assert.ok(onDisk.has(pose.clip), `pose "${name}" names ${pose.clip}, which is not in ${POSE_DIR}`);
  }
});

test('every clip on disk is claimed by exactly one pose', () => {
  const onDisk = readdirSync(POSE_DIR).filter((f) => f.endsWith('.vrma'));
  const claims = new Map();
  for (const [name, pose] of Object.entries(POSES)) {
    claims.set(pose.clip, [...(claims.get(pose.clip) ?? []), name]);
  }
  for (const file of onDisk) {
    const by = claims.get(file) ?? [];
    assert.ok(by.length > 0, `${file} is in the repo but no pose uses it — delete it or claim it`);
    assert.equal(by.length, 1, `${file} is claimed by more than one pose: ${by.join(', ')}`);
  }
});

test('every pose supplies one band placement per band', () => {
  assert.ok(bandCount > 0, 'could not read BANDS out of caution-bands.js');
  for (const [name, pose] of Object.entries(POSES)) {
    if (!pose.bands) continue; // falls back to BANDS_DEFAULT, which is checked below
    assert.equal(
      pose.bands.length,
      bandCount,
      `pose "${name}" has ${pose.bands.length} band placements but there are ${bandCount} bands`,
    );
  }
  assert.equal(poseConfig('__nonexistent__', 'bands').length, bandCount,
    'BANDS_DEFAULT does not cover every band');
});

test('band placements carry the fields the renderer reads', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    for (const [i, band] of (pose.bands ?? []).entries()) {
      for (const key of ['dy', 'rot', 'yaw']) {
        assert.equal(typeof band[key], 'number', `pose "${name}" band ${i} is missing ${key}`);
      }
    }
  }
});

test('a partial camera entry still resolves every field', () => {
  // The regression this guards: replacing the defaults instead of merging left
  // dist undefined, which reaches the camera math as NaN and blanks the canvas.
  for (const name of Object.keys(POSES)) {
    const cam = poseConfig(name, 'camera');
    for (const key of Object.keys(CAMERA_DEFAULTS)) {
      assert.equal(typeof cam[key], 'number', `pose "${name}" camera.${key} is not a number`);
    }
  }
  const partial = poseConfig('__nonexistent__', 'camera');
  assert.deepEqual(partial, CAMERA_DEFAULTS, 'an unknown pose should get the default framing');
});

test('wind records are well formed', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    if (!pose.wind) continue;
    assert.equal(pose.wind.dir.length, 3, `pose "${name}" wind.dir must be a 3-vector`);
    assert.equal(typeof pose.wind.power, 'number', `pose "${name}" wind.power must be a number`);
  }
});

test('no pose drives the blink shapes idle-life.js owns', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    for (const shape of Object.keys(pose.expressions ?? {})) {
      assert.ok(
        !/^blink(Left|Right)?$/i.test(shape),
        `pose "${name}" sets "${shape}", which idle-life.js overwrites every frame`,
      );
    }
  }
});

test('expression weights are within range', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    for (const [shape, weight] of Object.entries(pose.expressions ?? {})) {
      assert.ok(
        typeof weight === 'number' && weight >= 0 && weight <= 1,
        `pose "${name}" sets ${shape} to ${weight}; weights are 0..1`,
      );
    }
  }
});

test('the old scattered tables are gone', () => {
  // If one comes back, the drift these tests prevent comes back with it.
  for (const table of ['POSE_CLIPS', 'POSE_EXPRESSIONS', 'POSE_WIND', 'POSE_ROOT', 'POSE_CAMERA']) {
    assert.ok(
      !new RegExp(`const ${table}\\s*=`).test(posesSrc),
      `${table} was reintroduced — pose config belongs in the POSES record`,
    );
  }
  assert.ok(
    !/const LAYOUTS\s*=/.test(bandsSrc),
    'LAYOUTS was reintroduced — band placement is keyed by pose, not section ordinal',
  );
});
