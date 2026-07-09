#!/usr/bin/env node

/**
 * Debug VMD file structure
 * Shows what bones are in the VMD file and their keyframe data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vmdPath = path.join(__dirname, '../assets/animations/bounce_dance_part1.vmd');

if (!fs.existsSync(vmdPath)) {
  console.error('❌ VMD file not found:', vmdPath);
  process.exit(1);
}

console.log('📁 Reading VMD file...');
const buffer = fs.readFileSync(vmdPath);
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);

let offset = 0;

// Read header (30 bytes)
function readString(view, offset, length) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  let actualLength = length;
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) {
      actualLength = i;
      break;
    }
  }
  // Try shift_jis decoding
  try {
    const decoder = new TextDecoder('shift_jis');
    return decoder.decode(bytes.slice(0, actualLength));
  } catch (e) {
    // Fallback to ASCII
    return String.fromCharCode(...bytes.slice(0, actualLength));
  }
}

const signature = readString(view, offset, 30);
offset += 30;
console.log('✅ Signature:', signature.trim());

// Model name (20 bytes)
const modelName = readString(view, offset, 20);
offset += 20;
console.log('👤 Model:', modelName.trim());

// Number of bone frames
const numBoneFrames = view.getUint32(offset, true);
offset += 4;
console.log(`🦴 Total bone frames: ${numBoneFrames}`);

// Parse bone frames and collect unique bone names
const boneNames = new Set();
const boneFramesByName = {};
let offset_save = offset;

for (let i = 0; i < numBoneFrames; i++) {
  const boneName = readString(view, offset, 15).trim();
  offset += 15;

  const frameNumber = view.getUint32(offset, true);
  offset += 4;

  // Position
  const posX = view.getFloat32(offset, true);
  const posY = view.getFloat32(offset + 4, true);
  const posZ = view.getFloat32(offset + 8, true);
  offset += 12;

  // Rotation (quaternion)
  const rotX = view.getFloat32(offset, true);
  const rotY = view.getFloat32(offset + 4, true);
  const rotZ = view.getFloat32(offset + 8, true);
  const rotW = view.getFloat32(offset + 12, true);
  offset += 16;

  // Skip interpolation curves (64 bytes)
  offset += 64;

  // Track unique bones
  if (!boneNames.has(boneName)) {
    boneNames.add(boneName);
    boneFramesByName[boneName] = [];
  }

  boneFramesByName[boneName].push({
    frameNumber: frameNumber,
    position: { x: posX, y: posY, z: posZ },
    rotation: { x: rotX, y: rotY, z: rotZ, w: rotW }
  });
}

console.log(`\n📍 Unique bones in VMD: ${boneNames.size}`);
console.log('\n🎯 Bone names (in order of first appearance):');
let idx = 1;
const boneArray = Array.from(boneNames);
boneArray.forEach(name => {
  const frames = boneFramesByName[name];
  const frameRange = frames.length > 0
    ? `frames ${frames[0].frameNumber}-${frames[frames.length - 1].frameNumber}`
    : 'no frames';
  console.log(`  ${idx}. "${name}" (${frames.length} frames, ${frameRange})`);
  idx++;
});

console.log('\n📊 Bone Frame Distribution:');
const sorted = Array.from(boneNames)
  .map(name => ({ name, count: boneFramesByName[name].length }))
  .sort((a, b) => b.count - a.count);

sorted.slice(0, 10).forEach(bone => {
  console.log(`  ${bone.name.padEnd(20)} : ${bone.count.toString().padStart(5)} frames`);
});

// Get total frames
const maxFrame = Math.max(...Array.from(boneNames).flatMap(name =>
  boneFramesByName[name].map(f => f.frameNumber)
));
console.log(`\n⏱️  Animation length: ${maxFrame} frames (at 30 FPS = ${(maxFrame / 30).toFixed(2)}s)`);

// Sample some positions
console.log('\n🔍 Sample position data for first frame of each bone:');
boneArray.slice(0, 5).forEach(name => {
  const frames = boneFramesByName[name];
  if (frames.length > 0) {
    const f = frames[0];
    console.log(`  ${name}`);
    console.log(`    Position: (${f.position.x.toFixed(3)}, ${f.position.y.toFixed(3)}, ${f.position.z.toFixed(3)})`);
    console.log(`    Rotation: (${f.rotation.x.toFixed(3)}, ${f.rotation.y.toFixed(3)}, ${f.rotation.z.toFixed(3)}, ${f.rotation.w.toFixed(3)})`);
  }
});

console.log('\n✅ VMD file analysis complete');
