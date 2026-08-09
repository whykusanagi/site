import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, indexablePages, lastmod } from './lib/pages.mjs';

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
  // Spec said 45 (50 HTML files - 5 exclusions), but tools/micro-gfx/index.html
  // (added in #60, the branch's base commit) was already counted by name in the
  // spec's own S1 priority table — the "50"/"45" figures elsewhere in the spec
  // and plan were an arithmetic miscount, not a page added after the fact.
  // Actual indexable count is 46; see task-1-report.md for the full trace.
  assert.equal(pages.length, 46);
});

test('lastmod returns an ISO date, not the 2025-11-26 that ai-index.xml was stuck on', () => {
  const d = lastmod('index.html');
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d > '2026-01-01', `index.html lastmod looks stale: ${d}`);
});
