#!/bin/bash
# Cloudflare D1 Setup Migration
# Run: npx wrangler d1 execute twilit_db --file=migrations/001_init.sql

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
