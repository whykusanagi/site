#!/bin/bash
# Optimize 60-second video for web background
# Usage: ./scripts/optimize-video.sh [input_video.mp4]

INPUT="${1:-assets/animations/website_background_video_60.mp4}"
OUTPUT_DIR="assets/animations"

if [ ! -f "$INPUT" ]; then
  echo "Error: Input file not found: $INPUT"
  exit 1
fi

echo "Optimizing video: $INPUT"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Creating WebM (VP9) - Best compression..."
ffmpeg -i "$INPUT" \
  -c:v libvpx-vp9 \
  -crf 30 \
  -b:v 0 \
  -vf "scale=1920:1080,fps=30" \
  -an \
  -movflags +faststart \
  -y \
  "$OUTPUT_DIR/celeste-bg.webm"

echo ""
echo "Creating MP4 (H.264) - Universal fallback..."
ffmpeg -i "$INPUT" \
  -c:v libx264 \
  -preset slow \
  -crf 23 \
  -vf "scale=1920:1080,fps=30" \
  -an \
  -movflags +faststart \
  -profile:v high \
  -level 4.0 \
  -y \
  "$OUTPUT_DIR/celeste-bg.mp4"

echo ""
echo "Creating poster image (first frame)..."
ffmpeg -i "$OUTPUT_DIR/celeste-bg.mp4" \
  -vf "scale=1920:1080" \
  -vframes 1 \
  -update 1 \
  -q:v 2 \
  -y \
  "$OUTPUT_DIR/celeste-bg-poster.jpg"

echo ""
echo "Optimization complete! File sizes:"
ls -lh "$OUTPUT_DIR"/celeste-bg.*
echo ""
echo "Total size:"
du -h "$OUTPUT_DIR"/celeste-bg.* | awk '{sum+=$1} END {print sum}'

