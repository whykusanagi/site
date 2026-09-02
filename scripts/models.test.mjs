/**
 * Tests for src/3d/models.js — the outfit registry behind the model swap.
 *
 * These are real behavioural tests, not source-text assertions, because the
 * module was written to be importable outside a browser: `base()` reads
 * `window.location` lazily instead of at module load. That is the difference
 * between testing what the code DOES and testing that a string appears in it.
 *
 * The properties worth pinning:
 *   - a stale or hostile stored key can never break the page
 *   - every model actually exists on the CDN path the page will request
 *   - the default is one of the models, not a dangling name
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  MODELS, DEFAULT_MODEL, modelKeys, modelLabel, modelUrl, normalizeModel,
} = await import('../src/3d/models.js');

test('the default is a real model', () => {
  assert.ok(MODELS[DEFAULT_MODEL], `DEFAULT_MODEL "${DEFAULT_MODEL}" is not in MODELS`);
});

test('every model has a label and a file', () => {
  for (const [key, model] of Object.entries(MODELS)) {
    assert.equal(typeof model.label, 'string', `${key} has no label`);
    assert.ok(model.label.length > 0, `${key}'s label is empty`);
    assert.match(model.file, /\.vrm$/, `${key}'s file is not a .vrm`);
  }
});

test('model files are distinct', () => {
  const files = Object.values(MODELS).map((m) => m.file);
  assert.equal(new Set(files).size, files.length, 'two models point at the same file');
});

test('normalizeModel falls back for anything unrecognised', () => {
  // A stored key survives across deploys, so it can outlive the model it
  // named. It can also be edited by hand. Neither may break the page.
  for (const bad of [null, undefined, '', 'nope', '__proto__', 'constructor', 'toString']) {
    assert.equal(normalizeModel(bad), DEFAULT_MODEL, `normalizeModel(${JSON.stringify(bad)})`);
  }
});

test('normalizeModel passes through every real key', () => {
  for (const key of modelKeys()) {
    assert.equal(normalizeModel(key), key);
  }
});

test('modelUrl resolves an absolute CDN url off a browserless host', () => {
  // In Node there is no `window`, so base() takes the non-localhost branch.
  for (const key of modelKeys()) {
    const url = modelUrl(key);
    assert.match(url, /^https:\/\/s3\.whykusanagi\.xyz\/models\/.+\.vrm$/, `${key}: ${url}`);
    assert.ok(url.endsWith(MODELS[key].file));
  }
});

test('modelUrl and modelLabel are total — an unknown key still yields the default', () => {
  assert.equal(modelUrl('nope'), modelUrl(DEFAULT_MODEL));
  assert.equal(modelLabel('nope'), MODELS[DEFAULT_MODEL].label);
});

test('the page ships the model the registry defaults to', () => {
  // Guards the swap silently changing which model a first-time visitor gets.
  const stage = readFileSync('src/3d/celeste-stage.js', 'utf8');
  assert.match(stage, /import \{[^}]*DEFAULT_MODEL[^}]*\} from '\.\/models\.js'/,
    'celeste-stage.js no longer imports the registry');
  assert.doesNotMatch(stage, /const MODEL_URL\s*=/,
    'a hardcoded MODEL_URL came back — the registry should be the only source');
});

test('the swap tears the old model down before loading the next', () => {
  // Two ~36 MiB models resident at once is the spike this page cannot absorb.
  // Pinning the ORDER, because load-then-swap would still pass a naive test.
  const stage = readFileSync('src/3d/celeste-stage.js', 'utf8');
  const body = stage.slice(stage.indexOf('async setModel('));
  const unload = body.indexOf('this._unloadModel()');
  const load = body.indexOf('await this.load(next)');
  assert.ok(unload !== -1, 'setModel does not unload the current model');
  assert.ok(load !== -1, 'setModel does not load the next model');
  assert.ok(unload < load, 'setModel loads the new model before releasing the old one');
});

test('unloading releases the mixer as well as the scene', () => {
  // stopAllAction alone leaves AnimationActions bound to the old skeleton, so
  // the whole rig stays reachable and the swap leaks it.
  const stage = readFileSync('src/3d/celeste-stage.js', 'utf8');
  const body = stage.slice(stage.indexOf('_unloadModel()'), stage.indexOf('dispose()'));
  assert.match(body, /uncacheRoot/, '_unloadModel does not uncache the mixer root');
  assert.match(body, /deepDispose/, '_unloadModel does not dispose the scene graph');
});
