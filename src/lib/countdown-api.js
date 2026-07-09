/**
 * Countdown API Handlers
 * Cloudflare Worker endpoints for programmatic countdown URL generation.
 *
 * GET  /api/countdown/presets  — List available characters, themes, overlays, shapes
 * POST /api/countdown/generate — Validate params and return a formatted countdown URL
 */

// Preset JSONs are served by the static site (same zone). Cloudflare Workers
// subrequests to the same zone bypass the Worker, avoiding circular routing.
const PRESET_BASE_URL = 'https://whykusanagi.xyz/static/data/countdown';
const COUNTDOWN_BASE_URL = 'https://whykusanagi.xyz/countdown.html';
const VALID_SHAPES = ['diamond', 'circle', 'hexagon', 'star', 'heart'];
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Fetch a preset JSON file from S3 origin with caching
 * @param {string} filename - e.g., 'characters.json'
 * @returns {Promise<Object|null>}
 */
async function fetchPreset(filename) {
  try {
    const response = await fetch(`${PRESET_BASE_URL}/${filename}`, {
      cf: { cacheTtl: 300 }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch preset ${filename}:`, error);
    return null;
  }
}

/**
 * GET /api/countdown/presets
 * Returns all available presets for consumers to discover options.
 */
export async function handleCountdownPresets(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const [characters, themes, overlays] = await Promise.all([
    fetchPreset('characters.json'),
    fetchPreset('themes.json'),
    fetchPreset('overlays.json'),
  ]);

  const body = {
    characters: characters || {},
    themes: themes || {},
    overlays: overlays || {},
    shapes: VALID_SHAPES,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...CORS_HEADERS,
    },
  });
}

/**
 * POST /api/countdown/generate
 * Validates params against preset files and returns a formatted countdown URL.
 *
 * Request body (all fields optional):
 *   { event, theme, character, overlay, shape, date, title }
 *
 * Response:
 *   { url, params, warnings }
 */
export async function handleCountdownGenerate(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const [characters, themes, overlays] = await Promise.all([
    fetchPreset('characters.json'),
    fetchPreset('themes.json'),
    fetchPreset('overlays.json'),
  ]);

  const params = {};
  const warnings = [];

  // Validate event (check if preset file exists)
  if (body.event) {
    const eventData = await fetchPreset(`${body.event}.json`);
    if (eventData) {
      params.event = body.event;
    } else {
      warnings.push(`event '${body.event}' not found in presets, ignored`);
    }
  }

  // Validate theme
  if (body.theme) {
    if (themes && themes[body.theme]) {
      params.theme = body.theme;
    } else {
      warnings.push(`theme '${body.theme}' not found in presets, ignored`);
    }
  }

  // Validate character
  if (body.character) {
    if (characters && characters[body.character]) {
      params.character = body.character;
    } else {
      warnings.push(`character '${body.character}' not found in presets, ignored`);
    }
  }

  // Validate overlay
  if (body.overlay) {
    if (overlays && overlays[body.overlay]) {
      params.overlay = body.overlay;
    } else {
      warnings.push(`overlay '${body.overlay}' not found in presets, ignored`);
    }
  }

  // Validate shape
  if (body.shape) {
    if (VALID_SHAPES.includes(body.shape)) {
      params.shape = body.shape;
    } else {
      warnings.push(`shape '${body.shape}' not valid (options: ${VALID_SHAPES.join(', ')}), ignored`);
    }
  }

  // Validate date (ISO8601)
  if (body.date) {
    const parsed = new Date(body.date);
    if (!isNaN(parsed.getTime())) {
      params.date = body.date;
    } else {
      warnings.push(`date '${body.date}' is not valid ISO8601, ignored`);
    }
  }

  // Validate title (sanitize)
  if (body.title) {
    const sanitized = String(body.title).replace(/<[^>]*>/g, '').substring(0, 200);
    if (sanitized.length > 0) {
      params.title = sanitized;
    }
  }

  // Validate objectPosition (CSS object-position value for image framing)
  if (body.objectPosition) {
    const validPositions = /^(center|top|bottom|left|right|\d+%?)(\s+(center|top|bottom|left|right|\d+%?))?$/;
    const pos = String(body.objectPosition).trim();
    if (validPositions.test(pos)) {
      params.objectPosition = pos;
    } else {
      warnings.push(`objectPosition '${pos}' not valid CSS position, ignored`);
    }
  }

  // Validate bg (background mode)
  if (body.bg) {
    const validBg = ['black'];
    if (validBg.includes(body.bg)) {
      params.bg = body.bg;
    } else {
      warnings.push(`bg '${body.bg}' not valid (options: ${validBg.join(', ')}), ignored`);
    }
  }

  // Build URL
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    urlParams.set(key, value);
  }

  const url = urlParams.toString()
    ? `${COUNTDOWN_BASE_URL}?${urlParams.toString()}`
    : COUNTDOWN_BASE_URL;

  return new Response(JSON.stringify({ url, params, warnings }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
