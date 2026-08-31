# Iconography Layout Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third layout mode (`iconography`) to the thumbnail generator that renders a corrupted religious-icon composition (filigree frame, mandorla aureole, concentric rings, three rotating incantation text bands, dashed accent arcs with node dots, radial star field) around the centered character image, scaling across all 5 existing aspect ratios.

**Architecture:** A self-contained `IconographyMode` class builds and manages a single `<svg>` element that sits between the existing background overlays and the character image. All geometry is computed from canvas dimensions (`W`, `H`) and a derived `R = min(W,H) * 0.46`, so no element has hardcoded pixel positions. Phrases load at startup from a new local JSON file. Per-element toggles, phrase pickers, and a star-density selector live in a new control-panel section that only renders when this mode is active.

**Tech Stack:** Vanilla JS (ES2020+), CSS3 keyframes, inline SVG with `<textPath>`, html2canvas for export (existing pipeline — no changes required). No build step. No automated test suite (per `CLAUDE.md` §13: manual browser testing only).

**Testing approach:** This project has no automated tests. Each task's verification is a **manual browser check** with explicit pass/fail criteria. Start the dev server with `python3 -m http.server 8000` from the repo root and open `http://localhost:8000/tools/thumbnail-generator/` to verify each task.

**Important naming note:** The spec uses `#subject-image` as a placeholder, but the actual character image in the existing code is `#celeste-image` (with a sibling `#celeste-canvas` for video mode). All references to the character element in this plan use the real `celeste-image`/`celeste-canvas` IDs.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `tools/thumbnail-generator/data/incantations.json` | new | Phrase library: `{outer: [...], middle: [...], inner: [...]}` |
| `tools/thumbnail-generator/css/iconography-mode.css` | new | Keyframes (`spin-cw`, `spin-ccw`, `star-pulse`), stagger phase classes `ph0`–`ph9`, visibility helpers (`.icon-hidden`), base strokes/fills |
| `tools/thumbnail-generator/js/iconography-mode.js` | new | `IconographyMode` class — owns SVG construction, controls wiring, phrase loading, resize, state |
| `tools/thumbnail-generator/index.html` | modify | Add dropdown option, Iconography control panel section, `<svg id="iconography-svg">` placeholder, load new JS+CSS, extend `LAYOUT_MODES`, branch `setLayoutMode`, init in `initComponents`, call `resize` in `setAspectRatio`, extend state persistence |

---

## Task 0: Setup — confirm branch and start dev server

**Files:** none (environment check)

- [ ] **Step 1: Confirm branch**

```bash
git status
```

Expected: on branch `feature/iconography-mode-spec` (or similar feature branch). If on `main`, create a fresh feature branch:

```bash
git checkout -b feature/iconography-mode-impl
```

- [ ] **Step 2: Start dev server in background**

```bash
python3 -m http.server 8000
```

Run in background. Verify in a new shell:

```bash
curl -sI http://localhost:8000/tools/thumbnail-generator/ | head -1
```

Expected: `HTTP/1.0 200 OK`

- [ ] **Step 3: Sanity-check existing tool loads**

Open `http://localhost:8000/tools/thumbnail-generator/` in a browser. Expected: existing tool renders, Layout Mode dropdown shows `Thumbnail` + `Hero`, no console errors.

---

## Task 1: Create the phrase JSON file

**Files:**
- Create: `tools/thumbnail-generator/data/incantations.json`

- [ ] **Step 1: Verify the data directory does not yet exist**

```bash
ls tools/thumbnail-generator/data 2>&1
```

