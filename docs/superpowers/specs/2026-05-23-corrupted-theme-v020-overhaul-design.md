# Corrupted Theme 0.2.0 Site Overhaul + Release Blog Post

**Date:** 2026-05-23
**Status:** Approved
**Scope:** All 21 root HTML pages, all 19 blog posts, `assets/css/`, `assets/js/`, `package.json`, new `scripts/sync-corrupted-theme.sh`, new `blog/corrupted-theme-v020.html`, `blog/index.html`

---

## Problem

The site currently consumes `@whykusanagi/corrupted-theme` as a **vendored copy** at `assets/css/corrupted-theme/`, pinned to an earlier 0.1.x snapshot. Version 0.2.0 ships:

- A **breaking change** to `.container` (now structural-only; opinionated layouts opt-in via modifier classes).
- A **CDN distribution** at `cdn.whykusanagi.xyz` / `cdn.nikkers.cc` with pinned versions and SRI hashes.
- **14 new components** (widgets + animation primitives + core utilities).
- A **canonical JSON data layer** (`phrases.json`, `charsets.json`, `colors.json`).
- NSFW option canonicalization (`includeLewd` / `lewdMode` → `nsfw`).

The site needs to:

1. Adopt 0.2.0 cleanly, including the container migration.
2. Switch CSS distribution from vendored files to the same-origin CDN with SRI.
3. Become a visible showcase of the headline new components.
4. Ship a release-notes blog post that walks readers through 0.2.0 and points at the now-live demos.

---

## Solution

Three coordinated workstreams:

