# Corrupted Theme 0.2.0 Site Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the whykusanagi.xyz site to corrupted-theme 0.2.0 — CDN-loaded CSS with SRI, vendored ES module JS, container breaking change migrated, 9 new components integrated, and a release-notes blog post published.

**Architecture:** CSS loads from `cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css` (pinned + SRI). JS modules are vendored under `assets/js/corrupted-theme/` (synced from `node_modules` via a script — the CDN currently serves dist only). A single `assets/js/site-bootstrap.js` module is the only entry point that wires the new components. The 21 root HTML pages and 19 blog posts get their `<head>` updated via a search-replace pattern. The Cloudflare Worker deploy pipeline is unchanged.

**Tech Stack:** Static HTML5/CSS3/ES modules. No build system. Cloudflare Workers (deploy from GitLab). `npm` only used to pull the corrupted-theme package and run the sync script.

**Spec:** [`docs/superpowers/specs/2026-05-23-corrupted-theme-v020-overhaul-design.md`](../specs/2026-05-23-corrupted-theme-v020-overhaul-design.md)

---

## Files Touched

| File | Status |
|------|--------|
| `package.json` | already on `^0.2.0` (no action) |
| `scripts/sync-corrupted-theme.sh` | new |
| `assets/js/corrupted-theme/{core,lib,data}/` | new (synced from node_modules) |
| `assets/js/corrupted-theme/VERSION` | new |
| `assets/js/site-bootstrap.js` | new |
| `assets/js/decrypt-headings.js` | new |
| `assets/js/loading.js` | modified (PhraseCycle) |
| `assets/js/background-setup.js` | modified (corrupted-particles-background) |
| `assets/js/corrupted-particles.js` | deleted |
| `assets/js/particles-background.js` | deleted |
| `assets/css/corrupted-theme/` | deleted |
| `assets/css/site-overrides.css` | modified (drop `.container` workarounds) |
| 21 root HTML pages | modified (CSS swap + bootstrap script + container modifiers) |
| 19 blog posts | modified (CSS swap + bootstrap script) |
| `blog/corrupted-theme-v020.html` | new |
| `blog/index.html` | modified (new entry) |
| `src/index.js` (Worker) | conditional |

---

## Branch & Worktree

Branch name: `feature/corrupted-theme-v020`

Subagent worktree will be created at execution time via `superpowers:using-git-worktrees`.

---

## Task 1: Sync script + initial vendor pull

**Files:**
- Create: `scripts/sync-corrupted-theme.sh`
- Create: `assets/js/corrupted-theme/core/*` (synced)
- Create: `assets/js/corrupted-theme/lib/*` (synced)
- Create: `assets/js/corrupted-theme/data/*` (synced)
- Create: `assets/js/corrupted-theme/VERSION`

- [ ] **Step 1: Verify node_modules has 0.2.0**

Run: `node -p "require('./node_modules/@whykusanagi/corrupted-theme/package.json').version"`
Expected: `0.2.0`

If not `0.2.0`, run `npm install` first.

- [ ] **Step 2: Verify the source files exist in node_modules**

Run:
```bash
for f in src/core/timer-registry.js src/core/event-tracker.js src/core/decrypt-reveal.js \
         src/core/corruption-charsets.js src/core/random-utils.js \
         src/lib/crt-effects.js src/lib/animation-blocks.js src/lib/phrase-cycle.js \
         src/lib/event-bar.js src/lib/clock-widget.js src/lib/toast.js \
         src/lib/nsfw-reveal.js src/lib/corrupted-particles-background.js \
         src/data/phrases.json src/data/charsets.json src/data/colors.json; do
  test -f "node_modules/@whykusanagi/corrupted-theme/$f" && echo "OK  $f" || echo "MISS $f"
done
```

Expected: every line prefixed `OK`. If any `MISS`, stop and report — the package contents differ from the spec and the plan must be revised.

- [ ] **Step 3: Write the sync script**

Create `scripts/sync-corrupted-theme.sh`:

```bash
#!/usr/bin/env bash
# Sync the ES module subset of @whykusanagi/corrupted-theme into assets/js/corrupted-theme/.
# The package's CDN (cdn.whykusanagi.xyz) currently serves dist/ only, so the ES modules
# this site uses must be vendored. This script is the only build step.
set -euo pipefail

PKG="node_modules/@whykusanagi/corrupted-theme"
DEST="assets/js/corrupted-theme"

if [ ! -d "$PKG" ]; then
  echo "Run 'npm install' first" >&2
  exit 1
fi

VERSION=$(node -p "require('./$PKG/package.json').version")

rm -rf "$DEST"
mkdir -p "$DEST/core" "$DEST/lib" "$DEST/data"

CORE_FILES=(timer-registry.js event-tracker.js decrypt-reveal.js corruption-charsets.js random-utils.js)
for f in "${CORE_FILES[@]}"; do
  cp "$PKG/src/core/$f" "$DEST/core/$f"
done

LIB_FILES=(crt-effects.js animation-blocks.js phrase-cycle.js event-bar.js
           clock-widget.js toast.js nsfw-reveal.js corrupted-particles-background.js)
for f in "${LIB_FILES[@]}"; do
  cp "$PKG/src/lib/$f" "$DEST/lib/$f"
done

cp "$PKG/src/data/phrases.json" "$DEST/data/phrases.json"
cp "$PKG/src/data/charsets.json" "$DEST/data/charsets.json"
cp "$PKG/src/data/colors.json"  "$DEST/data/colors.json"

echo "$VERSION" > "$DEST/VERSION"
echo "Synced corrupted-theme $VERSION to $DEST"
```

- [ ] **Step 4: Make it executable and run it**

Run:
```bash
chmod +x scripts/sync-corrupted-theme.sh
bash scripts/sync-corrupted-theme.sh
```

Expected: `Synced corrupted-theme 0.2.0 to assets/js/corrupted-theme`

- [ ] **Step 5: Verify the synced tree**

Run:
```bash
cat assets/js/corrupted-theme/VERSION
find assets/js/corrupted-theme -type f | sort
```

