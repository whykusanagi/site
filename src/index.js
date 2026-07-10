/**
 * Celeste AI Widget - API Key Injector & Proxy
 * Cloudflare Worker for whykusanagi.xyz
 *
 * This worker:
 * 1. Injects environment variables into HTML pages
 * 2. Proxies /api/chat requests to Celeste API (credentials stay secret)
 */

import { handleProxyRequest } from './lib/celeste-proxy.js';
import { handleCountdownPresets, handleCountdownGenerate } from './lib/countdown-api.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;

      // Countdown API endpoints
      if (url.pathname === '/api/countdown/presets') {
        return handleCountdownPresets(request);
      }
      if (url.pathname === '/api/countdown/generate') {
        return handleCountdownGenerate(request);
      }

      // Handle proxy requests (works on any domain)
      if (url.pathname === '/api/chat') {
        return handleProxyRequest(request, env);
      }

      // Health check endpoint
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'Celeste Widget API Proxy',
          timestamp: Date.now() / 1000,
          configured: Boolean(env.CELESTE_AGENT_ID && env.CELESTE_AGENT_BASE_URL)
        }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Favicon: redirect to the R2 logo so we don't have to add a <link rel="icon">
      // to every page's <head>. ponytail: reuse the existing idol-sig asset.
      if (url.pathname === '/favicon.ico') {
        return Response.redirect('https://s3.whykusanagi.xyz/art/idol_signature/idol-sig.png', 301);
      }

      // Only process requests to whykusanagi.xyz for HTML injection
      if (!hostname.includes('whykusanagi.xyz')) {
        return fetch(request);
      }

      // Only process HTML requests
      // Check Accept header first (browser requests usually specify text/html)
      const accept = request.headers.get('accept') || '';
      const isHtmlRequest = accept.includes('text/html') ||
                           request.method === 'GET' &&
                           (url.pathname === '/' ||
                            url.pathname.endsWith('.html') ||
                            !url.pathname.includes('.'));

      if (!isHtmlRequest) {
        // Pass through non-HTML requests (CSS, JS, images, etc.)
        return fetch(request);
      }

      // Fetch the original response
      let response = await fetch(request);

      // Don't inject scripts into error responses (404, 403, 500, etc.)
      if (!response.ok && response.status !== 304) {
        return response;
      }

      // Check if response is HTML
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return response;
      }

      // Make response mutable by reading and rewriting it
      let html = await response.text();

      // ✅ SECURITY: Do NOT inject credentials into client-side code
      // The /api/chat proxy endpoint handles authentication server-side
      // Widget automatically detects production environment and uses same-origin proxy
      // No client-side credentials needed!

      // Add security headers to response
      const securityHeaders = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.whykusanagi.xyz https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https://s3.whykusanagi.xyz https://i.imgur.com; media-src https://s3.whykusanagi.xyz; connect-src 'self' blob: https://s3.whykusanagi.xyz https://cloudflareinsights.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com https://s3.whykusanagi.xyz; frame-src https://open.spotify.com https://embed.music.apple.com; frame-ancestors 'self';",
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'X-XSS-Protection': '1; mode=block'
      };

      // Apply security headers to response
      const newHeaders = new Headers(response.headers);
      Object.entries(securityHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      // Return response with security headers (no HTML modification needed)
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      // Log error for debugging
      console.error('Celeste Worker Error:', error);

      // Return original response on error (fail gracefully)
      return fetch(request);
    }
  },

  /**
   * Optional: Handle scheduled events for monitoring/logging
   * This could be used to verify the worker is running
   */
  async scheduled(event, env, ctx) {
    console.log('Celeste Worker scheduled event triggered');
    // Could send monitoring data, health checks, etc.
  }
};
