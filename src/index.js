/**
 * Celeste AI Widget - API proxy (Cloudflare Worker for whykusanagi.xyz)
 *
 * API-only. The apex HTML/assets are served directly by the whykusanagi Pages
 * project (custom domain); security headers come from the Pages `_headers` file.
 * This Worker is routed on `whykusanagi.xyz/api/*` and only handles:
 *   - /api/chat                 → proxy to Celeste API (credentials stay secret)
 *   - /api/countdown/presets    → countdown preset data
 *   - /api/countdown/generate   → countdown URL builder
 *   - /api/health               → health check
 * (favicon is handled by Pages `_redirects`.)
 */

import { handleProxyRequest } from './lib/celeste-proxy.js';
import { handleCountdownPresets, handleCountdownGenerate } from './lib/countdown-api.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/countdown/presets') {
        return handleCountdownPresets(request);
      }
      if (url.pathname === '/api/countdown/generate') {
        return handleCountdownGenerate(request);
      }
      if (url.pathname === '/api/chat') {
        return handleProxyRequest(request, env);
      }
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'Celeste Widget API Proxy',
          timestamp: Date.now() / 1000,
          configured: Boolean(env.CELESTE_AGENT_ID && env.CELESTE_AGENT_BASE_URL)
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // The route is scoped to /api/*, so non-API paths never reach here (Pages
      // serves them). Return a clean 404 for anything unexpected that slips through.
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Celeste Worker Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event, env, ctx) {
    console.log('Celeste Worker scheduled event triggered');
  }
};
