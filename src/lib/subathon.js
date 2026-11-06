/**
 * /api/subathon -> { subs, leaderboard, updatedAt, source }, subs in Twitch sub
 * points (T1/Prime=1, T2=2, T3=6), leaderboard = gifters by gifted-sub count.
 *
 * Sources, first that answers wins:
 *   1. streamelements: SE activity feed (STREAMELEMENTS_JWT secret). SE records
 *      subs server-side, so off-stream gifts are included. No hand edits needed.
 *   2. celeste_tts_bot + offline_adjustment (below), leaderboard from subathon.json.
 *   3. baseline: `subs` + `leaderboard` in subathon.json as committed.
 *
 * bot total = celeste_tts_bot's /api/subathon-points (every sub the bot saw in the
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

const SE_API = 'https://api.streamelements.com/kappa/v2';
const SE_CHANNEL_ID = '643709c0887dfafe5b7c151a'; // whykusanagi; public id, from /channels/me
export const SUBATHON_WINDOW = { after: '2026-10-24T00:00:00Z', before: '2026-11-22T00:00:00Z' };
const TIER_POINTS = { prime: 1, 1000: 1, 2000: 2, 3000: 6 };

/**
 * SE subscriber activities -> { points, leaderboard, rows }. SE returns one row per
 * gift recipient (data.sender = gifter); non-gift `amount` is months, not subs.
 * Shared with scripts/se-subathon.mjs.
 */
export function summarizeSeActivities(activities) {
  const gifters = new Map();
  const rows = [];
  let points = 0;
  for (const { createdAt, data = {} } of activities) {
    const tier = TIER_POINTS[String(data.tier ?? '1000').toLowerCase()] ?? 1;
    const giver = data.sender || data.username;
    const gifted = Boolean(data.gifted || data.bulkGifted || (data.sender && data.sender !== data.username));
    const count = gifted ? nonNegativeInteger(data.amount, 1) || 1 : 1;
    points += count * tier;
    if (gifted) gifters.set(giver, (gifters.get(giver) || 0) + count);
    rows.push({ createdAt, giver, recipient: data.username, gifted, count, tier: data.tier, points: count * tier, months: data.amount });
  }
  const leaderboard = [...gifters].sort((a, b) => b[1] - a[1]).map(([name, gifted]) => ({ name, gifted }));
  return { points, leaderboard, rows };
}

// ponytail: no caching; a handful of overlay/page polls per minute is well inside
// SE's rate limit. Add caches.default with a 30s TTL if traffic grows.
export async function fetchSeActivities(token, window = SUBATHON_WINDOW) {
  // types must be a plain param; a JSON array silently returns [].
  const q = new URLSearchParams({ ...window, limit: '500', types: 'subscriber' });
  const response = await fetch(`${SE_API}/activities/${SE_CHANNEL_ID}?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`streamelements returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('streamelements returned a non-array');
  return body;
}

function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function mergeSubathonCount(baseline, bot, se = null) {
  const updatedAt = new Date().toISOString();
  if (se) return { subs: se.points, leaderboard: se.leaderboard, updatedAt, source: 'streamelements' };
  const leaderboard = Array.isArray(baseline?.leaderboard) ? baseline.leaderboard : [];
  const points = Number(bot?.points);
  if (Number.isSafeInteger(points) && points >= 0) {
    return { subs: nonNegativeInteger(baseline?.offline_adjustment) + points, leaderboard, updatedAt, source: 'celeste_tts_bot' };
  }
  return { subs: nonNegativeInteger(baseline?.subs), leaderboard, updatedAt, source: 'baseline' };
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

  let se = null;
  if (env.STREAMELEMENTS_JWT) {
    try {
      se = summarizeSeActivities(await fetchSeActivities(env.STREAMELEMENTS_JWT));
    } catch (error) {
      console.error('[subathon] streamelements fetch failed; falling back to bot', error);
    }
  }

  let bot = null;
  if (!se) {
    try {
      bot = await fetchBotPoints(env);
    } catch (error) {
      console.error('[subathon] celeste_tts_bot fetch failed', error);
    }
  }

  return new Response(JSON.stringify(mergeSubathonCount(baseline, bot, se)), {
    headers: JSON_HEADERS,
  });
}
