/**
 * Video Background Performance Optimizations
 * Pauses video when tab is hidden to save battery
 */

(function() {
  'use strict';

  const video = document.getElementById('bg-video');
  if (!video) return;

  // Pause video when tab is hidden, resume when visible
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      video.pause();
    } else {
      video.play().catch(function(error) {
        // Autoplay may be blocked, ignore error
        console.debug('Video autoplay prevented:', error);
      });
    }
  });

  // Handle video loading errors gracefully
  video.addEventListener('error', function(e) {
    console.warn('Video background failed to load, falling back to static background');
    // Video element will show poster image as fallback
  });

  // Ensure video plays when loaded (for browsers that require user interaction)
  video.addEventListener('loadeddata', function() {
    if (!document.hidden) {
      video.play().catch(function(error) {
        console.debug('Video autoplay prevented on load:', error);
      });
    }
  });
})();

