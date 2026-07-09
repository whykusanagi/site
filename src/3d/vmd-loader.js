/**
 * VMD Loader for Three.js
 * Parses MikuMikuDance motion files and creates Three.js animations
 */

class VMDLoader {
  constructor() {
    this.animations = [];
    
    // MMD to VRM Humanoid bone name mapping
    // Maps Japanese MMD bone names to VRM humanoid bone names
    this.mmdToVrmBoneMap = {
      // Core bones
      'センター': 'Hips',           // Center
      '全ての親': 'Hips',            // All parent
      '操作中心': 'Hips',            // Control center
      '腰': 'Hips',                  // Waist/Hips
      'グルーブ': 'Hips',            // Groove (often maps to Hips)
      '上半身': 'Spine',             // Upper body
      '上半身2': 'Chest',            // Upper body 2
      '首': 'Neck',                  // Neck
      '頭': 'Head',                  // Head
      
      // Left arm - using actual bone names from the model
      '左肩': 'shoulderL',          // Left shoulder
      '左肩P': 'shoulderL',         // Left shoulder P
      '左肩C': 'shoulderL',         // Left shoulder C
      '左腕': 'upper_armL',         // Left arm
      '左ひじ': 'elbowL',            // Left elbow
      '左手首': 'handL',             // Left wrist/hand
      '左手捩': 'handL',             // Left hand twist
      '左手捩1': 'handL',            // Left hand twist 1
      '左手捩2': 'handL',            // Left hand twist 2
      '左手捩3': 'handL',            // Left hand twist 3
      '左ひじ補助': 'elbowL',        // Left elbow helper
      '左ひじ補助1': 'elbowL',       // Left elbow helper 1
      '+左ひじ補助': 'elbowL',       // +Left elbow helper
      
      // Right arm - using actual bone names from the model
      '右肩': 'shoulderR',          // Right shoulder
      '右肩P': 'shoulderR',         // Right shoulder P
      '右肩C': 'shoulderR',         // Right shoulder C
      '右腕': 'upper_armR',         // Right arm
      '右ひじ': 'elbowR',            // Right elbow
      '右手首': 'handR',             // Right wrist/hand
      '右手捩': 'handR',             // Right hand twist
      '右手捩1': 'handR',            // Right hand twist 1
      '右手捩2': 'handR',            // Right hand twist 2
      '右手捩3': 'handR',            // Right hand twist 3
      '右ひじ補助': 'elbowR',        // Right elbow helper
      '右ひじ補助1': 'elbowR',       // Right elbow helper 1
      '+右ひじ補助': 'elbowR',       // +Right elbow helper
      
      // Left leg - using actual bone names from the model
      '左足': 'upper_legL',         // Left leg
      '左ひざ': 'kneeL',             // Left knee
      '左足首': 'footL',             // Left ankle/foot
      '左つま先ＩＫ': 'toeL',         // Left toe IK
      '左ひざD': 'kneeL',            // Left knee D
      
      // Right leg - using actual bone names from the model
      '右足': 'upper_legR',         // Right leg
      '右ひざ': 'kneeR',             // Right knee
      '右足首': 'footR',             // Right ankle/foot
      '右つま先ＩＫ': 'toeR',         // Right toe IK
      '右ひざD': 'kneeR',            // Right knee D
      
      // Face bones (may not exist in VRM, but map anyway)
      '両目': 'Head',                // Both eyes
      '左目': 'LeftEye',             // Left eye
      '右目': 'RightEye',            // Right eye
      '左目戻': 'LeftEye',           // Left eye return
      '右目戻': 'RightEye',          // Right eye return
      
      // Lower body
      '下半身': 'Hips',              // Lower body
      '腰キャンセル右': 'Hips',      // Waist cancel right
      '腰キャンセル左': 'Hips',      // Waist cancel left
      
      // Additional mappings for VRM humanoid names that might appear in VMD
      // Map VRM humanoid names to actual bone names in the model
      'LeftShoulder': 'shoulderL',
      'RightShoulder': 'shoulderR',
      'LeftUpperArm': 'upper_armL',
      'RightUpperArm': 'upper_armR',
      'LeftLowerArm': 'elbowL',
      'RightLowerArm': 'elbowR',
      'LeftHand': 'handL',
      'RightHand': 'handR',
      'LeftUpperLeg': 'upper_legL',
      'RightUpperLeg': 'upper_legR',
      'LeftLowerLeg': 'kneeL',
      'RightLowerLeg': 'kneeR',
      'LeftFoot': 'footL',
      'RightFoot': 'footR',
      'LeftToe': 'toeL',
      'RightToe': 'toeR',
      
      // Additional bone name variations
      'lower_armL': 'elbowL',
      'lower_armR': 'elbowR',
      '足首_R_': 'footR',
      '足首_L_': 'footL',
    };
  }
  
