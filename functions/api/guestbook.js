/**
 * Cloudflare Pages Function: /api/guestbook
 * 
 * Setup (Cloudflare Dashboard):
 * 1. Create D1 database: "twilit_db"
 * 2. In Pages > Settings > Functions > D1 bindings:
 *    Variable name: DB
 *    D1 database: (select twilit_db)
 * 3. Run migration to create table:
 *    CREATE TABLE IF NOT EXISTS guestbook (
 *      id INTEGER PRIMARY KEY AUTOINCREMENT,
 *      name TEXT NOT NULL DEFAULT 'anonymous',
 *      message TEXT NOT NULL,
 *      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 *    );
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET: list latest messages
  if (request.method === 'GET') {
    if (!env.DB) {
      return new Response(JSON.stringify({ messages: [], note: 'D1 not configured' }), { headers: corsHeaders });
    }
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
      const { results } = await env.DB.prepare(
        'SELECT id, name, message, created_at FROM guestbook ORDER BY id DESC LIMIT ?'
      ).bind(limit).all();
      return new Response(JSON.stringify({ messages: results }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // POST: add new message
  if (request.method === 'POST') {
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not configured' }), { status: 503, headers: corsHeaders });
    }
    try {
      const body = await request.json();
      const name = (body.name || 'anonymous').slice(0, 50);
      const message = (body.message || '').slice(0, 500);
      if (!message.trim()) {
        return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers: corsHeaders });
      }
      const { meta } = await env.DB.prepare(
        'INSERT INTO guestbook (name, message) VALUES (?, ?)'
      ).bind(name, message).run();

      return new Response(JSON.stringify({
        success: true,
        id: meta.last_row_id,
        name,
        message,
        created_at: new Date().toISOString()
      }), { status: 201, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}
