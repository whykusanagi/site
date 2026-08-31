# NIKKE Warning-Screen Foreground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a NIKKE-style warning-screen as a new selectable foreground in the thumbnail generator (`__WARNING__` option in the Character / Video dropdown), with two skewed hazard-stripe banners sandwiching an editable boss name and threat-classification subline, recolored to the project's corruption palette.

**Architecture:** Pure HTML/CSS overlay (no canvas, no SVG, no images). New `#warning-overlay` div with four editable text spans. New `css/warning-overlay.css` stylesheet for banner geometry, stripes, typography, pulse animation, and control-panel visibility. New `__WARNING__` branch in `setCharacterImage()` parallel to `__VIDEO__` and `__CUSTOM__`. State piggybacks on existing `getCurrentState()` / `loadState()` pipeline.

**Tech Stack:** Vanilla JS in inline `<script>`, plain CSS, html2canvas (existing dependency); no build step. System fonts only (`Impact`, `Arial Black`, `Courier New`) — no webfont fetch, html2canvas-safe.

**Reference spec:** `docs/superpowers/specs/2026-05-04-warning-screen-foreground-design.md`

---

## File-touch map

- `tools/thumbnail-generator/css/warning-overlay.css` — *new* — all warning-frame styling.
- `tools/thumbnail-generator/index.html` — *modified*:
  - `<head>`: link the new stylesheet.
  - `<body>`: new `<div id="warning-overlay">` near `#celeste-image`.
  - Control panel: new `__WARNING__` option in `#character-select`; new Warning sub-panel.
  - Inline `<script>`: `WARNING_DEFAULTS` const + `warningState` + `setWarningField()` + `resetWarningFields()` + `__WARNING__` branch in `setCharacterImage()` + hooks in `getCurrentState()` and `loadState()`.
  - `onclone` callback in `exportThumbnail()`: warning-overlay font scaling.

---

## Task 1: Branch + new stylesheet scaffold

**Files:**
- Create: `tools/thumbnail-generator/css/warning-overlay.css`
- Modify: `tools/thumbnail-generator/index.html` (`<head>` link)

- [ ] **Step 1: Create the feature branch**

```bash
cd ~/Development/site
git checkout main
git pull origin main
git checkout -b feature/thumbnail-warning-screen
```

- [ ] **Step 2: Create the empty stylesheet**

Write `tools/thumbnail-generator/css/warning-overlay.css` with this exact content:

```css
/* warning-overlay.css — NIKKE-style warning-screen foreground.
 * Activated when #thumbnail-container > #warning-overlay is visible
 * (toggled by setCharacterImage('__WARNING__') in index.html).
 *
 * Color tokens reuse the project's corruption palette:
 *   stripe dark   #0a0613
 *   stripe accent #ff82d9 (magenta from stage-themes.js BASE)
 *   boss-name     #ff82d9 with violet glow
 *   threat        #f7d6ff
 */

/* Styles added in subsequent tasks. */
```

- [ ] **Step 3: Link the stylesheet from `index.html`**

In `tools/thumbnail-generator/index.html`, find the existing line:

```html
    <link rel="stylesheet" href="css/seamless-background.css">
```

Add immediately below it:

```html
    <link rel="stylesheet" href="css/warning-overlay.css">
```

- [ ] **Step 4: Verify the file loads (no errors expected — it's empty)**

```bash
cd ~/Development/site
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/tools/thumbnail-generator/css/warning-overlay.css | head -3
kill $SERVER_PID 2>/dev/null
```

Expected: `HTTP/1.0 200 OK`, content-type `text/css`.

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/css/warning-overlay.css tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): scaffold warning-overlay stylesheet"
```

---

## Task 2: HTML scaffold for the warning overlay

**Files:**
- Modify: `tools/thumbnail-generator/index.html`

- [ ] **Step 1: Add the `#warning-overlay` div**

In `tools/thumbnail-generator/index.html`, find:

