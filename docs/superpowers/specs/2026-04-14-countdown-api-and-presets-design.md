# Countdown Widget: Complete URL Params, Hero Image Presets & API Endpoint

**Created:** 2026-04-14
**Status:** Design Complete, Ready for Implementation

## Goal

Complete the countdown widget's URL parameter system (4 missing params), expand character presets to include all thumbnail generator hero images (~57), and add a Cloudflare Worker API endpoint so external consumers (TTS bot, LLMs, Twitch integrations) can programmatically generate countdown URLs.

## Problems Solved

1. **Incomplete URL API** — only 3 of 7 documented params work (`event`, `date`, `title`). The remaining 4 (`theme`, `character`, `overlay`, `shape`) have design docs and JSON presets but no implementation.
2. **Limited character selection** — only 4 characters (celeste, kirara, bastard-hero, none) when the thumbnail generator already has ~57 images organized into full-body, tarot cards, and headshots.
3. **No programmatic access** — countdown URLs must be hand-crafted. An HTTP API lets any consumer (TTS bot, LLM, curl) generate valid countdown URLs with validation.
4. **Adding new presets is manual** — need a clear, repeatable pattern: edit one JSON file + upload image to S3, done.

## Sub-Projects

This decomposes into two sequential sub-projects:

### Sub-project 1: Complete URL Params + Hero Image Presets (client-side)
- Implement `?theme=`, `?character=`, `?overlay=`, `?shape=` in countdown-widget.js
- Expand characters.json with all thumbnail generator images
- Pure client-side, no backend changes

### Sub-project 2: Countdown API Endpoint (Cloudflare Worker)
- Add `/api/countdown/generate` POST endpoint
- Add `/api/countdown/presets` GET endpoint
- Worker validates params and returns formatted URLs

---

## Sub-project 1: Complete URL Params + Hero Image Presets

### Architecture

The countdown widget already has this flow:

```
URL params → loadConfigFromJson(event) → applyUrlOverrides(config) → renderWidget(config)
```

Currently `applyUrlOverrides()` only handles `date` and `title`. The change adds `theme`, `character`, `overlay`, and `shape` by loading their respective JSON preset files and merging into config.

### URL Parameter API (Complete)

```
/countdown?event=kirara&theme=abyss&character=celeste-nurse&overlay=tentacle&shape=hexagon&title=Stream+Soon&date=2026-12-25T19:00:00-08:00
```

| Param | Type | Description | Validates Against |
|-------|------|-------------|-------------------|
| `event` | string | Load full preset (existing) | `static/data/countdown/<name>.json` file existence |
| `date` | ISO8601 | Override event date (existing) | Date parsing |
| `title` | string | Override title text (existing) | URL-decoded string |
| `theme` | string | Color theme preset (**new**) | `themes.json` keys |
| `character` | string | Character image preset (**new**) | `characters.json` keys |
| `overlay` | string | Overlay image preset (**new**) | `overlays.json` keys |
| `shape` | string | Container shape (**new**) | Hardcoded list: diamond, circle, hexagon, star, heart |

**Priority:** URL params override event preset values. Invalid values fall back to defaults (no error).

**Security:** All image references resolve to predefined S3 paths in JSON presets. No user-supplied file paths reach URL construction.

### New Helper Functions

Add to `countdown-widget.js`, before `applyUrlOverrides()`:

