import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSubathon, mergeSubathonCount } from '../src/lib/subathon.js';

test('adds the offline adjustment to the bot sub points', () => {
  const result = mergeSubathonCount({ subs: 17, offline_adjustment: 9 }, { points: 8 });
  assert.equal(result.subs, 17);
  assert.equal(result.source, 'celeste_tts_bot');
});

test('counts zero bot points as a real answer, not a fallback', () => {
  const result = mergeSubathonCount({ subs: 17, offline_adjustment: 9 }, { points: 0 });
  assert.equal(result.subs, 9);
  assert.equal(result.source, 'celeste_tts_bot');
});

test('falls back to the committed total when the bot answer is missing or bad', () => {
  for (const bot of [null, {}, { points: -1 }, { points: 'lots' }, { points: 1.5 }]) {
    const result = mergeSubathonCount({ subs: 17, offline_adjustment: 9 }, bot);
    assert.equal(result.subs, 17);
    assert.equal(result.source, 'baseline');
  }
});

test('fetches bot points server-side with the Access service token', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/static/data/subathon.json') {
      return Response.json({ subs: 17, offline_adjustment: 9 });
    }
    assert.equal(url.href, 'https://celeste.example/api/subathon-points');
    assert.equal(init.headers['CF-Access-Client-Id'], 'client-id');
    assert.equal(init.headers['CF-Access-Client-Secret'], 'client-secret');
    assert.equal(init.redirect, 'manual');
    return Response.json({ points: 11, sessions_with_subs: 2 });
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
    assert.equal(body.subs, 20);
    assert.equal(body.source, 'celeste_tts_bot');
    assert.match(body.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns the committed total when the bot endpoint is offline', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === '/static/data/subathon.json') return Response.json({ subs: 17, offline_adjustment: 9 });
    throw new Error('offline');
  };
  console.error = () => {};

  try {
    const response = await handleSubathon(
      new Request('https://whykusanagi.xyz/api/subathon'),
      { CELESTE_TTS_BOT_CREDITS_URL: 'https://celeste.example/api/credits' },
    );
    const body = await response.json();
    assert.equal(body.subs, 17);
    assert.equal(body.source, 'baseline');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('treats an Access login redirect as offline', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname === '/static/data/subathon.json') return Response.json({ subs: 17, offline_adjustment: 9 });
    return new Response(null, { status: 302, headers: { Location: 'https://whykusanagi.cloudflareaccess.com/' } });
  };
  console.error = () => {};

  try {
    const response = await handleSubathon(
      new Request('https://whykusanagi.xyz/api/subathon'),
      { CELESTE_TTS_BOT_CREDITS_URL: 'https://celeste.example/api/credits' },
    );
    assert.equal((await response.json()).source, 'baseline');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
