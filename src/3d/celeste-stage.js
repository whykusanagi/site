/**
 * CelesteStage - the whole page is this: scene, camera, renderer, VRM load,
 * idle clip, render loop. Nothing else - no UI, no scroll driving, no pose
 * math. Those live in celeste.html, scroll-poser.js, and pose-controller.js.
 *
 * Replaces src/3d/three-vrm-viewer.js (2,461 lines of dead walk/pose
 * buttons, VMD remnants, and an unreachable entrance animation). That file
 * stays on disk, untouched, until a later commit deletes it.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

// pose-controller.js is a plain ES module with no THREE import of its own -
// it reads `window.THREE` inside its methods (a pattern that predates this
// file and is left as-is; see pose-controller.js). This is the one place
// that supplies it, once, as a side effect of importing this module.
window.THREE = THREE;

const MODEL_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? '/models/whykusanagi_nun_succubus.vrm'
  : 'https://s3.whykusanagi.xyz/models/whykusanagi_nun_succubus.vrm';

const IDLE_ANIMATION_URL = 'https://s3.whykusanagi.xyz/animations/celeste_idle.vrma';

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

    // Camera state the pose controller WRITES; this class only reads it,
    // every frame, in _applyCamera().
    this.lookTarget = new THREE.Vector3(0, 1.35, 0);
    this.targetCameraDistance = 2.2;
    this.cameraElevation = 0; // degrees; 0 = eye level, 90 = directly overhead
    this.cameraUp = new THREE.Vector3(0, 1, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0); // transparent - the mandala backdrop shows through
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this._addLights();

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
    } catch {
      // already VRM 1.x - nothing to rotate
    }

    gltf.scene.traverse((obj) => { obj.frustumCulled = false; });

    this.scene.add(gltf.scene);
    this.vrm = vrm;

    await this._loadIdleClip(vrm);
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
    } catch (e) {
      console.warn(`[stage] idle clip unavailable (${IDLE_ANIMATION_URL}), holding rest pose:`, e.message);
    }
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
