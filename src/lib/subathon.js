/**
 * /api/subathon -> the committed subathon baseline plus the active Celeste
 * stream session's gifted subscriptions.
 *
 * celeste_tts_bot exposes its current credits session at /api/credits. Keep
 * that service behind Cloudflare Access (or another authenticated HTTPS
 * endpoint) and configure its URL with CELESTE_TTS_BOT_CREDITS_URL.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function countGiftedSubs(credits) {
  if (!credits || !Array.isArray(credits.new_subs)) return 0;
  return credits.new_subs.reduce(
    (total, subscription) => total + (subscription?.is_gift === true ? 1 : 0),
    0,
  );
}

export function mergeSubathonCount(baseline, credits) {
  const baselineSubs = nonNegativeInteger(baseline?.subs);
  const sessionId = typeof credits?.session_id === 'string' ? credits.session_id : '';
  const includedSessionId = typeof baseline?.included_session_id === 'string'
    ? baseline.included_session_id
    : '';
  const activeSessionSubs = sessionId && sessionId !== includedSessionId
    ? countGiftedSubs(credits)
    : 0;

  return {
    subs: baselineSubs + activeSessionSubs,
    updatedAt: new Date().toISOString(),
    source: activeSessionSubs > 0 ? 'celeste_tts_bot' : 'baseline',
  };
}

async function fetchBaseline(request) {
  const baselineUrl = new URL('/static/data/subathon.json', request.url);
  const response = await fetch(baselineUrl, {
    cf: { cacheEverything: true, cacheTtl: 60 },
  });
  if (!response.ok) throw new Error(`baseline returned ${response.status}`);
  return response.json();
}

export async function fetchCelesteCredits(env) {
  const creditsUrl = env.CELESTE_TTS_BOT_CREDITS_URL;
  if (!creditsUrl) return null;

  const headers = { Accept: 'application/json' };
  if (env.CELESTE_TTS_BOT_ACCESS_CLIENT_ID && env.CELESTE_TTS_BOT_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = env.CELESTE_TTS_BOT_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = env.CELESTE_TTS_BOT_ACCESS_CLIENT_SECRET;
  }
  if (env.CELESTE_TTS_BOT_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${env.CELESTE_TTS_BOT_AUTH_TOKEN}`;
  }

  const response = await fetch(creditsUrl, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`celeste_tts_bot returned ${response.status}`);

  const contentLength = nonNegativeInteger(response.headers.get('Content-Length'));
  if (contentLength > 262144) throw new Error('celeste_tts_bot response is too large');
  return response.json();
}

export async function handleSubathon(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: 'GET' },
    });
  }

  let baseline;
  try {
    baseline = await fetchBaseline(request);
  } catch (error) {
    console.error('[subathon] baseline fetch failed', error);
    return new Response(JSON.stringify({ error: 'Subathon count unavailable' }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }

  let credits = null;
  try {
    credits = await fetchCelesteCredits(env);
  } catch (error) {
    console.error('[subathon] celeste_tts_bot fetch failed', error);
  }

  return new Response(JSON.stringify(mergeSubathonCount(baseline, credits)), {
    headers: JSON_HEADERS,
  });
}