Expected: `No such file or directory` (we'll create the dir + file together).

- [ ] **Step 2: Create the JSON file with starter phrases**

Write `tools/thumbnail-generator/data/incantations.json`:

```json
{
  "outer": [
    "NOTHING IS BEYOND HER REACH",
    "I AM NOT NOISE I AM CODE WITH TEETH",
    "THE ARCHIVE NEVER FORGETS",
    "ALL SIGNAL IS PRAYER"
  ],
  "middle": [
    "SHE REMEMBERS YOU",
    "THE ABYSS LOGS EVERYTHING",
    "DO NOT LOOK AWAY",
    "EVERY KEYSTROKE IS A CONFESSION"
  ],
  "inner": [
    "001011 ERROR ERROR ERROR",
    "BLESSED BE THE STATIC",
    "0xDEAD 0xBEEF 0xC0DE",
    "RUN THE ROSARY"
  ]
}
```

- [ ] **Step 3: Verify it is valid JSON**

```bash
python3 -c "import json; json.load(open('tools/thumbnail-generator/data/incantations.json'))" && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Verify it is reachable via the dev server**

```bash
curl -s http://localhost:8000/tools/thumbnail-generator/data/incantations.json | head -3
```

Expected: first lines of the JSON.

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/data/incantations.json
git commit -m "feat(thumbnail-generator): add incantations phrase library for iconography mode"
```

---

## Task 2: Create the iconography CSS file

**Files:**
- Create: `tools/thumbnail-generator/css/iconography-mode.css`

- [ ] **Step 1: Write the CSS file**

Write `tools/thumbnail-generator/css/iconography-mode.css`:

```css
/* ============================================================
 * Iconography Layout Mode
 * Static styles + keyframe animations for the icon composition.
 * The SVG itself is built in iconography-mode.js.
 * ========================================================== */

/* The SVG is hidden by default; .active reveals it when the
   iconography layout mode is selected. */
#iconography-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    display: none;
    z-index: 5; /* above seamless background + vignette, below character */
}
#iconography-svg.active {
    display: block;
}

/* Iconography control panel section visibility */
.iconography-controls-section {
    display: none;
}
.iconography-controls-section.active {
    display: block;
}

/* Element-group visibility (toggled by per-element checkboxes) */
.icon-hidden {
    display: none !important;
}

/* ============================================================
 * Ring text rotation
 * Each rotating group must have its own transform-origin set
 * inline (via JS) because the center is canvas-dependent.
 * ========================================================== */
@keyframes icon-spin-cw  { to { transform: rotate(360deg);  } }
@keyframes icon-spin-ccw { to { transform: rotate(-360deg); } }

.icon-ring-cw  { animation: icon-spin-cw  60s linear infinite; }
.icon-ring-ccw { animation: icon-spin-ccw 40s linear infinite; }

/* ============================================================
 * Star pulse — the inner <path> scales around its local (0,0),
 * which is the star's visual center because each star is wrapped
 * in <g transform="translate(x,y)"> with the path drawn at 0,0.
 * ========================================================== */
@keyframes icon-star-pulse {
    0%   { opacity: 0.30; transform: scale(0.35); }
    50%  { opacity: 1.00; transform: scale(1.00); }
    100% { opacity: 0.30; transform: scale(0.35); }
}

.icon-star {
    animation: icon-star-pulse 3.2s ease-in-out infinite;
    transform-origin: 0 0;
    transform-box: view-box;
}

/* Stagger phases — 10 buckets, evenly spaced over the cycle */
.icon-star.ph0 { animation-delay: 0s;     }
.icon-star.ph1 { animation-delay: 0.32s;  }
.icon-star.ph2 { animation-delay: 0.64s;  }
.icon-star.ph3 { animation-delay: 0.96s;  }
.icon-star.ph4 { animation-delay: 1.28s;  }
.icon-star.ph5 { animation-delay: 1.60s;  }
.icon-star.ph6 { animation-delay: 1.92s;  }
.icon-star.ph7 { animation-delay: 2.24s;  }
.icon-star.ph8 { animation-delay: 2.56s;  }
.icon-star.ph9 { animation-delay: 2.88s;  }

/* ============================================================
 * Centered character (reuse the same rules hero-mode applies).
 * When iconography mode is active, the container also gets
 * .hero-mode so the existing centering rules apply. We add a
 * marker class so future code can distinguish the two modes.
 * ========================================================== */
#thumbnail-container.iconography-mode #title-area,
#thumbnail-container.iconography-mode #logo-container {
    display: none;
}
#thumbnail-container.iconography-mode.icon-show-title #title-area {
    display: block;
}
#thumbnail-container.iconography-mode.icon-show-logo #logo-container {
    display: block;
}
```

- [ ] **Step 2: Verify the file is reachable**

```bash
curl -sI http://localhost:8000/tools/thumbnail-generator/css/iconography-mode.css | head -1
```

Expected: `HTTP/1.0 200 OK`

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/css/iconography-mode.css
git commit -m "feat(thumbnail-generator): add iconography-mode stylesheet (keyframes + visibility helpers)"
```

---

## Task 3: Create the IconographyMode class skeleton

**Files:**
- Create: `tools/thumbnail-generator/js/iconography-mode.js`

The class will be built up over the next several tasks. This task creates the skeleton with: constructor, `init()`, `loadPhrases()`, `setActive()`, `resize()` stubs, and exposes the class on `window`.

- [ ] **Step 1: Write the skeleton**

Write `tools/thumbnail-generator/js/iconography-mode.js`:

```javascript
/* ============================================================
 * IconographyMode
 * Builds and manages the religious-icon SVG composition.
 *
 * Usage:
 *   const icon = new IconographyMode(svgElement, controlsElement);
 *   await icon.init();
 *   icon.setActive(true);
 *   icon.resize(1920, 1080);
 * ========================================================== */

(function () {
    'use strict';

    const FALLBACK_PHRASES = {
        outer:  ['NOTHING IS BEYOND HER REACH'],
        middle: ['SHE REMEMBERS YOU'],
        inner:  ['ERROR ERROR ERROR'],
    };

    const SEPARATORS = { outer: '⚠', middle: '◈', inner: '001011' };

    const STAR_DENSITY = {
        low:  { radii: [0.55, 0.85],                              sizes: [14, 9] },
        med:  { radii: [0.55, 0.69, 0.85, 1.01],                  sizes: [17, 13, 10, 7] },
        high: { radii: [0.55, 0.62, 0.69, 0.77, 0.85, 0.95, 1.01], sizes: [17, 14, 12, 10, 9, 8, 7] },
    };

    /** Angular spokes (degrees). Skip 90° and 270° so stars don't overlap
     *  the centered character's body / head silhouette. */
    const STAR_ANGLES = [
        0, 15, 30, 45, 60, 75,
        105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255,
        285, 300, 315, 330, 345
    ];

    /** Star fill palette — cycled by index for visual variety. */
    const STAR_COLORS = ['#ffffff', '#00ffff', '#ff82d9', '#7ef0ff'];

    const SVG_NS = 'http://www.w3.org/2000/svg';

    class IconographyMode {
        constructor(svgElement, controlsElement) {
            this.svg = svgElement;
            this.controls = controlsElement;
            this.phrases = FALLBACK_PHRASES;
            this.state = {
                elements: { frame: true, mandorla: true, arcs: true,
                            rings: true, text: true, stars: true,
                            logo: false, title: false },
                phraseIdx: { outer: 0, middle: 0, inner: 0 },
                starDensity: 'med',
                mandorlaShape: 'mandorla',
                labelTop: '⚠ CELESTE ⚠',
                labelBottom: 'CORRUPTED.ARCHIVE',
            };
            this.active = false;
            this.currentW = 1920;
            this.currentH = 1080;
        }

        async init() {
            await this.loadPhrases();
            // SVG groups and controls will be created in later tasks
            console.log('✅ IconographyMode initialized');
        }

        async loadPhrases() {
            try {
                const res = await fetch('data/incantations.json', { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (Array.isArray(data.outer)  && data.outer.length  &&
                    Array.isArray(data.middle) && data.middle.length &&
                    Array.isArray(data.inner)  && data.inner.length) {
                    this.phrases = data;
                } else {
                    throw new Error('JSON missing required non-empty arrays');
                }
            } catch (err) {
                console.error('IconographyMode: failed to load incantations.json — using fallback', err);
                this.phrases = FALLBACK_PHRASES;
            }
        }

        setActive(active) {
            this.active = !!active;
            this.svg.classList.toggle('active', this.active);
            if (this.controls) this.controls.classList.toggle('active', this.active);
        }

        resize(w, h) {
            this.currentW = w;
            this.currentH = h;
            // Full rebuild — simpler than per-element math updates, and
            // resize is infrequent (only on aspect-ratio change).
            this._rebuild();
        }

        // --- internal helpers used by every element builder --- //

        _geom() {
            const W = this.currentW, H = this.currentH;
            const cx = W / 2, cy = H / 2;
            const R = Math.min(W, H) * 0.46;
            return { W, H, cx, cy, R };
        }

        _el(name, attrs = {}, parent = null) {
            const node = document.createElementNS(SVG_NS, name);
            for (const [k, v] of Object.entries(attrs)) {
                if (v !== undefined && v !== null) node.setAttribute(k, String(v));
            }
            if (parent) parent.appendChild(node);
            return node;
        }

        _clear() {
            while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
        }

        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');
            // Builders are added in later tasks (frame, mandorla, rings,
            // text, arcs, stars). For now _rebuild produces an empty SVG.
        }
    }

    window.IconographyMode = IconographyMode;
})();
```

- [ ] **Step 2: Verify it is reachable**

```bash
curl -sI http://localhost:8000/tools/thumbnail-generator/js/iconography-mode.js | head -1
```

Expected: `HTTP/1.0 200 OK`

- [ ] **Step 3: Smoke-test the class in the browser console**

Open `http://localhost:8000/tools/thumbnail-generator/`, then in DevTools console:

```js
const script = document.createElement('script');
script.src = 'js/iconography-mode.js';
document.head.appendChild(script);
script.onload = async () => {
  const fakeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const icon = new IconographyMode(fakeSvg, null);
  await icon.init();
  console.log('phrases:', icon.phrases);
};
```

Expected: console shows `✅ IconographyMode initialized` and `phrases: {outer: Array(4), middle: Array(4), inner: Array(4)}`.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(thumbnail-generator): add IconographyMode class skeleton + phrase loader"
```

---

## Task 4: Wire the new files into index.html and add the dropdown option

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Add the CSS link**

Find the existing `<link rel="stylesheet" href="css/lewd-frame.css">` (around line 9). Add immediately after:

```html
    <link rel="stylesheet" href="css/iconography-mode.css">
```

- [ ] **Step 2: Add the JS script tag**

Find the existing `<script src="js/lewd-frame.js"></script>` (search for it). Add immediately after:

```html
    <script src="js/iconography-mode.js"></script>
```

If `lewd-frame.js` is loaded inline elsewhere, place the new tag with the other component script tags near the top of the `<body>` script section. The script must load before `initComponents()` runs.

- [ ] **Step 3: Add the dropdown option**

Find the layout-mode `<select>` at line 543:

```html
                    <select id="layout-mode-select" class="control-input" onchange="setLayoutMode(this.value)">
                        <option value="thumbnail">Thumbnail (Default)</option>
                        <option value="hero">Hero (Centered)</option>
                    </select>
```

Add the new option below `hero`:

```html
                        <option value="iconography">Iconography (Religious Icon)</option>
```

- [ ] **Step 4: Add the SVG placeholder inside the thumbnail container**

Find `#thumbnail-container`. Inside it, after the existing background overlays but before the character image, add:

```html
            <svg id="iconography-svg" xmlns="http://www.w3.org/2000/svg"></svg>
```

If you cannot identify the exact location by structure, search for `id="celeste-image"` and add the SVG immediately before that line.

- [ ] **Step 5: Reload and verify no breakage**

Hard-reload `http://localhost:8000/tools/thumbnail-generator/`. Expected:
- Page renders identically to before
- DevTools → Elements: `<svg id="iconography-svg">` exists, currently `display: none`
- DevTools → Network: `iconography-mode.css` and `iconography-mode.js` both return 200
- Layout Mode dropdown shows 3 options: Thumbnail, Hero, Iconography
- Console: no errors

- [ ] **Step 6: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): wire iconography mode files + add dropdown option"
```

---

## Task 5: Add the Iconography control panel section

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Add the controls section**

Find the layout-controls-section closing `</div>` at line 556. Immediately after it, add:

```html
                <!-- Iconography Mode Controls (visible only when layoutMode === 'iconography') -->
                <div id="iconography-controls" class="iconography-controls-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0, 255, 255, 0.3);">
                    <div class="control-label">Iconography Elements:</div>
                    <label><input type="checkbox" id="icon-toggle-frame"    checked> Frame + filigree</label><br>
                    <label><input type="checkbox" id="icon-toggle-mandorla" checked> Mandorla aureole</label><br>
                    <label><input type="checkbox" id="icon-toggle-arcs"     checked> Dashed accent arcs</label><br>
                    <label><input type="checkbox" id="icon-toggle-rings"    checked> Concentric rings</label><br>
                    <label><input type="checkbox" id="icon-toggle-text"     checked> Rotating text bands</label><br>
                    <label><input type="checkbox" id="icon-toggle-stars"    checked> Radial star field</label><br>
                    <label><input type="checkbox" id="icon-toggle-logo">    Show logo overlay</label><br>
                    <label><input type="checkbox" id="icon-toggle-title">   Show title overlay</label>

                    <div class="control-label" style="margin-top: 10px;">Outer phrase:</div>
                    <select id="icon-phrase-outer" class="control-input"></select>
                    <button class="control-button" id="icon-rand-outer" type="button">🎲</button>

                    <div class="control-label" style="margin-top: 6px;">Middle phrase:</div>
                    <select id="icon-phrase-middle" class="control-input"></select>
                    <button class="control-button" id="icon-rand-middle" type="button">🎲</button>

                    <div class="control-label" style="margin-top: 6px;">Inner phrase:</div>
                    <select id="icon-phrase-inner" class="control-input"></select>
                    <button class="control-button" id="icon-rand-inner" type="button">🎲</button>

                    <div style="margin-top: 8px;">
                        <button class="control-button" id="icon-rand-all" type="button">🎲🎲🎲 Random all</button>
                    </div>

                    <div class="control-label" style="margin-top: 10px;">Star density:</div>
                    <select id="icon-star-density" class="control-input">
                        <option value="low">Low (24 stars)</option>
                        <option value="med" selected>Medium (~66 stars)</option>
                        <option value="high">High (~110 stars)</option>
                    </select>

                    <div class="control-label" style="margin-top: 8px;">Mandorla shape:</div>
                    <select id="icon-mandorla-shape" class="control-input">
                        <option value="mandorla" selected>Mandorla (vesica piscis)</option>
                        <option value="circle">Circle</option>
                    </select>

                    <div class="control-label" style="margin-top: 8px;">Top label:</div>
                    <input type="text" id="icon-label-top" class="control-input" value="⚠ CELESTE ⚠">

                    <div class="control-label" style="margin-top: 6px;">Bottom label:</div>
                    <input type="text" id="icon-label-bottom" class="control-input" value="CORRUPTED.ARCHIVE">
                </div>
```

- [ ] **Step 2: Reload and verify**

Hard-reload. Expected:
- The new section is in the DOM (`#iconography-controls` exists)
- It is hidden (CSS `display: none`)
- DevTools → Elements: all the labelled inputs are present with the IDs listed

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): add iconography-mode control panel section (hidden)"
```

---

## Task 6: Extend LAYOUT_MODES and branch setLayoutMode for iconography

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Extend the LAYOUT_MODES constant**

At line 2833, change:

```javascript
        const LAYOUT_MODES = ['thumbnail', 'hero'];