```html
        <!-- Celeste Static Illustration (Fallback - shown by default) -->
        <img id="celeste-image" src="https://s3.whykusanagi.xyz/tools/thumbnail-generator/assets/characters/Celeste_Legs.png" alt="Celeste" crossorigin="anonymous">
```

Insert this block **immediately after** that `<img>` line:

```html

        <!-- NIKKE Warning Screen Foreground (hidden by default; shown when character = __WARNING__) -->
        <div id="warning-overlay" aria-hidden="true">
            <div class="warning-banner warning-banner-top">
                <span class="warning-banner-text" id="warning-top">WARNING</span>
            </div>
            <div class="warning-boss" id="warning-boss">CELESTEAI</div>
            <div class="warning-threat" id="warning-threat">CORRUPTION DETECTED &gt;&gt; EXTREME DANGER</div>
            <div class="warning-banner warning-banner-bottom">
                <span class="warning-banner-text" id="warning-bottom">CORRUPTED</span>
            </div>
        </div>
```

- [ ] **Step 2: Add the `__WARNING__` option to the character dropdown**

In `tools/thumbnail-generator/index.html`, find:

```html
                    <select id="character-select" class="control-input" onchange="setCharacterImage(this.value)">
                        <option value="__VIDEO__">🎬 Video (Celeste Legs Animation)</option>
                        <option value="__CUSTOM__">📁 Custom (upload local file)</option>
```

Insert this option **immediately after** the `__CUSTOM__` line:

```html
                        <option value="__WARNING__">⚠️ NIKKE Warning Screen</option>
```

- [ ] **Step 3: Verify the markup parses (no JS yet — overlay should not visually exist because no CSS yet)**

Open `http://localhost:8000/tools/thumbnail-generator/` in a browser. Expected: page loads normally, dropdown shows the new ⚠️ entry, no console errors. The `#warning-overlay` is in the DOM (verify via DevTools) but invisible because no width/height/positioning is defined yet.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): add warning-overlay HTML scaffold + dropdown option"
```

---

## Task 3: CSS — overlay container + banner geometry

**Files:**
- Modify: `tools/thumbnail-generator/css/warning-overlay.css`

- [ ] **Step 1: Append container + banner geometry rules**

Append the following to `tools/thumbnail-generator/css/warning-overlay.css`:

```css

/* ===== OVERLAY CONTAINER ===== */
/* Positioned in the same slot as #celeste-image — full canvas height,
 * centered horizontally. Hidden by default; toggled to display:flex by
 * setCharacterImage('__WARNING__'). */

#warning-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 90; /* same as #celeste-image */
    pointer-events: none;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 0;
    overflow: hidden;
}

#warning-overlay.active {
    display: flex;
}

/* ===== BANNER GEOMETRY ===== */
/* Two skewed hazard-stripe bands sandwiching the boss content. */

