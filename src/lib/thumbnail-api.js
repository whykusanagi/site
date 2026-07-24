/**
 * /api/thumbnail — renders the thumbnail generator headlessly and returns a PNG.
 *
 * The generator page (tools/thumbnail-generator/index.html) already takes its
 * entire state from query parameters, so this endpoint is a thin shim: forward
 * the caller's query to the page, screenshot it via the Browser Rendering
 * binding, stream the PNG back.
 *
 * Uses the `BROWSER` binding (wrangler.toml `[browser]`) — no API token. The
 * binding is granted at deploy time, so there is nothing to configure at
 * runtime beyond the binding existing.
 */

const GENERATOR_URL = 'https://whykusanagi.xyz/tools/thumbnail-generator/index.html';

// Mirrors ASPECT_RATIOS in tools/thumbnail-generator/index.html.
// ponytail: duplicated rather than fetched — five constants that change ~never.
const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080 },
  '2:1':  { width: 1920, height: 960  },
  '1:1':  { width: 1920, height: 1920 },
  '4:5':  { width: 1920, height: 2400 },
  '9:16': { width: 1080, height: 1920 },
};
const DEFAULT_ASPECT_RATIO = '16:9';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleThumbnail(request, env, ctx) {
  if (!env.BROWSER) {
    return json({ error: 'Thumbnail rendering is not configured' }, 503);
  }

  const params = new URLSearchParams(new URL(request.url).search);

  // Only seeded renders are cacheable. Without ?seed= the whole point is a
  // fresh roll of the dice per call, so caching would pin one image forever.
  // Params are sorted so callers passing them in a different order still share
  // an entry.
  const cacheable = Boolean(params.get('seed'));
  const cache = caches.default;
  let cacheKey;
  if (cacheable) {
    params.sort();
    cacheKey = new Request(`${new URL(request.url).origin}/api/thumbnail?${params}`);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const aspectRatio = params.get('aspectRatio') || DEFAULT_ASPECT_RATIO;
  const viewport = ASPECT_RATIOS[aspectRatio];
  if (!viewport) {
    return json({
      error: 'Unknown aspectRatio',
      supported: Object.keys(ASPECT_RATIOS),
    }, 400);
  }

  // Only the query is caller-supplied; the origin and path are fixed, so there
  // is no SSRF surface. The generator page validates every parameter itself and
  // falls back to defaults for anything invalid.
  const target = `${GENERATOR_URL}?${params.toString()}`;

  // quickAction("screenshot", ...) takes the same options as the REST
  // /screenshot endpoint and returns a Response whose body is the image.
  let rendered;
  try {
    rendered = await env.BROWSER.quickAction('screenshot', {
      url: target,
      viewport,
      // The page sets data-thumb-ready only once loadState() has applied the
      // query params and images/fonts have settled. loadState() runs behind
      // `await initComponents()` plus a 100ms timer, so without this gate the
      // screenshot races it and silently captures page defaults.
      //
      // Timeout is a CEILING, not a fixed wait — it resolves the instant the
      // selector appears, so a high ceiling never slows a fast render. Set near
      // Browser Rendering's 60s max because a cold capture pulls several MB of
      // character/background PNGs; heavy combos (warning overlay + dense
      // particles + a big bg) were blowing a 25s ceiling and 422-ing.
      // ponytail: raise the ceiling now; the real fix is lighter assets.
      waitForSelector: { selector: 'body[data-thumb-ready]', timeout: 55000 },
      screenshotOptions: { type: 'png' },
      gotoOptions: { waitUntil: 'domcontentloaded', timeout: 55000 },
    });
  } catch (err) {
    console.error('Browser Rendering binding threw:', err?.stack || err);
    return json({ error: 'Thumbnail render failed', detail: String(err) }, 502);
  }

  if (!rendered.ok) {
    // Body may be JSON or text depending on where it failed; log verbatim.
    console.error('Browser Rendering failed:', rendered.status, await rendered.clone().text());
    return json({ error: 'Thumbnail render failed', status: rendered.status }, 502);
  }

  const response = new Response(rendered.body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="thumbnail-${aspectRatio.replace(':', 'x')}.png"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });

  if (cacheable) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}
