# Thumbnail Generator — Nikke City Background Themes

**Date:** 2026-05-01
**Status:** Spec — pending user review
**Owner:** whykusanagi

## Goal

Add a new background option to the YouTube thumbnail generator at `/tools/thumbnail-generator/` that reuses the procedural city scene from the Abyssal Conquest game (`~/Development/nikke_game`). Each of the game's 7 stage themes ships as a selectable background in the generator.

## Context

### Current state

The thumbnail generator renders a 1920×1080 canvas over a single seamless tile (`whykusanagi_rendered_SEAMLESS.png`, 512×512, hosted on R2). Layered above the tile are a radial vignette (`.seamless-vignette`) and a global purple gradient tint (`.seamless-tint-purple`). Export goes through html2canvas with a fetch + FileReader workaround for CORS on the seamless PNG (`index.html` lines ~892–905, ~1072–1086).

The generator has a single-page control panel; backgrounds today are not user-selectable.

### Source material in `nikke_game`

The game does not store the city as a raster asset. It is drawn procedurally by `background-renderer.js` (657 lines) using a parallax stack: rear skyline towers, foreground skyline structures with window grids, digital billboards, occult signs, diamond floor grid, foreground barrier rails, sky + aurora gradient. Per-stage palettes live in `stage-themes.js` and key off boss ID:

