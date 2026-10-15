/*
 * 福福外婆页的中转站（Cloudflare Worker + D1）
 *   GET  /api/state            外婆页读：技能、本周要点、福福生日、外婆最近改了什么
 *   POST /api/level {k,level}  外婆页改一项技能的等级（谁都能调，只能改等级）
 *   POST /api/sync             桔子的工作台插件推本地清单、拉外婆的改动（要 SYNC_TOKEN）
 * 两边都改了同一项：按改的时间，后改的算。
 */
const LEVELS = ['不会', '会', '熟练'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function readState(db, since) {
  const [s, t, m, l] = await db.batch([
    db.prepare('SELECT k, month, name, dim, level, t, by FROM skills ORDER BY ord'),
    db.prepare('SELECT title, topic, lo, hi, body FROM tips ORDER BY ord'),
    db.prepare('SELECT k, v FROM meta'),
    db.prepare('SELECT k, name, before, after, t, by FROM log WHERE t > ?1 ORDER BY t DESC LIMIT 50').bind(since || 0),
  ]);
  const meta = Object.fromEntries(m.results.map((r) => [r.k, r.v]));
  return { name: meta.name || '', birth: meta.birth || '', synced: +meta.synced || 0, skills: s.results, tips: t.results, log: l.results };
}

async function setLevel(req, db) {
  const { k, level } = await req.json().catch(() => ({}));
  if (typeof k !== 'string' || !LEVELS.includes(level)) return json({ error: '参数不对' }, 400);
  const row = await db.prepare('SELECT name, level FROM skills WHERE k = ?1').bind(k).first();
  if (!row) return json({ error: '没有这一项，可能刚被改名或删掉了，刷新一下' }, 404);
  if (row.level === level) return json({ ok: true, level });
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE skills SET level = ?2, t = ?3, by = '外婆' WHERE k = ?1").bind(k, level, now),
    db.prepare("INSERT INTO log (k, name, before, after, t, by) VALUES (?1, ?2, ?3, ?4, ?5, '外婆')").bind(k, row.name, row.level, level, now),
  ]);
  return json({ ok: true, level, t: now });
}

/* 工作台推上来整份清单：结构（月龄、名称、维度、顺序）以工作台为准；等级按 t 比较，后改的算；工作台里没有的删掉 */
async function sync(req, env) {
  const db = env.DB, auth = req.headers.get('Authorization') || '';
  if (!env.SYNC_TOKEN || auth !== `Bearer ${env.SYNC_TOKEN}`) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const skills = (Array.isArray(body.skills) ? body.skills : [])
    .filter((x) => x && typeof x.k === 'string' && x.name && LEVELS.includes(x.level));
  if (!skills.length) return json({ error: '技能清单是空的，没同步' }, 400);   // 防止读文件失败时把线上清空
  const sj = JSON.stringify(skills.map((x, i) => ({
    k: x.k, month: x.month | 0, name: String(x.name), dim: String(x.dim || '其他'), ord: i, level: x.level, t: Math.max(0, Math.floor(+x.t || 0)),
  })));
  const stmts = [
    db.prepare(`INSERT INTO skills (k, month, name, dim, ord, level, t, by)
      SELECT json_extract(value, '$.k'), json_extract(value, '$.month'), json_extract(value, '$.name'), json_extract(value, '$.dim'),
             json_extract(value, '$.ord'), json_extract(value, '$.level'), json_extract(value, '$.t'), '桔子'
      FROM json_each(?1) WHERE true
      ON CONFLICT(k) DO UPDATE SET month = excluded.month, name = excluded.name, dim = excluded.dim, ord = excluded.ord,
        level = CASE WHEN excluded.t > skills.t THEN excluded.level ELSE skills.level END,
        by    = CASE WHEN excluded.t > skills.t THEN '桔子' ELSE skills.by END,
        t     = MAX(excluded.t, skills.t)`).bind(sj),
    db.prepare("DELETE FROM skills WHERE k NOT IN (SELECT json_extract(value, '$.k') FROM json_each(?1))").bind(sj),
    db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('name', ?1), ('birth', ?2), ('synced', ?3)")
      .bind(String(body.name || ''), String(body.birth || ''), String(Date.now())),
  ];
  if (Array.isArray(body.tips)) {
    const tj = JSON.stringify(body.tips.filter((x) => x && x.title).map((x) => ({
      title: String(x.title), topic: String(x.topic || '其他'), lo: x.lo | 0, hi: Number.isFinite(+x.hi) ? +x.hi : 999, body: String(x.body || ''),
    })));
    stmts.push(db.prepare('DELETE FROM tips'));
    stmts.push(db.prepare(`INSERT INTO tips (ord, title, topic, lo, hi, body)
      SELECT key, json_extract(value, '$.title'), json_extract(value, '$.topic'), json_extract(value, '$.lo'), json_extract(value, '$.hi'), json_extract(value, '$.body')
      FROM json_each(?1)`).bind(tj));
  }
  await db.batch(stmts);   // 一个事务：要么全成，要么全不改
  return json(await readState(db, +body.since || 0));
}

export default {
  async fetch(req, env) {
    const { pathname, searchParams } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (pathname === '/api/state' && req.method === 'GET') return json(await readState(env.DB, +searchParams.get('since') || Date.now() - 30 * 864e5));
      if (pathname === '/api/level' && req.method === 'POST') return await setLevel(req, env.DB);
      if (pathname === '/api/sync' && req.method === 'POST') return await sync(req, env);
      if (pathname === '/') return json({ ok: true });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};
