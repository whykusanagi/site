# Thumbnail Nikke City Backgrounds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 themed Nikke "city" backgrounds (one per stage theme) to the YouTube thumbnail generator, sourced by pre-rendering the procedural canvas scene from `~/Development/nikke_game`.

**Architecture:** Build a one-shot export harness inside `nikke_game` that drives the existing `background-renderer.js` once per theme and saves PNGs. Upload the 7 PNGs to R2 alongside the existing seamless tile. In the thumbnail generator, add a Background `<select>`, a small URL map, a `setBackgroundTheme()` runtime swap, CSS overrides for "themed" mode, and refactor the html2canvas seamless-fetch block to honor the active theme.

**Tech Stack:** Vanilla JS ES modules (no build step in either repo); HTML5 Canvas for the renderer; html2canvas for export; Cloudflare R2 + s3cmd for hosting; manual browser validation (no test framework — CLAUDE.md §8).

**Spec deviation (planning-time):** The spec said "render directly at 1920×1080". On reading `nikke_game/index.html` and `main.js`, the game canvas is **1280×720** and `STAGE_VIEW` + `FLOOR_Y` are pixel-tied to that size. Reprojecting all internal pixel constants is a sizable side-quest with no quality payoff. Plan instead: render the harness at native **1280×720**, ship 1280×720 PNGs, and let the thumbnail generator's CSS `background-size: cover` scale them to 1920×1080 in the browser. Browser bilinear upscale on a same-aspect 16:9 source is visually fine for stylized art with glow effects.

**Repo layout note:** This plan touches two repos. All `nikke_game/...` paths are inside `~/Development/nikke_game` (separate git repo). All `tools/thumbnail-generator/...` paths are inside the current repo (`~/Development/site`). Each repo gets its own `feature/thumbnail-bg-nikke-themes` branch.

---

## Phase 1 — Asset pipeline in `nikke_game`

### Task 1: Set up feature branch + harness scaffold

**Files:**
- Create: `~/Development/nikke_game/tools/thumbnail-bg-export.html`
- Modify: `~/Development/nikke_game/.gitignore`

- [ ] **Step 1: Create the feature branch in `nikke_game`**

```bash
cd ~/Development/nikke_game
git checkout -b feature/thumbnail-bg-nikke-themes
```

- [ ] **Step 2: Add the output dir to `.gitignore`**

Append this line at the end of `~/Development/nikke_game/.gitignore`:

```
# Thumbnail-generator export artifacts (uploaded to R2, not tracked)
output/thumbnail-backgrounds/
```

- [ ] **Step 3: Create the harness HTML scaffold**

Write `~/Development/nikke_game/tools/thumbnail-bg-export.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Nikke BG Export — thumbnail-generator</title>
<style>
  body { background: #0a0613; color: #f7d6ff; font-family: monospace; padding: 20px; }
  canvas { border: 1px solid rgba(255,255,255,0.2); display: block; margin: 12px 0; }
  button { font-family: monospace; background: #2a1340; color: #f7d6ff; border: 1px solid #ff82d9; padding: 8px 14px; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
  button:hover { background: #4a2360; }
  #log { white-space: pre-wrap; background: #15091e; padding: 10px; border: 1px solid #3a1a4a; max-height: 240px; overflow-y: auto; }
  .row { margin: 8px 0; }
</style>
</head>
<body>
  <h1>Nikke BG Export</h1>
  <p>Renders the game's procedural city background at native 1280×720 once per theme. Outputs are 1280×720 PNGs the thumbnail generator scales via CSS.</p>

  <div class="row">
    <button id="render-all">Render all 7 themes</button>
    <button id="render-default">default-corruption</button>
    <button id="render-dragon">dragon-cinder</button>
    <button id="render-leviathan">leviathan-abyss</button>
    <button id="render-colossus">colossus-gold</button>
    <button id="render-tyrant">tyrant-crimson</button>
    <button id="render-behemoth">behemoth-void</button>
    <button id="render-serpent">serpent-emerald</button>
  </div>

  <canvas id="harness-canvas" width="1280" height="720"></canvas>

  <div id="log"></div>

  <script type="module" src="./thumbnail-bg-export.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify the page loads (no JS yet — expected to render an empty canvas)**

Serve the directory and open the page:

```bash
cd ~/Development/nikke_game
python3 -m http.server 8765
```

Open `http://localhost:8765/tools/thumbnail-bg-export.html` in a browser.

