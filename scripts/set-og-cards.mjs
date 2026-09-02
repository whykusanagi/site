/**
 * Points every indexable non-post page's og:image / twitter:image at the
 * render API's card endpoint, which returns a correct 1200x630 image, and
 * makes sure every indexable page (posts included) declares that image's
 * dimensions.
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
import { indexablePages, isPost, ORIGIN } from './lib/pages.mjs';

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

/**
 * attr() returns the raw attribute text, entities and all - og:title values
 * that contain "&" are authored as "&amp;" in source, so a naive read hands
 * the render API the literal five characters "&amp;" instead of "&". Decode
 * the handful of entities the site's titles actually use before the title
 * goes anywhere near a URL or a truncation length.
 *
 * &amp; must decode last. If it went first, an already-escaped entity like
 * "&amp;lt;" would collapse in two passes ("&amp;lt;" -> "&lt;" -> "<")
 * instead of yielding the literal text "&lt;" the author wrote.
 */
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Cut at a word boundary, never mid-word - the render API doesn't wrap the
 * title, so anything that overflows the card just clips silently. 40 is not
 * a guess: verified empirically against the two longest non-post titles in
 * the set (index.html at 76 chars, bastard-hero.html at 59) plus the next
 * two longest (assets.html, tools/micro-gfx/index.html) by rendering each
 * candidate and checking the card - see task-2-report.md fix-round section.
 */
function truncateTitle(title, limit = 40) {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed}…`;
}

function cardUrl(file, title) {
  const q = new URLSearchParams({
    format: 'card',
    seed: String(seedFor(file)),
    eyebrow: 'WHYKUSANAGI',
    title: truncateTitle(title),
    nameplate: 'whykusanagi.xyz',
  });
  // &amp; because this lands inside an HTML attribute.
  return `${ORIGIN}/api/micro-gfx?${q.toString().replace(/&/g, '&amp;')}`;
}

let changed = 0;
for (const file of indexablePages()) {
  let html = readFileSync(file, 'utf8');
  const before = html;

  // Real posts already have their own seeded card - blog/index.html is a
  // listing page, not a post (see isPost in lib/pages.mjs), so it still
  // gets one here like any other non-post page.
  if (!isPost(file)) {
    const rawTitle = attr(html, 'property', 'og:title');
    if (!rawTitle) {
      console.warn(`[og-cards] ${file}: no og:title, card not updated`);
    } else {
      // Decode before truncating so the 40-char limit counts characters a
      // reader sees, not entity noise like "&amp;" (5 chars for one "&").
      const title = decodeEntities(rawTitle);
      const url = cardUrl(file, title);
      html = html
        .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${url}$2`)
        .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${url}$2`);
    }
  }

  // Add the dimension tags directly after og:image if they are not there
  // yet - every indexable page needs these, posts included, since the
  // render API's output is always 1200x630 regardless of who requested it.
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
