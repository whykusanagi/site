/**
 * Applies pose data to a VRM's normalized humanoid bones and blends between
 * poses. Owns vrm.humanoid.autoUpdateHumanBones: with poses active the clip
 * must not also drive the body, or the two fight every frame.
 */
import { normalizeBoneRotation, resolvePose, blendFactor, validatePoseDoc } from './pose-math.js';

export class PoseController {
  constructor(vrm, viewer) {
    this.vrm = vrm;
    this.viewer = viewer;
    this.doc = null;
    this.blendRate = 12;
    this.reducedMotion = false;
    /** boneName -> THREE.Quaternion target */
    this.targets = new Map();
    this.framing = null;
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

    // The pose owns the body now: stop the humanoid resetting bones each update.
    if (this.vrm?.humanoid) this.vrm.humanoid.autoUpdateHumanBones = false;
    this.setFraming(pose.framing ?? null);
  }

  /** Hands the body back to the idle clip and returns the camera home. */
  release() {
    this.targets.clear();
    this.framing = null;
    if (this.vrm?.humanoid) this.vrm.humanoid.autoUpdateHumanBones = true;
    if (this.viewer) {
      this.viewer.lookTarget?.set(0, 1.5, 0);
      this.viewer.targetCameraDistance = 1.7;
    }
  }

  /** Stores the framing spec; the bone is re-read fresh every update() frame. */
  setFraming(framing) {
    this.framing = framing ?? null;
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

    if (this.framing && this.viewer) {
      const bone = this.vrm.humanoid.getNormalizedBoneNode(this.framing.target);
      if (bone) {
        const THREE = window.THREE;
        const point = new THREE.Vector3();
        bone.getWorldPosition(point);
        if (typeof this.framing.height === 'number') point.y = this.framing.height;
        this.viewer.lookTarget.lerp(point, t);
      }
      if (typeof this.framing.dist === 'number') {
        this.viewer.targetCameraDistance = Math.max(0.8, Math.min(3.5, this.framing.dist));
      }
    }
  }
}
