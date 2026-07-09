/**
 * decrypt-headings.js
 *
 * IntersectionObserver-based module that runs a DecryptReveal animation on
 * every H1 and H2 in the page as each heading scrolls into view.
 *
 * Rules:
 *   - Runs each animation exactly once per element per page load (WeakSet guard).
 *   - Headings marked with [data-no-decrypt] are skipped.
 *   - Headings marked with [data-ct-animation] (e.g. the index hero h1 that
 *     runs its own TerminalBoot/TitleDecoder sequence) are also skipped so the
 *     two animations don't collide.
 *   - The entire feature is disabled when the user has requested reduced motion.
 *
 * API (DecryptReveal @ assets/js/corrupted-theme/core/decrypt-reveal.js):
 *   - Instance-based: `new DecryptReveal(managerOpts?)` creates a shared manager.
 *   - `.decode(element, content, { duration, charset })` — fire-and-forget,
 *     returns a numeric ID; not a Promise.
 *   - Default duration: 2000 ms. We override to 700 ms to keep reveals snappy.
 */

import { DecryptReveal } from './corrupted-theme/core/decrypt-reveal.js';

// Bail out entirely when the user prefers reduced motion.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion) {
  // Shared manager for all heading animations on this page.
  const manager = new DecryptReveal();

  // Option A: exclude [data-ct-animation] so the index hero h1 (which runs its
  // own TerminalBoot/TitleDecoder sequence from site-bootstrap.js) is never
  // double-animated.
  const candidates = document.querySelectorAll(
    'h1:not([data-no-decrypt]):not([data-ct-animation]), h2:not([data-no-decrypt]):not([data-ct-animation])',
  );

  // DecryptReveal.decode() settles via element.textContent = finalText, which
  // strips any child elements (e.g. <a>, <code>). Skip headings whose only
  // content is markup — most importantly the blog index <h2><a>...</a></h2>
  // cards, which would lose their navigation links if decoded.
  const targets = Array.from(candidates).filter((el) => el.children.length === 0);

  // Track which elements have already been decoded so the animation fires once.
  const seen = new WeakSet();

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || seen.has(entry.target)) continue;
      seen.add(entry.target);

      const el = entry.target;
      // Capture the final readable text before any mutation.
      const finalText = el.textContent;

      // .decode() is fire-and-forget. duration 700 ms matches the hero animation
      // timing set in site-bootstrap.js (TitleDecoder duration: 700).
      manager.decode(el, finalText, { duration: 700 });

      // Stop observing once the element has been decoded.
      io.unobserve(el);
    }
  }, { threshold: 0.5 });

  for (const el of targets) {
    io.observe(el);
  }
}
