#!/usr/bin/env node
/** Regenerates feed.xml from the blog posts. Run: npm run feed */
import { readFileSync, writeFileSync } from 'node:fs';
import { ORIGIN, allPages, lastmod, xmlEscape } from './lib/pages.mjs';

/**
 * Values are scraped from HTML attributes, where they are already
 * HTML-escaped. Decode before xmlEscape() runs or `&amp;` becomes
 * `&amp;amp;` and readers render the entity as literal text. Single regex
 * pass (numeric and named entities matched together) so a decoded `&` can't
 * be re-scanned as the start of a new entity by a later pass.
 */
const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
const htmlDecode = (s) =>
  s.replace(/&(?:#(\d+)|(lt|gt|quot|apos|amp));/g, (_, num, name) =>
    num !== undefined ? String.fromCharCode(num) : NAMED[name],
  );

const posts = allPages()
  .filter((f) => f.startsWith('blog/') && !/(_template|index)\.html$/.test(f))
  .map((file) => {
    const html = readFileSync(file, 'utf8');
    const pick = (re) => (html.match(re) || [, ''])[1];
    return {
      url: `${ORIGIN}/blog/${file.slice('blog/'.length).replace(/\.html$/, '')}`,
      title: htmlDecode(pick(/<meta property="og:title" content="([^"]*)"/) || pick(/<title>([^<]*)<\/title>/)),
      description: htmlDecode(pick(/<meta name="description" content="([^"]*)"/)),
      published: pick(/"datePublished":\s*"([0-9-]+)"/) || lastmod(file),
    };
  })
  .sort((a, b) => b.published.localeCompare(a.published));

// RFC 822 at midnight UTC: the posts only carry a date, not a time.
const rfc822 = (d) => new Date(`${d}T00:00:00Z`).toUTCString();

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  '    <title>whykusanagi blog</title>',
  `    <link>${ORIGIN}/blog/</link>`,
  '    <description>Streams, digital art, NIKKE tools, the corrupted-theme design system, and Celeste.</description>',
  '    <language>en</language>',
  `    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>`,
  ...posts.map((p) =>
    [
      '    <item>',
      `      <title>${xmlEscape(p.title)}</title>`,
      `      <link>${p.url}</link>`,
      `      <guid isPermaLink="true">${p.url}</guid>`,
      `      <pubDate>${rfc822(p.published)}</pubDate>`,
      `      <description>${xmlEscape(p.description)}</description>`,
      '    </item>',
    ].join('\n'),
  ),
  '  </channel>',
  '</rss>',
  '',
].join('\n');

writeFileSync('feed.xml', xml);
console.log(`feed.xml: ${posts.length} items`);
