import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allPages, cleanUrl, EXCLUDED, indexablePages, lastmod } from './lib/pages.mjs';

test('cleanUrl strips .html and collapses index files', () => {
  assert.equal(cleanUrl('index.html'), '/');
  assert.equal(cleanUrl('tools.html'), '/tools');
  assert.equal(cleanUrl('blog/index.html'), '/blog/');
  assert.equal(cleanUrl('blog/ld-advisory.html'), '/blog/ld-advisory');
  assert.equal(cleanUrl('tools/micro-gfx/index.html'), '/tools/micro-gfx/');
});

test('excludes the error page, template, redirect, and render targets', () => {
  const pages = indexablePages();
  for (const gone of [
    '404.html',
    'blog/_template.html',
    'art.html',
    'tools/thumbnail-generator/index.html',
    'tools/neo-deco-portrait/index.html',
  ]) {
    assert.ok(!pages.includes(gone), `${gone} should be excluded`);
  }
  // Relationship, not a magic number: a hardcoded count made every new page a
  // test failure. The invariant is that exactly the EXCLUDED set is dropped.
  assert.equal(pages.length, allPages().length - EXCLUDED.size);
});

test('lastmod returns an ISO date, not the 2025-11-26 that ai-index.xml was stuck on', () => {
  const d = lastmod('index.html');
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d > '2026-01-01', `index.html lastmod looks stale: ${d}`);
});
