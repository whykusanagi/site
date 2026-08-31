# Background Generator - User Guide

Generate branded, **character-free** background images in the **Corrupted Theme**
aesthetic, then drop your character art / text on top in Canva (or any editor).
Unlike the Thumbnail Generator, this tool produces *backgrounds* — every layer is
optional and the canvas is left clean for you to compose over.

Live: <https://whykusanagi.xyz/tools/background-generator/>

## 🎯 Features

- **Three export sizes**: 1920×1080 (16:9), 1080×1920 (9:16), 1080×1080 (1:1)
- **Theme presets**: Lavender, Corrupted, Abyss, Succubus — recolor every layer at once
- **12 toggleable layers**, each with its own color and options (see below)
- **Two independent halftone layers** for dual-corner clusters (big in one corner,
  fine in the opposite — the character-reference-sheet look)
- **🎲 Randomize variant** — spins a full composition (theme, layers, FX) in one click
- **One-click PNG export** at the current size, or all three sizes at once
- **Zero dependencies**: native SVG → `<canvas>` → PNG, no `html2canvas`, no build step

## 🚀 Getting Started

### ⚠️ Must be served from the repo root (not the tool folder)

This tool is an **ES module** that imports its phrase pools from
`../thumbnail-generator/js/lewd-frame.js`. That relative path only resolves when
the server root is the **repo root** (the same way Cloudflare Pages serves the
live site). Serving from inside `tools/background-generator/` will 404 the import
and the page will render blank.

```bash
# From the repository root:
cd /path/to/site
python3 -m http.server 8000
# then open:
#   http://localhost:8000/tools/background-generator/index.html
```

Opening `index.html` directly via `file://` will **not** work (ES module imports
are blocked on `file://`). Always use an HTTP server.

## 🧱 The Layers

Layers render bottom-to-top in this order; each is an independent on/off with its
own color and settings:

| Layer | What it draws |
|-------|---------------|
| **Base** | Full-bleed background: Lavender gradient, Solid, Purple gradient, or Accent gradient |
| **Halftone dots** | Dot cluster — corner / edge-fade / full-field spread, with a Density and Dot-size control |
| **Halftone dots B** | A second, fully independent halftone (own corner/size/density) for dual-corner layouts |
| **Spectrum** | Audio-style EQ bars along the bottom (cyan→purple→magenta gradient) |
| **EVA patterns** | Orange corner brackets, purple hexagons, magenta crosshairs, corruption diagonals |
| **Sparkles** | Four-point stars, jittered around chosen corners |
| **Glyphs + phrase** | ⚠ / ◈ corner glyphs + a monospace phrase band (SFW/NSFW toggle) |
| **Rails** | Thin top/bottom divider lines |
| **Nameplate** | Solid corner name-strip bar |
| **Logo text** | Centered wordmark |
| **Screen FX → Glitch** | RGB-split datamosh slices (intensity slider) |
| **Screen FX → Scanlines + vignette** | CRT line pattern + edge darkening (separate sliders) |
| **Screen FX → Noise** | Fine film grain (intensity slider) |

### Halftone: Density vs. Dot size vs. Spread

- **Density** (Low/Med/High) — how many dots in the cluster grid.
- **Dot size** (Micro/Fine/Small/Normal/Large) — scales dot spacing + radius, so
  *Fine + High* gives a proper fine halftone screen, while *Large* gives the bold
  reference-sheet dots.
- **Spread** — `corner` (triangular cluster from the picked corner(s)),
  `edge-fade` (band fading from the top edge), `full-field` (dots across the whole
  canvas fading left→right).

To reproduce the character-reference-sheet look: enable **Halftone dots** (Large,
corner, TL) and **Halftone dots B** (Fine, corner, BR).

## 🎨 Themes

The **Theme** preset recolors every layer in one click; you can still override any
individual layer color afterward:

| Theme | Base | Accent (dots/sparkles/rails) | Glyphs |
|-------|------|------------------------------|--------|
| **Lavender** | lavender gradient `#c7c4ec → #eef0fb` | ink `#1a1430` | ink |
| **Corrupted** | pink→dark `#d94f90 → #0a0a0a` | pink `#d94f90` | `#e86ca8` |
| **Abyss** | solid dark `#0a0a0a` | cyan `#00ffff` | cyan |
| **Succubus** | purple→pink `#8b5cf6 → #d94f90` | `#b08aff` | `#ff00ff` |

Colors come from the **corrupted-theme** brand palette (shared with the rest of the
site and the Celeste TTS bot overlays).

## 🔞 NSFW phrases

The **Glyphs + phrase** layer renders one phrase from a curated pool. The **NSFW**
toggle switches between the SFW and NSFW pools (imported from the Thumbnail
Generator's `lewd-frame.js`). NSFW defaults **off** in this tool. When the NSFW
phrase layer is enabled, exported filenames gain an `_nsfw` suffix
(per the art-asset naming convention in `CLAUDE.md` §6.4).

## 💾 Export

- **Export PNG (current)** — downloads the current canvas at the selected size.
- **Export all sizes** — downloads all three sizes in turn.
- Filenames: `bg_<baseStyle>_<w>x<h>.png` (with `_nsfw` when that layer is on).
- Random layers (spectrum, sparkles, glitch) re-roll per size on "all sizes", so the
  three files are variations rather than identical crops.

Export uses the browser's native `XMLSerializer` + `<canvas>.toBlob` — no external
libraries.

## ✅ Built-in self-check

Append `?selftest=1` to the URL to run the inline self-check. It validates SVG
serialization, halftone dot counts, sparkle counts, and the PNG rasterize path,
then reports `SELFTEST PASS (5 checks)` (or a failure) in a banner. Used for
verifying changes; has no effect on normal use.

## 🖥️ Browser Requirements

- Modern browser with **ES module** support (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Canvas API (for PNG export)
- Served over HTTP (not `file://`), from the repo/site root (see Getting Started)

## 🔧 Technical Details

- **Single self-contained file**: `tools/background-generator/index.html`
  (inline CSS + JS). corrupted-theme CDN CSS is loaded only for the control panel.
- **No build system, no dependencies.** Reuses the four-point star shape from
  `thumbnail-generator/js/iconography-mode.js` and the phrase pools from
  `thumbnail-generator/js/lewd-frame.js`.
- **Architecture**: a `state.layers` object drives a `rebuild()` that clears and
  redraws an `<svg id="stage">`; each layer is a small builder reading only its own
  `state.layers[name]` entry. See `docs/superpowers/specs/2026-06-27-background-generator-design.md`
  for the full design.

---

**Created**: 2026-06-29
**Maintained By**: whykusanagi
