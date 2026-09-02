/**
 * Metadata invariants for every indexable page. Assertion numbers match
 * docs/superpowers/specs/2026-08-08-seo-ai-search.md section 6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGIN, indexablePages, cleanUrl, allPages } from './lib/pages.mjs';

/** noindex render targets: metadata-exempt, but must carry the noindex tag. */
const NOINDEX = new Set([
  'tools/thumbnail-generator/index.html',
  'tools/neo-deco-portrait/index.html',
  'celeste-cli-presentation.html',
  'celeste-ops-presentation.html',
]);

const KNOWN_TYPES = new Set([
  'Person', 'Organization', 'Article', 'BlogPosting', 'Blog', 'ImageObject',
  'FAQPage', 'Question', 'Answer', 'SoftwareSourceCode', 'SoftwareApplication',
  'CollectionPage', 'CreativeWork', 'ItemList', 'ListItem', 'MusicAlbum',
  'MusicGroup', 'BreadcrumbList', 'WebSite', 'WebPage', 'Offer',
]);

/**
 * Attribute maps for every `<name ...>` tag. ponytail: not an HTML parser and
 * does not need to be - this reads hand-authored <head> markup only. Matching
 * attributes rather than a fixed tag string keeps it order-insensitive, so
 * `rel="canonical" href=` and `href= rel="canonical"` both work.
 */
function tags(html, name) {
  const out = [];
  for (const m of html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))) {
    const a = {};
    for (const kv of m[1].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) a[kv[1].toLowerCase()] = kv[2];
    out.push(a);
  }
  return out;
}

const headOf = (html) => {
  const end = html.search(/<\/head>/i);
  return end === -1 ? html : html.slice(0, end);
};
const meta = (html, key, val) => tags(html, 'meta').find((t) => t[key] === val);
const ldBlocks = (html) =>
  [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]);

/** Every @type anywhere in a parsed JSON-LD tree. */
function collectTypes(node, acc = []) {
  if (Array.isArray(node)) { for (const n of node) collectTypes(n, acc); return acc; }
  if (node && typeof node === 'object') {
    if (typeof node['@type'] === 'string') acc.push(node['@type']);
    if (Array.isArray(node['@type'])) acc.push(...node['@type']);
    for (const v of Object.values(node)) collectTypes(v, acc);
  }
  return acc;
}