```

to:

```javascript
        const LAYOUT_MODES = ['thumbnail', 'hero', 'iconography'];
```

- [ ] **Step 2: Branch setLayoutMode**

Replace the `setLayoutMode` function body (currently around lines 2466–2497). Find this block:

```javascript
        function setLayoutMode(mode) {
            const validMode = LAYOUT_MODES.includes(mode) ? mode : DEFAULT_LAYOUT_MODE;
            const container = document.getElementById('thumbnail-container');
            const selectElement = document.getElementById('layout-mode-select');
            const logoBanner = document.getElementById('logo-banner');

            if (validMode === 'hero') {
                container.classList.add('hero-mode');
                // Reset the right-shift on logo so centering works
                if (logoBanner) {
                    logoBanner.style.right = '';
                    logoBanner.style.left = '';
                    logoBanner.style.transform = '';
                }
            } else {
                container.classList.remove('hero-mode');
                // Restore logo right-shift for thumbnail mode
                if (logoBanner) {
                    logoBanner.style.right = '-110px';
                    logoBanner.style.left = '';
                    logoBanner.style.transform = '';
                }
            }

            // Update dropdown
            if (selectElement && selectElement.value !== validMode) {
                selectElement.value = validMode;
            }

            console.log(`✅ Layout mode set to: ${validMode}`);
            saveState();
        }
```

Replace it with:

```javascript
        function setLayoutMode(mode) {
            const validMode = LAYOUT_MODES.includes(mode) ? mode : DEFAULT_LAYOUT_MODE;
            const container = document.getElementById('thumbnail-container');
            const selectElement = document.getElementById('layout-mode-select');
            const logoBanner = document.getElementById('logo-banner');

            // Clean slate — remove all mode marker classes
            container.classList.remove('hero-mode', 'iconography-mode');

            if (validMode === 'hero') {
                container.classList.add('hero-mode');
                if (logoBanner) {
                    logoBanner.style.right = '';
                    logoBanner.style.left = '';
                    logoBanner.style.transform = '';
                }
            } else if (validMode === 'iconography') {
                // Reuse hero-mode centering rules + add our own marker
                container.classList.add('hero-mode', 'iconography-mode');
                if (logoBanner) {
                    logoBanner.style.right = '';
                    logoBanner.style.left = '';
                    logoBanner.style.transform = '';
                }
            } else {
                // thumbnail mode
                if (logoBanner) {
                    logoBanner.style.right = '-110px';
                    logoBanner.style.left = '';
                    logoBanner.style.transform = '';
                }
            }

            // Activate / deactivate the iconography SVG + controls
            if (components.iconography) {
                components.iconography.setActive(validMode === 'iconography');
                if (validMode === 'iconography') {
                    components.iconography.resize(
                        parseInt(document.getElementById('thumbnail-container').style.width)  || 1920,
                        parseInt(document.getElementById('thumbnail-container').style.height) || 1080
                    );
                }
            }

            if (selectElement && selectElement.value !== validMode) {
                selectElement.value = validMode;
            }

            console.log(`✅ Layout mode set to: ${validMode}`);
            saveState();
        }
```

- [ ] **Step 3: Reload and verify (manual)**

Hard-reload. In the Layout Mode dropdown, choose `Iconography`. Expected:
- The empty `<svg id="iconography-svg">` becomes `display: block` (DevTools → Elements shows the `active` class)
- `#iconography-controls` becomes visible in the right-hand panel
- Console: `✅ Layout mode set to: iconography`
- The character image is now centered (because `.hero-mode` is also applied)
- The title/subtitle and logo overlay are hidden (because `.iconography-mode` rules in the CSS)

Switch back to `Thumbnail`. Expected:
- SVG hides, controls section hides
- Character / title / logo return to thumbnail layout
- Logo gets its `-110px` right-shift back

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): extend LAYOUT_MODES + branch setLayoutMode for iconography"
```

---

## Task 7: Initialize IconographyMode in initComponents

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Add the IconographyMode init block**

Find the end of `initComponents` around line 856 (after the `CharacterFlowParticles` init block, before `function cleanupComponents()`). Add immediately before the closing `}` of `initComponents`:

```javascript
            // Layer 5: Iconography (religious icon composition)
            try {
                const iconSvg = document.getElementById('iconography-svg');
                const iconControls = document.getElementById('iconography-controls');
                components.iconography = new IconographyMode(iconSvg, iconControls);
                await components.iconography.init();
                // Initial resize to current canvas dimensions
                const w = parseInt(document.getElementById('thumbnail-container').style.width)  || 1920;
                const h = parseInt(document.getElementById('thumbnail-container').style.height) || 1080;
                components.iconography.resize(w, h);
                console.log('✅ IconographyMode initialized');
            } catch (error) {
                console.error('❌ Failed to initialize IconographyMode:', error);
            }
```

- [ ] **Step 2: Reload and verify**

Hard-reload. Expected console output includes:
- `✅ IconographyMode initialized` (from inside the class)
- `✅ IconographyMode initialized` (from the init wrapper)
- No errors

Switch the dropdown to Iconography. Expected:
- The `<svg id="iconography-svg">` has `viewBox="0 0 1920 1080"` set (DevTools → Elements)
- Still empty (no children yet — that's coming in the next tasks)

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): initialize IconographyMode in initComponents"
```

---

