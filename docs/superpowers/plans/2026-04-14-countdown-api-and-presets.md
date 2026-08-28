# Countdown URL Params, Hero Image Presets & API Endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the countdown widget's URL parameter system, expand character presets with all thumbnail generator hero images, and add Cloudflare Worker API endpoints for programmatic countdown URL generation.

**Architecture:** Client-side countdown widget gains 4 new URL params by loading JSON preset files (themes, characters, overlays) and merging into config. Characters.json expands from 4 to ~58 entries. Cloudflare Worker gains two new API routes that validate params against the same preset files and return formatted URLs.

**Tech Stack:** Vanilla JavaScript (ES modules), Cloudflare Workers, static JSON config files, S3/R2 CDN for images.

**Design Spec:** `docs/superpowers/specs/2026-04-14-countdown-api-and-presets-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `static/data/countdown/characters.json` | Expand from 4 to ~58 character presets |
| Modify | `assets/js/countdown-widget.js:152-228` | Add preset loading helpers, make applyUrlOverrides async |
| Modify | `assets/js/countdown-widget.js:300-311` | Apply theme colors to title/timer elements |
| Modify | `assets/js/countdown-widget.js:537-538` | Await async applyUrlOverrides |
| Modify | `src/index.js:18-36` | Add /api/countdown/* route handlers |
| Create | `src/lib/countdown-api.js` | Handler functions for countdown API endpoints |

---

## Sub-project 1: Complete URL Params + Hero Image Presets

---

### Task 1: Expand characters.json with thumbnail generator images

**Files:**
- Modify: `static/data/countdown/characters.json`

**Context:** The thumbnail generator has ~57 images in `CHARACTER_IMAGES` array at `tools/thumbnail-generator/index.html:2001-2061`. These are stored on S3 at `s3.whykusanagi.xyz/tools/thumbnail-generator/assets/characters/`. The countdown widget resolves asset paths through `resolveAssetPath()` which prepends the S3 endpoint.

- [ ] **Step 1: Replace characters.json with expanded presets**

Replace the entire contents of `static/data/countdown/characters.json` with:

```json
{
  "celeste": {
    "name": "Celeste",
    "image": "art/Celeste_Vel_Icon.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "kirara": {
    "name": "Kirara",
    "image": "art/Fall_of_Kirara.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "bastard-hero": {
    "name": "Bastard Hero",
    "image": "art/bastard_hero.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "original"
  },
  "abyssal-conquest": {
    "name": "Abyssal Conquest",
    "image": "tools/thumbnail-generator/assets/characters/Abyssal_Conquest.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "abyssal-conquest-2k": {
    "name": "Abyssal Conquest 2K",
    "image": "tools/thumbnail-generator/assets/characters/Abyssal_Conquest2k.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "bodycon-standing": {
    "name": "Bodycon Standing",
    "image": "tools/thumbnail-generator/assets/characters/bodycon_standing_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "celeste-legs": {
    "name": "Celeste Legs",
    "image": "tools/thumbnail-generator/assets/characters/Celeste_Legs.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "celeste-demonic": {
    "name": "Celeste Demonic",
    "image": "tools/thumbnail-generator/assets/characters/celeste_demonic_slut_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "celeste-shimiko-cosplay": {
    "name": "Shimiko Cosplay",
    "image": "tools/thumbnail-generator/assets/characters/celeste_shimiko_cosplay_upper_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "celeste-pierced-dress": {
    "name": "Pierced Dress",
    "image": "tools/thumbnail-generator/assets/characters/celeste_skimpy_pierced_dress_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "celeste-ninkoro-bunny": {
    "name": "Ninkoro Bunny",
    "image": "tools/thumbnail-generator/assets/characters/CelesteNinkoroBunny_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "dongtan-style": {
    "name": "Dongtan Style",
    "image": "tools/thumbnail-generator/assets/characters/dongtan_style_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "dongtan-style-nsfw": {
    "name": "Dongtan Style NSFW",
    "image": "tools/thumbnail-generator/assets/characters/dongtan_style_nsfw_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "doroseggs": {
    "name": "Doroseggs",
    "image": "tools/thumbnail-generator/assets/characters/doroseggstrans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "demon-queen": {
    "name": "Demon Queen",
    "image": "tools/thumbnail-generator/assets/characters/high_quality_demon_queen_full_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "magical-girl-back": {
    "name": "Magical Girl (Back)",
    "image": "tools/thumbnail-generator/assets/characters/lewd_magical_girl_back_detailed.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "magical-girl-front": {
    "name": "Magical Girl (Front)",
    "image": "tools/thumbnail-generator/assets/characters/lewd_magical_girl_front_detailed.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "magia-baiser-cosplay": {
    "name": "Magia Baiser Cosplay",
    "image": "tools/thumbnail-generator/assets/characters/magia_baiser_cosplay_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "nurse-celeste": {
    "name": "Nurse Celeste",
    "image": "tools/thumbnail-generator/assets/characters/nurse_celeste_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "nurse-celeste-nsfw": {
    "name": "Nurse Celeste NSFW",
    "image": "tools/thumbnail-generator/assets/characters/nurse_celeste_nsfw_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "race-queen": {
    "name": "Race Queen",
    "image": "tools/thumbnail-generator/assets/characters/race_queen_owari_cosplay_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "recluse-witch": {
    "name": "Recluse Witch",
    "image": "tools/thumbnail-generator/assets/characters/recluse_witch_cosplay_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "sexy-cow": {
    "name": "Cow Outfit",
    "image": "tools/thumbnail-generator/assets/characters/sexy_cow_outfit.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "kirara-cosplay": {
    "name": "Kirara Cosplay",
    "image": "tools/thumbnail-generator/assets/characters/sexy_kirara_cosplay_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "wedding-outfit": {
    "name": "Wedding Outfit",
    "image": "tools/thumbnail-generator/assets/characters/skimpy_wedding_outfit_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "swimsuit": {
    "name": "Swimsuit",
    "image": "tools/thumbnail-generator/assets/characters/slutty_swimsuit_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "summer-doro-cosplay": {
    "name": "Summer Doro Cosplay",
    "image": "tools/thumbnail-generator/assets/characters/summer_doro_cosplay_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "velvet-maid": {
    "name": "Velvet Maid",
    "image": "tools/thumbnail-generator/assets/characters/velvet_maid_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "witch": {
    "name": "Witch",
    "image": "tools/thumbnail-generator/assets/characters/witch_transparent.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "fullbody"
  },
  "tarot-bikini-maid": {
    "name": "Tarot: Bikini Maid",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/bikini_maid_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-bodycon": {
    "name": "Tarot: Bodycon",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/bodycon_laying_side_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-cow-bikini": {
    "name": "Tarot: Cow Bikini",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/celeste_cow_bikini_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-shimakaze": {
    "name": "Tarot: Shimakaze",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/celeste_shimakaze_card_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-devil-sister": {
    "name": "Tarot: Devil Sister",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/devil_sister_illustration_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-shower": {
    "name": "Tarot: Shower Scene",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/naked_shower_scene_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-sacrificial-bride": {
    "name": "Tarot: Sacrificial Bride",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/sacrifical_bride_outfit_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-sexmas-bunny": {
    "name": "Tarot: Sexmas Bunny",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/sexmas_bunny_celeste_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-nurse": {
    "name": "Tarot: Nurse",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/sexy_nurse_celeste_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-race-queen": {
    "name": "Tarot: Race Queen",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/sexy_race_queen_celeste_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-shimiko": {
    "name": "Tarot: Shimiko",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/shimiko_outfit_celeste_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-swimsuit": {
    "name": "Tarot: Swimsuit",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/skimpy_swimsuit_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-slave-gear": {
    "name": "Tarot: Slave Gear",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/slave_gear_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-jk-cat": {
    "name": "Tarot: JK Cat",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/slutty_jk_cat_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "tarot-tentacle-chair": {
    "name": "Tarot: Tentacle Chair",
    "image": "tools/thumbnail-generator/assets/characters/tarot_cards/tentacle_gaming_chair_trans.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "tarot"
  },
  "headshot-awake": {
    "name": "Expression: Awake",
    "image": "tools/thumbnail-generator/assets/characters/headshots/awake.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-bust": {
    "name": "Expression: Bust",
    "image": "tools/thumbnail-generator/assets/characters/headshots/bust.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-cat-face": {
    "name": "Expression: Cat Face",
    "image": "tools/thumbnail-generator/assets/characters/headshots/cat_face.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-consider": {
    "name": "Expression: Consider",
    "image": "tools/thumbnail-generator/assets/characters/headshots/consider.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-dame": {
    "name": "Expression: Dame",
    "image": "tools/thumbnail-generator/assets/characters/headshots/dame.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-excited": {
    "name": "Expression: Excited",
    "image": "tools/thumbnail-generator/assets/characters/headshots/excited.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-gasm": {
    "name": "Expression: Gasm",
    "image": "tools/thumbnail-generator/assets/characters/headshots/gasm.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-glare": {
    "name": "Expression: Glare",
    "image": "tools/thumbnail-generator/assets/characters/headshots/glare.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-lick": {
    "name": "Expression: Lick",
    "image": "tools/thumbnail-generator/assets/characters/headshots/lick.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-oxo": {
    "name": "Expression: OxO",
    "image": "tools/thumbnail-generator/assets/characters/headshots/OxO.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-postgasm": {
    "name": "Expression: Postgasm",
    "image": "tools/thumbnail-generator/assets/characters/headshots/postgasm.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-pout": {
    "name": "Expression: Pout",
    "image": "tools/thumbnail-generator/assets/characters/headshots/pout.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-shocked": {
    "name": "Expression: Shocked",
    "image": "tools/thumbnail-generator/assets/characters/headshots/shocked.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-shy": {
    "name": "Expression: Shy",
    "image": "tools/thumbnail-generator/assets/characters/headshots/shy.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-teasing": {
    "name": "Expression: Teasing",
    "image": "tools/thumbnail-generator/assets/characters/headshots/teasing.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "headshot-wow": {
    "name": "Expression: Wow",
    "image": "tools/thumbnail-generator/assets/characters/headshots/wow.png",
    "objectPosition": "center center",
    "rotation": 0,
    "category": "headshot"
  },
  "none": {
    "name": "No Character",
    "image": null,
    "category": "utility"
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('static/data/countdown/characters.json')); print('Valid JSON, entries:', len(json.load(open('static/data/countdown/characters.json'))))"`
Expected: `Valid JSON, entries: 58`

- [ ] **Step 3: Commit**

```bash
git add static/data/countdown/characters.json
git commit -m "feat(countdown): expand character presets with thumbnail generator images

Add 54 hero images from the thumbnail generator to countdown character
presets. Organized by category: original (3), fullbody (26), tarot (15),
headshot (16), utility (1). Total: 58 presets (was 4)."
```

---

### Task 2: Add preset loading helpers to countdown-widget.js

**Files:**
- Modify: `assets/js/countdown-widget.js:171` (after `resolveAssetPath`, before CONFIG LOADING section)

**Context:** The widget needs three new async functions that fetch JSON preset files and merge values into the config object. These follow the same pattern as `loadConfigFromJson()` at line 183 but load from fixed filenames (themes.json, characters.json, overlays.json) rather than event-named files.

- [ ] **Step 1: Add loadPresetFile helper**

Insert after line 171 (after `resolveAssetPath` function, before the `CONFIG LOADING` comment section):

```javascript

/**
 * Loads a JSON preset file from the countdown data directory
 * @private
 * @param {string} filename - Preset filename (e.g., 'themes.json')
 * @returns {Promise<Object|null>} Parsed JSON or null on failure
 */
async function loadPresetFile(filename) {
  const basePath = WIDGET_OPTIONS.configPath || 'static/data/countdown';
  try {
    const response = await fetch(`${basePath}/${filename}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(`[CountdownWidget] Failed to load preset ${filename}:`, error);
    return null;
  }
}

/**
 * Applies a theme color preset to the config
 * @private
 * @param {CountdownConfig} config - Config to modify in place
 * @param {string} themeName - Theme key from themes.json
 */
async function applyThemePreset(config, themeName) {
  const themes = await loadPresetFile('themes.json');
  if (!themes) return;
  const theme = themes[themeName];
  if (!theme) return;
  config.colors = { ...config.colors, ...theme.colors };
}

/**
 * Applies a character image preset to the config
 * @private
 * @param {CountdownConfig} config - Config to modify in place
 * @param {string} characterName - Character key from characters.json
 */
async function applyCharacterPreset(config, characterName) {
  const characters = await loadPresetFile('characters.json');
  if (!characters) return;
  const character = characters[characterName];
  if (!character) return;
  config.character = config.character || {};
  if (character.image !== undefined) config.character.image = character.image;
  if (character.objectPosition) config.character.objectPosition = character.objectPosition;
  if (character.rotation !== undefined) config.character.rotation = character.rotation;
}

/**
 * Applies an overlay preset to the config
 * @private
 * @param {CountdownConfig} config - Config to modify in place
 * @param {string} overlayName - Overlay key from overlays.json
 */
async function applyOverlayPreset(config, overlayName) {
  const overlays = await loadPresetFile('overlays.json');
  if (!overlays) return;
  const overlay = overlays[overlayName];
  if (!overlay) return;
  config.character = config.character || {};
  config.character.overlay = overlay.image ? {
    image: overlay.image,
    position: overlay.position,
    animation: overlay.animation
  } : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/countdown-widget.js
git commit -m "feat(countdown): add preset loading helpers for themes, characters, overlays"
```

---

### Task 3: Make applyUrlOverrides async with new params

**Files:**
- Modify: `assets/js/countdown-widget.js:218-228` (applyUrlOverrides function)
- Modify: `assets/js/countdown-widget.js:538` (await the call)

**Context:** `applyUrlOverrides()` is currently sync and only handles `date` and `title`. It needs to become async to load preset JSON files for `theme`, `character`, `overlay`, and `shape` params. The function is called at line 538 inside the async `initCountdown()` function.

- [ ] **Step 1: Replace applyUrlOverrides with async version**

Replace the function at lines 218-228:

```javascript
/**
 * Merges config with URL parameter overrides
 * Preset-based params (theme, character, overlay) load JSON files.
 * Scalar params (date, title) override directly.
 * @private
 * @param {CountdownConfig} config - Base config (modified in place)
 * @returns {Promise<CountdownConfig>}
 */
async function applyUrlOverrides(config) {
  // Preset-based overrides (load JSON, merge into config)
  const themeParam = getUrlParam('theme');
  if (themeParam) await applyThemePreset(config, themeParam);

  const characterParam = getUrlParam('character');
  if (characterParam) await applyCharacterPreset(config, characterParam);

  const overlayParam = getUrlParam('overlay');
  if (overlayParam) await applyOverlayPreset(config, overlayParam);

  const shapeParam = getUrlParam('shape');
  if (shapeParam) {
    const validShapes = ['diamond', 'circle', 'hexagon', 'star', 'heart'];
    if (validShapes.includes(shapeParam)) {
      config.character = config.character || {};
      config.character.background = config.character.background || {};
      config.character.background.type = shapeParam;
    }
  }

  // Scalar overrides (always win over presets)
  const dateOverride = getUrlParam('date');
  if (dateOverride) config.eventDate = dateOverride;

  const titleOverride = getUrlParam('title');
  if (titleOverride) config.title = decodeURIComponent(titleOverride);

  return config;
}
```

- [ ] **Step 2: Update initCountdown to await applyUrlOverrides**

At line 538, change:

```javascript
    config = applyUrlOverrides(config);
```

to:

```javascript
    config = await applyUrlOverrides(config);
```

This is safe because `initCountdown` is already `async` (line 510).

- [ ] **Step 3: Commit**

```bash
git add assets/js/countdown-widget.js
git commit -m "feat(countdown): implement theme/character/overlay/shape URL params

applyUrlOverrides is now async. Loads preset JSON files for theme,
character, overlay params. Validates shape against allowed list.
Scalar params (date, title) override preset values."
```

---

### Task 4: Apply theme colors in renderWidget

**Files:**
- Modify: `assets/js/countdown-widget.js:300-311` (inside renderWidget, countdown box section)

**Context:** The design spec requires theme colors to be applied as inline styles on the title and timer elements. This fixes the grey title text and pink-on-pink contrast issues. The `config.colors` object has `title` and `countdown` color keys set by `applyThemePreset()`.

- [ ] **Step 1: Add color application after countdown box creation**

Replace lines 300-312 (the countdown box section) with:

```javascript
  // Countdown box
  const countdownBox = document.createElement('div');
  countdownBox.className = 'countdown-box';
  countdownBox.innerHTML = `
    <div class="countdown-title">${escapeHtml(config.title)}</div>
    <div class="countdown-timer">
      <span class="unit days">--</span><span class="separator">D</span>
      <span class="unit hours">--</span><span class="separator">H</span>
      <span class="unit minutes">--</span><span class="separator">M</span>
      <span class="unit seconds">--</span><span class="separator">S</span>
    </div>
  `;

  // Apply theme colors to title and timer
  if (config.colors?.title) {
    const titleEl = countdownBox.querySelector('.countdown-title');
    if (titleEl) titleEl.style.color = config.colors.title;
  }
  if (config.colors?.countdown) {
    const timerEl = countdownBox.querySelector('.countdown-timer');
    if (timerEl) timerEl.style.color = config.colors.countdown;
  }

  wrapper.appendChild(countdownBox);
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/countdown-widget.js
git commit -m "feat(countdown): apply theme colors to title and timer elements

Theme presets now control title and countdown timer text colors via
inline styles. Fixes grey title text and pink-on-pink contrast issues."
```

---

### Task 5: Manual browser verification of Sub-project 1

- [ ] **Step 1: Start dev server**

```bash
cd /Users/kusanagi/Development/site && python3 -m http.server 8000
```

- [ ] **Step 2: Test basic event preset (existing functionality)**

Open: `http://localhost:8000/countdown.html?event=kirara`
Expected: Kirara countdown renders with diamond shape, character image, countdown timer.

- [ ] **Step 3: Test theme parameter**

Open: `http://localhost:8000/countdown.html?event=kirara&theme=abyss`
Expected: Same countdown but title text uses pink (#e86ca8) and countdown uses white (#f5f1f8) per abyss theme.

- [ ] **Step 4: Test character parameter with new hero image**

Open: `http://localhost:8000/countdown.html?event=default&character=nurse-celeste&date=2026-12-31T23:59:59-08:00`
Expected: Nurse Celeste image loads from S3 thumbnail-generator path. Character displays in shape container.

- [ ] **Step 5: Test shape parameter**

Open: `http://localhost:8000/countdown.html?event=default&character=headshot-excited&shape=circle&date=2026-12-31T23:59:59-08:00`
Expected: Circle shape container instead of diamond.

- [ ] **Step 6: Test overlay parameter**

Open: `http://localhost:8000/countdown.html?event=default&character=celeste-legs&overlay=tentacle&shape=hexagon&date=2026-12-31T23:59:59-08:00`
Expected: Tentacle overlay appears behind character with float animation.

- [ ] **Step 7: Test full combo with all params**

Open: `http://localhost:8000/countdown.html?event=kirara&theme=sakura&character=demon-queen&overlay=tentacle&shape=star&title=Custom+Title&date=2026-06-15T19:00:00-07:00`
Expected: All overrides applied — sakura colors, demon queen character, tentacle overlay, star shape, custom title, custom date.

- [ ] **Step 8: Test invalid params (graceful fallback)**

Open: `http://localhost:8000/countdown.html?event=kirara&character=nonexistent&theme=fake&shape=triangle`
Expected: Kirara preset loads normally. Invalid character/theme/shape silently ignored. No console errors (only warnings).

- [ ] **Step 9: Test expired countdown**

Open: `http://localhost:8000/countdown.html?event=default&character=headshot-pout&date=2020-01-01T00:00:00-08:00&title=Past+Event`
Expected: Shows "Event is Live!" completion message.

---

## Sub-project 2: Countdown API Endpoint

---

### Task 6: Create countdown API handler module

**Files:**
- Create: `src/lib/countdown-api.js`

**Context:** The Cloudflare Worker at `src/index.js` routes requests. API handler logic goes in `src/lib/` following the existing pattern (`celeste-proxy.js`). This module exports two handler functions for the countdown API endpoints.

The Worker cannot fetch from `whykusanagi.xyz` (would route back through itself). Instead, it fetches preset JSON from the S3/R2 origin at `https://s3.whykusanagi.xyz/static/data/countdown/`.

- [ ] **Step 1: Create the handler module**

Create `src/lib/countdown-api.js`:

```javascript
/**
 * Countdown API Handlers
 * Cloudflare Worker endpoints for programmatic countdown URL generation.
 *
 * GET  /api/countdown/presets  — List available characters, themes, overlays, shapes
 * POST /api/countdown/generate — Validate params and return a formatted countdown URL
 */

const PRESET_BASE_URL = 'https://s3.whykusanagi.xyz/static/data/countdown';
const COUNTDOWN_BASE_URL = 'https://whykusanagi.xyz/countdown.html';
const VALID_SHAPES = ['diamond', 'circle', 'hexagon', 'star', 'heart'];
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Fetch a preset JSON file from S3 origin with caching
 * @param {string} filename - e.g., 'characters.json'
 * @returns {Promise<Object|null>}
 */
async function fetchPreset(filename) {
  try {
    const response = await fetch(`${PRESET_BASE_URL}/${filename}`, {
      cf: { cacheTtl: 300 }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch preset ${filename}:`, error);
    return null;
  }
}

/**
 * GET /api/countdown/presets
 * Returns all available presets for consumers to discover options.
 */
export async function handleCountdownPresets(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const [characters, themes, overlays] = await Promise.all([
    fetchPreset('characters.json'),
    fetchPreset('themes.json'),
    fetchPreset('overlays.json'),
  ]);

  const body = {
    characters: characters || {},
    themes: themes || {},
    overlays: overlays || {},
    shapes: VALID_SHAPES,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...CORS_HEADERS,
    },
  });
}

/**
 * POST /api/countdown/generate
 * Validates params against preset files and returns a formatted countdown URL.
 *
 * Request body (all fields optional):
 *   { event, theme, character, overlay, shape, date, title }
 *
 * Response:
 *   { url, params, warnings }
 */
export async function handleCountdownGenerate(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const [characters, themes, overlays] = await Promise.all([
    fetchPreset('characters.json'),
    fetchPreset('themes.json'),
    fetchPreset('overlays.json'),
  ]);

  const params = {};
  const warnings = [];

  // Validate event (check if preset file exists)
  if (body.event) {
    const eventData = await fetchPreset(`${body.event}.json`);
    if (eventData) {
      params.event = body.event;
    } else {
      warnings.push(`event '${body.event}' not found in presets, ignored`);
    }
  }

  // Validate theme
  if (body.theme) {
    if (themes && themes[body.theme]) {
      params.theme = body.theme;
    } else {
      warnings.push(`theme '${body.theme}' not found in presets, ignored`);
    }
  }

  // Validate character
  if (body.character) {
    if (characters && characters[body.character]) {
      params.character = body.character;
    } else {
      warnings.push(`character '${body.character}' not found in presets, ignored`);
    }
  }

  // Validate overlay
  if (body.overlay) {
    if (overlays && overlays[body.overlay]) {
      params.overlay = body.overlay;
    } else {
      warnings.push(`overlay '${body.overlay}' not found in presets, ignored`);
    }
  }

  // Validate shape
  if (body.shape) {
    if (VALID_SHAPES.includes(body.shape)) {
      params.shape = body.shape;
    } else {
      warnings.push(`shape '${body.shape}' not valid (options: ${VALID_SHAPES.join(', ')}), ignored`);
    }
  }

  // Validate date (ISO8601)
  if (body.date) {
    const parsed = new Date(body.date);
    if (!isNaN(parsed.getTime())) {
      params.date = body.date;
    } else {
      warnings.push(`date '${body.date}' is not valid ISO8601, ignored`);
    }
  }

  // Validate title (sanitize)
  if (body.title) {
    const sanitized = String(body.title).replace(/<[^>]*>/g, '').substring(0, 200);
    if (sanitized.length > 0) {
      params.title = sanitized;
    }
  }

  // Build URL
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    urlParams.set(key, value);
  }

  const url = urlParams.toString()
    ? `${COUNTDOWN_BASE_URL}?${urlParams.toString()}`
    : COUNTDOWN_BASE_URL;

  return new Response(JSON.stringify({ url, params, warnings }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/countdown-api.js
git commit -m "feat(api): add countdown URL generation and presets handlers

Two new Cloudflare Worker handlers:
- handleCountdownPresets: GET /api/countdown/presets
- handleCountdownGenerate: POST /api/countdown/generate
Validates params against S3-hosted preset JSON files."
```

---

### Task 7: Wire countdown API routes into Worker

**Files:**
- Modify: `src/index.js:10` (add import)
- Modify: `src/index.js:18-21` (add route handlers before existing /api/chat)

- [ ] **Step 1: Add import at top of file**

After line 10 (`import { handleProxyRequest } from './lib/celeste-proxy.js';`), add:

```javascript
import { handleCountdownPresets, handleCountdownGenerate } from './lib/countdown-api.js';
```

- [ ] **Step 2: Add route handlers**

Insert after line 17 (inside the `fetch` handler, before the `/api/chat` check), add:

```javascript
      // Countdown API endpoints
      if (url.pathname === '/api/countdown/presets') {
        return handleCountdownPresets(request);
      }
      if (url.pathname === '/api/countdown/generate') {
        return handleCountdownGenerate(request);
      }
```

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat(api): wire countdown API routes into Cloudflare Worker

Routes /api/countdown/presets (GET) and /api/countdown/generate (POST)
to the new countdown-api.js handler module."
```

---

### Task 8: Manual API verification

- [ ] **Step 1: Start Wrangler dev server**

```bash
cd /Users/kusanagi/Development/site && npx wrangler dev
```

Expected: Worker starts on `http://localhost:8787`

- [ ] **Step 2: Test presets endpoint**

```bash
curl -s http://localhost:8787/api/countdown/presets | python3 -m json.tool | head -30
```

Expected: JSON with `characters` (58 entries), `themes` (3 entries), `overlays` (2 entries), `shapes` (5 entries).

- [ ] **Step 3: Test generate endpoint with valid params**

```bash
curl -s -X POST http://localhost:8787/api/countdown/generate \
  -H "Content-Type: application/json" \
  -d '{"character":"nurse-celeste","theme":"abyss","shape":"circle","date":"2026-12-31T23:59:59-08:00","title":"New Year Stream"}' | python3 -m json.tool
```

Expected:
```json
{
  "url": "https://whykusanagi.xyz/countdown.html?character=nurse-celeste&theme=abyss&shape=circle&date=2026-12-31T23%3A59%3A59-08%3A00&title=New+Year+Stream",
  "params": {
    "character": "nurse-celeste",
    "theme": "abyss",
    "shape": "circle",
    "date": "2026-12-31T23:59:59-08:00",
    "title": "New Year Stream"
  },
  "warnings": []
}
```

- [ ] **Step 4: Test generate with invalid params**

```bash
curl -s -X POST http://localhost:8787/api/countdown/generate \
  -H "Content-Type: application/json" \
  -d '{"character":"hacker","theme":"evil","shape":"triangle","date":"not-a-date","title":"Test"}' | python3 -m json.tool
```

Expected: URL with only `title=Test` (all others invalid). Warnings array lists each invalid param.

- [ ] **Step 5: Test generate with event preset**

```bash
curl -s -X POST http://localhost:8787/api/countdown/generate \
  -H "Content-Type: application/json" \
  -d '{"event":"kirara","theme":"sakura"}' | python3 -m json.tool
```

Expected: URL with `event=kirara&theme=sakura`. No warnings.

- [ ] **Step 6: Test CORS preflight**

```bash
curl -s -X OPTIONS http://localhost:8787/api/countdown/generate \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" -I
```

Expected: 204 response with `Access-Control-Allow-Origin: *`.

- [ ] **Step 7: Verify existing endpoints still work**

```bash
curl -s http://localhost:8787/api/health | python3 -m json.tool
```

Expected: Health check returns `{ "status": "ok", ... }`.

---

## What Was NOT Implemented (and Why)

| Item | Reason |
|------|--------|
| `?popup=false` param | Not in spec. Future enhancement. |
| `?compact=true` param | Not in spec. Future enhancement. |
| Server-side rendering (PNG) | Out of scope. Sub-project 2 is URL generation only. |
| MCP tool wrapper | Out of scope. HTTP API is the universal interface. |
| configPath fix (`data/countdown` vs `static/data/countdown`) | Deployment-specific. Verify during testing and fix if needed. |
