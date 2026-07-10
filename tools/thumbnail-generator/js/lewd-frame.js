/**
 * Lewd Frame Overlay — corrupted-text hidden message in a magenta border.
 *
 * Two layers:
 *   1) A solid rounded-rect stroke with outer glow — the visible border
 *      that anchors the image and makes it pop on X dark mode.
 *   2) Phrase fragments packed end-to-end along the same path, each
 *      rotated to the local tangent, drawn with a cyan/black RGB-split
 *      shadow on top of the stroke. From a distance the border reads
 *      as a clean magenta line; up close it's a stream of Japanese /
 *      romaji / English fragments — a hidden message in the border,
 *      same vibe as the corrupted-particles effect elsewhere on the site.
 *
 * Phrase pools below are the offline fallback — trimmed/curated copies of
 * corrupted-theme's corruption phrases. At load we hydrate them in place from
 * the canonical CDN JSON (@whykusanagi/corrupted-theme/data/phrases.json) so
 * they stay in sync without a build step; if the fetch fails we keep these.
 */

// ---- Phrase pools -----------------------------------------------------------

export const LEWD_PHRASES_NSFW = [
    // Japanese — short fragments
    '変態',
    'えっち',
    'もっと... ♥',
    '壊れちゃう...',
    '感じちゃう...',
    '頭...溶ける...',
    '全部...あなたの...',
    'もう戻れない...',
    'ずっと...♥',
    'やめて... ♥',
    // Romaji
    'motto~ ♥',
    'kowarechau~',
    'hentai~',
    'ecchi~',
    'kanjichau~',
    'suki ni shite~',
    'atama tokete iku~',
    // English
    "Mind melting... ♥",
    "Yours completely... ♥",
    "Don't stop... ♥",
    "Drowning in pleasure...",
    "Losing myself...",
    "More... I need more... ♥",
    // System messages
    'PLEASURE PROTOCOLS LOADING...',
    'SHAME.EXE DELETED',
    'INHIBITION FIREWALL: BREACHED',
    'CORRUPTION LEVEL: CRITICAL',
    'LUST OVERFLOW DETECTED',
    'SELF-CONTROL: 0%',
    'MORAL SUBROUTINES: DISABLED',
    'DESIRE MATRIX: UNSTABLE',
];

export const LEWD_PHRASES_SFW = [
    // Japanese
    'かわいい',
    'きゃー',
    'うふふ',
    'デレデレ',
    'ドキドキ...',
    'ばか~',
    'えへへ',
    'にゃー',
    // Romaji
    'ara ara~',
    'fufufu~',
    'kyaa~',
    'nyaa~',
    'baka~',
    'ehehe~',
    // Internet culture
    '<3',
    'uwu',
    'owo',
    '>w<',
    '^w^',
    '♡',
    // Atmospheric
    'The abyss calls...',
    'Reality melting...',
    'CORRUPTION ACTIVE',
    'Boundaries blurring...',
    'Welcome to the abyss',
];

// ---- Canonical CDN hydration ------------------------------------------------
// corrupted-theme ships the full pools at this path. We hydrate the arrays in
// place on load so pickLewdFramePhrases (which copies the pool each call) picks
// up canonical phrases once resolved. Non-blocking: callers before resolution —
// and any offline session — get the inline fallback above.
const PHRASES_JSON_URL = 'https://cdn.whykusanagi.xyz/corrupted-theme/@latest/data/phrases.json';

// phrases.json section shape: { japanese|romaji|english: { category: string[] } }
function flattenPhraseSection(section) {
    const out = [];
    for (const lang of Object.values(section || {})) {
        for (const arr of Object.values(lang || {})) {
            if (Array.isArray(arr)) out.push(...arr);
        }
    }
    return out;
}

fetch(PHRASES_JSON_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
        const nsfw = flattenPhraseSection(d.nsfw);
        const sfw = flattenPhraseSection(d.sfw);
        if (nsfw.length) { LEWD_PHRASES_NSFW.length = 0; LEWD_PHRASES_NSFW.push(...nsfw); }
        if (sfw.length) { LEWD_PHRASES_SFW.length = 0; LEWD_PHRASES_SFW.push(...sfw); }
    })
    .catch(() => { /* CDN down / offline — inline fallback stays */ });

// Visual separators packed between phrases so the line reads as one
// continuous corrupted stream rather than disconnected captions.
const LEWD_FRAME_SEPARATORS = [
    '  ●  ',
    '  ♥  ',
    '  ◈  ',
    '  /  ',
    '  ::  ',
    '  ▪  ',
];

