/**
 * section-flares.js
 *
 * A burst of corrupted-theme flares over the stage whenever the section
 * changes, so a transition reads as an event rather than a silent swap.
 *
 * This is a 2D canvas laid over the WebGL canvas, NOT a post-processing pass.
 * Bloom taught us why: EffectComposer renders opaquely and erased the mandala
 * backdrop, so post FX ships off by default. A separate transparent 2D layer
 * composites over whatever the stage drew and cannot touch its alpha.
 *
 * The flare recipes are the theme's own (CorruptedFlares.draw), so the shapes,
 * chromatic fringing and stutter timing stay consistent with the rest of the
 * site instead of being re-invented here.
 */

const FLARES_URL = 'https://cdn.whykusanagi.xyz/corrupted-theme/@0.3.3/src/lib/corrupted-flares.js';

/**
 * Recipes that read as "something just happened" at a glance. The theme ships
 * 25; these are the ones that punch through a busy magenta scene without
 * looking like an error state (signalLost and staticFlash both read as broken).
 */
const RECIPES = ['starBurst', 'glitchStar', 'sparkCross', 'ringPulse', 'shardBurst', 'diamondPulse'];

const COUNT = 9;
const LIFE_MS = 620;
/** Stagger so the burst cascades instead of flashing as one frame. */
const STAGGER_MS = 45;

export class SectionFlares {
  /**
   * @param {HTMLElement} host element the canvas is appended to
   * @param {boolean} reducedMotion when true this whole module is inert
   */
  constructor(host, reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.flares = [];
    this.raf = null;
    this.Flares = null;
    if (reducedMotion) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'stage-flares';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });

    // Decorative: if the CDN module fails, the page carries on without it.
    import(FLARES_URL)
      .then((m) => { this.Flares = m.CorruptedFlares; })
      .catch(() => { /* no flares this visit */ });
  }

  _resize() {
    if (!this.canvas) return;
    // Cap DPR at 2: a burst is 9 short-lived sprites, not worth 3x the fill
    // rate on a phone that is already running a VRM and two spring-bone rigs.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The canvas's own client box, not the parent's: CSS sizes this layer to
    // the viewport, while its parent is the document and is far taller.
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.w = w;
    this.h = h;
  }

  /**
   * Fires one burst. Positions cluster around the middle of the frame, where
   * the model is, and avoid the pinned card along the bottom.
   */
  burst() {
    if (this.reducedMotion || !this.canvas) return;
    this._resize();
    const now = performance.now();
    for (let i = 0; i < COUNT; i++) {
      this.flares.push({
        recipe: RECIPES[Math.floor(Math.random() * RECIPES.length)],
        x: this.w * (0.18 + Math.random() * 0.64),
        y: this.h * (0.10 + Math.random() * 0.55),
        size: 34 + Math.random() * 76,
        start: now + i * STAGGER_MS,
      });
    }
    if (this.raf === null) this.raf = requestAnimationFrame(this._tick);
  }

  _tick = () => {
    const now = performance.now();
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    let alive = false;
    for (const f of this.flares) {
      const t = (now - f.start) / LIFE_MS;
      if (t < 0) { alive = true; continue; }
      if (t >= 1) continue;
      alive = true;
      if (!this.Flares) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      // draw() paints no background and restores the context itself; the
      // save/translate here is only so each flare gets its own origin.
      this.Flares.draw(ctx, f.recipe, t, { size: f.size });
      ctx.restore();
    }

    if (alive) {
      this.raf = requestAnimationFrame(this._tick);
    } else {
      // Idle to zero cost between sections rather than clearing an empty
      // canvas 60 times a second for the whole visit.
      this.flares.length = 0;
      this.raf = null;
      ctx.clearRect(0, 0, this.w, this.h);
    }
  };

  dispose() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.canvas?.remove();
    this.flares.length = 0;
  }
}
