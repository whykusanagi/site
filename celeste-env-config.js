/**
 * Celeste Widget Environment Configuration
 *
 * This file loads Celeste widget configuration from environment variables
 * and makes them available to the widget via window object.
 *
 * Configuration MUST be provided before the widget initializes:
 * - Via window.CELESTE_AGENT_* variables (injected by server)
 * - Via constructor config when creating CelesteAgent instance
 *
 * NO HARDCODED DEFAULTS - All credentials must be provided at runtime
 */

(function() {
    'use strict';

    // Check if configuration is already available (e.g., injected by server)
    const hasConfiguration = !!(
        window.CELESTE_AGENT_KEY &&
        window.CELESTE_AGENT_ID &&
        window.CELESTE_AGENT_BASE_URL
    );

    if (hasConfiguration) {
        return;
    }

    // If not already configured, log a warning
    // Configuration MUST be injected by the server (Cloudflare Worker or Docker)
    console.warn('[Celeste] Configuration not found. Widget will require explicit config or injected environment variables.');
    console.warn('[Celeste] Make sure CELESTE_AGENT_KEY, CELESTE_AGENT_ID, and CELESTE_AGENT_BASE_URL are set.');

})();
