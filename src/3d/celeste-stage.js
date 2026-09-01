/**
 * CelesteStage - the whole page is this: scene, camera, renderer, VRM load,
 * idle clip, render loop. Nothing else - no UI, no scroll driving, no pose
 * math. Those live in celeste.html.
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
import { IdleLife } from './idle-life.js';

/**
 * Joints the transition flares ignite on. Spread over the whole silhouette -
 * head, arms, torso, legs - so a burst traces her shape rather than clumping
 * at her centre of mass.
 */
const FLARE_BONES = [
  'head', 'neck', 'chest', 'spine', 'hips',
  'leftShoulder', 'rightShoulder',
  'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand',
  'leftUpperLeg', 'rightUpperLeg',
  'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot',
];

/** Scratch vector for projection; bodyPoints() runs per flare spawn. */
const FLARE_PROJECT_VEC = new THREE.Vector3();

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
  prone:      'laying_side_wind.vrma',
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
/**
 * Per-pose blendshape weights: face AND wardrobe.
 *
 * This model carries 97 expressions - the 52 ARKit shapes, the VRM presets
 * (happy/angry/sad/relaxed/Surprised), and 27 shapes authored for Celeste
 * specifically. The custom ones cover both mood (Smug, Teasing, Menace,
 * Blush, Heart Pupils, Dark Circles) and wardrobe (Skirt OFF, Hide Horns,
 * Hide Stockings, Elf Ears, Short Hair). Both go through the same channel, so
 * an outfit is just another entry here - no second system needed.
 *
 * Names are matched case- and punctuation-insensitively against the model
 * (see _buildExpressionIndex), so 'Skirt OFF' and 'skirtoff' both resolve,
 * and anything the model does not have warns once instead of failing.
 *
 * Do NOT set blink / blinkLeft / blinkRight here: idle-life.js drives those
 * every frame and would overwrite whatever this set, which reads as the
 * expression silently not working.
 *
 * TUNING NOTE, learned the hard way against the live model: some shapes carry
 * an eyelid component, so weights interact rather than compose independently.
 *
 *   Blush  - closes the eyes. At 0.9 alone it squeezes them shut into >_< arcs;
 *            by ~0.45 they are already gone. Keep it at or below ~0.2 unless
 *            you actually want them shut.
 *   Smug   - narrows the lids. Fine to ~0.5; past that she is squinting.
 *   Menace - opens/widens, so a little counterweights Smug. Above ~0.4 it
 *            blanks the iris to solid white, which reads as possessed.
 *
 * Every value below was checked on a face-filling camera with idle blinking
 * frozen - a blink caught mid-frame looks exactly like a bad weight, so tune
 * with idleLife.reducedMotion = true or you will chase your own tail.
 */
const POSE_EXPRESSIONS = {
  // "Who I Am" - an invitation with a warning in it. Her face is largely
  // behind her hands in this pose, so this is deliberately understated.
  makima: { Menace: 0.12, Smug: 0.4, Blush: 0.2 },

  // "What I Inherited" - grief with excellent bone structure. The only
  // section she is not performing in, so no smirk: just tired and level.
  standing: { 'Dark Circles': 0.4, sad: 0.18, relaxed: 0.25 },

  // "Look Closer" - she is enjoying being inspected. "You may look. Only look."
  jacko: { 'Skirt OFF': 1, Menace: 0.15, Smug: 0.45, Blush: 0.2 },

  // "The Court" - holding court, and pleased about it. No Smug here: the
  // heart pupils are the whole point and want the eyes wide.
  suggestive: { 'Skirt OFF': 1, 'Heart Pupils': 0.9, Blush: 0.2 },

  // "The Domain" - the possessive streak, low and unbothered.
  prone: { 'Skirt OFF': 1, Menace: 0.15, Smug: 0.5 },
};

/**
 * Per-pose spring-bone wind, as a direction and strength.
 *
 * Hair is NOT carried by a .vrma - VRM Animation 1.0 only stores humanoid
 * bones, so hair posed in an authoring tool does not export (verified: the
 * clips animate 51 humanoid nodes and zero others). Hair is spring-bone
 * physics, simulated here.
 *
 * This model ships gravityPower: 0 on its spring groups, so the hair holds
 * position rather than falling. Standing that reads fine; rotated flat for a
 * laying pose it settles straight into her body, because nothing is pushing
 * it clear of the colliders. A directional wind is the runtime equivalent of
 * blowing the hair aside in the posing tool.
 */
