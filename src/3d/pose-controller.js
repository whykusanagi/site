/**
 * Applies pose data to a VRM's normalized humanoid bones and blends between
 * poses. Owns vrm.humanoid.autoUpdateHumanBones: with poses active the clip
 * must not also drive the body, or the two fight every frame.
 */
import { normalizeBoneRotation, resolvePose, blendFactor, validatePoseDoc } from './pose-math.js';

export class PoseController {
  constructor(vrm, camera, controls) {
    this.vrm = vrm;
    this.camera = camera;
    this.controls = controls;
    this.doc = null;
    this.blendRate = 12;
    this.reducedMotion = false;
    /** boneName -> THREE.Quaternion target */
    this.targets = new Map();
    this.framingTarget = null;
    this.framingDist = null;
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

  /** Hands the body back to the idle clip and stops steering the camera. */
  release() {
    this.targets.clear();
    this.framingTarget = null;
    this.framingDist = null;
    if (this.vrm?.humanoid) this.vrm.humanoid.autoUpdateHumanBones = true;
  }

  setFraming(framing) {
    if (!framing) {
      this.framingTarget = null;
      this.framingDist = null;
      return;
    }
    const bone = this.vrm?.humanoid?.getNormalizedBoneNode?.(framing.target);
    if (!bone || !this.controls) return;
    const THREE = window.THREE;
    const target = new THREE.Vector3();
    bone.getWorldPosition(target);
    if (typeof framing.height === 'number') target.y = framing.height;
    this.framingTarget = target;
    this.framingDist = typeof framing.dist === 'number' ? framing.dist : null;
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

    if (this.framingTarget && this.controls && this.camera) {
      this.controls.target.lerp(this.framingTarget, t);
      if (this.framingDist !== null) {
        // Pull the camera to the pose's distance along its current view
        // direction, so orbit angle is preserved but framing tightens.
        const THREE = window.THREE;
        const dir = new THREE.Vector3()
          .subVectors(this.camera.position, this.controls.target)
          .normalize();
        const desired = new THREE.Vector3()
          .copy(this.controls.target)
          .add(dir.multiplyScalar(this.framingDist));
        this.camera.position.lerp(desired, t);
      }
      this.controls.update();
    }
  }
}