Expected output:
```
0.2.0
assets/js/corrupted-theme/VERSION
assets/js/corrupted-theme/core/corruption-charsets.js
assets/js/corrupted-theme/core/decrypt-reveal.js
assets/js/corrupted-theme/core/event-tracker.js
assets/js/corrupted-theme/core/random-utils.js
assets/js/corrupted-theme/core/timer-registry.js
assets/js/corrupted-theme/data/charsets.json
assets/js/corrupted-theme/data/colors.json
assets/js/corrupted-theme/data/phrases.json
assets/js/corrupted-theme/lib/animation-blocks.js
assets/js/corrupted-theme/lib/clock-widget.js
assets/js/corrupted-theme/lib/corrupted-particles-background.js
assets/js/corrupted-theme/lib/crt-effects.js
assets/js/corrupted-theme/lib/event-bar.js
assets/js/corrupted-theme/lib/nsfw-reveal.js
assets/js/corrupted-theme/lib/phrase-cycle.js
assets/js/corrupted-theme/lib/toast.js
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-corrupted-theme.sh assets/js/corrupted-theme/
git commit -m "feat(corrupted-theme): add sync script and vendor 0.2.0 ES modules

The package's CDN at cdn.whykusanagi.xyz currently serves dist/ only,
so the ES module components we consume are vendored from node_modules.
Future bumps: npm install <new> && bash scripts/sync-corrupted-theme.sh."
```

---

## Task 2: Audit imports inside the synced JS

Before wiring components, confirm each synced file's *own* imports resolve relative to the synced tree (e.g., `lib/crt-effects.js` may `import { TimerRegistry } from '../core/timer-registry.js'`). If a file imports something we didn't sync, we must sync it too — otherwise the browser will 404.

**Files:** read-only audit

- [ ] **Step 1: Grep relative imports in every synced JS file**

Run:
```bash
grep -RHnE "^import .* from ['\"]\.\.?/[^'\"]+['\"]" assets/js/corrupted-theme/ | sort
```

Expected: imports only reference paths inside `assets/js/corrupted-theme/` (`./` or `../core/` or `../data/` or `../lib/`). The set of referenced files must be a subset of what `find assets/js/corrupted-theme -type f` lists.

- [ ] **Step 2: Diff the import set against the file set**

Run:
```bash
# Extract every relative-import path, resolve from the importing file's directory,
# and list any that don't exist on disk.
python3 - <<'PY'
import os, re, sys, glob
root = "assets/js/corrupted-theme"
missing = []
for path in glob.glob(f"{root}/**/*.js", recursive=True):
    base = os.path.dirname(path)
    with open(path) as f:
        for m in re.finditer(r"""from\s+['"](\.[^'"]+)['"]""", f.read()):
            ref = os.path.normpath(os.path.join(base, m.group(1)))
            if not os.path.exists(ref):
                missing.append((path, m.group(1), ref))
for p, raw, resolved in missing:
    print(f"MISSING: {p} imports {raw} -> {resolved}")
print(f"\n{len(missing)} missing import(s)")
PY
```

Expected: `0 missing import(s)`.

If any missing, **stop**. Either:
- Add the missing source file(s) to the `CORE_FILES` / `LIB_FILES` arrays in `scripts/sync-corrupted-theme.sh` and re-run the script (Task 1 step 4), then re-audit.
- Or the file references something outside the vendored subset (e.g. a `dist/` build artifact) — report and revise the plan.

- [ ] **Step 3: Commit only if the sync script was updated**

If you added files to the sync script:
```bash
git add scripts/sync-corrupted-theme.sh assets/js/corrupted-theme/
git commit -m "fix(corrupted-theme): sync missing transitive ES module dependencies"
```

If no changes needed, skip the commit.

---

## Task 3: site-bootstrap.js skeleton

Create the single entry-point module. This task only stands up the file with safe no-ops; later tasks add per-component wiring.

**Files:**
- Create: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Write the skeleton**

Create `assets/js/site-bootstrap.js`:

```javascript
// Single ES-module entry for corrupted-theme component wiring.
// Loaded as <script type="module" src="assets/js/site-bootstrap.js"> in every
// page. Reads page-level data attributes off <body> to decide what to wire.
//
// Pinned to corrupted-theme @ assets/js/corrupted-theme/VERSION.

const body = document.body;
const page = body.dataset.page || '';

// Per-component wiring is added by subsequent tasks.
// Each block must be defensive: import at top level, but call init() only when
// the page actually needs the component.

// === Toast (sitewide singleton — initializes on first use) ===
// === corrupted-particles-background (sitewide) ===
// === DecryptReveal headings (sitewide) ===
// === PhraseCycle loading (sitewide, via loading.js) ===

// === Index-only: CRTEffects, TerminalBoot + TitleDecoder hero, EventBar ===
// === links.html-only: ClockWidget ===
// === art.html / wallpapers.html: NsfwReveal ===
```

- [ ] **Step 2: Verify it loads as a module (no syntax errors)**

Run:
```bash
node --input-type=module -e "$(cat assets/js/site-bootstrap.js)"
```

Expected: process exits 0 with no output (Node will fail on `document` references — but we have none yet, this is pure comments). If Node complains about `document`, the file has crept past the skeleton stage — revert step 1 to comments only.

Actually since the skeleton already references `document.body`, the Node check won't work as-is. Use this instead:

```bash
node --check assets/js/site-bootstrap.js
```

Expected: silent success (syntax-valid).

- [ ] **Step 3: Commit**

```bash
git add assets/js/site-bootstrap.js
git commit -m "feat(site): add site-bootstrap.js skeleton for corrupted-theme 0.2.0 wiring"
```

---

## Task 4: Swap CSS link and add bootstrap script — 21 root HTML pages

Every root HTML page currently has:

```html
<link rel="stylesheet" href="assets/css/corrupted-theme/theme.css">
```

Replace with the pinned CDN + SRI load, and add the bootstrap script to `<head>`.

**Files:**
- Modify: `404.html`, `art.html`, `assets.html`, `bastard-hero.html`, `celeste-cli-presentation.html`, `celeste-lore-faq.html`, `celeste.html`, `countdown.html`, `dmca.html`, `doujin.html`, `fall-of-kirara.html`, `index.html`, `links.html`, `privacy.html`, `references.html`, `refunds.html`, `shipping.html`, `terms.html`, `tools.html`, `union_calc.html`, `wallpapers.html`

- [ ] **Step 1: Confirm the exact pre-swap pattern is uniform**

Run:
```bash
grep -c 'assets/css/corrupted-theme/theme.css' *.html
```

Expected: every root `.html` file outputs `1` (one occurrence each). If any file shows `0` or `2+`, list it and inspect manually before proceeding.

- [ ] **Step 2: Apply the CSS swap to every root HTML page**

