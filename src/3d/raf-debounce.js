/**
 * Coalesces a burst of calls into one, on the next animation frame.
 *
 * Written for resize. The stage canvas is sized in `dvh`, so a mobile URL bar
 * collapsing mid-scroll fires resize continuously - and each one reallocated
 * the WebGL drawing buffer, a multi-megabyte 2D canvas and the bloom render
 * targets, during the exact interaction the page is built around.
 *
 * rAF rather than a timer: the work is a paint-side reallocation, so running
 * it once per frame is both the cheapest correct cadence and naturally paused
 * while the tab is hidden.
 */
export function rafDebounce(fn) {
  let handle = null;
  const run = () => { handle = null; fn(); };
  const debounced = () => {
    if (handle !== null) return;
    handle = requestAnimationFrame(run);
  };
  debounced.cancel = () => {
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
  };
  return debounced;
}