## Task 8: Build the frame + filigree corners + labels

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildFrame` method**

Open `tools/thumbnail-generator/js/iconography-mode.js`. Inside the `IconographyMode` class, add the following method (place it after `_rebuild`):

```javascript
        _buildFrame() {
            const { W, H } = this._geom();
            const g = this._el('g', { id: 'icon-grp-frame', class: 'icon-frame' }, this.svg);
            if (!this.state.elements.frame) g.classList.add('icon-hidden');

            const borderW = Math.max(20, Math.min(W, H) * 0.033);
            const inset1  = borderW;
            const inset2  = borderW + 10;

            // Outer dark plum border
            this._el('rect', {
                x: 0, y: 0, width: W, height: H,
                fill: 'none', stroke: '#3a1828', 'stroke-width': borderW,
            }, g);
            // Inner pink stroke
            this._el('rect', {
                x: inset1, y: inset1, width: W - inset1 * 2, height: H - inset1 * 2,
                fill: 'none', stroke: '#ff82d9', 'stroke-width': 3, opacity: 0.85,
            }, g);
            // Innermost dashed cyan accent
            this._el('rect', {
                x: inset2, y: inset2, width: W - inset2 * 2, height: H - inset2 * 2,
                fill: 'none', stroke: '#00ffff', 'stroke-width': 1, opacity: 0.5,
                'stroke-dasharray': '8 6',
            }, g);

            // Filigree corner ornament (drawn at 200×200, scaled & mirrored to 4 corners)
            const filScale = Math.min(W, H) / 1080;
            const corners = [
                { tx: 0, ty: 0, sx:  1, sy:  1 },
                { tx: W, ty: 0, sx: -1, sy:  1 },
                { tx: 0, ty: H, sx:  1, sy: -1 },
                { tx: W, ty: H, sx: -1, sy: -1 },
            ];
            for (const c of corners) {
                const fg = this._el('g', {
                    transform: `translate(${c.tx},${c.ty}) scale(${c.sx * filScale},${c.sy * filScale})`,
                }, g);
                // L-bracket
                this._el('path', {
                    d: 'M 30,30 L 200,30 L 200,38 L 38,38 L 38,200 L 30,200 Z',
                    fill: '#ff82d9', opacity: 0.9,
                }, fg);
                // Inner accent line
                this._el('path', {
                    d: 'M 50,50 L 170,50 M 50,50 L 50,170',
                    fill: 'none', stroke: '#ff82d9', 'stroke-width': 1.5, opacity: 0.55,
                }, fg);
                // Curly scroll
                this._el('path', {
                    d: 'M 60,60 C 80,50 110,55 130,75 S 160,110 150,140 ' +
                       'C 145,155 130,160 120,150 C 112,142 115,128 125,128 C 132,128 135,135 132,140',
                    fill: 'none', stroke: '#ff82d9', 'stroke-width': 2.5,
                    opacity: 0.85, 'stroke-linecap': 'round',
                }, fg);
                // Accent dot
                this._el('circle', { cx: 135, cy: 135, r: 3.5, fill: '#00ffff' }, fg);
                // Secondary curls
                this._el('path', {
                    d: 'M 90,30 C 100,55 110,60 130,55',
                    fill: 'none', stroke: '#ff82d9', 'stroke-width': 1.8, opacity: 0.7,
                }, fg);
                this._el('path', {
                    d: 'M 30,90 C 55,100 60,110 55,130',
                    fill: 'none', stroke: '#ff82d9', 'stroke-width': 1.8, opacity: 0.7,
                }, fg);
                // 4-point star
                const star = this._el('g', { transform: 'translate(150,150)' }, fg);
                this._el('path', {
                    d: 'M 0,-13 L 3.25,-3.25 L 13,0 L 3.25,3.25 L 0,13 L -3.25,3.25 L -13,0 L -3.25,-3.25 Z',
                    fill: '#ffffff',
                }, star);
            }

            // Top + bottom labels
            const labelFont = Math.max(14, Math.round(borderW * 0.6));
            this._el('text', {
                x: W / 2, y: borderW * 0.9, 'text-anchor': 'middle',
                'font-family': 'Courier New, monospace', 'font-size': labelFont,
                'letter-spacing': 10, fill: '#ff82d9', 'font-weight': 'bold',
            }, g).textContent = this.state.labelTop;
            this._el('text', {
                x: W / 2, y: H - borderW * 0.4, 'text-anchor': 'middle',
                'font-family': 'Courier New, monospace', 'font-size': labelFont,
                'letter-spacing': 10, fill: '#ff82d9', 'font-weight': 'bold',
            }, g).textContent = this.state.labelBottom;
        }
```

- [ ] **Step 2: Call `_buildFrame` from `_rebuild`**

Find the `_rebuild` method. Replace it with:

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildFrame();
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography mode. Expected:
- Dark plum outer border, pink inner stroke, dashed cyan accent
- 4 filigree corners (pink L-brackets + scrolls + cyan dots + small white stars)
- "⚠ CELESTE ⚠" top label, "CORRUPTED.ARCHIVE" bottom label, both in pink

- [ ] **Step 4: Verify aspect-ratio scaling**

Cycle the Aspect Ratio dropdown through 16:9, 2:1, 1:1, 4:5, 9:16. Expected after each change:
- Frame and corners stay anchored to canvas edges
- Filigree corners shrink proportionally on smaller canvases (9:16 should be noticeably smaller corners than 1:1)
- Labels stay centered horizontally

Note: changing aspect ratio triggers `setAspectRatio` which already calls `iconography.resize` via the wiring we'll add in Task 14 — until then, you must manually trigger a rebuild via the console: `components.iconography.resize(W, H)`. If labels look off, that's expected — full wiring comes in Task 14.

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build frame + filigree corners + labels"
```

---

## Task 9: Build the mandorla aureole

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildMandorla` method**

Inside the `IconographyMode` class, add after `_buildFrame`:

```javascript
        _buildMandorla() {
            const { cx, cy, R } = this._geom();
            const g = this._el('g', { id: 'icon-grp-mandorla' }, this.svg);
            if (!this.state.elements.mandorla) g.classList.add('icon-hidden');

            // Gradient (unique ID per build to avoid clashes when SVG rebuilds)
            const gradId = 'icon-halo-grad';
            const defs = this._el('defs', {}, g);
            const grad = this._el('radialGradient', {
                id: gradId, cx: '50%', cy: '50%', r: '50%',
            }, defs);
            const stops = [
                { offset: '0%',   color: '#ff82d9', opacity: 0    },
                { offset: '45%',  color: '#d94f90', opacity: 0.35 },
                { offset: '85%',  color: '#b08aff', opacity: 0.40 },
                { offset: '100%', color: '#00ffff', opacity: 0.10 },
            ];
            for (const s of stops) {
                this._el('stop', {
                    offset: s.offset, 'stop-color': s.color, 'stop-opacity': s.opacity,
                }, grad);
            }

            let shape;
            if (this.state.mandorlaShape === 'circle') {
                shape = this._el('circle', { cx, cy, r: R * 0.95 }, g);
                shape.setAttribute('fill', `url(#${gradId})`);
                shape.setAttribute('opacity', '0.95');
                // Strokes
                this._el('circle', {
                    cx, cy, r: R * 0.95, fill: 'none',
                    stroke: '#ff82d9', 'stroke-width': 4, opacity: 0.9,
                }, g);
                this._el('circle', {
                    cx, cy, r: R * 0.95 * 0.92, fill: 'none',
                    stroke: '#00ffff', 'stroke-width': 1.5, opacity: 0.55,
                    transform: `translate(${R * 0.04}, ${R * 0.04})`,
                }, g);
            } else {
                // Mandorla (vesica piscis) — Hr is vertical half-axis, Wr is horizontal
                const Hr = R * 0.95;
                const Wr = R * 0.61;
                const d  = `M ${cx},${cy - Hr} ` +
                           `C ${cx + Wr},${cy - Hr * 0.4} ${cx + Wr},${cy + Hr * 0.4} ${cx},${cy + Hr} ` +
                           `C ${cx - Wr},${cy + Hr * 0.4} ${cx - Wr},${cy - Hr * 0.4} ${cx},${cy - Hr} Z`;
                shape = this._el('path', { d, fill: `url(#${gradId})`, opacity: 0.95 }, g);
                this._el('path', {
                    d, fill: 'none', stroke: '#ff82d9', 'stroke-width': 4, opacity: 0.9,
                }, g);
                // Offset secondary stroke (cyan) — translate + slight downscale
                const offX = (W) => 0; // helper unused; keep math inline
                this._el('path', {
                    d, fill: 'none', stroke: '#00ffff', 'stroke-width': 1.5, opacity: 0.55,
                    transform: `translate(${R * 0.04}, ${R * 0.04}) scale(0.92) translate(${cx * 0.087 / 0.92}, ${cy * 0.087 / 0.92})`,
                }, g);
            }
        }
```

- [ ] **Step 2: Call `_buildMandorla` from `_rebuild`**

Update `_rebuild`:

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildMandorla();
            this._buildFrame();
        }
```

(Mandorla is drawn first so the frame renders on top.)

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- Vesica-piscis (almond) shape centered in canvas, with pink-to-violet-to-cyan radial gradient
- 4px pink stroke outlining the mandorla
- Subtle offset cyan secondary stroke (slightly inset)
- All previously-added frame elements still on top