.warning-banner {
    position: relative;
    width: 110%; /* overshoot canvas edges so skew doesn't expose corners */
    height: 140px;
    transform: skewX(-12deg);
    background: repeating-linear-gradient(
        135deg,
        #0a0613 0px,
        #0a0613 24px,
        #ff82d9 24px,
        #ff82d9 36px
    );
    box-shadow:
        0 0 24px rgba(255, 130, 217, 0.55),
        inset 0 0 0 4px rgba(10, 6, 19, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.warning-banner-text {
    /* Counter-rotate so text reads straight while the bar stays slanted. */
    transform: skewX(12deg);
    font-family: Impact, "Arial Black", sans-serif;
    font-weight: 900;
    font-size: 96px;
    letter-spacing: 12px;
    color: #fff5fb;
    text-shadow:
        0 0 6px rgba(10, 6, 19, 0.85),
        0 0 18px rgba(255, 130, 217, 0.95),
        0 0 36px rgba(139, 92, 246, 0.7);
    white-space: nowrap;
    padding: 0 32px;
    background: rgba(10, 6, 19, 0.55);
    border-radius: 4px;
}
```

- [ ] **Step 2: Smoke test — temporarily activate the overlay**

Open `http://localhost:8000/tools/thumbnail-generator/` in DevTools. In the console, run:

```javascript
document.getElementById('warning-overlay').classList.add('active');
```

Expected: two diagonal hazard-stripe banners appear, each with its label (`WARNING` and `CORRUPTED`) reading horizontally despite the skewed bars. Boss name and threat appear between as plain unstyled text (we'll style those next). Page edges don't show ugly skew gaps.

Reset by running `document.getElementById('warning-overlay').classList.remove('active');`.

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/css/warning-overlay.css
git commit -m "feat(thumbnail-generator): add warning banner geometry + hazard stripes"
```

---

## Task 4: CSS — boss name + threat typography + pulse animation

**Files:**
- Modify: `tools/thumbnail-generator/css/warning-overlay.css`

- [ ] **Step 1: Append typography + animation rules**

Append the following to `tools/thumbnail-generator/css/warning-overlay.css`:

```css

/* ===== BOSS NAME ===== */

.warning-boss {
    font-family: Impact, "Arial Black", sans-serif;
    font-weight: 900;
    font-size: 220px;
    line-height: 1;
    letter-spacing: 8px;
    color: #ff82d9;
    text-shadow:
        0 0 12px rgba(139, 92, 246, 0.85),
        0 0 24px rgba(255, 130, 217, 0.55),
        0 0 64px rgba(255, 130, 217, 0.35);
    text-align: center;
    text-transform: uppercase;
    white-space: nowrap;
    margin: 0;
}

/* ===== THREAT CLASSIFICATION ===== */

.warning-threat {
    font-family: "Courier New", monospace;
    font-weight: 700;
    font-size: 48px;
    letter-spacing: 4px;
    color: #f7d6ff;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 130, 217, 0.6);
    padding: 8px 24px;
    background: rgba(10, 6, 19, 0.6);
    border-top: 1px solid rgba(255, 130, 217, 0.35);
    border-bottom: 1px solid rgba(255, 130, 217, 0.35);
}

/* ===== PULSE ANIMATION ===== */
/* Live preview only — html2canvas freezes whatever frame is showing. */

@keyframes warning-banner-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.85; }
}

.warning-banner {
    animation: warning-banner-pulse 1.4s ease-in-out infinite;
}

.warning-banner-bottom {
    animation-delay: 0.7s; /* offset so the two banners breathe out of sync */
}
```

- [ ] **Step 2: Smoke test — re-activate the overlay and verify**

In DevTools console:

```javascript
document.getElementById('warning-overlay').classList.add('active');
```

Expected: full warning frame now visible — top banner with hazard stripes + WARNING text, huge magenta `CELESTEAI` boss name with violet glow, `CORRUPTION DETECTED >> EXTREME DANGER` threat line in monospace, bottom banner with `CORRUPTED`. Banners pulse subtly out of sync.

Reset.

- [ ] **Step 3: Commit**

```bash
git add tools/thumbnail-generator/css/warning-overlay.css
git commit -m "feat(thumbnail-generator): add warning boss name + threat typography + pulse animation"
```

---

## Task 5: JS — warning state + setters

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (inline `<script>`)

- [ ] **Step 1: Find the insertion anchor**

In `tools/thumbnail-generator/index.html`, locate the existing line:

```javascript
        // Slot for an in-memory user-uploaded character image. Same lifecycle as
        // customBgDataUrl — never uploaded, gone on reload.
        let customCharacterDataUrl = null;
```

The new warning system goes immediately above that comment block.

- [ ] **Step 2: Insert the warning state + setters block**

Insert this block immediately **before** the `// Slot for an in-memory user-uploaded character image.` comment:

```javascript

        // ---- Warning-screen foreground system ---------------------------
        const WARNING_DEFAULTS = Object.freeze({
            topBanner:    'WARNING',
            bossName:     'CELESTEAI',
            threat:       'CORRUPTION DETECTED >> EXTREME DANGER',
            bottomBanner: 'CORRUPTED',
        });

        const warningState = { ...WARNING_DEFAULTS };

        const WARNING_FIELD_TO_ELEMENT_ID = {
            topBanner:    'warning-top',
            bossName:     'warning-boss',
            threat:       'warning-threat',
            bottomBanner: 'warning-bottom',
        };

        function setWarningField(fieldKey, value) {
            if (!(fieldKey in WARNING_DEFAULTS)) {
                console.warn('Unknown warning field:', fieldKey, '— ignoring');
                return;
            }
            warningState[fieldKey] = value;
            const elId = WARNING_FIELD_TO_ELEMENT_ID[fieldKey];
            const el = document.getElementById(elId);
            if (el) el.textContent = value;
            saveState();
        }

        function resetWarningFields() {
            for (const key of Object.keys(WARNING_DEFAULTS)) {
                setWarningField(key, WARNING_DEFAULTS[key]);
            }
            // Sync the input controls (created in Task 7) to the defaults.
            const inputs = {
                topBanner:    document.getElementById('warning-top-input'),
                bossName:     document.getElementById('warning-boss-input'),
                threat:       document.getElementById('warning-threat-input'),
                bottomBanner: document.getElementById('warning-bottom-input'),
            };
            for (const [key, input] of Object.entries(inputs)) {
                if (input) input.value = WARNING_DEFAULTS[key];
            }
            console.log('🔄 Warning fields reset to defaults');
        }

        // Expose for inline oninput / onclick handlers added in Task 7.
        window.setWarningField = setWarningField;
        window.resetWarningFields = resetWarningFields;
        // -----------------------------------------------------------------
```

- [ ] **Step 3: Smoke test — call setter from console**

Refresh the page. In DevTools console:

```javascript
document.getElementById('warning-overlay').classList.add('active');
setWarningField('bossName', 'TEST.EXE');
setWarningField('topBanner', 'BREACH');
```

Expected: boss name updates to `TEST.EXE`, top banner text updates to `BREACH`, no errors logged. Reset by `resetWarningFields()`.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): add warningState + setWarningField + resetWarningFields"
```

---

## Task 6: JS — `__WARNING__` branch in `setCharacterImage`

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (inline `<script>`, inside `setCharacterImage`)

- [ ] **Step 1: Locate the existing `__CUSTOM__` branch**

In `tools/thumbnail-generator/index.html`, find this existing block inside `setCharacterImage`:

```javascript
            // Handle custom-upload mode
            if (filename === '__CUSTOM__') {
                if (selectElement && selectElement.value !== '__CUSTOM__') {
                    selectElement.value = '__CUSTOM__';
                }
                if (customFileInput) customFileInput.style.display = 'block';
```

The new `__WARNING__` branch goes **immediately before** that `// Handle custom-upload mode` comment.

- [ ] **Step 2: Insert the `__WARNING__` branch**

Insert the following block right above `// Handle custom-upload mode`:

```javascript
            // Handle warning-screen mode
            if (filename === '__WARNING__') {
                if (selectElement && selectElement.value !== '__WARNING__') {
                    selectElement.value = '__WARNING__';
                }
                if (customFileInput) customFileInput.style.display = 'none';

                // Hide static image and video canvas; show warning overlay.
                celesteImg.style.display = 'none';
                celesteCanvas.style.display = 'none';
                const overlay = document.getElementById('warning-overlay');
                if (overlay) overlay.classList.add('active');

                // Reveal the Warning Screen sub-panel (added in Task 7).
                const subPanel = document.getElementById('warning-controls-section');
                if (subPanel) subPanel.style.display = 'block';

                // Re-apply current warningState in case the DOM was just shown.
                for (const key of Object.keys(WARNING_DEFAULTS)) {
                    setWarningField(key, warningState[key]);
                }

                console.log('⚠️ Switched to warning-screen foreground');
                saveState();
                return;
            }

```

- [ ] **Step 3: Hide overlay + sub-panel when leaving warning mode**

In the same `setCharacterImage` function, find the `__VIDEO__` branch:

```javascript
            // Handle video mode
            if (filename === '__VIDEO__') {
                if (selectElement && selectElement.value !== '__VIDEO__') {
                    selectElement.value = '__VIDEO__';
                }
                if (customFileInput) customFileInput.style.display = 'none';
```

**Append** these two lines immediately after the `if (customFileInput) ...` line (still inside the `__VIDEO__` branch):

```javascript
                const overlay = document.getElementById('warning-overlay');
                if (overlay) overlay.classList.remove('active');
                const subPanel = document.getElementById('warning-controls-section');
                if (subPanel) subPanel.style.display = 'none';
```

In the `__CUSTOM__` branch, find:

```javascript
            if (filename === '__CUSTOM__') {
                if (selectElement && selectElement.value !== '__CUSTOM__') {
                    selectElement.value = '__CUSTOM__';
                }
                if (customFileInput) customFileInput.style.display = 'block';
```

**Append** these two lines immediately after the `if (customFileInput) ...` line (still inside the `__CUSTOM__` branch):

```javascript
                const overlay = document.getElementById('warning-overlay');
                if (overlay) overlay.classList.remove('active');
                const subPanel = document.getElementById('warning-controls-section');
                if (subPanel) subPanel.style.display = 'none';
```

In the static-image branch (the code after both `__VIDEO__` and `__CUSTOM__` and `__WARNING__` short-circuits), find:

```javascript
            // Show static image, hide video canvas
            celesteImg.style.display = 'block';
            celesteCanvas.style.display = 'none';
            if (customFileInput) customFileInput.style.display = 'none';
```

**Append** these two lines immediately after the `if (customFileInput) ...` line:

```javascript
            const _warningOverlay = document.getElementById('warning-overlay');
            if (_warningOverlay) _warningOverlay.classList.remove('active');
            const _warningSubPanel = document.getElementById('warning-controls-section');
            if (_warningSubPanel) _warningSubPanel.style.display = 'none';
```

- [ ] **Step 4: Smoke test — switch via the dropdown**

Refresh `http://localhost:8000/tools/thumbnail-generator/`. In the **Character / Video** dropdown, pick `⚠️ NIKKE Warning Screen`. Expected: warning frame renders in the canvas (banners + boss name + threat). Switch to `Celeste Legs (Original Static)` — expected: warning frame disappears, static character image returns. Switch to `__VIDEO__` — expected: warning still hidden, video starts. Switch back to warning — expected: warning frame returns instantly with the cached state values. Console logs `⚠️ Switched to warning-screen foreground` on each entry.

- [ ] **Step 5: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): __WARNING__ branch in setCharacterImage + clean show/hide"
```

---

## Task 7: HTML — Warning sub-panel of controls

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (control panel)

- [ ] **Step 1: Find the insertion anchor in the control panel**

In `tools/thumbnail-generator/index.html`, locate the existing custom-character file input (added in a prior commit):

```html
                    </select>
                    <input type="file" id="custom-character-file" accept="image/*" style="display: none; margin-top: 8px;" onchange="loadCustomCharacterFile(this.files[0])">

                    <div class="control-label" style="margin-top: 10px;">Glow Color:</div>
