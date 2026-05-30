/**
 * Cloudflare Pages Function: /api/counter
 * 
 * Setup (Cloudflare Dashboard):
 * 1. Create KV namespace: "TWILIT_KV"
 * 2. In Pages > Settings > Functions > KV bindings:
 *    Variable name: TWILIT_KV
 *    KV namespace: (select the one you created)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const page = url.searchParams.get('page') || 'global';

  try {
    // Check if TWILIT_KV is bound; if not, fallback to local counter
    if (env.TWILIT_KV) {
      const key = `counter:${page}`;
      const current = await env.TWILIT_KV.get(key);
      const count = current ? parseInt(current) + 1 : 1;
      await env.TWILIT_KV.put(key, count.toString());
      return new Response(JSON.stringify({ count, page }), { headers: corsHeaders });
    } else {
      // Fallback: use a persistent Durable Object or just return static
      return new Response(JSON.stringify({ count: 1, page, note: 'KV not configured' }), { headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}
