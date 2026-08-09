/**
 * Metadata invariants for every indexable page. Assertion numbers match
 * docs/superpowers/specs/2026-08-08-seo-ai-search.md section 6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGIN, indexablePages, cleanUrl } from './lib/pages.mjs';

/** noindex render targets: metadata-exempt, but must carry the noindex tag. */
const NOINDEX = new Set([
  'tools/thumbnail-generator/index.html',
  'tools/neo-deco-portrait/index.html',
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

for (const file of indexablePages()) {
  const html = readFileSync(file, 'utf8');
  const head = headOf(html);
  const canonical = ORIGIN + cleanUrl(file);
  const isPost = file.startsWith('blog/') && file !== 'blog/index.html';

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

  // 9. per-post og:image comes from the render API with a fixed seed
  if (isPost) {
    test(`${file}: og:image is a seeded micro-gfx card`, () => {
      const re = /^https:\/\/whykusanagi\.xyz\/api\/micro-gfx\?(?=.*\bformat=card\b)(?=.*\bseed=\d+\b).+/;
      assert.match(meta(head, 'property', 'og:image').content, re);
      assert.match(meta(head, 'name', 'twitter:image').content, re);
    });
  }

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
  assert.equal(locs.length, 46);
  assert.equal(locs.filter((l) => l.includes('.html')).length, 0);
  const expected = new Set(indexablePages().map((f) => ORIGIN + cleanUrl(f)));
  for (const l of locs) assert.ok(expected.has(l), `sitemap lists unknown url ${l}`);
});

test('robots.txt declares a policy and points at the sitemap', () => {
  const r = readFileSync('robots.txt', 'utf8');
  assert.match(r, /^Sitemap: https:\/\/whykusanagi\.xyz\/sitemap\.xml$/m);
  assert.match(r, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  assert.match(r, /^Allow: \/api\/micro-gfx$/m, 'og:image path must stay crawlable');
});