```

The Warning sub-panel goes between the `<input type="file">` line and the `Glow Color:` label.

- [ ] **Step 2: Insert the Warning Screen sub-panel block**

Insert this block immediately **before** the `<div class="control-label" style="margin-top: 10px;">Glow Color:</div>` line:

```html

                    <!-- Warning Screen sub-panel — visible only when character = __WARNING__ -->
                    <div id="warning-controls-section" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255, 130, 217, 0.4);">
                        <div class="control-label" style="color: #ff82d9;">⚠️ Warning Screen Text:</div>

                        <div class="control-label" style="margin-top: 8px;">Top Banner:</div>
                        <input type="text" id="warning-top-input" class="control-input" value="WARNING"
                               oninput="setWarningField('topBanner', this.value)">

                        <div class="control-label" style="margin-top: 8px;">Boss Name:</div>
                        <input type="text" id="warning-boss-input" class="control-input" value="CELESTEAI"
                               oninput="setWarningField('bossName', this.value)">

                        <div class="control-label" style="margin-top: 8px;">Threat:</div>
                        <input type="text" id="warning-threat-input" class="control-input" value="CORRUPTION DETECTED &gt;&gt; EXTREME DANGER"
                               oninput="setWarningField('threat', this.value)">

                        <div class="control-label" style="margin-top: 8px;">Bottom Banner:</div>
                        <input type="text" id="warning-bottom-input" class="control-input" value="CORRUPTED"
                               oninput="setWarningField('bottomBanner', this.value)">

                        <div style="text-align: center; margin-top: 10px;">
                            <button class="control-button" onclick="resetWarningFields()">↻ Reset to defaults</button>
                        </div>
                    </div>
