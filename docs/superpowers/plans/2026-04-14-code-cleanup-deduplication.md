# Code Cleanup & Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated code and refactor site-overrides.css to compose with corrupted-theme's built-in glass classes instead of re-implementing them.

**Architecture:** Static HTML/CSS/JS site. No build system. CSS loaded via `@import` in `site-overrides.css`. Theme classes come from vendored copy at `assets/css/corrupted-theme/`. HTML pages reference card/container classes that currently hand-roll glassmorphism instead of using the theme's `.glass-card` class.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, @whykusanagi/corrupted-theme 0.1.8

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Delete | `assets/js/corruption-loading.js` | Unused duplicate of `loading.js` |
| Modify | `assets/css/site-overrides.css` | Remove hand-rolled glass properties from 5 selectors, keep only overrides |
| Modify | `references.html` | Add `glass-card` class to `.reference-section` |
| Modify | `privacy.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `refunds.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `terms.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `dmca.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `shipping.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `assets.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `celeste-lore-faq.html` | Add `glass-card` class to `.privacy-container` |
| Modify | `doujin.html` | Add `glass-card` class to `.doujin-card` elements |
| Modify | `tools.html` | Add `glass-card` class to `.tool-card` elements |
| Modify | `wallpapers.html` | Add `glass-card` class to `.wallpaper-card` elements |

---

### Task 1: Remove unused `corruption-loading.js`

**Files:**
- Delete: `assets/js/corruption-loading.js`

**Context:** `loading.js` (434 lines) and `corruption-loading.js` (435 lines) are near-identical (only trailing whitespace diffs). All 36 HTML files reference `loading.js`. Zero HTML files reference `corruption-loading.js`. The unused file should be removed.

- [ ] **Step 1: Verify no references exist**

Run: `grep -r "corruption-loading" --include="*.html" --include="*.js" --include="*.css" .`
Expected: No matches (or only matches in docs/plans)

- [ ] **Step 2: Delete the unused file**

```bash
rm assets/js/corruption-loading.js
```

- [ ] **Step 3: Verify `loading.js` still loads correctly**

Run: `python3 -m http.server 8000` and open http://localhost:8000 in browser.
Expected: Loading animation plays on first visit (or after clearing `corruptionLoadingLastPlayed` from localStorage).

- [ ] **Step 4: Commit**

```bash
git add -A assets/js/corruption-loading.js
git commit -m "chore: remove unused corruption-loading.js (duplicate of loading.js)"
```

---

### Task 2: Refactor CSS card/container styles to use theme's `.glass-card`

**Files:**
- Modify: `assets/css/site-overrides.css:237-248` (`.reference-section`)
- Modify: `assets/css/site-overrides.css:314-333` (`.doujin-card`, `.tool-card`)
- Modify: `assets/css/site-overrides.css:388-399` (`.privacy-container`)
- Modify: `assets/css/site-overrides.css:416-429` (`.wallpaper-card`)

**Context:** The theme provides `.glass-card` in `assets/css/corrupted-theme/components.css:397-411`:

```css
.glass-card {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(217, 79, 144, 0.15),
              inset 0 0 20px rgba(217, 79, 144, 0.05);
  transition: all var(--transition);
}
.glass-card:hover {
  border-color: var(--border-light);
  box-shadow: 0 12px 48px rgba(217, 79, 144, 0.25),
              inset 0 0 20px rgba(217, 79, 144, 0.08);
}
```

Each site selector currently re-implements `background`, `border`, `backdrop-filter`, and `box-shadow` from scratch. After adding `.glass-card` to the HTML elements, the CSS only needs to keep properties that DIFFER from the theme class.

- [ ] **Step 1: Refactor `.reference-section`**

Replace lines 237-248 with:

```css
/* ========== REFERENCE GALLERY ========== */
.reference-section {
  position: relative;
  z-index: 1;
  border-radius: var(--radius-2xl);
  padding: var(--spacing-xl);
  max-width: 1000px;
  margin: 4rem auto 2rem auto;
  box-shadow: 0 0 20px rgba(217, 79, 144, 0.3);
}
```