Run:
```bash
for f in *.html; do
  sed -i.bak 's|<link rel="stylesheet" href="assets/css/corrupted-theme/theme.css">|<link rel="stylesheet" href="https://cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css" integrity="sha384-yVLRYDitu5uQvdKPs8s6MuPdAY2xyxl8nxoJC6G6+LzbMVsBo3d8+dKpIIae8eSq" crossorigin="anonymous">|' "$f"
done
rm -f *.html.bak
```

- [ ] **Step 3: Verify the swap landed everywhere**

Run:
```bash
grep -c 'assets/css/corrupted-theme/theme.css' *.html | grep -v ':0$' || echo "ALL CLEAR"
grep -c 'cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css' *.html | grep -v ':1$' || echo "ALL ONE-EACH"
```

Expected:
- First line: `ALL CLEAR` (no old path remains anywhere).
- Second line: `ALL ONE-EACH` (every file has exactly one CDN reference).

- [ ] **Step 4: Add bootstrap module script to every root page's `<head>`**

Insert `<script type="module" src="assets/js/site-bootstrap.js"></script>` immediately after the `site-overrides.css` link. The pattern in every file is:

```html
<link rel="stylesheet" href="assets/css/site-overrides.css">
```

Run:
```bash
for f in *.html; do
  if grep -q 'assets/css/site-overrides.css' "$f"; then
    sed -i.bak 's|<link rel="stylesheet" href="assets/css/site-overrides.css">|<link rel="stylesheet" href="assets/css/site-overrides.css">\n  <script type="module" src="assets/js/site-bootstrap.js"></script>|' "$f"
  else
    echo "NO_OVERRIDES_LINK: $f"
  fi
done
rm -f *.html.bak
```

Expected: no `NO_OVERRIDES_LINK` lines. If any page lacks `site-overrides.css`, list it and add the bootstrap script manually after the CDN `<link>` instead.

- [ ] **Step 5: Verify bootstrap script presence**

Run:
```bash
grep -L 'assets/js/site-bootstrap.js' *.html
```

Expected: no output (every page contains the bootstrap script).

- [ ] **Step 6: Commit**

```bash
git add *.html
git commit -m "feat(site): swap root HTML to CDN-loaded corrupted-theme 0.2.0 + bootstrap module"
```

---

## Task 5: Swap CSS link and add bootstrap script — 19 blog posts

Blog posts use the same pattern but with `../assets/...` relative paths.

**Files:**
- Modify: every `blog/*.html` except `blog/_template.html` (the template gets the same treatment in the same pass).

- [ ] **Step 1: Confirm the exact pre-swap pattern is uniform**

Run:
```bash
grep -c '\.\./assets/css/corrupted-theme/theme.css' blog/*.html
```

Expected: every blog file outputs `1`. Investigate any `0` or `2+`.

- [ ] **Step 2: Apply the CSS swap to every blog page**

Run:
```bash
for f in blog/*.html; do
  sed -i.bak 's|<link rel="stylesheet" href="\.\./assets/css/corrupted-theme/theme.css">|<link rel="stylesheet" href="https://cdn.whykusanagi.xyz/corrupted-theme/@0.2.0/dist/theme.min.css" integrity="sha384-yVLRYDitu5uQvdKPs8s6MuPdAY2xyxl8nxoJC6G6+LzbMVsBo3d8+dKpIIae8eSq" crossorigin="anonymous">|' "$f"
done
rm -f blog/*.html.bak
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -l '\.\./assets/css/corrupted-theme' blog/*.html
grep -c 'cdn.whykusanagi.xyz/corrupted-theme/@0.2.0' blog/*.html | grep -v ':1$' || echo "ALL ONE-EACH"
```

Expected:
- First command: no output.
- Second: `ALL ONE-EACH`.

- [ ] **Step 4: Add bootstrap script to every blog page's `<head>`**

```bash
for f in blog/*.html; do
  if grep -q '\.\./assets/css/site-overrides.css' "$f"; then
    sed -i.bak 's|<link rel="stylesheet" href="\.\./assets/css/site-overrides.css">|<link rel="stylesheet" href="../assets/css/site-overrides.css">\n  <script type="module" src="../assets/js/site-bootstrap.js"></script>|' "$f"
  else
    echo "NO_OVERRIDES_LINK: $f"
  fi
done
rm -f blog/*.html.bak
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -L '\.\./assets/js/site-bootstrap.js' blog/*.html
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add blog/*.html
git commit -m "feat(blog): swap blog posts to CDN-loaded corrupted-theme 0.2.0 + bootstrap module"
```

---

## Task 6: Container migration — modifier classes on affected pages

The 0.2.0 `.container` is structural-only. Pages that previously relied on the implicit grid/glass appearance must opt in via a modifier class. Per the spec, the affected pages are: `index.html`, `bastard-hero.html`, `art.html`, `assets.html`, `celeste-lore-faq.html`, `404.html`.

**Files:**
- Modify: `index.html`, `bastard-hero.html`, `art.html`, `assets.html`, `celeste-lore-faq.html`, `404.html`

- [ ] **Step 1: Catalog every `.container` usage in the affected pages**

Run:
```bash
for f in index.html bastard-hero.html art.html assets.html celeste-lore-faq.html 404.html; do
  echo "=== $f ==="
  grep -nE 'class="[^"]*\bcontainer\b' "$f"
done
```

Note the exact class string for each occurrence. The intent for each (per spec section 2c):

| Page | Intent | Modifier to add |
|------|--------|-----------------|
| `index.html` | glass panel | `container--with-bg` |
| `bastard-hero.html` | glass panel | `container--with-bg` |
| `art.html` | gallery wrapper — read file, decide between `--grid-3col` and `--with-bg` (or no modifier if base structural is correct) |
| `assets.html` | gallery wrapper — same call as art.html |
| `celeste-lore-faq.html` | content panel | `container--with-bg` |
| `404.html` | centered content | `container--centered` |

- [ ] **Step 2: Apply the modifier to each occurrence**

For each page, Edit the `class="container ..."` value to add the chosen modifier. Example for `index.html`:

```html
<!-- before -->
<div class="container">
<!-- after -->
<div class="container container--with-bg">
```

For `art.html` and `assets.html`, read the file first to confirm which intent applies. If the page uses CSS grid styling on `.container` from `site-overrides.css`, the safest choice is `container--with-bg` (matches the previous glass appearance). Apply consistently.

- [ ] **Step 3: Audit and remove `.container` workarounds from `site-overrides.css`**

Read `assets/css/site-overrides.css` lines 100–215 (the `.container` rules at lines 109 and 202). The base 0.2.0 `.container` is structural-only — any rule that overrides it to remove a grid or unset display is now defeating the new base.