```

- [ ] **Step 3: Smoke test — sub-panel visibility + live edit**

Refresh the page. Pick `⚠️ NIKKE Warning Screen` from the character dropdown. Expected: the Warning Screen sub-panel appears in the control panel with four pre-filled inputs and a Reset button. Type `BREACH` in the Top Banner input — expected: top banner text updates live as you type. Click Reset — expected: all four inputs revert to defaults and overlay text follows. Switch character to anything else — expected: sub-panel hides.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): add Warning Screen sub-panel of controls"
```

---

## Task 8: State persistence

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (inline `<script>`, `getCurrentState` + `loadState`)

- [ ] **Step 1: Add `warningScreen` to `getCurrentState`**

Find the existing `getCurrentState()` return object (search for `characterImage: getCurrentCharacterImage()`):

```javascript
            return {
                title,
                subtitle,
                celesteMode,
                celesteVideoY: Math.round(celesteVideoY * 10) / 10,
                celesteVideoSize,
                subjectUrl,
                subjectSize,
                subjectPosition,
                characterImage: getCurrentCharacterImage(),
                characterSize: parseInt(document.getElementById('char-size-slider')?.value) || DEFAULT_CHARACTER_SIZE,
                characterY: parseInt(document.getElementById('char-y-slider')?.value) || DEFAULT_CHARACTER_Y,
                glowColor: getCurrentGlowColor(),
```

