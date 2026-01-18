-- 민원
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  identity TEXT,
  content TEXT,
  created TEXT,
  fileName TEXT,
  fileKey TEXT
);

-- 건의
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  identity TEXT,
  content TEXT,
  created TEXT
);

-- 소개 페이지 데이터(agency/rank/department)
CREATE TABLE IF NOT EXISTS pages (
  page_key TEXT PRIMARY KEY,
  page_json TEXT NOT NULL,
  updated TEXT NOT NULL
);

-- 공지 데이터
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created TEXT NOT NULL
);

-- 유저 데이터
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uniqueCode TEXT NOT NULL,
  nickname TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt TEXT NOT NULL
);

ALTER TABLE complaints ADD COLUMN userId INTEGER;
ALTER TABLE suggestions ADD COLUMN userId INTEGER;

ALTER TABLE users ADD COLUMN agreed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN agreedAt TEXT;

ALTER TABLE complaints ADD COLUMN status TEXT NOT NULL DEFAULT '접수 중';
ALTER TABLE complaints ADD COLUMN statusUpdatedAt TEXT;

ALTER TABLE users ADD COLUMN discord_id TEXT;
ALTER TABLE users ADD COLUMN discord_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

ALTER TABLE notices ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL,
  actor_user_id INTEGER,
  actor_username TEXT,
  actor_nickname TEXT,
  actor_role TEXT,
  actor_discord_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  ua TEXT,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);

BEGIN;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt TEXT NOT NULL,
  agreed INTEGER NOT NULL DEFAULT 0,
  agreedAt TEXT,
  discord_id TEXT,
  discord_name TEXT,
  discord_last_verified_at TEXT
);

INSERT INTO users_new (
  id, nickname, username, passwordHash, role, createdAt,
  agreed, agreedAt, discord_id, discord_name, discord_last_verified_at
)
SELECT
  id, nickname, username, passwordHash, role, createdAt,
  agreed, agreedAt, discord_id, discord_name, discord_last_verified_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

COMMIT;

BEGIN;

CREATE TABLE complaints_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  content TEXT,
  created TEXT,
  fileName TEXT,
  fileKey TEXT,
  userId INTEGER,
  status TEXT NOT NULL DEFAULT '접수 중',
  statusUpdatedAt TEXT
);

INSERT INTO complaints_new (
  id, name, content, created, fileName, fileKey, userId, status, statusUpdatedAt
)
SELECT
  id, name, content, created, fileName, fileKey, userId, status, statusUpdatedAt
FROM complaints;

DROP TABLE complaints;
ALTER TABLE complaints_new RENAME TO complaints;

COMMIT;

BEGIN;

CREATE TABLE suggestions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  content TEXT,
  created TEXT,
  userId INTEGER
);

INSERT INTO suggestions_new (
  id, name, content, created, userId
)
SELECT
  id, name, content, created, userId
FROM suggestions;

DROP TABLE suggestions;
ALTER TABLE suggestions_new RENAME TO suggestions;

COMMIT;

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
