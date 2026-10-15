-- Cloudflare D1 初始化迁移
-- 用法：npx wrangler d1 execute twilit_db --file=migrations/001_init.sql
-- 注意：这里是纯 SQL，不要放 shell 语法（历史版本开头的 #!/bin/bash 会让 sqlite3 报 unrecognized token: "#"）

CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'anonymous',
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT DEFAULT '',
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guestbook_created ON guestbook(created_at DESC);
CREATE INDEX idx_page_views_page ON page_views(page, viewed_at);
