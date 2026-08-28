# Thumbnail Generator — NIKKE Warning Screen Foreground

**Date:** 2026-05-04
**Status:** Approved (in-conversation, brainstorming)
**Owner:** whykusanagi

## Goal

Add a NIKKE-style boss-warning frame as a new selectable foreground in the thumbnail generator. Recolored to the project's corruption palette (pink / violet / magenta), defaulting to CelesteAI as the rampant-AI boss. Composes with any existing background and the existing title/subtitle controls.

Reference: `https://skuqre.github.io/nikke-font-generator/warning/` — visual format only; we are not cloning the page or its content.

## Integration

- New entry in the existing **Character / Video** dropdown: `⚠️ NIKKE Warning Screen`, value `__WARNING__`.
- `setCharacterImage('__WARNING__')` short-circuits like the existing `__VIDEO__` and `__CUSTOM__` branches: hides `#celeste-image` + `#celeste-canvas`, shows a new `#warning-overlay` div positioned to fill where the character would render.
- A new **Warning Screen** sub-panel of controls becomes visible only when `__WARNING__` is the active foreground (parallel to the file-input visibility from the custom upload feature).
- Background select, layout mode, aspect ratio, title/subtitle, vignette/tint stack are unchanged and continue to compose with the warning overlay.

## Visual layout

Two diagonal hazard-stripe banners sandwiching the boss content (canon NIKKE shape). All four text regions are independently editable:

```
┌─────────────────────────────────────────────┐
│ ▰▰▰▰▰▰▰▰  WARNING  ▰▰▰▰▰▰▰▰   ← top banner
│                                             │
│              CELESTEAI                      ← boss name
│                                             │
│   CORRUPTION DETECTED >> EXTREME DANGER     ← threat classification
│                                             │
│ ▰▰▰▰▰▰▰▰  CORRUPTED  ▰▰▰▰▰▰▰▰  ← bottom banner (different default)
└─────────────────────────────────────────────┘
```

### Banner geometry

Each banner is one `<div>`:

- `transform: skewX(-12deg)` for the diagonal NIKKE slant.
- `background: repeating-linear-gradient(135deg, <dark> 0 24px, <accent> 24px 36px)` for the hazard stripes.
- Fixed banner height (~140px at 1920×1080), full-width across the foreground area.
- Inner `<span>` text label has `transform: skewX(12deg)` to counter-rotate so labels read straight while the bar stays slanted.

### Color tokens (reused from corruption palette)

- Stripe dark: `#0a0613` (already used by harness / overlay backgrounds).
- Stripe accent: `#ff82d9` (the magenta from `stage-themes.js` BASE).
- Boss-name fill: `#ff82d9`, glow via `text-shadow: 0 0 12px rgba(139, 92, 246, 0.85), 0 0 24px rgba(255, 130, 217, 0.55)`.
- Threat-classification fill: `#f7d6ff` (light pink-white), Courier New uppercase.

### Typography

- Banner labels + boss name: `Impact, "Arial Black", sans-serif` (system stack, no webfont fetch — keeps html2canvas reliable).
- Threat classification: `"Courier New", monospace` — already used elsewhere in the generator.

### Animation

A subtle CSS pulse on each banner: `opacity 1 ↔ 0.85, 1.4s ease-in-out infinite`. Live preview only — html2canvas freezes the frame at capture, which is fine.

## Controls

A new **Warning Screen** sub-panel inside the existing control panel, between the Character section and Glow Color. Visible only when `__WARNING__` is the active foreground; hidden otherwise.

```
Warning Screen
  Top Banner:        [WARNING                        ]
  Boss Name:         [CELESTEAI                      ]
  Threat:            [CORRUPTION DETECTED >> EXTREME ]
  Bottom Banner:     [CORRUPTED                      ]
  [↻ Reset to defaults]
```

Four `<input type="text">` fields, each wired to a single `setWarningField(fieldKey, value)` setter via `oninput` (live preview as user types). One reset button calls each setter with the default. No `Apply` button — input is live, not committed.

## Data flow

```
[user picks ⚠️ NIKKE Warning Screen from character dropdown]
    ↓
setCharacterImage('__WARNING__'):
  - hide celeste-image, hide celeste-canvas, hide custom-character file input
  - show #warning-overlay
  - show .warning-controls-section
  - apply current warningState fields to overlay text spans
    ↓
[user types in any warning field]
    ↓
setWarningField(key, value):
  - update warningState[key]
  - update DOM text on the matching span (#warning-top, #warning-boss, #warning-threat, #warning-bottom)
  - saveState()
    ↓
[user clicks Export PNG]
    ↓
existing html2canvas pipeline captures the foreground area;
warning-overlay is plain CSS DOM, captured with no special handling
```

