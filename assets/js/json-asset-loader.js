/**
 * JSON Asset Loader - Converts S3 URLs in JSON data for dev vs production
 *
 * Automatically converts production s3.whykusanagi.xyz URLs to dev endpoint
 * in JSON data loaded via fetch, ensuring assets work in all environments
 */

(function() {
  /**
   * Convert asset URLs in an object (recursively)
   */
  function convertUrls(obj) {
    if (!window.AssetConfig) {
      // AssetConfig not loaded yet
      return obj;
    }

    if (typeof obj === 'string') {
      return window.AssetConfig.convertUrl(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => convertUrls(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const converted = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = convertUrls(obj[key]);
        }
      }
      return converted;
    }

    return obj;
  }

  /**
   * Fetch JSON and automatically convert asset URLs
   * Usage: fetchJSON('/path/to/data.json')
   */
  function fetchJSON(url) {
    return fetch(url)
      .then(response => response.json())
      .then(data => {
        // Wait for AssetConfig to be available
        if (window.AssetConfig) {
          return convertUrls(data);
        }
        // Retry after a short delay if AssetConfig not ready
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(convertUrls(data));
          }, 50);
        });
      });
  }

  // Expose global API
  window.JSONAssetLoader = {
    fetch: fetchJSON,
    convertUrls: convertUrls
  };

  // Also patch native fetch if we want automatic conversion
  // (optional - can be enabled if needed)
})();
