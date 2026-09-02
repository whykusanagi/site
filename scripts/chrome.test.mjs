/**
 * Every page a visitor can land on must offer a way out.
 *
 * The presentation decks shipped with zero <a> elements while being in the
 * sitemap and linked from /tools, which on an 18+ commerce site means no
 * route to Privacy, Terms, DMCA or Refunds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allPages } from './lib/pages.mjs';

const NAV_EXEMPT = new Set([
  '404.html',
  'blog/_template.html',
  'tools/thumbnail-generator/index.html',
  'tools/neo-deco-portrait/index.html',
]);

for (const file of allPages()) {
  if (NAV_EXEMPT.has(file)) continue;
  const html = readFileSync(file, 'utf8');

  test(`${file}: has the shared nav and footer mounts`, () => {
    assert.match(html, /data-site-nav/, 'no [data-site-nav] mount');
    assert.match(html, /data-site-footer/, 'no [data-site-footer] mount');
    assert.match(html, /assets\/js\/nav\.js/, 'nav.js is not loaded');
  });

  test(`${file}: loads Font Awesome for the nav icons`, () => {
    // nav.js injects icon markup; without the stylesheet the navbar renders
    // eight blank squares, which is what countdown.html did.
    assert.match(html, /font-?awesome/i, 'nav present but Font Awesome missing');
  });
}
