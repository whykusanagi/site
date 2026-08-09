#!/usr/bin/env node
/**
 * Regenerates sitemap.xml from git. Run: npm run sitemap
 *
 * Output is committed so Pages can serve it statically; CI regenerates and
 * diffs to catch a stale commit (see .github/workflows/seo-check.yml).
 */
import { writeFileSync } from 'node:fs';
import { ORIGIN, indexablePages, cleanUrl, lastmod } from './lib/pages.mjs';

// First match wins. priority/changefreq are ignored by Google; kept for
// nikkers.cc parity and crawlers that still read them (spec S1).
const RULES = [
  [/^\/$/,                                       '1.0', 'weekly'],
  [/^\/(blog\/|celeste|celeste-lore-faq)$/,      '0.9', 'weekly'],
  [/^\/blog\/.+/,                                '0.8', 'monthly'],
  [/^\/tools(\/|$)/,                             '0.7', 'monthly'],
  [/^\/(privacy|terms|dmca|refunds|shipping)$/,  '0.3', 'yearly'],
];
const DEFAULT_RULE = ['0.6', 'monthly'];

function rank(url) {
  for (const [re, priority, changefreq] of RULES) {
    if (re.test(url)) return [priority, changefreq];
  }
  return DEFAULT_RULE;
}

const entries = indexablePages()
  .map((file) => {
    const url = cleanUrl(file);
    const [priority, changefreq] = rank(url);
    return { loc: ORIGIN + url, lastmod: lastmod(file), changefreq, priority };
  })
  .sort((a, b) => Number(b.priority) - Number(a.priority) || a.loc.localeCompare(b.loc));

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map((e) =>
    [
      '  <url>',
      `    <loc>${e.loc}</loc>`,
      `    <lastmod>${e.lastmod}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ].join('\n'),
  ),
  '</urlset>',
  '',
].join('\n');

writeFileSync('sitemap.xml', xml);
console.log(`sitemap.xml: ${entries.length} urls`);
