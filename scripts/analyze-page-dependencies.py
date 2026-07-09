#!/usr/bin/env python3
"""
Analyze HTML pages and generate mermaid dependency charts.
Identifies CSS classes, JS files, and assets used per page.
"""

import re
import os
from pathlib import Path
from collections import defaultdict

def extract_classes_and_ids(html_content):
    """Extract all CSS classes and IDs from HTML."""
    classes = set()
    ids = set()
    
    # Match class="..." or class='...'
    class_pattern = r'class=["\']([^"\']+)["\']'
    for match in re.finditer(class_pattern, html_content):
        classes.update(match.group(1).split())
    
    # Match id="..." or id='...'
    id_pattern = r'id=["\']([^"\']+)["\']'
    for match in re.finditer(id_pattern, html_content):
        ids.add(match.group(1))
    
    return classes, ids

def extract_assets(html_content):
    """Extract CSS, JS, and image assets."""
    css_files = set()
    js_files = set()
    images = set()
    
    # CSS files
    css_pattern = r'<link[^>]+href=["\']([^"\']+\.css[^"\']*)["\']'
    for match in re.finditer(css_pattern, html_content, re.IGNORECASE):
        css_files.add(match.group(1))
    
    # JS files
    js_pattern = r'<script[^>]+src=["\']([^"\']+\.js[^"\']*)["\']'
    for match in re.finditer(js_pattern, html_content, re.IGNORECASE):
        js_files.add(match.group(1))
    
    # Images
    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
    for match in re.finditer(img_pattern, html_content, re.IGNORECASE):
        images.add(match.group(1))
    
    return css_files, js_files, images

def generate_mermaid_chart(page_name, classes, ids, css_files, js_files, images):
    """Generate mermaid diagram for page dependencies."""
    chart = f"""```mermaid
graph TB
    subgraph "{page_name}"
        HTML[HTML Page]
    end
    
    subgraph "CSS Dependencies"
"""
    
    for css in sorted(css_files):
        css_name = Path(css).name
        chart += f"        CSS_{css_name.replace('.', '_').replace('-', '_')}[{css_name}]\n"
    
    chart += "    end\n\n    subgraph \"JavaScript Dependencies\"\n"
    
    for js in sorted(js_files):
        js_name = Path(js).name
        chart += f"        JS_{js_name.replace('.', '_').replace('-', '_')}[{js_name}]\n"
    
    chart += "    end\n\n    subgraph \"CSS Classes Used\"\n"
    
    # Group classes by prefix
    theme_classes = [c for c in classes if any(c.startswith(p) for p in ['navbar', 'btn', 'card', 'app-shell', 'container', 'content', 'character', 'social', 'link'])]
    custom_classes = sorted(set(classes) - set(theme_classes))
    
    for cls in sorted(theme_classes)[:20]:  # Limit to 20
        chart += f"        CLASS_{cls.replace('-', '_')}[.{cls}]\n"
    
    if len(theme_classes) > 20:
        chart += f"        CLASS_MORE[... {len(theme_classes) - 20} more theme classes]\n"
    
    for cls in sorted(custom_classes)[:10]:  # Limit custom to 10
        chart += f"        CLASS_{cls.replace('-', '_')}[.{cls}]\n"
    
    if len(custom_classes) > 10:
        chart += f"        CLASS_CUSTOM_MORE[... {len(custom_classes) - 10} more custom classes]\n"
    
    chart += "    end\n\n    subgraph \"IDs Used\"\n"
    
    for id_name in sorted(list(ids)[:10]):  # Limit to 10
        chart += f"        ID_{id_name.replace('-', '_')}[#{id_name}]\n"
    
    if len(ids) > 10:
        chart += f"        ID_MORE[... {len(ids) - 10} more IDs]\n"
    
    chart += "    end\n\n    HTML --> CSS\n    HTML --> JS\n    CSS --> CLASS\n    HTML --> ID\n"
    
    chart += "\n```\n"
    return chart

def analyze_page(html_path):
    """Analyze a single HTML page."""
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    classes, ids = extract_classes_and_ids(content)
    css_files, js_files, images = extract_assets(content)
    
    page_name = html_path.stem
    chart = generate_mermaid_chart(page_name, classes, ids, css_files, js_files, images)
    
    return {
        'name': page_name,
        'classes': classes,
        'ids': ids,
        'css': css_files,
        'js': js_files,
        'images': images,
        'chart': chart
    }

def main():
    """Main analysis function."""
    site_root = Path(__file__).parent.parent
    html_files = list(site_root.glob('*.html')) + list((site_root / 'blog').glob('*.html'))
    
    results = []
    for html_file in html_files:
        if html_file.name.startswith('test-') or html_file.name == 'loading.html':
            continue
        try:
            result = analyze_page(html_file)
            results.append(result)
        except Exception as e:
            print(f"Error analyzing {html_file}: {e}")
    
    # Generate documentation files
    docs_dir = site_root / 'docs'
    docs_dir.mkdir(exist_ok=True)
    
    for result in results:
        doc_file = docs_dir / f"{result['name']}-dependencies.md"
        with open(doc_file, 'w') as f:
            f.write(f"# {result['name']}.html Dependencies\n\n")
            f.write("## Mermaid Dependency Chart\n\n")
            f.write(result['chart'])
            f.write("\n## Summary\n\n")
            f.write(f"- **CSS Files**: {len(result['css'])}\n")
            f.write(f"- **JS Files**: {len(result['js'])}\n")
            f.write(f"- **CSS Classes**: {len(result['classes'])}\n")
            f.write(f"- **IDs**: {len(result['ids'])}\n")
            f.write(f"- **Images**: {len(result['images'])}\n")
            f.write("\n## CSS Files\n\n")
            for css in sorted(result['css']):
                f.write(f"- `{css}`\n")
            f.write("\n## JavaScript Files\n\n")
            for js in sorted(result['js']):
                f.write(f"- `{js}`\n")
    
    print(f"Generated dependency charts for {len(results)} pages in docs/")

if __name__ == '__main__':
    main()

