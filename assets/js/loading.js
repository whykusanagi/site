// The package owns the boot screen, phrase pools, timer cleanup and 72-hour throttle.
// Keep the site accessibility gate: the package auto-initializes on import.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && !document.documentElement.hasAttribute('data-no-corruption-loading')) {
    import('https://cdn.whykusanagi.xyz/corrupted-theme/@0.3.5/src/lib/corruption-loading.js').then(({ cancelLoading }) => {
      // 0.3.5 creates #corruption-loading-screen but cancelLoading looks for
      // #corruption-loading. Keep cancellation functional until upstream fixes it.
      window.CorruptionLoading.cancel = () => {
        cancelLoading();
        document.getElementById('corruption-loading-screen')?.remove();
      };
    });
  }
})();