For each `.container { ... }` block:
- If it sets `display`, `grid-template-columns`, or `all: unset` → those are 0.1.x workarounds and must be removed.
- If it sets *visual* properties (background, border, padding overrides) → keep those for now; the modifier classes provide the glass appearance, page-specific overrides are still valid.
- Specific selectors like `.reference-container`, `.privacy-container`, `.blog-page .container` are different rules — leave them.

Make the edits. Comment near the deletion: `/* removed: 0.1.x .container workaround, base is now structural-only */` on a one-line basis if it helps a future reader.

- [ ] **Step 4: Verify no page still has a bare `.container` that needs a modifier**

Re-run the catalog from Step 1. Every occurrence on the 6 affected pages should now have at least one `container--*` modifier.

- [ ] **Step 5: Commit**

```bash
git add index.html bastard-hero.html art.html assets.html celeste-lore-faq.html 404.html assets/css/site-overrides.css
git commit -m "fix(site): migrate .container usages to 0.2.0 modifier classes

Base .container is now structural-only; opinionated layouts opt-in
via container--with-bg / --centered / --grid-* modifiers. Removes
the 0.1.x site-overrides workarounds that were unsetting the rule."
```

---

## Task 7: Delete vendored `assets/css/corrupted-theme/`

With CSS now loading from the CDN on every page, the vendored copy is dead weight.

**Files:**
- Delete: `assets/css/corrupted-theme/` (entire directory)

- [ ] **Step 1: Confirm no remaining references**

Run:
```bash
grep -rln 'assets/css/corrupted-theme' . --include='*.html' --include='*.css' --include='*.js' --include='*.json' --include='*.md' 2>/dev/null | grep -v node_modules
```

Expected: matches only in `CLAUDE.md` or other docs (no `.html` / `.css` / `.js` references). If any HTML / CSS / JS file still references the path, stop — return to Task 4/5 and fix.

If `CLAUDE.md` mentions it, that is *documentation* and stays; we'll update CLAUDE.md as a separate concern (out of scope per spec §8).

- [ ] **Step 2: Delete the directory**

Run:
```bash
git rm -r assets/css/corrupted-theme/
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(site): delete vendored assets/css/corrupted-theme/ (CDN-only now)"
```

---

## Task 8: Replace particle scripts with corrupted-particles-background

The new auto-injector replaces the two custom particle scripts. Wire it into `site-bootstrap.js` and remove the old `<script>` tags and files.

**Files:**
- Modify: `assets/js/site-bootstrap.js`
- Modify: `assets/js/background-setup.js`
- Delete: `assets/js/corrupted-particles.js`
- Delete: `assets/js/particles-background.js`
- Modify: every page that loads either old script

- [ ] **Step 1: Inventory old script tag usage**

Run:
```bash
grep -rln 'corrupted-particles\.js\|particles-background\.js' . --include='*.html' 2>/dev/null | grep -v node_modules
```

Note every page that loads either. They all need their `<script>` tags removed.

- [ ] **Step 2: Inspect the new component's API**

Run:
```bash
sed -n '1,40p' assets/js/corrupted-theme/lib/corrupted-particles-background.js
```

Confirm the export shape (typically `export function initCorruptedParticlesBackground(opts)` or `export class CorruptedParticlesBackground`). Use the actual export name in Step 3.

- [ ] **Step 3: Wire the new component into `site-bootstrap.js`**

Replace the `// === corrupted-particles-background (sitewide) ===` comment block with the import + init call. Example (adapt to the actual export name from Step 2):

```javascript
// === corrupted-particles-background (sitewide) ===
import { initCorruptedParticlesBackground } from './corrupted-theme/lib/corrupted-particles-background.js';

initCorruptedParticlesBackground({
  nsfw: true,
  density: 'low',
  dpr: 1,
});
```

If the export is a class:

```javascript
import { CorruptedParticlesBackground } from './corrupted-theme/lib/corrupted-particles-background.js';
new CorruptedParticlesBackground({ nsfw: true, density: 'low', dpr: 1 }).start();
```

Match whatever the file's `export` actually says.

- [ ] **Step 4: Remove old script tags from every page**

For each file from Step 1 inventory, delete `<script src="assets/js/corrupted-particles.js"></script>` and `<script src="assets/js/particles-background.js"></script>` (root pages) or their `../assets/...` blog-relative variants.

A safe bulk pass:
```bash
for f in *.html blog/*.html; do
  sed -i.bak \
    -e '/script[^>]*src="[^"]*assets\/js\/corrupted-particles\.js"/d' \
    -e '/script[^>]*src="[^"]*assets\/js\/particles-background\.js"/d' \
    "$f"
done
rm -f *.html.bak blog/*.html.bak
```

- [ ] **Step 5: Update `background-setup.js`**

Read `assets/js/background-setup.js`. If it depends on either deleted script (e.g., creates a canvas element they consume), update it to leave the canvas/container element in place for the new injector. If it has nothing left to do, leave the file in place but reduce it to a comment explaining the new initializer handles particles. Do not delete the file (other pages reference it in `<script>` tags).

- [ ] **Step 6: Delete the old script files**

Run:
```bash
git rm assets/js/corrupted-particles.js assets/js/particles-background.js
```

- [ ] **Step 7: Verify no stale references**

Run:
```bash
grep -rln 'corrupted-particles\.js\|particles-background\.js' . --include='*.html' --include='*.js' 2>/dev/null | grep -v node_modules | grep -v 'assets/js/corrupted-theme/'
```