const POSE_WIND = {
  prone: { dir: [-0.40, -0.20, -1.00], power: 0.85 },
  jacko: { dir: [0.00, 0.00, -0.55], power: 1.00 },
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
      this.lookTarget,
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
    this.idleLife = new IdleLife(vrm, this.reducedMotion);
    this._installDevPanel();

    // Same hook vrm_toolkit's review harnesses expose, for poking at
    // expressions from the console while tuning. Dev flag only.
    if (new URLSearchParams(window.location.search).get('dev') === '1') {
      window.__vrm = vrm;
      // The stage itself, for checking things that need the camera as well as
      // the model - bodyPoints() being the one that matters.
      window.__stage = this;
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
      // Blink/breathe/wink. Same window as the pose clips and for the same
      // reason: after the mixer so the clip does not overwrite it, before
      // vrm.update() so it reaches the raw skeleton this frame.
      this.idleLife?.update(dt);
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
    // Only on an actual change: setSection is also called to re-assert the
    // current section (on resize, or when the pose sink attaches), and a
    // burst every time would fire on events the visitor did not cause.
    if (index !== this._sectionIndex) {
      this._sectionIndex = index;
      // Pass the provider, not a snapshot: the flares resolve their position
      // as each one spawns, so they track her through the pose change.
      this.flares?.burst(() => this.bodyPoints());
    }
  }

  /**
   * Where Celeste's joints are on screen right now, normalized 0..1 over the
   * canvas, for compositing 2D effects onto her.
   *
   * Raw bones, not normalized ones: the normalized rig is a parallel
   * hierarchy for retargeting, while the raw skeleton is what actually got
   * rendered, so it is the one whose world positions match the pixels.
   *
   * @returns {Array<{x: number, y: number}>} empty if she is not loaded or is
   *   entirely off screen, which the caller treats as "fall back to centre".
   */
  bodyPoints() {
    const vrm = this.vrm;
    if (!vrm) return [];
    const humanoid = vrm.humanoid;
    if (!humanoid) return [];

    // The pose may have advanced since the last render, and setSection is
    // called from a scroll/keyboard handler rather than from inside the loop.
    vrm.scene.updateWorldMatrix(true, true);
    this.camera.updateMatrixWorld();

    const v = FLARE_PROJECT_VEC;
    const points = [];
    for (const name of FLARE_BONES) {
      const node = humanoid.getRawBoneNode?.(name) ?? humanoid.getNormalizedBoneNode?.(name);
      if (!node) continue;
      v.setFromMatrixPosition(node.matrixWorld).project(this.camera);
      // z outside the frustum means behind the camera or clipped; project()
      // still returns coordinates for those, and they are meaningless.
      if (v.z < -1 || v.z > 1) continue;
      const x = (v.x + 1) / 2;
      const y = (1 - v.y) / 2;
      // A small margin outside the frame is fine - a flare half off the edge
      // still reads - but far outside is a joint the visitor cannot see.
      if (x < -0.15 || x > 1.15 || y < -0.15 || y > 1.15) continue;
      points.push({ x, y });
    }
    return points;
  }

  setPose(name) {
    this.devActivePose = name;
    this._setRootRotation(name);
    this._setPoseExpressions(name);
    this._setPoseCamera(name);
    this._setPoseWind(name);
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

    const spec = this._expressionOverride ?? ((name && POSE_EXPRESSIONS[name]) || {});
    for (const [wanted, weight] of Object.entries(spec)) {
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

  /**
   * Applies a pose's spring-bone wind. Captures each joint's shipped gravity
   * once so a pose without wind can be restored exactly rather than reset to
   * an assumed default - this model ships power 0, others may not.
   */
  _setPoseWind(name) {
    const joints = this.vrm?.springBoneManager?.joints;
    if (!joints) return;

    if (!this._windBaseline) {
      this._windBaseline = new Map();
      for (const j of joints) {
        this._windBaseline.set(j, {
          dir: j.settings.gravityDir.clone(),
          power: j.settings.gravityPower,
        });
      }
    }

    const wind = (name && POSE_WIND[name]) || this._windOverride || null;
    for (const j of joints) {
      const base = this._windBaseline.get(j);
      if (wind) {
        j.settings.gravityDir.set(wind.dir[0], wind.dir[1], wind.dir[2]).normalize();
        j.settings.gravityPower = wind.power;
      } else if (base) {
        j.settings.gravityDir.copy(base.dir);
        j.settings.gravityPower = base.power;
      }
    }
  }

  /** Panel hook: drive wind live while tuning. */
  setWindOverride(spec) {
    this._windOverride = spec;
    this._setPoseWind(spec ? null : this.devActivePose);
    if (spec) {
      const joints = this.vrm?.springBoneManager?.joints ?? [];
      for (const j of joints) {
        j.settings.gravityDir.set(spec.dir[0], spec.dir[1], spec.dir[2]).normalize();
        j.settings.gravityPower = spec.power;
      }
    }
  }

  /** Panel hook: the configured wind for a pose. */
  configuredWind(name) {
    return (name && POSE_WIND[name]) || { dir: [0, -1, 0], power: 0 };
  }

  /** Applies a pose's camera override, or the default when it has none. */
  _setPoseCamera(name) {
    // Merge over the defaults rather than replacing them, so a POSE_CAMERA
    // entry can set just the one value it cares about. Replacing meant a
    // partial entry - the natural way to write "this pose only needs a lower
    // angle" - left dist undefined, which reaches _applyCamera as NaN and
    // blanks the canvas. Worse, the dev panel reads configuredCamera(), which
    // already merged, so it showed healthy numbers over a black page.
    const c = this.configuredCamera(name);
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

  /** Panel hook: what this pose ships with, for seeding the sliders. */
  configuredExpressions(name) {
    return { ...((name && POSE_EXPRESSIONS[name]) || {}) };
  }

  /** Panel hook: override the configured expressions for the live pose. */
  setExpressionOverride(spec) {
    this._expressionOverride = spec;
    this._setPoseExpressions(this.devActivePose);
  }

  /**
   * Panel hook: the expressions worth exposing as sliders.
   *
   * Everything the model has, minus the shapes that are driven by something
   * else or are meaningless to author by hand: the ARKit micro-shapes (52 of
   * them, and the custom shapes are built from these anyway), the visemes,
   * the look-direction shapes, and the blink family that idle-life.js owns.
   * What remains is the mood and wardrobe vocabulary.
   */
  expressionCatalog() {
    const skip = /^(neutral|aa|ih|ou|ee|oh|blink|blinkLeft|blinkRight|look(Up|Down|Left|Right))$/i;
    const arkit = /^(eye|brow|mouth|jaw|cheek|nose|tongue)[A-Z]/;
    return [...(this._expressionIndex?.values() ?? [])]
      .filter((n) => !skip.test(n) && !arkit.test(n));
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
