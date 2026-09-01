/**
 * CautionBands - hazard tape as real geometry in the scene, not DOM overlay.
 *
 * Each band is a textured plane placed in world space, so it takes perspective,
 * foreshortens toward its ends, and - the point of the exercise - one band
 * passes IN FRONT of the character while the other passes behind her. A CSS
 * overlay can never do that: it is always wholly in front of or wholly behind
 * the canvas, which is what made the previous version read as a flat sticker.
 *
 * The stripes and text are drawn once into a canvas and used as a repeating
 * texture; scrolling is texture.offset, not moving geometry, so the marquee
 * costs nothing per frame.
 */
import * as THREE from 'three';

// Resolution is set by the CLOSEST band, not an average. The front band sits
// 1.73x nearer the camera than the back one, so it stretches the same texels
// over 1.73x more screen pixels - at the old 128px height it visibly
// pixelated while the far band looked fine.
const TEXTURE_H = 384;
const STRIPE_STEP = 288;     // horizontal period of the diagonal stripes
/** Cap height as a fraction of band height. One constant, so both bands
 *  provably fill to the same depth rather than drifting apart by eye. */
const FONT_RATIO = 0.46;
const FONT_PX = Math.round(TEXTURE_H * FONT_RATIO);
const GAP_PX = 660;          // clear space after the label before it repeats

/** Band placements. z straddles the model so one crosses in front of her. */
const BANDS = [
  { key: 'a', width: 14, height: 0.62, speed: 0.035, z: -1.15, tint: '#d94f90' },
  { key: 'b', width: 14, height: 0.62, speed: -0.028, z: 0.85, tint: '#c2407f' },
];

/** Per-section pose for each band: y height, tilt, and yaw into the scene. */
const LAYOUTS = [
  [{ y: 1.85, rot: -0.16, yaw: 0.10 }, { y: 0.28, rot: 0.11, yaw: -0.08 }],
  [{ y: 1.72, rot: -0.30, yaw: 0.18 }, { y: 0.42, rot: 0.20, yaw: -0.14 }],
  [{ y: 1.95, rot: -0.07, yaw: 0.05 }, { y: 0.18, rot: 0.06, yaw: -0.04 }],
  [{ y: 1.60, rot: 0.24, yaw: -0.16 }, { y: 0.50, rot: -0.17, yaw: 0.12 }],
  [{ y: 1.80, rot: -0.37, yaw: 0.22 }, { y: 0.22, rot: 0.27, yaw: -0.18 }],
];

const FALLBACK_LABEL = 'CONTAINMENT BREACH   //   18+   //   ABYSS.SYS';

const bandFont = () => `bold ${FONT_PX}px "Courier Prime", ui-monospace, monospace`;

/**
 * Draws ONE tile: the label once, plus stripes, sized so the tile repeats
 * seamlessly. Three things have to line up or the seam shows:
 *
 *   - the tile width must be a whole number of stripe periods, else the
 *     diagonal pattern jumps at the wrap;
 *   - the label must be drawn exactly once per tile. Drawing it every
 *     `textWidth` px inside a fixed-width canvas clipped the last copy
 *     mid-word, which is how "THE ABYSS" ended up butted against the next
 *     "NEXT" as "THE ABYSSNEXT";
 *   - the caller must derive texture.repeat from the tile's aspect, or the
 *     glyphs get squeezed (see applyTexture).
 *
 * Returns the tile width in px so the caller can do that last part.
 */