1. **Distribution swap** — replace 40 `<link>` tags with one pinned CDN URL + SRI; delete `assets/css/corrupted-theme/`; copy needed JS modules out of `node_modules` into a new `assets/js/corrupted-theme/` tree (CDN doesn't carry ES modules yet).
2. **Component integration** — wire 9 new components into specific pages where they serve a real purpose (not sprinkled).
3. **Release blog post** — new `blog/corrupted-theme-v020.html` following the existing blog template, linking back to the site sections that now demo each new component.

---

## 1. File layout

| File | Status | Role |
|------|--------|------|
| `package.json` | modified | Bump `@whykusanagi/corrupted-theme` to `^0.2.0` (already done) |
| `assets/css/corrupted-theme/` | **deleted** | Replaced by CDN load |
| `assets/css/site-overrides.css` | modified | Remove any `.container { all: unset }` / `grid-template-columns: unset` workarounds; add `scrollbar-corrupted` opt-in on `<html>` if not provided by base |
| `assets/js/corrupted-theme/core/` | new | Copied from `node_modules/@whykusanagi/corrupted-theme/src/core/`: `timer-registry.js`, `event-tracker.js`, `decrypt-reveal.js`, `corruption-charsets.js`, `random-utils.js` |
| `assets/js/corrupted-theme/lib/` | new | Copied from `node_modules/.../src/lib/`: `crt-effects.js`, `animation-blocks.js`, `phrase-cycle.js`, `event-bar.js`, `clock-widget.js`, `toast.js`, `nsfw-reveal.js`, `corrupted-particles-background.js` |
| `assets/js/corrupted-theme/data/` | new | Copied from `node_modules/.../src/data/`: `phrases.json`, `charsets.json`, `colors.json` |
| `assets/js/corrupted-theme/VERSION` | new | Plain-text file containing `0.2.0` for at-a-glance traceability |
| `assets/js/site-bootstrap.js` | new | Single ES-module entry point; imports the components above and wires them per page (delegates by `document.body.dataset.page` or feature detection) |
| `assets/js/decrypt-headings.js` | new | IntersectionObserver glue that invokes `DecryptReveal` on `h1`/`h2` not marked `data-no-decrypt` |
| `assets/js/corrupted-particles.js` | **deleted** | Superseded by `corrupted-particles-background` auto-injector |
| `assets/js/particles-background.js` | **deleted** | Superseded |
| `assets/js/background-setup.js` | modified | Initializes the new `corrupted-particles-background` instead of the old particle scripts |
| `scripts/sync-corrupted-theme.sh` | new | Copies `node_modules/@whykusanagi/corrupted-theme/src/{core,lib,data}/` into `assets/js/corrupted-theme/`, writes `VERSION`. Future bumps: `npm update && bash scripts/sync-corrupted-theme.sh && verify` |
| 21 root HTML pages | modified | CSS `<link>` swap + `<script type="module" src="assets/js/site-bootstrap.js">` + container modifier classes where applicable |
| 19 blog posts | modified | CSS `<link>` swap (relative paths) + bootstrap script |
| `blog/corrupted-theme-v020.html` | new | Release-notes blog post |
| `blog/index.html` | modified | Add new post entry |
| `docs/storage.md` *(if it covers CDN)* | modified | Note CDN consumption pattern |
| `src/index.js` (Worker) | conditionally modified | If it sets CSP headers, add `https://cdn.whykusanagi.xyz` to `style-src`. Confirm before editing. |

---

## 2. Distribution swap

### 2a. CSS via CDN with SRI

**Old (40 files):**
```html
<link rel="stylesheet" href="assets/css/corrupted-theme/theme.css">
```
*(blog posts use `../assets/css/corrupted-theme/theme.css`)*

**New:**
```html
<link rel="stylesheet"
      href="https://cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css"
      integrity="sha384-yVLRYDitu5uQvdKPs8s6MuPdAY2xyxl8nxoJC6G6+LzbMVsBo3d8+dKpIIae8eSq"
      crossorigin="anonymous">
```

- Pinned to `@0.2.0`, not `@latest` — breaking changes never auto-propagate to the live site.
- SRI hash is the one published in the 0.2.0 CHANGELOG.
- `crossorigin="anonymous"` is required when `integrity` is present, even for same-origin loads.
- Same-origin (`cdn.whykusanagi.xyz` is under the same registrable domain as `whykusanagi.xyz`), so no extra CSP work for `'self'`-based policies. Explicit policies need `https://cdn.whykusanagi.xyz` added to `style-src`.

### 2b. JS modules vendored from node_modules

The CDN at `cdn.whykusanagi.xyz` currently serves only `dist/theme.min.css` and `dist/timer-registry.global.js`. The ES modules under `src/lib/*` and `src/core/*` return 404. Available via jsdelivr (cross-origin npm proxy) but that re-introduces the third-party dependency the CDN was meant to solve.

**Decision:** vendor the needed JS modules into `assets/js/corrupted-theme/` via `scripts/sync-corrupted-theme.sh`. Same-origin, no third party, version visible at `assets/js/corrupted-theme/VERSION`. If the package's CDN later adds ES module distribution, switching is a one-script change.

### 2c. Container migration

Pages using `class="container"`:
- `index.html` (1 occurrence) — glass panel → `class="container container--with-bg"`
- `bastard-hero.html` (1) — glass panel → `class="container container--with-bg"`
- `art.html` — gallery wrapper, verify intent and apply `--grid-3col` or `--with-bg` as appropriate
- `assets.html` — same as art
- `celeste-lore-faq.html` — content panel → `--with-bg`
- `404.html` — centered content → `--centered`

Process per file: read current rendered appearance from `site-overrides.css` cascade, pick the modifier that preserves that appearance, verify in browser.

Remove from `site-overrides.css` (audit first):
- Any `.container { all: unset; }` rule
- Any `.container { grid-template-columns: unset; }` rule
- Any other `.container` workaround that's now defeating the new structural-only base

### 2d. NSFW canonicalization

Site default is `nsfw: true`. Update any callsite using deprecated aliases:

- `corrupted-particles.js` consumer config: `includeLewd: true` → `nsfw: true`
- `animation-blocks` consumer config: `lewdMode: true` → `nsfw: true`

The 0.2.0 release accepts both with a `console.warn`; we fix it now while warnings are still cosmetic, ahead of removal in 0.3.x.

---

## 3. Component integrations

### 3a. CRTEffects — `index.html` only

- Loaded by `site-bootstrap.js` when `document.body` has class `crt-on`.
- Add `crt-on` to `index.html` body class.
- Config: `{ scanlines: true, flicker: 'subtle', shake: false, chromaticAberration: false }` — ambient layer, not a stunt.
- Z-order: sits above video background, below glass panels and content.

### 3b. animation-blocks → TerminalBoot + TitleDecoder — `index.html` hero

- Replace static hero `<h1>whykusanagi</h1>` with:
  - A short TerminalBoot sequence (3–4 lines, 600ms total) into
  - A TitleDecoder reveal of "whykusanagi".
- Bound to the hero element via `data-ct-animation="hero-boot"`, wired in `site-bootstrap.js`.
- One-shot per page load; no looping.

### 3c. PhraseCycle — `loading.js`

- Replace the current loading-text logic with a `PhraseCycle` instance cycling 4 phrases pulled from `assets/js/corrupted-theme/data/phrases.json` (`data` and `system` pools), settling on `"ready"`.
- Interval: 400ms per phrase, then settle.
- Old custom loading-text code in `loading.js` is removed.

### 3d. DecryptReveal — site-wide via `assets/js/decrypt-headings.js`

- New module: `IntersectionObserver` watches all `h1, h2` not marked `data-no-decrypt`.
- When a heading scrolls into view (50% threshold, once), call `DecryptReveal.decode(el, el.textContent, { duration: 700, charset: 'standard' })`.
- Opt-out attribute `data-no-decrypt` on any heading we don't want decoded (e.g., long article H2s if it gets noisy).
- Disabled when `prefers-reduced-motion: reduce` is set.

### 3e. EventBar — `index.html` top of page

- Banner above the navbar.
- 3 hardcoded rotating items for now (no backend wiring):
  1. "New: Corrupted Theme 0.2.0 — Read the post"
  2. "Next stream: TBD — twitch.tv/whykusanagi"
  3. "Latest drop: [art piece title]"
- Speed: medium. Pause on hover.
- Config items live inline in `site-bootstrap.js` (no JSON file yet); pulling from a feed is a follow-up.

### 3f. ClockWidget — `links.html` footer area

- Cycles 3 timezones: JP, PST, UTC.
- 12-hour format, refreshes every 30s.
- Mounted into a new `<div id="clock-widget"></div>` placed in the footer area.

### 3g. Toast — site-wide

- Replace any existing inline "Copied!" / confirmation patterns:
  - `tools.html` (copy-to-clipboard buttons)
  - `links.html` (any share buttons)
  - `art.html` (image link copy)
- Use `Toast.success("Copied")` / `Toast.error(...)` from the singleton.
- Auto-init via `data-ct-toast-on-click` where the markup supports it; explicit calls elsewhere.

### 3h. NsfwReveal — `art.html` + `wallpapers.html`

- Wraps per-item NSFW thumbnails (filenames matching `_nsfw` / `_lewd` / `Lewd_` per the asset naming convention in CLAUDE.md §6.4).
- Site default `nsfw: true`, so reveals are opened by default; component is wired and visible in DOM, and the user-level opt-out still works.
- Session-persistent opt-in is the component's default behavior.

### 3i. corrupted-particles-background — site-wide

- Replaces `assets/js/corrupted-particles.js` and `assets/js/particles-background.js`.
- Auto-injector behind blur layer.
- Config: `{ nsfw: true, density: 'low', dpr: 1 }` for performance.
- Initialized once in `site-bootstrap.js`; old script tags removed from every page during the CSS swap pass.

### Components intentionally NOT integrated (this release)

- `WebSocketManager` — no realtime use case on the static site.
- `LogoBanner` — would visually conflict with the TerminalBoot + TitleDecoder hero treatment.
- `seamless-background.css` — site already has a video background.
- Standalone `Lightbox` — `gallery.js` already covers our gallery needs.
- `PngExport` — no use case.

---

## 4. Loading order (one template, every page)

```html
<head>
  ...
  <!-- 1. Pinned theme CSS via same-origin CDN, SRI-pinned -->
  <link rel="stylesheet"
        href="https://cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css"
        integrity="sha384-yVLRYDitu5uQvdKPs8s6MuPdAY2xyxl8nxoJC6G6+LzbMVsBo3d8+dKpIIae8eSq"
        crossorigin="anonymous">

  <!-- 2. Site overrides -->
  <link rel="stylesheet" href="assets/css/site-overrides.css">

  <!-- 3. Page-specific CSS (countdown, etc.) unchanged -->

  <!-- 4. Single ES-module bootstrap -->
  <script type="module" src="assets/js/site-bootstrap.js"></script>
</head>
```

Blog posts use `../assets/...` paths but the CDN URL is absolute and identical.

`site-bootstrap.js` is the single file you read to understand "what is running on this site." It imports the components, reads any per-page `data-ct-*` attributes, and wires them up. No other inline `<script>` should remain in page heads for theme functionality after this overhaul.

---

## 5. Worker / Cloudflare check

Read `src/index.js` (the Cloudflare Worker) before editing. If it currently sets a `Content-Security-Policy` header on responses:

- Add `https://cdn.whykusanagi.xyz` to the `style-src` directive.
- Leave `script-src` alone — all theme JS is now same-origin (vendored).

If no CSP is set today, no Worker change is required.

---

## 6. Sync script

`scripts/sync-corrupted-theme.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
PKG="node_modules/@whykusanagi/corrupted-theme"
DEST="assets/js/corrupted-theme"

if [ ! -d "$PKG" ]; then
  echo "Run 'npm install' first" >&2; exit 1
fi

VERSION=$(node -p "require('./$PKG/package.json').version")
rm -rf "$DEST"
mkdir -p "$DEST/core" "$DEST/lib" "$DEST/data"

# Copy only what site-bootstrap.js actually imports.
for f in timer-registry.js event-tracker.js decrypt-reveal.js corruption-charsets.js random-utils.js; do
  cp "$PKG/src/core/$f" "$DEST/core/$f"
done
for f in crt-effects.js animation-blocks.js phrase-cycle.js event-bar.js clock-widget.js toast.js nsfw-reveal.js corrupted-particles-background.js; do
  cp "$PKG/src/lib/$f" "$DEST/lib/$f"
done
cp "$PKG/src/data/"{phrases,charsets,colors}.json "$DEST/data/"

echo "$VERSION" > "$DEST/VERSION"
echo "Synced corrupted-theme $VERSION to $DEST"
```

Future bumps:
```
npm install @whykusanagi/corrupted-theme@<new-version>
bash scripts/sync-corrupted-theme.sh
# update CDN <link> integrity hash + version in head template
# manual browser test
```

---

## 7. Blog post structure

**File:** `blog/corrupted-theme-v020.html`
**Date:** 2026-05-23
**Title:** "Corrupted Theme 0.2.0 — Foundations, Components, and a CDN"
**Hero image:** `https://s3.whykusanagi.xyz/art/MousePad/full-body.png` (continuity with prior corrupted-theme posts)
**Template:** copy `blog/corrupted-theme-design-system.html` structure (head, JSON-LD, navbar, video bg, blog-article body class)
**Length:** 1500–2000 words
**Voice:** "engineering blog" — practical, declarative; not the Celeste persona. Matches the existing corrupted-theme posts.

### Sections

1. **TL;DR** (3 bullets): new components, CDN distribution, `.container` breaking change.
2. **0.2.0 as a foundation.** Why a minor version feels like a 1.0 statement — reframes the package as a durable cross-project foundation.
3. **14 new components, organized.**
   - **Widgets:** Toast, WebSocketManager, ClockWidget, Lightbox (standalone), EventBar, LogoBanner, NsfwReveal.
   - **Animation primitives:** CRTEffects, PhraseCycle, DecryptReveal, animation-blocks (10 blocks).
   - **Core utilities:** random-utils, time-utils, clipboard-helpers, url-state, PngExport.
   - For each component this site adopted, add a "see it live: [page link]" pointer.
4. **The canonical data layer.** `phrases.json` / `charsets.json` / `colors.json`, AJV-validated, consumable from Go via `go:embed`. Why a data contract matters once you have multiple consumer surfaces.
5. **CDN distribution.** Same-origin rule, SRI hashes, dual-domain (`cdn.whykusanagi.xyz` / `cdn.nikkers.cc`) trick. Honest caveat: CDN currently serves `dist/` only; ES modules still need vendoring or jsdelivr. Note this site does CSS-from-CDN + JS-vendored as the current best pattern.
6. **The `.container` breaking change.** *Why* (downstream sites fighting the rule), and our migration as a worked example with the actual before/after diff.
7. **What we changed on this site for 0.2.0.** Bulleted list with anchors to each new live demo.
8. **What's next.** From the [Unreleased] section: ES module CDN distribution, Figma, Storybook.

### Index update

Add to `blog/index.html` matching the existing entry format (date-first, title link, short description). Place at the top of the list.

---

## 8. Out of scope

- Migrating the repo from GitLab to GitHub (separate decision; doesn't block this work).
- Refactoring `celeste-widget.js` secrets (tracked separately in CLAUDE.md §13).
- File-reorganization of root-level HTML pages (deferred per CLAUDE.md §13).
- Backend wiring for `EventBar` (hardcoded items this release; feed integration is a follow-up).
- Upgrading the package's CDN to serve ES modules (maintainer-side decision in the corrupted-theme repo).

---

## 9. Validation

Manual browser test on Chrome + Safari + Firefox at desktop (1920px) and mobile (375px) breakpoints:

- [ ] All 21 root pages render with the new CDN-loaded theme.
- [ ] All 19 blog posts render correctly.
- [ ] Container modifier classes preserve original appearance on the 6 affected pages.
- [ ] Hero TerminalBoot + TitleDecoder fires once on `index.html` load, settles on "whykusanagi".
- [ ] DecryptReveal fires on H1/H2 as they scroll into view; respects `prefers-reduced-motion`.
- [ ] EventBar rotates 3 items at top of `index.html`.
- [ ] ClockWidget cycles JP/PST/UTC in `links.html` footer.
- [ ] CRTEffects scanlines visible on `index.html`, not on other pages.
- [ ] PhraseCycle plays during loading on every page; settles cleanly.
- [ ] Toast fires on copy-to-clipboard in `tools.html` / `links.html` / `art.html`.
- [ ] NsfwReveal wraps marked items on `art.html` / `wallpapers.html`; opens by default per site nsfw=true.
- [ ] corrupted-particles-background renders behind blur layer; no console errors from the deleted old scripts.
- [ ] No console warnings about `includeLewd` / `lewdMode` deprecation.
- [ ] SRI hash matches; no integrity failures in the network panel.
- [ ] CSP (if set in Worker) does not block the CDN load.
- [ ] Blog post `corrupted-theme-v020.html` renders, JSON-LD validates, all internal anchor links resolve.

Cloudflare Worker deploy is unchanged (push-to-main triggers existing GitLab → Cloudflare integration).

---

## 10. Rollback

If 0.2.0 causes a site regression discovered post-deploy:

1. Revert the CDN `<link>` `@0.2.0` → previous-known-good version + previous SRI hash. Cloudflare's `@latest` is *not* used, so this is a clean pin change.
2. `git revert` the overhaul commit(s) on `main`.
3. The vendored `assets/js/corrupted-theme/` tree can be re-pointed to an earlier sync via the sync script + `npm install @whykusanagi/corrupted-theme@<previous>`.

No data migrations, no infrastructure changes — full rollback is a code-only operation.