  /**
   * Maps MMD bone name to VRM humanoid bone name
   * @param {string} mmdBoneName - Original MMD bone name
   * @returns {string} VRM bone name or original if no mapping found
   */
  mapBoneName(mmdBoneName) {
    // Direct mapping
    if (this.mmdToVrmBoneMap[mmdBoneName]) {
      return this.mmdToVrmBoneMap[mmdBoneName];
    }
    
    // Try partial matching for common patterns - using actual bone names from model
    if (mmdBoneName.includes('左') && mmdBoneName.includes('腕')) {
      if (mmdBoneName.includes('肩')) return 'shoulderL';
      if (mmdBoneName.includes('ひじ')) return 'elbowL';
      if (mmdBoneName.includes('手首')) return 'handL';
      return 'upper_armL';
    }
    if (mmdBoneName.includes('右') && mmdBoneName.includes('腕')) {
      if (mmdBoneName.includes('肩')) return 'shoulderR';
      if (mmdBoneName.includes('ひじ')) return 'elbowR';
      if (mmdBoneName.includes('手首')) return 'handR';
      return 'upper_armR';
    }
    if (mmdBoneName.includes('左') && mmdBoneName.includes('足')) {
      if (mmdBoneName.includes('ひざ')) return 'kneeL';
      if (mmdBoneName.includes('足首')) return 'footL';
      return 'upper_legL';
    }
    if (mmdBoneName.includes('右') && mmdBoneName.includes('足')) {
      if (mmdBoneName.includes('ひざ')) return 'kneeR';
      if (mmdBoneName.includes('足首')) return 'footR';
      return 'upper_legR';
    }
    
    // Return original name if no mapping found
    return mmdBoneName;
  }

