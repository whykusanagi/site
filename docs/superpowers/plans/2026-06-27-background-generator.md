# Background Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone static tool that generates branded, character-free background images (lavender default, corrupted-theme palette) at three sizes and exports them as PNG for use in Canva.

**Architecture:** One self-contained `tools/background-generator/index.html` (inline CSS + JS, no framework, no build). A single `<svg id="stage">` is redrawn by `rebuild()` from a `state` object. Each decoration is a named layer with an independent, color-settable pure builder function. Export rasterizes the SVG to PNG via a native `<canvas>` — zero JS dependencies.

**Tech Stack:** Static HTML5 / CSS3 / vanilla JS. SVG DOM via `createElementNS`. corrupted-theme CDN CSS for the control-panel chrome only. `XMLSerializer` + `<canvas>.toBlob` for export.

## Global Constraints

- No build step, no new JS/CSS dependencies. corrupted-theme is loaded via the existing CDN `<link>` only (see exact tag in Task 1).
- No character art, no image upload, no video, no localStorage persistence, no server code. (YAGNI per spec.)
- Sizes are exactly: `16:9` = 1920×1080, `9:16` = 1080×1920, `1:1` = 1080×1080.
- Default base style is `lavender` (vertical gradient `#c7c4ec` → `#eef0fb`).
- Brand `PALETTE` swatches: lavender `#c7c4ec`, lavenderLight `#eef0fb`, pink `#d94f90`, purple `#8b5cf6`, cyan `#00ffff`, ink `#1a1430`, dark `#0a0a0a`, light `#f5f1f8`.
- Every decoration is a **named layer** with its own settable color; a builder reads only its own `state.layers[name]` entry and draws into the SVG it is passed (so it is testable in isolation).
- All work on branch `feature/background-generator`. Static page auto-deploys via Cloudflare Pages on push; no Worker change, so no `wrangler deploy`.
- Testing is manual-browser (repo convention) plus one inline self-check at `?selftest=1`.

**Verifying a step in the browser:** from the **repo root** run `python3 -m http.server 8000`, then load `http://localhost:8000/tools/background-generator/index.html?selftest=1`. (Serve from the repo root, NOT from `tools/background-generator/` — after Task 10 the page is an ES module that imports `../thumbnail-generator/js/lewd-frame.js`, which only resolves when the server root is the repo root. This matches Cloudflare Pages, which serves from the repo root.) `runSelfCheck()` writes `SELFTEST PASS (N checks)` or `SELFTEST FAIL: <msg>` into the `#selftest` banner and `console`. An agentic worker may read this via the claude-in-chrome MCP (navigate + read_console_messages / read_page). Without `?selftest` the page just renders the live preview for visual inspection.

---

### Task 1: Scaffold, base layer, and self-check harness

**Files:**
- Create: `tools/background-generator/index.html`

**Interfaces:**
- Consumes: nothing.
- Produces (all global in the inline `<script>`):
  - `const SVG_NS = 'http://www.w3.org/2000/svg'`
  - `el(name, attrs={}, parent=null, text=null) -> SVGElement`
  - `const SIZES = { '16:9':{w,h}, '9:16':{w,h}, '1:1':{w,h} }`
  - `const PALETTE = { lavender, lavenderLight, pink, purple, cyan, ink, dark, light }`
  - `const DEFAULT_LAYERS` (deep-clone source for `state.layers`)
  - `const state = { size, layers }`
  - `dims() -> {w,h}`
  - `cornerXY(corner) -> {x,y,sx,sy}` for `'tl'|'tr'|'bl'|'br'`
  - `buildBase(svg)`
  - `rebuild()` (calls `buildBase` only in this task)
  - `runSelfCheck() -> Promise<void>`

- [ ] **Step 1: Create the file with full HTML scaffold + base layer + harness**