function drawBandTexture(canvas, label, tint) {
  const measure = canvas.getContext('2d');
  measure.font = bandFont();
  const text = (label || FALLBACK_LABEL).toUpperCase();
  const textW = measure.measureText(text).width;

  // Round the tile up to a whole number of stripe periods so the stripes wrap.
  const tileW = Math.ceil((textW + GAP_PX) / STRIPE_STEP) * STRIPE_STEP;
  canvas.width = tileW;
  canvas.height = TEXTURE_H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, tileW, TEXTURE_H);

  // Diagonal hazard stripes. The parallelogram repeats every STRIPE_STEP, and
  // tileW is a multiple of it, so the left and right edges match exactly.
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, tileW, TEXTURE_H);
  ctx.fillStyle = 'rgba(14, 3, 10, 0.92)';
  for (let x = -TEXTURE_H; x < tileW + TEXTURE_H; x += STRIPE_STEP) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + STRIPE_STEP / 2, 0);
    ctx.lineTo(x + STRIPE_STEP / 2 - TEXTURE_H, TEXTURE_H);
    ctx.lineTo(x - TEXTURE_H, TEXTURE_H);
    ctx.closePath();
    ctx.fill();
  }

  // Edge rails.
  ctx.fillStyle = 'rgba(255, 150, 205, 0.9)';
  ctx.fillRect(0, 0, tileW, 4);
  ctx.fillRect(0, TEXTURE_H - 4, tileW, 4);

  // The label, exactly once, with the gap trailing it.
  ctx.font = bandFont();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9a3';
  // A soft blur at this resolution eats the stroke edges and is a large part
  // of why the near band read as thinner. Tight offset shadow instead.
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillText(text, GAP_PX / 2, TEXTURE_H / 2);

  return tileW;
}

/**
 * Sets texture.repeat so one tile keeps the aspect it was drawn at. Without
 * this the tile is stretched to whatever width the plane gives it and the
 * glyphs shear - the "unnatural warp".
 */
function applyTexture(texture, tileW, planeWidth, planeHeight) {
  const tileWorldWidth = planeHeight * (tileW / TEXTURE_H);
  texture.repeat.set(planeWidth / tileWorldWidth, 1);
}

export class CautionBands {
  /**
   * @param {THREE.Scene} scene
   * @param {number} [maxAnisotropy] renderer.capabilities.getMaxAnisotropy().
   *   These planes are yawed and tilted, so they are exactly the case
   *   anisotropic filtering exists for - without it the text smears along the
   *   viewing angle and the near band loses its stroke weight.
   */
  constructor(scene, maxAnisotropy = 1) {
    this.scene = scene;
    this.maxAnisotropy = maxAnisotropy;
    this.bands = BANDS.map((spec) => {
      const canvas = document.createElement('canvas');
      const tileW = drawBandTexture(canvas, FALLBACK_LABEL, spec.tint);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.maxAnisotropy;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      applyTexture(texture, tileW, spec.width, spec.height);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.width, spec.height),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          // depthWrite off so the bands never punch a hole in the model where
          // they overlap it - they read as tape laid over/behind her, not as
          // geometry carving her up.
          depthWrite: false,
        }),
      );
      mesh.position.z = spec.z;
      mesh.renderOrder = spec.z > 0 ? 2 : -1;
      scene.add(mesh);

      return { spec, canvas, texture, mesh, target: { y: 1, rot: 0, yaw: 0 } };
    });

    this.setLayout(0);
    this.bands.forEach((b) => {
      b.mesh.position.y = b.target.y;
      b.mesh.rotation.set(0, b.target.yaw, b.target.rot);
    });
  }

  /** Redraws both textures with the given label (null restores the hazard text). */
  setLabel(label) {
    for (const band of this.bands) {
      // A different label is a different width, so the tile has to be re-sized
      // and repeat recomputed - otherwise the new text either clips at the wrap
      // or renders at the previous label's aspect.
      const tileW = drawBandTexture(band.canvas, label, band.spec.tint);
      applyTexture(band.texture, tileW, band.spec.width, band.spec.height);
      band.texture.needsUpdate = true;
    }
  }

  /** Chooses the per-section placement; update() eases toward it. */
  setLayout(index) {
    const layout = LAYOUTS[Math.min(index, LAYOUTS.length - 1)];
    this.bands.forEach((band, i) => { band.target = layout[i]; });
  }

  update(deltaSeconds, reducedMotion) {
    const t = reducedMotion ? 1 : 1 - Math.exp(-3.5 * deltaSeconds);
    for (const band of this.bands) {
      if (!reducedMotion) band.texture.offset.x += band.spec.speed * deltaSeconds;
      band.mesh.position.y += (band.target.y - band.mesh.position.y) * t;
      band.mesh.rotation.z += (band.target.rot - band.mesh.rotation.z) * t;
      band.mesh.rotation.y += (band.target.yaw - band.mesh.rotation.y) * t;
    }
  }

  dispose() {
    for (const band of this.bands) {
      this.scene.remove(band.mesh);
      band.mesh.geometry.dispose();
      band.mesh.material.dispose();
      band.texture.dispose();
    }
    this.bands = [];
  }
}
