/**
 * /api/thumbnail — renders the thumbnail generator headlessly and returns a PNG.
 *
 * The generator page (tools/thumbnail-generator/index.html) already takes its
 * entire state from query parameters, so this endpoint is a thin shim: forward
 * the caller's query to the page, screenshot it via Cloudflare Browser
 * Rendering, stream the PNG back.
 *
 * Requires two Worker secrets (`wrangler secret put`):
 *   CF_ACCOUNT_ID            - the Cloudflare account id
 *   BROWSER_RENDERING_TOKEN  - API token with "Browser Rendering - Edit"
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

export async function handleThumbnail(request, env) {
  if (!env.CF_ACCOUNT_ID || !env.BROWSER_RENDERING_TOKEN) {
    return json({ error: 'Thumbnail rendering is not configured' }, 503);
  }

  const params = new URLSearchParams(new URL(request.url).search);

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

  const rendered = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.BROWSER_RENDERING_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: target,
        viewport,
        // The page sets data-thumb-ready only once loadState() has applied the
        // query params and images/fonts have settled. loadState() runs behind
        // `await initComponents()` plus a 100ms timer, so without this gate the
        // screenshot races it and silently captures page defaults.
        waitForSelector: { selector: 'body[data-thumb-ready]', timeout: 25000 },
        screenshotOptions: { type: 'png' },
        gotoOptions: { waitUntil: 'domcontentloaded', timeout: 30000 },
      }),
    },
  );

  if (!rendered.ok) {
    // Body may be JSON or text depending on where it failed; log verbatim.
    console.error('Browser Rendering failed:', rendered.status, await rendered.text());
    return json({ error: 'Thumbnail render failed', status: rendered.status }, 502);
  }

  return new Response(rendered.body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="thumbnail-${aspectRatio.replace(':', 'x')}.png"`,
      // Renders are deterministic per query string, so let the edge hold them.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
