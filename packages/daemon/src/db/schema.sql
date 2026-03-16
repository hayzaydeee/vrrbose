-- Vrrbose SQLite schema
-- WAL mode enabled at runtime for append-heavy workloads

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other',
  stack       TEXT NOT NULL DEFAULT '[]',  -- JSON array
  description TEXT NOT NULL DEFAULT '',
  root_path   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id),
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,
  idle_threshold_ms   INTEGER NOT NULL DEFAULT 7200000,
  score               REAL,
  commit_count        INTEGER NOT NULL DEFAULT 0,
  file_churn          INTEGER NOT NULL DEFAULT 0,
  active_time_ms      INTEGER NOT NULL DEFAULT 0,
  summary             TEXT,
  sync_status         TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  session_id  TEXT REFERENCES sessions(id),
  type        TEXT NOT NULL,
  timestamp   INTEGER NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',  -- JSON
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_summaries (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  file_path     TEXT NOT NULL,
  edit_count    INTEGER NOT NULL DEFAULT 0,
  lines_added   INTEGER NOT NULL DEFAULT 0,
  lines_removed INTEGER NOT NULL DEFAULT 0,
  first_edit_at INTEGER NOT NULL,
  last_edit_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS capsules (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  session_id    TEXT REFERENCES sessions(id),
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  key_files     TEXT NOT NULL DEFAULT '[]',   -- JSON array
  decisions     TEXT NOT NULL DEFAULT '[]',   -- JSON array
  open_questions TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at    INTEGER NOT NULL,
  trigger       TEXT NOT NULL DEFAULT 'manual',
  sync_status   TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_project_id    ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id    ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type          ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp     ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_sync_status   ON events(sync_status);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id  ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at  ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_file_summaries_session ON file_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_capsules_project_id  ON capsules(project_id);
