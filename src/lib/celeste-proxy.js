/**
 * Celeste API Proxy - Shared logic for local dev and Cloudflare Workers
 * Handles secure proxying of Celeste API requests
 */

/**
 * Build messages array from request data
 */
function buildMessages(requestData) {
  const messages = [];
  const { message, system_prompt, history } = requestData;

  // Add system prompt if provided
  if (system_prompt) {
    messages.push({
      role: 'system',
      content: system_prompt
    });
  }

  // Add conversation history
  if (Array.isArray(history)) {
    for (const histMsg of history) {
      if (histMsg.sender === 'user') {
        messages.push({
          role: 'user',
          content: histMsg.text || ''
        });
      } else if (histMsg.sender === 'celeste') {
        messages.push({
          role: 'assistant',
          content: histMsg.text || ''
        });
      }
    }
  }

  // Add current message
  if (message) {
    messages.push({
      role: 'user',
      content: message.trim()
    });
  }

  return messages;
}

// Browser origins allowed to call the proxy. CORS is reflected only for these,
// and requests from any other Origin are rejected — this blocks other websites
// from abusing the paid LLM backend from a visitor's browser. Non-browser clients
// send no Origin; rate limiting (a Cloudflare rule) is the complementary control.
const ALLOWED_ORIGINS = [
  'https://whykusanagi.xyz',
  'https://www.whykusanagi.xyz',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Handle proxy request - works in both Node.js and Cloudflare Workers
 */
export async function handleProxyRequest(request, env) {
  const cors = corsHeaders(request);
  try {
    // Reject browser requests from origins not on the allowlist.
    const reqOrigin = request.headers.get('Origin');
    if (reqOrigin && !ALLOWED_ORIGINS.includes(reqOrigin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Validate required environment variables
    const agentKey = env.CELESTE_AGENT_KEY || env.CELESTE_API_KEY;
    const agentId = env.CELESTE_AGENT_ID;
    const agentBaseUrl = env.CELESTE_AGENT_BASE_URL;

    if (!agentKey || !agentId || !agentBaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Proxy configuration missing' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors
        }
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    // Validate message
    if (!requestData.message || !requestData.message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    // Build messages array
    const messages = buildMessages(requestData);

    // Call Celeste API
    const celesteUrl = `${agentBaseUrl}/api/v1/chat/completions`;
    const celesteResponse = await fetch(celesteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 400,
        temperature: 0.7,
        stream: false
      })
    });

    // Handle Celeste API errors
    if (celesteResponse.status === 401) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed - invalid API key' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    if (celesteResponse.status === 503) {
      return new Response(
        JSON.stringify({ error: 'Celeste service is currently unavailable' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    if (!celesteResponse.ok) {
      return new Response(
        JSON.stringify({ error: `API error: ${celesteResponse.status}` }),
        {
          status: celesteResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }

    // Return successful response
    const celesteData = await celesteResponse.json();
    return new Response(JSON.stringify(celesteData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors
      }
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  }
}

