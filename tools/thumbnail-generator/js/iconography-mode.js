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
                textScale: 2.0,
                logoPosition: 'center',
                fitCircle: false,
            };
            this.active = false;
            this.currentW = 1920;
            this.currentH = 1080;
        }

        async init() {
            await this.loadPhrases();
            this._wireToggles();
            this._wirePhrases();
            this._wireMiscControls();
            console.log('✅ IconographyMode initialized');
        }

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
            // Apply or clear container-level classes (logo position + fit-circle)
            const container = document.getElementById('thumbnail-container');
            if (container) {
                if (this.active) {
                    this._applyLogoPosition();
                    this._applyFitCircle();
                } else {
                    container.classList.remove('icon-logo-center', 'icon-logo-corners', 'icon-fit-circle');
                }
            }
        }

        resize(w, h) {
            this.currentW = w;
            this.currentH = h;
            // Full rebuild — simpler than per-element math updates, and
            // resize is infrequent (only on aspect-ratio change).
            this._rebuild();
            // Recompute the fit-circle clip radius for the new canvas dims.
            if (this.active) this._applyFitCircle();
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

            this._buildMandorla();
            this._buildArcs();
            this._buildRings();
            this._buildTextBands();
            this._buildStars();
            this._buildFrame();
        }

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
                this._el('path', {
                    d, fill: 'none', stroke: '#00ffff', 'stroke-width': 1.5, opacity: 0.55,
                    transform: `translate(${R * 0.04}, ${R * 0.04}) scale(0.92) translate(${cx * 0.087 / 0.92}, ${cy * 0.087 / 0.92})`,
                }, g);
            }
        }

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

            const scale = this.state.textScale || 1;
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
                    'font-size': Math.round(b.size * scale),
                    'data-base-size': b.size,
                    'font-weight': b.weight,
                    'letter-spacing': Math.round(b.spacing * scale),
                    'data-base-spacing': b.spacing,
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

            // Text scale slider — live-updates ring text font-size without rebuild
            const scaleSlider = document.getElementById('icon-text-scale');
            const scaleReadout = document.getElementById('icon-text-scale-readout');
            if (scaleSlider) {
                scaleSlider.value = String(this.state.textScale);
                if (scaleReadout) scaleReadout.textContent = `${this.state.textScale.toFixed(1)}×`;
                scaleSlider.addEventListener('input', () => {
                    const v = parseFloat(scaleSlider.value) || 1;
                    this.state.textScale = v;
                    if (scaleReadout) scaleReadout.textContent = `${v.toFixed(1)}×`;
                    this._updateTextScale();
                    if (typeof saveState === 'function') saveState();
                });
            }

            // Logo position select — center vs corners
            const logoPosSel = document.getElementById('icon-logo-position');
            if (logoPosSel) {
                logoPosSel.value = this.state.logoPosition;
                logoPosSel.addEventListener('change', () => {
                    this.state.logoPosition = logoPosSel.value;
                    this._applyLogoPosition();
                    if (typeof saveState === 'function') saveState();
                });
            }

            // Fit character in circle toggle
            const fitCb = document.getElementById('icon-toggle-fit-circle');
            if (fitCb) {
                fitCb.checked = !!this.state.fitCircle;
                fitCb.addEventListener('change', () => {
                    this.state.fitCircle = fitCb.checked;
                    this._applyFitCircle();
                    if (typeof saveState === 'function') saveState();
                });
            }
        }

        _updateTextScale() {
            // Walk the 3 text bands and scale font-size + letter-spacing from data-base-* attrs
            const scale = this.state.textScale || 1;
            const texts = this.svg.querySelectorAll('#icon-grp-text text');
            for (const t of texts) {
                const baseSize = parseFloat(t.getAttribute('data-base-size')) || 20;
                const baseSpacing = parseFloat(t.getAttribute('data-base-spacing')) || 6;
                t.setAttribute('font-size', String(Math.round(baseSize * scale)));
                t.setAttribute('letter-spacing', String(Math.round(baseSpacing * scale)));
            }
        }

        _applyLogoPosition() {
            const container = document.getElementById('thumbnail-container');
            if (!container) return;
            container.classList.remove('icon-logo-center', 'icon-logo-corners');
            if (this.state.logoPosition === 'center') {
                container.classList.add('icon-logo-center');
            } else if (this.state.logoPosition === 'corners') {
                container.classList.add('icon-logo-corners');
            }
        }

        _applyFitCircle() {
            const container = document.getElementById('thumbnail-container');
            if (!container) return;
            container.classList.toggle('icon-fit-circle', !!this.state.fitCircle);
            // Set the clip radius in canvas pixels so the visible circle stays
            // a fixed size regardless of the character image's CSS height.
            // Matches the inner cyan ring (R * 0.51) with a touch of inset.
            const { R } = this._geom();
            const fitR = R * 0.49;
            container.style.setProperty('--icon-fit-circle-r', `${Math.round(fitR)}px`);
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
    }

    window.IconographyMode = IconographyMode;
})();