Removed: `background`, `border`, `backdrop-filter` (provided by `.glass-card`).
Kept: `border-radius: var(--radius-2xl)` (overrides `.glass-card`'s `--radius-lg`), `padding`, `max-width`, `margin`, `box-shadow` (different value from theme), `position`, `z-index`.

- [ ] **Step 2: Refactor `.doujin-card` / `.tool-card`**

Replace lines 314-333 with:

```css
.doujin-card,
.tool-card {
  border-radius: var(--radius-2xl);
  padding: var(--spacing-xl);
  box-shadow: 0 0 20px rgba(217, 79, 144, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.doujin-card:hover,
.tool-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 0 30px rgba(217, 79, 144, 0.4);
}
```

Removed: `background`, `border`, `backdrop-filter`, `transition`, `border-color` on hover (all from `.glass-card`).
Kept: `border-radius` override, `padding`, custom `box-shadow`, layout props (`flex`, `overflow`), custom hover `transform` and `box-shadow`.

- [ ] **Step 3: Refactor `.privacy-container`**

Replace lines 388-399 with:

```css
/* ========== CONTENT PAGES ========== */
.privacy-container {
  position: relative;
  z-index: 1;
  border-radius: var(--radius-2xl);
  padding: var(--spacing-xl);
  max-width: 900px;
  margin: 4rem auto 2rem auto;
  box-shadow: 0 0 20px rgba(217, 79, 144, 0.3);
}
```

Removed: `background`, `border`, `backdrop-filter` (from `.glass-card`).
Kept: `position`, `z-index`, `border-radius` override, `padding`, `max-width`, `margin`, custom `box-shadow`.

- [ ] **Step 4: Refactor `.wallpaper-card`**

Replace lines 416-429 with:

```css
/* ========== WALLPAPER GRID ========== */
.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--spacing-xl);
}

.wallpaper-card {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
}

.wallpaper-card:hover {
  transform: translateY(-4px);
}
```

Removed: `background`, `border`, `border-radius`, `backdrop-filter`, `transition` (all match `.glass-card` defaults).
Kept: `padding` (different from default), layout props, custom hover transform.

- [ ] **Step 5: Commit CSS changes**

```bash
git add assets/css/site-overrides.css
git commit -m "refactor(css): use theme glass-card class, remove hand-rolled glassmorphism"
```

---

### Task 3: Add `.glass-card` class to HTML elements

**Files:**
- Modify: `references.html:90`
- Modify: `privacy.html:42`
- Modify: `refunds.html:42`
- Modify: `terms.html:42`
- Modify: `dmca.html:42`
- Modify: `shipping.html:42`
- Modify: `assets.html:91`
- Modify: `celeste-lore-faq.html:82`
- Modify: `doujin.html:80,93`
- Modify: `tools.html:74,81,88`
- Modify: `wallpapers.html:67,81,95,109,123,137`

- [ ] **Step 1: Update `references.html`**

```html
<!-- Line 90: Add glass-card class -->
<section class="reference-section glass-card">
```

- [ ] **Step 2: Update privacy-style pages**

Each of these files has `<div class="privacy-container">`. Add `glass-card`:

```html
<!-- privacy.html:42, refunds.html:42, terms.html:42, dmca.html:42, shipping.html:42, assets.html:91, celeste-lore-faq.html:82 -->
<div class="privacy-container glass-card">
```

- [ ] **Step 3: Update `doujin.html`**

```html
<!-- Lines 80 and 93 -->
<div class="doujin-card glass-card">
```

- [ ] **Step 4: Update `tools.html`**

```html
<!-- Lines 74, 81, 88 -->
<div class="tool-card glass-card">
```

- [ ] **Step 5: Update `wallpapers.html`**

```html
<!-- Lines 67, 81, 95, 109, 123, 137 -->
<div class="wallpaper-card glass-card">
```

- [ ] **Step 6: Commit HTML changes**

```bash
git add references.html privacy.html refunds.html terms.html dmca.html shipping.html assets.html celeste-lore-faq.html doujin.html tools.html wallpapers.html
git commit -m "refactor(html): add glass-card theme class to card/container elements"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Start dev server and verify all affected pages**

```bash
python3 -m http.server 8000
```

Check each page in browser:
- http://localhost:8000/references.html — reference gallery cards have glass effect, border, shadow
- http://localhost:8000/privacy.html — content container has glass backdrop
- http://localhost:8000/doujin.html — doujin cards have glass effect, hover lifts
- http://localhost:8000/tools.html — tool cards have glass effect, hover lifts
- http://localhost:8000/wallpapers.html — wallpaper cards have glass effect, hover lifts
- http://localhost:8000/refunds.html — privacy container styled
- http://localhost:8000/terms.html — privacy container styled
- http://localhost:8000/dmca.html — privacy container styled
- http://localhost:8000/shipping.html — privacy container styled
- http://localhost:8000/assets.html — privacy container styled
- http://localhost:8000/celeste-lore-faq.html — privacy container styled

**Expected:** Each page should look identical to before the refactor. The glass background, border, blur, and hover effects should all be present. If any card/container is missing its glass effect, the `.glass-card` class was not added to its HTML element.

- [ ] **Step 2: Verify responsive behavior**

Resize browser to < 768px width. Cards should still render correctly with glass effects.

---

## What was NOT cleaned up (and why)

| Item | Reason to skip |
|------|---------------|
| Asset URL wrappers in countdown-widget.js, celeste-widget.js, json-asset-loader.js | Each serves a different purpose: countdown-widget handles relative paths + base paths, celeste-widget is a class method, json-asset-loader does recursive JSON traversal. These are appropriate encapsulations, not harmful duplication. |
| `video-background.js` | NOT dead code — loaded in 25+ HTML files. Handles tab visibility for video backgrounds. |
| HTML boilerplate (meta tags, script loading) | Templating would require a build system change; out of scope for a cleanup PR. |
