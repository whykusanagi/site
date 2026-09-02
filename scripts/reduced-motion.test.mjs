/**
 * Reduced motion has to be honoured by the whole page, not most of it.
 *
 * These are source-level checks rather than behavioural ones: the modules
 * touch the DOM at import time and the CDN is CORS-locked to the apex, so
 * there is no environment here that can execute them. Checking that the gate
 * EXISTS is worth more than not checking at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const REDUCE = /prefers-reduced-motion/;

test('site-bootstrap gates the particle background', () => {
  const src = readFileSync('assets/js/site-bootstrap.js', 'utf8');
  const line = src.split('\n').find((l) => l.includes('new CorruptedParticlesBackground'));
  assert.ok(line, 'the particle background construction moved - update this test');
  assert.ok(!/^\s*new CorruptedParticlesBackground/.test(line),
    'CorruptedParticlesBackground is constructed unconditionally');
  assert.match(src, REDUCE, 'site-bootstrap.js has no reduced-motion check at all');
});

test('loading.js honours reduced motion', () => {
  assert.match(readFileSync('assets/js/loading.js', 'utf8'), REDUCE,
    'loading.js runs 8s of glitch on every page with no reduced-motion gate');
});
