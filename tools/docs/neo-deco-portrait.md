# Neo-Deco Shrine Portrait - User Guide

Create stunning Art Deco-inspired portrait graphics with occult elements, perfect for Instagram Stories, TikTok, tarot cards, and vertical social media posts.

## 🎯 Features

- **1080×1920 Canvas**: Portrait format (9:16 ratio)
- **Solar Eclipse Centerpiece**: Glowing sun with rays
- **Art Deco Patterns**: Geometric grid, broken arcs, sunburst
- **Animated Tentacles**: Writhing tentacles (toggleable)
- **Occult Symbols**: Pentagrams, Eye of Providence, alchemical symbols, crescents
- **Theme Colors**: Gold, Pink, Cyan, Purple
- **Character Upload**: Add custom portrait image
- **PNG Export**: One-click download (1080×1920)

## 🚀 Getting Started

### Opening the Tool

**Option 1: Direct File**
- Double-click `index.html` in the `neo-deco-portrait` folder

**Option 2: HTTP Server**
```bash
cd neo-deco-portrait
python3 -m http.server 8000
# Open http://localhost:8000
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **C** | Toggle controls menu |
| **E** | Export PNG (1080×1920) |

## 🎨 Themes

Switch between four preset color themes:

### Gold Theme (Default)
```javascript
switchTheme("gold");
```
- **Accent**: #D4AF37 (Metallic gold)
- **Vibe**: Luxurious, mystical, sacred

### Pink Theme
```javascript
switchTheme("pink");
```
- **Accent**: #FF1493 (Hot pink)
- **Vibe**: Neon, energetic, cyberpunk

### Cyan Theme
```javascript
switchTheme("cyan");
```
- **Accent**: #00FFFF (Electric cyan)
- **Vibe**: Digital, corrupted, Matrix-like

### Purple Theme
```javascript
switchTheme("purple");
```
- **Accent**: #8B5CF6 (Deep purple)
- **Vibe**: Mystical, occult, royal

### Custom Theme
```javascript
switchTheme("#FF6B6B"); // Any hex color
```

## 🖼️ Character Image

### Upload via UI
1. Press **C** to open controls
2. Click **"Upload Character Image"**
3. Select PNG/JPG/WEBP file

### Console Commands
```javascript
// Load from URL
setCharacter("https://example.com/character.png");

// Resize character (50-150%)
setCharacterSize(120);

// Remove character
clearCharacter();
```

### Image Requirements
- **Format**: PNG (transparency recommended), JPG, WEBP
- **Orientation**: Portrait (vertical)
- **Max Display**: 450×1200px (auto-scaled)
- **Recommended**: High-res portraits with transparent background

## 🎬 Console Commands

Open browser console (F12) for advanced controls:

### Theme & Appearance
```javascript
// Switch theme
switchTheme("pink");
switchTheme("#FF6B6B");

// Regenerate patterns
generateEclipseRays(50);  // Default: 30
generateSunburst(60);     // Default: 40
```

### Character Control
```javascript
// Load character from URL
setCharacter("https://s3.whykusanagi.xyz/art/character.png");

// Resize character
setCharacterSize(120); // 120% of base size

// Remove character
clearCharacter();
```

### Tentacle Animation
```javascript
// Toggle tentacles on/off
toggleTentacles();

// Regenerate tentacles with custom count
regenerateTentacles(20); // Default: 16
```

### Export
```javascript
// Download as PNG (1080×1920)
exportPNG();
```

## 🕷️ Occult Elements

### Pentagrams
- **Location**: Top-left and top-right corners
- **Style**: Outlined, subtle glow
- **Purpose**: Symmetrical framing

### Eye of Providence
- **Location**: Top-center
- **Elements**: Triangle, eye, rays
- **Meaning**: All-seeing eye, illumination

### Alchemical Symbols
Four elemental symbols positioned at cardinal directions:
- **Fire** (🜂): Top-left
- **Water** (🜄): Top-right
- **Earth** (🜃): Bottom-left
- **Air** (🜁): Bottom-right

### Mystical Circles
- **Location**: Four corners (mid-canvas)
- **Style**: Simple circle outlines
- **Purpose**: Energy focus points

### Crescent Moons
- **Location**: Left and right sides (mid-canvas)
- **Style**: Crescents facing outward
- **Purpose**: Lunar symmetry

## 📐 Canvas Layout

### Layers (Z-Index Order)
1. **Background (0)**: Black (#0A0A0F)
2. **Geometric Grid (1)**: Subtle wireframe
3. **Solar Eclipse (2-4)**: Core, ring, rays
4. **Sunburst (4)**: Outer rays
5. **Halo Pattern (5)**: Broken arcs
6. **Occult Elements (6)**: Symbols and circles
7. **Tentacles (6)**: Animated (toggleable)
8. **Character (10)**: Portrait image
9. **Deco Frame (100)**: Corner accents
10. **Dot Array (80)**: Top decoration

### Centerpiece: Solar Eclipse
- **Core Circle**: 976px diameter (filled)
- **Outer Ring**: 1276px diameter (outline only)
- **Eclipse Rays**: 30 triangular wedges radiating outward
- **Sunburst Rays**: 40 longer rays reaching canvas edges

## 🎭 Use Cases

### Instagram Stories
- **Format**: Perfect 1080×1920 (9:16)
- **Character**: Portrait photo or art
- **Theme**: Pink or Cyan for modern vibe

### Tarot Cards
- **Format**: Traditional tarot proportions
- **Character**: Deity or symbolic figure
- **Theme**: Gold for mystical feel

### TikTok Posts
- **Format**: Vertical video thumbnail
- **Character**: Creator portrait
- **Theme**: Any theme matching brand

### Social Media Posts
- **Format**: Story format (Instagram, Facebook, Snapchat)
- **Character**: Influencer, OC, character art
- **Theme**: Brand-matched colors

## 🎬 Example Workflows

### Basic Portrait (Gold Theme)
```javascript
// 1. Upload character
// (Use UI button or console)

