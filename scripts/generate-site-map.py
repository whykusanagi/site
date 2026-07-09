#!/usr/bin/env python3
"""
Generate comprehensive site map with mermaid chart.
Follows all internal links and verifies consistency.
"""

import re
import os
from pathlib import Path
from collections import defaultdict, deque

def extract_links(html_content, base_path):
    """Extract all internal and external links from HTML."""
    internal_links = set()
    external_links = set()
    
    # Determine if we're in blog directory
    is_blog_page = 'blog' in str(base_path)
    
    # Match href="..." or href='...'
    href_pattern = r'href=["\']([^"\']+)["\']'
    for match in re.finditer(href_pattern, html_content):
        link = match.group(1)
        
        # Skip anchors, javascript, mailto, tel
        if link.startswith('#') or link.startswith('javascript:') or link.startswith('mailto:') or link.startswith('tel:'):
            continue
        
        # Check if internal (relative path or same domain)
        if link.startswith('http://') or link.startswith('https://'):
            if 'whykusanagi.xyz' in link or 'localhost' in link:
                # Extract path
                if '/blog/' in link:
                    internal_links.add('blog/' + link.split('/blog/')[-1].split('?')[0])
                elif link.endswith('.html'):
                    internal_links.add(link.split('/')[-1].split('?')[0])
            else:
                external_links.add(link)
        elif link.endswith('.html') or (not link.startswith('http') and not link.startswith('//')):
            # Internal link
            if link.startswith('../'):
                # Relative from blog/ - remove ../
                clean_link = link.replace('../', '')
                internal_links.add(clean_link)
            elif link.startswith('./'):
                clean_link = link.replace('./', '')
                if is_blog_page and not clean_link.startswith('blog/'):
                    clean_link = 'blog/' + clean_link
                internal_links.add(clean_link)
            elif link.startswith('blog/'):
                # Already has blog/ prefix
                internal_links.add(link)
            else:
                # Relative link - if we're in blog/ and it's a blog post, add blog/ prefix
                if is_blog_page and any(x in link for x in ['corrupted-ai', 'glitch-svg', 'voidpunk-stream']):
                    if not link.startswith('blog/'):
                        internal_links.add('blog/' + link)
                else:
                    internal_links.add(link)
    
    return internal_links, external_links

def find_all_pages(site_root):
    """Find all HTML pages in the site."""
    pages = {}
    
    # Root pages
    for html_file in site_root.glob('*.html'):
        if html_file.name.startswith('test-') or html_file.name in ['loading.html']:
            continue
        pages[html_file.name] = html_file
    
    # Blog pages
    blog_dir = site_root / 'blog'
    if blog_dir.exists():
        for html_file in blog_dir.glob('*.html'):
            pages[f'blog/{html_file.name}'] = html_file
    
    return pages

