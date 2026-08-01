/**
 * /api/<tool> — renders a query-param-driven generator page headlessly and
 * returns a PNG.
 *
 * Each generator page already takes its entire state from query parameters, so
 * this endpoint is a thin shim: forward the caller's query to the page,
 * screenshot it via the Browser Rendering binding, stream the PNG back. The
 * only per-tool facts are in TOOLS below.
 *
 * Uses the `BROWSER` binding (wrangler.toml `[browser]`) — no API token. The
 * binding is granted at deploy time, so there is nothing to configure at
 * runtime beyond the binding existing.
 */

/**
 * Per-tool render config.
 *
 * `sizes` mirrors each page's own size table. ponytail: duplicated rather than
 * fetched — a handful of constants that change ~never. A drift between this
 * table and the page produces letterboxed PNGs rather than an error, so each
 * tool's table is asserted against its source in that tool's test.
 */
export const TOOLS = {
  thumbnail: {
    url: 'https://whykusanagi.xyz/tools/thumbnail-generator/index.html',
    // tools/thumbnail-generator/index.html sets this attribute only once
    // loadState() has applied the query params and images/fonts have
    // settled. loadState() runs behind `await initComponents()` plus a
    // 100ms timer — the source of the race the generic ready-selector
    // comment below warns about, for this tool specifically.
    ready: 'body[data-thumb-ready]',
    sizeParam: 'aspectRatio',
    defaultSize: '16:9',
    sizes: {
      '16:9': { width: 1920, height: 1080 },
      '2:1':  { width: 1920, height: 960  },
      '1:1':  { width: 1920, height: 1920 },
      '4:5':  { width: 1920, height: 2400 },
      '9:16': { width: 1080, height: 1920 },
    },
  },
  'micro-gfx': {
    // ?embed=1 is baked in: this is the screenshot-only view. handleRender
    // merges caller params via URL.searchParams, so this existing query is
    // preserved rather than clobbered.
    url: 'https://whykusanagi.xyz/tools/micro-gfx/index.html?embed=1',
    ready: 'body[data-gfx-ready]',
    sizeParam: 'format',
    defaultSize: 'card',
    // Must match MicroGfx.formats exactly — asserted by
    // tools/micro-gfx/test-micro-gfx.mjs, because a mismatch letterboxes the
    // PNG rather than erroring.
    sizes: {
      card:     { width: 1200, height: 630  },
      banner:   { width: 1500, height: 500  },
      poster:   { width: 1080, height: 1350 },
      portrait: { width: 1080, height: 1920 },
      square:   { width: 1080, height: 1080 },
    },
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleRender(request, env, ctx, toolName) {
  const cfg = TOOLS[toolName];
  if (!cfg) return json({ error: 'Unknown tool' }, 404);

  if (!env.BROWSER) {
    return json({ error: 'Thumbnail rendering is not configured' }, 503);
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  // Every distinct query caches its PNG — a render is a pure function of the
  // query, and re-booting a cold headless browser per call is the whole cost
  // (~25s), so a cache hit (~0.3s) is the entire optimization. Unseeded queries
  // cache too: the random particles/glitch are rolled once, then that image is
  // pinned for the query. Pass `nocache=1` to force a fresh render (e.g. to
  // re-roll an unseeded random); it's stripped from the key and the page URL so
  // it never fragments the cache or reaches the page.
  const bust = params.has('nocache');
  params.delete('nocache');
  params.sort(); // canonical key: callers passing params in any order share an entry
  const cache = caches.default;
  // Path-scoped so two tools with overlapping params cannot collide.
  const cacheKey = new Request(`${url.origin}/api/${toolName}?${params}`);
  if (!bust) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const size = params.get(cfg.sizeParam) || cfg.defaultSize;
  const viewport = cfg.sizes[size];
  if (!viewport) {
    return json({
      error: `Unknown ${cfg.sizeParam}`,
      supported: Object.keys(cfg.sizes),
    }, 400);
  }

  // Only the query is caller-supplied; the origin and path are fixed, so there
  // is no SSRF surface. The generator page validates every parameter itself and
  // falls back to defaults for anything invalid.
  //
  // Built with URL rather than string concatenation because a tool's configured
  // url may already carry its own query (e.g. `?embed=1`), which a second `?`
  // would corrupt. Appends rather than sets: for thumbnail, cfg.url carries no
  // query, so appending every caller param reproduces the old
  // `${GENERATOR_URL}?${params.toString()}` byte-for-byte, including any
  // duplicate keys in their relative order (params.sort() above is a stable
  // sort, so same-key duplicates keep their order relative to each other).
  // That parity matters because both the page's own `.get()` and this
  // function's `params.get(cfg.sizeParam)` above read the *first* occurrence
  // of a repeated key — set() would let a later duplicate silently win in the
  // forwarded URL while the viewport and Content-Disposition filename stayed
  // keyed off the first one, so the rendered image and its reported size
  // could disagree. This also means a caller cannot override a tool's own
  // baked-in query defaults (e.g. micro-gfx's embed=1) — that's intentional:
  // nothing caller-supplied should be able to switch off the screenshot path.
  const target = new URL(cfg.url);
  for (const [k, v] of params) target.searchParams.append(k, v);

  // Browser Rendering caches screenshots by target URL, so a bust must also
  // present a novel URL or BR just replays its cached shot (~0.4s) instead of
  // re-rendering. The page ignores the extra param. Only added on a bust, so it
  // never fragments the normal shared cache.
  if (bust) {
    target.searchParams.set('_cb', Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  }

  // quickAction("screenshot", ...) takes the same options as the REST
  // /screenshot endpoint and returns a Response whose body is the image.
  let rendered;
  try {
    rendered = await env.BROWSER.quickAction('screenshot', {
      url: target.toString(),
      viewport,
      // The page sets its ready flag only once it has applied the query params
      // and images/fonts have settled. Without this gate the screenshot races
      // that and silently captures page defaults.
      //
      // Timeout is a CEILING, not a fixed wait — it resolves the instant the
      // selector appears, so a high ceiling never slows a fast render. Set near
      // Browser Rendering's 60s max because a cold capture pulls several MB of
      // character/background PNGs; heavy combos (warning overlay + dense
      // particles + a big bg) were blowing a 25s ceiling and 422-ing.
      // ponytail: raise the ceiling now; the real fix is lighter assets.
      waitForSelector: { selector: cfg.ready, timeout: 55000 },
      screenshotOptions: { type: 'png' },
      gotoOptions: { waitUntil: 'domcontentloaded', timeout: 55000 },
    });
  } catch (err) {
    console.error('Browser Rendering binding threw:', err?.stack || err);
    return json({ error: 'Render failed', detail: String(err) }, 502);
  }

  if (!rendered.ok) {
    // Body may be JSON or text depending on where it failed; log verbatim.
    console.error('Browser Rendering failed:', rendered.status, await rendered.clone().text());
    return json({ error: 'Render failed', status: rendered.status }, 502);
  }

  const response = new Response(rendered.body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${toolName}-${size.replace(':', 'x')}.png"`,
      // no-store on a bust so Cloudflare's edge (which auto-caches any public
      // response) doesn't stash the forced-fresh render — otherwise nocache=1
      // would re-roll once and then be pinned again. 1h edge TTL otherwise; a
      // page/asset change takes up to that long to fully reflect in cached PNGs.
      'Cache-Control': bust ? 'no-store' : 'public, max-age=3600',
    },
  });

  if (!bust) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}
