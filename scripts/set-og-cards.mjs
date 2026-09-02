/**
 * Points every indexable page's og:image / twitter:image at the render API's
 * card endpoint, which returns a correct 1200x630 image.
 *
 * Before this, 19 non-blog pages shared one 2480x3508 A4 portrait. In a
 * summary_large_image slot (1.91:1) that centre-crops to a midsection.
 *
 * The seed is derived from the filename so a page's card is stable across
 * runs - re-running this must not churn the diff - and differs between pages
 * so the generated art does not repeat.
 *
 * Idempotent: safe to re-run. Run it after adding a page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { indexablePages, ORIGIN } from './lib/pages.mjs';

/** Stable per-file seed. FNV-1a, kept small so the URL stays readable. */
function seedFor(file) {
  let h = 0x811c9dc5;
  for (const ch of file) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100000;
}

const attr = (html, kind, name) =>
  html.match(new RegExp(`<meta\\s+${kind}="${name}"\\s+content="([^"]*)"`, 'i'))?.[1] ?? null;

function cardUrl(file, title) {
  const q = new URLSearchParams({
    format: 'card',
    seed: String(seedFor(file)),
    eyebrow: 'WHYKUSANAGI',
    title,
    nameplate: 'whykusanagi.xyz',
  });
  // &amp; because this lands inside an HTML attribute.
  return `${ORIGIN}/api/micro-gfx?${q.toString().replace(/&/g, '&amp;')}`;
}

let changed = 0;
for (const file of indexablePages()) {
  if (file.startsWith('blog/')) continue; // posts already have their own cards
  let html = readFileSync(file, 'utf8');

  const title = attr(html, 'property', 'og:title');
  if (!title) {
    console.warn(`[og-cards] ${file}: no og:title, skipped`);
    continue;
  }

  const url = cardUrl(file, title);
  const before = html;
  html = html
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${url}$2`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${url}$2`);

  // Add the dimension tags directly after og:image if they are not there yet.
  if (!/property="og:image:width"/.test(html)) {
    html = html.replace(
      /(<meta\s+property="og:image"\s+content="[^"]*">)/i,
      `$1\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`,
    );
  }

  if (html !== before) {
    writeFileSync(file, html);
    changed++;
  }
}
console.log(`[og-cards] rewrote ${changed} page(s)`);
