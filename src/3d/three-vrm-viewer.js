/**
 * Three.js VRM Viewer for Celeste 3D Model
 * Loads and displays VRM model with interactive controls
 * 
 * Version: 2025-01-23-walk-animation-enabled-v2
 * Status: Walk animation enabled using VRM humanoid bone system
 * - AnimationMixer.update() and vrm.update() are enabled
 * - Walk animation created using vrm.humanoid.humanBones
 * - ExpressionManager uses presetExpressionMap (getter) not presetExpression property
 */

class ThreeVRMViewer {
  constructor() {
    this.canvas = document.getElementById('vrmCanvas');
    this.clock = new THREE.Clock();
    this.clock.start();
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.controlsHint = document.getElementById('controlsHint');
    this.touchHint = document.getElementById('touchHint');
    
    // Set up global error handler to suppress UV animation errors from three-vrm
    // These errors are non-critical and occur when the model has UV animation data
    // but the material doesn't support it
    if (!window.__vrmErrorHandlerSet) {
      const originalError = window.onerror;
      window.onerror = function(message, source, lineno, colno, error) {
        // Suppress UV animation errors from three-vrm
        if (message && typeof message === 'string' && 
            (message.includes('Cannot set properties of undefined') || 
             message.includes('setting \'value\'') ||
             (source && source.includes('three-vrm') && message.includes('value')))) {
          // Silently ignore - these are harmless UV animation errors
          return true; // Prevent default error handling
        }
        // Call original error handler for other errors
        if (originalError) {
          return originalError(message, source, lineno, colno, error);
        }
        return false;
      };
      window.__vrmErrorHandlerSet = true;
    }

    // Model URL - use local path for dev testing (no CORS issues)
    // For production, this will need to be updated to use AssetConfig.convertUrl()
    this.modelUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/models/whykusanagi_nun_succubus.vrm'
      : 'https://s3.whykusanagi.xyz/models/whykusanagi_nun_succubus.vrm';

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.vrm = null;

    // Controls state
    this.isMouseDown = false;
    this.isPinching = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.touchDistance = 0;

    // Model rotation state
    this.modelRotation = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0 };
    // Distance pulled back so the full-body model fits in the now-taller
    // celeste.html viewport with ~30% headroom above the head for the
    // idle .vrma dance animation to swing without clipping.
    this.cameraDistance = 1.7;
    this.targetCameraDistance = 1.7;

    // Model position offset (for keyboard movement, modifiable via WASD).
    // Y default tuned for the celeste.html hero viewport: -1.0 puts the
    // model's resting Y at 0.2 (modelPositionOffset.y + 1.2), so the head
    // sits comfortably below the top of the canvas with dance headroom.
    this.modelPositionOffset = { x: 0, y: -1.0, z: 0 };
    this.keyboardSpeed = 0.05;

    // Touch device detection
    this.isTouchDevice = this.detectTouchDevice();

    // Animation/Expression state
    this.animationMixer = null;
    this.blendShapes = {};
    this.expressionTime = 0;
    this.currentExpression = null;
    this.expressionDuration = 0;
    this.currentAnimationAction = null;  // Currently playing skeletal animation
    this.availableAnimations = [];  // List of animation clips from model

    // Idle animation system (replacing auto-cycle)
    this.isIdleAnimationActive = false;  // Will be enabled after entrance animation
    this.lastIdleAction = 0;  // Timestamp of last idle action
    this.idleActionInterval = 5000;  // 5 seconds between idle actions
    // Only use expressions that exist in the VRM model
    // Available: neutral, aa, ih, ou, ee, oh, blink, happy, angry, sad
    this.idleActions = [
      { type: 'blink', duration: 0.3 },
      { type: 'expression', name: 'happy', duration: 2.5 },
      { type: 'expression', name: 'happy', duration: 2.5 },
      { type: 'blink', duration: 0.3 },
    ];

    // Walk animation state
    this.walkAnimationPlaying = false;  // Track if walk animation is active
    this.walkAnimationAction = null;  // Reference to the walk animation action
    
    // Entrance animation (disabled - now controlled by button)
    this.entranceAnimationComplete = true;  // Start as complete (no auto-entrance)
    this.entranceStartTime = 0;
    this.entranceAnimationDuration = 8.0;  // 8 seconds to walk in (4 cycles of 2-second walk)
    this.usingSkeletalAnimation = false;  // Tracks if we're using skeletal animation or position-based

    // VMD Animation
    this.vmdAnimation = null;  // Loaded VMD animation clip
    this.vmdLoaded = false;
    this.waitingForVMD = false; // Flag to wait for VMD before starting entrance
    this.bodyPositionLog = [];  // Track body positions for validation

    // All blend shapes available in the succubus model (from VRM analysis)
    this.expressions = [
      // Tier 1: Basic emotions (number keys 1-9)
      { name: 'joy', duration: 3, index: 7, key: '1' },        // Happy/joy
      { name: 'angry', duration: 2.5, index: 8, key: '2' },    // Angry
      { name: 'sorrow', duration: 3, index: 9, key: '3' },     // Sad
      { name: 'fun', duration: 2.5, index: 10, key: '4' },     // Playful
      { name: 'blink', duration: 0.15, index: 6, key: '5' },   // Blink
      { name: 'surprised', duration: 2, index: 17, key: '6' }, // Shocked

      // Tier 2: Eye directions (Shift + arrows)
      { name: 'LookUp', duration: 1, index: 11 },
      { name: 'LookDown', duration: 1, index: 12 },
      { name: 'LookLeft', duration: 1, index: 13 },
      { name: 'LookRight', duration: 1, index: 14 },

      // Tier 2: Individual eye blinks (Ctrl + keys)
      { name: 'Blink_L', duration: 0.15, index: 15, key: 'ctrl+[' },
      { name: 'Blink_R', duration: 0.15, index: 16, key: 'ctrl+]' },
      { name: 'EyeBlinkLeft', duration: 0.15, index: 27 },
      { name: 'EyeBlinkRight', duration: 0.15, index: 28 },

      // Tier 3: Eyebrow animations (Ctrl + U/I/O)
      { name: 'BrowDownLeft', duration: 1, index: 19, key: 'ctrl+u' },
      { name: 'BrowDownRight', duration: 1, index: 20, key: 'ctrl+i' },
      { name: 'BrowInnerUp', duration: 1, index: 21, key: 'ctrl+o' },
      { name: 'BrowOuterUpLeft', duration: 1, index: 22 },
      { name: 'BrowOuterUpRight', duration: 1, index: 23 },

      // Tier 3: Mouth shapes for lip-sync (Alt + keys)
      { name: 'A', duration: 0.5, index: 1, key: 'alt+a' },     // A sound
      { name: 'I', duration: 0.5, index: 2, key: 'alt+i' },     // I sound
      { name: 'U', duration: 0.5, index: 3, key: 'alt+u' },     // U sound
      { name: 'E', duration: 0.5, index: 4, key: 'alt+e' },     // E sound
      { name: 'O', duration: 0.5, index: 5, key: 'alt+o' },     // O sound

      // Tier 3: Cheek expressions (C key)
      { name: 'CheekPuff', duration: 1.5, index: 24, key: 'c' },
      { name: 'CheekSquintLeft', duration: 1, index: 25 },
      { name: 'CheekSquintRight', duration: 1, index: 26 }
    ];

    // Logging state (throttled to avoid spam)
    this.lastCoordinateLog = 0;
    this.logInterval = 500; // Log every 500ms

    // Idle realism: auto blink + saccade + looping .vrma clip.
    // Mirrors the celeste-tts-bot/obs/vrm-viewer.html implementation.
    this.idleAnimationUrl = window.CELESTE_IDLE_VRMA_URL
      || 'https://s3.whykusanagi.xyz/animations/celeste_idle.vrma';
    this.idleAction = null;
    this.lookAtTarget = null;
    this.fixationTarget = null;
    this.blinkActive = false;
    this.blinkProgress = 0;
    this.timeSinceLastBlink = 0;
    this.nextBlinkTime = 1 + Math.random() * 5;     // 1–6s
    this.timeSinceLastSaccade = 0;
    this.nextSaccadeAfter = 0.2 + Math.random() * 0.6; // 0.2–0.8s
    this.warnedExpressions = new Set();
    this.BLINK_DURATION = 0.2;

