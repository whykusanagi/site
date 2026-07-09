// Single ES-module entry for corrupted-theme component wiring.
// Loaded as <script type="module" src="assets/js/site-bootstrap.js"> in every
// page. Each component block gates on DOM presence so unused modules stay out
// of pages that don't need them.
//
// Pinned to corrupted-theme @ assets/js/corrupted-theme/VERSION.

// === Toast (sitewide singleton — exposed on window for inline callers) ===
import { Toast } from './corrupted-theme/lib/toast.js';
window.Toast = Toast;

// Click-to-copy hashtag on links.html (also a live Toast demo)
const hashtagEl = document.getElementById('hashtag');
if (hashtagEl) {
  hashtagEl.addEventListener('click', () => {
    const text = hashtagEl.textContent.trim();
    navigator.clipboard.writeText(text).then(
      () => Toast.success(`Copied ${text}`),
      () => Toast.error('Copy failed'),
    );
  });
}

// === corrupted-particles-background (sitewide) ===
// CorruptedParticlesBackground is a class. Instantiating it handles DOMContentLoaded
// internally and always forces DPR=1 on the background canvas (no dpr option needed).
// count:15 = low density (default is 25). nsfw:true enables adult-content particles.
import { CorruptedParticlesBackground } from './corrupted-theme/lib/corrupted-particles-background.js';
new CorruptedParticlesBackground({ nsfw: true, count: 15 });
// === DecryptReveal headings (sitewide) ===
import './decrypt-headings.js';
// === PhraseCycle: intentionally not wired ===
// loading.js is a custom 72hr-throttled immersive boot screen with persona-specific
// multi-language phrases — different shape from PhraseCycle (a generic rotator
// settling on a value). No #loading-text element exists. Keeping loading.js as-is.

// === Index-only: CRTEffects ambient layer + TerminalBoot/TitleDecoder hero ===
if (document.body.classList.contains('crt-on')) {
  import('./corrupted-theme/lib/crt-effects.js').then(({ CRTEffects }) => {
    new CRTEffects(document.body, {
      autoStart:        true,
      scanlines:        true,
      vignette:         true,
      vignetteIntensity: 0.2,   // subtle — video background must remain visible
      flicker:          true,
      flickerIntensity: 0.03,   // barely perceptible opacity dip
      flickerFrequency: 150,    // slow enough not to distract
    });
  });
}

const heroEl = document.querySelector('[data-ct-animation="hero-boot"]');
if (heroEl) {
  import('./corrupted-theme/lib/animation-blocks.js').then(async ({ TerminalBoot, TitleDecoder }) => {
    const finalText = heroEl.textContent.trim();

    // Hide h1 native text so only the animation overlay is visible during the sequence.
    heroEl.style.color = 'transparent';

    const bootBlock   = new TerminalBoot(heroEl, {
      lines:    ['> boot.celeste', '> mount /void', '> link[whykusanagi]'],
      duration: 600,
      color:    '#d94f90',
    });
    const decodeBlock = new TitleDecoder(heroEl, {
      finalText,
      duration: 700,
      nsfw:     true,
      color:    '#d94f90',
    });

    await bootBlock.start();
    bootBlock.destroy();

    await decodeBlock.start();
    decodeBlock.destroy();

    // Restore h1 text now that the animation has completed.
    heroEl.style.color = '';
  });
}

// === Mobile nav hamburger (sitewide) ===
// Theme ships .navbar-toggle + .navbar-links.active styling but no markup/JS.
// Inject the button once per page rather than editing every navbar by hand.
const navContent = document.querySelector('.navbar-content');
const navLinks = navContent?.querySelector('.navbar-links');
if (navContent && navLinks) {
  const toggle = document.createElement('button');
  toggle.className = 'navbar-toggle';
  toggle.setAttribute('aria-label', 'Toggle menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span class="icon"><span></span><span></span><span></span></span>';
  navContent.insertBefore(toggle, navLinks);

  const setOpen = (open) => {
    navLinks.classList.toggle('active', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!navLinks.classList.contains('active')));
  // Collapse after tapping a destination.
  navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
}

// === links.html-only: ClockWidget ===
const clockEl = document.getElementById('clock-widget');
if (clockEl) {
  import('./corrupted-theme/lib/clock-widget.js').then(({ ClockWidget }) => {
    new ClockWidget(clockEl, {
      timezones: ['Asia/Tokyo', 'America/Los_Angeles', 'UTC'],
      format:    '12h',
      cycleMs:   5000,
      showDate:  true,
    }).start();
  });
}
// === NsfwReveal (art.html / wallpapers.html) ===
// Marker: data-nsfw-reveal on <img> elements.
// Site default is nsfw:true → .reveal() is called immediately so content is
// visible by default. The component is wired now so Task 16 (NSFW option
// canonicalization) can gate .reveal() behind a session preference without
// touching page markup again.
//
// NsfwReveal has no built-in defaultOpen option; we replicate that behaviour
// by calling .reveal() after construction when the site preference is open.
function initNsfwReveal() {
  const targets = document.querySelectorAll('[data-nsfw-reveal]');
  if (!targets.length) return;

  import('./corrupted-theme/lib/nsfw-reveal.js').then(({ NsfwReveal }) => {
    targets.forEach(el => {
      const nr = new NsfwReveal(el, { warning: '18+ — click to reveal' });
      // nsfw:true site default → reveal immediately (content visible on load).
      // Task 16 will conditionally skip this call for opted-out sessions.
      nr.reveal();
    });
  });
}

// wallpapers.html: items are inline HTML, available immediately.
initNsfwReveal();

// art.html: gallery is populated asynchronously from JSON; wait for the signal.
document.addEventListener('gallery:loaded', initNsfwReveal, { once: true });
