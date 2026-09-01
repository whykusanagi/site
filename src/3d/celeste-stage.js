/**
 * CelesteStage - the whole page is this: scene, camera, renderer, VRM load,
 * idle clip, render loop. Nothing else - no UI, no scroll driving, no pose
 * math. Those live in celeste.html and scroll-poser.js.
 *
 * Replaces src/3d/three-vrm-viewer.js (2,461 lines of dead walk/pose
 * buttons, VMD remnants, and an unreachable entrance animation). That file
 * stays on disk, untouched, until a later commit deletes it.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { CautionBands } from './caution-bands.js';

const MODEL_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '/models/CorruptedQueenCelestePhairWetA.vrm'
  : 'https://s3.whykusanagi.xyz/models/CorruptedQueenCelestePhairWetA.vrm';

// Pose clips ship with the site rather than from S3: 22KB each, and same-origin
// means no CORS gate, so they work in local dev as well as production. The much
// larger idle loop stays on S3.
const POSE_BASE = 'assets/animations/poses/';
const ANIMATION_BASE = 'https://s3.whykusanagi.xyz/animations/';
const IDLE_ANIMATION_URL = ANIMATION_BASE + 'celeste_idle.vrma';

/**
 * Poses are .vrma clips played through createVRMAnimationClip - the same path
 * the idle clip uses and the one three-vrm intends. Reading the quaternions out
 * and applying them to normalized bones by hand looks equivalent and is not: it
 * has to reproduce the VRM 0.x/1.0 basis difference, the normalized-bone rest
 * offsets and the hips translation, and getting any of them wrong bends joints
 * the wrong way. Let the library do it.
 */
const POSE_CLIPS = {
  makima:     'makima_pose.vrma',
  standing:   'base_standing_pose.vrma',
  jacko:      'jacko_pose.vrma',
  suggestive: 'suggestive_pose.vrma',
  prone:      'laying_stomach_pose.vrma',
};

const POSE_FADE_SECONDS = 0.35;

/**
 * Extra root rotation per pose, in degrees, composed ONTO the model's baseline
 * orientation - never replacing it. VRMUtils.rotateVRM0() bakes a 180-degree Y
 * rotation into vrm.scene for VRM 0.x exports so the model faces the camera;
 * writing an absolute rotation here would silently undo that and spin her away.
 *
 * z is a roll in screen space: the camera looks down -Z, so positive z reads
 * counter-clockwise. `prone` is authored head-up, which leaves her standing on
 * end; +90 lays her across the frame instead.
 */
/**
 * Blendshapes to switch on per pose. The model ships a "Skirt OFF" group (plus
 * "Hide Stockings", "Hide Horns", "Hide Crown/Glove acc" if ever wanted), and a
 * floor pose puts the skirt through the ground otherwise.
 *
 * Names are matched case- and separator-insensitively, because three-vrm
 * normalises VRM 0.x blendshape group names on import and the exact casing it
 * lands on is not worth depending on.
 */
const POSE_EXPRESSIONS = {
  jacko:      { 'Skirt OFF': 1 },
  suggestive: { 'Skirt OFF': 1 },
  prone:      { 'Skirt OFF': 1 },
};

const POSE_ROOT = {
  // Tuned in the ?dev=1 panel, not derived. Reasoning about these axes is
  // unreliable: they compose onto a baseline that already carries
  // rotateVRM0's 180-degree Y flip, so screen-space intuition misleads.
  prone:      { y: 40 },
  suggestive: { x: -70, y: 15 },
  jacko:      { x: -15 },
  // A few degrees of yaw so her eye reads between the hands rather than
  // being covered by them.
  makima:     { y: -4 },
};

/**
 * OPTIONAL per-pose camera. A pose with no entry keeps the single default
 * framing below, so the view stays put across most of the page - only the
 * poses that genuinely need a different angle move the camera.
 *
 * This exists because the floor poses cannot share a frame with the standing
 * ones: `suggestive` wants the camera low and pitched down at the ground
 * (lookY 0.12, elevation 40), which would crop a standing pose entirely.
 */
const POSE_CAMERA = {
  suggestive: { lookY: 0.12, dist: 3.65, elevation: 40 },
  jacko:      { lookY: 0.54, dist: 3.50, elevation: 5 },
  makima:     { lookY: 1.20, dist: 3.50, elevation: 14 },
};