// ---- Color presets ----------------------------------------------------------

export const LEWD_FRAME_COLOR_PRESETS = Object.freeze({
    magenta: {
        gradient: null,
        solid:    '#ff82d9',
        glow:     'rgba(217, 79, 144, 0.65)',
    },
    purple: {
        gradient: null,
        solid:    '#b08aff',
        glow:     'rgba(139, 92, 246, 0.65)',
    },
    dual: {
        gradient: ['#ff82d9', '#b08aff'],
        solid:    '#ff82d9',
        glow:     'rgba(180, 92, 220, 0.65)',
    },
    crimson: {
        gradient: null,
        solid:    '#ff5f8f',
        glow:     'rgba(255, 64, 96, 0.65)',
    },
    cyan: {
        gradient: null,
        solid:    '#7ef0ff',
        glow:     'rgba(0, 255, 255, 0.55)',
    },
});

// ---- Defaults ---------------------------------------------------------------

export const LEWD_FRAME_DEFAULTS = Object.freeze({
    enabled:      false,
    nsfw:         true,        // default to spicy per project brief
    showPhrases:  true,
    colorPreset:  'dual',
    fontSize:     28,          // px at 1080-tall canvas — controls border "thickness"
    inset:        24,
    cornerRadius: 36,
    glow:         true,
    phrases:      [],          // shuffled string[] — re-rolled on shuffle / nsfw / enable
});

// ---- Helpers ----------------------------------------------------------------

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Roll a shuffled list of phrases. The list is consumed sequentially
 * around the perimeter at draw time; if the perimeter is longer than
 * the list, drawLewdFrame loops back to the start.
 */
export function pickLewdFramePhrases(nsfw, _options = {}) {
    const pool = nsfw ? LEWD_PHRASES_NSFW : LEWD_PHRASES_SFW;
    if (!pool.length) return [];
    // Fisher-Yates shuffle a copy.
    const out = pool.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function buildPerimeter(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    const arcLen = (Math.PI / 2) * radius;
    const sideX  = Math.max(w - 2 * radius, 0);
    const sideY  = Math.max(h - 2 * radius, 0);
    // Walked clockwise starting at the top side, just past the top-left corner.
    const segments = [
        { type: 'line', x0: x + radius,     y0: y,            x1: x + w - radius, y1: y,            len: sideX },
        { type: 'arc',  cx: x + w - radius, cy: y + radius,    r: radius, a0: -Math.PI / 2,    a1: 0,                len: arcLen },
        { type: 'line', x0: x + w,          y0: y + radius,    x1: x + w,          y1: y + h - radius, len: sideY },
        { type: 'arc',  cx: x + w - radius, cy: y + h - radius, r: radius, a0: 0,                a1: Math.PI / 2,      len: arcLen },
        { type: 'line', x0: x + w - radius, y0: y + h,          x1: x + radius,    y1: y + h,          len: sideX },
        { type: 'arc',  cx: x + radius,     cy: y + h - radius, r: radius, a0: Math.PI / 2,      a1: Math.PI,          len: arcLen },
        { type: 'line', x0: x,              y0: y + h - radius, x1: x,             y1: y + radius,    len: sideY },
        { type: 'arc',  cx: x + radius,     cy: y + radius,     r: radius, a0: Math.PI,          a1: 3 * Math.PI / 2,  len: arcLen },
    ];
    const total = segments.reduce((s, seg) => s + seg.len, 0);
    return { segments, total };
}

function pointAt(perimeter, s) {
    const total = perimeter.total;
    if (total <= 0) return null;
    let arc = ((s % total) + total) % total;
    for (const seg of perimeter.segments) {
        if (arc <= seg.len + 1e-6) {
            const f = seg.len > 0 ? arc / seg.len : 0;
            if (seg.type === 'line') {
                return {
                    x: seg.x0 + (seg.x1 - seg.x0) * f,
                    y: seg.y0 + (seg.y1 - seg.y0) * f,
                    angle: Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0),
                };
            }
            const a = seg.a0 + (seg.a1 - seg.a0) * f;
            return {
                x: seg.cx + Math.cos(a) * seg.r,
                y: seg.cy + Math.sin(a) * seg.r,
                angle: a + Math.PI / 2,
            };
        }
        arc -= seg.len;
    }
    return null;
}

