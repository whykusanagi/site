# whykusanagi.xyz

Source for **[whykusanagi.xyz](https://whykusanagi.xyz)** — the personal site of whykusanagi, a virtual streamer and digital artist.

Static site, no build step.

## Layout

- HTML pages live in the repo root; shared CSS/JS in `assets/`.
- The Cloudflare Worker (`src/index.js`) serves `/api/*` and does **not**
  auto-deploy — `git push` updates the repo, `npm run deploy` ships the Worker.
- Everything else deploys on push to `main` via Cloudflare Pages.

## Working on it

```bash
npm test          # 599 tests: SEO, sitemap, nav chrome, pose records, stage loop
npm run sitemap   # regenerate sitemap.xml — run before committing HTML
npm run og-cards  # regenerate social cards — run after adding a page
```

Note that the theme CDN is CORS-locked to the apex domain, so pages **cannot be
rendered on localhost or a Pages preview**. The DOM works; the visuals do not.
Verify on the live site.

## Docs

- [`docs/celeste-stage.md`](docs/celeste-stage.md) — the 3D character page:
  adding poses and outfits, tuning expressions, and the traps.
