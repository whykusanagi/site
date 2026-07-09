#!/usr/bin/env python3
"""
Celeste Widget API Proxy
Secure backend endpoint for Celeste widget chat functionality.

This proxy handles authentication with the Celeste AI endpoint so that
the browser never needs access to API credentials.

Environment Variables:
- CELESTE_AGENT_KEY: Secret API key for Celeste agent (required)
- CELESTE_AGENT_ID: Agent identifier (required)
- CELESTE_AGENT_BASE_URL: Base URL for Celeste agent (required)
- PORT: Port to run on (default: 5000)

Security Model:
- Browser makes requests to /api/chat (no credentials needed)
- Backend verifies request and calls Celeste API (credential stays secret)
- Browser never sees the API key
- Prevents credential theft via DevTools or Network inspection
"""

import os
import sys
import json
import requests
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger('CelesteProxy')

# Configuration from environment
CELESTE_AGENT_KEY = os.getenv('CELESTE_AGENT_KEY')
CELESTE_AGENT_ID = os.getenv('CELESTE_AGENT_ID')
CELESTE_AGENT_BASE_URL = os.getenv('CELESTE_AGENT_BASE_URL')
PORT = int(os.getenv('PORT', 5000))

# Validate configuration
def validate_config():
    """Validate that all required environment variables are set."""
    missing = []
    if not CELESTE_AGENT_KEY:
        missing.append('CELESTE_AGENT_KEY')
    if not CELESTE_AGENT_ID:
        missing.append('CELESTE_AGENT_ID')
    if not CELESTE_AGENT_BASE_URL:
        missing.append('CELESTE_AGENT_BASE_URL')

    if missing:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing)}")
        logger.error("The Celeste widget API proxy cannot start without these credentials.")
        return False

    logger.info("✅ Configuration validated")
    logger.info(f"   Agent ID: {CELESTE_AGENT_ID[:8]}...")
    logger.info(f"   Base URL: {CELESTE_AGENT_BASE_URL}")
    return True


class CelesteProxyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for Celeste API proxy."""

    def do_POST(self):
        """Handle POST requests to /api/chat."""
        # Parse path first
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/chat':
            self.handle_chat_request()
        elif parsed_path.path == '/api/health':
            self.handle_health_check()
        else:
            self.send_error(404, 'Endpoint not found')

    def do_GET(self):
        """Handle GET requests (health check)."""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/health':
            self.handle_health_check()
        else:
            self.send_error(404, 'Endpoint not found')

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_chat_request(self):
        """Handle POST /api/chat - proxy to Celeste AI."""
        try:
            # Read request body first (before sending any headers)
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, 'Empty request body')
                return

            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))

            # Extract message and history from request
            user_message = request_data.get('message', '').strip()
            history = request_data.get('history', [])
            system_prompt = request_data.get('system_prompt', '')

            if not user_message:
                self.send_error(400, 'Message required')
                return

            logger.info(f"📨 Received message: {user_message[:50]}...")

            # Build messages array for Celeste API
            messages = []

            if system_prompt:
                messages.append({
                    'role': 'system',
                    'content': system_prompt
                })

            # Add conversation history
            for hist_msg in history:
                if hist_msg.get('sender') == 'user':
                    messages.append({
                        'role': 'user',
                        'content': hist_msg.get('text', '')
                    })
                elif hist_msg.get('sender') == 'celeste':
                    messages.append({
                        'role': 'assistant',
                        'content': hist_msg.get('text', '')
                    })

            # Add current message
            messages.append({
                'role': 'user',
                'content': user_message
            })

            # Call Celeste API (credential stays secret!)
            celeste_response = self.call_celeste_api(messages)

            if celeste_response:
                # Return response to browser with CORS headers
                response_json = json.dumps(celeste_response)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                self.wfile.write(response_json.encode('utf-8'))
                logger.info("✅ Response sent to browser")
            else:
                self.send_error(500, 'Failed to get response from Celeste API')

        except json.JSONDecodeError:
            self.send_error(400, 'Invalid JSON in request body')
        except Exception as error:
            logger.error(f"❌ Error handling chat request: {error}")
            self.send_error(500, 'Internal server error')

    def call_celeste_api(self, messages):
        """Call the actual Celeste AI API with the secret credential."""
        try:
            url = f"{CELESTE_AGENT_BASE_URL}/api/v1/chat/completions"

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {CELESTE_AGENT_KEY}'  # ✅ Secret stays on server
            }

            payload = {
                'model': 'gpt-4o-mini',
                'messages': messages,
                'max_tokens': 400,
                'temperature': 0.7,
                'stream': False
            }

            logger.info(f"📤 Calling Celeste API: {url}")

            # Make request with 45 second timeout
            response = requests.post(url, json=payload, headers=headers, timeout=45)

            logger.info(f"📥 Celeste API response: HTTP {response.status_code}")

            if response.status_code == 401:
                logger.error("❌ Celeste API authentication failed (invalid key)")
                return {'error': 'Authentication failed - invalid API key'}

            if response.status_code == 503:
                logger.error("❌ Celeste API service unavailable")
                return {'error': 'Celeste service is currently unavailable'}

            if not response.ok:
                logger.error(f"❌ Celeste API error: HTTP {response.status_code}")
                return {'error': f'API error: {response.status_code}'}

            return response.json()

        except requests.exceptions.Timeout:
            logger.error("❌ Celeste API request timeout")
            return {'error': 'Request timeout - API took too long to respond'}
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Request error: {e}")
            return {'error': 'Failed to connect to Celeste API'}
        except Exception as e:
            logger.error(f"❌ Error calling Celeste API: {e}")
            return {'error': 'Internal error'}

    def handle_health_check(self):
        """Handle GET /api/health - return proxy status."""
        try:
            health_status = {
                'status': 'ok',
                'service': 'Celeste Widget API Proxy',
                'timestamp': time.time(),
                'agent_id': CELESTE_AGENT_ID[:8] + '...' if CELESTE_AGENT_ID else 'not configured'
            }

            response_json = json.dumps(health_status)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response_json.encode('utf-8'))
            logger.info("✅ Health check OK")

        except Exception as e:
            logger.error(f"❌ Health check error: {e}")
            self.send_error(500, 'Health check failed')

    def log_message(self, format, *args):
        """Override default logging to use our logger."""
        # Suppress default HTTP server logging
        pass


def run_proxy(host='0.0.0.0', port=PORT):
    """Start the proxy server."""
    logger.info(f"🚀 Starting Celeste Widget API Proxy on {host}:{port}")
    logger.info("   Endpoints:")
    logger.info("   - POST /api/chat (widget requests)")
    logger.info("   - GET /api/health (health check)")

    server = HTTPServer((host, port), CelesteProxyHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n⏹️  Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Celeste Widget API Proxy")
    logger.info("=" * 60)

    if not validate_config():
        sys.exit(1)

    run_proxy()