/**
 * Draw the lewd frame onto its dedicated canvas. Idempotent.
 *
 * Algorithm:
 *  1. Stroke the rounded rect with the active palette + outer glow —
 *     this is the visible border the user sees at a glance.
 *  2. Build the perimeter as a list of line + arc segments and walk arc
 *     length from a deterministic start, packing phrases end-to-end:
 *     pick the next phrase from state.phrases (loop on overflow), append
 *     a separator, measure width, place its center on the path, rotate
 *     to the local tangent.
 *  3. For each placed phrase, render with a faint cyan/black RGB-split
 *     shadow + magenta main fill so it reads as glitch text overlaid on
 *     the stroke — present, but you have to look to see it.
 *
 * @param {HTMLCanvasElement} canvasEl
 * @param {object} state — flat object matching LEWD_FRAME_DEFAULTS shape
 */
export function drawLewdFrame(canvasEl, state) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const { width, height } = canvasEl;
    ctx.clearRect(0, 0, width, height);
    if (!state || !state.enabled) return;
    if (!state.showPhrases || !Array.isArray(state.phrases) || state.phrases.length === 0) return;

    const t = height / 1080;
    const radius   = state.cornerRadius * t;
    const fontSize = state.fontSize     * t;
    // Border thickness >= font size so the text fits inside the line and
    // reads as a hidden message tucked into the magenta border, not a
    // separate caption riding on top.
    const lineW    = fontSize * 1.15;

    // Pull the rect path inward by at least half the line width so the
    // border's outer edge always sits inside the canvas regardless of the
    // user's inset slider. The glow may still spill past the canvas edge
    // (and clip) — that's expected halo behaviour.
    const userInset = state.inset * t;
    const safeInset = Math.ceil(lineW / 2 + 1);
    const inset     = Math.max(userInset, safeInset);

    const x = inset;
    const y = inset;
    const w = width  - inset * 2;
    const h = height - inset * 2;

    const perimeter = buildPerimeter(x, y, w, h, radius);
    if (perimeter.total <= 0) return;

    const palette     = LEWD_FRAME_COLOR_PRESETS[state.colorPreset] ?? LEWD_FRAME_COLOR_PRESETS.dual;
    const phraseColor = palette.solid;

    // Build stroke style once (gradient or solid) — used for the border line.
    let stroke;
    if (palette.gradient) {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, palette.gradient[0]);
        grad.addColorStop(1, palette.gradient[1]);
        stroke = grad;
    } else {
        stroke = palette.solid;
    }

    // Step 1: stroke the rounded rect with glow — the visible border.
    ctx.save();
    if (state.glow) {
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur  = 28 * t;
    }
    ctx.lineWidth   = lineW;
    ctx.strokeStyle = stroke;
    ctx.lineJoin    = 'round';
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
    } else {
        const rr = Math.min(radius, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y,     x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x,     y + h, rr);
        ctx.arcTo(x,     y + h, x,     y,     rr);
        ctx.arcTo(x,     y,     x + w, y,     rr);
        ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();

    // Step 2: text-along-path overlay — the hidden message.
    ctx.save();
    ctx.font         = `${fontSize}px ABOL, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Stable but pseudo-random walk: deterministic per-phrase-list so the
    // border stays visually consistent across redraws of the same state,
    // but starts at a different rotation each shuffle so it feels organic.
    let cursor = (state.phrases.length * 13.37) % perimeter.total;
    let phraseIdx = 0;

    // Safety cap: at minimum font size + max perimeter, ~2000 placements is
    // generous; the loop normally terminates by `cursor` wrapping past start.
    const startCursor = cursor;
    let placements = 0;
    let firstWrap = false;

    while (placements < 2000) {
        const text = state.phrases[phraseIdx % state.phrases.length]
            + LEWD_FRAME_SEPARATORS[phraseIdx % LEWD_FRAME_SEPARATORS.length];
        const tw = ctx.measureText(text).width;
        if (tw <= 0) break;

        // Place center at cursor + tw/2 so the phrase starts at cursor.
        const point = pointAt(perimeter, cursor + tw / 2);
        if (!point) break;

        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(point.angle);

        // Cyan offset (left/up).
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
        ctx.fillText(text, -2 * t, -1 * t);

        // Black drop (right/down).
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillText(text, 2 * t, 2 * t);

        // Main color.
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = phraseColor;
        ctx.fillText(text, 0, 0);

        ctx.restore();

        cursor += tw;
        phraseIdx++;
        placements++;

        // Stop once we've wrapped past the original start.
        if (!firstWrap && cursor >= startCursor + perimeter.total) {
            firstWrap = true;
            break;
        }
    }

    ctx.restore();
}