Expected: no output. (The `assets/js/corrupted-theme/lib/corrupted-particles-background.js` path is the new file — different name — so this grep won't catch it.)

- [ ] **Step 8: Commit**

```bash
git add assets/js/site-bootstrap.js assets/js/background-setup.js *.html blog/*.html
git commit -m "feat(site): replace custom particle scripts with corrupted-particles-background auto-injector"
```

---

## Task 9: PhraseCycle in loading.js

Replace the existing loading-text logic with `PhraseCycle` pulling from canonical phrases.

**Files:**
- Modify: `assets/js/loading.js`

- [ ] **Step 1: Read the existing loading.js**

Run: `cat assets/js/loading.js`

Note: what does it do today? Identify the section that drives loading text (if any). Preserve any unrelated logic (e.g., DOM ready handlers, fade-out behavior).

- [ ] **Step 2: Read the PhraseCycle API**

Run:
```bash
sed -n '1,60p' assets/js/corrupted-theme/lib/phrase-cycle.js
```

Confirm the export shape (likely `class PhraseCycle { constructor(element, phrases, opts); start(); stop(); }`).

- [ ] **Step 3: Read the phrases.json structure**

Run:
```bash
node -e "const p = require('./assets/js/corrupted-theme/data/phrases.json'); console.log(Object.keys(p)); console.log(JSON.stringify(p.data?.slice?.(0,4) ?? p.data, null, 2));"
```

Identify the pool names (the spec calls out `data` and `system` pools).

- [ ] **Step 4: Wire PhraseCycle**

Edit `loading.js` to:
1. Find the element it currently uses for loading text (likely `#loading-text` or similar).
2. Replace whatever drives that element with a `PhraseCycle` instance.
3. Pick 4 phrases (2 from `data`, 2 from `system`) and settle on `"ready"`.
4. Interval 400ms.

Example shape (adapt to the real API + element):

```javascript
import { PhraseCycle } from './corrupted-theme/lib/phrase-cycle.js';
import phrases from './corrupted-theme/data/phrases.json' assert { type: 'json' };

function startLoadingPhrases() {
  const el = document.getElementById('loading-text');
  if (!el) return;
  const pool = [...phrases.data.slice(0, 2), ...phrases.system.slice(0, 2)];
  new PhraseCycle(el, pool, { interval: 400, settleOn: 'ready' }).start();
}

// existing loading.js logic preserved here…
```

Two practical concerns:
- `loading.js` is loaded via `<script src="...">` (non-module) on every page. The bootstrap script is a module. **Do not convert `loading.js` to a module** — adding `type="module"` to it would break load order across 40 pages. Instead, fold the PhraseCycle init into `site-bootstrap.js` and leave `loading.js` for its non-corrupted-theme responsibilities. Replace the PhraseCycle plan inside `loading.js` with a deletion of the old loading-text logic only.
- If `loading.js` has no loading-text logic, the move is just: add the wiring to `site-bootstrap.js`, no edit to `loading.js`.

So:

- [ ] **Step 4a: Move loading-text logic out of `loading.js`**

If `loading.js` contains a loading-text driver, delete that section (preserve everything else).

- [ ] **Step 4b: Wire PhraseCycle in `site-bootstrap.js`**

Replace `// === PhraseCycle loading (sitewide, via loading.js) ===` with:

```javascript
// === PhraseCycle loading text (sitewide) ===
import { PhraseCycle } from './corrupted-theme/lib/phrase-cycle.js';
import phrases from './corrupted-theme/data/phrases.json' assert { type: 'json' };

(function startLoadingPhrases() {
  const el = document.getElementById('loading-text');
  if (!el) return;
  const pool = [...phrases.data.slice(0, 2), ...phrases.system.slice(0, 2)];
  new PhraseCycle(el, pool, { interval: 400, settleOn: 'ready' }).start();
})();
```

If browser support for `import ... assert { type: 'json' }` is a concern, fall back to a `fetch('./corrupted-theme/data/phrases.json')` + `await r.json()` pattern wrapped in an `async IIFE`. Verify in the browser at Task 20.

- [ ] **Step 5: Commit**

```bash
git add assets/js/loading.js assets/js/site-bootstrap.js
git commit -m "feat(loading): PhraseCycle loading text from canonical phrases.json"
```

---

## Task 10: CRTEffects + Hero TerminalBoot + TitleDecoder on index.html

**Files:**
- Modify: `index.html`
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Inspect index.html hero**

Run:
```bash
grep -n 'class="container\|<h1\|<main' index.html | head -20
```

Identify the hero `<h1>` element and the body tag.

- [ ] **Step 2: Add `crt-on` body class and hero `data-ct-animation` marker**

Edit `index.html`:
- Add `crt-on` to `<body class="…">`.
- On the hero `<h1>`, add `data-ct-animation="hero-boot"` and ensure its text content is `whykusanagi` (preserve any inner markup that's purely structural).

- [ ] **Step 3: Inspect the CRTEffects API**

Run:
```bash
sed -n '1,50p' assets/js/corrupted-theme/lib/crt-effects.js
```

Confirm the export.

- [ ] **Step 4: Inspect animation-blocks API**

Run:
```bash
sed -n '1,80p' assets/js/corrupted-theme/lib/animation-blocks.js
grep -nE 'export (class|function|const) (TerminalBoot|TitleDecoder)' assets/js/corrupted-theme/lib/animation-blocks.js
```

Confirm both blocks export under those names.

- [ ] **Step 5: Wire CRTEffects + hero animation in site-bootstrap.js**

Replace the `// === Index-only ===` comment with:

```javascript
// === Index-only: CRT ambient layer + hero boot animation ===
if (document.body.classList.contains('crt-on')) {
  const { CRTEffects } = await import('./corrupted-theme/lib/crt-effects.js');
  new CRTEffects({
    scanlines: true,
    flicker: 'subtle',
    shake: false,
    chromaticAberration: false,
  }).attach(document.body);
}

const heroEl = document.querySelector('[data-ct-animation="hero-boot"]');
if (heroEl) {
  const { TerminalBoot, TitleDecoder } = await import('./corrupted-theme/lib/animation-blocks.js');
  const finalText = heroEl.textContent;
  await new TerminalBoot(heroEl, {
    lines: [
      '> boot.celeste',
      '> mount /void',
      '> link[whykusanagi]',
    ],
    durationMs: 600,
  }).run();
  await new TitleDecoder(heroEl, finalText, { durationMs: 700 }).run();
}
```

Adjust the constructor / method names to match what Step 3 and Step 4 confirmed (the export shapes from the actual source).

To use top-level `await` in a module, the file must remain `<script type="module">` (it already is). If `await` at the top level fails in any target browser, wrap the block in `(async () => { ... })();`.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/js/site-bootstrap.js
git commit -m "feat(index): CRTEffects ambient layer + TerminalBoot/TitleDecoder hero animation"
```

---

## Task 11: DecryptReveal headings (site-wide)

A small IntersectionObserver module that decodes H1/H2 as they scroll into view.

**Files:**
- Create: `assets/js/decrypt-headings.js`
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Inspect DecryptReveal API**

Run:
```bash
sed -n '1,60p' assets/js/corrupted-theme/core/decrypt-reveal.js
grep -nE 'export ' assets/js/corrupted-theme/core/decrypt-reveal.js
```

Confirm export (the spec says `DecryptReveal.decode(element, finalText, opts)`).

- [ ] **Step 2: Write the headings module**

Create `assets/js/decrypt-headings.js`:

```javascript
// IntersectionObserver: when an h1 or h2 (without data-no-decrypt) scrolls
// into view, run DecryptReveal.decode against it once. Respects reduced motion.
import { DecryptReveal } from './corrupted-theme/core/decrypt-reveal.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion) {
  const targets = document.querySelectorAll('h1:not([data-no-decrypt]), h2:not([data-no-decrypt])');
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || seen.has(entry.target)) continue;
      seen.add(entry.target);
      const el = entry.target;
      const finalText = el.textContent;
      DecryptReveal.decode(el, finalText, { duration: 700, charset: 'standard' });
    }
  }, { threshold: 0.5 });
  for (const el of targets) io.observe(el);
}
```

If `DecryptReveal` is a class rather than a static-method holder, instantiate appropriately. Match the actual export.

- [ ] **Step 3: Wire it from site-bootstrap.js**

Replace `// === DecryptReveal headings (sitewide) ===` with:

