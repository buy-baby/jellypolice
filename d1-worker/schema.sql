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
