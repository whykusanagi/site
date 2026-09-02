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

test('site-bootstrap gates the particle background on reduced motion', () => {
  const src = readFileSync('assets/js/site-bootstrap.js', 'utf8');
  assert.match(src, /const reduceMotion\s*=\s*window\.matchMedia\(\s*'\(prefers-reduced-motion: reduce\)'\s*\)\.matches/,
    'no reduced-motion query at all');
  // The construction must sit INSIDE a conditional that negates it. Checking
  // only that the phrase appears somewhere would pass on a comment.
  assert.match(src, /if\s*\(\s*!reduceMotion[\s\S]{0,120}?\)\s*\{[\s\S]{0,200}?new CorruptedParticlesBackground/,
    'CorruptedParticlesBackground is not inside a !reduceMotion guard');
});

test('loading.js gates the boot animation on reduced motion', () => {
  const src = readFileSync('assets/js/loading.js', 'utf8');
  assert.match(src, /const reduceMotion\s*=\s*window\.matchMedia\(\s*'\(prefers-reduced-motion: reduce\)'\s*\)\.matches/,
    'no reduced-motion query at all');
  // The guard itself must consult it, not merely mention it nearby.
  assert.match(src, /if\s*\(\s*!reduceMotion\s*&&/,
    'the boot-screen guard does not consult reduceMotion');
});