// Render targets are excluded from the sitemap but still need their noindex
// tag verified, so walk them alongside the indexable pages — the NOINDEX
// branch below is what separates the two treatments.
for (const file of [...indexablePages(), ...NOINDEX]) {
  const html = readFileSync(file, 'utf8');
  const head = headOf(html);
  const canonical = ORIGIN + cleanUrl(file);

  if (NOINDEX.has(file)) {
    test(`${file}: is noindex`, () => {
      const r = meta(head, 'name', 'robots');
      assert.ok(r, 'render target must carry <meta name="robots">');
      assert.match(r.content, /noindex/);
    });
    continue;
  }

  // 1. title. 70, not 60: blog posts drop the " | Celeste Blog" suffix rather
  // than lose keywords, and 60 is a display-truncation guideline, not a
  // ranking factor.
  test(`${file}: title present and <=70 chars`, () => {
    const m = head.match(/<title>([^<]*)<\/title>/i);
    assert.ok(m, 'no <title> in <head>');
    const t = m[1].trim();
    assert.ok(t.length > 0, 'empty <title>');
    assert.ok(t.length <= 70, `title is ${t.length} chars: ${t}`);
  });

  // 2. description. Floor is the real assertion — under 120 wastes the slot.
  // Ceiling is loose because AI search reads the full value even though Google
  // truncates the display at ~160.
  test(`${file}: description 120-320 chars`, () => {
    const d = meta(head, 'name', 'description');
    assert.ok(d, 'no meta description');
    assert.ok(
      d.content.length >= 120 && d.content.length <= 320,
      `description is ${d.content.length} chars`,
    );
  });

  // 3. canonical resolves to itself, extensionless
  test(`${file}: canonical is ${canonical}`, () => {
    const links = tags(head, 'link').filter((t) => t.rel === 'canonical');
    assert.equal(links.length, 1, `expected 1 canonical, found ${links.length}`);
    assert.equal(links[0].href, canonical);
  });

  // 4 + 5. social tags present and agreeing with the canonical
  test(`${file}: og + twitter tags`, () => {
    for (const p of ['og:type', 'og:url', 'og:title', 'og:description', 'og:image', 'og:site_name']) {
      assert.ok(meta(head, 'property', p), `missing ${p}`);
    }
    for (const n of ['twitter:card', 'twitter:url', 'twitter:title', 'twitter:description', 'twitter:image']) {
      assert.ok(meta(head, 'name', n), `missing ${n}`);
    }
    assert.equal(meta(head, 'property', 'og:url').content, canonical);
    assert.equal(meta(head, 'name', 'twitter:url').content, canonical);
  });

  // 6. exactly one h1
  test(`${file}: exactly one <h1>`, () => {
    assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  });

  // 7 + 8. JSON-LD parses, types are known, breadcrumb present
  test(`${file}: JSON-LD valid with a BreadcrumbList`, () => {
    const blocks = ldBlocks(html);
    assert.ok(blocks.length > 0, 'no ld+json block');
    const types = [];
    for (const [i, raw] of blocks.entries()) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        assert.fail(`ld+json block ${i} is not valid JSON: ${e.message}`);
      }
      types.push(...collectTypes(parsed));
    }
    for (const t of types) assert.ok(KNOWN_TYPES.has(t), `unknown @type "${t}"`);
    assert.ok(types.includes('BreadcrumbList'), 'no BreadcrumbList');
  });

  // 9. og:image is a seeded micro-gfx card on EVERY page, not just posts.
  // A shared A4 portrait in a 1.91:1 slot centre-crops to a midsection.
  test(`${file}: og:image is a seeded micro-gfx card`, () => {
    const re = /^https:\/\/whykusanagi\.xyz\/api\/micro-gfx\?(?=.*\bformat=card\b)(?=.*\bseed=\d+\b).+/;
    assert.match(meta(head, 'property', 'og:image').content, re);
    assert.match(meta(head, 'name', 'twitter:image').content, re);
  });

  // 9b. Slack and LinkedIn need explicit dimensions to lay the card out
  // before the image arrives.
  test(`${file}: og:image declares its dimensions`, () => {
    assert.equal(meta(head, 'property', 'og:image:width')?.content, '1200');
    assert.equal(meta(head, 'property', 'og:image:height')?.content, '630');
  });

  // 9c. set-og-cards.mjs must HTML-decode og:title before building the card
  // URL. A raw copy sends the literal text "&amp;" to the render API (which
  // then re-encodes it as %26amp%3B) instead of a bare "&" (%26), and the
  // card visibly shows "&amp;" instead of "&".
  test(`${file}: og:image title is not double HTML-encoded`, () => {
    assert.doesNotMatch(meta(head, 'property', 'og:image').content, /%26amp%3B/);
    assert.doesNotMatch(meta(head, 'name', 'twitter:image').content, /%26amp%3B/);
  });

  // 10. no .html URLs anywhere
  test(`${file}: no .html links`, () => {
    const abs = html.match(/https:\/\/whykusanagi\.xyz\/[^"'\s]*\.html/g);
    assert.equal(abs, null, `absolute .html URLs: ${abs}`);
    const rel = tags(html, 'a')
      .map((t) => t.href)
      .filter((h) => h && !/^https?:\/\//.test(h) && /\.html(#|\?|$)/.test(h));
    assert.deepEqual(rel, [], `relative .html hrefs: ${rel}`);
  });
}

// Whole-site assertions.
test('sitemap.xml is complete and clean', () => {
  const xml = readFileSync('sitemap.xml', 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = new Set(indexablePages().map((f) => ORIGIN + cleanUrl(f)));
  assert.equal(locs.length, expected.size, 'sitemap.xml is stale — run npm run sitemap');
  assert.equal(locs.filter((l) => l.includes('.html')).length, 0);
  for (const l of locs) assert.ok(expected.has(l), `sitemap lists unknown url ${l}`);
});

test('corrupted-theme is pinned to one version everywhere', () => {
  const versions = new Set();
  const hashes = new Set();
  // Pages whose theme <link> is missing (or has an empty) integrity= don't
  // add anything to `hashes`, so they're invisible to the set-size checks
  // below - a version bump applied to every page without refreshing the SRI
  // hash would leave `hashes.size === 1` (the stale hash, unanimous) and
  // sail through undetected. Track those links directly instead.
  const badIntegrity = [];
  for (const file of allPages()) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/corrupted-theme\/@([0-9.]+)/g)) versions.add(m[1]);
    for (const m of html.matchAll(/theme\.min\.css"[^>]*integrity="([^"]+)"/g)) hashes.add(m[1]);
    for (const m of html.matchAll(/<link\b[^>]*corrupted-theme[^>]*theme\.min\.css[^>]*>/g)) {
      if (!/\sintegrity="sha384-[^"]+"/.test(m[0])) badIntegrity.push(file);
    }
  }
  assert.equal(versions.size, 1, `theme version split across ${[...versions].join(', ')}`);
  // Was `assert.ok(hashes.size <= 1, ...)`, which passes vacuously when every
  // page dropped integrity= (hashes.size === 0, and 0 <= 1) - the exact
  // scenario a bumped-but-unrefreshed SRI hash produces once every page also
  // agrees on the missing-hash "value". equal() makes an empty set fail too.
  assert.equal(hashes.size, 1, `theme.min.css SRI hash differs (or is missing everywhere): ${[...hashes].join(' vs ')}`);
  assert.deepEqual(badIntegrity, [],
    `theme link missing a non-empty integrity="sha384-..." on: ${badIntegrity.join(', ')}`);
});

test('package.json agrees with the pinned theme version', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const declared = (pkg.dependencies?.['@whykusanagi/corrupted-theme']
    ?? pkg.devDependencies?.['@whykusanagi/corrupted-theme'] ?? '').replace(/^[\^~]/, '');
  if (!declared) return; // not a dependency here, nothing to reconcile
  const html = readFileSync('index.html', 'utf8');
  const used = html.match(/corrupted-theme\/@([0-9.]+)/)?.[1];
  assert.equal(declared, used,
    `package.json says ${declared} but the pages load @${used}`);
});

test('robots.txt declares a policy and points at the sitemap', () => {
  const r = readFileSync('robots.txt', 'utf8');
  assert.match(r, /^Sitemap: https:\/\/whykusanagi\.xyz\/sitemap\.xml$/m);
  assert.match(r, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  assert.match(r, /^Allow: \/api\/micro-gfx$/m, 'og:image path must stay crawlable');
});
