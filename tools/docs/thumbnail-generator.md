# YouTube Thumbnail Generator - User Guide

Create custom YouTube thumbnails with the **Corrupted Theme** aesthetic, featuring animated elements, WHYKUSANAGI branding, and Celeste character art.

## 🎯 Features

- **1920×1080 Canvas**: Perfect for YouTube thumbnails
- **Animated Elements**: Corrupted text, rotating diamond, wireframe grid
- **WHYKUSANAGI Branding**: Logo with womb tattoo icon
- **Celeste Character**: Full-height illustration (customizable)
- **Subject Support**: Add character/object in foreground
- **Editable Text**: Change title and subtitle via console
- **PNG Export**: One-click download with all elements rendered

## 🚀 Getting Started

### Opening the Tool

**Option 1: Direct File**
- Double-click `index.html` in the `thumbnail-generator` folder
- Works for basic usage (no external images)

**Option 2: HTTP Server (Recommended)**
```bash
cd thumbnail-generator
python3 -m http.server 8000
# Open http://localhost:8000
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **C** | Toggle controls menu |
| **E** | Export PNG (1920×1080) |

## 🎨 Customization

### Console Commands

Open browser console (F12) and use these commands:

#### 1. Change Text
```javascript
// Change main title
setTitle("NEW VIDEO<br>DROPPING SOON");

// Change subtitle
setSubtitle("Subscribe for Chaos");
```

#### 2. Add Character/Object
```javascript
// Add subject in foreground (character/object)
setSubject("https://example.com/character.png");

// Resize subject (10-150% of canvas height)
setSubjectSize(90);

// Remove subject
clearSubject();
```

#### 3. Control Animations
```javascript
// Pause all animations
toggleAnimations();

// Destroy components (free memory)
cleanupComponents();

// Reinitialize animations
reinitComponents();
```

#### 4. Export
```javascript
// Download thumbnail as PNG
exportThumbnail();
```

## 📐 Layout Structure

### Z-Index Layering (Bottom to Top)
1. **Background (z: 15-50)**: Seamless pattern, gradient, animated elements
2. **Subject (z: 80)**: Optional character/object in foreground
3. **Corner Accents (z: 85)**: Decorative frames
4. **Celeste (z: 90)**: Main character illustration
5. **Title (z: 100)**: Text overlay (bottom-left)
6. **Logo (z: 250)**: WHYKUSANAGI branding (top-right)

### Text Positioning
- **Main Title**: Bottom-left (60px from edges)
- **Subtitle**: Below title
- **Logo**: Top-right (partially off-canvas for effect)

## 🖼️ Image Requirements

### Celeste Character
- **Format**: PNG with transparency
- **Dimensions**: Full height (1080px)
- **Location**: `assets/Celeste_Legs.png`

### Subject (Optional)
- **Format**: PNG/JPG/WEBP
- **Max Height**: 70% of canvas (adjustable)
- **Use Case**: Character you want Celeste to "tower over"

### Womb Tattoo Logo
- **Format**: PNG with transparency
- **Dimensions**: 100×100px
- **Location**: `assets/Womb_Tattoo.png`

### Seamless Background
- **Format**: PNG
- **Dimensions**: 512×512px (seamless tile)
- **Location**: `assets/backgrounds/whykusanagi_rendered_SEAMLESS.png`

## ⚡ Animation Components

### 1. Corrupted Text Overlay
- **Description**: Floating Japanese characters with glitch effects
- **Config**:
  ```javascript
  corruptedText: {
    lewdIntensity: 'low',
    kanjiCount: 3,
    particleCount: 15,
    includeGrain: false,
    background: 'transparent'
  }
  ```

### 2. Grid Overlay
- **Description**: Wireframe grid with pulsing effect
- **Config**:
  ```javascript
  grid: {
    gridSize: 50,
    color: '#8b5cf6',
    opacity: 0.2,
    style: 'diamond',
    pulse: true
  }
  ```

### 3. Rotating Diamond
- **Description**: Spinning diamond shape with breathing effect
- **Config**:
  ```javascript
  diamond: {
    size: 100,
    color: '#00ffff',
    position: 'center',
    rotationSpeed: 6000,
    breathe: true
  }
  ```

## 🎬 Example Workflow

### Basic Thumbnail
```javascript
// 1. Change text
setTitle("STREAM RECAP<br>EPISODE 5");
setSubtitle("Boss Battle & Gacha Pulls");

// 2. Export
exportThumbnail();
```

### Thumbnail with Subject
```javascript
// 1. Add character in foreground
setSubject("https://example.com/nikke_character.png");
setSubjectSize(80); // 80% of canvas height

// 2. Change text
setTitle("NEW NIKKE<br>SHOWCASE");
setSubtitle("Ultimate Bunny Review");

// 3. Pause animations for cleaner look
toggleAnimations();

// 4. Export
exportThumbnail();
```

## 🔧 Technical Details

### Dependencies
- **html2canvas@1.4.1**: Loaded from CDN for PNG export
- **ES6 Modules**: Used for component imports

### File Paths (Relative to `index.html`)
```
css/seamless-background.css
js/anime-blocks-advanced.js
js/logo-component.js
assets/Celeste_Legs.png
assets/Womb_Tattoo.png
assets/backgrounds/whykusanagi_rendered_SEAMLESS.png
```

### Export Process
1. Hide controls overlay
2. Load html2canvas from CDN
3. Convert all images to data URLs (CORS workaround)
4. Clone document and render to canvas
5. Convert canvas to PNG blob
6. Trigger download

### Browser Compatibility
- **Chrome 90+**: ✅ Full support
- **Firefox 88+**: ✅ Full support
- **Safari 14+**: ✅ Full support
- **Edge 90+**: ✅ Full support

## ⚠️ Troubleshooting

### Images Not Loading
- **Problem**: Cross-origin restrictions
- **Solution**: Serve via HTTP server (`python3 -m http.server`)

### Export Fails
- **Problem**: html2canvas failed to load
- **Solution**: Check internet connection (CDN dependency)

### Animations Laggy
- **Problem**: GPU overload on low-end devices
- **Solution**: Use `toggleAnimations()` to pause animations

### Subject Not Visible
- **Problem**: Image URL incorrect or CORS blocked
- **Solution**: Check URL in console, ensure CORS headers on remote server

## 💡 Tips

1. **Use HTML in Titles**: Line breaks (`<br>`), bold (`<strong>`), etc.
2. **Pause Animations**: Toggle off for cleaner, static thumbnails
3. **Test Export Early**: Ensure all images load before final customization
4. **Subject Scale**: 70-90% works best for "Celeste towers over" effect
5. **Contrast**: Keep title text contrasted against background (use text-shadow)

## 📝 Credits

- **Design**: Corrupted Theme aesthetic by whykusanagi
- **Character Art**: Celeste_Legs.png (custom illustration)
- **Animation Components**: anime-blocks-advanced.js
- **Logo Design**: WHYKUSANAGI branding with womb tattoo

---

**Last Updated**: 2025-01-20
**Version**: 1.0.0
**Tool**: YouTube Thumbnail Generator
