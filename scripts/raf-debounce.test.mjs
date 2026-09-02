import test from 'node:test';
import assert from 'node:assert/strict';

// The module reaches for requestAnimationFrame; give it one before importing.
let queue = [];
globalThis.requestAnimationFrame = (fn) => { queue.push(fn); return queue.length; };
globalThis.cancelAnimationFrame = (id) => { queue[id - 1] = null; };
const flush = () => { const q = queue; queue = []; for (const fn of q) if (fn) fn(); };

const { rafDebounce } = await import('../src/3d/raf-debounce.js');

test('many calls in one frame run the body once', () => {
  let runs = 0;
  const d = rafDebounce(() => { runs++; });
  for (let i = 0; i < 50; i++) d();
  assert.equal(runs, 0, 'must not run synchronously');
  flush();
  assert.equal(runs, 1, '50 calls in one frame should coalesce to 1');
});

test('a later burst runs again', () => {
  let runs = 0;
  const d = rafDebounce(() => { runs++; });
  d(); flush();
  d(); flush();
  assert.equal(runs, 2);
});

test('cancel stops a pending run', () => {
  let runs = 0;
  const d = rafDebounce(() => { runs++; });
  d();
  d.cancel();
  flush();
  assert.equal(runs, 0);
});
