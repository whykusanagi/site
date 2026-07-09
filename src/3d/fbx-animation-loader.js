/**
 * FBX Animation Loader for VRM Models
 * Loads FBX animation files and retargets them to VRM humanoid bones
 *
 * Created: 2026-02-05
 * Supports: Mixamo animations and standard humanoid FBX rigs
 */

class FBXAnimationLoader {
  /**
   * Load FBX animation and retarget to VRM model
   * @param {string} fbxUrl - URL to FBX file (local or remote)
   * @param {VRM} vrm - The loaded VRM model
   * @param {THREE.AnimationMixer} mixer - The animation mixer for the VRM
   * @returns {Promise<THREE.AnimationClip>} The retargeted animation clip
   */
  static async loadAnimation(fbxUrl, vrm, mixer) {
    if (!window.FBXLoader) {
      throw new Error('FBXLoader not available. Make sure it\'s imported in the HTML.');
    }

    console.log('📦 Loading FBX animation from:', fbxUrl);

    return new Promise((resolve, reject) => {
      const fbxLoader = new FBXLoader();

      fbxLoader.load(
        fbxUrl,
        (fbx) => {
          console.log('✅ FBX loaded successfully');

          // Check if FBX has animations
          if (!fbx.animations || fbx.animations.length === 0) {
            reject(new Error('No animations found in FBX file'));
            return;
          }

          console.log(`🎬 Found ${fbx.animations.length} animation(s) in FBX`);

          // Get the first animation clip
          const fbxClip = fbx.animations[0];
          console.log(`   Animation: "${fbxClip.name}" (${fbxClip.duration.toFixed(2)}s)`);

          // Retarget FBX bones to VRM bones
          try {
            const vrmClip = this.retargetToVRM(fbxClip, vrm, fbx);
            console.log('✅ Animation retargeted to VRM bones');
            resolve(vrmClip);
          } catch (error) {
            reject(error);
          }
        },
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log(`📥 Loading FBX: ${percent}%`);
        },
        (error) => {
          console.error('❌ Error loading FBX:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Retarget FBX animation tracks to VRM humanoid bones
   * @param {THREE.AnimationClip} fbxClip - Original FBX animation clip
   * @param {VRM} vrm - Target VRM model
   * @param {THREE.Object3D} fbxRig - FBX skeleton (for bone mapping)
   * @returns {THREE.AnimationClip} Retargeted animation clip
   */
  static retargetToVRM(fbxClip, vrm, fbxRig) {
    console.log('🔄 Retargeting animation to VRM bones...');

    // FBX bone name → VRM humanoid bone name mapping
    // This FBX uses "Armature" prefix (e.g., ArmatureHips, ArmatureLeftArm)
    const boneMapping = {
      // Spine/torso
      'ArmatureHips': 'hips',
      'ArmatureSpine': 'spine',
      'ArmatureSpine1': 'chest',
      'ArmatureSpine2': 'upperChest',
      'ArmatureNeck': 'neck',
      'ArmatureHead': 'head',

      // Left arm
      'ArmatureLeftShoulder': 'leftShoulder',
      'ArmatureLeftArm': 'leftUpperArm',
      'ArmatureLeftForeArm': 'leftLowerArm',
      'ArmatureLeftHand': 'leftHand',

      // Right arm
      'ArmatureRightShoulder': 'rightShoulder',
      'ArmatureRightArm': 'rightUpperArm',
      'ArmatureRightForeArm': 'rightLowerArm',
      'ArmatureRightHand': 'rightHand',

      // Left leg
      'ArmatureLeftUpLeg': 'leftUpperLeg',
      'ArmatureLeftLeg': 'leftLowerLeg',
      'ArmatureLeftFoot': 'leftFoot',
      'ArmatureLeftToeBase': 'leftToes',

      // Right leg
      'ArmatureRightUpLeg': 'rightUpperLeg',
      'ArmatureRightLeg': 'rightLowerLeg',
      'ArmatureRightFoot': 'rightFoot',
      'ArmatureRightToeBase': 'rightToes'
    };

    const retargetedTracks = [];
    let tracksRetargeted = 0;
    let tracksSkipped = 0;

    // DEBUG: Log first 10 bone names to understand naming convention
    const uniqueBones = new Set();
    fbxClip.tracks.forEach(track => {
      const boneName = track.name.split('.')[0];
      uniqueBones.add(boneName);
    });
    console.log('🔍 DEBUG: FBX bone names found:', Array.from(uniqueBones).slice(0, 20).join(', '));

    // Process each track in the FBX animation
    for (const track of fbxClip.tracks) {
      // Extract bone name from track name (format: "BoneName.property")
      const trackParts = track.name.split('.');
      const fbxBoneName = trackParts[0];
      const property = trackParts[1]; // quaternion, position, scale

      // IMPORTANT: Only use quaternion (rotation) tracks for VRM retargeting
      // Position and scale tracks can cause model to collapse/fold incorrectly
      if (property !== 'quaternion') {
        tracksSkipped++;
        continue;
      }

      // Check if this bone should be mapped to VRM
      const vrmBoneName = boneMapping[fbxBoneName];

      if (vrmBoneName) {
        // Get the actual VRM bone node
        const vrmBoneNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);

        if (vrmBoneNode) {
          // Create new track with VRM bone name
          const newTrackName = `${vrmBoneNode.name}.${property}`;

          // Clone the track with new name
          const TrackConstructor = track.constructor;
          const newTrack = new TrackConstructor(
            newTrackName,
            track.times,
            track.values,
            track.interpolation
          );

          retargetedTracks.push(newTrack);
          tracksRetargeted++;
        } else {
          tracksSkipped++;
        }
      } else {
        // Bone not in mapping (fingers, toes, etc.)
        tracksSkipped++;
      }
    }

    console.log(`✅ Retargeting complete:`);
    console.log(`   Tracks retargeted: ${tracksRetargeted}`);
    console.log(`   Tracks skipped: ${tracksSkipped}`);

    // Create new animation clip with retargeted tracks
    const vrmClip = new THREE.AnimationClip(
      fbxClip.name + '_vrm',
      fbxClip.duration,
      retargetedTracks
    );

    return vrmClip;
  }

  /**
   * Load and play FBX animation on VRM model
   * Convenience method that loads, retargets, and plays in one call
   * @param {string} fbxUrl - URL to FBX file
   * @param {VRM} vrm - VRM model
   * @param {THREE.AnimationMixer} mixer - Animation mixer
   * @param {Object} options - Playback options (loop, timeScale, etc.)
   * @returns {Promise<THREE.AnimationAction>} The playing animation action
   */
  static async loadAndPlay(fbxUrl, vrm, mixer, options = {}) {
    try {
      const clip = await this.loadAnimation(fbxUrl, vrm, mixer);

      // Create and configure animation action
      const action = mixer.clipAction(clip);
      action.loop = options.loop !== undefined ? options.loop : THREE.LoopRepeat;
      action.timeScale = options.timeScale !== undefined ? options.timeScale : 1.0;
      action.clampWhenFinished = options.clampWhenFinished !== undefined ? options.clampWhenFinished : false;

      // Play the animation
      action.play();
      console.log(`▶️  Playing FBX animation: "${clip.name}"`);

      return action;
    } catch (error) {
      console.error('❌ Failed to load and play FBX animation:', error);
      throw error;
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FBXAnimationLoader;
}
