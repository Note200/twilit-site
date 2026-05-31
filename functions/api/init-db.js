/**
 * Cloudflare Pages Function: GET /api/init-db
 * One-time: creates required tables in D1
 */
export async function onRequest(context) {
  const { env } = context;

  if (!env.TWILIT_KV || !env.DB) {
    return new Response(JSON.stringify({ error: 'D1 or KV not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // Check if already initialized
    const booted = await env.TWILIT_KV.get('boot:v1');
    if (booted) {
      return new Response(JSON.stringify({ status: 'ok', message: 'already initialized' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS guestbook (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT 'anonymous',
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        ip_hash TEXT,
        user_agent TEXT DEFAULT '',
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook(created_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page, viewed_at)'),
    ]);

    await env.TWILIT_KV.put('boot:v1', new Date().toISOString());

    return new Response(JSON.stringify({ status: 'ok', message: 'database initialized' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