    this.init();
  }

  detectTouchDevice() {
    return (
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0)
    );
  }

  init() {
    // Setup Three.js scene
    this.setupScene();

    // Setup lighting for MToon shader
    this.setupLighting();

    // Create on-screen UI controls
    this.createControlsUI();

    // Add event listeners
    this.setupControls();

    // Load VRM model
    this.loadVRM();

    // Start animation loop
    this.animate();
  }

  createControlsUI() {
    const container = this.canvas.parentElement;
    // Check if controls hint already exists in HTML to avoid duplication
    const existingHint = document.getElementById('controlsHint');
    if (existingHint && existingHint.textContent.trim()) {
      // Controls hint already exists in HTML, skip creating duplicate
      return;
    }
    
    const controlsUI = document.createElement('div');
    controlsUI.id = 'vrm-controls-ui';
    controlsUI.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(217, 79, 144, 0.4);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.8rem;
      color: #ddd;
      z-index: 5;
      pointer-events: none;
      text-align: center;
      max-width: 95%;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    `;

    const mouseControls = '🖱️ Drag to rotate • 🔄 Scroll to zoom';
    const touchControls = '👆 Drag to rotate • 🤏 Pinch to zoom';
    const keyboardControls = '⌨️ WASD/Arrows to move • Q/E to slide • W/S for height';
    const easterEggs = '🎪 Easter Eggs: 1-6 emotions • Shift+↑↓←→ eyes • Ctrl+[/] blinks • Alt+AIEUO mouth • C cheek';

    controlsUI.innerHTML = `
      <div>${this.isTouchDevice ? touchControls : mouseControls}</div>
      <div style="margin-top: 8px; font-size: 0.75rem; opacity: 0.8;">${keyboardControls}</div>
      <div style="margin-top: 6px; font-size: 0.65rem; opacity: 0.6;">${easterEggs}</div>
      <div style="font-size: 0.7rem; margin-top: 6px; opacity: 0.5;">Auto-cycling: Joy → Angry → Sorrow → Fun → Blink</div>
    `;

    container.appendChild(controlsUI);
    
    // Create walk animation button
    // TODO: Re-enable walk and pose buttons after improving walking animation
    // this.createWalkButton(container);
    // this.createPoseButton(container);
  }
  
  // TODO: Re-enable pose button after improving walking animation
  /* createPoseButton(container) {
    // Remove existing button if it exists
    const existingButton = document.getElementById('pose-button');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Ensure container has position relative for absolute positioning
    if (container && window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    
    const poseButton = document.createElement('button');
    poseButton.id = 'pose-button';
    poseButton.textContent = '🎭 Pose';
    poseButton.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: calc(50% - 120px);
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(217, 79, 144, 0.8);
      border: 1px solid rgba(217, 79, 144, 1);
      border-radius: 4px;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 1000;
    `;
    
    poseButton.addEventListener('mouseenter', () => {
      poseButton.style.background = 'rgba(217, 79, 144, 1)';
      poseButton.style.transform = 'translateX(-50%) scale(1.05)';
    });
    
    poseButton.addEventListener('mouseleave', () => {
      poseButton.style.background = 'rgba(217, 79, 144, 0.8)';
      poseButton.style.transform = 'translateX(-50%) scale(1)';
    });
    
    poseButton.addEventListener('click', () => {
      this.applyBasePose();
    });
    
    if (container) {
      container.appendChild(poseButton);
    }
  } */
  
  applyBasePose() {
    // Apply base pose (resting position) without walking animation
    if (!this.vrm || !this.vrm.humanoid) {
      console.warn('⚠️ Cannot apply pose: VRM model not loaded');
      return;
    }
    
    // Stop any walking animation
    if (this.walkAnimationPlaying) {
      this.toggleWalkAnimation();
    }
    
    // Helper to create quaternion
    const createQuaternion = (x, y, z) => {
      const euler = new THREE.Euler(x, y, z, 'XYZ');
      const quat = new THREE.Quaternion();
      quat.setFromEuler(euler);
      return quat;
    };
    
    // Get base rotation values (same as in applyManualWalkAnimation)
    const armBaseRotationY = Math.PI / 2 - (15 * Math.PI / 180); // ~75 degrees (15 degrees away from vertical, more natural walking position - arms away from body)
    const armBaseRotationZ_Right = -Math.PI / 2 + (15 * Math.PI / 180); // -75 degrees
    const armBaseRotationZ_Left = Math.PI / 2 - (15 * Math.PI / 180) + (25 * Math.PI / 180); // +100 degrees (forward 25 degrees to match right arm position)
    
    const rightArmBaseQuat = createQuaternion(0, armBaseRotationY, armBaseRotationZ_Right);
    let leftArmBaseQuat = createQuaternion(0, armBaseRotationY, armBaseRotationZ_Left);
    
    // Fix left arm palm orientation
    const leftArmPalmCorrection = createQuaternion(-Math.PI / 2, 0, 0);
    leftArmBaseQuat = leftArmBaseQuat.clone().multiply(leftArmPalmCorrection);
    
    // Apply to bones - try both humanoid system and direct node access
    const leftArmBone = this.vrm.humanoid.humanBones.leftUpperArm;
    const rightArmBone = this.vrm.humanoid.humanBones.rightUpperArm;
    
    let applied = false;
    
    if (leftArmBone && leftArmBone.node) {
      leftArmBone.node.quaternion.copy(leftArmBaseQuat);
      applied = true;
    }
    
    if (rightArmBone && rightArmBone.node) {
      rightArmBone.node.quaternion.copy(rightArmBaseQuat);
      applied = true;
    }
    
    // Fallback: try to find bones by name if humanoid lookup failed
    if (!applied && this.vrm.scene) {
      this.vrm.scene.traverse((node) => {
        if (node.name && node.name.includes('LeftUpperArm') && node.quaternion) {
          node.quaternion.copy(leftArmBaseQuat);
          applied = true;
        }
        if (node.name && node.name.includes('RightUpperArm') && node.quaternion) {
          node.quaternion.copy(rightArmBaseQuat);
          applied = true;
        }
      });
    }
    
    if (applied) {
      } else {
      console.warn('⚠️ Could not apply base pose - bones not found');
    }
  }
  
  // TODO: Re-enable walk button after improving walking animation
  /* createWalkButton(container) {
    // Remove existing button if it exists
    const existingButton = document.getElementById('walk-animation-button');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Ensure container has position relative for absolute positioning
    if (container && window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    
    const walkButton = document.createElement('button');
    walkButton.id = 'walk-animation-button';
    walkButton.innerHTML = '🚶 Start Walk';
    walkButton.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(217, 79, 144, 0.8);
      border: 1px solid rgba(217, 79, 144, 1);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.9rem;
      color: #fff;
      cursor: pointer;
      z-index: 1000;
      pointer-events: auto;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: block;
      visibility: visible;
      opacity: 1;
    `;
    
    walkButton.addEventListener('mouseenter', () => {
      walkButton.style.background = 'rgba(217, 79, 144, 1)';
      walkButton.style.transform = 'scale(1.05)';
    });
    
    walkButton.addEventListener('mouseleave', () => {
      walkButton.style.background = 'rgba(217, 79, 144, 0.8)';
      walkButton.style.transform = 'scale(1)';
    });
    
    walkButton.addEventListener('click', () => {
      this.toggleWalkAnimation();
    });
    
    if (container) {
      container.appendChild(walkButton);
      this.walkButton = walkButton;
      } else {
      console.error('❌ Cannot create walk button - container not found');
    }
  } */
  
  toggleWalkAnimation() {
    if (this.walkAnimationPlaying) {
      this.stopWalkAnimation();
    } else {
      this.startWalkAnimation();
    }
  }
  
  startWalkAnimation() {
    if (!this.vrm || !this.vrm.humanoid || !this.animationMixer) {
      console.warn('⚠️  Cannot start walk animation - VRM not ready');
      return;
    }
    
    if (this.walkAnimationPlaying) {
      return; // Already playing
    }
    
    // Disable VRM auto-update to allow custom animations
    if (this.vrm.humanoid.autoUpdateHumanBones) {
      this.vrm.humanoid.autoUpdateHumanBones = false;
      }
    
    // Create walk animation
    const walkAnimation = this.createSimpleWalkAnimation();
    if (!walkAnimation) {
      console.warn('⚠️  Failed to create walk animation');
      return;
    }
    
    // Play the animation
    const played = this.playAnimation(walkAnimation, {
      loop: THREE.LoopRepeat,
      clampWhenFinished: false
    });
    
    if (played) {
      this.walkAnimationPlaying = true;
      this.walkAnimationAction = this.currentAnimationAction;
      this.usingSkeletalAnimation = true;
      this.walkButton.innerHTML = '⏸️ Stop Walk';
      this.walkButton.style.background = 'rgba(255, 100, 100, 0.8)';
      this.walkButton.style.borderColor = 'rgba(255, 100, 100, 1)';
      } else {
      console.warn('⚠️  Failed to play walk animation');
    }
  }
  
  stopWalkAnimation() {
    if (!this.walkAnimationPlaying) {
      return;
    }
    
    // Stop the animation action
    if (this.walkAnimationAction) {
      this.walkAnimationAction.stop();
      this.walkAnimationAction = null;
    }
    if (this.currentAnimationAction) {
      this.currentAnimationAction.stop();
    }
    
    // Re-enable VRM auto-update to return to default pose
    if (this.vrm && this.vrm.humanoid) {
      this.vrm.humanoid.autoUpdateHumanBones = true;
      }
    
    this.walkAnimationPlaying = false;
    this.usingSkeletalAnimation = false;
    this.walkButton.innerHTML = '🚶 Start Walk';
    this.walkButton.style.background = 'rgba(217, 79, 144, 0.8)';
    this.walkButton.style.borderColor = 'rgba(217, 79, 144, 1)';
    }

  setupScene() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    // Camera looks up at head/upper-body height so the full body sits in the
    // lower 2/3 of the frame, leaving the top third clear for dance motion.
    this.camera.position.set(0, 1.55, this.cameraDistance);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Key light (main directional light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 8, 5);
    keyLight.target.position.set(0, 1, 0);
    keyLight.castShadow = true;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    // Fill light (soften shadows)
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    fillLight.position.set(-5, 4, -8);
    this.scene.add(fillLight);

    // Back light for character separation
    const backLight = new THREE.DirectionalLight(0xffaa88, 0.3);
    backLight.position.set(0, 3, -5);
    this.scene.add(backLight);
  }

  async loadVRM() {
    try {
      // VRM models are glTF files, use GLTFLoader with VRMLoaderPlugin
      // Wait a bit for GLTFLoader to be available (in case it's still loading)
      let GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;
      if (typeof GLTFLoaderClass === 'undefined') {
        // Wait up to 2 seconds for GLTFLoader to load
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;
          if (typeof GLTFLoaderClass !== 'undefined') {
            break;
          }
        }
        if (typeof GLTFLoaderClass === 'undefined') {
          throw new Error('GLTFLoader not loaded after waiting');
        }
      }

      // Check for VRMLoaderPlugin (loaded via ES module and exposed globally)
      // According to https://github.com/pixiv/three-vrm, VRMLoaderPlugin is the correct import
      const VRMLoaderPlugin = window.VRMLoaderPlugin || (window.VRM && window.VRM.VRMLoaderPlugin);
      
      if (!VRMLoaderPlugin) {
        // Wait a bit for the ES module to load
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryVRMLoaderPlugin = window.VRMLoaderPlugin || (window.VRM && window.VRM.VRMLoaderPlugin);
        if (!retryVRMLoaderPlugin) {
          throw new Error('three-vrm library not loaded. VRMLoaderPlugin not found. Make sure the ES module script has loaded.');
        }
        // Use the retried plugin (reuse GLTFLoaderClass from above)
        const loader = new GLTFLoaderClass();
        loader.register((parser) => new retryVRMLoaderPlugin(parser));
        if (window.VRMAnimationLoaderPlugin) {
          loader.register((parser) => new window.VRMAnimationLoaderPlugin(parser));
        }
        return this.loadVRMWithLoader(loader);
      }

      // Use GLTFLoader (reuse GLTFLoaderClass from above)
      const loader = new GLTFLoaderClass();
      // Register VRMLoaderPlugin to handle VRM files
      // This is the correct way according to three-vrm documentation
      loader.register((parser) => new VRMLoaderPlugin(parser));
      // Register .vrma animation loader so the same loader can pull idle clips.
      if (window.VRMAnimationLoaderPlugin) {
        loader.register((parser) => new window.VRMAnimationLoaderPlugin(parser));
      }
      return this.loadVRMWithLoader(loader);
    } catch (error) {
      console.error('VRM Loader error:', error);
      this.showFallback();
    }
  }

  async loadVRMWithLoader(loader) {
    try {
      loader.load(
        this.modelUrl,
        (gltf) => {
          // VRMLoaderPlugin stores the actual VRM object in gltf.userData.vrm
          this.vrm = gltf.userData.vrm;
          if (!this.vrm) {
            console.error('❌ VRM object not found in gltf.userData.vrm. Make sure VRMLoaderPlugin is registered.');
            throw new Error('VRM object not found');
          }
          const model = gltf.scene;
          
          // INVESTIGATE VRM STRUCTURE - Log humanoid bone system
          if (this.vrm.humanoid) {
            if (this.vrm.humanoid.humanBones) {
              Object.keys(this.vrm.humanoid.humanBones).forEach(boneType => {
                const bone = this.vrm.humanoid.humanBones[boneType];
                if (bone && bone.node) {
                  }
              });
            }
          }
          // Apply VRMUtils optimizations (improves performance)
          // Check if VRMUtils is available (from @pixiv/three-vrm)
          if (window.VRMUtils || (window.VRM && window.VRM.VRMUtils)) {
            const VRMUtils = window.VRMUtils || window.VRM.VRMUtils;
            try {
              VRMUtils.removeUnnecessaryVertices(model);
              VRMUtils.combineSkeletons(model);
              VRMUtils.combineMorphs(this.vrm);
              } catch (error) {
              console.warn('⚠️  VRMUtils optimizations failed (non-critical):', error);
            }
          }

          // Disable frustum culling for better performance with VRM models
          model.traverse((obj) => {
            obj.frustumCulled = false;
          });

          // Rotate VRM0.0 models if needed (VRMUtils.rotateVRM0)
          if (window.VRMUtils || (window.VRM && window.VRM.VRMUtils)) {
            const VRMUtils = window.VRMUtils || window.VRM.VRMUtils;
            try {
              VRMUtils.rotateVRM0(this.vrm);
              } catch (error) {
              // Ignore errors - model might be VRM1.0
            }
          }

          // Add to scene
          this.scene.add(model);

          // Center the model
          const bbox = new THREE.Box3().setFromObject(model);
          const center = bbox.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.position.y += 1.2; // Push model up so upper body/face is centered in viewport

          // Rotate model to face viewer (180 degrees on Y axis)
          model.rotation.y = Math.PI;

          // Set up animations and blend shapes
          // Find the Armature/skeleton object - bones are nested under it
          // IMPORTANT: Find Armature BEFORE creating AnimationMixer
          // Version: 2025-01-23-fix-armature-root
          let armatureFound = null;
          model.traverse((obj) => {
            if (obj.name === 'Armature' || obj.name.toLowerCase().includes('skeleton')) {
              if (!armatureFound) { // Only set if not already found
                armatureFound = obj;
                // Verify it has bone children
                let boneCount = 0;
                obj.traverse((child) => {
                  if (child !== obj && (child.isBone || child.type === 'Bone')) {
                    boneCount++;
                  }
                });
                }
            }
          });
          
          // For VRM models with custom animations, AnimationMixer should target vrm.scene
          // This matches the official three-vrm example pattern for humanoid bone animations
          // For embedded glTF animations, we'd use armatureFound || model
          const mixerTarget = this.vrm ? this.vrm.scene : (armatureFound || model);
          this.animationMixer = new THREE.AnimationMixer(mixerTarget);
          console.log('✅ AnimationMixer created on:', mixerTarget === this.vrm?.scene ? 'vrm.scene' : 'armature/model');

          // Idle realism setup: lookAt proxy for saccades + idle .vrma loop.
          this._setupLookAtProxy();
          if (this.idleAnimationUrl) {
            this.loadAndPlayIdleAnimation(this.idleAnimationUrl).catch((err) => {
              console.warn('Idle VRMA skipped:', err?.message || err);
            });
          }
          if (gltf.animations && gltf.animations.length > 0) {
            this.availableAnimations = gltf.animations;
            gltf.animations.forEach((anim, idx) => {
              });
          } else {
            }

          // Extract and log blend shapes
          this.setupBlendShapes(model);

          // DEBUG: Log all bones in the skeleton
          this.logAllBones(model);

          // Load VMD animation first, then start entrance
          // Set a flag to wait for VMD before starting entrance
          // NO TIMEOUT - wait for VMD to load completely
          // Enable animations using VRM humanoid bone system
          this.waitingForVMD = false;
          // Don't auto-start entrance - user controls via button
          this.entranceStartTime = 0;
          this.entranceAnimationComplete = true; // Start as complete (no auto-entrance)
          // Hide loading overlay
          this.hideLoading();

          // Show appropriate controls hint
          if (this.isTouchDevice) {
            this.touchHint.style.display = 'inline';
            this.controlsHint.style.display = 'none';
          }

          },
        (progress) => {
          // Update loading percentage if needed
          const percentComplete = (progress.loaded / progress.total) * 100;
          },
        (error) => {
          console.error('Error loading VRM/glTF model:', error);
          this.showError('Failed to load 3D model. Please refresh the page.');
        }
      );
    } catch (error) {
      console.error('VRM Loader error:', error);
      this.showFallback();
    }
  }

  setupControls() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
    this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e), false);
    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e), false);

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), false);
    this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), false);
    this.canvas.addEventListener('touchend', () => this.onTouchEnd(), false);

    // Keyboard events for model position
    this.keysPressed = {};
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  onCanvasClick(event) {
    // Click on canvas to trigger wink
    this.triggerIdleAction({ type: 'blink_left', duration: 0.15 });
    }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    this.keysPressed[key.toUpperCase()] = true;

    // Check for Easter egg expression shortcuts
    this.handleExpressionShortcut(event);
  }

  onKeyUp(event) {
    this.keysPressed[event.key.toUpperCase()] = false;
  }

  handleExpressionShortcut(event) {
    const key = event.key.toLowerCase();
    const isCtrl = event.ctrlKey;
    const isShift = event.shiftKey;
    const isAlt = event.altKey;

    // Tier 1: Number keys 1-6 for quick expressions
    if (!isCtrl && !isShift && !isAlt && /^[1-6]$/.test(key)) {
      const expr = this.expressions.find(e => e.key === key);
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }

    // Tier 2: Shift + Arrow keys for eye directions
    if (isShift && !isCtrl && !isAlt) {
      let expr = null;
      switch (key) {
        case 'arrowup':
          expr = this.expressions.find(e => e.name === 'LookUp');
          break;
        case 'arrowdown':
          expr = this.expressions.find(e => e.name === 'LookDown');
          break;
        case 'arrowleft':
          expr = this.expressions.find(e => e.name === 'LookLeft');
          break;
        case 'arrowright':
          expr = this.expressions.find(e => e.name === 'LookRight');
          break;
      }
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }

    // Tier 2: Ctrl + brackets for eye blinks
    if (isCtrl && !isShift && !isAlt) {
      let expr = null;
      if (key === '[') {
        expr = this.expressions.find(e => e.name === 'Blink_L');
      } else if (key === ']') {
        expr = this.expressions.find(e => e.name === 'Blink_R');
      }
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }

    // Tier 3: Ctrl + U/I/O for eyebrow animations
    if (isCtrl && !isShift && !isAlt && /^[uio]$/.test(key)) {
      let expr = null;
      switch (key) {
        case 'u':
          expr = this.expressions.find(e => e.name === 'BrowDownLeft');
          break;
        case 'i':
          expr = this.expressions.find(e => e.name === 'BrowDownRight');
          break;
        case 'o':
          expr = this.expressions.find(e => e.name === 'BrowInnerUp');
          break;
      }
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }

    // Tier 3: Alt + AIEUO for mouth shapes (lip-sync)
    if (isAlt && !isCtrl && !isShift && /^[aieuo]$/.test(key)) {
      const expr = this.expressions.find(e => e.name === key.toUpperCase());
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }

    // Tier 3: C for cheek puff
    if (!isCtrl && !isShift && !isAlt && key === 'c') {
      const expr = this.expressions.find(e => e.name === 'CheekPuff');
      if (expr) {
        this.triggerEasterEggExpression(expr);
        return;
      }
    }
  }

  triggerEasterEggExpression(expression) {
    // Pause idle animation for Easter egg
    this.isIdleAnimationActive = false;
    this.expressionTime = 0;
    this.currentExpression = expression.name;
    this.expressionDuration = expression.duration;

    this.applyExpression(expression.name);

    // Resume idle animation after expression duration
    setTimeout(() => {
      this.isIdleAnimationActive = true;
      this.lastIdleAction = Date.now();  // Reset idle timer
    }, expression.duration * 1000);
  }

  updateModelPosition() {
    // WASD or Arrow keys for movement
    const moveSpeed = this.keyboardSpeed;

    // Left/Right (X axis)
    if (this.keysPressed['A'] || this.keysPressed['ARROWLEFT']) {
      this.modelPositionOffset.x -= moveSpeed;
    }
    if (this.keysPressed['D'] || this.keysPressed['ARROWRIGHT']) {
      this.modelPositionOffset.x += moveSpeed;
    }

    // Up/Down (Y axis) - W/E or Up/Down arrows
    if (this.keysPressed['W'] || this.keysPressed['ARROWUP']) {
      this.modelPositionOffset.y += moveSpeed;
    }
    if (this.keysPressed['S'] || this.keysPressed['ARROWDOWN']) {
      this.modelPositionOffset.y -= moveSpeed;
    }

    // Forward/Back (Z axis) - Q/E for in/out
    if (this.keysPressed['Q']) {
      this.modelPositionOffset.z -= moveSpeed;
    }
    if (this.keysPressed['E']) {
      this.modelPositionOffset.z += moveSpeed;
    }

    // Apply offset to model if it exists
    if (this.vrm && this.vrm.scene) {
      this.vrm.scene.position.x = this.modelPositionOffset.x;
      this.vrm.scene.position.y = this.modelPositionOffset.y + 1.2;
      this.vrm.scene.position.z = this.modelPositionOffset.z;
    }
  }

  onMouseDown(event) {
    this.isMouseDown = true;
    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  onMouseMove(event) {
    if (!this.isMouseDown) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    // Update target rotation
    this.targetRotation.y += deltaX * 0.005;
    this.targetRotation.x += deltaY * 0.005;

    // Clamp vertical rotation
    this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x));

    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  onMouseUp() {
    this.isMouseDown = false;
  }

  onMouseWheel(event) {
    event.preventDefault();

    // Zoom in/out
    const zoomSpeed = 0.1;
    this.targetCameraDistance += event.deltaY > 0 ? zoomSpeed : -zoomSpeed;

    // Clamp zoom distance - allow closer zooming (0.8 to 3.5)
    this.targetCameraDistance = Math.max(0.8, Math.min(3.5, this.targetCameraDistance));
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      // Single touch - rotation
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    } else if (event.touches.length === 2) {
      // Two finger touch - pinch zoom
      this.isPinching = true;
      this.touchDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
    }
  }

  onTouchMove(event) {
    if (event.touches.length === 1 && !this.isPinching) {
      // Single touch rotation
      const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
      const deltaY = event.touches[0].clientY - this.previousMousePosition.y;

      this.targetRotation.y += deltaX * 0.005;
      this.targetRotation.x += deltaY * 0.005;

      this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x));

      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    } else if (event.touches.length === 2) {
      // Two finger pinch zoom
      const newDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
      const deltaDistance = newDistance - this.touchDistance;

      // Zoom based on pinch distance change
      this.targetCameraDistance -= deltaDistance * 0.01;
      this.targetCameraDistance = Math.max(0.8, Math.min(3.5, this.targetCameraDistance));

      this.touchDistance = newDistance;
    }
  }

  onTouchEnd() {
    this.isPinching = false;
  }

  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setupBlendShapes(model) {
    this.blendShapes = {}; // Clear previous blend shapes

    // Try to use VRM ExpressionManager if available
    if (this.vrm && this.vrm.expressionManager) {
      // Access preset expressions via presetExpressionMap (getter) or check available expressions
      const presetExpressions = this.vrm.expressionManager.presetExpressionMap || {};
      if (Object.keys(presetExpressions).length > 0) {
        for (const key in presetExpressions) {
          if (presetExpressions.hasOwnProperty(key)) {
            this.blendShapes[key] = key; // Store preset names
          }
        }
        } else {
        }
    } else {
      // Extract blend shapes (morph targets) from the model
      model.traverse((mesh) => {
        if (mesh.morphTargetInfluences) {
          const morphTargetNames = mesh.geometry.morphAttributes.position
            ? Object.keys(mesh.geometry.morphAttributes).filter(key => mesh.geometry.morphAttributes[key].length > 0)
            : [];

          // VRM models may have blend shape names in userData
          if (mesh.userData && mesh.userData.targetNames) {
            this.blendShapes[mesh.name] = mesh.userData.targetNames;
          } else if (morphTargetNames.length > 0) {
            this.blendShapes[mesh.name] = morphTargetNames;
          }

          // Reset all influences
          mesh.morphTargetInfluences.forEach((_, i) => {
            mesh.morphTargetInfluences[i] = 0;
          });
        }
      });

      if (Object.keys(this.blendShapes).length > 0) {
        } else {
        // We'll simulate expressions with head rotation and scale
        this.useSimulatedExpressions = true;
      }
    }
  }

  logAllBones(model) {
    // DEBUG: Log all bones in the skeleton to understand structure
    const bones = [];
    const skeletons = [];

    model.traverse((obj) => {
      // Check if object is a bone (part of skeleton)
      if (obj.isBone || (obj.type === 'Bone') || (obj.parent && obj.parent.isSkinnedMesh)) {
        bones.push(obj.name);
      }

      // Check for skeleton
      if (obj.type === 'Skeleton') {
        skeletons.push(obj.name);
      }
    });

    if (bones.length > 0) {
      }

    // Also check for armature
    model.traverse((obj) => {
      if (obj.name.toLowerCase().includes('armature') || obj.name.toLowerCase().includes('skeleton')) {
        const childBones = [];
        obj.traverse((child) => {
          if (child !== obj && (child.isBone || child.type === 'Bone')) {
            childBones.push(child.name);
          }
        });
        if (childBones.length > 0) {
          }
      }
    });

    }

  async loadVMDAnimation(model) {
    try {
      // Check if VMDLoader is available
      if (typeof VMDLoader === 'undefined') {
        console.warn('⚠️  VMDLoader not available');
        return Promise.resolve();
      }

      const vmdLoader = new VMDLoader();
      const vmdData = await vmdLoader.load('assets/animations/bounce_dance_part1.vmd');

      // Create AnimationMixer if not already created
      // Find Armature first (bones are nested under it)
      let armatureFound = null;
      model.traverse((obj) => {
        if (obj.name === 'Armature' || obj.name.toLowerCase().includes('skeleton')) {
          armatureFound = obj;
        }
      });
      
      if (!this.animationMixer) {
        const mixerTarget = armatureFound || model;
        this.animationMixer = new THREE.AnimationMixer(mixerTarget);
        }

      // Store the animation clip
      this.vmdAnimation = vmdData.clip;
      this.vmdLoaded = true;

      // Add to available animations
      this.availableAnimations.push(vmdData.clip);
      
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error loading VMD animation:', error);
      this.vmdLoaded = false;
      return Promise.reject(error);
    }
  }

  playNextExpression() {
    // Pick a random expression
    const expression = this.expressions[Math.floor(Math.random() * this.expressions.length)];
    this.currentExpression = expression.name;
    this.expressionTime = 0;
    this.expressionDuration = expression.duration;

    // Log expression change with clarification
    const blendShapeInfo = Object.keys(this.blendShapes).length > 0
      ? `(${Object.keys(this.blendShapes).length} blend shapes available)`
      : '(no blend shapes found - using simulated expressions)';

    // Apply expression-based transformations
    this.applyExpression(expression.name);
  }

  applyExpression(expressionName) {
    if (!this.vrm) return;

    // Try to use VRM expression manager if available (three-vrm v2+)
    if (this.vrm && this.vrm.expressionManager) {
      try {
        // Check if setExpression method exists before using it
        if (typeof this.vrm.expressionManager.setExpression !== 'function') {
          // Expression manager exists but doesn't have setExpression method
          // Fall through to blend shape fallback
          throw new Error('setExpression method not available');
        }
        
        const presetName = this.mapExpressionToPreset(expressionName);
        
        // Access preset expressions via presetExpressionMap (getter)
        const presetExpressionMap = this.vrm.expressionManager.presetExpressionMap || {};
        
        // Check if preset exists in the map
        if (presetName && presetExpressionMap[presetName] !== undefined) {
          // Reset all expressions first (clear() may not exist in all versions)
          // Instead, set all expressions to 0, then set the target
          try {
            if (typeof this.vrm.expressionManager.clear === 'function') {
              this.vrm.expressionManager.clear();
            } else if (typeof this.vrm.expressionManager.setExpression === 'function') {
              // Fallback: manually reset all expressions
              const allPresets = Object.keys(presetExpressionMap);
              allPresets.forEach(preset => {
                this.vrm.expressionManager.setExpression(preset, 0.0);
              });
            }
          } catch (e) {
            // If clear/reset fails, just proceed - setExpression will override
          }
          // Set the target expression
          this.vrm.expressionManager.setExpression(presetName, 1.0); // Full intensity
          if (typeof this.vrm.expressionManager.update === 'function') {
          this.vrm.expressionManager.update(); // Apply changes
          }
          return;
        } else {
          const availablePresets = Object.keys(presetExpressionMap).slice(0, 10);
          console.warn(`⚠️  Expression preset "${presetName}" not found. Available: ${availablePresets.join(', ')}`);
        }
      } catch (error) {
        // Silently fall through to blend shape fallback - this is expected if expression manager API differs
        // Only log if it's not our expected "setExpression not available" error
        if (!error.message || !error.message.includes('setExpression method not available')) {
        console.warn(`⚠️  Error applying expression via VRM expression manager:`, error);
        }
        // Fall through to blend shape fallback
      }
    }

    // Fallback: Apply blend shapes directly to meshes
    const model = this.vrm.scene;

    // Find the expression config to get the blend shape index
    const expressionConfig = this.expressions.find(e => e.name === expressionName);
    if (!expressionConfig) {
      console.warn(`⚠️  Expression "${expressionName}" not found in expressions config`);
      return;
    }

    // Apply blend shapes to all meshes
    let applied = false;
    model.traverse((mesh) => {
      if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
        // Reset all influences first (except blink which should be quick)
        if (expressionName !== 'blink' && expressionName !== 'Blink_L' && expressionName !== 'Blink_R') {
          mesh.morphTargetInfluences.forEach((_, i) => {
            mesh.morphTargetInfluences[i] = 0;
          });
        }

        // Apply the target expression blend shape
        const index = expressionConfig.index;
        if (index >= 0 && index < mesh.morphTargetInfluences.length) {
          mesh.morphTargetInfluences[index] = 1.0; // Full intensity for expression
          applied = true;
        }
      }
    });
    
    if (applied) {
      } else {
      console.warn(`⚠️  Could not apply expression "${expressionName}" - blend shape index ${expressionConfig.index} not found`);
    }
  }

  mapExpressionToPreset(expressionName) {
    // Map our expression names to VRM preset names
    // Available VRM presets: neutral, aa, ih, ou, ee, oh, blink, happy, angry, sad, relaxed, lookUp, lookDown, lookLeft, lookRight, blinkLeft, blinkRight, surprised
    const presetMap = {
      'joy': 'happy',
      'angry': 'angry',
      'sorrow': 'sad',
      'fun': 'happy', // Map fun to happy since fun isn't available
      'blink': 'blink',
      'Blink_L': 'blinkLeft', // VRM has blinkLeft preset
      'blink_l': 'blinkLeft',
      'blink_left': 'blinkLeft',
      'blinkLeft': 'blinkLeft', // Keep as is - VRM has this preset
      'Blink_R': 'blinkRight', // VRM has blinkRight preset
      'blink_r': 'blinkRight',
      'blink_right': 'blinkRight',
      'blinkRight': 'blinkRight', // Keep as is - VRM has this preset
      'LookUp': 'lookUp', // VRM has lookUp preset
      'lookup': 'lookUp',
      'LookDown': 'lookDown', // VRM has lookDown preset
      'lookdown': 'lookDown',
      'LookLeft': 'lookLeft', // VRM has lookLeft preset
      'lookleft': 'lookLeft',
      'LookRight': 'lookRight', // VRM has lookRight preset
      'lookright': 'lookRight',
      'A': 'aa',
      'I': 'ih',
      'U': 'ou',
      'E': 'ee',
      'O': 'oh'
    };
    // Return mapped value or original (preserve case) - don't lowercase
    return presetMap[expressionName] || expressionName;
  }

  playAnimation(animationNameOrClip, options = {}) {
    // Play a skeletal animation clip
    if (!this.animationMixer) {
      return false;
    }

    // Stop any currently playing animation
    if (this.currentAnimationAction) {
      this.currentAnimationAction.stop();
    }

    let clip = null;

    // Check if we got a clip object or a name string
    if (typeof animationNameOrClip === 'string') {
      // Find animation clip by name
      if (this.availableAnimations.length === 0) {
        return false;
      }
      clip = THREE.AnimationClip.findByName(this.availableAnimations, animationNameOrClip);
      if (!clip) {
        console.warn(`Animation "${animationNameOrClip}" not found`);
        return false;
      }
    } else if (animationNameOrClip && (animationNameOrClip.isAnimationClip || (animationNameOrClip.name && animationNameOrClip.tracks))) {
      // It's a clip object (check both isAnimationClip property and clip-like structure)
      clip = animationNameOrClip;
    } else {
      console.warn('playAnimation: Invalid parameter - must be string or AnimationClip', animationNameOrClip);
      return false;
    }

    // Play the animation
    const action = this.animationMixer.clipAction(clip);
    action.clampWhenFinished = options.clampWhenFinished !== undefined ? options.clampWhenFinished : true; // Default to true to keep final pose
    action.loop = options.loop !== undefined ? options.loop : THREE.LoopOnce;
    action.timeScale = options.timeScale !== undefined ? options.timeScale : 1.0;
    // Don't reset - start from beginning of animation
    // action.reset() would reset bones to T-pose, which we don't want
    action.play();

    this.currentAnimationAction = action;
    // Debug: Check which bones the animation tracks are trying to target
    if (clip.tracks.length > 0) {
      const boneNames = new Set();
      const trackTypes = { position: 0, quaternion: 0, rotation: 0 };
      clip.tracks.forEach(track => {
        const match = track.name.match(/^([^.]+)\.(position|quaternion|rotation)/);
        if (match) {
          boneNames.add(match[1]);
          trackTypes[match[2]]++;
        }
      });
      // Verify bones exist in the model and check if AnimationMixer can find them
      const model = this.vrm ? this.vrm.scene : null;
      const mixerRoot = this.animationMixer ? this.animationMixer.getRoot() : model;
      if (model && mixerRoot) {
        const foundBones = [];
        const missingBones = [];
        const boneObjects = new Map();
        const mixerRootBones = new Map(); // Bones accessible from mixer root
        
        // First, collect all bones in the model (from scene root)
        model.traverse((obj) => {
          if (obj.isBone || obj.type === 'Bone') {
            boneObjects.set(obj.name, obj);
          }
        });
        
        // Also collect bones from mixer root hierarchy (important if mixer root is Armature)
        mixerRoot.traverse((obj) => {
          if (obj.isBone || obj.type === 'Bone') {
            mixerRootBones.set(obj.name, obj);
          }
        });
        
        // Check each bone name from animation
        let bindableCount = 0;
        boneNames.forEach(boneName => {
          if (boneObjects.has(boneName)) {
            foundBones.push(boneName);
            // Verify the bone can be found by PropertyBinding (what AnimationMixer uses)
            // Use the mixer root (Armature) instead of scene root for PropertyBinding test
            try {
              const binding = new THREE.PropertyBinding(mixerRoot, boneName + '.quaternion');
              if (binding.node) {
                bindableCount++;
                // Only log first few to avoid spam
                if (bindableCount <= 5) {
                  }
              } else {
                console.warn(`   ⚠️  Bone "${boneName}" exists but PropertyBinding.node is null (tried from ${mixerRoot.name || 'mixer root'})`);
              }
            } catch (e) {
              console.warn(`   ⚠️  Bone "${boneName}" exists but not bindable from mixer root:`, e.message);
            }
          } else {
            missingBones.push(boneName);
          }
        });
        
        if (missingBones.length > 0) {
          console.warn(`   ⚠️  Missing ${missingBones.length} bones: ${missingBones.slice(0, 10).join(', ')}${missingBones.length > 10 ? '...' : ''}`);
        }
        
        // Log a few sample bone positions to verify they're accessible
        if (foundBones.length > 0) {
          const sampleBone = boneObjects.get(foundBones[0]);
          if (sampleBone) {
            }
        }
      }
    }

    return true;
  }

  updateExpressions(deltaTime) {
    if (!this.currentExpression) return;

    this.expressionTime += deltaTime;

    // Transition out of expression smoothly
    const progress = this.expressionTime / this.expressionDuration;

    if (progress >= 1) {
      // Expression finished, clear it
      this.currentExpression = null;
    } else if (progress > 0.85) {
      // Fade out expression (start fade at 85% of duration, not 80%)
      const fadeOut = 1 - (progress - 0.85) / 0.15;
      if (this.vrm) {
        this.vrm.scene.traverse((mesh) => {
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences.forEach((_, i) => {
              mesh.morphTargetInfluences[i] = (mesh.morphTargetInfluences[i] || 0) * fadeOut;
            });
          }
        });
      }
    }
  }

  updateEntranceAnimation() {
    // Only run if model is loaded and entrance not complete
    if (!this.vrm || this.entranceAnimationComplete) {
      // After entrance, enable idle animation
      if (!this.isIdleAnimationActive && this.entranceAnimationComplete) {
        this.isIdleAnimationActive = true;
        this.lastIdleAction = Date.now();
        }
      return;
    }

    // Wait for VMD to load before starting entrance animation
    if (this.waitingForVMD) {
      return; // Don't start entrance yet
    }

    // On first frame of entrance, start skeletal animation using VRM humanoid bone system
    // Only start if VRM is fully loaded and humanoid system is ready
    if (!this.usingSkeletalAnimation && this.vrm && this.vrm.humanoid && this.animationMixer) {
      // Set entrance start time now that we're actually starting
      if (this.entranceStartTime === 0) {
        this.entranceStartTime = Date.now();
      }
      this.usingSkeletalAnimation = true;
      this.lastBodyPositionLog = Date.now();
      
      // Disable VRM's auto-update of humanoid bones to allow custom animations
      // This prevents VRM from resetting bone rotations after AnimationMixer updates them
      let wasAutoUpdate = true;
      if (this.vrm && this.vrm.humanoid) {
        wasAutoUpdate = this.vrm.humanoid.autoUpdateHumanBones;
        this.vrm.humanoid.autoUpdateHumanBones = false;
        } else {
        console.warn('⚠️  Cannot disable autoUpdateHumanBones - vrm or humanoid not available');
      }
      
      const walkAnimation = this.createSimpleWalkAnimation();
      if (walkAnimation) {
        this.entranceAnimationDuration = walkAnimation.duration;
        const played = this.playAnimation(walkAnimation, {
          loop: THREE.LoopRepeat,
          clampWhenFinished: false
        });
        if (!played) {
          console.warn('⚠️  Failed to play walk animation, model will remain in T-pose');
          this.entranceAnimationDuration = 4.0;
          this.usingSkeletalAnimation = false;
          // Re-enable auto-update if animation failed
          if (this.vrm && this.vrm.humanoid) {
            this.vrm.humanoid.autoUpdateHumanBones = wasAutoUpdate;
          }
        } else {
          if (this.currentAnimationAction) {
            }
        }
      } else {
        console.warn('⚠️  Could not create walk animation, model will remain in T-pose');
        this.entranceAnimationDuration = 4.0;
        this.usingSkeletalAnimation = false;
        // Re-enable auto-update if animation creation failed
        if (this.vrm && this.vrm.humanoid) {
          this.vrm.humanoid.autoUpdateHumanBones = wasAutoUpdate;
        }
      }
    }

    // Only calculate progress if entrance has actually started
    if (this.entranceStartTime === 0) {
      return; // Wait for entrance to start
    }

    const now = Date.now();
    const elapsed = (now - this.entranceStartTime) / 1000;  // Convert to seconds
    const progress = Math.min(1, elapsed / this.entranceAnimationDuration);

    if (progress < 1) {
      // Only apply direct bone animation if NOT using VMD animation
      if (!this.currentAnimationAction || !this.currentAnimationAction.isRunning()) {
        this.applyBoneAnimation(progress);
      }
      // If VMD animation is playing, let it handle the animation
    } else {
      // Entrance complete
      if (!this.entranceAnimationComplete) {
        this.entranceAnimationComplete = true;
        this.modelPositionOffset.z = 0;
        this.modelPositionOffset.y = -1.0;

        // Keep animation clamped at the end instead of stopping it
        // This prevents the model from returning to T-pose
        if (this.currentAnimationAction) {
          // Don't stop the animation - keep it clamped at the final frame
          // The clampWhenFinished: true option should keep it at the end
          if (!this.currentAnimationAction.paused) {
            this.currentAnimationAction.paused = true; // Pause at final frame
          }
          }

        // Wink when arriving
        this.triggerIdleAction({ type: 'blink_left', duration: 0.15 });
      }
    }
  }

  createSimpleWalkAnimation() {
    // Create a simple rotation-only walking animation clip using VRM humanoid bone system
    // This uses vrm.humanoid.humanBones to access bones correctly
    const duration = 2.0; // 2 second walk cycle
    const fps = 30;
    const totalFrames = Math.ceil(duration * fps);
    const tracks = [];

    // Helper functions
    const sine = (t) => Math.sin(t * Math.PI * 2);
    const createQuaternion = (x, y, z) => {
      const euler = new THREE.Euler(x, y, z, 'XYZ');
      const quat = new THREE.Quaternion();
      quat.setFromEuler(euler);
      return [quat.x, quat.y, quat.z, quat.w];
    };
    
    // Get the mixer root to ensure bone paths are correct
    const mixerRoot = this.animationMixer ? this.animationMixer.getRoot() : null;
    const rootName = mixerRoot ? mixerRoot.name : '';
    // Use VRM humanoid bone system to get bone nodes
    // This is the proper way to access VRM bones according to three-vrm documentation
    const humanBones = this.vrm.humanoid.humanBones;
    const boneNodes = {};
    
    // Get bone nodes from VRM humanoid system
    // Include lower arms for more natural arm swing
    const boneTypes = ['hips', 'spine', 'chest', 
                       'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
                       'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'];
    
    for (const boneType of boneTypes) {
      const humanBone = humanBones[boneType];
      if (humanBone && humanBone.node) {
        boneNodes[boneType] = humanBone.node;
        } else {
        }
    }
    
    // Log arm bone status specifically
    if (boneNodes.leftUpperArm && boneNodes.rightUpperArm) {
      } else {
      console.warn(`   ⚠️  Arm bones missing - leftUpperArm: ${!!boneNodes.leftUpperArm}, rightUpperArm: ${!!boneNodes.rightUpperArm}`);
    }

    // Create rotation tracks for each bone using VRM humanoid bone names
    const times = [];
    const rotations = {};
    
    // Initialize rotation arrays for each bone type
    for (const boneType of boneTypes) {
      if (boneNodes[boneType]) {
        rotations[boneType] = [];
      }
    }

    for (let frame = 0; frame <= totalFrames; frame++) {
      const time = frame / fps;
      const walkCycle = (time / duration) % 1.0; // 0 to 1 walk cycle
      times.push(time);

      // Spine slight sway (Y rotation) - subtle and sexy
      if (boneNodes.spine) {
        const spineY = sine(walkCycle) * 0.08; // Subtle sway
        rotations.spine.push(...createQuaternion(0, spineY, 0));
      }

      // Chest slight rotation - subtle and sexy
      if (boneNodes.chest) {
        const chestY = sine(walkCycle) * 0.06;
        rotations.chest.push(...createQuaternion(0, chestY, 0));
      }

      // Arms swing opposite to legs (X rotation) - synchronized with legs, subtle
      // 
      // ROTATION AXIS DOCUMENTATION:
      // - X axis: Forward/back swing during walk (positive = forward, negative = back)
      // - Y axis: Rotation to bring arms down from T-pose
      //   * 90 degrees (Math.PI/2) = horizontal T-pose (arms straight out)
      //   * Less than 90 = arms hang down (smaller = more vertical/hanging)
      //   * Currently ~65 degrees = arms stick out ~25 degrees from body (prevents thigh clipping)
      // - Z axis: Rotation to bring arms from front of body to sides
      //   * -90 degrees = right arm to right side
      //   * +90 degrees = left arm to left side (mirrored coordinate system)
      //
      // Right arm is correct, so use same Y rotation for left arm
      // But negate Z rotation for left arm due to mirrored coordinate system
      // Left arm also needs slight X rotation adjustment to fix palm twist
      const armBaseRotationY = Math.PI / 2 - (15 * Math.PI / 180); // ~75 degrees (15 degrees away from vertical, more natural walking position - arms away from body)
      // Z rotation: brings arms from front to sides, with mirrored rotation for natural look
      // Right arm: needs more Z rotation to bring it down (currently too high)
      const armBaseRotationZ_Right = -Math.PI / 2 + (15 * Math.PI / 180); // -75 degrees (15 degrees clockwise from -90, brings it down more)
      // Left arm: match right arm's height by using same absolute Z value but opposite sign
      const armBaseRotationZ_Left = Math.PI / 2 - (15 * Math.PI / 180) + (25 * Math.PI / 180); // +100 degrees (forward 25 degrees to match right arm position)
      // Left arm palm orientation: Instead of X rotation (which cascades), adjust Y rotation slightly
      // This avoids cascading effects from X rotation
      const armBaseRotationX_Left = 0; // No X rotation - avoid cascading effects
      const armBaseRotationY_Left = armBaseRotationY - (10 * Math.PI / 180); // Slightly different Y to fix palm orientation
      const armSwingAmplitude = 0.5; // Increased from 0.4 to match leg motion
      
      // Left arm forward when right leg is forward (walkCycle + 0.75)
      // Right arm forward when left leg is forward (walkCycle + 0.25)
      // Upper arms swing forward/back (X) on top of base rotation (Y + Z)
      if (boneNodes.leftUpperArm) {
        const leftArmSwing = sine(walkCycle + 0.75) * armSwingAmplitude; // Same X swing as right
        // Use same Y but negate Z rotation for left arm due to mirrored coordinate system
        // Add base X rotation to fix palm twist
        rotations.leftUpperArm.push(...createQuaternion(leftArmSwing + armBaseRotationX_Left, armBaseRotationY, armBaseRotationZ_Left));
      }
      if (boneNodes.rightUpperArm) {
        const rightArmSwing = sine(walkCycle + 0.25) * armSwingAmplitude;
        // Base Y rotation to hang + Z rotation to bring to side + X rotation for swing
        rotations.rightUpperArm.push(...createQuaternion(rightArmSwing, armBaseRotationY, armBaseRotationZ_Right));
      }
      // Lower arms bend slightly when arm swings forward (more natural)
      if (boneNodes.leftLowerArm) {
        const leftLowerArmX = Math.max(0, sine(walkCycle + 0.75)) * 0.15; // Subtle bend
        rotations.leftLowerArm.push(...createQuaternion(leftLowerArmX, 0, 0));
      }
      if (boneNodes.rightLowerArm) {
        const rightLowerArmX = Math.max(0, sine(walkCycle + 0.25)) * 0.15; // Subtle bend
        rotations.rightLowerArm.push(...createQuaternion(rightLowerArmX, 0, 0));
      }

      // Legs - walking motion (X rotation) - smaller, sexier steps
      if (boneNodes.leftUpperLeg) {
        const leftLegX = sine(walkCycle + 0.25) * 0.3; // Smaller, sexier steps
        rotations.leftUpperLeg.push(...createQuaternion(leftLegX, 0, 0));
      }
      if (boneNodes.rightUpperLeg) {
        const rightLegX = sine(walkCycle + 0.75) * 0.3; // Smaller, sexier steps
        rotations.rightUpperLeg.push(...createQuaternion(rightLegX, 0, 0));
      }

      // Lower legs - bend when leg is forward (X rotation) - subtle
      if (boneNodes.leftLowerLeg) {
        const leftLowerX = Math.max(0, sine(walkCycle + 0.25)) * 0.35; // Subtle bend
        rotations.leftLowerLeg.push(...createQuaternion(leftLowerX, 0, 0));
      }
      if (boneNodes.rightLowerLeg) {
        const rightLowerX = Math.max(0, sine(walkCycle + 0.75)) * 0.35; // Subtle bend
        rotations.rightLowerLeg.push(...createQuaternion(rightLowerX, 0, 0));
      }
    }

    // Add tracks using bone names from VRM humanoid system
    // AnimationMixer will find bones by name from its root (Armature)
    for (const boneType of boneTypes) {
      if (boneNodes[boneType] && rotations[boneType] && rotations[boneType].length > 0) {
        const boneName = boneNodes[boneType].name;
        const track = new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, rotations[boneType]);
        tracks.push(track);
        }
    }

    if (tracks.length === 0) {
      console.warn('⚠️  No bones found for walk animation');
      return null;
    }

    const clip = new THREE.AnimationClip('simple_walk', duration, tracks);
    // Store animation data for manual application (workaround for PropertyBinding issue)
    this._walkAnimationData = {
      duration: duration,
      boneNodes: boneNodes,
      fps: fps
    };
    return clip;
  }

  applyManualWalkAnimation(time) {
    // Manually apply walk animation rotations directly to bones
    // This is a workaround because AnimationMixer PropertyBinding isn't working
    if (!this._walkAnimationData || !this.vrm || !this.vrm.humanoid) {
      if (!this._manualAnimSkipLog || Date.now() - this._manualAnimSkipLog > 2000) {
        console.warn('⚠️  applyManualWalkAnimation skipped:', {
          hasData: !!this._walkAnimationData,
          hasVrm: !!this.vrm,
          hasHumanoid: !!(this.vrm && this.vrm.humanoid)
        });
        this._manualAnimSkipLog = Date.now();
      }
      return;
    }
    
    // Disable VRM auto-update to prevent it from resetting our manual rotations
    if (this.vrm.humanoid.autoUpdateHumanBones) {
      this.vrm.humanoid.autoUpdateHumanBones = false;
      if (!this._autoUpdateDisabledLog) {
        this._autoUpdateDisabledLog = true;
      }
    }
    
    const { boneNodes, duration } = this._walkAnimationData;
    const walkCycle = (time / duration) % 1.0;
    
    // Debug log (only once per second to avoid spam)
    if (!this._manualAnimApplyLog || Date.now() - this._manualAnimApplyLog > 1000) {
      this._manualAnimApplyLog = Date.now();
    }
    
    // Helper functions (same as in createSimpleWalkAnimation)
    const sine = (t) => Math.sin(t * Math.PI * 2);
    const createQuaternion = (x, y, z) => {
      const euler = new THREE.Euler(x, y, z, 'XYZ');
      const quat = new THREE.Quaternion();
      quat.setFromEuler(euler);
      return quat;
    };
    
    // Apply rotations directly to bone nodes - subtle, sexy walk
    if (boneNodes.spine) {
      const spineY = sine(walkCycle) * 0.08; // Subtle sway
      boneNodes.spine.quaternion.copy(createQuaternion(0, spineY, 0));
    }
    
    if (boneNodes.chest) {
      const chestY = sine(walkCycle) * 0.06; // Subtle rotation
      boneNodes.chest.quaternion.copy(createQuaternion(0, chestY, 0));
    }
    
    // Apply arm rotations - CRITICAL: Must apply even if AnimationMixer didn't find them
    // 
    // NEW APPROACH: Set base position FIRST, then apply walking swing on top
    // This avoids cascading rotation issues by separating base pose from animation
    //
    // ROTATION AXIS DOCUMENTATION:
    // - X axis: Forward/back swing during walk (positive = forward, negative = back)
    // - Y axis: Rotation to bring arms down from T-pose
    //   * 90 degrees (Math.PI/2) = horizontal T-pose (arms straight out)
    //   * Less than 90 = arms hang down (smaller = more vertical/hanging)
    //   * Currently ~65 degrees = arms stick out ~25 degrees from body (prevents thigh clipping)
    // - Z axis: Rotation to bring arms from front of body to sides
    //   * -90 degrees = right arm to right side
    //   * +90 degrees = left arm to left side (mirrored coordinate system)
    //
    // Base position quaternions (resting pose - no walking swing)
    const armBaseRotationY = Math.PI / 2 - (15 * Math.PI / 180); // ~75 degrees (15 degrees away from vertical, more natural walking position - arms away from body)
    const armBaseRotationZ_Right = -Math.PI / 2 + (15 * Math.PI / 180); // -75 degrees (brings right arm to side)
    const armBaseRotationZ_Left = Math.PI / 2 - (15 * Math.PI / 180) + (25 * Math.PI / 180); // +100 degrees (brings left arm forward 25 degrees to match right arm position)
    
    // Create base quaternions for resting position (Y and Z only, no X swing)
    const rightArmBaseQuat = createQuaternion(0, armBaseRotationY, armBaseRotationZ_Right);
    let leftArmBaseQuat = createQuaternion(0, armBaseRotationY, armBaseRotationZ_Left);
    
    // Fix left arm palm orientation: rotate around X axis so palm faces away from viewer
    // Apply this to the base quaternion (not the swing) to fix the resting pose
    const leftArmPalmCorrection = createQuaternion(-Math.PI / 2, 0, 0); // -90 degrees on X axis (counter-clockwise, palm away)
    leftArmBaseQuat = leftArmBaseQuat.clone().multiply(leftArmPalmCorrection);
    
    // Swing animation amplitude (X axis only - applied on top of base)
    // Increased to match bigger leg steps
    const armSwingAmplitude = 0.5; // Increased from 0.4 to match leg motion
    
    // Always try to get arms from VRM humanoid system directly
    const leftArmBone = this.vrm.humanoid.humanBones.leftUpperArm;
    const rightArmBone = this.vrm.humanoid.humanBones.rightUpperArm;
    
    if (leftArmBone && leftArmBone.node) {
      // Step 1: Start with base position (resting pose)
      const leftQuat = leftArmBaseQuat.clone();
      
      // Step 2: Apply walking swing on top (X axis only)
      // Left arm swings forward when right leg is forward (opposite to leg)
      // Right leg forward at walkCycle 0.75, so left arm forward at 0.75
      // Match the leg swing phase exactly for synchronized motion
      const leftArmSwing = sine(walkCycle + 0.75) * armSwingAmplitude;
      const swingQuat = createQuaternion(leftArmSwing, 0, 0); // X rotation only
      leftQuat.multiply(swingQuat); // Multiply quaternions to combine rotations
      
      leftArmBone.node.quaternion.copy(leftQuat);
      
      // Debug: Log left arm rotation values
      const leftEuler = new THREE.Euler().setFromQuaternion(leftQuat);
      } else if (boneNodes.leftUpperArm) {
      // Fallback to boneNodes if humanoid lookup failed
      // Step 1: Start with base position (resting pose)
      const leftQuat = leftArmBaseQuat.clone();
      
      // Step 2: Apply walking swing on top (X axis only)
      const leftArmSwing = sine(walkCycle + 0.75) * armSwingAmplitude;
      const swingQuat = createQuaternion(leftArmSwing, 0, 0); // X rotation only
      leftQuat.multiply(swingQuat); // Multiply quaternions to combine rotations
      
      boneNodes.leftUpperArm.quaternion.copy(leftQuat);
      
      // Debug: Log left arm rotation values
      const leftEuler = new THREE.Euler().setFromQuaternion(leftQuat);
      }
    
    if (rightArmBone && rightArmBone.node) {
      // Step 1: Start with base position (resting pose)
      const rightQuat = rightArmBaseQuat.clone();
      
      // Step 2: Apply walking swing on top (X axis only)
      // Right arm swings forward when left leg is forward (opposite to leg)
      // Left leg forward at walkCycle 0.25, so right arm forward at 0.25
      // Match the leg swing phase exactly for synchronized motion
      const rightArmSwing = sine(walkCycle + 0.25) * armSwingAmplitude;
      const swingQuat = createQuaternion(rightArmSwing, 0, 0); // X rotation only
      rightQuat.multiply(swingQuat); // Multiply quaternions to combine rotations
      
      rightArmBone.node.quaternion.copy(rightQuat);
      
      // Debug: Log right arm rotation values
      const rightEuler = new THREE.Euler().setFromQuaternion(rightQuat);
      } else if (boneNodes.rightUpperArm) {
      // Fallback to boneNodes if humanoid lookup failed
      // Step 1: Start with base position (resting pose)
      const rightQuat = rightArmBaseQuat.clone();
      
      // Step 2: Apply walking swing on top (X axis only)
      const rightArmSwing = sine(walkCycle + 0.25) * armSwingAmplitude;
      const swingQuat = createQuaternion(rightArmSwing, 0, 0); // X rotation only
      rightQuat.multiply(swingQuat); // Multiply quaternions to combine rotations
      
      boneNodes.rightUpperArm.quaternion.copy(rightQuat);
      
      // Debug: Log right arm rotation values
      const rightEuler = new THREE.Euler().setFromQuaternion(rightQuat);
      }
    
    // Lower arms - slight bend when arm swings forward
    const leftLowerArmBone = this.vrm.humanoid.humanBones.leftLowerArm;
    const rightLowerArmBone = this.vrm.humanoid.humanBones.rightLowerArm;
    
    if (leftLowerArmBone && leftLowerArmBone.node) {
      const leftLowerArmX = Math.max(0, sine(walkCycle + 0.75)) * 0.15; // Subtle bend
      leftLowerArmBone.node.quaternion.copy(createQuaternion(leftLowerArmX, 0, 0));
    } else if (boneNodes.leftLowerArm) {
      const leftLowerArmX = Math.max(0, sine(walkCycle + 0.75)) * 0.15;
      boneNodes.leftLowerArm.quaternion.copy(createQuaternion(leftLowerArmX, 0, 0));
    }
    
    if (rightLowerArmBone && rightLowerArmBone.node) {
      const rightLowerArmX = Math.max(0, sine(walkCycle + 0.25)) * 0.15; // Subtle bend
      rightLowerArmBone.node.quaternion.copy(createQuaternion(rightLowerArmX, 0, 0));
    } else if (boneNodes.rightLowerArm) {
      const rightLowerArmX = Math.max(0, sine(walkCycle + 0.25)) * 0.15;
      boneNodes.rightLowerArm.quaternion.copy(createQuaternion(rightLowerArmX, 0, 0));
    }
    
    // Improved leg animation - realistic walking with knee bending and ground contact
    // Hip movement for ground contact feel
    // IMPORTANT: Hip sway must coordinate with leg movement for forward momentum
    // Hips shift weight to the planted leg, creating forward drive
    if (boneNodes.hips) {
      // Hips shift to the leg that's back (planted), which drives forward motion
      // When left leg is forward, right leg is back (planted), so hips shift right
      const hipSway = -sine(walkCycle + 0.25) * 0.05; // NEGATE: shift to planted leg for forward momentum
      boneNodes.hips.quaternion.copy(createQuaternion(0, hipSway, 0));
    }
    
    // Upper legs - natural walking with proper knee usage
    // The key: thigh swings forward, but knee MUST bend to allow the step
    // When leg is forward (lifting phase), knee bends to bring foot up
    // When leg is back (planting phase), knee straightens for ground contact
    // IMPORTANT: All movements must be coordinated in the same forward direction
    if (boneNodes.leftUpperLeg) {
      const leftPhase = (walkCycle + 0.25) % 1;
      // Thigh swings forward (positive when forward, negative when back)
      // For forward walking: positive X rotation = forward swing
      // Increased amplitude for bigger steps toward viewer
      const leftLegSwing = sine(walkCycle + 0.25) * 0.35; // Increased from 0.25 to 0.35 for bigger steps
      // Slight lift only when leg is in forward swing phase
      const leftLegLift = leftPhase > 0.1 && leftPhase < 0.5 ? 
        Math.sin((leftPhase - 0.1) / 0.4 * Math.PI) * 0.1 : // Slightly increased lift
        0; // No lift when back
      boneNodes.leftUpperLeg.quaternion.copy(createQuaternion(leftLegSwing, leftLegLift, 0));
    }
    
    if (boneNodes.rightUpperLeg) {
      const rightPhase = (walkCycle + 0.75) % 1;
      // Thigh swings forward (positive when forward, negative when back)
      // For forward walking: positive X rotation = forward swing
      // Increased amplitude for bigger steps toward viewer
      const rightLegSwing = sine(walkCycle + 0.75) * 0.35; // Increased from 0.25 to 0.35 for bigger steps
      // Slight lift only when leg is in forward swing phase
      const rightLegLift = rightPhase > 0.1 && rightPhase < 0.5 ?
        Math.sin((rightPhase - 0.1) / 0.4 * Math.PI) * 0.1 : // Slightly increased lift
        0; // No lift when back
      boneNodes.rightUpperLeg.quaternion.copy(createQuaternion(rightLegSwing, rightLegLift, 0));
    }
    
    // Lower legs - natural knee bending using momentum
    // Knee bends when leg is lifted (forward phase) to bring foot up
    // Knee straightens when leg is planted (back phase) for ground contact
    if (boneNodes.leftLowerLeg) {
      const leftPhase = (walkCycle + 0.25) % 1;
      // When leg is forward (0.1-0.5): knee bends to lift foot (using momentum)
      // When leg is back (0.5-1.0): knee straightens for ground contact
      let kneeBend;
      if (leftPhase >= 0.1 && leftPhase < 0.5) {
        // Forward phase: bend knee to lift foot (peak bend at 0.3)
        const forwardProgress = (leftPhase - 0.1) / 0.4; // 0 to 1
        kneeBend = -Math.sin(forwardProgress * Math.PI) * 0.7; // NEGATE: bend knee backward (not forward)
      } else {
        // Back phase: straighten for ground contact
        const backProgress = leftPhase < 0.1 ? (leftPhase + 0.9) / 0.4 : (leftPhase - 0.5) / 0.5;
        kneeBend = -Math.max(0, (1 - backProgress) * 0.3); // NEGATE: gradually straighten
      }
      boneNodes.leftLowerLeg.quaternion.copy(createQuaternion(kneeBend, 0, 0));
    }
    
    if (boneNodes.rightLowerLeg) {
      const rightPhase = (walkCycle + 0.75) % 1;
      // When leg is forward (0.1-0.5): knee bends to lift foot (using momentum)
      // When leg is back (0.5-1.0): knee straightens for ground contact
      let kneeBend;
      if (rightPhase >= 0.1 && rightPhase < 0.5) {
        // Forward phase: bend knee to lift foot (peak bend at 0.3)
        const forwardProgress = (rightPhase - 0.1) / 0.4; // 0 to 1
        kneeBend = -Math.sin(forwardProgress * Math.PI) * 0.7; // NEGATE: bend knee backward (not forward)
      } else {
        // Back phase: straighten for ground contact
        const backProgress = rightPhase < 0.1 ? (rightPhase + 0.9) / 0.4 : (rightPhase - 0.5) / 0.5;
        kneeBend = -Math.max(0, (1 - backProgress) * 0.3); // NEGATE: gradually straighten
      }
      boneNodes.rightLowerLeg.quaternion.copy(createQuaternion(kneeBend, 0, 0));
    }
    
    // Enhanced body sway - more natural reaction to walking
    // IMPORTANT: Body sway must match leg movement direction for forward momentum
    // When left leg is forward, body leans slightly right (opposite side) for balance
    // This creates forward momentum, not backward
    if (boneNodes.spine) {
      // Spine sways opposite to the forward leg (left leg forward = lean right)
      // This creates forward momentum when coordinated with leg movement
      const spineSway = -sine(walkCycle + 0.25) * 0.12; // NEGATE: lean opposite to forward leg for forward momentum
      const spineTwist = sine(walkCycle) * 0.08; // Subtle twist (unchanged)
      boneNodes.spine.quaternion.copy(createQuaternion(0, spineSway, spineTwist));
    }
    
    if (boneNodes.chest) {
      // Chest sways opposite to the forward leg for forward momentum
      const chestSway = -sine(walkCycle + 0.25) * 0.08; // NEGATE: match spine for forward momentum
      const chestTwist = sine(walkCycle) * 0.05; // Subtle twist (unchanged)
      boneNodes.chest.quaternion.copy(createQuaternion(0, chestSway, chestTwist));
    }
    
    // Head slight bob to match body movement
    if (boneNodes.head) {
      const headBob = sine(walkCycle) * 0.04; // Subtle head movement
      boneNodes.head.quaternion.copy(createQuaternion(headBob * 0.5, 0, 0));
    }
    
    // Note: Breast physics, wings, tail, and hair are handled automatically by VRM spring bones
    // The vrm.update() call in animate() processes these physics-based animations
  }

  applyBoneAnimation(progress) {
    // This method is kept for backward compatibility but is now deprecated
    // Use createSimpleWalkAnimation() instead which creates proper AnimationClip
    // Direct bone manipulation can cause issues with VRM models
    return;
  }

  updateIdleAnimation() {
    // Only update idle if animation is active and no current expression
    if (!this.isIdleAnimationActive || this.currentExpression) return;

    const now = Date.now();
    if (now - this.lastIdleAction > this.idleActionInterval) {
      // Time for next idle action
      const action = this.idleActions[Math.floor(Math.random() * this.idleActions.length)];
      this.triggerIdleAction(action);
      this.lastIdleAction = now;
    }
  }

  logBodyPositions() {
    // Log key bone positions for debugging animation
    if (!this.vrm || !this.vrm.scene) return;

    const now = Date.now();
    if (!this.lastBodyPositionLog) {
      this.lastBodyPositionLog = now;
    }

    // Log every 500ms during entrance animation
    const shouldLog = !this.entranceAnimationComplete && (now - this.lastBodyPositionLog > 500);

    if (shouldLog) {
      // Find key bones
      let armature = null;
      let spine = null;
      let chest = null;

      this.vrm.scene.traverse((obj) => {
        if (obj.name === 'Armature') armature = obj;
        if (obj.name === 'Spine' || obj.name === 'spine' || obj.name === 'Spine.001') spine = obj;
        if (obj.name === 'Chest' || obj.name === 'chest') chest = obj;
      });

      let logStr = '👤 Body Position: ';

      if (armature) {
        logStr += `Armature(${armature.position.x.toFixed(2)}, ${armature.position.y.toFixed(2)}, ${armature.position.z.toFixed(2)})`;
      }
      if (spine) {
        logStr += ` | Spine(${spine.position.x.toFixed(2)}, ${spine.position.y.toFixed(2)}, ${spine.position.z.toFixed(2)})`;
      }
      if (chest) {
        logStr += ` | Chest(${chest.position.x.toFixed(2)}, ${chest.position.y.toFixed(2)}, ${chest.position.z.toFixed(2)})`;
      }

      const progress = Math.min(1, (now - this.entranceStartTime) / 1000 / this.entranceAnimationDuration);
      logStr += ` | Progress: ${(progress * 100).toFixed(0)}%`;

      this.lastBodyPositionLog = now;
    }
  }

  triggerIdleAction(action) {
    if (action.type === 'blink') {
      const expr = this.expressions.find(e => e.name === 'blink');
      if (expr) {
        this.expressionTime = 0;
        this.currentExpression = expr.name;
        this.expressionDuration = expr.duration;
        this.applyExpression(expr.name);
      }
    } else if (action.type === 'blink_left') {
      // Use blinkLeft preset (VRM has blinkLeft preset)
      this.expressionTime = 0;
      this.currentExpression = 'blinkLeft';
      this.expressionDuration = action.duration || 0.15;
      this.applyExpression('blinkLeft');
    } else if (action.type === 'expression') {
      const expr = this.expressions.find(e => e.name === action.name);
      if (expr) {
        this.expressionTime = 0;
        this.currentExpression = expr.name;
        this.expressionDuration = action.duration || expr.duration;
        this.applyExpression(expr.name);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Idle realism: passive blink + saccades + looping .vrma clip.
  // Ported from celeste-tts-bot/obs/vrm-viewer.html so Celeste isn't a statue.
  // ---------------------------------------------------------------------------

  _setBlendShape(name, weight) {
    const manager = this.vrm?.expressionManager;
    if (!manager || !name) return;
    try {
      if (typeof manager.setValue === 'function') {
        manager.setValue(name, weight);
      } else if (typeof manager.setExpression === 'function') {
        manager.setExpression(name, weight);
      }
    } catch (err) {
      if (!this.warnedExpressions.has(name)) {
        this.warnedExpressions.add(name);
        console.warn(`Expression '${name}' unavailable on this model`, err);
      }
    }
  }

  _updateBlink(delta) {
    if (!this.vrm?.expressionManager) return;

    this.timeSinceLastBlink += delta;
    if (!this.blinkActive && this.timeSinceLastBlink >= this.nextBlinkTime) {
      this.blinkActive = true;
      this.blinkProgress = 0;
    }

    if (this.blinkActive) {
      this.blinkProgress += delta / this.BLINK_DURATION;
      const value = Math.sin(Math.PI * Math.min(this.blinkProgress, 1));
      this._setBlendShape('blink', value);

      if (this.blinkProgress >= 1) {
        this.blinkActive = false;
        this.timeSinceLastBlink = 0;
        this._setBlendShape('blink', 0);
        this.nextBlinkTime = 1 + Math.random() * 5; // 1–6s
      }
    }
  }

  _updateSaccade(delta) {
    if (!this.vrm?.lookAt || !this.lookAtTarget || !this.fixationTarget) return;

    this.timeSinceLastSaccade += delta;
    if (this.timeSinceLastSaccade >= this.nextSaccadeAfter) {
      // ~70% short fixations (200–800ms), ~30% longer (1–3s).
      const interval = Math.random() < 0.7
        ? 0.2 + Math.random() * 0.6
        : 1.0 + Math.random() * 2.0;
      this.fixationTarget.set(
        (Math.random() - 0.5) * 0.5,
        1.4 + (Math.random() - 0.5) * 0.3,
        2 // in front of the model (camera side, +Z after the π Y-rotation)
      );
      this.timeSinceLastSaccade = 0;
      this.nextSaccadeAfter = interval;
    }

    this.lookAtTarget.position.lerp(this.fixationTarget, 0.05);
    this.vrm.lookAt.update(delta);
  }

  _setupLookAtProxy() {
    if (!this.vrm?.lookAt) return;
    const ProxyCtor = window.VRMLookAtQuaternionProxy;
    if (!ProxyCtor) {
      console.warn('VRMLookAtQuaternionProxy missing — saccade eyes disabled');
      return;
    }
    const proxy = new ProxyCtor(this.vrm.lookAt);
    proxy.name = 'lookAtQuaternionProxy';
    this.vrm.scene.add(proxy);

    this.lookAtTarget = new THREE.Object3D();
    this.lookAtTarget.position.set(0, 1.4, 2);
    this.scene.add(this.lookAtTarget);
    this.vrm.lookAt.target = this.lookAtTarget;
    this.fixationTarget = new THREE.Vector3(0, 1.4, 2);
  }

  _reAnchorRootPosition(clip, vrm) {
    const hipNode = vrm.humanoid?.getNormalizedBoneNode('hips');
    if (!hipNode) return;
    hipNode.updateMatrixWorld(true);

    const defaultHipPos = new THREE.Vector3();
    hipNode.getWorldPosition(defaultHipPos);

    const hipsTrack = clip.tracks.find(
      (t) => t instanceof THREE.VectorKeyframeTrack && t.name === `${hipNode.name}.position`
    );
    if (!(hipsTrack instanceof THREE.VectorKeyframeTrack)) return;

    const animeHipPos = new THREE.Vector3(
      hipsTrack.values[0],
      hipsTrack.values[1],
      hipsTrack.values[2]
    );
    const offset = new THREE.Vector3().subVectors(animeHipPos, defaultHipPos);

    clip.tracks.forEach((track) => {
      if (track instanceof THREE.VectorKeyframeTrack && track.name.endsWith('.position')) {
        for (let i = 0; i < track.values.length; i += 3) {
          track.values[i]     -= offset.x;
          track.values[i + 1] -= offset.y;
          track.values[i + 2] -= offset.z;
        }
      }
    });
  }

  async loadAndPlayIdleAnimation(url) {
    if (!this.vrm || !this.animationMixer) return;
    const VRMAnimLoaderPlugin = window.VRMAnimationLoaderPlugin;
    const createClip = window.createVRMAnimationClip;
    const GLTFLoaderClass = window.GLTFLoader || (window.THREE && window.THREE.GLTFLoader);
    if (!VRMAnimLoaderPlugin || !createClip || !GLTFLoaderClass) {
      console.warn('VRM animation library not loaded — skipping idle clip');
      return;
    }

    const animLoader = new GLTFLoaderClass();
    animLoader.register((parser) => new VRMAnimLoaderPlugin(parser));

    const gltf = await animLoader.loadAsync(url);
    const animations = gltf.userData.vrmAnimations;
    if (!animations || !animations.length) {
      console.warn(`No vrmAnimations found in ${url}`);
      return;
    }

    const clip = createClip(animations[0], this.vrm);
    this._reAnchorRootPosition(clip, this.vrm);

    if (this.idleAction) this.idleAction.stop();
    this.idleAction = this.animationMixer.clipAction(clip);
    this.idleAction.reset();
    this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
    this.idleAction.clampWhenFinished = false;
    this.idleAction.play();
    console.log(`✅ Idle VRMA playing (${clip.duration.toFixed(2)}s loop)`);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Get proper delta time from Clock (like the working example)
    const deltaTime = this.clock.getDelta();
    
    // Track bone movements during animation (debug)
    if (this.currentAnimationAction && this.currentAnimationAction.isRunning() && this.vrm) {
      // Log bone positions every 30 frames (~0.5s at 60fps) to see if animation is affecting bones
      if (!this._boneTrackingFrameCount) this._boneTrackingFrameCount = 0;
      this._boneTrackingFrameCount++;
      if (this._boneTrackingFrameCount % 30 === 0) {
        const model = this.vrm.scene;
        const trackedBones = ['Hips', 'Spine', 'Chest', 'shoulderL', 'upper_armL', 'elbowL'];
        const boneStates = [];
        trackedBones.forEach(boneName => {
          let bone = null;
          model.traverse((obj) => {
            if (obj.name === boneName && (obj.isBone || obj.type === 'Bone')) {
              bone = obj;
            }
          });
          if (bone) {
            boneStates.push(`${boneName}: pos(${bone.position.x.toFixed(3)}, ${bone.position.y.toFixed(3)}, ${bone.position.z.toFixed(3)}) rot(${bone.quaternion.x.toFixed(3)}, ${bone.quaternion.y.toFixed(3)}, ${bone.quaternion.z.toFixed(3)}, ${bone.quaternion.w.toFixed(3)})`);
          }
        });
        if (boneStates.length > 0) {
          }
      }
    }

    // Update expressions
    this.updateExpressions(deltaTime);

    // Idle realism: passive blink + eye saccades, independent of triggered expressions.
    this._updateBlink(deltaTime);
    this._updateSaccade(deltaTime);

    // Update entrance animation (disabled - now manual via button)
    // this.updateEntranceAnimation();

    // Log body positions during entrance
    this.logBodyPositions();

    // Update idle animation
    this.updateIdleAnimation();

    // Update model position from keyboard input
    this.updateModelPosition();

    // Update AnimationMixer - REQUIRED for animations to play
    // Using VRM humanoid bone system ensures proper bone access
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime);
      
      // WORKAROUND: AnimationMixer PropertyBinding isn't working, so manually apply rotations
      // This directly applies animation rotations to bones based on the current animation time
      // Apply during walk animation (manual or entrance)
      if (this.vrm && this.vrm.humanoid && this.usingSkeletalAnimation && this.walkAnimationPlaying) {
        if (this._walkAnimationData) {
          // Calculate time based on animation action
          let actionTime = 0;
          if (this.walkAnimationAction && this.walkAnimationAction.isRunning()) {
            actionTime = this.walkAnimationAction.time % this._walkAnimationData.duration;
          } else if (this.currentAnimationAction && this.currentAnimationAction.isRunning()) {
            actionTime = this.currentAnimationAction.time % this._walkAnimationData.duration;
          }
          this.applyManualWalkAnimation(actionTime);
        } else {
          // Debug: Log why manual animation isn't running (only once per second)
          if (!this._manualAnimDebugLog || Date.now() - this._manualAnimDebugLog > 1000) {
            console.warn('⚠️  Manual walk animation not applied - _walkAnimationData missing');
            this._manualAnimDebugLog = Date.now();
          }
        }
      }
    }

    // CRITICAL: Update VRM system AFTER AnimationMixer
    // This syncs bone transforms and handles physics, spring bones, constraints, etc.
    // Order matters: AnimationMixer updates bone transforms, then VRM processes them
    // NOTE: If autoUpdateHumanBones is disabled, VRM won't reset bone rotations
    if (this.vrm) {
      try {
        this.vrm.update(deltaTime);
      } catch (error) {
        // Suppress UV animation errors (non-critical, model-specific issue)
        // These errors occur when the model has UV animation data but the material doesn't support it
        // The error is "Cannot set properties of undefined (setting 'value')" in _updateUVAnimation
        const errorStr = error.toString();
        if (errorStr.includes('value') || errorStr.includes('Cannot set properties') || 
            (error.message && (error.message.includes('value') || error.message.includes('Cannot set properties')))) {
          // Silently ignore UV animation errors - they don't affect model rendering
          // These are harmless and occur due to model/material mismatch
        } else {
          // Log other errors for debugging
          console.warn('VRM update error:', error);
        }
      }
    }

    // Smoothly interpolate rotation
    this.modelRotation.x += (this.targetRotation.x - this.modelRotation.x) * 0.1;
    this.modelRotation.y += (this.targetRotation.y - this.modelRotation.y) * 0.1;

    // Smoothly interpolate camera distance
    this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.1;

    // Update camera position based on rotation
    if (this.vrm) {
      const radius = this.cameraDistance;
      this.camera.position.x = Math.sin(this.modelRotation.y) * Math.cos(this.modelRotation.x) * radius;
      this.camera.position.y = 1.55 + Math.sin(this.modelRotation.x) * radius * 0.5;
      this.camera.position.z = Math.cos(this.modelRotation.y) * Math.cos(this.modelRotation.x) * radius;

      // Look slightly above mid-body so the model sits in the lower 2/3 of
      // the frame and the dance animation has headroom above the head.
      this.camera.lookAt(0, 1.5, 0);

      // Log coordinates periodically to help find good starting position
      const now = Date.now();
      if (now - this.lastCoordinateLog > this.logInterval) {
        const coordLog = `📍 Camera: (${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)}) | Model Offset: (${this.modelPositionOffset.x.toFixed(2)}, ${this.modelPositionOffset.y.toFixed(2)}, ${this.modelPositionOffset.z.toFixed(2)}) | Zoom: ${this.cameraDistance.toFixed(2)}`;
        this.lastCoordinateLog = now;
      }
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  hideLoading() {
    this.loadingOverlay.classList.add('hidden');
  }

  showError(message) {
    const overlay = document.querySelector('.loading-overlay p');
    if (overlay) {
      overlay.textContent = message;
    }
  }

  showFallback() {
    // Hide loading overlay and replace with fallback content
    this.hideLoading();

    // Clear canvas and show fallback message
    const container = this.canvas.parentElement;
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); border-radius: 12px;';

    fallbackDiv.innerHTML = `
      <p style="text-align: center; color: #aaa; font-size: 0.95rem; padding: 2rem;">
        <strong style="color: #d94f90;">3D Viewer</strong><br>
        Not available in development mode.<br>
        <br>
        <small>The interactive 3D model is available at production: whykusanagi.xyz/celeste.html</small>
      </p>
    `;

    container.appendChild(fallbackDiv);
    }
}

// Initialize viewer when page is fully loaded
// Wait for ES modules to load (THREE, GLTFLoader, VRMLoaderPlugin)
async function initViewer() {
  // Wait for all required modules to be available
  let attempts = 0;
  const maxAttempts = 100; // 10 seconds max wait (modules can take time to load)
  
  while (attempts < maxAttempts) {
    const threeLoaded = typeof window.THREE !== 'undefined' && typeof window.THREE.Scene !== 'undefined';
    const gltfLoaderLoaded = typeof window.GLTFLoader !== 'undefined' || 
                            (typeof window.THREE !== 'undefined' && typeof window.THREE.GLTFLoader !== 'undefined');
    const vrmLoaded = window.VRMLoaderPlugin || (window.VRM && window.VRM.VRMLoaderPlugin);
    
    if (threeLoaded && gltfLoaderLoaded && vrmLoaded) {
      new ThreeVRMViewer();
      return;
    }
    
    // Log progress every 10 attempts (1 second)
    if (attempts % 10 === 0 && attempts > 0) {
      }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  // Check final state after timeout
  const threeLoaded = typeof window.THREE !== 'undefined' && typeof window.THREE.Scene !== 'undefined';
  const gltfLoaderLoaded = typeof window.GLTFLoader !== 'undefined' || 
                          (typeof window.THREE !== 'undefined' && typeof window.THREE.GLTFLoader !== 'undefined');
  const vrmLoaded = window.VRMLoaderPlugin || (window.VRM && window.VRM.VRMLoaderPlugin);
  
  if (!threeLoaded) {
    console.error('❌ THREE not loaded after waiting');
  }
  if (!gltfLoaderLoaded) {
    console.error('❌ GLTFLoader not loaded after waiting');
  }
  if (!vrmLoaded) {
    console.warn('⚠️  VRMLoaderPlugin not found after waiting');
  }
  
  // Initialize anyway - viewer will show error if needed
  new ThreeVRMViewer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initViewer();
  });
} else {
  initViewer();
}
