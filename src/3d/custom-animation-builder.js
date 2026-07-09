/**
 * Custom Animation Builder for VRM Models
 * Creates walk/bounce animations using VRM humanoid bone structure
 *
 * Updated: 2026-02-05
 * Now uses vrm.humanoid.getNormalizedBoneNode() API for proper bone name resolution
 * Following official three-vrm examples pattern
 */

class CustomAnimationBuilder {
  /**
   * Helper method to safely get bone name from VRM humanoid
   * @param {VRM} vrm - The loaded VRM model
   * @param {string} humanoidBoneName - Standardized humanoid bone name (e.g., 'hips', 'leftUpperArm')
   * @returns {string|null} Actual bone name in the model, or null if not found
   */
  static getBoneName(vrm, humanoidBoneName) {
    if (!vrm || !vrm.humanoid) {
      console.warn('❌ VRM or humanoid not available');
      return null;
    }

    try {
      const boneNode = vrm.humanoid.getNormalizedBoneNode(humanoidBoneName);
      if (boneNode && boneNode.name) {
        return boneNode.name;
      }
    } catch (error) {
      console.warn(`⚠️  Bone "${humanoidBoneName}" not found in VRM model`);
    }

    return null;
  }

  /**
   * Creates a walk animation using the VRM's actual bone structure
   * @param {VRM} vrm - The loaded VRM model (required!)
   * @param {number} duration - Animation duration in seconds
   * @returns {THREE.AnimationClip} The walk animation clip
   */
  static createWalkAnimation(vrm, duration = 4) {
    if (!vrm) {
      console.error('❌ VRM model required for createWalkAnimation!');
      return null;
    }

    console.log('🎬 Creating walk animation with proper bone names...');

    // Get actual bone names from VRM humanoid
    const hipsBone = this.getBoneName(vrm, 'hips');
    const spineBone = this.getBoneName(vrm, 'spine');
    const headBone = this.getBoneName(vrm, 'head');
    const leftArmBone = this.getBoneName(vrm, 'leftUpperArm');
    const rightArmBone = this.getBoneName(vrm, 'rightUpperArm');
    const leftLegBone = this.getBoneName(vrm, 'leftUpperLeg');
    const rightLegBone = this.getBoneName(vrm, 'rightUpperLeg');

    // Log found bones for debugging
    console.log('✅ Bone mapping:', {
      hips: hipsBone,
      spine: spineBone,
      head: headBone,
      leftArm: leftArmBone,
      rightArm: rightArmBone,
      leftLeg: leftLegBone,
      rightLeg: rightLegBone
    });

    const fps = 30;
    const totalFrames = Math.ceil(duration * fps);
    const tracks = [];

    // Helper to create smooth animation values
    const sine = (t) => Math.sin(t * Math.PI);

    // Hip/Spine walk cycle - main body movement
    const hipTimes = [];
    const hipPos = [];
    const spineTimes = [];
    const spineRot = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
      const time = frame / totalFrames;
      const walkCycle = (time % 1);

      // Hip bobbing up and down (walk bounce)
      hipTimes.push(frame / fps);
      hipPos.push(0); // X
      hipPos.push(sine(walkCycle) * 0.1); // Y - bounce
      hipPos.push(0); // Z

      // Spine sway
      spineTimes.push(frame / fps);
      const spineSwayAngle = sine(walkCycle) * 0.1;
      spineRot.push(
        0, // X
        spineSwayAngle * 0.2, // Y
        0, // Z
        0.995 // W (mostly identity quaternion)
      );
    }

    // Add hip track using actual bone name
    if (hipsBone) {
      tracks.push(
        new THREE.VectorKeyframeTrack(hipsBone + '.position', hipTimes, hipPos)
      );
      console.log('✅ Added Hips position track:', hipsBone + '.position');
    }

