#!/usr/bin/env node
// scripts/sync-theme-pin.mjs — stamp the corrupted-theme CDN pin across the site.
//
// The canonical version is package.json's "@whykusanagi/corrupted-theme"
// dependency. Change that, then:
//
//   npm run theme:sync && npm run sitemap && npm run feed && npm test
//
// For every tracked .html/.js/.mjs file it rewrites corrupted-theme/@<old>/
// to the canonical version and refreshes any integrity="sha384-…" that sits
// on a theme artifact with the hash of the bytes the CDN actually serves.
// It fetches every referenced artifact first and writes nothing if one is
// missing, so no page can be pointed at a 404.
//
// ponytail: hashes the CDN response, not node_modules — the SRI has to match
// the served bytes, and those two have disagreed before.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const CDN = 'https://cdn.whykusanagi.xyz/corrupted-theme';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = (pkg.dependencies?.['@whykusanagi/corrupted-theme']
  ?? pkg.devDependencies?.['@whykusanagi/corrupted-theme']).replace(/^[\^~]/, '');

const REF = /corrupted-theme\/@([0-9.]+)\/([^"'\s)<]+)/g;
const files = execSync('git ls-files -- "*.html" "*.js" "*.mjs"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .map((f) => [f, readFileSync(f, 'utf8')])
  .filter(([, s]) => s.includes('corrupted-theme/@'));

const paths = new Set();
for (const [, s] of files) for (const m of s.matchAll(REF)) paths.add(m[2]);

const sri = {};
for (const p of [...paths].sort()) {
  const url = `${CDN}/@${version}/${p}`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`✖ ${res.status} ${url} — nothing written`); process.exit(1); }
  sri[p] = 'sha384-' + createHash('sha384').update(Buffer.from(await res.arrayBuffer())).digest('base64');
  console.log(`  ✓ ${p}  ${sri[p]}`);
}

// integrity= belonging to a theme artifact: same tag (or escaped <code> snippet), after its URL.
const INTEGRITY = new RegExp(`(corrupted-theme/@${version.replaceAll('.', '\\.')}/([^"'\\s)<]+)"[^>]*?integrity=")sha384-[^"]+`, 'g');
let changed = 0;
for (const [f, before] of files) {
  let s = before.replace(REF, (_, v, p) => `corrupted-theme/@${version}/${p}`);
  s = s.replace(INTEGRITY, (_, head, p) => head + sri[p]);
  if (s !== before) { writeFileSync(f, s); changed++; console.log(`  → ${f}`); }
}
console.log(`\n@${version}: ${paths.size} artifact(s) verified on the CDN, ${changed} file(s) stamped`);
