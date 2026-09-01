/**
 * Applies pose data to a VRM's normalized humanoid bones and blends between
 * poses. Writes normalized bone nodes directly, and relies on the humanoid's
 * default auto-update behavior to copy those normalized rotations onto the
 * raw skeleton every frame - this class deliberately leaves that behavior
 * untouched rather than toggling it.
 *
 * Beyond bone rotations, three more pose fields are supported:
 *   - hipsOffset: metres, relative to standing, added to the hips bone's
 *     rest Y so floor poses don't float.
 *   - framing.elevation / framing.up: written onto the stage's camera state,
 *     same blend as everything else (up is snapped - see resolveCameraUp).
 *   - root: rotates vrm.scene, composed onto its captured baseline rather
 *     than a hardcoded identity (see the rootBaseline field comment).
 */
import { normalizeBoneRotation, resolvePose, blendFactor, validatePoseDoc } from './pose-math.js';

/**
 * Target Y for the hips normalized bone: rest position plus the pose's
 * offset (metres, relative to standing). Pure - covered directly in
 * scripts/pose-math.test.mjs alongside the rest of the pose math.
 */
export function hipsTargetY(restY, offsetMetres) {
  const offset = typeof offsetMetres === 'number' && Number.isFinite(offsetMetres) ? offsetMetres : 0;
  return restY + offset;
}

/**
 * Resolves a pose's `framing.up` to a validated [x,y,z] array, defaulting to
 * world-up when absent or malformed. Pure - covered in scripts/pose-math.test.mjs.
 */
export function resolveCameraUp(up) {
  if (Array.isArray(up) && up.length === 3 && up.every(Number.isFinite)) {
    return up;
  }
  return [0, 1, 0];
}

export class PoseController {
  constructor(vrm, stage) {
    this.vrm = vrm;
    this.stage = stage;
    this.doc = null;
    this.blendRate = 12;
    this.reducedMotion = false;
    /** boneName -> THREE.Quaternion target */
    this.targets = new Map();
    this.framing = null;
    /** True once setFraming() has received a non-null spec; gates whether
     * release() is allowed to touch the stage's camera state. */
    this.hadFraming = false;

    /** Hips normalized-bone rest Y, captured lazily the first time a pose
     * sets hipsOffset - not assumed at construction, so it reflects wherever
     * the rig's rest pose actually puts the hips. */
    this.hipsRestY = null;
    /** Target Y offset (metres, relative to standing); blended toward every
     * frame once hipsRestY is captured. */
    this.hipsOffsetTarget = 0;

    /**
     * vrm.scene's baseline rotation, captured lazily the first time a pose
     * sets `root` - deliberately NOT assumed to be THREE's identity
     * quaternion. VRMUtils.rotateVRM0() (called once at load, for VRM 0.x
     * exports) bakes a 180-degree Y rotation directly into vrm.scene's
     * rotation so the model faces the camera. Blending root rotation toward
     * a hardcoded identity would silently fight that correction and spin
     * the character to face away every time a pose without `root` applied.
     * Composing pose.root onto this captured baseline, and releasing back
     * to it, keeps the correction intact.
     */
    this.rootBaseline = null;
    /** THREE.Quaternion | null; null means root has never been engaged. */
    this.rootTarget = null;
  }