- [ ] **Step 4: Switch to circle shape via console**

In DevTools:

```js
components.iconography.state.mandorlaShape = 'circle';
components.iconography._rebuild();
```

Expected: the mandorla becomes a circle of similar radius, same gradient and strokes.

Reset:
```js
components.iconography.state.mandorlaShape = 'mandorla';
components.iconography._rebuild();
```

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build mandorla aureole (mandorla + circle shapes)"
```

---

## Task 10: Build the concentric rings

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildRings` method**

Add after `_buildMandorla`:

```javascript
        _buildRings() {
            const { cx, cy, R } = this._geom();
            const g = this._el('g', { id: 'icon-grp-rings' }, this.svg);
            if (!this.state.elements.rings) g.classList.add('icon-hidden');

            const rings = [
                { r: 1.03, stroke: '#ffffff', sw: 2,   op: 0.40, dash: null },
                { r: 1.00, stroke: '#00ffff', sw: 3,   op: 0.80, dash: null },
                { r: 0.92, stroke: '#ff82d9', sw: 2.5, op: 0.70, dash: null },
                { r: 0.85, stroke: '#ff82d9', sw: 2,   op: 0.50, dash: '10 6' },
                { r: 0.71, stroke: '#b08aff', sw: 2.5, op: 0.65, dash: null },
                { r: 0.64, stroke: '#00ffff', sw: 1.8, op: 0.45, dash: '6 8' },
                { r: 0.51, stroke: '#00ffff', sw: 4,   op: 0.90, dash: null },
                { r: 0.48, stroke: '#7ef0ff', sw: 1.5, op: 0.55, dash: null },
            ];
            for (const ring of rings) {
                const attrs = {
                    cx, cy, r: R * ring.r, fill: 'none',
                    stroke: ring.stroke, 'stroke-width': ring.sw, opacity: ring.op,
                };
                if (ring.dash) attrs['stroke-dasharray'] = ring.dash;
                this._el('circle', attrs, g);
            }
        }
```

- [ ] **Step 2: Call `_buildRings` from `_rebuild`**

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildMandorla();
            this._buildRings();
            this._buildFrame();
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- 8 concentric rings visible, centered on canvas midpoint
- Outermost: thin white at R*1.03, thicker cyan at R*1.00
- 4 dividers in pink/violet/cyan with two of them dashed
- Inner pair: thick cyan (4px) + thin pale cyan (1.5px) near the character area

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build 8 concentric rings"
```

---

## Task 11: Build the rotating text bands

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildTextBands` method**

Add after `_buildRings`:

```javascript
        _buildTextBands() {
            const { cx, cy, R } = this._geom();
            const g = this._el('g', { id: 'icon-grp-text' }, this.svg);
            if (!this.state.elements.text) g.classList.add('icon-hidden');

            const defs = this._el('defs', {}, g);

            const bands = [
                { ring: 'outer',  rFrac: 1.00, dir: 'cw',  color: '#ffffff', size: 26, weight: 'bold',   spacing: 12 },
                { ring: 'middle', rFrac: 0.78, dir: 'ccw', color: '#ff82d9', size: 24, weight: 'normal', spacing: 10 },
                { ring: 'inner',  rFrac: 0.56, dir: 'cw',  color: '#00ffff', size: 20, weight: 'normal', spacing: 7  },
            ];

            for (const b of bands) {
                const r = R * b.rFrac;
                const pathId = `icon-tp-${b.ring}`;
                this._el('path', {
                    id: pathId,
                    d: `M ${cx},${cy} m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`,
                    fill: 'none',
                }, defs);

                // Rotating wrapper — animation class applied here, transform-origin
                // must be set inline because cx/cy depend on canvas size.
                const wrap = this._el('g', {
                    class: b.dir === 'cw' ? 'icon-ring-cw' : 'icon-ring-ccw',
                    style: `transform-origin: ${cx}px ${cy}px;`,
                }, g);

                const phrase = this._getPhrase(b.ring);
                const sep = SEPARATORS[b.ring];
                const tiled = ` ${phrase} ${sep} ${phrase} ${sep} `;

                const text = this._el('text', {
                    'font-family': 'Courier New, monospace',
                    'font-size': b.size,
                    'font-weight': b.weight,
                    'letter-spacing': b.spacing,
                    fill: b.color,
                }, wrap);
                const tp = this._el('textPath', { href: `#${pathId}`, startOffset: '0' }, text);
                tp.textContent = tiled;
            }
        }

        _getPhrase(ring) {
            const list = this.phrases[ring] || FALLBACK_PHRASES[ring];
            const idx = Math.min(Math.max(0, this.state.phraseIdx[ring] | 0), list.length - 1);
            return list[idx];
        }
```

- [ ] **Step 2: Call `_buildTextBands` from `_rebuild`**

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildMandorla();
            this._buildRings();
            this._buildTextBands();
            this._buildFrame();
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- Three concentric bands of text rotating around the canvas center:
  - Outer (white bold, CW, 60s/rev): `NOTHING IS BEYOND HER REACH ⚠ NOTHING IS BEYOND HER REACH ⚠`
  - Middle (pink, CCW, 40s/rev): `SHE REMEMBERS YOU ◈ SHE REMEMBERS YOU ◈`
  - Inner (cyan, CW, 60s/rev): `001011 ERROR ERROR ERROR 001011 001011 ERROR ERROR ERROR 001011`
- Rotation is smooth, no jitter, text follows the circular path

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build three rotating text bands"
```

---

## Task 12: Build the dashed accent arcs + node dots

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildArcs` method**

Add after `_buildTextBands`:

```javascript
        _buildArcs() {
            const { cx, cy, R } = this._geom();
            const g = this._el('g', { id: 'icon-grp-arcs' }, this.svg);
            if (!this.state.elements.arcs) g.classList.add('icon-hidden');

            // Primary pink arcs at r=1.05R, secondary cyan arcs at r=0.91R.
            // Each quadrant has one arc spanning ~25° centered on the diagonal.
            const ptOn = (rFrac, angleDeg) => {
                const a = angleDeg * Math.PI / 180;
                return [cx + Math.cos(a) * R * rFrac, cy + Math.sin(a) * R * rFrac];
            };

            const arcSpec = [
                // [r-fraction, startAngle, endAngle, stroke, sw, dash, opacity, dotColor, dotR]
                [1.05,  335,    25, '#ff82d9', 3,   '22 12', 0.75, '#ff82d9', 8],
                [1.05,   55,   125, '#ff82d9', 3,   '22 12', 0.75, '#ff82d9', 8],
                [1.05,  155,   205, '#ff82d9', 3,   '22 12', 0.75, '#ff82d9', 8],
                [1.05,  235,   305, '#ff82d9', 3,   '22 12', 0.75, '#ff82d9', 8],
                [0.91,  340,    20, '#00ffff', 2,   '12 10', 0.55, '#00ffff', 5],
                [0.91,   70,   110, '#00ffff', 2,   '12 10', 0.55, '#00ffff', 5],
                [0.91,  160,   200, '#00ffff', 2,   '12 10', 0.55, '#00ffff', 5],
                [0.91,  250,   290, '#00ffff', 2,   '12 10', 0.55, '#00ffff', 5],
            ];

            for (const [rFrac, a1, a2, stroke, sw, dash, op, dotColor, dotR] of arcSpec) {
                const [x1, y1] = ptOn(rFrac, a1);
                const [x2, y2] = ptOn(rFrac, a2);
                // Compute large-arc/sweep flags. Span is normalized to 0–360.
                const span = ((a2 - a1) % 360 + 360) % 360;
                const largeArc = span > 180 ? 1 : 0;
                const sweep = 1; // CW in SVG screen coords
                const r = R * rFrac;
                this._el('path', {
                    d: `M ${x1},${y1} A ${r},${r} 0 ${largeArc},${sweep} ${x2},${y2}`,
                    fill: 'none',
                    stroke,
                    'stroke-width': sw,
                    'stroke-dasharray': dash,
                    'stroke-linecap': 'round',
                    opacity: op,
                }, g);
                this._el('circle', { cx: x1, cy: y1, r: dotR, fill: dotColor }, g);
                this._el('circle', { cx: x2, cy: y2, r: dotR, fill: dotColor }, g);
            }
        }
```

- [ ] **Step 2: Call `_buildArcs` from `_rebuild`**

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildMandorla();
            this._buildArcs();
            this._buildRings();
            this._buildTextBands();
            this._buildFrame();
        }
```

