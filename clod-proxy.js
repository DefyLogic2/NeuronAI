/**
 * clod-proxy.js — tiny local CORS proxy for Clod (and any OpenAI-compatible API)
 *
 * Run:  node clod-proxy.js
 * Then in NEURON select "Clod" — it will hit http://localhost:3099 instead of api.clod.io directly.
 *
 * Requires Node.js 18+ (uses built-in fetch). No npm install needed.
 */

const http = require('http');

const PORT = 3099;
const TARGET = 'https://api.clod.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Title',
};

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Read request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const url = TARGET + req.url;
  console.log(`[proxy] ${req.method} ${url}`);

  try {
    // Forward headers (strip host, keep auth + content-type)
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (req.headers['x-title'])       headers['X-Title']       = req.headers['x-title'];

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? body : undefined,
    });

    const responseBody = await upstream.arrayBuffer();

    res.writeHead(upstream.status, {
      ...CORS_HEADERS,
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(Buffer.from(responseBody));

    console.log(`[proxy] → ${upstream.status}`);
  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.writeHead(502, CORS_HEADERS);
    res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nClod CORS proxy running at http://127.0.0.1:${PORT}`);
  console.log(`Forwarding → ${TARGET}`);
  console.log('\nIn NEURON, the Clod provider is already set to use this proxy.');
  console.log('Just keep this terminal open while using the app.\n');
});