## State persistence

`getCurrentState()` returns a new field:

```javascript
warningScreen: {
    topBanner:    'WARNING',
    bossName:     'CELESTEAI',
    threat:       'CORRUPTION DETECTED >> EXTREME DANGER',
    bottomBanner: 'CORRUPTED',
}
```

`loadState()` reads it back and applies each field via `setWarningField`. URL-param parsing (`parseURLParams`) and localStorage round-tripping already handle nested-object strings via JSON; no schema-version bump. Missing keys fall through to defaults defined in a single `WARNING_DEFAULTS` constant near the top of the script.

## Export

The existing html2canvas pipeline needs **one** small adjustment:

- In the `onclone` callback, copy `getComputedStyle(originalWarningOverlay).fontSize` (and similar) onto the cloned banner / boss-name / threat elements, scaling by `fontScale = canvasWidth / 1920` (parallel to the existing main-title scaling at lines ~1010–1024). Otherwise font sizes are wrong for non-16:9 aspect ratios.

No other changes to the export path. `imageToDataURL(celesteImg)` continues to fire — celesteImg has `display: none` in warning mode, so html2canvas skips it cleanly (same as in video mode today).

## Files touched

- `tools/thumbnail-generator/index.html`:
  - New `<div id="warning-overlay">` near `#celeste-image` (~line 400).
  - New `__WARNING__` option in `#character-select`.
  - New Warning sub-panel block in the control panel.
  - New `WARNING_DEFAULTS` constant + `warningState` object + `setWarningField()` + warning-mode branch in `setCharacterImage()`.
  - Hooks in `getCurrentState()` and `loadState()`.
  - Tweak in the export `onclone` for warning-overlay font scaling.
- `tools/thumbnail-generator/css/warning-overlay.css` *(new)*:
  - All warning-frame styling (banners, stripes, typography, pulse animation, control-panel section visibility rule).
- `tools/thumbnail-generator/index.html` head: one `<link rel="stylesheet">` to load the new CSS file.

No image assets, no R2 uploads, no nikke_game changes — entirely a local UI feature.

## Failure / edge cases

- **html2canvas font-loading**: avoided by sticking to system fonts (Impact / Arial Black / Courier New). No webfont fetch, no race.
- **Aspect-ratio scaling**: handled by the `fontScale` tweak in `onclone`. 16:9 / 9:16 / 1:1 / 2:1 / 4:5 all picked up automatically.
- **State migration**: absent `warningScreen` key in saved state → `WARNING_DEFAULTS` apply. Backwards-compatible with old localStorage entries.
- **Reset button**: writes `WARNING_DEFAULTS` back to all four fields. No "are you sure" confirmation — text is recoverable from any saved state, so the cost of accidentally hitting it is low.

## Out of scope (deliberate)

- Phrase-pool randomizer (auto-pull from `NSFW_PHRASES` etc.). User types their own.
- Boss silhouette/portrait inside the warning frame.
- Pixel-perfect canon match to NIKKE — we're "inspired by", not cloning.
- Scanline shaders, glitch distortion, noise overlays, particle bursts. CSS pulse only.
- Custom webfonts. System stack only.
- Per-banner color customization in v1. Stripe / accent / glow are fixed at the corruption palette.

## Validation

Per CLAUDE.md §8.

1. **Live preview** — pick `⚠️ NIKKE Warning Screen` from the character dropdown. Both banners + boss name + threat render with defaults. Banners pulse subtly. Editing any of the four fields updates the preview live.
2. **Compose with backgrounds** — switch through seamless + each Nikke theme + custom background. Warning overlay sits cleanly on top in every case.
3. **Compose with title/subtitle** — set a title, set an empty subtitle, confirm warning + title coexist; clear both, confirm warning stands alone.
4. **Aspect-ratio sanity** — switch to 9:16 and 1:1 with warning active. Banner stripes still slant correctly, fonts scale, no clipping.
5. **Export** — export PNG at 16:9 with warning + Nikke background + title. Inspect: hazard stripes crisp, banner skew correct, boss name + threat readable, glow rendered. Animation frozen at whatever frame.
6. **State round-trip** — type custom values into all four fields, refresh page, confirm values restored from localStorage.
7. **Switch away** — pick any other character option; warning overlay hides, normal character image returns, warning sub-panel hides.

## Rollout

Single feature branch `feature/thumbnail-warning-screen` in `~/Development/site` (no nikke_game changes). Push → fast-forward main → Cloudflare deploy, same flow as the previous feature.