```javascript
async function loadPresetFile(filename) {
  const basePath = WIDGET_OPTIONS.configBasePath || 'static/data/countdown';
  const response = await fetch(resolveAssetPath(`${basePath}/${filename}`));
  if (!response.ok) return null;
  return response.json();
}

async function applyThemePreset(config, themeName) {
  const themes = await loadPresetFile('themes.json');
  if (!themes) return;
  const theme = themes[themeName];
  if (!theme) return;
  config.colors = { ...config.colors, ...theme.colors };
}

async function applyCharacterPreset(config, characterName) {
  const characters = await loadPresetFile('characters.json');
  if (!characters) return;
  const character = characters[characterName];
  if (!character) return;
  config.character = config.character || {};
  if (character.image !== undefined) config.character.image = character.image;
  if (character.objectPosition) config.character.objectPosition = character.objectPosition;
  if (character.rotation !== undefined) config.character.rotation = character.rotation;
}

async function applyOverlayPreset(config, overlayName) {
  const overlays = await loadPresetFile('overlays.json');
  if (!overlays) return;
  const overlay = overlays[overlayName];
  if (!overlay) return;
  config.character = config.character || {};
  config.character.overlay = overlay.image ? {
    image: overlay.image,
    position: overlay.position,
    animation: overlay.animation
  } : null;
}
```

### Modified `applyUrlOverrides()`

Change from sync to async. Apply preset params before scalar overrides so `?date` and `?title` always win:

```javascript
async function applyUrlOverrides(config) {
  // Preset-based overrides (load JSON, merge)
  const themeParam = getUrlParam('theme');
  if (themeParam) await applyThemePreset(config, themeParam);

  const characterParam = getUrlParam('character');
  if (characterParam) await applyCharacterPreset(config, characterParam);

  const overlayParam = getUrlParam('overlay');
  if (overlayParam) await applyOverlayPreset(config, overlayParam);

  const shapeParam = getUrlParam('shape');
  if (shapeParam) {
    const validShapes = ['diamond', 'circle', 'hexagon', 'star', 'heart'];
    if (validShapes.includes(shapeParam)) {
      config.character = config.character || {};
      config.character.background = config.character.background || {};
      config.character.background.type = shapeParam;
    }
  }

  // Scalar overrides (always win)
  const dateOverride = getUrlParam('date');
  if (dateOverride) config.eventDate = dateOverride;

  const titleOverride = getUrlParam('title');
  if (titleOverride) config.title = decodeURIComponent(titleOverride);

  return config;
}
```

**Note:** `initCountdown()` must `await applyUrlOverrides(config)` since it's now async. The function is already inside an async context (line 519).

### Expanded `characters.json`

The S3 base path for thumbnail generator characters is:
`https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/characters/`

The existing countdown characters use paths like `art/Celeste_Vel_Icon.png` (relative to S3 root). The new characters will use the full thumbnail-generator path.

**Naming convention for slugs:** filename without extension, lowercase, hyphens for underscores. Category prefix for tarot/headshot variants.

```json
{
  "celeste": {
    "image": "art/Celeste_Vel_Icon.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "kirara": {
    "image": "art/Fall_of_Kirara.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "bastard-hero": {
    "image": "art/bastard_hero.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "celeste-legs": {
    "image": "tools/thumbnail-generator/assets/characters/Celeste_Legs.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "abyssal-conquest": {
    "image": "tools/thumbnail-generator/assets/characters/Abyssal_Conquest.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "...all other fullbody, tarot, headshot images following same pattern..."
  "none": {
    "image": null,
    "category": "utility"
  }
}
```

**Adding new images (the repeatable pattern):**
1. Upload image to S3: `s3cmd -c ~/.s3r2 put new_image.png s3://whykusanagi/tools/thumbnail-generator/assets/characters/new_image.png`
2. Add entry to `static/data/countdown/characters.json` with slug, path, and category
3. (Optional) Add filename to `tools/thumbnail-generator/index.html` CHARACTER_IMAGES array if it should also appear in the thumbnail generator
4. Commit and deploy

Both tools read from the same S3 image directory. The countdown uses JSON presets; the thumbnail generator uses a JS array. Same images, different access patterns.

### Theme Color Application

The existing design doc specifies that theme colors should be applied via inline styles in `renderWidget()`. The countdown title and timer elements need to pick up `config.colors.title` and `config.colors.countdown`:

In `renderWidget()`, when creating the title element:
```javascript
if (config.colors?.title) {
  titleEl.style.color = config.colors.title;
}
```

