/**
 * Maps the on-screen lore section to a pose name. Knows nothing about bones.
 *
 * Keys off the section whose centre is nearest the viewport middle rather than
 * a scroll offset, so momentum scrolling and variable section heights behave.
 */
export function initScrollPoser(controller, opts = {}) {
  const selector = opts.selector ?? '[data-pose]';
  const sections = Array.from(document.querySelectorAll(selector));
  if (sections.length === 0) return null;

  let active = null;
  const visible = new Set();

  const pick = () => {
    if (visible.size === 0) {
      // Scrolled past every section: release control back to the idle clip
      // instead of leaving the character frozen in the last pose.
      if (active !== null) {
        active = null;
        controller.applyPose(null);
      }
      return;
    }
    const mid = window.innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }
    const name = best?.dataset.pose ?? null;
    if (name !== active) {
      active = name;
      controller.applyPose(name);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    }
    pick();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  sections.forEach((s) => observer.observe(s));
  // Momentum scrolling fires no observer entries mid-flight; re-pick cheaply.
  window.addEventListener('scroll', pick, { passive: true });
  return observer;
}
