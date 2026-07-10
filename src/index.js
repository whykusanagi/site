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

      // --- Reverse-proxy everything else to the Pages origin ---
      // The apex is served by this Worker (not a Pages custom domain), so we
      // fetch content from the project's pages.dev URL and serve it. This is
      // what makes whykusanagi.xyz resolve without relying on the apex being a
      // Pages custom domain. PAGES_ORIGIN can be overridden via env for a rebuild.
      const PAGES_ORIGIN = env.PAGES_ORIGIN || 'https://site-45q.pages.dev';
      const originUrl = PAGES_ORIGIN + url.pathname + url.search;
      const response = await fetch(new Request(originUrl, request));

      // Only rewrite HTML responses (to add security headers); everything else
      // (CSS/JS/images) passes through untouched.
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return response;
      }

      // Add security headers to the HTML response
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
      // Drop hop-by-hop/encoding headers so the body isn't truncated: the origin's
      // content-length/content-encoding no longer match after the runtime handles the stream.
      newHeaders.delete('content-length');
      newHeaders.delete('content-encoding');

      // Return the proxied HTML with security headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      // Log error for debugging
      console.error('Celeste Worker Error:', error);

      // Fail gracefully by proxying straight to the Pages origin (no header rewrite)
      const u = new URL(request.url);
      const origin = env.PAGES_ORIGIN || 'https://site-45q.pages.dev';
      return fetch(new Request(origin + u.pathname + u.search, request));
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
