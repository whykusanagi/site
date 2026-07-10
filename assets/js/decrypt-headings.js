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

  // Capture every heading's real text up front, before any decode mutates it.
  const finalTextByEl = new Map(targets.map((el) => [el, el.textContent]));

  // Track which elements have already been decoded so the animation fires once.
  const seen = new WeakSet();

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || seen.has(entry.target)) continue;
      seen.add(entry.target);

      const el = entry.target;
      const finalText = finalTextByEl.get(el);

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

  // Self-heal against a stuck-scramble bug: the shared DecryptReveal manager
  // stop()s in-flight decodes when the tab is hidden and does NOT resume them
  // (its start() is a no-op), so a heading caught mid-decode — e.g. a post
  // opened in a background tab (cmd-click) — is left frozen on scrambled glyphs
  // and never recovers (the observer has already unobserved it). Whenever the
  // tab regains focus, restore any heading whose text drifted from its real
  // value so it can never be left permanently unreadable.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    for (const [el, finalText] of finalTextByEl) {
      if (el.textContent !== finalText) el.textContent = finalText;
    }
  });
}
