-- 福福外婆页的中转站数据库（Cloudflare D1）
-- 技能：k = "月龄|名称"，跟 Obsidian 里 12-工作台/育儿/技能清单.md 一一对应
CREATE TABLE IF NOT EXISTS skills (
  k     TEXT PRIMARY KEY,
  month INTEGER NOT NULL DEFAULT 0,
  name  TEXT    NOT NULL,
  dim   TEXT    NOT NULL DEFAULT '其他',
  ord   INTEGER NOT NULL DEFAULT 0,
  level TEXT    NOT NULL DEFAULT '不会',   -- 不会 / 会 / 熟练
  t     INTEGER NOT NULL DEFAULT 0,        -- 最后一次改等级的时间（毫秒）；两边都改了按后改的算
  by    TEXT    NOT NULL DEFAULT ''        -- 谁改的：桔子 / 外婆
);
-- 本周要点：只读，整份由工作台推上来
CREATE TABLE IF NOT EXISTS tips (
  ord   INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '其他',
  lo    INTEGER NOT NULL DEFAULT 0,
  hi    INTEGER NOT NULL DEFAULT 999,
  body  TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
-- 外婆改过什么：工作台同步时据此提醒桔子
CREATE TABLE IF NOT EXISTS log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  k      TEXT, name TEXT, before TEXT, after TEXT,
  t      INTEGER NOT NULL,
  by     TEXT NOT NULL DEFAULT '外婆'
);
CREATE INDEX IF NOT EXISTS log_t ON log (t);
