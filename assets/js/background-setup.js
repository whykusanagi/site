/**
 * Background Image Setup
 * Sets body background image using env-config for URL conversion
 */

(function() {
  'use strict';

  function setupBackground() {
    // Wait for env-config to be available
    if (typeof window.AssetConfig === 'undefined') {
      // Retry after a short delay
      setTimeout(setupBackground, 50);
      return;
    }

    const body = document.body;
    if (!body) return;

    // Skip if page already has video background or custom parallax background
    if (body.classList.contains('has-video-bg') || 
        document.getElementById('bg-video') || 
        document.querySelector('.parallax-bg')) {
      return;
    }

    // Convert the background image URL using env-config
    const bgUrl = window.AssetConfig.convertUrl('https://s3.whykusanagi.xyz/hero_image.png');
    
    // Set background image on body::after pseudo-element
    const style = document.createElement('style');
    style.id = 'dynamic-background';
    style.textContent = `
      body::after {
        background-image: url('${bgUrl}') !important;
      }
    `;
    
    // Remove existing dynamic background style if present
    const existing = document.getElementById('dynamic-background');
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(style);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBackground);
  } else {
    setupBackground();
  }
})();