Create `tools/background-generator/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Background Generator — Corrupted Theme</title>
  <link rel="stylesheet" href="https://cdn.whykusanagi.xyz/corrupted-theme/@0.2.1/dist/theme.min.css" integrity="sha384-5TwIbFKBuga57t3wFR0Pnk6ZMMW9FnF+vQtBzW9XVjrFMdzu85JDRchgdI51mLVd" crossorigin="anonymous">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0a0a0a; color: #f5f1f8; font-family: system-ui, sans-serif; }
    #app { display: flex; min-height: 100vh; gap: 16px; padding: 16px; }
    #preview-pane { flex: 1; display: flex; align-items: center; justify-content: center;
      background: repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 50% / 24px 24px; border-radius: 8px; padding: 16px; }
    #stage { max-width: 100%; max-height: 85vh; box-shadow: 0 8px 40px rgba(0,0,0,.6); background: #000; }
    #controls-pane { width: 320px; flex: none; overflow-y: auto; max-height: 95vh; padding: 8px; }
    .ctl-group { border: 1px solid #3a2555; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    .ctl-group h3 { margin: 0 0 8px; font-size: 14px; color: #e86ca8; }
    .ctl-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; }
    .ctl-row label { flex: 1; }
    select, input[type="number"] { background: #140c28; color: #f5f1f8; border: 1px solid #3a2555; border-radius: 4px; padding: 4px; }
    button { background: linear-gradient(135deg,#d94f90,#b61b70); color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
    button.secondary { background: #2a1d40; }
    #selftest { display: none; padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; white-space: pre-wrap; }
    #selftest.pass { display: block; background: #14331a; color: #8fe28f; }
    #selftest.fail { display: block; background: #3a1414; color: #e28f8f; }
  </style>
</head>
<body>
  <div id="app">
    <div id="preview-pane">
      <svg id="stage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet"></svg>
    </div>
    <div id="controls-pane">
      <div id="selftest"></div>
      <div class="ctl-group">
        <h3>Canvas</h3>
        <div class="ctl-row">
          <label for="c-size">Size</label>
          <select id="c-size">
            <option value="16:9">1920×1080 (16:9)</option>
            <option value="9:16">1080×1920 (9:16)</option>
            <option value="1:1">1080×1080 (1:1)</option>
          </select>
        </div>
      </div>
      <div class="ctl-group">
        <h3>Base</h3>
        <div class="ctl-row"><label for="c-base-on">Enabled</label><input type="checkbox" id="c-base-on" checked></div>
        <div class="ctl-row">
          <label for="c-base-style">Style</label>
          <select id="c-base-style">
            <option value="lavender">Lavender gradient</option>
            <option value="solid">Solid</option>
            <option value="gradient-purple">Purple gradient</option>
            <option value="gradient-accent">Accent gradient</option>
          </select>
        </div>
        <div class="ctl-row"><label for="c-base-color">Color / top</label><input type="color" id="c-base-color" value="#c7c4ec"></div>
        <div class="ctl-row"><label for="c-base-color2">Bottom</label><input type="color" id="c-base-color2" value="#eef0fb"></div>
      </div>
    </div>
  </div>
  <script>
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs = {}, parent = null, text = null) {
    const n = document.createElementNS(SVG_NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  const SIZES = {
    '16:9': { w: 1920, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '1:1':  { w: 1080, h: 1080 },
  };

  const PALETTE = {
    lavender: '#c7c4ec', lavenderLight: '#eef0fb',
    pink: '#d94f90', purple: '#8b5cf6', cyan: '#00ffff',
    ink: '#1a1430', dark: '#0a0a0a', light: '#f5f1f8',
  };

  const DEFAULT_LAYERS = {
    base:      { on: true,  style: 'lavender', color: PALETTE.lavender, color2: PALETTE.lavenderLight },
    halftone:  { on: true,  color: PALETTE.ink, density: 'med', corners: ['tl'] },
    sparkles:  { on: true,  color: PALETTE.ink, count: 6, corners: ['tr', 'br'] },
    rails:     { on: true,  color: PALETTE.ink },
    nameplate: { on: false, color: PALETTE.dark, corner: 'bl' },
    logo:      { on: false, color: PALETTE.light, text: 'CELESTE' },
  };

  const state = { size: '16:9', layers: JSON.parse(JSON.stringify(DEFAULT_LAYERS)) };
  function dims() { return SIZES[state.size]; }

  function cornerXY(corner) {
    const { w, h } = dims();
    return {
      tl: { x: 0, y: 0, sx: 1,  sy: 1  },
      tr: { x: w, y: 0, sx: -1, sy: 1  },
      bl: { x: 0, y: h, sx: 1,  sy: -1 },
      br: { x: w, y: h, sx: -1, sy: -1 },
    }[corner];
  }

  function buildBase(svg) {
    const L = state.layers.base;
    if (!L.on) return;
    const { w, h } = dims();
    let fill = L.color;
    if (L.style !== 'solid') {
      const defs = el('defs', {}, svg);
      const grad = el('linearGradient', { id: 'base-grad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
      let c1 = L.color, c2 = L.color2;
      if (L.style === 'gradient-purple') { c1 = PALETTE.purple; c2 = PALETTE.pink; }
      if (L.style === 'gradient-accent') { c1 = PALETTE.pink;   c2 = PALETTE.dark; }
      el('stop', { offset: '0%',   'stop-color': c1 }, grad);
      el('stop', { offset: '100%', 'stop-color': c2 }, grad);
      fill = 'url(#base-grad)';
    }
    el('rect', { x: 0, y: 0, width: w, height: h, fill }, svg);
  }

  function rebuild() {
    const svg = document.getElementById('stage');
    const { w, h } = dims();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    buildBase(svg);
  }

  // ---- controls ----
  function wireControls() {
    const $ = id => document.getElementById(id);
    $('c-size').addEventListener('change', e => { state.size = e.target.value; rebuild(); });
    $('c-base-on').addEventListener('change', e => { state.layers.base.on = e.target.checked; rebuild(); });
    $('c-base-style').addEventListener('change', e => { state.layers.base.style = e.target.value; rebuild(); });
    $('c-base-color').addEventListener('input', e => { state.layers.base.color = e.target.value; rebuild(); });
    $('c-base-color2').addEventListener('input', e => { state.layers.base.color2 = e.target.value; rebuild(); });
  }

  // ---- self check ----
  async function runSelfCheck() {
    const banner = document.getElementById('selftest');
    const log = [];
    const assert = (cond, msg) => { if (!cond) throw new Error(msg); log.push('ok: ' + msg); };
    try {
      state.size = '16:9';
      state.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
      rebuild();
      const svg = document.getElementById('stage');
      const xml = new XMLSerializer().serializeToString(svg);
      assert(xml.length > 100, 'svg serializes non-empty');
      assert(svg.querySelectorAll('rect').length >= 1, 'base rect present');
      banner.className = 'pass';
      banner.textContent = `SELFTEST PASS (${log.length} checks)\n` + log.join('\n');
      console.log('SELFTEST PASS', log);
    } catch (err) {
      banner.className = 'fail';
      banner.textContent = 'SELFTEST FAIL: ' + err.message;
      console.error('SELFTEST FAIL', err);
    }
  }

  // ---- boot ----
  wireControls();
  rebuild();
  if (new URLSearchParams(location.search).has('selftest')) runSelfCheck();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify the base renders and self-check passes**

Run: `cd tools/background-generator && python3 -m http.server 8000`
Load: `http://localhost:8000/index.html?selftest=1`
Expected: lavender vertical gradient fills the stage; `#selftest` banner shows `SELFTEST PASS (2 checks)`. Change Size to 9:16 → preview becomes portrait. Toggle Base off → stage clears.

- [ ] **Step 3: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): scaffold standalone background generator with base layer + self-check"
```

---

### Task 2: Halftone dot-cluster layer

**Files:**
- Modify: `tools/background-generator/index.html` (add builder, extend `rebuild`, add controls + wiring, extend `runSelfCheck`)

**Interfaces:**
- Consumes: `el`, `dims`, `cornerXY`, `state.layers.halftone`, `rebuild`.
- Produces: `const HALFTONE_DENSITY = { low:4, med:6, high:9 }`; `buildHalftone(svg)`. Circles per corner = `n*(n+1)/2` where `n = HALFTONE_DENSITY[density]` (triangular falloff from the corner).

- [ ] **Step 1: Add the failing self-check assertion**

In `runSelfCheck`, after the base assertions, add:

```js
      const ht = document.createElementNS(SVG_NS, 'svg');
      state.layers.halftone.corners = ['tl'];
      state.layers.halftone.density = 'med';
      buildHalftone(ht);
      const n = HALFTONE_DENSITY.med;
      assert(ht.querySelectorAll('circle').length === n * (n + 1) / 2, 'halftone circle count (triangular)');
```

- [ ] **Step 2: Run to verify it fails**

Load `http://localhost:8000/index.html?selftest=1`.
Expected: `SELFTEST FAIL: buildHalftone is not defined` (or `HALFTONE_DENSITY is not defined`).

- [ ] **Step 3: Add the builder and wire it into rebuild**

Add after `buildBase`:

```js
  const HALFTONE_DENSITY = { low: 4, med: 6, high: 9 };
  function buildHalftone(svg) {
    const L = state.layers.halftone;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const n = HALFTONE_DENSITY[L.density] || 6;
    const unit = Math.min(w, h) * 0.05;
    const maxR = unit * 0.42;
    for (const corner of L.corners) {
      const c = cornerXY(corner);
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          if (row + col >= n) continue;            // triangular falloff from corner
          const cx = c.x + c.sx * (col + 0.5) * unit;
          const cy = c.y + c.sy * (row + 0.5) * unit;
          const t = 1 - (row + col) / n;
          el('circle', { cx, cy, r: maxR * t, fill: L.color, opacity: (0.25 + 0.55 * t).toFixed(3) }, g);
        }
      }
    }
  }
```

Update `rebuild` body to call it after `buildBase(svg);`:

```js
  function rebuild() {
    const svg = document.getElementById('stage');
    const { w, h } = dims();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    buildBase(svg);
    buildHalftone(svg);
  }
```

- [ ] **Step 4: Add controls + wiring**

Add a control group in `#controls-pane` after the Base group:

```html
      <div class="ctl-group">
        <h3>Halftone dots</h3>
        <div class="ctl-row"><label for="c-ht-on">Enabled</label><input type="checkbox" id="c-ht-on" checked></div>
        <div class="ctl-row"><label for="c-ht-color">Color</label><input type="color" id="c-ht-color" value="#1a1430"></div>
        <div class="ctl-row">
          <label for="c-ht-density">Density</label>
          <select id="c-ht-density">
            <option value="low">Low</option><option value="med" selected>Med</option><option value="high">High</option>
          </select>
        </div>
        <div class="ctl-row"><label>Corners</label>
          <label><input type="checkbox" class="c-ht-corner" value="tl" checked>TL</label>
          <label><input type="checkbox" class="c-ht-corner" value="tr">TR</label>
          <label><input type="checkbox" class="c-ht-corner" value="bl">BL</label>
          <label><input type="checkbox" class="c-ht-corner" value="br">BR</label>
        </div>
      </div>
```

Add to `wireControls`:

```js
    $('c-ht-on').addEventListener('change', e => { state.layers.halftone.on = e.target.checked; rebuild(); });
    $('c-ht-color').addEventListener('input', e => { state.layers.halftone.color = e.target.value; rebuild(); });
    $('c-ht-density').addEventListener('change', e => { state.layers.halftone.density = e.target.value; rebuild(); });
    document.querySelectorAll('.c-ht-corner').forEach(cb => cb.addEventListener('change', () => {
      state.layers.halftone.corners = [...document.querySelectorAll('.c-ht-corner:checked')].map(x => x.value);
      rebuild();
    }));
```

- [ ] **Step 5: Verify pass**

Load `?selftest=1`. Expected: `SELFTEST PASS (3 checks)`; top-left corner shows a fading triangular dot cluster. Toggle density High → denser. Check TR/BL/BR corners → clusters appear there too.

- [ ] **Step 6: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): add halftone dot-cluster layer"
```

---

### Task 3: Four-point sparkle-cluster layer

**Files:**
- Modify: `tools/background-generator/index.html`

**Interfaces:**
- Consumes: `el`, `dims`, `cornerXY`, `state.layers.sparkles`, `Math.random`, `rebuild`.
- Produces: `starPathD(s) -> string` (4-point star, outer radius `s`, inner `s/4`, lifted from `iconography-mode.js`); `buildSparkles(svg)`. Star `<path>` nodes = `count * corners.length`.

- [ ] **Step 1: Add the failing self-check assertion**

In `runSelfCheck`, after the halftone assertion:

```js
      const sp = document.createElementNS(SVG_NS, 'svg');
      state.layers.sparkles.corners = ['tr', 'br'];
      state.layers.sparkles.count = 6;
      buildSparkles(sp);
      assert(sp.querySelectorAll('path').length === 6 * 2, 'sparkle star count = count * corners');
```

- [ ] **Step 2: Run to verify it fails**

Load `?selftest=1`. Expected: `SELFTEST FAIL: buildSparkles is not defined`.

- [ ] **Step 3: Add the builder and wire into rebuild**

Add after `buildHalftone`:

```js
  function starPathD(s) {
    const o = s, i = s / 4;                       // 4-point star, from iconography-mode.js
    return `M 0,${-o} L ${i},${-i} L ${o},0 L ${i},${i} L 0,${o} L ${-i},${i} L ${-o},0 L ${-i},${-i} Z`;
  }
  function buildSparkles(svg) {
    const L = state.layers.sparkles;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const m = Math.min(w, h);
    const span = m * 0.20;
    const big = m * 0.055;
    const inset = m * 0.04;
    for (const corner of L.corners) {
      const c = cornerXY(corner);
      for (let k = 0; k < L.count; k++) {
        const ox = c.x + c.sx * (inset + Math.random() * span);
        const oy = c.y + c.sy * (inset + Math.random() * span);
        const size = k === 0 ? big : big * (0.25 + Math.random() * 0.45);
        el('path', { d: starPathD(size), transform: `translate(${ox.toFixed(1)},${oy.toFixed(1)})`, fill: L.color }, g);
      }
    }
  }
```

Add `buildSparkles(svg);` to `rebuild` after `buildHalftone(svg);`.

- [ ] **Step 4: Add controls + wiring**

Add a control group after Halftone:

```html
      <div class="ctl-group">
        <h3>Sparkles</h3>
        <div class="ctl-row"><label for="c-sp-on">Enabled</label><input type="checkbox" id="c-sp-on" checked></div>
        <div class="ctl-row"><label for="c-sp-color">Color</label><input type="color" id="c-sp-color" value="#1a1430"></div>
        <div class="ctl-row"><label for="c-sp-count">Count / corner</label><input type="number" id="c-sp-count" min="1" max="20" value="6"></div>
        <div class="ctl-row"><label>Corners</label>
          <label><input type="checkbox" class="c-sp-corner" value="tl">TL</label>
          <label><input type="checkbox" class="c-sp-corner" value="tr" checked>TR</label>
          <label><input type="checkbox" class="c-sp-corner" value="bl">BL</label>
          <label><input type="checkbox" class="c-sp-corner" value="br" checked>BR</label>
        </div>
      </div>
```

Add to `wireControls`:

```js
    $('c-sp-on').addEventListener('change', e => { state.layers.sparkles.on = e.target.checked; rebuild(); });
    $('c-sp-color').addEventListener('input', e => { state.layers.sparkles.color = e.target.value; rebuild(); });
    $('c-sp-count').addEventListener('change', e => { state.layers.sparkles.count = Math.max(1, +e.target.value || 1); rebuild(); });
    document.querySelectorAll('.c-sp-corner').forEach(cb => cb.addEventListener('change', () => {
      state.layers.sparkles.corners = [...document.querySelectorAll('.c-sp-corner:checked')].map(x => x.value);
      rebuild();
    }));
```

- [ ] **Step 5: Verify pass**

Load `?selftest=1`. Expected: `SELFTEST PASS (4 checks)`; sparkle clusters (one larger star + smaller scattered ones) appear in TR and BR corners.

- [ ] **Step 6: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): add four-point sparkle-cluster layer"
```

---

### Task 4: Rails, nameplate, and logo layers

**Files:**
- Modify: `tools/background-generator/index.html`

**Interfaces:**
- Consumes: `el`, `dims`, `cornerXY`, `state.layers.{rails,nameplate,logo}`, `rebuild`.
- Produces: `buildRails(svg)`, `buildNameplate(svg)`, `buildLogo(svg)`.

- [ ] **Step 1: Add the builders and wire into rebuild**

Add after `buildSparkles`:

```js
  function buildRails(svg) {
    const L = state.layers.rails;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const m = Math.min(w, h) * 0.045;
    const sw = Math.max(2, Math.min(w, h) * 0.004);
    el('line', { x1: m, y1: m, x2: w - m, y2: m, stroke: L.color, 'stroke-width': sw }, g);
    el('line', { x1: m, y1: h - m, x2: w - m, y2: h - m, stroke: L.color, 'stroke-width': sw }, g);
  }
  function buildNameplate(svg) {
    const L = state.layers.nameplate;
    if (!L.on) return;
    const { w, h } = dims();
    const bw = w * 0.28, bh = h * 0.08;
    const c = cornerXY(L.corner);
    const x = c.sx > 0 ? c.x : c.x - bw;
    const y = c.sy > 0 ? c.y : c.y - bh;
    el('rect', { x, y, width: bw, height: bh, fill: L.color }, svg);
  }
  function buildLogo(svg) {
    const L = state.layers.logo;
    if (!L.on) return;
    const { w, h } = dims();
    el('text', {
      x: w / 2, y: h / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'Georgia, serif', 'font-size': Math.min(w, h) * 0.08,
      'letter-spacing': '0.12em', fill: L.color,
    }, svg, L.text);
  }
```

