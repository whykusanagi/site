# Standalone Web Tools - Thumbnail Generator, Neo-Deco Portrait & Background Generator

Portable web-based tools for creating custom graphics with the **Corrupted Theme** aesthetic.

## 📦 Contents

### 1. Thumbnail Generator (`/thumbnail-generator/`)
YouTube thumbnail generator with animated corrupted theme elements. Includes a
third **Iconography** layout mode (religious-icon SVG composition) alongside the
default thumbnail and hero modes.
- **Canvas**: 1920×1080 (16:9), plus hero/iconography layouts and other aspect ratios
- **Use Case**: YouTube thumbnails, stream graphics, social media headers, key visuals

### 2. Neo-Deco Portrait (`/neo-deco-portrait/`)
Art Deco-inspired portrait generator with occult elements.
- **Canvas**: 1080×1920 (9:16 ratio)
- **Use Case**: Instagram Stories, TikTok, Tarot cards, vertical social media

### 3. Background Generator (`/background-generator/`)
Character-free branded **background** generator — layered SVG (halftone, spectrum,
EVA patterns, sparkles, glyph/phrase band, screen FX), theme presets, and randomize.
Drop your own art/text over the exported PNG in Canva.
- **Canvas**: 1920×1080 (16:9), 1080×1920 (9:16), 1080×1080 (1:1)
- **Use Case**: Canva backgrounds, stream/overlay bases, social post backdrops
- **Note**: must be served from the repo/site root (it's an ES module that imports
  from `thumbnail-generator/`); see its doc for details.

## 🚀 Quick Start

### Option 1: Local File System
1. Extract this folder to any location
2. Open `index.html` in your browser (Chrome/Firefox recommended)
3. Use keyboard shortcuts and console commands (see tool-specific docs)

### Option 2: HTTP Server (Recommended for Cross-Origin Assets)
If you plan to load images from external URLs, serve via HTTP:

```bash
# Python 3
cd thumbnail-generator  # or neo-deco-portrait
python3 -m http.server 8000

# Node.js (with http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📚 Documentation

- **Thumbnail Generator**: See `docs/thumbnail-generator.md`
- **Neo-Deco Portrait**: See `docs/neo-deco-portrait.md`
- **Background Generator**: See `docs/background-generator.md`

## 🎨 Features

### Thumbnail Generator
- ✅ Animated corrupted text overlay
- ✅ Rotating diamond and grid effects
- ✅ WHYKUSANAGI logo with womb tattoo
- ✅ Celeste character illustration
- ✅ Customizable title and subtitle
- ✅ Optional subject/character in foreground
- ✅ One-click PNG export (1920×1080)

### Neo-Deco Portrait
- ✅ Art Deco geometric patterns
- ✅ Solar eclipse centerpiece
- ✅ Animated tentacles (toggleable)
- ✅ Occult symbols (pentagrams, Eye of Providence, alchemical symbols)
- ✅ Four theme colors (gold, pink, cyan, purple)
- ✅ Character image upload
- ✅ One-click PNG export (1080×1920)

### Background Generator
- ✅ 12 toggleable SVG layers (base, halftone ×2, spectrum, EVA, sparkles, glyphs+phrase, rails, nameplate, logo, glitch, scanlines+vignette, noise)
- ✅ Four theme presets (Lavender, Corrupted, Abyss, Succubus) recolor all layers
- ✅ Halftone density + dot-size (micro→large) + spread (corner/edge/full-field)
- ✅ Dual-corner halftone clusters (reference-sheet look)
- ✅ SFW/NSFW phrase band (reuses thumbnail-generator phrase pools)
- ✅ Per-FX intensity sliders (glitch, scanlines, vignette, noise)
- ✅ 🎲 Randomize variant
- ✅ One-click PNG export at three sizes (16:9 / 9:16 / 1:1), zero dependencies

## 🖥️ Browser Requirements

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript**: ES6 modules support required
- **Canvas API**: For PNG export functionality

## 📁 Directory Structure

```
standalone-tools/
├── README.md (this file)
├── thumbnail-generator/
│   ├── index.html (main page)
│   ├── css/
│   │   └── seamless-background.css
│   ├── js/
│   │   ├── anime-blocks-advanced.js (animation components)
│   │   └── logo-component.js (logo widget)
│   └── assets/
│       ├── Celeste_Legs.png
│       ├── Womb_Tattoo.png
│       └── backgrounds/
│           └── whykusanagi_rendered_SEAMLESS.png
├── neo-deco-portrait/
│   └── index.html (self-contained, no dependencies)
├── background-generator/
│   └── index.html (self-contained ES module; imports phrase pools from thumbnail-generator/)
└── docs/
    ├── thumbnail-generator.md
    ├── neo-deco-portrait.md
    └── background-generator.md
```

## 🔧 Technical Details

### Dependencies
- **Thumbnail Generator / Neo-Deco Portrait**: load html2canvas@1.4.1 on-demand for PNG export
- **Background Generator**: zero dependencies — native `XMLSerializer` + `<canvas>.toBlob` for PNG export
- **No build system**: Pure HTML/CSS/JavaScript (ES6 modules)
- **No npm/node_modules**: Zero dependencies to install

### Cross-Origin Images (CORS)
When loading images from external URLs:
- Use CORS-enabled sources or
- Serve files via HTTP server (not `file://`) or
- Convert images to data URLs (done automatically on export)

## 📝 License

Part of the whykusanagi/celeste-tts-bot project.
© 2025 whykusanagi

## 🕺 Celeste VRM Pose Schema

`static/data/celeste-poses.json` drives the scroll-triggered poses on
`celeste.html`'s 3D model. It is loaded at runtime by `PoseController`
(`src/3d/pose-controller.js`) — editing this file changes what the page does
with **no code change and no rebuild**.

### File shape

```json
{
  "blend": 12,
  "poses": {
    "crown": {
      "framing": { "target": "head", "dist": 1.2, "height": 1.6 },
      "bones": {
        "neck": { "euler": [-8, 12, 0] },
        "leftUpperArm": { "quat": [0.0, 0.0, 0.38, 0.92] }
      }
    }
  }
}
```

- **`blend`** — how fast the model eases into a pose. Higher is snappier.
  Default is `12`.
- **`poses`** — a map of pose name → pose entry. Pose names must match a
  `data-pose` attribute on a section in `celeste.html` (the scroll poser
  reads that attribute to pick which pose is active).
- **`framing`** *(optional)* — steers the camera while this pose is active.
  - `target`: the bone name the camera looks at.
  - `dist`: camera distance in metres. Optional — omitting it leaves the
    current camera distance alone.
  - `height`: metres, optional.
- **`bones`** — a map of VRM normalized humanoid bone name → rotation. Keys
  are the standard VRM humanoid bone names (`head`, `neck`, `spine`, `chest`,
  `hips`, `leftUpperArm`, ...). Each bone takes **exactly one** of:
  - `euler`: `[x, y, z]` in degrees, XYZ rotation order.
  - `quat`: `[x, y, z, w]`, which is what most VRM pose animators export
    directly.

### Failure behavior

A missing pose name or a malformed pose file is **not an error** — the page
falls back to the idle animation clip. This is deliberate: the shipped file
is `{"blend": 12, "poses": {}}`, empty on purpose, and the page must work
correctly with zero poses authored. Validate the schema with `npm test`.

---

**Created**: 2025-01-20
**Updated**: 2026-06-29 (added Background Generator)
**Version**: 1.1.0
**Maintained By**: whykusanagi
