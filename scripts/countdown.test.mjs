/**
 * A shared link carries tracking parameters. Treating "any query string at
 * all" as "embed mode" means a tweet of this page renders a bare timer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initCountdown } from '../assets/js/countdown-widget.js';

const src = readFileSync('countdown.html', 'utf8');

test('embed mode is not triggered by any arbitrary query string', () => {
  assert.ok(!/location\.search\.length\s*>\s*0/.test(src),
    'embed mode keys off search.length, so ?utm_source= strips the page chrome');
});

test('embed mode keys off the parameters the widget actually reads', () => {
  assert.match(src, /EMBED_PARAMS/,
    'expected an explicit list of the parameters that mean "embed"');
});

test('preset requests reject unsafe event names and log valid names as data', async (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const networkError = new Error('network unavailable');
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw networkError; });
  const logMock = t.mock.method(console, 'error', () => {});

  for (const event of ['../private', '%2e%2e%2fprivate', 'https://example.com', 'foo/bar', '%s', 'foo?bar', 'foo#bar', 123]) {
    await assert.rejects(initCountdown({ event }), /invalid event name/);
  }
  assert.equal(fetchMock.mock.callCount(), 0, 'invalid names must never reach fetch');

  for (const event of ['default', 'bastard-hero', 'test_heart', 'Abc123']) {
    logMock.mock.resetCalls();
    await assert.rejects(initCountdown({ event }), networkError);
    assert.equal(fetchMock.mock.calls.at(-1).arguments[0], `static/data/countdown/${event}.json`);
    assert.deepEqual(logMock.mock.calls[0].arguments, [
      '[CountdownWidget] Error loading config for event:', event, networkError,
    ]);
  }
});