Update `rebuild` to append, in this order, after `buildSparkles(svg);`:

```js
    buildRails(svg);
    buildNameplate(svg);
    buildLogo(svg);
```

- [ ] **Step 2: Add controls + wiring**

Add control groups after Sparkles:

```html
      <div class="ctl-group">
        <h3>Rails</h3>
        <div class="ctl-row"><label for="c-rl-on">Enabled</label><input type="checkbox" id="c-rl-on" checked></div>
        <div class="ctl-row"><label for="c-rl-color">Color</label><input type="color" id="c-rl-color" value="#1a1430"></div>
      </div>
      <div class="ctl-group">
        <h3>Nameplate</h3>
        <div class="ctl-row"><label for="c-np-on">Enabled</label><input type="checkbox" id="c-np-on"></div>
        <div class="ctl-row"><label for="c-np-color">Color</label><input type="color" id="c-np-color" value="#0a0a0a"></div>
        <div class="ctl-row"><label for="c-np-corner">Corner</label>
          <select id="c-np-corner">
            <option value="tl">TL</option><option value="tr">TR</option>
            <option value="bl" selected>BL</option><option value="br">BR</option>
          </select>
        </div>
      </div>
      <div class="ctl-group">
        <h3>Logo text</h3>
        <div class="ctl-row"><label for="c-lg-on">Enabled</label><input type="checkbox" id="c-lg-on"></div>
        <div class="ctl-row"><label for="c-lg-color">Color</label><input type="color" id="c-lg-color" value="#f5f1f8"></div>
        <div class="ctl-row"><label for="c-lg-text">Text</label><input type="text" id="c-lg-text" value="CELESTE" style="flex:1;background:#140c28;color:#f5f1f8;border:1px solid #3a2555;border-radius:4px;padding:4px;"></div>
      </div>
```

Add to `wireControls`:

```js
    $('c-rl-on').addEventListener('change', e => { state.layers.rails.on = e.target.checked; rebuild(); });
    $('c-rl-color').addEventListener('input', e => { state.layers.rails.color = e.target.value; rebuild(); });
    $('c-np-on').addEventListener('change', e => { state.layers.nameplate.on = e.target.checked; rebuild(); });
    $('c-np-color').addEventListener('input', e => { state.layers.nameplate.color = e.target.value; rebuild(); });
    $('c-np-corner').addEventListener('change', e => { state.layers.nameplate.corner = e.target.value; rebuild(); });
    $('c-lg-on').addEventListener('change', e => { state.layers.logo.on = e.target.checked; rebuild(); });
    $('c-lg-color').addEventListener('input', e => { state.layers.logo.color = e.target.value; rebuild(); });
    $('c-lg-text').addEventListener('input', e => { state.layers.logo.text = e.target.value; rebuild(); });
```

- [ ] **Step 3: Verify visually**

Load `http://localhost:8000/index.html` (no selftest). Rails appear top + bottom. Enable Nameplate → dark bar in bottom-left; change corner → it moves. Enable Logo → "CELESTE" centered; edit text → updates.

- [ ] **Step 4: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): add rails, nameplate, and logo layers"
```

---

### Task 5: PNG export (current size + all sizes)

**Files:**
- Modify: `tools/background-generator/index.html`

**Interfaces:**
- Consumes: `dims`, `SIZES`, `state`, `rebuild`, `#stage`.
- Produces: `svgToPng(w, h) -> Promise<Blob>`; `downloadBlob(blob, name)`; `exportCurrent() -> Promise`; `exportAll() -> Promise`. Filenames `bg_<baseStyle>_<w>x<h>.png`.

- [ ] **Step 1: Add the failing self-check assertion**

In `runSelfCheck`, after the sparkle assertion:

```js
      const blob = await svgToPng(1920, 1080);
      assert(blob && blob.size > 0, 'png raster non-empty');
```

- [ ] **Step 2: Run to verify it fails**

Load `?selftest=1`. Expected: `SELFTEST FAIL: svgToPng is not defined`.

- [ ] **Step 3: Add export functions**

Add before `runSelfCheck`:

```js
  function svgToPng(w, h) {
    return new Promise((resolve, reject) => {
      const svg = document.getElementById('stage').cloneNode(true);
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      const xml = new XMLSerializer().serializeToString(svg);
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png');
      };
      img.onerror = () => reject(new Error('svg image failed to load'));
      img.src = url;
    });
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function exportCurrent() {
    const { w, h } = dims();
    downloadBlob(await svgToPng(w, h), `bg_${state.layers.base.style}_${w}x${h}.png`);
  }
  async function exportAll() {
    const prev = state.size;
    for (const key of Object.keys(SIZES)) {
      state.size = key; rebuild();
      const { w, h } = SIZES[key];
      downloadBlob(await svgToPng(w, h), `bg_${state.layers.base.style}_${w}x${h}.png`);
    }
    state.size = prev; rebuild();
  }
```

- [ ] **Step 4: Add export buttons + wiring**

Add a control group at the top of `#controls-pane`, right after the `#selftest` div:

```html
      <div class="ctl-group">
        <h3>Export</h3>
        <div class="ctl-row"><button id="c-export-one">Export PNG (current)</button></div>
        <div class="ctl-row"><button id="c-export-all" class="secondary">Export all sizes</button></div>
      </div>
```

Add to `wireControls`:

```js
    $('c-export-one').addEventListener('click', () => exportCurrent());
    $('c-export-all').addEventListener('click', () => exportAll());
```

- [ ] **Step 5: Verify pass + real export**

Load `?selftest=1` → `SELFTEST PASS (5 checks)`. Then load without selftest, click **Export PNG (current)** → a `bg_lavender_1920x1080.png` downloads. Open it and confirm it is exactly 1920×1080 with the lavender background and decorations baked in. Click **Export all sizes** → three PNGs download (1920×1080, 1080×1920, 1080×1080).