Add `warningScreen: { ...warningState },` immediately after the `characterImage:` line so the return object becomes:

```javascript
            return {
                title,
                subtitle,
                celesteMode,
                celesteVideoY: Math.round(celesteVideoY * 10) / 10,
                celesteVideoSize,
                subjectUrl,
                subjectSize,
                subjectPosition,
                characterImage: getCurrentCharacterImage(),
                warningScreen: { ...warningState },
                characterSize: parseInt(document.getElementById('char-size-slider')?.value) || DEFAULT_CHARACTER_SIZE,
                characterY: parseInt(document.getElementById('char-y-slider')?.value) || DEFAULT_CHARACTER_Y,
                glowColor: getCurrentGlowColor(),
```

(Order otherwise unchanged — only the one new line is inserted.)

- [ ] **Step 2: Apply `state.warningScreen` in `loadState`**

In `loadState()`, find:

```javascript
                // Load character image if present
                if (state.characterImage) {
                    setCharacterImage(state.characterImage);
                }
```

Insert this block **immediately before** the `// Load character image if present` comment:

```javascript
                // Restore warning-screen field values (if saved). Apply BEFORE
                // setCharacterImage so __WARNING__ activation reads the right state.
                if (state.warningScreen && typeof state.warningScreen === 'object') {
                    for (const key of Object.keys(WARNING_DEFAULTS)) {
                        if (typeof state.warningScreen[key] === 'string') {
                            warningState[key] = state.warningScreen[key];
                            const input = document.getElementById({
                                topBanner:    'warning-top-input',
                                bossName:     'warning-boss-input',
                                threat:       'warning-threat-input',
                                bottomBanner: 'warning-bottom-input',
                            }[key]);
                            if (input) input.value = warningState[key];
                            const overlayEl = document.getElementById(WARNING_FIELD_TO_ELEMENT_ID[key]);
                            if (overlayEl) overlayEl.textContent = warningState[key];
                        }
                    }
                }

```

- [ ] **Step 3: Smoke test — round-trip via reload**