// 2. Export
exportPNG();
```

### Cyberpunk Portrait
```javascript
// 1. Switch to cyan theme
switchTheme("cyan");

// 2. Add character
setCharacter("https://example.com/cyberpunk_char.png");
setCharacterSize(130); // Larger scale

// 3. Disable tentacles for cleaner look
toggleTentacles();

// 4. Export
exportPNG();
```

### Mystical Tarot Card
```javascript
// 1. Purple theme for occult vibe
switchTheme("purple");

// 2. Add deity/symbolic character
setCharacter("https://example.com/deity.png");

// 3. More rays for dramatic effect
generateEclipseRays(50);
generateSunburst(60);

// 4. Export
exportPNG();
```

### Custom Brand Colors
```javascript
// 1. Set brand color
switchTheme("#FF6B6B"); // Coral red

// 2. Add influencer portrait
setCharacter("https://example.com/influencer.png");

// 3. Adjust tentacles
regenerateTentacles(12); // Fewer for subtlety

// 4. Export
exportPNG();
```

## 🔧 Technical Details

### Self-Contained Design
- **No external dependencies** (except html2canvas CDN)
- **All CSS inline**: No external stylesheets
- **All JavaScript inline**: No external scripts
- **Fully portable**: Single HTML file

### Export Process
1. Hide controls and mode indicator
2. Pause tentacle animation (capture single frame)
3. Load html2canvas from CDN
4. Scale occult elements 2× for quality
5. Render document to canvas
6. Convert to PNG blob
7. Trigger download
8. Restore UI state

### Animation Details
- **Tentacles**: Canvas-based with `requestAnimationFrame`
- **Count**: 16 tentacles by default
- **Origin**: Bottom edge, radiating upward
- **Style**: Art Deco geometric accents (diamonds, orbs, particles)
- **Performance**: ~60fps on modern devices

### Browser Compatibility
- **Chrome 90+**: ✅ Full support
- **Firefox 88+**: ✅ Full support
- **Safari 14+**: ✅ Full support (may need CORS workaround)
- **Edge 90+**: ✅ Full support

## ⚠️ Troubleshooting

### Tentacles Not Visible
- **Problem**: Canvas element hidden
- **Solution**: Use `toggleTentacles()` to show

### Image Won't Load
- **Problem**: CORS restrictions on external URL
- **Solution**: Use file upload instead of URL

### Export Cuts Off Elements
- **Problem**: Elements positioned outside canvas
- **Solution**: All elements should fit 1080×1920 by design (report if issue persists)

### Animations Laggy
- **Problem**: Device performance
- **Solution**: Toggle off tentacles with `toggleTentacles()`

### Custom Theme Not Applying
- **Problem**: Invalid hex color
- **Solution**: Use format `"#RRGGBB"` (e.g., `"#FF6B6B"`)

## 💡 Tips

1. **High-Res Characters**: Use large images for best quality on export
2. **Transparent PNG**: Works best for character images (blends naturally)
3. **Disable Tentacles**: For cleaner, more minimal look
4. **Custom Colors**: Match your brand palette with `switchTheme("#HEXCODE")`
5. **Ray Count**: More rays = more dramatic, fewer = cleaner
6. **Portrait Crop**: Character should be cropped to portrait orientation before upload

## 📝 Design Philosophy

### Art Deco Meets Occult
- **Geometric precision**: Grids, circles, triangles
- **Radial symmetry**: Eclipse, sunburst, rays
- **Mystical symbols**: Borrowed from occult traditions
- **Gold standard**: Luxurious gold as default theme

### Corrupted Theme Integration
- **Neo-deco**: Modern take on 1920s Art Deco
- **Occult elements**: Mysticism and mystery
- **Animated corruption**: Tentacles as chaotic element
- **Thematic colors**: Purple and cyan as corrupted accents

## 🎨 Customization Ideas

### Seasonal Variants
- **Halloween**: Purple theme + extra tentacles
- **Christmas**: Gold theme + remove tentacles
- **Valentine**: Pink theme + heart-shaped character

### Genre Adaptations
- **Cyberpunk**: Cyan theme, disable tentacles
- **Gothic**: Purple/black, keep tentacles
- **Vaporwave**: Pink/cyan gradient (custom theme)
- **Steampunk**: Gold theme, character in Victorian attire

## 📝 Credits

- **Design**: Neo-Deco aesthetic by whykusanagi
- **Inspiration**: 1920s Art Deco + occult symbolism
- **Tentacle Animation**: From Ominous Temple building block
- **Export Library**: html2canvas@1.4.1

---

**Last Updated**: 2025-01-20
**Version**: 1.0.0
**Tool**: Neo-Deco Shrine - Portrait Mode