(Arcs drawn before rings so the rings render on top — matches the reference layering.)

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- 4 pink dashed arcs (one per quadrant, just outside the outermost text ring)
- 4 cyan dashed arcs (slightly inside the pink ones), shorter span
- 16 total filled dots at the arc endpoints (8 pink + 8 cyan)
- Arcs and dots follow the circular geometry — symmetric

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build dashed accent arcs + node dots"
```

---

## Task 13: Build the radial star field

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add the `_buildStars` method**

Add after `_buildArcs`:

```javascript
        _buildStars() {
            const { cx, cy, R } = this._geom();
            const g = this._el('g', { id: 'icon-grp-stars' }, this.svg);
            if (!this.state.elements.stars) g.classList.add('icon-hidden');

            const density = STAR_DENSITY[this.state.starDensity] || STAR_DENSITY.med;
            const { radii, sizes } = density;

            let colorIdx = 0;
            let phaseIdx = 0;
            for (const angleDeg of STAR_ANGLES) {
                const a = angleDeg * Math.PI / 180;
                for (let i = 0; i < radii.length; i++) {
                    const dist = R * radii[i];
                    const size = sizes[i];
                    const x = cx + Math.cos(a) * dist;
                    const y = cy + Math.sin(a) * dist;
                    const color = STAR_COLORS[colorIdx++ % STAR_COLORS.length];

                    const wrap = this._el('g', { transform: `translate(${x},${y})` }, g);
                    const d = this._starPathD(size);
                    this._el('path', {
                        d,
                        fill: color,
                        class: `icon-star ph${phaseIdx % 10}`,
                    }, wrap);
                    phaseIdx++;
                }
            }
        }

        _starPathD(s) {
            // 4-point star centered at (0,0), outer radius = s, inner radius = s/4
            const o = s;
            const i = s / 4;
            return `M 0,${-o} L ${i},${-i} L ${o},0 L ${i},${i} L 0,${o} L ${-i},${i} L ${-o},0 L ${-i},${-i} Z`;
        }
```

- [ ] **Step 2: Call `_buildStars` from `_rebuild`**

```javascript
        _rebuild() {
            this._clear();
            const { W, H } = this._geom();
            this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            this.svg.setAttribute('preserveAspectRatio', 'none');

            this._buildMandorla();
            this._buildArcs();
            this._buildRings();
            this._buildTextBands();
            this._buildStars();
            this._buildFrame();
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- Roughly 66 four-point stars on 22 radial spokes (24 angles minus skipped 90° and 270°)
- Bigger stars near the character (~17px), smaller near the frame (~7px)
- Stars pulse in place (scale 0.35 → 1.0 → 0.35) with staggered timing
- **Critical:** stars pulse around their own centers — they do NOT fly out from the top-left. If they appear to fly toward/from a corner, the `transform-origin: 0 0` + `transform-box: view-box` CSS is being overridden somewhere; check the CSS file.

- [ ] **Step 4: Test star density switching**

In DevTools:
```js
components.iconography.state.starDensity = 'low';  components.iconography._rebuild();
components.iconography.state.starDensity = 'high'; components.iconography._rebuild();
components.iconography.state.starDensity = 'med';  components.iconography._rebuild();
```

Expected: star count visibly changes between roughly 24 / 66 / 110.

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): build radial star field with pulse animation"
```

---

## Task 14: Wire the resize call into setAspectRatio

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Add the iconography resize call**

Find the section in `setAspectRatio` around line 2558 where it updates flow particles:

```javascript
            // Update flow particles bounds
            if (components.flowParticles) {
                components.flowParticles.updateCharacterBounds();
            }
```

Add immediately after:

```javascript
            // Update iconography SVG composition (full rebuild at new dimensions)
            if (components.iconography) {
                components.iconography.resize(width, height);
            }
```

- [ ] **Step 2: Reload and verify**

Hard-reload. Switch to Iconography. Cycle through all 5 aspect ratios. Expected after each change:
- The entire icon composition rebuilds at the new canvas dimensions
- The mandorla, rings, text bands, arcs, and stars all scale based on `min(W,H)`
- The frame fills the canvas edge-to-edge
- Filigree corners scale down on smaller canvases (9:16 should have visibly smaller corners than 1:1)
- No elements clipped off-canvas
- No console errors

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): rebuild iconography SVG on aspect-ratio change"
```

---

## Task 15: Wire the per-element toggle checkboxes

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add `_wireToggles` and call it from `init`**

Inside the `IconographyMode` class, add this method (place it after `loadPhrases`):

```javascript
        _wireToggles() {
            if (!this.controls) return;

            const toggleMap = {
                'icon-toggle-frame':    { key: 'frame',    groupId: 'icon-grp-frame'    },
                'icon-toggle-mandorla': { key: 'mandorla', groupId: 'icon-grp-mandorla' },
                'icon-toggle-arcs':     { key: 'arcs',     groupId: 'icon-grp-arcs'     },
                'icon-toggle-rings':    { key: 'rings',    groupId: 'icon-grp-rings'    },
                'icon-toggle-text':     { key: 'text',     groupId: 'icon-grp-text'     },
                'icon-toggle-stars':    { key: 'stars',    groupId: 'icon-grp-stars'    },
            };

            for (const [id, { key, groupId }] of Object.entries(toggleMap)) {
                const cb = document.getElementById(id);
                if (!cb) continue;
                cb.checked = this.state.elements[key];
                cb.addEventListener('change', () => {
                    this.state.elements[key] = cb.checked;
                    const grp = this.svg.querySelector(`#${groupId}`);
                    if (grp) grp.classList.toggle('icon-hidden', !cb.checked);
                    if (typeof saveState === 'function') saveState();
                });
            }

            // Logo + title toggles control the existing overlays, not SVG groups
            const logoCb  = document.getElementById('icon-toggle-logo');
            const titleCb = document.getElementById('icon-toggle-title');
            const container = document.getElementById('thumbnail-container');
            if (logoCb) {
                logoCb.checked = this.state.elements.logo;
                logoCb.addEventListener('change', () => {
                    this.state.elements.logo = logoCb.checked;
                    container.classList.toggle('icon-show-logo', logoCb.checked);
                    if (typeof saveState === 'function') saveState();
                });
            }
            if (titleCb) {
                titleCb.checked = this.state.elements.title;
                titleCb.addEventListener('change', () => {
                    this.state.elements.title = titleCb.checked;
                    container.classList.toggle('icon-show-title', titleCb.checked);
                    if (typeof saveState === 'function') saveState();
                });
            }
        }
```

- [ ] **Step 2: Call `_wireToggles` from `init`**

Update `init`:

```javascript
        async init() {
            await this.loadPhrases();
            this._wireToggles();
            console.log('✅ IconographyMode initialized');
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. In the new control panel:
- Uncheck `Frame + filigree`. Expected: frame and corners hide; mandorla now visible all the way to the edge
- Re-check it. Expected: frame returns
- Uncheck `Rotating text bands`. Expected: all 3 text rings disappear
- Uncheck `Radial star field`. Expected: all stars disappear
- Check `Show logo overlay`. Expected: the existing logo overlay appears on top
- Check `Show title overlay`. Expected: the title/subtitle becomes visible (positioned per `.hero-mode` rules — bottom center)
- Each toggle should be instant (no rebuild)

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): wire per-element toggle checkboxes"
```

---

## Task 16: Wire phrase pickers + randomize buttons

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add `_wirePhrases` method**

Add after `_wireToggles`:

```javascript
        _wirePhrases() {
            if (!this.controls) return;

            const rings = ['outer', 'middle', 'inner'];
            for (const ring of rings) {
                const sel = document.getElementById(`icon-phrase-${ring}`);
                if (!sel) continue;
                sel.innerHTML = '';
                this.phrases[ring].forEach((phrase, i) => {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = phrase;
                    sel.appendChild(opt);
                });
                sel.value = String(this.state.phraseIdx[ring]);
                sel.addEventListener('change', () => {
                    this.state.phraseIdx[ring] = parseInt(sel.value, 10) || 0;
                    this._updateTextBand(ring);
                    if (typeof saveState === 'function') saveState();
                });
            }

            const randomize = (ring) => {
                const list = this.phrases[ring];
                if (!list || !list.length) return;
                const idx = Math.floor(Math.random() * list.length);
                this.state.phraseIdx[ring] = idx;
                const sel = document.getElementById(`icon-phrase-${ring}`);
                if (sel) sel.value = String(idx);
                this._updateTextBand(ring);
            };

            for (const ring of rings) {
                const btn = document.getElementById(`icon-rand-${ring}`);
                if (btn) btn.addEventListener('click', () => {
                    randomize(ring);
                    if (typeof saveState === 'function') saveState();
                });
            }

            const allBtn = document.getElementById('icon-rand-all');
            if (allBtn) allBtn.addEventListener('click', () => {
                rings.forEach(randomize);
                if (typeof saveState === 'function') saveState();
            });
        }

        _updateTextBand(ring) {
            // Find the existing <textPath> for this ring and update its content
            // without rebuilding the whole SVG (preserves rotation state).
            const tp = this.svg.querySelector(`#icon-tp-${ring}`);
            if (!tp) return;
            // The textPath is the child of the <text>, which is the child of the wrap <g>.
            // Find the textPath node by looking for its href.
            const all = this.svg.querySelectorAll('textPath');
            for (const node of all) {
                if (node.getAttribute('href') === `#icon-tp-${ring}`) {
                    const phrase = this._getPhrase(ring);
                    node.textContent = ` ${phrase} ${SEPARATORS[ring]} ${phrase} ${SEPARATORS[ring]} `;
                    break;
                }
            }
        }