```javascript
// === DecryptReveal headings (sitewide) ===
import './decrypt-headings.js';
```

- [ ] **Step 4: Commit**

```bash
git add assets/js/decrypt-headings.js assets/js/site-bootstrap.js
git commit -m "feat(site): DecryptReveal H1/H2 animation on scroll-into-view"
```

---

## Task 12: EventBar on index.html

**Files:**
- Modify: `index.html` (add mount element + initial items)
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Inspect EventBar API**

Run:
```bash
sed -n '1,60p' assets/js/corrupted-theme/lib/event-bar.js
```

Identify whether config is passed as `{ items: [...] }` or read from data attributes.

- [ ] **Step 2: Add mount element to index.html**

Place this directly above the existing `<nav class="navbar">` element in `index.html`:

```html
<div id="event-bar" class="event-bar"></div>
```

(If the actual component class is something different, e.g. `corrupted-event-bar`, match what Step 1 confirmed.)

- [ ] **Step 3: Wire EventBar in site-bootstrap.js**

In the Index-only block, after the hero animation, add:

```javascript
const eventBarEl = document.getElementById('event-bar');
if (eventBarEl) {
  const { EventBar } = await import('./corrupted-theme/lib/event-bar.js');
  new EventBar(eventBarEl, {
    items: [
      { text: 'New: Corrupted Theme 0.2.0', href: '/blog/corrupted-theme-v020.html' },
      { text: 'Stream schedule: twitch.tv/whykusanagi', href: 'https://twitch.tv/whykusanagi' },
      { text: 'Latest art drop on the gallery', href: '/art.html' },
    ],
    speed: 'medium',
    pauseOnHover: true,
  }).start();
}
```

Match `start()` / `init()` / no-call-needed to the actual API.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/js/site-bootstrap.js
git commit -m "feat(index): EventBar banner with release/stream/art rotating items"
```

---

## Task 13: ClockWidget on links.html

**Files:**
- Modify: `links.html`
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Inspect ClockWidget API**

```bash
sed -n '1,60p' assets/js/corrupted-theme/lib/clock-widget.js
```

- [ ] **Step 2: Add mount element to links.html**

Read `links.html` and find its footer / bottom-of-main element. Add:

```html
<div id="clock-widget" class="clock-widget"></div>
```

If there is no clear footer, place it just before `</main>`.

- [ ] **Step 3: Wire ClockWidget in site-bootstrap.js**

Add to a `links.html`-only block:

```javascript
// === links.html-only: ClockWidget ===
if (page === 'links' || document.getElementById('clock-widget')) {
  const clockEl = document.getElementById('clock-widget');
  if (clockEl) {
    const { ClockWidget } = await import('./corrupted-theme/lib/clock-widget.js');
    new ClockWidget(clockEl, {
      timezones: ['Asia/Tokyo', 'America/Los_Angeles', 'UTC'],
      labels: ['JP', 'PST', 'UTC'],
      hour12: true,
      cycleMs: 5000,
    }).start();
  }
}
```

(The `data-page` flag is optional — feature detection on `#clock-widget` is sufficient.)

- [ ] **Step 4: Commit**

```bash
git add links.html assets/js/site-bootstrap.js
git commit -m "feat(links): ClockWidget cycling JP/PST/UTC in footer"
```

---

## Task 14: Toast singleton — replace inline copy confirmations

**Files:**
- Modify: `tools.html`, `links.html`, `art.html`
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Identify existing copy / confirmation patterns**

```bash
grep -nE 'navigator\.clipboard|copyToClipboard|onclick="[^"]*copy' tools.html links.html art.html
```

Note each callsite. They are typically inline `onclick` handlers or small `<script>` blocks that show / alert a "Copied!" message.

- [ ] **Step 2: Inspect Toast API**

```bash
sed -n '1,40p' assets/js/corrupted-theme/lib/toast.js
```

Spec says `Toast.show / Toast.success / Toast.error / Toast.info`.

- [ ] **Step 3: Expose Toast globally from site-bootstrap.js**

To allow inline `onclick` handlers to call `Toast.success(...)` without converting every handler to a module, expose the import on `window`. Replace `// === Toast (sitewide singleton — initializes on first use) ===` with:

```javascript
// === Toast (sitewide) ===
import { Toast } from './corrupted-theme/lib/toast.js';
window.Toast = Toast;
```

- [ ] **Step 4: Replace each callsite**

For each callsite from Step 1, change the success path from whatever it currently does (`alert`, custom toast, console log) to:

```javascript
navigator.clipboard.writeText(value).then(
  () => window.Toast?.success('Copied'),
  () => window.Toast?.error('Copy failed'),
);
```

If the page already uses a custom toast DOM element for this, delete that element and its inline CSS — the canonical Toast manages its own DOM.

- [ ] **Step 5: Commit**

```bash
git add tools.html links.html art.html assets/js/site-bootstrap.js
git commit -m "feat(site): Toast singleton replaces ad-hoc copy confirmations"
```

---

## Task 15: NsfwReveal on art.html + wallpapers.html

**Files:**
- Modify: `art.html`, `wallpapers.html`
- Modify: `assets/js/site-bootstrap.js`

- [ ] **Step 1: Inspect NsfwReveal API**

```bash
sed -n '1,60p' assets/js/corrupted-theme/lib/nsfw-reveal.js
```

Confirm how it identifies items to wrap — likely by data attribute (`data-nsfw-reveal`) or a CSS class on the wrap target.

- [ ] **Step 2: Identify NSFW items on art.html and wallpapers.html**

Per CLAUDE.md §6.4, NSFW image filenames contain `_nsfw`, `_lewd`, or `Lewd_`. Grep the rendered HTML:

```bash
grep -nE '_nsfw|_lewd|Lewd_' art.html wallpapers.html
```