def build_link_graph(site_root):
    """Build a graph of all page links."""
    pages = find_all_pages(site_root)
    graph = defaultdict(set)
    all_internal_links = set()
    all_external_links = set()
    
    for page_name, page_path in pages.items():
        with open(page_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        internal, external = extract_links(content, page_path)
        graph[page_name] = internal
        all_internal_links.update(internal)
        all_external_links.update(external)
    
    return graph, pages, all_internal_links, all_external_links

def generate_mermaid_site_map(graph, pages, broken_links):
    """Generate mermaid site map diagram."""
    mermaid = """```mermaid
graph TB
    subgraph "Root Pages"
"""
    
    root_pages = [p for p in pages.keys() if '/' not in p]
    blog_pages = [p for p in pages.keys() if p.startswith('blog/')]
    
    # Root pages
    for page in sorted(root_pages):
        page_id = page.replace('.html', '').replace('-', '_')
        mermaid += f"        {page_id}[{page}]\n"
    
    mermaid += "    end\n\n    subgraph \"Blog Pages\"\n"
    
    for page in sorted(blog_pages):
        page_id = page.replace('.html', '').replace('/', '_').replace('-', '_')
        mermaid += f"        {page_id}[{page}]\n"
    
    mermaid += "    end\n\n    subgraph \"External Links\"\n"
    mermaid += "        EXT_GITHUB[GitHub]\n"
    mermaid += "        EXT_NPM[NPM Package]\n"
    mermaid += "        EXT_SOCIAL[Social Media]\n"
    mermaid += "        EXT_OTHER[Other External]\n"
    mermaid += "    end\n\n"
    
    # Add connections
    for page_name, links in sorted(graph.items()):
        page_id = page_name.replace('.html', '').replace('/', '_').replace('-', '_')
        for link in sorted(links):
            if link in pages:
                target_id = link.replace('.html', '').replace('/', '_').replace('-', '_')
                mermaid += f"    {page_id} --> {target_id}\n"
            elif link.startswith('http'):
                if 'github.com' in link:
                    mermaid += f"    {page_id} -.-> EXT_GITHUB\n"
                elif 'npmjs.com' in link or 'npm' in link.lower():
                    mermaid += f"    {page_id} -.-> EXT_NPM\n"
                elif any(x in link for x in ['twitter.com', 'twitch.tv', 'youtube.com', 'tiktok.com', 'discord']):
                    mermaid += f"    {page_id} -.-> EXT_SOCIAL\n"
                else:
                    mermaid += f"    {page_id} -.-> EXT_OTHER\n"
    
    mermaid += "\n```\n"
    return mermaid

def main():
    """Main function."""
    site_root = Path(__file__).parent.parent
    graph, pages, all_internal_links, all_external_links = build_link_graph(site_root)
    
    # Find broken links
    broken_links = set()
    for link in all_internal_links:
        if link not in pages and link.endswith('.html'):
            broken_links.add(link)
    
    # Generate mermaid chart
    mermaid_chart = generate_mermaid_site_map(graph, pages, broken_links)
    
    # Write to docs
    docs_dir = site_root / 'docs'
    docs_dir.mkdir(exist_ok=True)
    
    with open(docs_dir / 'SITE_LAYOUT.md', 'w') as f:
        f.write("# Site Layout Map\n\n")
        f.write("**Generated**: 2025-01-26\n\n")
        f.write("## Overview\n\n")
        f.write(f"This document maps all internal links across the site. Total pages: {len(pages)}\n\n")
        f.write("## Mermaid Site Map\n\n")
        f.write(mermaid_chart)
        f.write("\n## Page List\n\n")
        f.write("### Root Pages\n\n")
        for page in sorted([p for p in pages.keys() if '/' not in p]):
            f.write(f"- `{page}`\n")
        f.write("\n### Blog Pages\n\n")
        for page in sorted([p for p in pages.keys() if p.startswith('blog/')]):
            f.write(f"- `{page}`\n")
        f.write("\n## Link Analysis\n\n")
        f.write(f"- **Total Pages**: {len(pages)}\n")
        f.write(f"- **Total Internal Links**: {len(all_internal_links)}\n")
        f.write(f"- **Total External Links**: {len(all_external_links)}\n")
        if broken_links:
            f.write(f"- **Broken Internal Links**: {len(broken_links)}\n")
            f.write("\n### Broken Links\n\n")
            for link in sorted(broken_links):
                f.write(f"- `{link}`\n")
        else:
            f.write("- **Broken Internal Links**: 0 ✅\n")
        f.write("\n## Navigation Structure\n\n")
        f.write("All pages include a navbar with links to:\n")
        f.write("- Home (index.html)\n")
        f.write("- Celeste AI (celeste.html)\n")
        f.write("- Art Gallery (art.html)\n")
        f.write("- References (references.html)\n")
        f.write("- Doujin (doujin.html)\n")
        f.write("- Links (links.html)\n")
        f.write("- Tools (tools.html)\n")
    
    print(f"Generated site map: docs/SITE_LAYOUT.md")
    if broken_links:
        print(f"⚠️  Found {len(broken_links)} broken links:")
        for link in sorted(broken_links):
            print(f"   - {link}")
    else:
        print("✅ No broken internal links found!")

if __name__ == '__main__':
    main()