- `default-corruption` (pink/violet — Celeste's default)
- `dragon-cinder` (orange/red)
- `leviathan-abyss` (cyan/teal)
- `colossus-gold` (gold/amber)
- `tyrant-crimson` (hot pink/red)
- `behemoth-void` (indigo/violet)
- `serpent-emerald` (green)

`getStageTheme(stage)` merges base + per-boss overrides.

## Approach (decisions made during brainstorming)

1. **Pre-render to PNG, do not port the live canvas renderer.** Production once, then static assets. Rejected: porting the full renderer into the generator (heavy runtime, html2canvas needs the canvas painted before capture anyway).
2. **All 7 themes ship.** Same pipeline run 7 times — trivially cheap for full coverage.
3. **No per-element toggle layers.** Earlier draft proposed checkboxes for billboards / occult signs / foreground barrier. Dropped because at 1920×1080 the user crops/positions the character over the scene anyway, so per-element toggles add UI cost for no real value. Each PNG bakes the full scene.
4. **Render directly at 1920×1080.** The renderer is parameterized on WIDTH/HEIGHT/FLOOR_Y; producing the export at the target aspect ratio avoids letterboxing and crop guesswork.
5. **Seamless background stays as a peer option, not replaced.** It remains the default. Themed scenes are an additional choice.

## Architecture

### Asset pipeline (in `~/Development/nikke_game`)

A standalone export harness page renders the 7 PNGs.

- `nikke_game/tools/thumbnail-bg-export.html` — minimal HTML hosting a 1920×1080 `<canvas>` and a "Render and download" button per theme (or a single "Render all 7" button that fires sequential downloads).
- `nikke_game/tools/thumbnail-bg-export.js` — imports `background-renderer.js` and `stage-themes.js` from the game, plus the supporting modules already used by `main.js` (`projectWorldPoint`, `WORLD_NEAR_Z`, `WORLD_FAR_Z`, `getQualityTierConfig`, `createRenderLayer`, `getDisplayStage`). Forces high quality tier. For each theme key:
  1. Constructs a synthetic `stage` whose `bossId` matches the theme.
  2. Builds a `state` shape with whatever fields `drawBackground` reads (animation timers default to 0).
  3. Calls `createBackgroundRenderer(...)` with the harness's 1920×1080 canvas + `FLOOR_Y` derived from a sensible perspective (matching the in-game horizon proportion).
  4. Calls `drawBackground()` once.
  5. Calls `canvas.toBlob` and triggers a download named `nikke-bg-<theme-key>.png`.

Outputs live in `nikke_game/output/thumbnail-backgrounds/` (gitignored — they are uploaded artifacts, not source).

The harness is dev-only. It is not linked from the game; it does not bundle into game builds.

### Asset hosting

Upload to R2 / S3 via the project's standard tooling:

- Bucket path: `s3://whykusanagi/tools/thumbnail-generator/assets/backgrounds/`
- Filenames: `nikke-bg-default-corruption.png`, `nikke-bg-dragon-cinder.png`, `nikke-bg-leviathan-abyss.png`, `nikke-bg-colossus-gold.png`, `nikke-bg-tyrant-crimson.png`, `nikke-bg-behemoth-void.png`, `nikke-bg-serpent-emerald.png`.
- Public URLs: `https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/nikke-bg-<key>.png`.
- Existing `whykusanagi_rendered_SEAMLESS.png` is untouched.

PNGs are full-scene 1920×1080 at the renderer's native fidelity. They are not subject to the GitHub README 2 MB optimization rule (Section 6.5 of CLAUDE.md) because they are not embedded in any README — they are runtime assets fetched by the generator. File size is a function of the renderer's output and is expected to be a few hundred KB to ~2 MB per theme.

### Thumbnail generator UI changes (`tools/thumbnail-generator/index.html`)

Add a new "Background" group inside the existing control panel. One element:

```html
<div class="control-label">Background:</div>
<select id="bg-theme-select" class="control-input" onchange="setBackgroundTheme(this.value)">
  <option value="seamless" selected>Seamless Pattern (default)</option>
  <option value="default-corruption">Nikke City — Corruption</option>
  <option value="dragon-cinder">Nikke City — Dragon Cinder</option>
  <option value="leviathan-abyss">Nikke City — Leviathan Abyss</option>
  <option value="colossus-gold">Nikke City — Colossus Gold</option>
  <option value="tyrant-crimson">Nikke City — Tyrant Crimson</option>
  <option value="behemoth-void">Nikke City — Behemoth Void</option>
  <option value="serpent-emerald">Nikke City — Serpent Emerald</option>
</select>
```

### Thumbnail generator runtime changes

Add to the existing inline `<script>`:

- A module-level `currentBackgroundTheme` (string), initialized to `"seamless"`.
- A `BG_URLS` map: `seamless` → existing tile URL; each `nikke-*` key → its R2 URL.
- `setBackgroundTheme(value)`:
  - Sets `currentBackgroundTheme = value`.
  - Selects all `.seamless-background` elements; updates `style.backgroundImage`, `style.backgroundRepeat`, `style.backgroundSize` per mode (`repeat` / `512px 512px` for seamless, `no-repeat` / `cover` for nikke).
  - Toggles `body.classList` for `bg-themed` (adds when theme ≠ seamless).

### CSS changes (`tools/thumbnail-generator/css/seamless-background.css`)

Append:

```css
/* When a Nikke themed background is active: */
body.bg-themed .seamless-background { animation: none; }
body.bg-themed .seamless-tint-purple { display: none; }
```

Rationale: animated scroll on a city scene looks wrong. The global purple tint muddies non-pink themes — each theme already carries its own color story.

The vignette stays in all modes — it adds depth and helps the title pop.

### Export integration (html2canvas)

The current CORS workaround at `index.html` lines ~892–905 hardcodes the seamless URL. Refactor:

1. Read `currentBackgroundTheme` and resolve to a URL via `BG_URLS`.
2. Fetch that URL, convert to data URL via FileReader (existing pattern).
3. In the `onclone` callback (lines ~1072–1086), apply the data URL to all `.seamless-background` clones with the correct `repeat` / `size` for the active mode.

No other export-path changes are required: the rest of the html2canvas flow (vignette, animated layer rasterization, character glow, 1920×1080 output) is theme-agnostic.

## Data flow

```
[user opens generator]
    ↓
defaults: currentBackgroundTheme = "seamless"; existing tile renders, animated, with vignette + purple tint
    ↓
[user selects a Nikke theme from dropdown]
    ↓
setBackgroundTheme(value):
  - swaps URL on .seamless-background elements (no-repeat, cover)
  - body.bg-themed → animation off, purple tint hidden
    ↓
[user clicks Export PNG]
    ↓
exportThumbnail():
  - resolves theme URL
  - fetch + FileReader → data URL (CORS workaround)
  - html2canvas captures #thumbnail-container at 1920×1080
  - onclone replaces .seamless-background backgroundImage with data URL using mode-correct repeat/size
    ↓
PNG download
```

## Failure / edge cases

- **R2 fetch fails for a Nikke PNG.** The fetch + FileReader workaround currently logs `⚠️ Seamless background fetch failed` on rejection. Same behavior for themed PNGs: log a warning, fall through to the existing `.seamless-background` CSS rule (which still has the seamless tile URL set in CSS as a fallback). Export proceeds; user gets a degraded-but-non-broken thumbnail. No retry logic.
- **User exports immediately after switching themes.** Every export does its own fetch — no caching to invalidate, no race.
- **html2canvas onclone runs before the data URL is set.** Existing code already handles this; the data URL is awaited before `html2canvas(...)` is called.
- **Adding new themes later.** Append a new entry to `BG_URLS` and a new `<option>`. No other code changes.

## Validation

Per CLAUDE.md Section 8.

1. **Harness sanity check.** Open `nikke_game/tools/thumbnail-bg-export.html` in a browser; confirm all 7 themes render at 1920×1080 with sky / aurora / rear towers / foreground skyline / billboards / signs / floor grid / barrier all present and theme-tinted correctly.
2. **R2 HTTP verification (mandatory before generator wiring).** For each uploaded PNG:

   ```bash
   curl -I https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/nikke-bg-<key>.png
   ```

   Expect HTTP/2 200, `content-type: image/png`, plausible `content-length`.
3. **Generator UI smoke test.** Serve the site (`python3 -m http.server 8000` from `site/`), open the thumbnail generator, click through all 8 background options. Confirm each theme paints correctly, animation is on only for seamless, purple tint is on only for seamless.
4. **Export parity — Nikke path.** With `dragon-cinder` selected (visually most distinct), export PNG. Confirm output: themed city present (not seamless, not black), vignette applied, purple tint absent, character + title overlays composited on top.
5. **Export parity — seamless regression.** Switch back to seamless, export, confirm output is identical to current main behavior.

## File-touch summary

`nikke_game/`:
- `tools/thumbnail-bg-export.html` — new
- `tools/thumbnail-bg-export.js` — new
- `output/thumbnail-backgrounds/` — gitignored, populated locally

`site/tools/thumbnail-generator/`:
- `index.html` — control panel + runtime + export refactor
- `css/seamless-background.css` — `body.bg-themed` rules

R2 uploads:
- 7 × `nikke-bg-<key>.png` to `s3://whykusanagi/tools/thumbnail-generator/assets/backgrounds/`

## Rollout

Single feature branch `feature/thumbnail-bg-nikke-themes`, in this order:

1. Build the export harness in `nikke_game`; render and verify the 7 PNGs locally.
2. Upload PNGs to R2; verify HTTP accessibility for each.
3. Wire up generator UI + runtime + CSS + export refactor.
4. Run validation steps 3–5.
5. Commit in logical chunks: (a) harness, (b) generator UI + runtime, (c) generator export refactor, (d) CSS overrides.

## Out of scope (deliberate)

- Per-element toggle layers (billboards / occult signs / foreground barrier on/off).
- Animated / live canvas rendering inside the generator.
- Tiled or seamless variants of Nikke scenes (city scenes do not tile).
- Preview thumbnails in the dropdown (7 text labels are sufficient).
- Migrating the existing seamless asset.
- Any changes to the thumbnail generator's character / title / glow systems.
