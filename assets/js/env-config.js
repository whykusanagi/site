/**
 * Environment Configuration & Asset URL Management
 *
 * Handles environment detection and asset URL rewriting for dev vs production
 *
 * Environments:
 * - Local/Docker Dev: Uses public R2 dev endpoint (no CORS restrictions)
 * - Production: Uses custom domain with CORS/anti-hotlink restrictions
 */

(function() {
  // Asset endpoint configuration
  const ENDPOINTS = {
    dev: 'https://pub-99b382d99f3c49f49fbbd88da5b3ce92.r2.dev',
    production: 'https://s3.whykusanagi.xyz'
  };

  /**
   * Detect current environment
   * - Production: whykusanagi.xyz domain
   * - Dev/Local: localhost, 127.0.0.1, Docker container hostnames, internal IPs
   */
  function detectEnvironment() {
    const hostname = window.location.hostname;

    // Production detection
    if (hostname.includes('whykusanagi.xyz')) {
      return 'production';
    }

    // Dev/local detection
    if (hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname.includes('192.168') || hostname.includes('10.') ||
        hostname.includes('172.')) {  // Docker bridge network (172.17.0.0/16, 172.18.0.0/16)
      return 'dev';
    }

    // Default to production if unknown
    return 'production';
  }

  /**
   * Get appropriate endpoint for current environment
   */
  function getAssetEndpoint() {
    const env = detectEnvironment();
    return ENDPOINTS[env];
  }

  /**
   * Convert production asset URL to dev URL if in dev environment
   */
  function convertAssetUrl(url) {
    if (typeof url !== 'string') return url;

    const env = detectEnvironment();

    // If in production, keep original URL
    if (env === 'production') {
      return url;
    }

    // If in dev and URL points to production endpoint, convert to dev
    if (env === 'dev' && url.includes('s3.whykusanagi.xyz')) {
      return url.replace('https://s3.whykusanagi.xyz', ENDPOINTS.dev);
    }

    // If already using dev endpoint, keep it
    if (url.includes('pub-99b382d99f3c49f49fbbd88da5b3ce92.r2.dev')) {
      return url;
    }

    return url;
  }

  /**
   * Rewrite all asset URLs in the page (img src, picture srcset, etc)
   * Runs automatically after DOM is ready
   */
  function rewriteAssetUrls() {
    const env = detectEnvironment();

    // Only rewrite if in dev environment
    if (env === 'production') {
      return;
    }

    // Rewrite img src attributes
    document.querySelectorAll('img[src*="s3.whykusanagi.xyz"]').forEach(img => {
      img.src = convertAssetUrl(img.src);
    });

    // Rewrite picture source srcset
    document.querySelectorAll('source[srcset*="s3.whykusanagi.xyz"]').forEach(source => {
      source.srcset = convertAssetUrl(source.srcset);
    });

    // Rewrite CSS background images
    document.querySelectorAll('[style*="s3.whykusanagi.xyz"]').forEach(el => {
      const style = el.getAttribute('style');
      const newStyle = style.replace(/https:\/\/s3\.whykusanagi\.xyz/g, ENDPOINTS.dev);
      el.setAttribute('style', newStyle);
    });
  }

  // Expose global functions for external use
  window.AssetConfig = {
    getEnvironment: detectEnvironment,
    getEndpoint: getAssetEndpoint,
    convertUrl: convertAssetUrl,
    rewrite: rewriteAssetUrls,
    ENDPOINTS: ENDPOINTS
  };

  // Auto-rewrite on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteAssetUrls);
  } else {
    rewriteAssetUrls();
  }

  // Log environment info (only in dev)
  const env = detectEnvironment();
  if (env === 'dev' && typeof console !== 'undefined') {
    console.log(
      `%c⚙️ Asset Config Loaded\n` +
      `Environment: ${env}\n` +
      `Endpoint: ${ENDPOINTS[env]}`,
      'color: #d94f90; font-weight: bold; padding: 4px 8px; background: #1a1a1a; border-radius: 4px;'
    );
  }
})();
