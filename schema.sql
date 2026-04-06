-- Memos Database Schema (Consolidated)
-- Version: 2.0
-- Last Updated: 2026-04-06

-- Core Tables

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memo_tags (
  memo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (memo_id, tag_id),
  FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- User Authentication

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Share Feature

CREATE TABLE IF NOT EXISTS shares (
  share_id TEXT PRIMARY KEY,
  memo_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  password_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

-- Webhook Configuration

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  url TEXT,
  events TEXT,
  secret TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Indexes for Performance

CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_deleted_at ON memos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_memos_is_favorite ON memos(is_favorite);
CREATE INDEX IF NOT EXISTS idx_memos_is_archived ON memos(is_archived);
CREATE INDEX IF NOT EXISTS idx_memo_tags_memo_id ON memo_tags(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_tags_tag_id ON memo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);