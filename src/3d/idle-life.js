/**
 * idle-life.js
 *
 * The small involuntary motion that separates a character from a mannequin:
 * blinking, breathing, and an occasional wink.
 *
 * The .vrma pose clips are single held poses, so without this Celeste holds a
 * perfectly still stare for as long as you look at her.
 *
 * ## Frame order
 *
 * update() MUST run after mixer.update() and before vrm.update():
 *
 *   - after the mixer, or the pose clip overwrites the breathing offset in
 *     the same frame and nothing moves;
 *   - before vrm.update(), because that is what copies the normalized rig
 *     onto the raw skeleton and applies expression weights. Setting either
 *     afterwards paints into a buffer nobody reads until the next frame.
 *
 * ## Why the breathing tracks a base value
 *
 * createVRMAnimationClip builds tracks for every humanoid bone, so the mixer
 * normally rewrites spine and chest each frame and a plain `+= delta` would be
 * correct. But a clip that happens not to drive a bone leaves the previous
 * frame's offset in place, and `+=` would then integrate it into a slow,
 * baffling drift. Remembering the exact value written last frame tells the two
 * cases apart for the cost of one comparison.
 */

/** Breathing: a slow sine on the spine, and half as much again on the chest. */
const BREATH_PERIOD_S = 4.2;
const BREATH_SPINE_RAD = 0.020;
const BREATH_CHEST_RAD = 0.013;

const BLINK_CLOSE_S = 0.055;
const BLINK_HOLD_S = 0.035;
const BLINK_OPEN_S = 0.11;
/** Gap between blinks, seconds. Humans land roughly in this band at rest. */
const BLINK_GAP_MIN_S = 2.4;
const BLINK_GAP_MAX_S = 6.5;
/** Fraction of blinks that are a one-eyed wink instead. She would. */
const WINK_CHANCE = 0.09;
/** Fraction that double-blink, which is what stops the rhythm reading as a metronome. */
const DOUBLE_CHANCE = 0.16;

const nextGap = () => BLINK_GAP_MIN_S + Math.random() * (BLINK_GAP_MAX_S - BLINK_GAP_MIN_S);

/** Tracks one bone axis so breathing can be additive without drifting. */
class BoneOffset {
  constructor(node) {
    this.node = node;
    this.base = node ? node.rotation.x : 0;
    this.written = null;
  }

  apply(delta) {
    const { node } = this;
    if (!node) return;
    // Exact equality is the test: if nothing else touched the bone since our
    // last write, the value is still bit-identical to what we left.
    this.base = node.rotation.x === this.written ? this.base : node.rotation.x;
    node.rotation.x = this.base + delta;
    this.written = node.rotation.x;
  }
}

export class IdleLife {
  /**
   * @param {object} vrm loaded VRM
   * @param {boolean} reducedMotion when true this is inert - idle motion is
   *   decorative, and a page that honours the setting everywhere else should
   *   not keep one character breathing.
   */
  constructor(vrm, reducedMotion = false) {
    this.vrm = vrm;
    this.reducedMotion = reducedMotion;
    this.t = 0;

    this.blinkTimer = nextGap();
    this.blink = null;

    const humanoid = vrm?.humanoid;
    this.spine = new BoneOffset(humanoid?.getNormalizedBoneNode('spine'));
    this.chest = new BoneOffset(humanoid?.getNormalizedBoneNode('chest'));

    const map = vrm?.expressionManager?.expressionMap ?? {};
    this.hasBlink = 'blink' in map;
    this.canWink = 'blinkLeft' in map && 'blinkRight' in map;
  }

  _setBlink(weight) {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    const b = this.blink;
    if (b?.eye && this.canWink) {
      em.setValue(b.eye, weight);
      // Zero the other eye explicitly: expression weights persist across
      // frames, so a wink left half-set would stay on her face.
      em.setValue(b.eye === 'blinkLeft' ? 'blinkRight' : 'blinkLeft', 0);
      if (this.hasBlink) em.setValue('blink', 0);
    } else if (this.hasBlink) {
      em.setValue('blink', weight);
    }
  }

  /** @param {number} dt seconds since the previous frame */
  update(dt) {
    if (this.reducedMotion || !this.vrm) return;
    // A backgrounded tab resumes with a huge dt; clamp so she does not
    // teleport through half a breath on the first frame back.
    const step = Math.min(dt, 0.1);
    this.t += step;

    const phase = (this.t / BREATH_PERIOD_S) * Math.PI * 2;
    const breath = Math.sin(phase);
    this.spine.apply(breath * BREATH_SPINE_RAD);
    this.chest.apply(breath * BREATH_CHEST_RAD);

    if (!this.hasBlink && !this.canWink) return;

    if (this.blink) {
      this.blink.t += step;
      const { t, close, hold, open } = this.blink;
      let w;
      if (t < close) w = t / close;
      else if (t < close + hold) w = 1;
      else if (t < close + hold + open) w = 1 - (t - close - hold) / open;
      else w = 0;
      this._setBlink(w);

      if (t >= close + hold + open) {
        const again = this.blink.repeat;
        this._setBlink(0);
        this.blink = null;
        // A double-blink's second beat follows immediately; otherwise wait.
        this.blinkTimer = again ? 0.09 : nextGap();
      }
      return;
    }

    this.blinkTimer -= step;
    if (this.blinkTimer > 0) return;

    const wink = this.canWink && Math.random() < WINK_CHANCE;
    this.blink = {
      t: 0,
      // A wink is deliberate, so it holds noticeably longer than a blink.
      close: BLINK_CLOSE_S,
      hold: wink ? 0.20 : BLINK_HOLD_S,
      open: wink ? 0.16 : BLINK_OPEN_S,
      eye: wink ? (Math.random() < 0.5 ? 'blinkLeft' : 'blinkRight') : null,
      repeat: !wink && Math.random() < DOUBLE_CHANCE,
    };
  }
}