Note every `<img>` (or its wrapper element) that points to an NSFW asset.

- [ ] **Step 3: Mark each NSFW item**

For each NSFW item, wrap its `<img>` (or its existing card wrapper) with the attribute the component expects. If the component uses `data-nsfw-reveal`:

```html
<!-- before -->
<div class="card"><img src=".../Cute_Bunny_Lewd_1.png"></div>
<!-- after -->
<div class="card" data-nsfw-reveal><img src=".../Cute_Bunny_Lewd_1.png"></div>
```

If the component is a wrapping component (creates its own `<div>`), follow whatever its docs / source says.

- [ ] **Step 4: Wire NsfwReveal in site-bootstrap.js**

Add:

```javascript
// === art.html / wallpapers.html: NsfwReveal ===
if (document.querySelector('[data-nsfw-reveal]')) {
  const { NsfwReveal } = await import('./corrupted-theme/lib/nsfw-reveal.js');
  document.querySelectorAll('[data-nsfw-reveal]').forEach(el => {
    new NsfwReveal(el, { defaultOpen: true /* site nsfw=true */ }).attach();
  });
}
```

Adapt option names to the actual API.

- [ ] **Step 5: Commit**

```bash
git add art.html wallpapers.html assets/js/site-bootstrap.js
git commit -m "feat(art): NsfwReveal wraps per-item NSFW thumbnails (default-open, site nsfw=true)"
```

---

## Task 16: NSFW canonicalization (`includeLewd` / `lewdMode` → `nsfw`)

Replace deprecated aliases sitewide before they're removed in 0.3.x.

**Files:** any file referencing the deprecated names.

- [ ] **Step 1: Find callsites**

```bash
grep -rln 'includeLewd\|lewdMode' . --include='*.html' --include='*.js' --include='*.json' 2>/dev/null | grep -v node_modules | grep -v 'docs/superpowers/'
```

The site's `corrupted-particles.js` was deleted in Task 8; the only remaining hits should be in current site-bootstrap.js or page-inline scripts. Documentation in `docs/superpowers/` discusses the rename and is not a callsite — exclude it.

- [ ] **Step 2: Rename**

For each hit, rename the key:
- `includeLewd: true` → `nsfw: true`
- `includeLewd: false` → `nsfw: false`
- `lewdMode: true` → `nsfw: true`
- `lewdMode: false` → `nsfw: false`

- [ ] **Step 3: Verify**

Re-run the Step 1 grep. Expected: no output (outside `docs/superpowers/` / `node_modules`).

- [ ] **Step 4: Commit (skip if no changes)**

```bash
git add -u
git commit -m "fix(site): canonicalize NSFW option name (includeLewd/lewdMode -> nsfw)"
```

If `git status` shows nothing staged, skip — there was nothing to rename.

---

## Task 17: Worker CSP check

The Cloudflare Worker at `src/index.js` may set `Content-Security-Policy` headers. If it does, the CDN origin needs to be allowed.

**Files:**
- Modify (conditional): `src/index.js`

- [ ] **Step 1: Inspect Worker for CSP**

```bash
grep -nE 'Content-Security-Policy|style-src|script-src' src/index.js src/lib/*.js 2>/dev/null
```

- [ ] **Step 2: Decide**

