/**
 * Shared page inventory for the sitemap, feed, OG warmer and SEO checker.
 *
 * Single source of truth for two things that must never disagree: which files
 * are indexable, and what each one's canonical URL is. ai-index.xml drifted to
 * 8 of 50 URLs and an 8-month-stale lastmod precisely because that list was
 * hand-maintained.
 */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

export const ORIGIN = 'https://whykusanagi.xyz';

/** See spec S1 for the reason attached to each exclusion. */
export const EXCLUDED = new Set([
  '404.html',                                // error page
  'blog/_template.html',                     // authoring template
  'art.html',                                // 302s to / per _redirects
  'tools/thumbnail-generator/index.html',    // /api/thumbnail render target
  'tools/neo-deco-portrait/index.html',      // render target, no inbound links
]);

/**
 * Cloudflare Pages 308s `/foo.html` to `/foo`, so the extensionless form is the
 * only one that answers 200 — canonicals, sitemap entries and internal links all
 * have to use it.
 */
export function cleanUrl(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return '/' + file.slice(0, -'index.html'.length);
  return '/' + file.replace(/\.html$/, '');
}

export function allPages() {
  return execFileSync('git', ['ls-files', '*.html'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

export function indexablePages() {
  return allPages().filter((f) => !EXCLUDED.has(f));
}

/**
 * True for a real blog post. blog/index.html is the listing page, not a
 * post - it needs the same non-post treatment (seeded social card, etc.) as
 * any other page. Shared by check-seo.test.mjs and set-og-cards.mjs so the
 * two can't drift apart on what counts as a post.
 */
export function isPost(file) {
  return file.startsWith('blog/') && file !== 'blog/index.html';
}

/** Last commit date, falling back to mtime for a file that isn't committed yet. */
export function lastmod(file) {
  // A file with uncommitted changes is dated TODAY, not by its last commit.
  //
  // Without this the generator is chicken-and-egg with its own CI check:
  // `git log -1` reports the previous commit's date, so a sitemap generated
  // before committing an edited page is already stale the moment that commit
  // lands - and "Generated files are current" fails on the first push of any
  // PR that touches an HTML file. Dating pending edits today produces the
  // value the file will have once committed, so one pass is enough.
  const dirty = execFileSync('git', ['status', '--porcelain', '--', file], {
    encoding: 'utf8',
  }).trim();
  if (dirty) return new Date().toISOString().slice(0, 10);

  const out = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short', '--', file], {
    encoding: 'utf8',
  }).trim();
  return out || statSync(file).mtime.toISOString().slice(0, 10);
}

export function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