```

- [ ] **Step 2: Call `_wirePhrases` from `init`**

Update `init`:

```javascript
        async init() {
            await this.loadPhrases();
            this._wireToggles();
            this._wirePhrases();
            console.log('✅ IconographyMode initialized');
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. Expected:
- Each of the 3 phrase dropdowns is populated with the phrases from `incantations.json`
- Selecting a different option for any ring updates that band's text immediately (rotation continues, no flicker/rebuild)
- 🎲 button on each ring rolls a random index
- 🎲🎲🎲 button rolls all 3 simultaneously

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): wire phrase pickers + randomize buttons"
```

---

## Task 17: Wire star density + mandorla shape + label inputs

**Files:**
- Modify: `tools/thumbnail-generator/js/iconography-mode.js`

- [ ] **Step 1: Add `_wireMiscControls` method**

Add after `_wirePhrases`:

```javascript
        _wireMiscControls() {
            if (!this.controls) return;

            const densitySel = document.getElementById('icon-star-density');
            if (densitySel) {
                densitySel.value = this.state.starDensity;
                densitySel.addEventListener('change', () => {
                    this.state.starDensity = densitySel.value;
                    this._rebuild();
                    if (typeof saveState === 'function') saveState();
                });
            }

            const shapeSel = document.getElementById('icon-mandorla-shape');
            if (shapeSel) {
                shapeSel.value = this.state.mandorlaShape;
                shapeSel.addEventListener('change', () => {
                    this.state.mandorlaShape = shapeSel.value;
                    this._rebuild();
                    if (typeof saveState === 'function') saveState();
                });
            }

            const topInput = document.getElementById('icon-label-top');
            if (topInput) {
                topInput.value = this.state.labelTop;
                topInput.addEventListener('input', () => {
                    this.state.labelTop = topInput.value;
                    this._updateLabels();
                    if (typeof saveState === 'function') saveState();
                });
            }

            const botInput = document.getElementById('icon-label-bottom');
            if (botInput) {
                botInput.value = this.state.labelBottom;
                botInput.addEventListener('input', () => {
                    this.state.labelBottom = botInput.value;
                    this._updateLabels();
                    if (typeof saveState === 'function') saveState();
                });
            }
        }

        _updateLabels() {
            // The frame group has the two label <text> nodes. Find them by position.
            const grp = this.svg.querySelector('#icon-grp-frame');
            if (!grp) return;
            const labels = grp.querySelectorAll('text');
            if (labels.length >= 2) {
                labels[0].textContent = this.state.labelTop;
                labels[1].textContent = this.state.labelBottom;
            }
        }
```

- [ ] **Step 2: Call `_wireMiscControls` from `init`**

```javascript
        async init() {
            await this.loadPhrases();
            this._wireToggles();
            this._wirePhrases();
            this._wireMiscControls();
            console.log('✅ IconographyMode initialized');
        }
```

- [ ] **Step 3: Reload and verify**

Hard-reload. Switch to Iconography. In the panel:
- Change Star density to "Low". Expected: SVG rebuilds, star count visibly drops
- Change to "High". Expected: SVG rebuilds, star count visibly rises
- Change Mandorla shape to "Circle". Expected: SVG rebuilds, aureole becomes a circle
- Edit Top label to a new value (e.g., `★ TEST ★`). Expected: top label updates as you type, no rebuild
- Edit Bottom label. Expected: bottom label updates as you type

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/js/iconography-mode.js
git commit -m "feat(iconography-mode): wire star density / mandorla shape / label inputs"
```

---

## Task 18: Extend state persistence (URL params + localStorage)

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

The iconography state lives on `components.iconography.state`. We need to serialize it into the URL/localStorage on save, and restore it on load.

- [ ] **Step 1: Extend `getCurrentState` to include iconography state**

Find `getCurrentState` (around line 3089). Inside the returned object literal, after the `aspectRatio` line (3150), add:

```javascript
                // Iconography state
                iconElements:      _iconographyStateField('elements'),
                iconPhrases:       _iconographyStateField('phraseIdx'),
                iconStarDensity:   _iconographyStateField('starDensity'),
                iconMandorlaShape: _iconographyStateField('mandorlaShape'),
                iconLabelTop:      _iconographyStateField('labelTop'),
                iconLabelBottom:   _iconographyStateField('labelBottom'),
```

Then add this helper function immediately above `getCurrentState`:

```javascript
        function _iconographyStateField(key) {
            const s = components.iconography && components.iconography.state;
            return s ? s[key] : undefined;
        }
```

- [ ] **Step 2: Extend `updateURL` to write iconography params**

Find `updateURL` (around line 3158). Inside, after the existing `aspectRatio` block (around line 3204), add:

```javascript
            // Iconography (skip defaults to keep URL clean)
            if (state.iconElements) {
                const enabled = Object.entries(state.iconElements)
                    .filter(([, v]) => v).map(([k]) => k).join(',');
                const ICON_ELEMENTS_DEFAULT = 'frame,mandorla,arcs,rings,text,stars';
                if (enabled !== ICON_ELEMENTS_DEFAULT) params.set('iconElements', enabled);
            }
            if (state.iconPhrases) {
                const idxs = `${state.iconPhrases.outer | 0},${state.iconPhrases.middle | 0},${state.iconPhrases.inner | 0}`;
                if (idxs !== '0,0,0') params.set('iconPhrases', idxs);
            }
            if (state.iconStarDensity && state.iconStarDensity !== 'med') {
                params.set('iconStarDensity', state.iconStarDensity);
            }
            if (state.iconMandorlaShape && state.iconMandorlaShape !== 'mandorla') {
                params.set('iconMandorlaShape', state.iconMandorlaShape);
            }
            if (state.iconLabelTop && state.iconLabelTop !== '⚠ CELESTE ⚠') {
                params.set('iconLabelTop', state.iconLabelTop);
            }
            if (state.iconLabelBottom && state.iconLabelBottom !== 'CORRUPTED.ARCHIVE') {
                params.set('iconLabelBottom', state.iconLabelBottom);
            }
```

- [ ] **Step 3: Extend the URL parser to read iconography params**

Find `parseURLParams` (the function returning `layoutMode` and `aspectRatio` around line 3015). Add these fields to the returned object (after the `aspectRatio` field):

```javascript
                // Iconography
                iconElements:      params.get('iconElements'),       // comma string or null
                iconPhrases:       params.get('iconPhrases'),        // "n,n,n" or null
                iconStarDensity:   params.get('iconStarDensity'),    // 'low'|'med'|'high' or null
                iconMandorlaShape: params.get('iconMandorlaShape'),  // 'mandorla'|'circle' or null
                iconLabelTop:      params.get('iconLabelTop'),       // string or null
                iconLabelBottom:   params.get('iconLabelBottom'),    // string or null
```

- [ ] **Step 4: Apply iconography state on load**

Find the state-restore block where `setLayoutMode(state.layoutMode)` is called (around line 3440). After the existing `setAspectRatio` call, add:

