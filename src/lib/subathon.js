/**
 * /api/subathon -> subathon total in Twitch sub points (T1=1, T2=2, T3=6).
 *
 * total = celeste_tts_bot's /api/subathon-points (every sub the bot saw in the
 *         subathon window, summed over its saved stream sessions on quasar)
 *       + static/data/subathon.json `offline_adjustment` (subs the bot never saw,
 *         e.g. gifts while it wasn't running; edit by hand from the Twitch feed).
 *
 * If the bot endpoint is unreachable, `subs` in subathon.json is served as-is, so
 * keep it equal to the last known total when you edit the adjustment.
 *
 * The bot endpoint sits behind Cloudflare Access on the quasar tunnel. Its URL is
 * derived from CELESTE_TTS_BOT_CREDITS_URL (same host, /api/subathon-points).
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function mergeSubathonCount(baseline, bot) {
  const points = Number(bot?.points);
  if (Number.isSafeInteger(points) && points >= 0) {
    return {
      subs: nonNegativeInteger(baseline?.offline_adjustment) + points,
      updatedAt: new Date().toISOString(),
      source: 'celeste_tts_bot',
    };
  }
  return {
    subs: nonNegativeInteger(baseline?.subs),
    updatedAt: new Date().toISOString(),
    source: 'baseline',
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

export async function fetchBotPoints(env) {
  if (!env.CELESTE_TTS_BOT_CREDITS_URL) return null;
  const pointsUrl = new URL('/api/subathon-points', env.CELESTE_TTS_BOT_CREDITS_URL);

  const headers = { Accept: 'application/json' };
  if (env.CELESTE_TTS_BOT_ACCESS_CLIENT_ID && env.CELESTE_TTS_BOT_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = env.CELESTE_TTS_BOT_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = env.CELESTE_TTS_BOT_ACCESS_CLIENT_SECRET;
  }

  const response = await fetch(pointsUrl, {
    headers,
    redirect: 'manual', // an Access login redirect means auth failed, not data
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`celeste_tts_bot returned ${response.status}`);
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

  let bot = null;
  try {
    bot = await fetchBotPoints(env);
  } catch (error) {
    console.error('[subathon] celeste_tts_bot fetch failed', error);
  }

  return new Response(JSON.stringify(mergeSubathonCount(baseline, bot)), {
    headers: JSON_HEADERS,
  });
}
