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

const TEXTURE_W = 2048;
const TEXTURE_H = 128;

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

const FALLBACK_LABEL = 'CONTAINMENT BREACH   //   18+   //   ABYSS.SYS   //   ';

function drawBandTexture(canvas, label, tint) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, TEXTURE_W, TEXTURE_H);

  // Diagonal hazard stripes.
  ctx.save();
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);
  ctx.fillStyle = 'rgba(14, 3, 10, 0.92)';
  const step = 96;
  for (let x = -TEXTURE_H; x < TEXTURE_W + TEXTURE_H; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + step / 2, 0);
    ctx.lineTo(x + step / 2 - TEXTURE_H, TEXTURE_H);
    ctx.lineTo(x - TEXTURE_H, TEXTURE_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Edge rails.
  ctx.fillStyle = 'rgba(255, 150, 205, 0.9)';
  ctx.fillRect(0, 0, TEXTURE_W, 4);
  ctx.fillRect(0, TEXTURE_H - 4, TEXTURE_W, 4);

  // Label, repeated so it tiles seamlessly with the texture wrap.
  const text = (label || FALLBACK_LABEL).toUpperCase() + '   ';
  ctx.font = 'bold 54px "Courier Prime", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9a3';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  const unit = ctx.measureText(text).width;
  for (let x = 0; x < TEXTURE_W + unit; x += unit) {
    ctx.fillText(text, x, TEXTURE_H / 2);
  }
}

export class CautionBands {
  constructor(scene) {
    this.scene = scene;
    this.bands = BANDS.map((spec) => {
      const canvas = document.createElement('canvas');
      canvas.width = TEXTURE_W;
      canvas.height = TEXTURE_H;
      drawBandTexture(canvas, FALLBACK_LABEL, spec.tint);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(4, 1);
      texture.colorSpace = THREE.SRGBColorSpace;

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
      drawBandTexture(band.canvas, label, band.spec.tint);
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
