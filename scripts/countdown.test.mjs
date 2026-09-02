/**
 * A shared link carries tracking parameters. Treating "any query string at
 * all" as "embed mode" means a tweet of this page renders a bare timer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('countdown.html', 'utf8');

test('embed mode is not triggered by any arbitrary query string', () => {
  assert.ok(!/location\.search\.length\s*>\s*0/.test(src),
    'embed mode keys off search.length, so ?utm_source= strips the page chrome');
});

test('embed mode keys off the parameters the widget actually reads', () => {
  assert.match(src, /EMBED_PARAMS/,
    'expected an explicit list of the parameters that mean "embed"');
});