- [ ] **Step 6: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): add native SVG-to-PNG export (current + all sizes)"
```

---

### Task 6: Randomize variant + control sync

**Files:**
- Modify: `tools/background-generator/index.html`

**Interfaces:**
- Consumes: `PALETTE`, `state`, `rebuild`, all control element IDs.
- Produces: `pick(arr)`; `randomize()`; `syncControls()` (writes `state` back into every input, so randomize and size-driven changes reflect in the UI).

- [ ] **Step 1: Add `pick`, `syncControls`, and `randomize`**

Add before `runSelfCheck`:

```js
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function syncControls() {
    const $ = id => document.getElementById(id);
    const L = state.layers;
    $('c-size').value = state.size;
    $('c-base-on').checked = L.base.on;
    $('c-base-style').value = L.base.style;
    $('c-base-color').value = L.base.color;
    $('c-base-color2').value = L.base.color2;
    $('c-ht-on').checked = L.halftone.on;
    $('c-ht-color').value = L.halftone.color;
    $('c-ht-density').value = L.halftone.density;
    document.querySelectorAll('.c-ht-corner').forEach(cb => { cb.checked = L.halftone.corners.includes(cb.value); });
    $('c-sp-on').checked = L.sparkles.on;
    $('c-sp-color').value = L.sparkles.color;
    $('c-sp-count').value = L.sparkles.count;
    document.querySelectorAll('.c-sp-corner').forEach(cb => { cb.checked = L.sparkles.corners.includes(cb.value); });
    $('c-rl-on').checked = L.rails.on;
    $('c-rl-color').value = L.rails.color;
    $('c-np-on').checked = L.nameplate.on;
    $('c-np-color').value = L.nameplate.color;
    $('c-np-corner').value = L.nameplate.corner;
    $('c-lg-on').checked = L.logo.on;
    $('c-lg-color').value = L.logo.color;
    $('c-lg-text').value = L.logo.text;
  }

  function randomize() {
    const accents = [PALETTE.ink, PALETTE.pink, PALETTE.purple, PALETTE.cyan, PALETTE.dark];
    const corners = ['tl', 'tr', 'bl', 'br'].sort(() => Math.random() - 0.5);
    const L = state.layers;
    L.base.style = pick(['lavender', 'solid', 'gradient-purple', 'gradient-accent']);
    if (L.base.style === 'solid') L.base.color = pick([PALETTE.dark, PALETTE.ink, PALETTE.purple]);
    L.halftone.corners = corners.slice(0, 1 + Math.floor(Math.random() * 2));
    L.sparkles.corners = corners.slice(2);
    L.halftone.color = pick(accents);
    L.sparkles.color = pick(accents);
    L.halftone.density = pick(['low', 'med', 'high']);
    L.sparkles.count = 4 + Math.floor(Math.random() * 6);
    syncControls();
    rebuild();
  }
```

- [ ] **Step 2: Add the button + wiring**

In the Export control group, add a button:

```html
        <div class="ctl-row"><button id="c-randomize" class="secondary">🎲 Randomize variant</button></div>
```

Add to `wireControls`:

```js
    $('c-randomize').addEventListener('click', () => randomize());
```

Also call `syncControls();` once at boot, just before `rebuild();` at the bottom of the script, so inputs match `DEFAULT_LAYERS`.

- [ ] **Step 3: Verify**

Load `http://localhost:8000/index.html`. Click **🎲 Randomize variant** repeatedly: base style, colors, corner assignments, and densities change each time, the control inputs update to match, and halftone/sparkles never share a corner (sparkles take the corners halftone didn't). Re-run `?selftest=1` → still `SELFTEST PASS (5 checks)`.

- [ ] **Step 4: Commit**

```bash
git add tools/background-generator/index.html
git commit -m "feat(bg-gen): add randomize-variant button with control sync"
```

---

## Self-Review

**Spec coverage:**
- Standalone single file → Task 1. ✓
- Three sizes → `SIZES` (Task 1), size control (Task 1), export-all loops them (Task 5). ✓
- Lavender default base → `DEFAULT_LAYERS.base.style='lavender'` (Task 1). ✓
- Named per-layer color params → `state.layers` + per-layer color pickers (Tasks 1–4). ✓
- Decoration builders base/halftone/sparkles/rails/nameplate/logo → Tasks 1–4. ✓
- Four-point star reused from iconography → `starPathD` (Task 3). ✓
- PALETTE swatches → Task 1; used by randomize (Task 6). ✓
- Native SVG→canvas→PNG export, current + all → Task 5. ✓
- Randomize variant → Task 6. ✓
- Inline self-check (serialize, cluster counts, raster) → grown across Tasks 1,2,3,5. ✓
- corrupted-theme CDN for chrome only, no deps → Task 1 `<link>`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `buildBase/buildHalftone/buildSparkles/buildRails/buildNameplate/buildLogo` all take `(svg)` and read `state.layers.<name>`; `rebuild` calls them in order; `svgToPng(w,h)` used identically in `exportCurrent`, `exportAll`, and self-check; `syncControls` references only IDs created in Tasks 1–5; `cornerXY` keys `tl/tr/bl/br` match all corner control values. ✓

**Note on self-check count:** the PASS banner reports the number of checks (2 after Task 1, 3 after Task 2, 4 after Task 3, 5 after Task 5). Verify steps state the expected count per task.

---

# v2 Addendum — Expansion Tasks (2026-06-28)

**Execution order:** 1,2,3 (done) → **4** → **7** → **8** → **9** → **10** → **11** → **5 (export)** → **12 (randomize v2)**.
**Task 6 (v1 randomize) is SUPERSEDED by Task 12** — skip it.

Exact visual values (palette, theme table, spectrum, EVA coords, FX recipes,
lewd-frame reuse) live in `.superpowers/sdd/refs.md`. Every new layer follows the
v1 pattern: a small `buildX(svg)` reading only `state.layers.X`, appended by
`rebuild()` in z-order, plus a control group + listeners, plus (where it has
countable geometry) a self-check assertion. z-order in `rebuild()` becomes:
`buildBase → buildHalftone → buildSpectrum → buildEva → buildSparkles →
buildGlyphs → buildRails → buildNameplate → buildLogo → buildGlitch →
buildScanlines → buildNoise`.

Each new layer needs a `DEFAULT_LAYERS` entry (add when the task introduces it).

---

### Task 7: Theme presets + halftone spread modes

**Files:** Modify `tools/background-generator/index.html`

**Interfaces produced:** extended `PALETTE`; `THEMES`; `applyTheme(name)`;
`syncControls()` (introduced here, extended by later tasks); `buildHalftone` gains
`spread` support; `DEFAULT_LAYERS.halftone.spread = 'corner'`.

- [ ] **Extend `PALETTE`** to:

```js
  const PALETTE = {
    lavender: '#c7c4ec', lavenderLight: '#eef0fb',
    pink: '#d94f90', purple: '#8b5cf6', cyan: '#00ffff',
    ink: '#1a1430', dark: '#0a0a0a', light: '#f5f1f8',
    purpleLight: '#b08aff', magentaLight: '#e86ca8',
    red: '#ff0000', yellow: '#ffff00', evaOrange: '#ff6600',
    neonMagenta: '#ff00ff', deepBlue: '#0088ff',
  };
```

- [ ] **Add `spread: 'corner'`** to `DEFAULT_LAYERS.halftone` (keep its other fields).

- [ ] **Replace `buildHalftone`** with the spread-aware version:

```js
  function buildHalftone(svg) {
    const L = state.layers.halftone;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const n = HALFTONE_DENSITY[L.density] || 6;
    const unit = Math.min(w, h) * 0.05;
    const maxR = unit * 0.42;
    const spread = L.spread || 'corner';
    if (spread === 'corner') {
      for (const corner of L.corners) {
        const c = cornerXY(corner);
        for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
          if (row + col >= n) continue;
          const cx = c.x + c.sx * (col + 0.5) * unit;
          const cy = c.y + c.sy * (row + 0.5) * unit;
          const t = 1 - (row + col) / n;
          el('circle', { cx, cy, r: maxR * t, fill: L.color, opacity: (0.25 + 0.55 * t).toFixed(3) }, g);
        }
      }
    } else {
      const cols = Math.ceil(w / unit), rows = Math.ceil(h / unit);
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const cx = (col + 0.5) * unit, cy = (row + 0.5) * unit;
        const t = spread === 'full-field' ? (1 - col / cols) : Math.max(0, 1 - cy / (h * 0.4));
        if (t <= 0.02) continue;
        el('circle', { cx, cy, r: maxR * t, fill: L.color, opacity: (0.15 + 0.5 * t).toFixed(3) }, g);
      }
    }
  }
```

- [ ] **Add `THEMES` + `applyTheme` + `syncControls`** (place before `runSelfCheck`):

```js
  const THEMES = {
    lavender:  { base: { style: 'lavender', color: PALETTE.lavender, color2: PALETTE.lavenderLight }, accent: PALETTE.ink,        glyph: PALETTE.ink },
    corrupted: { base: { style: 'gradient-accent', color: PALETTE.pink, color2: PALETTE.dark },       accent: PALETTE.pink,       glyph: PALETTE.magentaLight },
    abyss:     { base: { style: 'solid', color: PALETTE.dark, color2: PALETTE.dark },                 accent: PALETTE.cyan,       glyph: PALETTE.cyan },
    succubus:  { base: { style: 'gradient-purple', color: PALETTE.purple, color2: PALETTE.pink },     accent: PALETTE.purpleLight, glyph: PALETTE.neonMagenta },
  };
  function applyTheme(name) {
    const t = THEMES[name]; if (!t) return;
    const L = state.layers;
    L.base.style = t.base.style; L.base.color = t.base.color; L.base.color2 = t.base.color2;
    L.halftone.color = t.accent; L.sparkles.color = t.accent; L.rails.color = t.accent;
    if (L.glyphs) L.glyphs.color = t.glyph;
    syncControls(); rebuild();
  }
  function syncControls() {
    const $ = id => document.getElementById(id);
    const L = state.layers;
    $('c-size').value = state.size;
    $('c-base-on').checked = L.base.on; $('c-base-style').value = L.base.style;
    $('c-base-color').value = L.base.color; $('c-base-color2').value = L.base.color2;
    $('c-ht-on').checked = L.halftone.on; $('c-ht-color').value = L.halftone.color;
    $('c-ht-density').value = L.halftone.density; $('c-ht-spread').value = L.halftone.spread || 'corner';
    document.querySelectorAll('.c-ht-corner').forEach(cb => { cb.checked = L.halftone.corners.includes(cb.value); });
    $('c-sp-on').checked = L.sparkles.on; $('c-sp-color').value = L.sparkles.color; $('c-sp-count').value = L.sparkles.count;
    document.querySelectorAll('.c-sp-corner').forEach(cb => { cb.checked = L.sparkles.corners.includes(cb.value); });
    $('c-rl-on').checked = L.rails.on; $('c-rl-color').value = L.rails.color;
    $('c-np-on').checked = L.nameplate.on; $('c-np-color').value = L.nameplate.color; $('c-np-corner').value = L.nameplate.corner;
    $('c-lg-on').checked = L.logo.on; $('c-lg-color').value = L.logo.color; $('c-lg-text').value = L.logo.text;
  }
```

(Later tasks 8–11 append their own lines to `syncControls`, each guarded only by
the element existing because that task also adds the control.)

- [ ] **Add controls**: a "Theme" group at the top (after Export group if present,
else after the `#selftest` div) and a Spread row inside the Halftone group:

```html
      <div class="ctl-group">
        <h3>Theme</h3>
        <div class="ctl-row">
          <label for="c-theme">Preset</label>
          <select id="c-theme">
            <option value="">— custom —</option>
            <option value="lavender">Lavender</option>
            <option value="corrupted">Corrupted</option>
            <option value="abyss">Abyss</option>
            <option value="succubus">Succubus</option>
          </select>
        </div>
      </div>
```

Spread row (add inside the existing Halftone group, after Density):

```html
        <div class="ctl-row">
          <label for="c-ht-spread">Spread</label>
          <select id="c-ht-spread">
            <option value="corner" selected>Corner</option>
            <option value="edge-fade">Edge fade</option>
            <option value="full-field">Full field</option>
          </select>
        </div>
```

- [ ] **Wire** in `wireControls`:

```js
    $('c-theme').addEventListener('change', e => { if (e.target.value) applyTheme(e.target.value); });
    $('c-ht-spread').addEventListener('change', e => { state.layers.halftone.spread = e.target.value; rebuild(); });
```

- [ ] **Update the halftone self-check** assertion to pin spread so the count stays
21: set `state.layers.halftone.spread = 'corner';` alongside the existing
`corners=['tl']; density='med';` lines.

- [ ] **Verify:** controller loads `?selftest=1` → still `SELFTEST PASS (4 checks)`;
switching Theme recolors layers and moves the pickers; Halftone Spread → Full field
fills the canvas with a left-fading dot field.

- [ ] **Commit:** `feat(bg-gen): add theme presets and halftone spread modes`

---

### Task 8: Spectrum-bar layer

**Files:** Modify `index.html`. **Adds** `DEFAULT_LAYERS.spectrum = { on:false, gradient:true }`, `buildSpectrum(svg)`, call in `rebuild` (after `buildHalftone`), controls + listener, sync line.

- [ ] **Builder** (after `buildHalftone`):

```js
  function buildSpectrum(svg) {
    const L = state.layers.spectrum;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', { opacity: 0.6 }, svg);
    const defs = el('defs', {}, g);
    const gradId = 'spec-grad';
    const grad = el('linearGradient', { id: gradId, x1: '0', y1: '1', x2: '0', y2: '0' }, defs);
    el('stop', { offset: '0%',   'stop-color': PALETTE.pink }, grad);
    el('stop', { offset: '50%',  'stop-color': PALETTE.purple }, grad);
    el('stop', { offset: '100%', 'stop-color': PALETTE.cyan }, grad);
    const strip = h * 0.18;
    const bw = (w / 128) * 2.5;
    const gap = 1;
    for (let x = 0, i = 0; x < w; x += bw + gap, i++) {
      const bh = strip * (0.1 + Math.random() * 0.8);
      el('rect', { x: x.toFixed(1), y: (h - bh).toFixed(1), width: Math.max(1, bw - gap).toFixed(1), height: bh.toFixed(1), fill: `url(#${gradId})` }, g);
    }
  }
