// The theme owns viewport observation, one-shot decoding and visibility cleanup.
// Keep the site's heading selection policy so inline links/markup and the
// separately animated home hero remain intact.
import { ScrollDecode } from 'https://cdn.whykusanagi.xyz/corrupted-theme/@0.3.5/src/lib/scroll-decode.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion) {
  const candidates = document.querySelectorAll(
    'h1:not([data-no-decrypt]):not([data-ct-animation]), h2:not([data-no-decrypt]):not([data-ct-animation])',
  );
  for (const heading of candidates) {
    // ScrollDecode writes textContent; preserve headings containing HTML.
    if (heading.children.length) continue;
    new ScrollDecode(heading, { threshold: 0.5, duration: 700 }).start();
  }
}
