// Cloudflare Pages Function for /api/chat.
// The Celeste chat is OFF for now — return a clean 503 "offline" for all methods.
// To bring chat back, replace this with the proxy logic (port of src/lib/celeste-proxy.js)
// and set the agent secrets as Pages environment variables.
export function onRequest() {
  return new Response(JSON.stringify({ error: 'Celeste chat is currently offline.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