Expected: page renders, canvas is visible (empty/black), 8 buttons visible, browser console shows a 404 for `thumbnail-bg-export.js` (we haven't created it yet — fine).

- [ ] **Step 5: Commit the scaffold**

```bash
cd ~/Development/nikke_game
git add tools/thumbnail-bg-export.html .gitignore
git commit -m "feat(thumbnail-bg-export): add harness HTML scaffold + .gitignore entry"
```

---

### Task 2: Build the export driver

**Files:**
- Create: `~/Development/nikke_game/tools/thumbnail-bg-export.js`

- [ ] **Step 1: Write the export driver**

Write `~/Development/nikke_game/tools/thumbnail-bg-export.js` with this exact content:

```js
// Standalone harness that drives the game's background renderer once per theme
// and downloads each result as a PNG. Dev-only — not loaded by the game itself.
//
// Reads:
//   ../background-renderer.js — createBackgroundRenderer factory
//   ../stage-themes.js        — getStageTheme(stage)
//
// Strategy:
//   The renderer is pixel-calibrated to the game's 1280×720 canvas via STAGE_VIEW
//   and FLOOR_Y. We replicate those constants verbatim here (do NOT modify them)
//   and render at native size. The thumbnail generator scales the resulting PNG
//   via CSS background-size: cover.

import { createBackgroundRenderer } from "../background-renderer.js";
import { getStageTheme } from "../stage-themes.js";

// --- Constants copied verbatim from main.js (do not edit independently) -------

const WIDTH = 1280;
const HEIGHT = 720;
const FLOOR_Y = 620;
const WORLD_NEAR_Z = 24;
const WORLD_FAR_Z = 98;
const STAGE_VIEW = {
  horizonY: 226,
  planeTopY: 248,
  planeBottomY: FLOOR_Y - 92,
  planeTopLeft: 28,
  planeTopRight: WIDTH - 28,
  planeBottomLeft: -26,
  planeBottomRight: WIDTH + 26,
  vanishingX: WIDTH * 0.56,
  nearScale: 1,
  farScale: 0.38,
};

// --- Minimal stubs for renderer dependencies ----------------------------------

const QUALITY_TIER_HIGH = {
  backgroundDynamicInterval: 1 / 12,
  billboardFps: 12,
  billboardShadowBlur: 16,
  billboardFilter: true,
  signShadowBlur: 8,
  signTicker: true,
  signSweep: true,
  silhouetteFilter: true,
  silhouetteDash: true,
  auraGlyphColumns: 6,
  fullBurstStripes: true,
  fullBurstScreenBlend: true,
  maxEffects: 72,
  maxPopups: 18,
  maxTracers: 24,
};

function getQualityTierConfig() {
  return QUALITY_TIER_HIGH;
}

function createRenderLayer() {
  const layer = document.createElement("canvas");
  layer.width = WIDTH;
  layer.height = HEIGHT;
  return layer;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getDepthRatio(z) {
  return clamp((z - WORLD_NEAR_Z) / (WORLD_FAR_Z - WORLD_NEAR_Z), 0, 1);
}

// projectWorldPoint — copied verbatim from main.js (lines 1635+).
function projectWorldPoint(worldX, worldZ) {
  const depth = getDepthRatio(worldZ);
  const eased = Math.pow(depth, 0.88);
  const leftEdge = lerp(STAGE_VIEW.planeBottomLeft, STAGE_VIEW.planeTopLeft, eased);
  const rightEdge = lerp(STAGE_VIEW.planeBottomRight, STAGE_VIEW.planeTopRight, eased);
  const horizonPull = eased * 0.22;
  const left = lerp(leftEdge, STAGE_VIEW.vanishingX - 170, horizonPull);
  const right = lerp(rightEdge, STAGE_VIEW.vanishingX + 170, horizonPull);
  const groundY = lerp(STAGE_VIEW.planeBottomY, STAGE_VIEW.planeTopY, eased);
  const scale = lerp(STAGE_VIEW.nearScale, STAGE_VIEW.farScale, eased);
  const normalizedX = clamp((worldX + 1) * 0.5, 0, 1);
  const centered = normalizedX * 2 - 1;
  const perspectiveBend = Math.sign(centered) * Math.pow(Math.abs(centered), lerp(1, 1.22, eased));
  const x = lerp(left, right, clamp((perspectiveBend + 1) * 0.5, 0, 1));
  return { x, groundY, scale, depth };
}

// --- Theme list (filename key -> renderer bossId) -----------------------------
// stage-themes.js keys off bossId. The default theme has no bossId.

const THEMES = [
  { key: "default-corruption", bossId: null },
  { key: "dragon-cinder",      bossId: "dragon" },
  { key: "leviathan-abyss",    bossId: "leviathan" },
  { key: "colossus-gold",      bossId: "colossus" },
  { key: "tyrant-crimson",     bossId: "tyrant" },
  { key: "behemoth-void",      bossId: "behemoth" },
  { key: "serpent-emerald",    bossId: "serpent" },
];

// --- Harness wiring -----------------------------------------------------------

const canvas = document.getElementById("harness-canvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

function log(msg) {
  console.log(msg);
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

let currentBossId = null;

function buildState() {
  return {
    billboardClock: 0,
    assets: {},
    perfBudgetState: { activeQualityTier: "high" },
  };
}

function getDisplayStage() {
  return { bossId: currentBossId };
}

function renderTheme(theme) {
  currentBossId = theme.bossId;

  // Clear canvas + reset any cached layers by rebuilding the renderer per theme.
  // Simpler than calling invalidate hooks — we render once per theme anyway.
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const state = buildState();
  const renderer = createBackgroundRenderer({
    ctx,
    state,
    WIDTH,
    HEIGHT,
    FLOOR_Y,
    STAGE_VIEW,
    WORLD_NEAR_Z,
    WORLD_FAR_Z,
    getQualityTierConfig,
    createRenderLayer,
    getStageTheme,
    getDisplayStage,
    projectWorldPoint,
  });

  renderer.drawBackground();
  log(`✅ Rendered ${theme.key}`);
}

function downloadCanvasAs(filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

async function renderAndDownload(theme) {
  renderTheme(theme);
  await downloadCanvasAs(`nikke-bg-${theme.key}.png`);
  log(`💾 Downloaded nikke-bg-${theme.key}.png`);
}

async function renderAll() {
  for (const theme of THEMES) {
    await renderAndDownload(theme);
    // Small delay so the browser doesn't merge downloads.
    await new Promise((r) => setTimeout(r, 250));
  }
  log("🎉 All 7 themes exported.");
}

// --- Wire buttons -------------------------------------------------------------

document.getElementById("render-all").addEventListener("click", renderAll);
for (const theme of THEMES) {
  const btn = document.getElementById(`render-${theme.key.split("-")[0]}`);
  if (btn) {
    btn.addEventListener("click", () => renderAndDownload(theme));
  }
}

log("Harness ready. Click 'Render all 7 themes' or any individual button.");
```

- [ ] **Step 2: Verify the harness loads without errors**

Refresh `http://localhost:8765/tools/thumbnail-bg-export.html`.

Expected: page loads, log box says "Harness ready.", browser DevTools console shows zero errors.

If console errors appear, common causes:
- Wrong relative import path → check `../background-renderer.js` resolves from `tools/`
- `document.getElementById("harness-canvas")` returns null → ID mismatch with HTML

- [ ] **Step 3: Render one theme as a smoke test**

Click the **dragon-cinder** button (visually most distinct from default).

Expected:
- Canvas shows an orange/red-tinted city scene (sky + aurora + skyline + floor + barrier).
- Log appends `✅ Rendered dragon-cinder` and `💾 Downloaded nikke-bg-dragon-cinder.png`.
- Browser downloads `nikke-bg-dragon-cinder.png` to your default downloads folder.

Open the downloaded PNG. Expected: 1280×720, full themed scene visible, no transparency in the sky, no obvious clipping or black gaps (besides the small black bar below `FLOOR_Y` which is intentional in the source renderer).

- [ ] **Step 4: Commit the harness driver**

```bash
cd ~/Development/nikke_game
git add tools/thumbnail-bg-export.js
git commit -m "feat(thumbnail-bg-export): add export driver for 7 stage themes"
```

---

### Task 3: Render and stage all 7 PNGs

**Files:**
- Create (locally, not git-tracked): `~/Development/nikke_game/output/thumbnail-backgrounds/nikke-bg-*.png`

- [ ] **Step 1: Make the output directory**

```bash
mkdir -p ~/Development/nikke_game/output/thumbnail-backgrounds
```

- [ ] **Step 2: Render all 7 themes via the harness**

In the browser at `http://localhost:8765/tools/thumbnail-bg-export.html`, click **Render all 7 themes**.

Expected: log shows 7 `Rendered` + 7 `Downloaded` lines plus `🎉 All 7 themes exported.` Browser downloads 7 PNGs in sequence.

- [ ] **Step 3: Move the downloaded PNGs into the output directory**

```bash
mv ~/Downloads/nikke-bg-default-corruption.png \
   ~/Downloads/nikke-bg-dragon-cinder.png \
   ~/Downloads/nikke-bg-leviathan-abyss.png \
   ~/Downloads/nikke-bg-colossus-gold.png \
   ~/Downloads/nikke-bg-tyrant-crimson.png \
   ~/Downloads/nikke-bg-behemoth-void.png \
   ~/Downloads/nikke-bg-serpent-emerald.png \
   ~/Development/nikke_game/output/thumbnail-backgrounds/
```

(Adjust the source path if the user's browser uses a different downloads dir.)

- [ ] **Step 4: Visually verify each PNG**

Open each of the 7 PNGs (Preview / Finder Quick Look). Confirm for each:
- Resolution is 1280×720.
- Sky gradient + aurora glow visible at top.
- Rear skyline towers visible behind the foreground skyline.
- Foreground skyline structures with window grids + occasional billboards/signs visible mid-frame.
- Diamond floor grid visible in lower-mid area.
- Foreground barrier (glowing rail) visible at the bottom.
- Color palette matches the theme (e.g., `dragon-cinder` is orange/red; `leviathan-abyss` is cyan; `serpent-emerald` is green; `default-corruption` is pink/violet).

If any PNG looks wrong (black, missing layers, wrong color), re-render that theme individually via its button and re-export.

- [ ] **Step 5: Confirm file sizes are reasonable**

```bash
ls -lh ~/Development/nikke_game/output/thumbnail-backgrounds/
```

Expected: each file is roughly 200 KB to 1.5 MB. Anything under 50 KB suggests an empty/transparent canvas; anything over 3 MB suggests something unexpected like an alpha channel issue.

No commit at this step — the PNGs are gitignored artifacts.

---

## Phase 2 — R2 asset upload

### Task 4: Upload PNGs to R2

**Files:** none (R2 only)

- [ ] **Step 1: Verify s3cmd config exists**

```bash
ls -la ~/.s3r2
```

Expected: file exists. If it doesn't, stop and ask the user — this plan assumes an existing R2 config per CLAUDE.md §6.

- [ ] **Step 2: Upload all 7 PNGs**

```bash
cd ~/Development/nikke_game/output/thumbnail-backgrounds
for f in nikke-bg-*.png; do
  s3cmd -c ~/.s3r2 put "$f" "s3://whykusanagi/tools/thumbnail-generator/assets/backgrounds/$f"
done
```

Expected: 7 successful upload lines, no errors.

- [ ] **Step 3: Confirm R2 listing**

```bash
s3cmd -c ~/.s3r2 ls s3://whykusanagi/tools/thumbnail-generator/assets/backgrounds/
```

Expected: listing includes the existing `whykusanagi_rendered_SEAMLESS.png` plus all 7 new `nikke-bg-*.png` files.

---

### Task 5: Verify HTTP accessibility (mandatory before generator wiring)

**Files:** none (verification only)

- [ ] **Step 1: HEAD-check each public URL**

```bash
for key in default-corruption dragon-cinder leviathan-abyss colossus-gold tyrant-crimson behemoth-void serpent-emerald; do
  echo "=== $key ==="
  curl -I -s "https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/nikke-bg-$key.png" | head -5
done
```

Expected for each: `HTTP/2 200`, `content-type: image/png`, plausible `content-length` matching the local file size.

- [ ] **Step 2: If any URL returns 404, re-check the upload path**

If a 404 surfaces:
- Re-run `s3cmd ls` to confirm the file landed at the exact path.
- Wait 30–60 seconds for Cloudflare cache propagation, then retry.
- Do NOT proceed to Phase 3 until all 7 return 200.

---

## Phase 3 — Thumbnail generator UI + runtime

All Phase 3 + 4 work happens in `~/Development/site` (current repo).

### Task 6: Set up feature branch in the site repo + add Background dropdown

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (around line 432, just before the "Layout & Aspect Ratio Section")

- [ ] **Step 1: Create the feature branch**

```bash
cd ~/Development/site
git checkout -b feature/thumbnail-bg-nikke-themes
```

- [ ] **Step 2: Add the Background section to the control panel**

In `tools/thumbnail-generator/index.html`, find the line:

```html
                <!-- Layout & Aspect Ratio Section -->
                <div class="layout-controls-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0, 255, 255, 0.3);">
```

Insert the following block **immediately before** that comment (so the Background section sits between the Text controls and the Layout section):

```html
                <!-- Background Section -->
                <div class="background-controls-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0, 255, 255, 0.3);">
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
                </div>

```

- [ ] **Step 3: Smoke test — verify the dropdown renders**

```bash
cd ~/Development/site
python3 -m http.server 8000
```

Open `http://localhost:8000/tools/thumbnail-generator/` in a browser.

Expected: the control panel now shows a "Background" select with 8 options. Selecting any of them does nothing yet (the JS handler doesn't exist). Browser console shows: `Uncaught ReferenceError: setBackgroundTheme is not defined` on change — that's expected at this step.

- [ ] **Step 4: Commit the UI scaffold**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): add Background select to control panel"
```

---

### Task 7: Add `BG_URLS` map + `setBackgroundTheme` runtime

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (inside the inline `<script>` block)

- [ ] **Step 1: Locate a good insertion point in the script**

In `tools/thumbnail-generator/index.html`, search for the existing function `setLayoutMode`. The new helpers go in the same area (top of the inline script's function definitions). If `setLayoutMode` isn't easy to find, insert immediately before the line `// Update animated component layers` (around line 1791) — that's inside a setter function that runs after module init, so anything above that runs early enough.

A safer anchor: search for the very first `function ` declaration in the inline `<script>` and insert directly above it.

- [ ] **Step 2: Add the URL map, the active-theme variable, and the setter**

Insert this block at the chosen anchor:

```html
            // ---- Background theme system ------------------------------------
            const SEAMLESS_BG_URL =
                'https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/whykusanagi_rendered_SEAMLESS.png';
            const NIKKE_BG_BASE =
                'https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/';

            const BG_URLS = {
                seamless:               SEAMLESS_BG_URL,
                'default-corruption':   NIKKE_BG_BASE + 'nikke-bg-default-corruption.png',
                'dragon-cinder':        NIKKE_BG_BASE + 'nikke-bg-dragon-cinder.png',
                'leviathan-abyss':      NIKKE_BG_BASE + 'nikke-bg-leviathan-abyss.png',
                'colossus-gold':        NIKKE_BG_BASE + 'nikke-bg-colossus-gold.png',
                'tyrant-crimson':       NIKKE_BG_BASE + 'nikke-bg-tyrant-crimson.png',
                'behemoth-void':        NIKKE_BG_BASE + 'nikke-bg-behemoth-void.png',
                'serpent-emerald':      NIKKE_BG_BASE + 'nikke-bg-serpent-emerald.png',
            };

            let currentBackgroundTheme = 'seamless';

            function setBackgroundTheme(value) {
                if (!BG_URLS[value]) {
                    console.warn('Unknown background theme:', value, '— ignoring');
                    return;
                }
                currentBackgroundTheme = value;
                const url = BG_URLS[value];
                const isSeamless = (value === 'seamless');

                document.querySelectorAll('.seamless-background').forEach((el) => {
                    el.style.backgroundImage = `url('${url}')`;
                    el.style.backgroundRepeat = isSeamless ? 'repeat' : 'no-repeat';
                    el.style.backgroundSize  = isSeamless ? '512px 512px' : 'cover';
                    el.style.backgroundPosition = isSeamless ? '' : 'center center';
                });

                document.body.classList.toggle('bg-themed', !isSeamless);
                console.log(`🎨 Background theme → ${value}`);
            }

            // Expose for the inline onchange handler.
            window.setBackgroundTheme = setBackgroundTheme;
            // ----------------------------------------------------------------
```

- [ ] **Step 3: Reload and switch through the dropdown**

Refresh `http://localhost:8000/tools/thumbnail-generator/` and select each of the 8 options.

Expected:
- `Seamless Pattern (default)` → tile pattern (current behaviour, animated scroll, purple tint visible).
- Any nikke option → full-bleed city scene fills the canvas; animation still scrolls (CSS rule for that comes in the next task) and purple tint still visible (also next task).
- Browser console logs `🎨 Background theme → <key>` on every change. Zero errors.

If a nikke option shows a broken image (alt text, broken-image icon), re-check the URL in `BG_URLS` against the actual R2 path from Phase 2.

- [ ] **Step 4: Commit the runtime**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): wire setBackgroundTheme + BG_URLS map"
```

---

### Task 8: Append CSS rules for `body.bg-themed`

**Files:**
- Modify: `tools/thumbnail-generator/css/seamless-background.css` (append at end)

- [ ] **Step 1: Append the override rules**

Append the following at the end of `tools/thumbnail-generator/css/seamless-background.css`:

```css

/* ===== NIKKE THEMED BACKGROUND OVERRIDES ===== */
/* Applied when body.bg-themed is set by setBackgroundTheme().  */
/* The themed PNG is a full scene — scrolling looks wrong, and  */
/* the global purple tint muddies non-pink themes.              */

body.bg-themed .seamless-background {
    animation: none !important;
}

body.bg-themed .seamless-tint-purple {
    display: none;
}
```

- [ ] **Step 2: Reload and verify the overrides apply**

Refresh the thumbnail generator and switch to `dragon-cinder`.

Expected:
- The orange/red city scene fills the canvas, **static** (no scroll animation).
- The purple-pink diagonal tint is gone.
- The radial vignette (subtle darken at corners) is still present.

Switch back to `Seamless Pattern (default)`.

Expected:
- The seamless tile pattern returns, animation resumes, purple tint returns.

Switch through `leviathan-abyss`, `colossus-gold`, `tyrant-crimson`, `behemoth-void`, `serpent-emerald`, `default-corruption`. Each should look correctly themed and static.

- [ ] **Step 3: Commit the CSS**

```bash
git add tools/thumbnail-generator/css/seamless-background.css
git commit -m "feat(thumbnail-generator): hide purple tint + freeze scroll for themed backgrounds"
```

---

## Phase 4 — Export refactor

### Task 9: Refactor `exportThumbnail` to honor the active theme

**Files:**
- Modify: `tools/thumbnail-generator/index.html`, two regions inside the inline `<script>`:
  - The pre-fetch block (currently lines ~892–905, hardcoded to the seamless URL).
  - The `onclone` callback's seamless-rewrite block (currently lines ~1072–1088).

- [ ] **Step 1: Replace the seamless pre-fetch block**

Find the existing block in `tools/thumbnail-generator/index.html`:

```javascript
                // Preload seamless background via fetch+FileReader (same CORS workaround as womb tattoo)
                const seamlessDataUrl = await fetch(
                    'https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/backgrounds/whykusanagi_rendered_SEAMLESS.png',
                    { mode: 'cors', cache: 'no-cache' }
                )
                .then(r => r.blob())
                .then(blob => new Promise((resolve) => {
                    const fr = new FileReader();
                    fr.onloadend = () => resolve(fr.result);
                    fr.onerror  = () => resolve(null);
                    fr.readAsDataURL(blob);
                }))
                .catch(() => null);
                console.log(seamlessDataUrl ? '✅ Seamless background fetched via FileReader' : '⚠️ Seamless background fetch failed');
```

Replace it with:

```javascript
                // Preload the active background via fetch+FileReader (CORS workaround for html2canvas).
                // currentBackgroundTheme + BG_URLS are defined in the background-theme system above.
                const activeBgUrl = BG_URLS[currentBackgroundTheme] ?? BG_URLS.seamless;
                const activeBgIsSeamless = (currentBackgroundTheme === 'seamless');
                const bgDataUrl = await fetch(activeBgUrl, { mode: 'cors', cache: 'no-cache' })
                    .then(r => r.blob())
                    .then(blob => new Promise((resolve) => {
                        const fr = new FileReader();
                        fr.onloadend = () => resolve(fr.result);
                        fr.onerror  = () => resolve(null);
                        fr.readAsDataURL(blob);
                    }))
                    .catch(() => null);
                console.log(bgDataUrl
                    ? `✅ Background fetched (${currentBackgroundTheme})`
                    : `⚠️ Background fetch failed (${currentBackgroundTheme})`);
```

- [ ] **Step 2: Replace the `onclone` seamless-rewrite block**

Find the existing block (around line 1072+):

```javascript
                        // Convert seamless background images to inline styles with data URL
                        const seamlessElements = clonedDoc.querySelectorAll('.seamless-background');
                        seamlessElements.forEach(el => {
                            if (seamlessDataUrl) {
                                el.style.backgroundImage = `url('${seamlessDataUrl}')`;
                                el.style.backgroundRepeat = 'repeat';
                                el.style.backgroundSize = '512px 512px';
                                el.style.width = `${canvasWidth}px`;
                                el.style.height = `${canvasHeight}px`;
                                el.style.position = 'absolute';
                                el.style.top = '0';
                                el.style.left = '0';
                                el.style.display = 'block';
                                el.style.opacity = '1';
                                console.log('✅ Applied seamless background data URL');
                            }
                        });
```

Replace it with:

```javascript
                        // Apply the active background as an inline data URL on .seamless-background clones.
                        // Mode-correct repeat / size: seamless tiles, nikke themes cover-fill.
                        const seamlessElements = clonedDoc.querySelectorAll('.seamless-background');
                        seamlessElements.forEach(el => {
                            if (bgDataUrl) {
                                el.style.backgroundImage = `url('${bgDataUrl}')`;
                                el.style.backgroundRepeat = activeBgIsSeamless ? 'repeat' : 'no-repeat';
                                el.style.backgroundSize  = activeBgIsSeamless ? '512px 512px' : 'cover';
                                el.style.backgroundPosition = activeBgIsSeamless ? '' : 'center center';
                                el.style.width = `${canvasWidth}px`;
                                el.style.height = `${canvasHeight}px`;
                                el.style.position = 'absolute';
                                el.style.top = '0';
                                el.style.left = '0';
                                el.style.display = 'block';
                                el.style.opacity = '1';
                                if (!activeBgIsSeamless) {
                                    el.style.animation = 'none';
                                }
                                console.log(`✅ Applied background data URL (${currentBackgroundTheme})`);
                            }
                        });

                        // For themed mode, also hide the purple tint clone (the live-DOM
                        // CSS rule does this via body.bg-themed, but we set it again on the
                        // clone for resilience against html2canvas state restoration).
                        if (!activeBgIsSeamless) {
                            const tintEls = clonedDoc.querySelectorAll('.seamless-tint-purple');
                            tintEls.forEach((el) => { el.style.display = 'none'; });
                        }
```

- [ ] **Step 3: Verify export — Nikke path**

Refresh the generator, select **dragon-cinder**, click **📸 Export PNG**.

Expected:
- Browser console logs `✅ Background fetched (dragon-cinder)` and `✅ Applied background data URL (dragon-cinder)`.
- Browser downloads a 1920×1080 PNG.
- Open the PNG. The background is the orange/red city scene scaled to fill 1920×1080. Vignette is present (subtle corner darken). Purple tint is **absent**. Character image, title, subtitle, and any animated overlays sit correctly on top.

- [ ] **Step 4: Verify export — seamless regression**

Switch back to **Seamless Pattern (default)**, click **📸 Export PNG**.

Expected:
- Console logs `✅ Background fetched (seamless)`.
- Exported PNG: identical to the pre-change behavior — tiled seamless pattern, animated overlays, vignette, purple tint all present.

If the seamless export looks different from before this branch (e.g., tile size wrong, position wrong, tint missing), re-check that the only changes inside the seamless branch of the conditional are the renamed variables (`bgDataUrl`, `activeBgIsSeamless`) — the *behavior* for `seamless` should be identical to the pre-change code.

- [ ] **Step 5: Commit the export refactor**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): export honors active background theme"
```

---

## Phase 5 — Final validation + integration

### Task 10: Cross-theme export smoke test

**Files:** none (validation only)

- [ ] **Step 1: Export each of the 7 themes**

For each theme (`default-corruption`, `dragon-cinder`, `leviathan-abyss`, `colossus-gold`, `tyrant-crimson`, `behemoth-void`, `serpent-emerald`):

1. Select it in the Background dropdown.
2. Click **📸 Export PNG**.
3. Inspect the resulting file: 1920×1080, theme-correct color palette, vignette present, purple tint absent, character/title overlays composited on top.

- [ ] **Step 2: Cross-aspect-ratio sanity check**

With `dragon-cinder` selected, change the Aspect Ratio to **9:16 (1080x1920)**, export PNG.

Expected: the city scene crops to portrait via `background-size: cover` + `center center` — no stretching or letterboxing. Title, character, vignette adapt as they already do for portrait.

Switch back to 16:9 before continuing.

- [ ] **Step 3: Browser cross-check**

Repeat one nikke export (any theme) in **Firefox** and **Safari** (per CLAUDE.md §13 — Chrome, Firefox, Safari, Edge are the supported set; Edge optional if not on Windows).

Expected: identical visual output (or close enough — html2canvas has minor cross-browser differences in font rasterization that are pre-existing and out of scope).

---

### Task 11: Push branches and open PRs

**Files:** none

- [ ] **Step 1: Push the `nikke_game` branch**

```bash
cd ~/Development/nikke_game
git push -u origin feature/thumbnail-bg-nikke-themes
```

(Only push if the user confirms — the push is an externally-visible action. If user has not pre-authorized pushing, stop here and surface the branches for review instead.)

- [ ] **Step 2: Push the `site` branch**

```bash
cd ~/Development/site
git push -u origin feature/thumbnail-bg-nikke-themes
```

(Same authorization caveat as Step 1.)

- [ ] **Step 3: Open PRs (optional, only if user requests)**

Both repos use `main` as the base. If the user asks for PRs, follow the standard `gh pr create` flow with a body that links the spec at `docs/superpowers/specs/2026-05-01-thumbnail-nikke-city-backgrounds-design.md`.

---

## Out of scope (do not implement)

- Per-element layer toggles (billboards / signs / barrier on/off) — explicitly dropped during brainstorming.
- Live canvas rendering inside the generator.
- Animated / parallax versions of the themed scenes.
- Preview thumbnails inside the dropdown.
- Re-tuning the renderer's internal STAGE_VIEW constants for 1920×1080 — the cover-scale path is the chosen tradeoff.
- Any change to the existing seamless tile asset.
- Changes to the generator's character / title / glow / flow particles / corrupted text systems.