- **If no CSP is set:** no change. Skip to Step 4.
- **If CSP is set without `style-src`:** no change needed (CSS loads aren't blocked by an absent `style-src`).
- **If CSP sets `style-src` without `https://cdn.whykusanagi.xyz`:** add it.

- [ ] **Step 3: Apply (only if Step 2 said "add it")**

Edit the CSP value string in `src/index.js` to include `https://cdn.whykusanagi.xyz` in the `style-src` directive. The same-origin CDN does not need `script-src` changes because all theme JS is vendored under `assets/js/`.

- [ ] **Step 4: Commit (skip if no changes)**

```bash
git add src/index.js
git commit -m "fix(worker): allow cdn.whykusanagi.xyz in style-src for theme CSS load"
```

If nothing changed, skip the commit.

---

## Task 18: Blog post — `blog/corrupted-theme-v020.html`

**Files:**
- Create: `blog/corrupted-theme-v020.html`

- [ ] **Step 1: Use the existing blog post as a structural template**

Read `blog/corrupted-theme-design-system.html` end-to-end. The `<head>`, JSON-LD, navbar, video background, and `<body class="has-video-bg blog-article">` shell are the template.

- [ ] **Step 2: Author the new post**

Create `blog/corrupted-theme-v020.html` with the same structural shell (head, JSON-LD, navbar, video bg, main article). For the article body, write **the actual content** (no placeholders) following spec §7 section list:

1. **TL;DR** — 3 bullets:
   - 14 new components (widgets + animation primitives + core utilities).
   - CDN distribution at `cdn.whykusanagi.xyz` / `cdn.nikkers.cc` with same-origin SRI loads.
   - Breaking change: `.container` is now structural-only; opinionated layouts opt in via modifier classes.
2. **0.2.0 as a foundation** — 2–3 paragraphs framing the minor version as a foundational reset: canonical data layer, CDN distribution, drift reconvergence with celeste-tts-bot.
3. **14 new components, organized** — three subsections (Widgets, Animation primitives, Core utilities), each component as a sub-bullet with a one-sentence "what it does." For each one this site adopted, append "→ see it live on [page link]":
   - CRTEffects → `/index.html`
   - TerminalBoot + TitleDecoder → `/index.html` hero
   - PhraseCycle → any page load (loading text)
   - DecryptReveal → any page (H1/H2 on scroll)
   - EventBar → `/index.html`
   - ClockWidget → `/links.html`
   - Toast → `/tools.html`, `/links.html`, `/art.html`
   - NsfwReveal → `/art.html`, `/wallpapers.html`
   - corrupted-particles-background → sitewide
4. **The canonical data layer** — 2 paragraphs on `phrases.json` / `charsets.json` / `colors.json`, AJV validation, Go consumption via `go:embed`.
5. **CDN distribution** — same-origin rule, dual-domain trick, SRI hashes, honest caveat that the current CDN serves dist/ only.
6. **The `.container` breaking change** — explain why (downstream sites fighting the rule) and show this site's migration as a worked example. Include a before/after diff block of `index.html`.
7. **What we changed on this site for 0.2.0** — bulleted list of the integrations with anchors.
8. **What's next** — pulls from the [Unreleased] / planned section of the package CHANGELOG: ES module CDN distribution, Figma, Storybook.

JSON-LD `datePublished`: `2026-05-23`. Headline / description match the post title. Use `https://s3.whykusanagi.xyz/art/MousePad/full-body.png` as the hero image.

Target length: 1500–2000 words.

- [ ] **Step 3: Verify the head loads correctly**

The post must use the new CDN CSS link (Task 5 pattern). Confirm:

```bash
grep -c 'cdn.whykusanagi.xyz/corrupted-theme/@0.2.0' blog/corrupted-theme-v020.html
grep -c '../assets/js/site-bootstrap.js' blog/corrupted-theme-v020.html
```

Expected: `1` and `1`.

- [ ] **Step 4: Commit**

```bash
git add blog/corrupted-theme-v020.html
git commit -m "feat(blog): publish corrupted-theme 0.2.0 release notes"
```

---

## Task 19: Blog index entry

**Files:**
- Modify: `blog/index.html`

- [ ] **Step 1: Read the existing entry pattern**

Look at the first 1–2 `<article class="card">` entries inside `<div class="blog-column scrollable-column">` in `blog/index.html`. They look like:

```html
<article class="card">
  <h2><a href="some-post.html">Post Title</a></h2>
  <p>Description paragraph.</p>
  <p><small>tags, comma, separated</small></p>
</article>
```

- [ ] **Step 2: Insert the new post as the first entry**

Place this immediately inside `<div class="blog-column scrollable-column">`, before whatever currently sits first:

```html
            <article class="card">
              <h2><a href="corrupted-theme-v020.html">Corrupted Theme 0.2.0 — Foundations, Components, and a CDN</a></h2>
              <p>14 new components, a canonical JSON data layer, same-origin CDN distribution with SRI, and the .container breaking change. The 0.2.0 release reframes corrupted-theme as a durable cross-project foundation.</p>
              <p><small>release notes, design system, CDN, SRI, CSS architecture, breaking changes</small></p>
            </article>
```

Match the existing indentation of surrounding `<article>` blocks.

- [ ] **Step 3: Commit**

```bash
git add blog/index.html
git commit -m "docs(blog): index entry for corrupted-theme 0.2.0 release post"
```

---

## Task 20: Manual browser verification

No automated test suite exists; this task runs the site locally and checks every item in the validation checklist.

**Files:** none modified (verification + report only)

- [ ] **Step 1: Start the local server**

Run (in a background-capable way):
```bash
python3 -m http.server 8000
```

Note: per CLAUDE.md §5.5 this deviates from the docker-first default. Justification: the change set is pure static HTML/CSS/JS with no server-side behavior; the Worker runs only in deployed environments. No follow-up Docker task needed.

- [ ] **Step 2: Walk every page in Chrome**

Visit each of:
- `http://localhost:8000/` (index)
- `http://localhost:8000/links.html`
- `http://localhost:8000/tools.html`
- `http://localhost:8000/art.html`
- `http://localhost:8000/wallpapers.html`
- `http://localhost:8000/bastard-hero.html`
- `http://localhost:8000/celeste-lore-faq.html`
- `http://localhost:8000/404.html`
- `http://localhost:8000/celeste.html`
- `http://localhost:8000/blog/`
- `http://localhost:8000/blog/corrupted-theme-v020.html`

For each, with DevTools open:
1. **Network tab**: confirm `theme.min.css` loads from `cdn.whykusanagi.xyz` with status 200 and no integrity violation.
2. **Console**: no errors. No deprecation warnings about `includeLewd` / `lewdMode`.
3. **Visual**: glass panels render; particles render behind blur; no broken layout.

- [ ] **Step 3: Page-specific feature checks**

- `index.html`:
  - [ ] EventBar visible at top, 3 items rotate, pause on hover.
  - [ ] Hero shows TerminalBoot then settles on decoded "whykusanagi" (one-shot, no loop).
  - [ ] CRT scanlines faintly visible.
- `links.html`:
  - [ ] ClockWidget cycles JP / PST / UTC.
- `tools.html` / `links.html` / `art.html`:
  - [ ] Copy-to-clipboard buttons show the canonical Toast.
- `art.html` / `wallpapers.html`:
  - [ ] NSFW items visible by default (site `nsfw: true`).
- Any page with H1/H2:
  - [ ] First in-view H1/H2 decodes once.
- Any page during initial load:
  - [ ] Loading text cycles phrases before settling on "ready".

- [ ] **Step 4: Cross-browser smoke**

Open `http://localhost:8000/` in Safari and Firefox. Confirm no console errors and no layout regression. Mobile viewport check (375px wide) at least on `index.html` and `links.html`.

- [ ] **Step 5: Stop the server**

Kill the http.server process.

- [ ] **Step 6: Report findings**

Write a brief report of the verification pass. If any check failed, file a follow-up task (or fix inline if trivial). Do not mark the implementation complete until all checks in the spec §9 validation list pass or are explicitly waived in writing.

No commit for this task unless inline fixes were applied.

---

## Final commit log shape (expected)

After all tasks:

```
docs(blog): index entry for corrupted-theme 0.2.0 release post
feat(blog): publish corrupted-theme 0.2.0 release notes
[conditional] fix(worker): allow cdn.whykusanagi.xyz in style-src for theme CSS load
[conditional] fix(site): canonicalize NSFW option name (includeLewd/lewdMode -> nsfw)
feat(art): NsfwReveal wraps per-item NSFW thumbnails (default-open, site nsfw=true)
feat(site): Toast singleton replaces ad-hoc copy confirmations
feat(links): ClockWidget cycling JP/PST/UTC in footer
feat(index): EventBar banner with release/stream/art rotating items
feat(site): DecryptReveal H1/H2 animation on scroll-into-view
feat(index): CRTEffects ambient layer + TerminalBoot/TitleDecoder hero animation
feat(loading): PhraseCycle loading text from canonical phrases.json
feat(site): replace custom particle scripts with corrupted-particles-background auto-injector
chore(site): delete vendored assets/css/corrupted-theme/ (CDN-only now)
fix(site): migrate .container usages to 0.2.0 modifier classes
feat(blog): swap blog posts to CDN-loaded corrupted-theme 0.2.0 + bootstrap module
feat(site): swap root HTML to CDN-loaded corrupted-theme 0.2.0 + bootstrap module
feat(site): add site-bootstrap.js skeleton for corrupted-theme 0.2.0 wiring
[conditional] fix(corrupted-theme): sync missing transitive ES module dependencies
feat(corrupted-theme): add sync script and vendor 0.2.0 ES modules
```

15–17 commits. Each one is independently revertable and described.