When creating the timer element:
```javascript
if (config.colors?.countdown) {
  timerEl.style.color = config.colors.countdown;
}
```

This fixes the grey title and pink-on-pink contrast issues noted in the original design doc.

---

## Sub-project 2: Countdown API Endpoint

### Architecture

Add two routes to the existing Cloudflare Worker at `src/index.js`:

```
GET  /api/countdown/presets   → Returns available characters, themes, overlays, shapes
POST /api/countdown/generate  → Validates params, returns countdown URL
```

The Worker fetches the JSON preset files from the origin (same static files the widget reads) and uses them for validation. This means the Worker and the client-side widget always agree on what's valid.

### `GET /api/countdown/presets`

Returns the full preset catalog so consumers can discover what's available.

**Response:**
```json
{
  "characters": {
    "celeste": { "category": "original", "image": "art/Celeste_Vel_Icon.png" },
    "celeste-legs": { "category": "fullbody", "image": "tools/thumbnail-generator/assets/characters/Celeste_Legs.png" },
    "...": "..."
  },
  "themes": {
    "corrupted": { "name": "Corrupted Default" },
    "abyss": { "name": "Deep Abyss" },
    "sakura": { "name": "Sakura Bloom" }
  },
  "overlays": {
    "tentacle": { "name": "Tentacle Foil" },
    "none": { "name": "No Overlay" }
  },
  "shapes": ["diamond", "circle", "hexagon", "star", "heart"]
}
```

**Implementation:** Worker fetches `characters.json`, `themes.json`, `overlays.json` from origin, combines them with the hardcoded shapes list, and returns the merged response. Responses are cached (Cache-Control: 5 min) since presets change infrequently.

### `POST /api/countdown/generate`

**Request:**
```json
{
  "event": "kirara",
  "theme": "abyss",
  "character": "celeste-nurse",
  "overlay": "tentacle",
  "shape": "hexagon",
  "date": "2026-12-25T19:00:00-08:00",
  "title": "Stream Starting Soon"
}
```

All fields optional. At minimum, either `event` or `date` should be provided for a useful countdown.

**Validation:**
- `event`: check that `static/data/countdown/<event>.json` exists (fetch, check 200)
- `theme`: validate against `themes.json` keys
- `character`: validate against `characters.json` keys
- `overlay`: validate against `overlays.json` keys
- `shape`: validate against hardcoded list
- `date`: validate ISO8601 format with `new Date()` parsing
- `title`: sanitize (strip HTML, max 200 chars)

Invalid values are silently dropped (not included in URL). The widget's client-side fallbacks handle missing params gracefully.

**Response (success):**
```json
{
  "url": "https://whykusanagi.xyz/countdown?event=kirara&theme=abyss&character=celeste-nurse&overlay=tentacle&shape=hexagon&date=2026-12-25T19%3A00%3A00-07%3A00&title=Stream+Starting+Soon",
  "params": {
    "event": "kirara",
    "theme": "abyss",
    "character": "celeste-nurse",
    "overlay": "tentacle",
    "shape": "hexagon",
    "date": "2026-12-25T19:00:00-08:00",
    "title": "Stream Starting Soon"
  },
  "warnings": []
}
```

**Response (with warnings):**
```json
{
  "url": "https://whykusanagi.xyz/countdown?event=kirara&date=2026-12-25T19%3A00%3A00-07%3A00",
  "params": {
    "event": "kirara",
    "date": "2026-12-25T19:00:00-08:00"
  },
  "warnings": [
    "character 'invalid-name' not found in presets, ignored",
    "shape 'triangle' not valid, ignored"
  ]
}
```

### Worker Implementation Pattern

The Worker already handles `/api/chat` and `/api/health`. The new routes follow the same pattern:

```javascript
// In the fetch handler's URL routing
if (url.pathname === '/api/countdown/presets' && request.method === 'GET') {
  return handleCountdownPresets(request, env);
}
if (url.pathname === '/api/countdown/generate' && request.method === 'POST') {
  return handleCountdownGenerate(request, env);
}
```

