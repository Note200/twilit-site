/**
 * Cloudflare Pages Function: /api/presence
 *
 * 暮色线地图的"此刻还有谁醒着"。
 *
 * 隐私设计（刻意做到最小的那一档）：
 *   - 只取 Cloudflare 提供的国家/城市与经纬度，**不记录 IP**，请求体也不解析
 *   - 经纬度四舍五入到 0.5°（约 55 公里），原始精度不落盘
 *   - 同一格点只保留一条记录（key 由格点哈希得到），不会随访问次数膨胀
 *   - expirationTtl = 3600：一小时后自动消失
 *   - 不返回任何可识别个体的字段（没有 IP、没有 UA、没有精确坐标）
 *
 * KV 绑定：TWILIT_KV（与 /api/counter 共用）
 */
export async function onRequest(context) {
  const { request, env } = context;
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const kv = env.TWILIT_KV;
  if (!kv) return json({ dots: [], note: 'KV not configured' });

  const cf = request.cf || {};
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').slice(0, n);

  // 0.5° 取整：只保留"大致在哪一片区域"
  const round5 = (v) => Math.round(Number(v) * 2) / 2;
  const lat = round5(cf.latitude);
  const lon = round5(cf.longitude);
  const hasGeo = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);

  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };

  /* ---------------- POST：记录"我在这里" ---------------- */
  if (request.method === 'POST') {
    if (!hasGeo) return json({ ok: false, note: 'no geolocation available' });
    const record = {
      lat,
      lon,
      city: clean(cf.city, 40),
      country: clean(cf.country, 40),
      t: Date.now()
    };
    try {
      await kv.put('presence:' + hash(lat.toFixed(1) + ',' + lon.toFixed(1)), JSON.stringify(record), {
        expirationTtl: 3600
      });
    } catch (e) {
      return json({ ok: false, note: 'kv write failed' });
    }
    return json({ ok: true, you: record });
  }

  /* ---------------- GET：取回所有仍亮着的点 ---------------- */
  try {
    const list = await kv.list({ prefix: 'presence:', limit: 40 });
    const values = await Promise.all(
      list.keys.map((k) => kv.get(k.name).catch(() => null))
    );
    const now = Date.now();
    const dots = [];
    for (const v of values) {
      if (!v) continue;
      try {
        const o = JSON.parse(v);
        // 双保险：KV 的 TTL 之外再按时间戳过滤一次
        if (o && isFinite(o.lat) && isFinite(o.lon) && now - o.t < 3600000) {
          dots.push({ lat: o.lat, lon: o.lon, city: o.city || '', country: o.country || '' });
        }
      } catch (e) { /* 跳过坏数据 */ }
    }
    return json({ dots, truncated: list.list_complete === false });
  } catch (e) {
    return json({ dots: [], note: 'kv read failed' });
  }
}