```

- [ ] Add `buildSpectrum(svg);` to `rebuild` right after `buildHalftone(svg);`.
- [ ] **Controls** (new group): `c-spec-on` checkbox (Spectrum bars, default off).
- [ ] **Wire:** `$('c-spec-on').addEventListener('change', e => { state.layers.spectrum.on = e.target.checked; rebuild(); });`
- [ ] **Sync line** in `syncControls`: `$('c-spec-on').checked = L.spectrum.on;`
- [ ] **Verify:** enable Spectrum → row of gradient EQ bars along the bottom, varying heights. Self-check unchanged (4 checks).
- [ ] **Commit:** `feat(bg-gen): add audio-spectrum bar layer`

---

### Task 9: EVA-pattern layer

**Files:** Modify `index.html`. **Adds** `DEFAULT_LAYERS.eva = { on:false }`, `buildEva(svg)`, call in `rebuild` (after `buildSpectrum`), controls + listener, sync line. Coords from refs.md scaled by `sx=w/1920, sy=h/1080`.

- [ ] **Builder** (after `buildSpectrum`):

```js
  function buildEva(svg) {
    const L = state.layers.eva;
    if (!L.on) return;
    const { w, h } = dims();
    const sx = w / 1920, sy = h / 1080;
    const g = el('g', {}, svg);
    const P = (pts, stroke, sw, op) => el('polyline', { points: pts, fill: 'none', stroke, 'stroke-width': sw, opacity: op }, g);
    const scale = pts => pts.map(([x, y]) => `${(x * sx).toFixed(1)},${(y * sy).toFixed(1)}`).join(' ');
    // corner L-brackets (orange)
    [[[50,50],[50,150],[150,150]], [[1870,50],[1870,150],[1770,150]],
     [[50,1030],[50,930],[150,930]], [[1870,1030],[1870,930],[1770,930]]]
      .forEach(p => P(scale(p), PALETTE.evaOrange, 3, 0.8));
    // hexagons (purple)
    [[[960,100],[1000,125],[1000,175],[960,200],[920,175],[920,125]],
     [[960,880],[1000,905],[1000,955],[960,980],[920,955],[920,905]]]
      .forEach(p => el('polygon', { points: scale(p), fill: 'none', stroke: PALETTE.purple, 'stroke-width': 2, opacity: 0.6 }, g));
    // crosshairs (neon magenta)
    [[200,540],[1720,540]].forEach(([cx, cy]) => {
      const x = cx * sx, y = cy * sy, r = 30 * sx;
      el('circle', { cx: x, cy: y, r, fill: 'none', stroke: PALETTE.neonMagenta, 'stroke-width': 2, opacity: 0.5 }, g);
      el('line', { x1: x - r, y1: y, x2: x + r, y2: y, stroke: PALETTE.neonMagenta, 'stroke-width': 2, opacity: 0.5 }, g);
      el('line', { x1: x, y1: y - r, x2: x, y2: y + r, stroke: PALETTE.neonMagenta, 'stroke-width': 2, opacity: 0.5 }, g);
    });
    // corruption diagonals (magenta)
    [[[0,0],[400,400]], [[1920,0],[1520,400]], [[0,1080],[400,680]], [[1920,1080],[1520,680]]]
      .forEach(([[x1,y1],[x2,y2]]) => el('line', { x1: x1*sx, y1: y1*sy, x2: x2*sx, y2: y2*sy, stroke: PALETTE.magenta || PALETTE.pink, 'stroke-width': 1, opacity: 0.3 }, g));
  }
```

(Note: `PALETTE.magenta` is not a key; use `PALETTE.pink` for the diagonals.)

- [ ] Add `buildEva(svg);` to `rebuild` after `buildSpectrum(svg);`.
- [ ] **Controls:** `c-eva-on` checkbox (EVA patterns, default off). **Wire** + **sync** line as for spectrum.
- [ ] **Verify:** enable EVA → orange corner brackets, purple hexes top/bottom-center, magenta crosshairs mid-sides, faint diagonals. Adapts on 9:16 / 1:1.
- [ ] **Commit:** `feat(bg-gen): add EVA-style pattern layer`

---

### Task 10: Glyphs + phrase band layer (module conversion)

**Files:** Modify `index.html`. **Converts** the inline `<script>` to `<script type="module">`, imports phrase pools, exposes `window.runSelfCheck`. **Adds** `DEFAULT_LAYERS.glyphs = { on:false, color:'#1a1430', nsfw:false, showPhrase:true, phrase:'' }`, `buildGlyphs(svg)`, call in `rebuild` (after `buildSparkles`), controls + listeners, sync line.

- [ ] **Top of script:** change `<script>` → `<script type="module">` and add at the very top:

```js
  import { LEWD_PHRASES_SFW, LEWD_PHRASES_NSFW } from '../thumbnail-generator/js/lewd-frame.js';
  function rollPhrase(nsfw) {
    const pool = nsfw ? LEWD_PHRASES_NSFW : LEWD_PHRASES_SFW;
    return pool[Math.floor(Math.random() * pool.length)];
  }
```

- [ ] **Builder** (after `buildSparkles`):

```js
  function buildGlyphs(svg) {
    const L = state.layers.glyphs;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const gs = Math.min(w, h) * 0.06;
    el('text', { x: w * 0.04, y: h * 0.10, 'font-size': gs, fill: L.color, 'font-family': 'Georgia, serif' }, g, '⚠');
    el('text', { x: w * 0.92, y: h * 0.96, 'font-size': gs, fill: L.color, 'font-family': 'Georgia, serif' }, g, '◈');
    if (L.showPhrase) {
      const phrase = L.phrase || rollPhrase(L.nsfw);
      el('text', {
        x: w / 2, y: h * 0.92, 'text-anchor': 'middle',
        'font-family': "'Courier New', monospace", 'font-size': Math.min(w, h) * 0.028,
        'letter-spacing': '0.15em', fill: L.color, opacity: 0.85,
      }, g, phrase);
    }
  }
```

- [ ] Add `buildGlyphs(svg);` to `rebuild` after `buildSparkles(svg);`.
- [ ] **At the bottom boot block**, add `window.runSelfCheck = runSelfCheck;` before the `?selftest` check (so the module's function is reachable for debugging).
- [ ] **Controls** (new group "Glyphs + phrase"): `c-gl-on` (default off), `c-gl-color` (color), `c-gl-nsfw` (checkbox NSFW, default off), `c-gl-phrase-on` (checkbox Show phrase, default on), and a `c-gl-roll` button (🎲 new phrase).
- [ ] **Wire:**

```js
    $('c-gl-on').addEventListener('change', e => { state.layers.glyphs.on = e.target.checked; rebuild(); });
    $('c-gl-color').addEventListener('input', e => { state.layers.glyphs.color = e.target.value; rebuild(); });
    $('c-gl-nsfw').addEventListener('change', e => { state.layers.glyphs.nsfw = e.target.checked; state.layers.glyphs.phrase = ''; rebuild(); });
    $('c-gl-phrase-on').addEventListener('change', e => { state.layers.glyphs.showPhrase = e.target.checked; rebuild(); });
    $('c-gl-roll').addEventListener('click', () => { state.layers.glyphs.phrase = rollPhrase(state.layers.glyphs.nsfw); rebuild(); });
