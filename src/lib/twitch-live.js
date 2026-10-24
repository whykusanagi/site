/**
 * /api/twitch-live → { live, uptime } for whykusanagi.
 *
 * Uses decapi.me's public uptime endpoint (no Twitch credentials needed). It
 * answers "<channel> is offline" or a duration like "1 hour, 4 minutes".
 * ponytail: swap to Helix /streams with an app token if decapi ever goes away.
 */
const CHANNEL = 'whykusanagi';

export function parseUptime(text) {
  const t = String(text).trim();
  if (!t || /offline/i.test(t)) return { live: false, uptime: null };
  if (/error|not found|invalid/i.test(t)) return null;
  return { live: true, uptime: t };
}

export async function handleTwitchLive() {
  let body = { live: null, uptime: null };
  try {
    const res = await fetch(`https://decapi.me/twitch/uptime/${CHANNEL}`, { cf: { cacheTtl: 60 } });
    if (res.ok) body = parseUptime(await res.text()) || body;
  } catch (e) {
    console.error('[twitch-live] upstream failed', e);
  }
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
}
