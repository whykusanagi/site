import test from 'node:test';
import assert from 'node:assert/strict';
import { countGiftedSubs, handleSubathon, mergeSubathonCount } from '../src/lib/subathon.js';

test('counts only gifted subscriptions in a Celeste credits session', () => {
  assert.equal(countGiftedSubs({
    new_subs: [
      { is_gift: true },
      { is_gift: false },
      { is_gift: true },
      null,
    ],
  }), 2);
});

test('adds an active Celeste session to the committed baseline', () => {
  const result = mergeSubathonCount(
    { subs: 7, included_session_id: 'old-session' },
    { session_id: 'current-session', new_subs: [{ is_gift: true }, { is_gift: true }] },
  );
  assert.equal(result.subs, 9);
  assert.equal(result.source, 'celeste_tts_bot');
});

test('does not double-count a session already included in the baseline', () => {
  const result = mergeSubathonCount(
    { subs: 9, included_session_id: 'current-session' },
    { session_id: 'current-session', new_subs: [{ is_gift: true }, { is_gift: true }] },
  );
  assert.equal(result.subs, 9);
  assert.equal(result.source, 'baseline');
});

test('uses the committed baseline when Celeste is unavailable', () => {
  assert.equal(mergeSubathonCount({ subs: 7 }, null).subs, 7);
});

test('fetches Celeste credits server-side and returns only the merged count', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/static/data/subathon.json') {
      return Response.json({ subs: 7, included_session_id: 'old-session' });
    }
    assert.equal(url.href, 'https://celeste.example/api/credits');
    assert.equal(init.headers['CF-Access-Client-Id'], 'client-id');
    assert.equal(init.headers['CF-Access-Client-Secret'], 'client-secret');
    return Response.json({
      session_id: 'current-session',
      new_subs: [{ is_gift: true }, { is_gift: false }, { is_gift: true }],
    });
  };

  try {
    const response = await handleSubathon(
      new Request('https://whykusanagi.xyz/api/subathon'),
      {
        CELESTE_TTS_BOT_CREDITS_URL: 'https://celeste.example/api/credits',
        CELESTE_TTS_BOT_ACCESS_CLIENT_ID: 'client-id',
        CELESTE_TTS_BOT_ACCESS_CLIENT_SECRET: 'client-secret',
      },
    );
    const body = await response.json();
    assert.equal(body.subs, 9);
    assert.equal(body.source, 'celeste_tts_bot');
    assert.match(body.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns the baseline when the Celeste endpoint is offline', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === '/static/data/subathon.json') return Response.json({ subs: 7 });
    throw new Error('offline');
  };
  console.error = () => {};

  try {
    const response = await handleSubathon(
      new Request('https://whykusanagi.xyz/api/subathon'),
      { CELESTE_TTS_BOT_CREDITS_URL: 'https://celeste.example/api/credits' },
    );
    assert.equal((await response.json()).subs, 7);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