```

- [ ] **Sync lines:** `$('c-gl-on').checked = L.glyphs.on; $('c-gl-color').value = L.glyphs.color; $('c-gl-nsfw').checked = L.glyphs.nsfw; $('c-gl-phrase-on').checked = L.glyphs.showPhrase;`
- [ ] **Verify (controller):** because this is now an ES module served over http, load via the running server (file:// would break the import). `?selftest=1` → `SELFTEST PASS (4 checks)`. Enable Glyphs → ⚠/◈ corners + a monospace phrase; toggle NSFW → phrase pool changes; 🎲 new phrase re-rolls.
- [ ] **Commit:** `feat(bg-gen): add glyph + phrase band layer (SFW/NSFW), convert to module`

---

### Task 11: Screen-FX layer group (glitch, scanlines+vignette, noise)

**Files:** Modify `index.html`. **Adds** `DEFAULT_LAYERS.glitch = { on:false }`, `scanlines = { on:false }`, `noise = { on:false }`; builders `buildGlitch`, `buildScanlines`, `buildNoise`; calls in `rebuild` (in that order, after `buildLogo`); a "Screen FX" control group with three checkboxes; wiring; sync lines.

- [ ] **Builders** (after `buildLogo`):

```js
  function buildGlitch(svg) {
    const L = state.layers.glitch;
    if (!L.on) return;
    const { w, h } = dims();
    const g = el('g', {}, svg);
    const slices = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < slices; i++) {
      const y = Math.random() * h, bh = h * (0.01 + Math.random() * 0.03), off = w * 0.01 * (1 + Math.random() * 2);
      el('rect', { x: -off, y, width: w, height: bh, fill: PALETTE.cyan, opacity: 0.45 }, g);
      el('rect', { x: off, y: y + bh * 0.3, width: w, height: bh, fill: PALETTE.red, opacity: 0.4 }, g);
    }
  }
  function buildScanlines(svg) {
    const L = state.layers.scanlines;
    if (!L.on) return;
    const { w, h } = dims();
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'scan', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: 0, y: 0, width: 4, height: 1, fill: PALETTE.cyan, opacity: 0.06 }, pat);
    el('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#scan)' }, svg);
    const vig = el('radialGradient', { id: 'vig', cx: '50%', cy: '50%', r: '75%' }, defs);
    el('stop', { offset: '55%', 'stop-color': 'rgba(0,0,0,0)' }, vig);
    el('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,0.55)' }, vig);
    el('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#vig)' }, svg);
  }
  function buildNoise(svg) {
    const L = state.layers.noise;
    if (!L.on) return;
    const { w, h } = dims();
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'noisef' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', stitchTiles: 'stitch' }, f);
    el('feColorMatrix', { type: 'saturate', values: '0' }, f);
    el('rect', { x: 0, y: 0, width: w, height: h, filter: 'url(#noisef)', opacity: 0.08 }, svg);
  }
```

- [ ] Add to `rebuild` after `buildLogo(svg);`: `buildGlitch(svg); buildScanlines(svg); buildNoise(svg);`
- [ ] **Controls** (group "Screen FX"): `c-fx-glitch`, `c-fx-scan`, `c-fx-noise` checkboxes (all default off).
- [ ] **Wire:**

```js
    $('c-fx-glitch').addEventListener('change', e => { state.layers.glitch.on = e.target.checked; rebuild(); });
    $('c-fx-scan').addEventListener('change', e => { state.layers.scanlines.on = e.target.checked; rebuild(); });
    $('c-fx-noise').addEventListener('change', e => { state.layers.noise.on = e.target.checked; rebuild(); });
```

- [ ] **Sync lines:** `$('c-fx-glitch').checked = L.glitch.on; $('c-fx-scan').checked = L.scanlines.on; $('c-fx-noise').checked = L.noise.on;`
- [ ] **Verify:** toggle each FX on/off; confirm glitch slices, scanline+vignette darkening, and grain texture render and stack. `?selftest=1` still passes.
- [ ] **Commit:** `feat(bg-gen): add screen-FX layers (glitch, scanlines+vignette, noise)`

---

### Task 12: Randomize v2 (supersedes Task 6) + export-filename nsfw suffix

**Files:** Modify `index.html`. **Adds** `pick(arr)` (if not present), `randomize()` covering all layers + a random theme, button + wiring; updates `exportCurrent`/`exportAll` filenames with `_nsfw` when glyph nsfw layer is on.

- [ ] **Add `pick` + `randomize`** (before `runSelfCheck`):

```js
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomize() {
    applyTheme(pick(['lavender', 'corrupted', 'abyss', 'succubus']));
    const L = state.layers;
    const corners = ['tl', 'tr', 'bl', 'br'].sort(() => Math.random() - 0.5);
    L.halftone.spread = pick(['corner', 'edge-fade', 'full-field']);
    L.halftone.corners = corners.slice(0, 1 + Math.floor(Math.random() * 2));
    L.sparkles.corners = corners.slice(2);
    L.halftone.density = pick(['low', 'med', 'high']);
    L.sparkles.count = 4 + Math.floor(Math.random() * 6);
    L.spectrum.on = Math.random() < 0.5;
    L.eva.on = Math.random() < 0.5;
    L.glyphs.on = Math.random() < 0.6;
    L.glyphs.phrase = '';
    L.scanlines.on = Math.random() < 0.5;
    L.noise.on = Math.random() < 0.6;
    L.glitch.on = Math.random() < 0.35;
    syncControls(); rebuild();
  }
```

(`applyTheme` already calls `syncControls()`+`rebuild()`; the trailing calls
re-sync after the extra randomization — harmless and keeps inputs correct.)

- [ ] **Update export filenames** in `exportCurrent` and `exportAll`: build the name as
`` `bg_${state.layers.base.style}${state.layers.glyphs && state.layers.glyphs.on && state.layers.glyphs.nsfw ? '_nsfw' : ''}_${w}x${h}.png` ``.
- [ ] **Button** (in Export group): `<div class="ctl-row"><button id="c-randomize" class="secondary">🎲 Randomize variant</button></div>`
- [ ] **Wire:** `$('c-randomize').addEventListener('click', () => randomize());` and ensure `syncControls();` is called once at boot before `rebuild();`.
- [ ] **Verify:** Randomize repeatedly → theme, layers, FX, spread all change and inputs track; export filename gains `_nsfw` only when the NSFW glyph layer is enabled. `?selftest=1` passes.
- [ ] **Commit:** `feat(bg-gen): randomize-all-layers variant + nsfw export suffix`

---

## v2 Self-Review

- Halftone spread (corner/edge-fade/full-field) → Task 7. ✓
- Theme presets recolor all layers → Task 7 (`THEMES`/`applyTheme`). ✓
- Extended palette → Task 7. ✓
- Spectrum bars (tts-bot gradient) → Task 8. ✓
- EVA patterns (exact coords) → Task 9. ✓
- Glyphs + lewd/NSFW phrases (lewd-frame import, nsfw toggle) → Task 10. ✓
- Screen FX scanlines+vignette / glitch / noise → Task 11. ✓
- Randomize covering all + nsfw export suffix → Task 12. ✓
- `syncControls` introduced in Task 7, extended additively per layer (each task
  adds the control AND its sync line together — no reference to absent elements). ✓
- Module conversion isolated to Task 10 (first import need); `window.runSelfCheck`
  preserved; served over http so the import resolves. ✓
- z-order documented; each builder reads only its own layer entry. ✓