Refresh the page. Pick `⚠️ NIKKE Warning Screen`. Edit all four fields to custom values (e.g., `ALERT` / `RAMPANT.CORE` / `SYNC FAILURE >> ABYSS BREACH` / `RAMPANT`). Refresh the page. Expected: dropdown still shows ⚠️ NIKKE Warning Screen, all four inputs show the custom values, overlay renders with custom text. Switch to a static character, switch back to warning — expected: custom values still in memory.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): persist warningScreen via getCurrentState + loadState"
```

---

## Task 9: Export — onclone font scaling for warning overlay

**Files:**
- Modify: `tools/thumbnail-generator/index.html` (inline `<script>`, `onclone` callback)

- [ ] **Step 1: Find the existing main-title font-scaling block**

In `tools/thumbnail-generator/index.html`, find this existing block inside the `onclone` callback of `html2canvas` (search for `originalMainTitle`):

```javascript
                        // Fix text rendering — scale font for narrower aspect ratios
                        const originalMainTitle = document.getElementById('main-title');
                        const mainTitle = clonedDoc.getElementById('main-title');
                        if (mainTitle && originalMainTitle) {
                            const computedStyle = window.getComputedStyle(originalMainTitle);
                            const baseFontSize = parseFloat(computedStyle.fontSize);
                            mainTitle.style.fontSize = `${baseFontSize * fontScale}px`;
                            mainTitle.style.fontWeight = computedStyle.fontWeight;
                            mainTitle.style.fontFamily = computedStyle.fontFamily;
                            mainTitle.style.lineHeight = computedStyle.lineHeight;
                            mainTitle.style.letterSpacing = computedStyle.letterSpacing;
                            mainTitle.style.wordSpacing = computedStyle.wordSpacing;
                            mainTitle.style.marginBottom = computedStyle.marginBottom;
                            mainTitle.style.whiteSpace = 'nowrap';
                            mainTitle.style.overflow = 'visible';
                        }
```

The warning-overlay scaling goes **immediately after** that block.

- [ ] **Step 2: Insert the warning-overlay font-scaling block**

Insert this block right after the closing `}` of the `if (mainTitle && originalMainTitle) { ... }` above:

```javascript

                        // Scale fonts on warning-overlay children (parallel to main-title scaling).
                        // Each warning element gets the same fontScale treatment so non-16:9 aspect
                        // ratios render proportionally.
                        const warningElementIds = [
                            'warning-top',
                            'warning-boss',
                            'warning-threat',
                            'warning-bottom',
                        ];
                        for (const elId of warningElementIds) {
                            const original = document.getElementById(elId);
                            const cloned = clonedDoc.getElementById(elId);
                            if (cloned && original) {
                                const cs = window.getComputedStyle(original);
                                const baseSize = parseFloat(cs.fontSize);
                                cloned.style.fontSize = `${baseSize * fontScale}px`;
                                cloned.style.fontFamily = cs.fontFamily;
                                cloned.style.fontWeight = cs.fontWeight;
                                cloned.style.letterSpacing = cs.letterSpacing;
                                cloned.style.lineHeight = cs.lineHeight;
                                cloned.style.color = cs.color;
                                cloned.style.textShadow = cs.textShadow;
                                cloned.style.whiteSpace = 'nowrap';
                            }
                        }
