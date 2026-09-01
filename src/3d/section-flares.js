/**
 * section-flares.js
 *
 * A magical-girl transition: flares ignite ACROSS CELESTE'S BODY when the
 * section changes, tracking her joints as she moves into the new pose.
 *
 * This is a 2D canvas laid over the WebGL canvas, NOT a post-processing pass.
 * Bloom taught us why: EffectComposer renders opaquely and erased the mandala
 * backdrop, so post FX ships off by default. A separate transparent 2D layer
 * composites over whatever the stage drew and cannot touch its alpha.
 *
 * The recipes are the theme's own (CorruptedFlares.draw), so the shapes,
 * chromatic fringing and stutter timing match the rest of the site.
 *
 * ## Two things the first version got wrong
 *
 * 1. It scattered flares at random points in the frame, so they read as
 *    background confetti rather than as something happening to her.
 * 2. It never passed `color`, and draw() defaults to '#ff00ff' - magenta,
 *    over a scene of magenta hazard tape and a magenta mandala. They fired
 *    and were simply not visible. Colours here are picked to survive that
 *    background: ice blue, white, and gold.
 *
 * Positions are resolved per flare AT SPAWN, not once per burst, so a flare
 * lighting up 400ms in appears wherever that joint has moved to - the sparks
 * follow her through the pose change instead of hanging in stale air.
 */

const FLARES_URL = 'https://cdn.whykusanagi.xyz/corrupted-theme/@0.3.3/src/lib/corrupted-flares.js';

/**
 * Recipes that read as "something just happened" at a glance. The theme ships
 * 25; these punch through a busy scene without looking like an error state
 * (signalLost and staticFlash both read as broken).
 */
const RECIPES = ['starBurst', 'glitchStar', 'sparkCross', 'ringPulse', 'shardBurst', 'diamondPulse'];

/** Bright against magenta. Celeste's own cyan/gold, not the theme's default. */
const COLORS = ['#8ef6ff', '#ffffff', '#ffe9a3', '#c9b6ff'];

const COUNT = 20;
const LIFE_MS = 720;
/** Stagger so the burst sweeps across her rather than flashing as one frame. */
const STAGGER_MS = 42;
/** Spread around a joint, as a fraction of viewport height. Keeps a flare
 *  reading as "on her" while not sitting exactly on the bone every time. */
const JITTER = 0.05;

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
    this.loadError = null;
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

    // Decorative, so a CDN failure must not break the page - but it should not
    // be silent either. The first version swallowed this completely, which
    // would have made a genuinely broken import indistinguishable from
    // flares that fire and cannot be seen.
    import(FLARES_URL)
      .then((m) => { this.Flares = m.CorruptedFlares; })
      .catch((e) => {
        this.loadError = e;
        console.warn('[stage] transition flares unavailable:', e.message);
      });
  }

  _resize() {
    if (!this.canvas) return;
    // Cap DPR at 2: a burst is a score of short-lived sprites, not worth 3x
    // the fill rate on a phone already running a VRM and two spring rigs.
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
   * Fires one burst.
   *
   * @param {() => Array<{x: number, y: number}>} [pointProvider] returns the
   *   CURRENT on-screen positions of her joints, normalized 0..1. Called once
   *   per flare as it spawns, so the sparks follow her through the pose
   *   change. Without it (or if she is off screen) the burst falls back to
   *   the middle of the frame, which is where she stands.
   */
  burst(pointProvider = null) {
    if (this.reducedMotion || !this.canvas) return;
    this._resize();
    const now = performance.now();
    for (let i = 0; i < COUNT; i++) {
      this.flares.push({
        recipe: RECIPES[Math.floor(Math.random() * RECIPES.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 40 + Math.random() * 90,
        start: now + i * STAGGER_MS,
        pointProvider,
        // Resolved at spawn time, not now.
        x: null,
        y: null,
      });
    }
    if (this.raf === null) this.raf = requestAnimationFrame(this._tick);
  }

  /** Picks a joint at random and jitters around it, in CSS pixels. */
  _spawnAt(flare) {
    const points = flare.pointProvider?.() ?? [];
    const p = points.length
      ? points[Math.floor(Math.random() * points.length)]
      : { x: 0.5, y: 0.42 };
    const jx = (Math.random() - 0.5) * 2 * JITTER * this.h;
    const jy = (Math.random() - 0.5) * 2 * JITTER * this.h;
    flare.x = p.x * this.w + jx;
    flare.y = p.y * this.h + jy;
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
      if (f.x === null) this._spawnAt(f);

      ctx.save();
      ctx.translate(f.x, f.y);
      // draw() paints no background and restores the context itself; the
      // save/translate here only gives each flare its own origin.
      //
      // loopMs must match this flare's real lifetime. The recipes quantize t
      // against it to hold a flicker frame above ~100ms, so leaving it at the
      // 1400ms default while running a 720ms flare misreports the playback
      // rate and coarsens the animation.
      this.Flares.draw(ctx, f.recipe, t, { size: f.size, color: f.color, loopMs: LIFE_MS });
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