**Preset fetching:** The Worker must NOT fetch from `whykusanagi.xyz` (would route back through itself). Options: (1) use `env.ASSETS.fetch()` if Cloudflare Pages asset binding is available, (2) fetch from S3 origin directly (`https://s3.whykusanagi.xyz/static/data/countdown/`), or (3) inline the preset data at deploy time. Implementation plan will determine which works for this deployment setup. Regardless of method, cache the combined preset response (Cache API, 5 min TTL) since presets change infrequently.

**CORS:** Same as existing endpoints — `Access-Control-Allow-Origin: *`.

### Adding New Presets (Complete Pattern)

To add a new character image to both tools:

1. **Upload to S3:**
   ```bash
   s3cmd -c ~/.s3r2 put new_character.png s3://whykusanagi/tools/thumbnail-generator/assets/characters/new_character.png
   ```

2. **Add to countdown presets** (`static/data/countdown/characters.json`):
   ```json
   "new-character": {
     "image": "tools/thumbnail-generator/assets/characters/new_character.png",
     "objectPosition": "center center",
     "rotation": 0,
     "category": "fullbody"
   }
   ```

3. **Add to thumbnail generator** (`tools/thumbnail-generator/index.html`):
   ```javascript
   // In CHARACTER_IMAGES array:
   'new_character.png',
   ```

4. **Commit & deploy** — `git push` triggers Cloudflare Workers deploy. Both tools pick up the new image. The API's `/presets` endpoint automatically includes it.

Steps 2 and 3 are independent — you can add to one tool without the other.

---

## Testing

### Sub-project 1: Manual Browser Testing

```
# Basic preset
/countdown?event=kirara

# Theme override
/countdown?event=kirara&theme=abyss

# New character from thumbnail generator
/countdown?event=default&character=celeste-nurse&shape=circle&date=2026-05-01T19:00:00-07:00

# Headshot character
/countdown?character=headshot-excited&theme=sakura&shape=heart&title=Valentine+Stream&date=2026-02-14T18:00:00-08:00

# Full combo
/countdown?event=kirara&theme=abyss&character=celeste-legs&overlay=tentacle&shape=hexagon

# Invalid values (should fallback gracefully, no errors)
/countdown?event=kirara&character=nonexistent&theme=fake&shape=triangle
```

### Sub-project 2: API Testing

```bash
# Get presets
curl https://whykusanagi.xyz/api/countdown/presets | jq .

# Generate URL
curl -X POST https://whykusanagi.xyz/api/countdown/generate \
  -H "Content-Type: application/json" \
  -d '{"character":"celeste-nurse","theme":"abyss","date":"2026-05-01T19:00:00-07:00","title":"Stream Starting"}'

# Invalid params (should return URL with warnings)
curl -X POST https://whykusanagi.xyz/api/countdown/generate \
  -H "Content-Type: application/json" \
  -d '{"character":"hacker","shape":"triangle"}'
```

---

## Files Changed

### Sub-project 1
| Action | File |
|--------|------|
| Modify | `assets/js/countdown-widget.js` — add preset loading helpers, make `applyUrlOverrides` async, add theme/character/overlay/shape params |
| Modify | `static/data/countdown/characters.json` — expand from 4 to ~58 presets |
| Modify | `assets/js/countdown-widget.js` renderWidget() — apply theme colors to title/timer elements |

### Sub-project 2
| Action | File |
|--------|------|
| Modify | `src/index.js` — add `/api/countdown/presets` and `/api/countdown/generate` route handlers |

---

## Future Enhancements (Out of Scope)

- `?popup=false` to disable popup notifications
- `?compact=true` for minimal layout
- More themes (neon, celestial, blood)
- Server-side rendering (screenshot to PNG for Discord embeds)
- MCP tool wrapper around the HTTP API
- Twitch bot direct integration