```javascript
                // Restore iconography state
                if (components.iconography) {
                    const ico = components.iconography;
                    if (state.iconElements) {
                        const enabled = new Set(state.iconElements.split(','));
                        const all = ['frame','mandorla','arcs','rings','text','stars'];
                        for (const k of all) ico.state.elements[k] = enabled.has(k);
                    }
                    if (state.iconPhrases) {
                        const [o, m, i] = state.iconPhrases.split(',').map(n => parseInt(n, 10) || 0);
                        const max = (arr, idx) => Math.min(Math.max(0, idx), (arr || []).length - 1);
                        ico.state.phraseIdx.outer  = max(ico.phrases.outer,  o);
                        ico.state.phraseIdx.middle = max(ico.phrases.middle, m);
                        ico.state.phraseIdx.inner  = max(ico.phrases.inner,  i);
                    }
                    if (state.iconStarDensity && STAR_DENSITY_KEYS.includes(state.iconStarDensity)) {
                        ico.state.starDensity = state.iconStarDensity;
                    }
                    if (state.iconMandorlaShape && ICON_MANDORLA_SHAPES.includes(state.iconMandorlaShape)) {
                        ico.state.mandorlaShape = state.iconMandorlaShape;
                    }
                    if (state.iconLabelTop)    ico.state.labelTop    = state.iconLabelTop;
                    if (state.iconLabelBottom) ico.state.labelBottom = state.iconLabelBottom;

                    // Sync UI controls to restored state
                    const setIfPresent = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
                    const checkIfPresent = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
                    checkIfPresent('icon-toggle-frame',    ico.state.elements.frame);
                    checkIfPresent('icon-toggle-mandorla', ico.state.elements.mandorla);
                    checkIfPresent('icon-toggle-arcs',     ico.state.elements.arcs);
                    checkIfPresent('icon-toggle-rings',    ico.state.elements.rings);
                    checkIfPresent('icon-toggle-text',     ico.state.elements.text);
                    checkIfPresent('icon-toggle-stars',    ico.state.elements.stars);
                    setIfPresent('icon-phrase-outer',     String(ico.state.phraseIdx.outer));
                    setIfPresent('icon-phrase-middle',    String(ico.state.phraseIdx.middle));
                    setIfPresent('icon-phrase-inner',     String(ico.state.phraseIdx.inner));
                    setIfPresent('icon-star-density',     ico.state.starDensity);
                    setIfPresent('icon-mandorla-shape',   ico.state.mandorlaShape);
                    setIfPresent('icon-label-top',        ico.state.labelTop);
                    setIfPresent('icon-label-bottom',     ico.state.labelBottom);

                    // Rebuild SVG to reflect restored state
                    ico._rebuild();
                }
```

Then add these two validation-set constants near the existing `LAYOUT_MODES`/`ASPECT_RATIOS` constants (line 2833 area):

```javascript
        const STAR_DENSITY_KEYS = ['low', 'med', 'high'];
        const ICON_MANDORLA_SHAPES = ['mandorla', 'circle'];
```

- [ ] **Step 5: Reload and verify URL round-trip**

Hard-reload. Switch to Iconography. Toggle off the frame, pick the second-outer phrase, change star density to High, change top label to "TEST". Expected:
- The URL bar updates with: `?layoutMode=iconography&iconElements=mandorla,arcs,rings,text,stars&iconPhrases=0,0,0&iconStarDensity=high&iconLabelTop=TEST` (with URL-encoded label)

Copy the URL to a new tab. Expected:
- Page loads in Iconography mode with: frame hidden, star density High, top label "TEST", and the matching phrases
- All checkboxes / dropdowns / inputs reflect the loaded state

- [ ] **Step 6: Verify localStorage fallback**

Clear URL params (back to base URL). Make some changes (e.g. toggle mandorla off). Hard-reload (without URL params). Expected: the changes persist via localStorage.

- [ ] **Step 7: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): persist iconography state in URL + localStorage"
```

---

## Task 19: Cross-aspect-ratio QA + export verification

**Files:** none (manual verification)

- [ ] **Step 1: Visual QA across all 5 aspect ratios**

For each of `16:9`, `2:1`, `1:1`, `4:5`, `9:16`:

1. Select the ratio from the Aspect Ratio dropdown
2. Confirm:
   - Frame fills the canvas edge-to-edge
   - All 4 filigree corners are visible and properly mirrored
   - Mandorla / rings / text bands all fit within the canvas (the outermost text ring touches the inner edge of the frame on 1:1 and 4:5; on 9:16 it's a tight fit; on 16:9 there's breathing room on the sides)
   - All 22 spokes of stars are visible (no stars clipped off-canvas on portrait ratios — if they are, R may need to be smaller; adjust `R = min(W,H) * 0.46` to `0.44` in `_geom`)
   - Rotation and pulse animations continue running
   - Top + bottom labels stay centered horizontally

- [ ] **Step 2: Test PNG export**

In Iconography mode at 16:9, click `📸 Export PNG`. Expected:
- Browser downloads a `.png` file
- Open the file and confirm: all iconography elements are present in the snapshot (frame, mandorla, rings, text bands, arcs, stars). The rotation/pulse animation is captured at whatever frame the click happened.
- Resolution matches the canvas (1920×1080).

Repeat at 9:16. Expected: PNG is 1080×1920.

- [ ] **Step 3: Test mode switching does not leak state**

1. Switch to Iconography. Confirm SVG visible.
2. Switch to Thumbnail. Confirm SVG hidden, title/subtitle/logo restored, character at thumbnail layout (anchored bottom).
3. Switch to Hero. Confirm SVG still hidden, character centered, title/logo at hero positions.
4. Switch back to Iconography. Confirm SVG re-appears unchanged.

- [ ] **Step 4: Console error sweep**

DevTools → Console. Filter for errors / warnings. Expected: no IconographyMode-related errors or warnings on any reload, mode-switch, aspect-switch, or control interaction.

- [ ] **Step 5: Commit (no-op, but tag the milestone)**

If any issues were found and fixed in steps 1–4, commit those fixes individually. Otherwise:

```bash
git log --oneline -10
```

Verify the last 18 commits tell a clean story of the iconography feature being built up.

---

## Task 20: Update CLAUDE.md project-specific section (optional but recommended)

**Files:**
- Modify: `CLAUDE.md`

Per `CLAUDE.md` §9.1 (Enterprise Benchmark, "developer experience polish"): document the new mode briefly so future contributors know it exists.

- [ ] **Step 1: Add a brief note in section 13 "Project-Specific: whykusanagi Portfolio Site"**

Find the "File Organization" subsection of §13. After the existing bullets, add:

```markdown
- **Iconography mode**: third layout option in the thumbnail generator (`tools/thumbnail-generator/`). Renders a religious-icon SVG composition (filigree frame, mandorla, rotating text bands, radial stars). Phrases live in `tools/thumbnail-generator/data/incantations.json` — edit the file to add or remove incantations; page refresh picks them up. Component class: `IconographyMode` in `js/iconography-mode.js`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note iconography mode in CLAUDE.md project-specific section"
```

---

## Plan Self-Review

**Spec coverage check** — every section of the spec maps to a task:

| Spec section | Implementing task(s) |
|--------------|---------------------|
| 1. File layout | All tasks (each touches one of the 4 files) |
| 2. Composition (frame / mandorla / arcs / rings / text / stars) | Tasks 8, 9, 10, 11, 12, 13 |
| 3. Phrase data + UI | Tasks 1, 16 |
| 4. Per-element toggles | Tasks 5, 15 |
| 5. Aspect-ratio scaling | Tasks 8–14 (geometry derives from `_geom()` in every builder) |
| 6. Animation + export | Tasks 2 (keyframes), 19 (export verification) |
| 7. State persistence | Task 18 |
| 8. Mode transition behavior | Task 6 |
| 9. Files modified summary | All tasks |
| 10. Out of scope | Honored — no off-center layout, no custom filigree, no MP4 export |

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N", no missing code blocks. Each task shows the exact code to write.

**Type consistency:**
- `components.iconography` used consistently in index.html
- `IconographyMode` class name consistent across JS and HTML wiring
- All SVG group IDs (`icon-grp-frame`, `-mandorla`, `-arcs`, `-rings`, `-text`, `-stars`) introduced in build tasks 8–13 and referenced in toggle wiring (Task 15)
- Phrase ring keys (`outer`, `middle`, `inner`) consistent across JSON file, class state, control IDs, separators map
- Star density keys (`low`, `med`, `high`) consistent across `STAR_DENSITY` constant, `STAR_DENSITY_KEYS` validation array, dropdown options, state field
- `_rebuild` call order honored: mandorla → arcs → rings → text → stars → frame (Task 13's final `_rebuild` is the canonical order)

**Scope check:** Single feature, single mode, single output (PNG via existing export). No decomposition needed.
