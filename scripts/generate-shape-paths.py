#!/usr/bin/env python3
"""
Generate SVG paths for CSS clip-path shapes and export reviewable SVG files.
Outputs paths optimized for 375x375 containers and saves SVG assets under assets/shapes/.
"""

from pathlib import Path
import math

OUTPUT_DIR = Path("assets/shapes")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SVG_TEMPLATE = """<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">
  <path d="{path}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}" />
</svg>
"""

def save_svg(name, path_data, width=375, height=375, fill="#d94f90", stroke="#3a2555", stroke_width=2):
    """Persist an SVG file so designers can visually review the shape."""
    svg_content = SVG_TEMPLATE.format(
        w=width,
        h=height,
        path=path_data,
        fill=fill,
        stroke=stroke,
        stroke_width=stroke_width,
    )
    output_path = OUTPUT_DIR / f"{name}.svg"
    output_path.write_text(svg_content + "\n", encoding="utf-8")
    return output_path

def generate_heart_path(width=375, height=375):
    """
    Generate a classic heart path using two arcs (lobes) and two quadratic curves (taper).
    This yields a clean heart silhouette without the arrowhead artifacts.
    """
    base_w = 100
    base_h = 90

    def sx(val):
        return round((val / base_w) * width, 2)

    def sy(val):
        return round((val / base_h) * height, 2)

    rx = round((20 / base_w) * width, 2)
    ry = round((20 / base_h) * height, 2)

    path = (
        f"M{sx(10)},{sy(30)} "
        f"A{rx},{ry} 0 0 1 {sx(50)},{sy(30)} "
        f"A{rx},{ry} 0 0 1 {sx(90)},{sy(30)} "
        f"Q{sx(90)},{sy(60)} {sx(50)},{sy(90)} "
        f"Q{sx(10)},{sy(60)} {sx(10)},{sy(30)} "
        "Z"
    )

    return path

def generate_star_path(width=375, height=375, points=5):
    """
    Generate a star SVG path.
    """
    center_x = width / 2
    center_y = height / 2
    outer_radius = min(width, height) * 0.45
    inner_radius = outer_radius * 0.4
    
    path = ""
    for i in range(points * 2):
        angle = (i * math.pi) / points - math.pi / 2
        radius = outer_radius if i % 2 == 0 else inner_radius
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        if i == 0:
            path += f"M{x},{y} "
        else:
            path += f"L{x},{y} "
    path += "Z"
    
    return path

def generate_hexagon_path(width=375, height=375):
    """
    Generate a hexagon SVG path.
    """
    center_x = width / 2
    center_y = height / 2
    radius = min(width, height) * 0.45
    
    path = ""
    for i in range(6):
        angle = (i * 2 * math.pi) / 6 - math.pi / 2
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        if i == 0:
            path += f"M{x},{y} "
        else:
            path += f"L{x},{y} "
    path += "Z"
    
    return path

def generate_octagon_path(width=375, height=375):
    """
    Generate an octagon SVG path.
    """
    center_x = width / 2
    center_y = height / 2
    radius = min(width, height) * 0.45
    
    path = ""
    for i in range(8):
        angle = (i * 2 * math.pi) / 8 - math.pi / 2
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        if i == 0:
            path += f"M{x},{y} "
        else:
            path += f"L{x},{y} "
    path += "Z"
    
    return path

def generate_diamond_path(width=375, height=375):
    """
    Generate a diamond SVG path (alternative to rotate transform).
    """
    center_x = width / 2
    center_y = height / 2
    radius = min(width, height) * 0.45
    
    path = f"M{center_x},{center_y - radius} "  # Top
    path += f"L{center_x + radius},{center_y} "  # Right
    path += f"L{center_x},{center_y + radius} "  # Bottom
    path += f"L{center_x - radius},{center_y} "  # Left
    path += "Z"
    
    return path

if __name__ == "__main__":
    print("=" * 60)
    print("SVG Paths for CSS clip-path (375x375 containers)")
    print("=" * 60)
    
    print("\n1. HEART SHAPE (Two distinct rounded lobes):")
    print("-" * 60)
    heart_path = generate_heart_path()
    print(f"clip-path: path('{heart_path}');")
    heart_svg = save_svg("heart", heart_path)
    print(f" -> Saved preview SVG to {heart_svg}")
    
    print("\n2. STAR SHAPE (5-pointed):")
    print("-" * 60)
    star_path = generate_star_path()
    print(f"clip-path: path('{star_path}');")
    star_svg = save_svg("star", star_path)
    print(f" -> Saved preview SVG to {star_svg}")
    
    print("\n3. HEXAGON SHAPE:")
    print("-" * 60)
    hexagon_path = generate_hexagon_path()
    print(f"clip-path: path('{hexagon_path}');")
    hexagon_svg = save_svg("hexagon", hexagon_path)
    print(f" -> Saved preview SVG to {hexagon_svg}")
    
    print("\n4. OCTAGON SHAPE:")
    print("-" * 60)
    octagon_path = generate_octagon_path()
    print(f"clip-path: path('{octagon_path}');")
    octagon_svg = save_svg("octagon", octagon_path)
    print(f" -> Saved preview SVG to {octagon_svg}")
    
    print("\n5. DIAMOND SHAPE (Alternative to rotate):")
    print("-" * 60)
    diamond_path = generate_diamond_path()
    print(f"clip-path: path('{diamond_path}');")
    diamond_svg = save_svg("diamond", diamond_path)
    print(f" -> Saved preview SVG to {diamond_svg}")
    
    print("\n" + "=" * 60)
    print("Note: Circle uses border-radius: 50% (no clip-path needed)")
    print("=" * 60)

