# Thumbnail Generator: Iconography Layout Mode

**Date:** 2026-05-18
**Status:** Shipped. Section 3 revised 2026-08-27 for the tiered `incantations.json` (PR #72); the rest describes the mode as originally built.
**Scope:** `tools/thumbnail-generator/index.html`, new `tools/thumbnail-generator/js/iconography-mode.js`, new `tools/thumbnail-generator/css/iconography-mode.css`, new `tools/thumbnail-generator/data/incantations.json`

---

## Problem

The thumbnail generator currently supports two layout modes (Thumbnail, Hero) plus 5 aspect-ratio presets. Both modes are character-forward but visually plain — no decorative iconography, no incantation text, no religious-icon framing.

For Celeste-themed content (videos, social posts, key visuals) we want a **corrupted religious icon** composition: ornate filigree frame, vesica-piscis (mandorla) aureole behind the character, concentric thick rings, three counter-rotating bands of incantation text, dashed curved arcs with node dots, and a radial star field that emanates from the character.

The composition must scale cleanly across all 5 existing aspect ratios and reuse the existing character image / background / export pipeline.

---

## Solution

Add a third layout mode (`iconography`) parallel to `thumbnail` and `hero`. The mode renders a single SVG overlay containing the entire iconographic composition, with per-element toggles, phrase dropdowns sourced from a JSON file, and a star-density control. The character image, background, and export pipeline are reused unchanged.

---

## 1. File layout

| File | Status | Role |
|------|--------|------|
| `tools/thumbnail-generator/index.html` | modified | Adds `iconography` option to `#layout-mode-select`, adds Iconography control panel section, calls `IconographyMode` from init |
| `tools/thumbnail-generator/js/iconography-mode.js` | new | `IconographyMode` class — builds SVG, manages controls, loads phrases, handles resize |
| `tools/thumbnail-generator/css/iconography-mode.css` | new | Static styles for frame/filigree; keyframes for rotation and star pulse |
| `tools/thumbnail-generator/data/incantations.json` | new | Phrase library keyed `outer` / `middle` / `inner` |

---

## 2. Composition (rendered SVG)

The SVG is a single `<svg viewBox="0 0 W H">` element layered into `#thumbnail-canvas` between the background overlays and the character image. Z-order, top to bottom:

1. Seamless background (existing)
2. Vignette + tint overlays (existing)
3. **Iconography SVG** (this mode)
   - a. Frame group (border rects + 4 filigree corners + top/bottom labels)
   - b. Mandorla aureole (radial gradient fill + pink stroke + offset cyan stroke)
   - c. Dashed accent arcs (pink primary + cyan secondary, with node dots at endpoints)
   - d. Concentric rings (5 rings: outer-frame, outer-bound, between-1, between-2, inner-cyan)
   - e. Three rotating text bands (`<textPath>` on circle paths, CW / CCW / CW)
   - f. Radial star field (24 spokes × variable density)
4. Character image (existing `#subject-image`) — **centered** in this mode, same positioning as Hero mode (`left: 50%; transform: translateX(-50%); bottom: 0`). This is required for the star skip zones (90°, 270°) and the radial spoke geometry to align with the character silhouette.
5. Logo + title (existing — hidden by default in this mode, toggleable on)

### 2a. Frame

- Outer rect: dark plum border, 36px (scales to `min(W,H) * 0.033`) stroke, no fill
- Inner accent rect: pink (`#ff82d9`) 3px stroke, ~0.5% inset
- Innermost dashed rect: cyan (`#00ffff`) 1px stroke, `stroke-dasharray: 8 6`
- 4 filigree corners: pink L-bracket + cubic-bezier scroll + cyan accent dot + small white 4-pt star. Drawn once as `<g id="filigree">` in `<defs>` and reused via 4 `<use>` elements with mirror transforms
- Top label: `<text>` centered at top border (default `⚠ CELESTE ⚠`)
- Bottom label: `<text>` centered at bottom border (default `CORRUPTED.ARCHIVE`)
- Both label strings editable in the control panel

### 2b. Mandorla aureole

- Path `<path id="mandorla" d="...">` is a vesica-piscis shape — two intersecting cubic-bezier curves forming a pointed oval taller than wide
- Filled with `<radialGradient>`: transparent center → `#d94f90 @ 0.35` mid → `#b08aff @ 0.40` outer → `#00ffff @ 0.10` edge
- Stroked twice: pink 4px primary, cyan 1.5px offset (translate+scale)
- Shape mode is selectable: `mandorla` (default) or `circle` — circle mode uses `<circle>` with same gradient

### 2c. Dashed accent arcs

- 4 primary pink arcs (one per quadrant), 3px stroke, `stroke-dasharray: 22 12`, `stroke-linecap: round`
- 4 secondary cyan arcs (offset inward), 2px stroke, `stroke-dasharray: 12 10`
- 8 + 8 filled circles at arc endpoints — pink 8px-radius for primary, cyan 5px-radius for secondary (the small "node" dots from the reference)

### 2d. Concentric rings

Five rings centered at canvas midpoint, from outer to inner:

| Ring | Radius (fraction of R) | Stroke | Color | Opacity |
|------|------------------------|--------|-------|---------|
| outer-bound | 1.03 | 2 | white | 0.40 |
| outer-text (boundary) | 1.00 | 3 | cyan | 0.80 |
| divider-1 | 0.92 | 2.5 | pink | 0.70 |
| divider-1-dashed | 0.85 | 2 (dashed 10 6) | pink | 0.50 |
| divider-2 | 0.71 | 2.5 | violet (`#b08aff`) | 0.65 |
| divider-2-dashed | 0.64 | 1.8 (dashed 6 8) | cyan | 0.45 |
| inner-cyan | 0.51 | 4 | cyan | 0.90 |
| inner-pale | 0.48 | 1.5 | pale cyan (`#7ef0ff`) | 0.55 |

`R = min(W, H) * 0.46` (radius of outermost text path).

### 2e. Rotating text bands

Three text bands rendered as `<textPath>` on three `<path>` arcs:

| Band | Radius | Direction | Color | Font size (16:9 baseline) |
|------|--------|-----------|-------|---------------------------|
| outer | 1.00 R | CW (60s) | white, bold | 26px |
| middle | 0.78 R | CCW (40s) | pink | 24px |
| inner | 0.56 R | CW (60s) | cyan | 20px |

Each band's text is the chosen phrase repeated 2× joined by a separator glyph (`⚠`, `◈`, `001011`) and a trailing space, so it tiles smoothly regardless of length. Animation via CSS `@keyframes` on the wrapping `<g>` with `transform-origin: <cx> <cy>`.

### 2f. Radial star field

Stars sit on 24 angular spokes (15° apart). Two spokes are skipped (90° and 270°) so stars never overlap the character's head/feet silhouette. Each spoke has 3–4 stars at fractional radii of R:

| Density | Star count | Radii (× R) | Sizes (px) |
|---------|-----------:|-------------|-----------|
| low | 24 | 0.55, 0.85 | 14, 9 |
| med (default) | ~66 | 0.55, 0.69, 0.85, 1.01 | 17, 13, 10, 7 |
| high | ~110 | 0.55, 0.62, 0.69, 0.77, 0.85, 0.95, 1.01 | 17, 14, 12, 10, 9, 8, 7 |

Stars are bigger near the character, smaller toward the frame.

**Star DOM:** each star is a `<g transform="translate(x,y)"><path class="star-pulse phN" d="..."/></g>` where the path is drawn around (0,0) so the pulse animation pivots on the star's center, not the SVG origin. Colors cycle through white / cyan / pink / pale-cyan via the `<path fill>` attribute. Each star gets one of 10 `ph0`–`ph9` stagger classes (animation-delay 0 → 2.25s) so the field breathes asynchronously.

**Star pulse animation:**

```css
@keyframes star-pulse {
  0%   { opacity: 0.3; transform: scale(0.35); }
  50%  { opacity: 1.0; transform: scale(1.0);  }
  100% { opacity: 0.3; transform: scale(0.35); }
}
```

Duration 3.2s, `ease-in-out`, `infinite`.

---

## 3. Phrase data

### File: `tools/thumbnail-generator/data/incantations.json`

**Updated 2026-08-27 — the document is now tiered.** `loadPhrases` accepts either shape.

Flat — the original shape, still supported, read as the default tier:

```json
{ "outer": ["..."], "middle": ["..."], "inner": ["..."] }
```

Tiered — selected by `state.tier`:

```json
{
  "sfw":        { "outer": ["..."], "middle": ["..."], "inner": ["..."] },
  "suggestive": { "outer": ["..."], "middle": ["..."], "inner": ["..."] },
  "r18":        { "outer": ["..."], "middle": ["..."], "inner": ["..."] }
}
```

Shipped tiers, as outer/middle/inner phrase counts: `sfw` 14/16/14 (the original set),
`suggestive` 7/7/7, `r18` 6/6/6. The `suggestive` and `r18` lines are drafts to be
replaced, not final copy.

`DEFAULT_TIER = 'sfw'`. Everything that does not opt in inherits it, so it must never be
pointed at a permissive tier.

**A tier is never inferred.** Ask for one the document does not carry and you get
`FALLBACK_PHRASES` plus a logged error — never the nearest available tier. Substituting a
neighbour is precisely how an r18 line would reach a render that never asked for one, and
the rings are the most legible text in frame, so that failure has to be loud rather than
quietly approximate.

API:

- `setTier(tier)` → `true` only when the requested tier was actually found. A caller that
  cares (a batch render routing r18 to one platform) should check the return value rather
  than trust that the frames carry what it asked for.
- `availableTiers()` → the tiers the loaded document actually carries; `['sfw']` for a flat
  document, `[]` when the fetch failed.
- `loadPhrases()` returns the boolean from the `setTier` it ends with.

Not yet wired: nothing in the UI or the URL params calls `setTier`, so every render today
is `sfw`.

Validation:

- Every ring array must be present and non-empty. A tier failing that check (`_ringsOk`) is
  rejected whole, rather than rendering one blank band.
- Invalid JSON, a non-OK response, or a failed fetch → `console.error` + `FALLBACK_PHRASES`.
- `phraseIdx` is clamped against the active list at render time, so switching to a shorter
  tier cannot index out of range.

Mirrored in the `spatial_videos` repo at `pipeline/iconography_bg/`. The phrase data there is
byte-identical; that copy's `iconography-mode.js` differs only in the outer band font size
(26 → 22) to suit its 2x text scale.

### UI controls

In the Iconography control panel section:
- 3 `<select>` elements (`#icon-phrase-outer`, `#icon-phrase-middle`, `#icon-phrase-inner`) populated from the JSON arrays
- 1 `<button>` per select: 🎲 randomize that ring
- 1 `<button>` "🎲🎲🎲 Random all"

Switching a phrase updates the `<textPath>` content immediately — no reload.

### Rendered string

```js
const tiled = (phrase, separator) => `${phrase} ${separator} ${phrase} ${separator} `;
// outer separator: ⚠
// middle separator: ◈
// inner separator: 001011
```

---

## 4. Per-element toggles

The Iconography control panel section has checkboxes for each element group:

| Checkbox ID | Default | Controls |
|-------------|--------:|----------|
| `#icon-toggle-frame` | on | Frame + filigree corners + top/bottom labels |
| `#icon-toggle-mandorla` | on | Mandorla + gradient halo |
| `#icon-toggle-arcs` | on | Dashed accent arcs + node dots |
| `#icon-toggle-rings` | on | All concentric rings |
| `#icon-toggle-text` | on | All 3 rotating text bands |
| `#icon-toggle-stars` | on | Radial star field |
| `#icon-toggle-logo` | off | Show the existing logo overlay on top |
| `#icon-toggle-title` | off | Show the existing title/subtitle on top |

Plus:
- `<input id="icon-label-top">` — text for top frame label (default `⚠ CELESTE ⚠`)
- `<input id="icon-label-bottom">` — text for bottom frame label (default `CORRUPTED.ARCHIVE`)
- `<select id="icon-star-density">` — `low` / `med` / `high`
- `<select id="icon-mandorla-shape">` — `mandorla` / `circle`

Toggling adds/removes a CSS display class on the relevant SVG group — no DOM rebuild.

---

## 5. Aspect-ratio scaling

All geometry derives from canvas dimensions; no element has hardcoded pixel coords.

```js
const cx = W / 2;
const cy = H / 2;
const R  = Math.min(W, H) * 0.46;           // outermost text path radius
const filigreeScale = Math.min(W, H) / 1080; // 1.0 at 1080p, smaller at smaller heights
const frameInset = Math.min(W, H) * 0.02;    // 2% breathing room
```

### Ring radii (multiples of R)

| Element | × R |
|---------|----:|
| outer-bound circle | 1.03 |
| outer text path | 1.00 |
| divider-1 | 0.92 |
| divider-1-dashed | 0.85 |
| middle text path | 0.78 |
| divider-2 | 0.71 |
| divider-2-dashed | 0.64 |
| inner text path | 0.56 |
| inner-cyan ring | 0.51 |
| inner-pale ring | 0.48 |

### Mandorla

Path is regenerated on resize as:
```
M cx, cy-Hr
C cx+Wr, cy-Hr*0.4    cx+Wr, cy+Hr*0.4    cx, cy+Hr
C cx-Wr, cy+Hr*0.4    cx-Wr, cy-Hr*0.4    cx, cy-Hr
Z
```
where `Hr = R * 0.95` and `Wr = R * 0.61` (matches v5 proportions: 460×280 at R=485).

### Arcs

Arc endpoints are computed at fixed angular positions on a circle of radius `R * 1.05` (primary) and `R * 0.91` (secondary), so they automatically follow the ring system at any aspect ratio.

### Star spokes

Star positions are computed via:
```js
const angles = [0,15,30,45,60,75,105,120,135,150,165,180,195,210,225,240,255,285,300,315,330,345]; // skips 90 & 270
const radiiByDensity = { low: [0.55,0.85], med: [0.55,0.69,0.85,1.01], high: [...] };
for (angle of angles) for (i, r of radiiByDensity[density]) {
  const x = cx + Math.cos(rad) * R * r;
  const y = cy + Math.sin(rad) * R * r;
  // size = sizeByDensity[density][i]
}
```

### Filigree corners

Drawn at 200×200 in defs. Each `<use>` is positioned at (0,0) / (W,0) / (0,H) / (W,H) with appropriate mirror transforms, scaled by `filigreeScale`. So on 9:16 (1080×1920) the corners shrink to ~0.56× to stay proportional to the narrower canvas.

### Verified behavior per aspect

| Ratio | W × H | R | Notes |
|-------|-------|---|-------|
| 16:9 | 1920×1080 | 497 | reference layout |
| 2:1 | 1920×960 | 442 | rings tighter, frame still works |
| 1:1 | 1920×1920 | 883 | huge icon, frame stretches |
| 4:5 | 1920×2400 | 883 | portrait, lots of vertical space above/below icon |
| 9:16 | 1080×1920 | 497 | narrow portrait, filigree corners scale down |

---

## 6. Animation + export

Live in the editor:
- Text rings rotate (60s CW / 40s CCW / 60s CW) via CSS keyframes
- Stars pulse-scale (3.2s, staggered 10 phases)

**Export:**
- `exportThumbnail()` uses html2canvas (existing pipeline) — captures whatever frame is on screen at the moment of click
- Each export is slightly different (rotation phase + star pulse phase) — feature, not bug; gives variety across exports
- No special handling needed in export — the SVG is just another DOM layer that html2canvas renders

---

## 7. State persistence

Following existing URL-param + localStorage pattern:

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `layoutMode` | string | `thumbnail` | extended valid values: `thumbnail` \| `hero` \| `iconography` |
| `iconElements` | comma-string | `frame,mandorla,arcs,rings,text,stars` | omit a token to disable |
| `iconPhrases` | comma-string of indexes | `0,0,0` | `outer,middle,inner` index into JSON arrays |
| `iconStarDensity` | string | `med` | `low` \| `med` \| `high` |
| `iconMandorlaShape` | string | `mandorla` | `mandorla` \| `circle` |
| `iconLabelTop` | string | `⚠ CELESTE ⚠` | URL-encoded |
| `iconLabelBottom` | string | `CORRUPTED.ARCHIVE` | URL-encoded |

Validation:
- `layoutMode` not in valid set → default to `thumbnail`
- `iconElements` tokens not in valid set → ignored
- `iconPhrases` indexes out of bounds → clamped to last valid index
- `iconStarDensity` / `iconMandorlaShape` not in valid set → default

URL params take priority over localStorage, which takes priority over defaults. Same as existing Hero/aspect-ratio handling.

---

## 8. Mode transition behavior

When `layoutMode` changes:

- **→ iconography**: show `#iconography-svg` and Iconography control panel section; apply centered character positioning (reusing the `.hero-mode` CSS rules on `#subject-image`); hide title/subtitle and logo by default (controllable via toggles)
- **→ thumbnail | hero**: hide `#iconography-svg` and Iconography control panel; restore title/subtitle/logo visibility per their normal settings; restore character positioning per the active mode

The Iconography SVG remains in the DOM at all times — just `display: none` when inactive — so switching modes is instant with no rebuild.

---

## 9. Files modified summary

| File | Change |
|------|--------|
| `tools/thumbnail-generator/index.html` | Add `<option value="iconography">` to layout-mode select; add Iconography control panel `<section>`; add `<svg id="iconography-svg">` placeholder element; load new CSS + JS; call `IconographyMode.init()` on page ready |
| `tools/thumbnail-generator/js/iconography-mode.js` | New file — `IconographyMode` class with `init`, `buildSVG`, `setElementVisibility`, `setPhrase`, `setStarDensity`, `setMandorlaShape`, `setLabel`, `resize`, `loadPhrases` methods |
| `tools/thumbnail-generator/css/iconography-mode.css` | New file — `.iconography-svg { display: none; }`, `.iconography-svg.active { display: block; }`, keyframes `spin-cw`, `spin-ccw`, `star-pulse`; phase classes `.ph0..ph9`; SVG element classes for stroke/fill defaults |
| `tools/thumbnail-generator/data/incantations.json` | New file — starter phrase library |

---

## 10. Out of scope

- Off-center "speech-bubble mandorla" layout (the asymmetric Shigure Ui reference) — can be added later as a sub-variant if desired
- Custom filigree styles beyond the default L-bracket scrollwork
- User-uploadable phrase JSON via the UI (just edit the file directly)
- Animated MP4/WebM export (export remains PNG via html2canvas)
- Per-star color picking (palette is fixed: white / cyan / pink / pale-cyan)
- Vertical Japanese / multi-script text rendering in the text bands
- Phrase-by-phrase color override (each ring uses the band's default color)