```

- [ ] **Step 3: Smoke test — export at 16:9 and 9:16**

Refresh the page. Pick `⚠️ NIKKE Warning Screen` with default values. Pick a Nikke background (e.g., `dragon-cinder`). Click **📸 Export PNG**. Inspect the resulting PNG: 1920×1080, hazard stripes crisp, banner skew correct, boss name + threat readable, glow rendered, sits on top of the dragon-cinder background.

Now switch Aspect Ratio to **9:16 (1080x1920)**. Click **📸 Export PNG**. Inspect: portrait PNG, fonts scaled down proportionally, no clipping or oversized text.

- [ ] **Step 4: Commit**

```bash
git add tools/thumbnail-generator/index.html
git commit -m "feat(thumbnail-generator): warning-overlay font scaling in html2canvas onclone"
```

---

## Task 10: Composability + final smoke test

**Files:** none (validation only)

- [ ] **Step 1: Compose with each background**

Refresh. Set foreground to `⚠️ NIKKE Warning Screen`. Cycle through every Background option:

- Seamless Pattern
- Nikke City — Corruption
- Nikke City — Dragon Cinder
- Nikke City — Leviathan Abyss
- Nikke City — Colossus Gold
- Nikke City — Tyrant Crimson
- Nikke City — Behemoth Void
- Nikke City — Serpent Emerald
- Custom (upload local file)

Expected: warning overlay renders cleanly on top of each background. No clipping, no z-index conflicts, no banner geometry breakage.

- [ ] **Step 2: Compose with title/subtitle**

With warning active and `dragon-cinder` background:

- Type a title (e.g., `STREAM ALERT`), Apply. Expected: title still renders bottom-left, doesn't collide with the warning frame.
- Clear both title and subtitle, Apply. Expected: warning frame stands alone over background.
- Type only a subtitle. Expected: subtitle visible, no title.

- [ ] **Step 3: Aspect-ratio sweep**

With warning + `dragon-cinder` background, cycle through every Aspect Ratio:

- 16:9 (1920×1080)
- 2:1 (1920×960)
- 1:1 (1920×1920)
- 4:5 (1920×2400)
- 9:16 (1080×1920)

For each, export PNG and inspect: warning frame visible, fonts scaled, no clipping. Banner stripes still slant correctly even on portrait/square ratios.

- [ ] **Step 4: Reset button + reload sanity**

Hit Reset. Expected: all four inputs back to defaults, overlay text follows. Reload the page. Expected: defaults persist (the Reset wrote them back to localStorage).

- [ ] **Step 5: Switch-away cleanup**

With warning active, switch character to `Celeste Legs (Original Static)`. Expected: warning overlay hides, sub-panel hides, static image returns. Switch to `🎬 Video`. Expected: warning still hidden, video plays. Switch back to warning. Expected: returns to last warning state.

If any step fails, fix and re-run. Do not proceed to Task 11 until all five steps pass.

---

## Task 11: Push to production

**Files:** none (deploy)

- [ ] **Step 1: Final commit if any cleanup was needed during Task 10**

```bash
cd ~/Development/site
git status -s
```

If anything is staged from cleanup, commit it with a descriptive message before proceeding.

- [ ] **Step 2: Fast-forward main**

```bash
cd ~/Development/site
git checkout main
git pull origin main
git merge --ff-only feature/thumbnail-warning-screen
git log --oneline -10
```

Expected: clean fast-forward, main now points at the latest warning-screen commit, no merge commit.

- [ ] **Step 3: Push main (triggers Cloudflare Worker deploy)**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 4: Verify live**

```bash
sleep 8
curl -sI https://whykusanagi.xyz/tools/thumbnail-generator/css/warning-overlay.css | head -5
```

Expected: HTTP/2 200, content-type `text/css`. Cloudflare deployed the new CSS file.

Open `https://whykusanagi.xyz/tools/thumbnail-generator/` in a browser. Pick `⚠️ NIKKE Warning Screen`. Confirm the warning frame renders identically to local.

---

## Out of scope (deliberate, do not implement)

- Phrase-pool randomizer pulling from `NSFW_PHRASES` / `BURST_AURA_PHRASES`. User types their own.
- Boss silhouette / portrait inside the warning frame.
- Pixel-perfect canon match to NIKKE's red-on-black look. Corruption palette only.
- Scanline shaders, glitch distortion, noise overlays, particle bursts. Pulse animation only.
- Custom webfonts. System stack only (Impact / Arial Black / Courier New).
- Per-banner color customization controls in v1. Stripe / accent / glow are fixed.
- Schema-version bumping for `warningScreen` state. Forward-compatibility via key-presence checks in `loadState`.
- Migration of pre-existing localStorage entries. Absent `warningScreen` key falls through to defaults.
- Changes to nikke_game (no source assets needed; this is entirely a generator-side feature).