  /** Loads pose JSON. A 404 or malformed file warns once and leaves idle. */
  async load(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = await res.json();
      const errors = validatePoseDoc(doc);
      if (errors.length) throw new Error(errors.join('; '));
      this.doc = doc;
      if (typeof doc.blend === 'number') this.blendRate = doc.blend;
    } catch (e) {
      console.warn(`[poses] ${url} unavailable, staying on the idle clip:`, e.message);
      this.doc = null;
    }
  }

  /**
   * Switches to a pose. Passing null, or a name with no entry, releases
   * procedural control and hands the body back to the idle clip. That is the
   * normal state while the pose file is still empty.
   */
  applyPose(name) {
    const pose = resolvePose(this.doc, name);
    if (!pose) {
      this.release();
      return;
    }
    this.targets.clear();

    const THREE = window.THREE;
    for (const [boneName, entry] of Object.entries(pose.bones ?? {})) {
      let rot;
      try {
        rot = normalizeBoneRotation(entry);
      } catch {
        continue; // validated at load; skip defensively rather than break the frame
      }
      const q = new THREE.Quaternion();
      if (rot.type === 'euler') {
        q.setFromEuler(new THREE.Euler(rot.value[0], rot.value[1], rot.value[2], 'XYZ'));
      } else {
        q.set(rot.value[0], rot.value[1], rot.value[2], rot.value[3]);
      }
      this.targets.set(boneName, q);
    }

    this.setFraming(pose.framing ?? null);
    this.setHipsOffset(pose.hipsOffset);
    this.setRoot(pose.root ?? null);
  }

  /**
   * Hands the body back to the idle clip. Only restores camera state if this
   * controller actually applied framing - otherwise a visitor's manual zoom
   * (which writes the same stage.targetCameraDistance field) gets stolen on
   * every no-pose section change. hipsOffset and root are always safe to
   * reset: nothing but this controller ever writes them.
   */
  release() {
    this.targets.clear();
    this.framing = null;
    this.hipsOffsetTarget = 0;
    if (this.rootBaseline) this.rootTarget = this.rootBaseline.clone();
    if (this.hadFraming && this.stage) {
      this.stage.lookTarget?.set(0, 1.35, 0);
      this.stage.targetCameraDistance = 2.2;
      this.stage.cameraElevation = 0;
      this.stage.cameraUp?.set(0, 1, 0);
      this.hadFraming = false;
    }
  }

  /** Stores the framing spec; the bone is re-read fresh every update() frame. */
  setFraming(framing) {
    this.framing = framing ?? null;
    if (this.framing) this.hadFraming = true;
  }

  /** Stores the hips Y offset target; capturing the rest Y is deferred to
   * the first pose that actually asks to move the hips. */
  setHipsOffset(offsetMetres) {
    if (this.hipsRestY === null) {
      const hips = this.vrm?.humanoid?.getNormalizedBoneNode('hips');
      if (hips) this.hipsRestY = hips.position.y;
    }
    this.hipsOffsetTarget = typeof offsetMetres === 'number' ? offsetMetres : 0;
  }

  /**
   * Stores the root rotation target, composed onto the captured baseline.
   * A pose with no `root` blends back toward that baseline; if root has
   * never been engaged at all this is a no-op (nothing to release from).
   */
  setRoot(rootSpec) {
    if (!rootSpec) {
      if (this.rootBaseline) this.rootTarget = this.rootBaseline.clone();
      return;
    }
    const THREE = window.THREE;
    if (!this.rootBaseline && this.vrm?.scene) {
      this.rootBaseline = this.vrm.scene.quaternion.clone();
    }
    if (!this.rootBaseline) return; // no scene yet; defensively bail

    let rot;
    try {
      rot = normalizeBoneRotation(rootSpec);
    } catch {
      this.rootTarget = this.rootBaseline.clone();
      return;
    }
    const offset = new THREE.Quaternion();
    if (rot.type === 'euler') {
      offset.setFromEuler(new THREE.Euler(rot.value[0], rot.value[1], rot.value[2], 'XYZ'));
    } else {
      offset.set(rot.value[0], rot.value[1], rot.value[2], rot.value[3]);
    }
    this.rootTarget = this.rootBaseline.clone().multiply(offset);
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
  }

  /** Called once per frame, BEFORE vrm.update(). */
  update(deltaSeconds) {
    if (!this.vrm?.humanoid) return;
    const t = this.reducedMotion ? 1 : blendFactor(this.blendRate, deltaSeconds);

    for (const [boneName, targetQuat] of this.targets) {
      const node = this.vrm.humanoid.getNormalizedBoneNode(boneName);
      if (node) node.quaternion.slerp(targetQuat, t);
    }

    if (this.hipsRestY !== null) {
      const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
      if (hips) {
        const targetY = hipsTargetY(this.hipsRestY, this.hipsOffsetTarget);
        hips.position.y += (targetY - hips.position.y) * t;
      }
    }

    if (this.rootTarget && this.vrm.scene) {
      this.vrm.scene.quaternion.slerp(this.rootTarget, t);
    }

    if (this.framing && this.stage) {
      const bone = this.vrm.humanoid.getNormalizedBoneNode(this.framing.target);
      if (bone) {
        const THREE = window.THREE;
        const point = new THREE.Vector3();
        bone.getWorldPosition(point);
        if (typeof this.framing.height === 'number') point.y = this.framing.height;
        this.stage.lookTarget.lerp(point, t);
      }
      if (typeof this.framing.dist === 'number') {
        this.stage.targetCameraDistance = Math.max(0.8, Math.min(3.5, this.framing.dist));
      }
      if (typeof this.framing.elevation === 'number') {
        this.stage.cameraElevation += (this.framing.elevation - this.stage.cameraElevation) * t;
      }
      const up = resolveCameraUp(this.framing.up);
      this.stage.cameraUp.set(up[0], up[1], up[2]);
    }
  }
}