  async load(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const dataView = new DataView(arrayBuffer);

      return this.parse(dataView);
    } catch (error) {
      console.error('❌ Error loading VMD file:', error);
      throw error;
    }
  }

  parse(dataView) {
    let offset = 0;

    // Parse header (30 bytes)
    const signature = this.readString(dataView, offset, 30);
    offset += 30;

    if (!signature.includes('Vocaloid Motion Data')) {
      throw new Error('Invalid VMD file signature');
    }

    // Model name (20 bytes)
    const modelName = this.readString(dataView, offset, 20);
    offset += 20;

    // Number of bone frames
    const numBoneFrames = dataView.getUint32(offset, true);
    offset += 4;

    // Parse bone frames
    const boneFrames = {};
    const frameCount = new Set();

    for (let i = 0; i < numBoneFrames; i++) {
      const bone = this.parseBoneFrame(dataView, offset);
      offset += 111; // Each bone frame is 111 bytes

      frameCount.add(bone.frameNumber);

      if (!boneFrames[bone.name]) {
        boneFrames[bone.name] = [];
      }
      boneFrames[bone.name].push(bone);
    }

    // Number of morph frames
    const numMorphFrames = dataView.getUint32(offset, true);
    offset += 4;

    // Create Three.js animation
    const clip = this.createAnimationClip(boneFrames, Math.max(...frameCount));

    return {
      clip: clip,
      boneFrames: boneFrames,
      numFrames: Math.max(...frameCount)
    };
  }

  parseBoneFrame(dataView, offset) {
    const boneName = this.readString(dataView, offset, 15).trim();
    offset += 15;

    const frameNumber = dataView.getUint32(offset, true);
    offset += 4;

    // Position (x, y, z) - 3 floats
    const position = {
      x: dataView.getFloat32(offset, true),
      y: dataView.getFloat32(offset + 4, true),
      z: dataView.getFloat32(offset + 8, true)
    };
    offset += 12;

    // Rotation (x, y, z, w) - 4 floats (quaternion)
    const rotation = {
      x: dataView.getFloat32(offset, true),
      y: dataView.getFloat32(offset + 4, true),
      z: dataView.getFloat32(offset + 8, true),
      w: dataView.getFloat32(offset + 12, true)
    };
    offset += 16;

    // Interpolation curves (64 bytes) - skip for now
    offset += 64;

    return {
      name: boneName,
      frameNumber: frameNumber,
      position: position,
      rotation: rotation
    };
  }

  createAnimationClip(boneFrames, totalFrames) {
    const tracks = [];
    const fps = 30; // Standard MMD fps
    const duration = totalFrames / fps;

    // Create tracks for each bone
    let trackCount = 0;
    let mappedCount = 0;
    for (const [mmdBoneName, frames] of Object.entries(boneFrames)) {
      if (frames.length === 0) continue;

      // Map MMD bone name to VRM bone name
      const vrmBoneName = this.mapBoneName(mmdBoneName);
      if (vrmBoneName !== mmdBoneName) {
        mappedCount++;
      }

      // Sort by frame number
      frames.sort((a, b) => a.frameNumber - b.frameNumber);

      // Extract times and values for position
      const positionTimes = [];
      const positionValues = [];
      const rotationTimes = [];
      const rotationValues = [];

      for (const frame of frames) {
        const time = frame.frameNumber / fps;

        positionTimes.push(time);
        positionValues.push(frame.position.x, frame.position.y, frame.position.z);

        rotationTimes.push(time);
        rotationValues.push(frame.rotation.x, frame.rotation.y, frame.rotation.z, frame.rotation.w);
      }

      // Add position track (use VRM bone name)
      // IMPORTANT: VRM models are sensitive to position animations
      // Even Hips position changes can cause collapse if too extreme
      // For now, skip ALL position animations to prevent model collapse
      // Only use rotation animations which are safe for VRM bone hierarchy
      if (positionTimes.length > 0) {
        // Skip position animations entirely to prevent model collapse
        // VMD files often have position data, but VRM models work best with rotation-only animations
        // The model can still animate properly with just rotations
        if (vrmBoneName === 'Hips' && false) { // Disabled: even Hips position can cause issues
          // Only allow very small Hips position changes if absolutely necessary
          // Scale down position values to prevent collapse
          const scaledPositionValues = [];
          for (let i = 0; i < positionValues.length; i += 3) {
            scaledPositionValues.push(
              positionValues[i] * 0.1,     // X: scale down 90%
              positionValues[i + 1] * 0.1, // Y: scale down 90%
              positionValues[i + 2] * 0.1  // Z: scale down 90%
            );
          }
          tracks.push(
            new THREE.VectorKeyframeTrack(
              `${vrmBoneName}.position`,
              positionTimes,
              scaledPositionValues
            )
          );
        } else {
          // Skip position tracks for all bones to prevent model collapse
          // Position changes break the bone hierarchy in VRM models
          // Rotation-only animations work perfectly fine
        }
      }

      // Add rotation track (use VRM bone name)
      if (rotationTimes.length > 0) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${vrmBoneName}.quaternion`,
            rotationTimes,
            rotationValues
          )
        );
      }

      trackCount++;
    }

    // Create animation clip
    const clip = new THREE.AnimationClip('vmd_animation', duration, tracks);
    return clip;
  }

  readString(dataView, offset, length) {
    const bytes = new Uint8Array(dataView.buffer, offset, length);
    // Find null terminator
    let actualLength = length;
    for (let i = 0; i < length; i++) {
      if (bytes[i] === 0) {
        actualLength = i;
        break;
      }
    }
    const decoder = new TextDecoder('shift_jis');
    return decoder.decode(bytes.slice(0, actualLength));
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VMDLoader;
}