    // Add spine rotation track using actual bone name
    if (spineBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(spineBone + '.quaternion', spineTimes, spineRot)
      );
      console.log('✅ Added Spine rotation track:', spineBone + '.quaternion');
    }

    // Arm swing animation
    const armTimes = [];
    const leftArmRot = [];
    const rightArmRot = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
      const time = frame / totalFrames;
      const walkCycle = (time % 1);
      const armSwing = sine(walkCycle) * 0.3; // Swing amount

      armTimes.push(frame / fps);

      // Left arm swings forward when right leg goes forward
      const leftSwing = armSwing;
      leftArmRot.push(
        leftSwing * 0.2, // X - rotation
        0, // Y
        0, // Z
        0.995 // W
      );

      // Right arm swings opposite
      const rightSwing = -armSwing;
      rightArmRot.push(
        rightSwing * 0.2, // X
        0, // Y
        0, // Z
        0.995 // W
      );
    }

    // Add arm tracks using actual bone names
    if (leftArmBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(leftArmBone + '.quaternion', armTimes, leftArmRot)
      );
      console.log('✅ Added Left Arm track:', leftArmBone + '.quaternion');
    }

    if (rightArmBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(rightArmBone + '.quaternion', armTimes, rightArmRot)
      );
      console.log('✅ Added Right Arm track:', rightArmBone + '.quaternion');
    }

    // Leg animation (walk cycle)
    const legTimes = [];
    const leftLegRot = [];
    const rightLegRot = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
      const time = frame / totalFrames;
      const walkCycle = (time % 1);

      legTimes.push(frame / fps);

      // Left leg - forward when walkCycle = 0.25
      const leftLegAngle = sine(walkCycle + 0.25) * 0.4;
      leftLegRot.push(
        leftLegAngle, // X - rotation
        0, // Y
        0, // Z
        0.992 // W
      );

      // Right leg - forward when walkCycle = 0.75
      const rightLegAngle = sine(walkCycle + 0.75) * 0.4;
      rightLegRot.push(
        rightLegAngle, // X
        0, // Y
        0, // Z
        0.992 // W
      );
    }

    // Add leg tracks using actual bone names
    if (leftLegBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(leftLegBone + '.quaternion', legTimes, leftLegRot)
      );
      console.log('✅ Added Left Leg track:', leftLegBone + '.quaternion');
    }

    if (rightLegBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(rightLegBone + '.quaternion', legTimes, rightLegRot)
      );
      console.log('✅ Added Right Leg track:', rightLegBone + '.quaternion');
    }

    // Head slight bob
    const headTimes = [];
    const headRot = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
      const time = frame / totalFrames;
      const walkCycle = (time % 1);
      const headBob = sine(walkCycle) * 0.05;

      headTimes.push(frame / fps);
      headRot.push(
        headBob, // X - nod slightly
        0, // Y
        0, // Z
        0.999 // W
      );
    }

    // Add head track using actual bone name
    if (headBone) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(headBone + '.quaternion', headTimes, headRot)
      );
      console.log('✅ Added Head track:', headBone + '.quaternion');
    }

    console.log(`🎬 Created walk animation with ${tracks.length} tracks`);

    // Create and return animation clip
    const clip = new THREE.AnimationClip('walk_animation', duration, tracks);

    return clip;
  }

  /**
   * Creates a simple arm wave animation (example from three-vrm docs)
   * @param {VRM} vrm - The loaded VRM model
   * @param {number} duration - Animation duration in seconds
   * @returns {THREE.AnimationClip} The wave animation clip
   */
  static createWaveAnimation(vrm, duration = 2.5) {
    if (!vrm) {
      console.error('❌ VRM model required for createWaveAnimation!');
      return null;
    }

    // Get bones for waving gesture
    const upperArmNode = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const lowerArmNode = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');

    if (!upperArmNode || !lowerArmNode) {
      console.error('❌ Could not find arm bones!');
      return null;
    }

    const tracks = [];

    // UPPER ARM: Raise arm up to wave position and hold
    // Using VRM coordinate system (from three-vrm-viewer.js lines 1610-1622):
    // - X axis: Forward/back (positive = forward toward viewer)
    // - Y axis: Down from T-pose (~75° = natural hang)
    // - Z axis: Side positioning (+90° = left arm to left side)
    const upperArmRest = new THREE.Quaternion(0.0, 0.0, 0.0, 1.0);
    const upperArmRaised = new THREE.Quaternion();
    // Wave position - arm pointing up, rotate toward viewer
    const waveX = 0.5;                          // Forward toward viewer
    const waveY = Math.PI / 2 - (40 * Math.PI / 180);  // Rotate toward viewer (decrease Y)
    const waveZ = -Math.PI / 2 - (30 * Math.PI / 180);  // -120° raises arm up
    upperArmRaised.setFromEuler(new THREE.Euler(waveX, waveY, waveZ));

    const upperArmTrack = new THREE.QuaternionKeyframeTrack(
      upperArmNode.name + '.quaternion',
      [0.0, 0.3, duration - 0.3, duration], // Raise quickly, hold, lower at end
      [
        ...upperArmRest.toArray(),    // Start at rest
        ...upperArmRaised.toArray(),  // Raise up
        ...upperArmRaised.toArray(),  // Hold raised
        ...upperArmRest.toArray()     // Lower back down
      ]
    );
    tracks.push(upperArmTrack);

    // LOWER ARM: Wave side-to-side at elbow (while upper arm is raised)
    // This creates the actual "waving" motion
    // Y-axis rotation for side-to-side wave motion (twist at elbow)
    const lowerArmCenter = new THREE.Quaternion(0.0, 0.0, 0.0, 1.0);
    const lowerArmLeft = new THREE.Quaternion();
    const lowerArmRight = new THREE.Quaternion();
    // Y rotation: positive = wave one direction, negative = wave other direction
    lowerArmLeft.setFromEuler(new THREE.Euler(0.0, 0.5, 0.0));   // Wave left
    lowerArmRight.setFromEuler(new THREE.Euler(0.0, -0.5, 0.0)); // Wave right

    // Create smooth waving motion (3 waves during the hold period)
    const waveDuration = duration - 0.6; // Time when arm is raised
    const waveStart = 0.4;
    const numWaves = 3;
    const waveTimes = [];
    const waveValues = [];

    // Initial position (no wave yet during raise)
    waveTimes.push(0.0, 0.3);
    waveValues.push(...lowerArmCenter.toArray(), ...lowerArmCenter.toArray());

    // Add wave keyframes
    for (let i = 0; i <= numWaves; i++) {
      const t = waveStart + (i / numWaves) * waveDuration;
      const phase = i % 2; // Alternate between left and right
      waveTimes.push(t);
      waveValues.push(...(phase === 0 ? lowerArmLeft : lowerArmRight).toArray());
    }

    // End position
    waveTimes.push(duration);
    waveValues.push(...lowerArmCenter.toArray());

    const lowerArmTrack = new THREE.QuaternionKeyframeTrack(
      lowerArmNode.name + '.quaternion',
      waveTimes,
      waveValues
    );
    tracks.push(lowerArmTrack);

    console.log('✅ Created wave animation with upper arm + lower arm');
    console.log('   Upper arm:', upperArmNode.name);
    console.log('   Lower arm:', lowerArmNode.name);

    const clip = new THREE.AnimationClip('wave', duration, tracks);
    return clip;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomAnimationBuilder;
}
