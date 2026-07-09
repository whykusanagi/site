#!/usr/bin/env bash
# Sync the @whykusanagi/corrupted-theme ES module subset into assets/js/corrupted-theme/.
#
# CSS is loaded from cdn.whykusanagi.xyz/.../dist/theme.min.css (real bundle as of 0.2.1).
# JS is vendored because the CDN ships dist/ only — the ES module components we
# import from site-bootstrap.js are not yet on the CDN.
#
# Data layer: both the canonical *.json (for reference / cross-language consumers)
# and the codegen *.data.js modules (which the JS imports use as of 0.2.1's
# `import x from '../data/foo.data.js'` switch — replaces 0.2.0's broken
# `import x from '../data/foo.json' with { type: 'json' }` that only parsed in
# Chromium 123+).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PKG="node_modules/@whykusanagi/corrupted-theme"
DEST="assets/js/corrupted-theme"

if [ ! -d "$PKG" ]; then
  echo "Run 'npm install' first" >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "node is required (use 'node -p' to read package.json version)" >&2; exit 1; }
VERSION=$(node -p "require('./$PKG/package.json').version")

rm -rf "$DEST"
mkdir -p "$DEST/core" "$DEST/lib" "$DEST/data"

CORE_FILES=(timer-registry.js event-tracker.js decrypt-reveal.js corruption-charsets.js random-utils.js time-utils.js corruption-phrases.js)
for f in "${CORE_FILES[@]}"; do
  cp "$PKG/src/core/$f" "$DEST/core/$f"
done

LIB_FILES=(crt-effects.js animation-blocks.js phrase-cycle.js event-bar.js
           clock-widget.js toast.js nsfw-reveal.js corrupted-particles-background.js corrupted-particles.js)
for f in "${LIB_FILES[@]}"; do
  cp "$PKG/src/lib/$f" "$DEST/lib/$f"
done

# Data: copy both canonical JSON and the codegen *.data.js modules (0.2.1+).
DATA_FILES=(phrases.json charsets.json colors.json phrases.data.js charsets.data.js colors.data.js)
for f in "${DATA_FILES[@]}"; do
  cp "$PKG/src/data/$f" "$DEST/data/$f"
done

echo "$VERSION" > "$DEST/VERSION"
echo "Synced corrupted-theme $VERSION to $DEST"