export class CelesteStage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [opts]
   * @param {(fraction: number) => void} [opts.onProgress] - VRM download progress, 0..1
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.onProgress = opts.onProgress ?? null;

    this.vrm = null;
    this.mixer = null;
    this.idleAction = null;
    /** Set externally once a PoseController exists; read every frame.
     * Assigning it is the wiring code's job, not this class's. */
    this.poseController = null;
    /** EffectComposer | null. Set externally (bloom); render() prefers it
     * over the direct renderer path when present. */
    this.composer = null;
    /** poseName -> AnimationAction, populated by loadPoseClips(). */
    this.poseActions = new Map();
    this.currentAction = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Camera state the pose controller WRITES; this class only reads it,
    // every frame, in _applyCamera().
    // ONE camera for every pose. 35deg vertical FOV means visible height is
    // 0.63 * distance, so 3.6m shows ~2.3m - the full figure standing, and the
    // whole floor area a ground pose spreads into. Deliberately fixed: the POV
    // does not move between sections, only the pose does.
    this.lookTarget = new THREE.Vector3(0, 1.20, 0);
    this.targetCameraDistance = 3.50;
    this.cameraElevation = 12; // degrees; 0 = eye level, 90 = directly overhead

    /** The shipped camera values, captured before anything can edit them, so
     *  the dev panel's Reset returns to what actually ships rather than to a
     *  second copy of the numbers that could drift out of sync. */
    this.cameraDefaults = {
      dist: this.targetCameraDistance,
      elevation: this.cameraElevation,
      lookY: this.lookTarget.y,
    };
    this.cameraUp = new THREE.Vector3(0, 1, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0); // transparent - the mandala backdrop shows through
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this._addLights();

    // Hazard tape as scene geometry rather than a DOM overlay, so it takes
    // perspective and one band crosses in front of the model while the other
    // passes behind her.
    this.cautionBands = new CautionBands(
      this.scene,
      this.renderer.capabilities.getMaxAnisotropy(),
    );

    this.clock = new THREE.Clock();
    this._raf = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  _addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 3);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8b9dff, 0.35);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xd94f90, 0.5);
    rim.position.set(0, 2.5, -3);
    this.scene.add(rim);
  }

  /** Resizes the renderer, camera aspect, and composer (if bloom set one). */
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  /** Loads the VRM and idle clip. Resolves once the model is in the scene
   * and the render loop is running. A missing idle clip warns once and
   * continues - the model just holds its rest pose. */
  async load() {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        MODEL_URL,
        resolve,
        (event) => {
          if (this.onProgress && event.lengthComputable) {
            this.onProgress(event.loaded / event.total);
          }
        },
        reject,
      );
    });

    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('VRMLoaderPlugin did not attach a VRM to gltf.userData.vrm');

    try {
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.combineMorphs(vrm);
    } catch (e) {
      console.warn('[stage] VRMUtils optimization skipped:', e.message);
    }
    try {
      // No-op on VRM 1.x exports; VRM 0.x exports face -Z and this rotates
      // the scene 180 degrees so the model faces the camera. Throws
      // harmlessly if vrm.meta has no VRM0 shape - caught and ignored.
      VRMUtils.rotateVRM0(vrm);
      // Captured AFTER rotateVRM0 so the 0.x facing correction is part of the
      // baseline every pose rotation composes onto.
      this.rootBaseline = vrm.scene.quaternion.clone();
      this.rootTarget = this.rootBaseline.clone();
    } catch {
      // already VRM 1.x - nothing to rotate
    }

    gltf.scene.traverse((obj) => { obj.frustumCulled = false; });

    this.scene.add(gltf.scene);
    this.vrm = vrm;

    await this._loadIdleClip(vrm);

    // Both of these read state that only exists by now: the expression index
    // needs this.vrm (assigned just above), and the dev panel enumerates the
    // pose clips (loaded inside _loadIdleClip). Running them any earlier build
    // an empty index and an empty button row - silently, in both cases.
    this._buildExpressionIndex();
    this._installDevPanel();

    // Same hook vrm_toolkit's review harnesses expose, for poking at
    // expressions from the console while tuning. Dev flag only.
    if (new URLSearchParams(window.location.search).get('dev') === '1') {
      window.__vrm = vrm;
      window.__setExpr = (n, v) => {
        try { vrm.expressionManager.setValue(n, v); return true; } catch { return false; }
      };
    }

    this._startLoop();
  }

  async _loadIdleClip(vrm) {
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
      const gltf = await loader.loadAsync(IDLE_ANIMATION_URL);
      const animation = gltf.userData.vrmAnimations?.[0];
      if (!animation) throw new Error('no vrmAnimations in file');
      const clip = createVRMAnimationClip(animation, vrm);
      this.mixer = new THREE.AnimationMixer(vrm.scene);
      this.idleAction = this.mixer.clipAction(clip);
      this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      this.idleAction.play();
      this.currentAction = this.idleAction;
    } catch (e) {
      console.warn(`[stage] idle clip unavailable (${IDLE_ANIMATION_URL}), holding rest pose:`, e.message);
    }

    await this.loadPoseClips(vrm);
  }

  _startLoop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      // Clamp: a backgrounded tab's first frame back can report a huge
      // delta, which would snap-blend every pose instead of easing into it.
      const dt = Math.min(this.clock.getDelta(), 0.1);

      this.mixer?.update(dt);
      // Poses write NORMALIZED humanoid bones; vrm.update() is what copies
      // them onto the raw skeleton. This must run between mixer.update and
      // render, never after vrm.update, or the pose silently does nothing.
      this.poseController?.update(dt);
      this.vrm?.update(dt);

      // Ease the root toward its target. Snapping it makes the spring bones
      // lash, which on a 90-degree roll is very visible in the hair.
      if (this.vrm && this.rootTarget) {
        const t = this.reducedMotion ? 1 : 1 - Math.exp(-6 * dt);
        this.vrm.scene.quaternion.slerp(this.rootTarget, t);
      }

      this.cautionBands?.update(dt, this.reducedMotion);

      this._applyCamera();
      (this.composer ?? this.renderer).render(this.scene, this.camera);
    };
    tick();
  }

  _applyCamera() {
    const distance = Math.max(0.6, Math.min(6, this.targetCameraDistance));
    const elevRad = this.cameraElevation * (Math.PI / 180);
    const y = this.lookTarget.y + Math.sin(elevRad) * distance;
    const r = Math.cos(elevRad) * distance;
    this.camera.position.set(this.lookTarget.x, y, this.lookTarget.z + r);
    this.camera.up.copy(this.cameraUp);
    this.camera.lookAt(this.lookTarget);
  }

  /**
   * Loads every pose clip onto the shared mixer. Single-keyframe clips, so
   * playing one simply holds that pose. A clip that fails to load is skipped
   * with one warning - the section just keeps whatever pose preceded it.
   */
  async loadPoseClips(vrm) {
    if (!this.mixer) this.mixer = new THREE.AnimationMixer(vrm.scene);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    for (const [name, file] of Object.entries(POSE_CLIPS)) {
      try {
        const gltf = await loader.loadAsync(POSE_BASE + file);
        const animation = gltf.userData.vrmAnimations?.[0];
        if (!animation) throw new Error('no vrmAnimations in file');
        const action = this.mixer.clipAction(createVRMAnimationClip(animation, vrm));
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.poseActions.set(name, action);
      } catch (e) {
        console.warn(`[stage] pose clip "${name}" unavailable (${file}):`, e.message);
      }
    }
  }

  /**
   * Crossfades to a pose clip, or back to the idle loop when name is null or
   * unknown. The mixer owns the skeleton throughout, so there is no second
   * system writing bones and nothing to arbitrate between them.
   */
  /** Section changed: the bands re-place themselves and take the new label. */
  setSection(index, label) {
    this.cautionBands?.setLayout(index);
    this.cautionBands?.setLabel(label);
  }

  setPose(name) {
    this.devActivePose = name;
    this._setRootRotation(name);
    this._setPoseExpressions(name);
    this._setPoseCamera(name);
    this._devPanel?.onPose(name);

    const next = (name && this.poseActions.get(name)) || this.idleAction;
    if (!next || next === this.currentAction) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.currentAction) {
      this.currentAction.crossFadeTo(next, this.reducedMotion ? 0 : POSE_FADE_SECONDS, false);
    }
    this.currentAction = next;
  }

  /**
   * Loads the slider panel when ?dev=1. Dynamic import so the module is never
   * fetched for a normal visitor.
   */
  async _installDevPanel() {
    if (new URLSearchParams(window.location.search).get('dev') !== '1') return;
    try {
      const { initDevPanel } = await import('./dev-panel.js');
      this._devPanel = initDevPanel(this);
      this._devPanel.onPose(this.devActivePose);
    } catch (e) {
      console.warn('[stage] dev panel unavailable:', e.message);
    }
  }

  /**
   * Builds a lookup from a loose name ("skirtoff") to whatever the expression
   * is actually called, so POSE_EXPRESSIONS can be written the way the model
   * spells it regardless of how three-vrm normalised it.
   */
  _buildExpressionIndex() {
    this._expressionIndex = new Map();
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    const names = manager.expressions?.map((e) => e.expressionName)
      ?? Object.keys(manager.expressionMap ?? {});
    for (const name of names) {
      this._expressionIndex.set(String(name).toLowerCase().replace(/[^a-z0-9]/g, ''), name);
    }
    if (new URLSearchParams(window.location.search).get('dev') === '1') {
      console.warn('[stage] expressions available:', names.join(', '));
    }
  }

  /** Applies this pose's blendshapes, clearing whatever the last one set. */
  _setPoseExpressions(name) {
    const manager = this.vrm?.expressionManager;
    if (!manager || !this._expressionIndex) return;

    for (const applied of this._appliedExpressions ?? []) {
      manager.setValue(applied, 0);
    }
    this._appliedExpressions = [];

    for (const [wanted, weight] of Object.entries((name && POSE_EXPRESSIONS[name]) || {})) {
      const key = wanted.toLowerCase().replace(/[^a-z0-9]/g, '');
      const actual = this._expressionIndex.get(key);
      if (!actual) {
        console.warn(`[stage] no expression matching "${wanted}" on this model`);
        continue;
      }
      manager.setValue(actual, weight);
      this._appliedExpressions.push(actual);
    }
  }

  /** Applies a pose's camera override, or the default when it has none. */
  _setPoseCamera(name) {
    const c = (name && POSE_CAMERA[name]) || this.cameraDefaults;
    this.targetCameraDistance = c.dist;
    this.cameraElevation = c.elevation;
    this.lookTarget.y = c.lookY;
  }

  /** Panel hook: the configured camera for a pose, so the sliders can start
   *  from the shipped value. */
  configuredCamera(name) {
    return { ...this.cameraDefaults, ...((name && POSE_CAMERA[name]) || {}) };
  }

  /** Panel hook: restores the camera to the values this file ships with. */
  resetCamera() {
    this._setPoseCamera(this.devActivePose);
  }

  /** Panel hook: the configured root rotation for a pose, so the sliders can
   *  start from the shipped value instead of zero. */
  configuredRoot(name) {
    return { x: 0, y: 0, z: 0, ...((name && POSE_ROOT[name]) || {}) };
  }

  /** Panel hook: the pose names that have clips loaded. */
  poseNames() {
    return [...this.poseActions.keys()];
  }

  /** Panel hook: override the configured rotation for the live pose. */
  setRootOverride(spec) {
    this._rootOverride = spec;
    this._setRootRotation(this.devActivePose);
  }

  /** Composes this pose's root rotation onto the captured baseline. */
  _setRootRotation(name) {
    if (!this.rootBaseline) return;
    const spec = this._rootOverride || (name && POSE_ROOT[name]) || null;
    const target = this.rootBaseline.clone();
    if (spec) {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(spec.x ?? 0),
        THREE.MathUtils.degToRad(spec.y ?? 0),
        THREE.MathUtils.degToRad(spec.z ?? 0),
      );
      // PRE-multiply: this is a roll in WORLD space, which is what "rotate her
      // counter-clockwise on screen" means. Post-multiplying rotates about the
      // model's LOCAL z, and the baseline's 180-degree Y flip (from rotateVRM0)
      // inverts that axis - so a positive angle came out clockwise.
      target.premultiply(new THREE.Quaternion().setFromEuler(euler));
    }
    this.rootTarget = target;
  }

  dispose() {
    if (this._raf !== null) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.mixer?.stopAllAction();
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose?.(this.vrm.scene);
    }
    this.renderer.dispose();
  }
}
