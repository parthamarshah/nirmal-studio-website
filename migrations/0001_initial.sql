-- /admin backend schema (v1 Phase 2).
--
-- Deliberately small. This database holds work-in-progress and operational records
-- only — it is NEVER the source of truth for site content. Published content lives in
-- git (content/*.json), which is what the site builds from. If this database were lost
-- entirely, the live site would be unaffected and only unpublished drafts would go.

-- One row per editable thing, holding the draft currently being worked on.
-- `doc` is the same JSON shape that would be written to content/, so publishing is a
-- copy rather than a translation — no second schema to keep in sync.
CREATE TABLE IF NOT EXISTS drafts (
  id           TEXT PRIMARY KEY,           -- 'site' | 'founders' | 'project:<slug>'
  doc          TEXT NOT NULL,              -- JSON
  base_sha     TEXT,                       -- git blob sha this draft was branched from,
                                           -- so a stale draft can be detected at publish
  updated_at   INTEGER NOT NULL,           -- epoch ms
  updated_by   TEXT                        -- which session saved it
);

-- Every publish, so "what changed and when" is answerable, and so Undo has something
-- concrete to restore rather than guessing at git history.
CREATE TABLE IF NOT EXISTS publishes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_sha    TEXT NOT NULL,
  branch        TEXT NOT NULL,
  summary       TEXT NOT NULL,             -- human-readable list of what changed
  files         TEXT NOT NULL,             -- JSON array of content/ paths touched
  parent_sha    TEXT,                      -- the commit replaced, for Undo
  created_at    INTEGER NOT NULL,
  undone_at     INTEGER                    -- set when an Undo reverted this publish
);

-- Login attempt records, used for the lockout. Keyed by IP, plus a global bucket so an
-- attacker rotating IPs still trips a limit.
CREATE TABLE IF NOT EXISTS login_attempts (
  bucket        TEXT PRIMARY KEY,          -- 'ip:<addr>' | 'global'
  failures      INTEGER NOT NULL DEFAULT 0,
  first_failed  INTEGER NOT NULL,
  locked_until  INTEGER                    -- epoch ms; NULL when not locked
);

-- Issued sessions. A signed cookie alone would be unrevocable, so each session is also
-- recorded here — that is what makes "change the PIN" able to log everyone out, and
-- what lets a stolen cookie be killed without rotating the signing secret.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  user_agent    TEXT,
  revoked_at    INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);

-- Contact-tap counts (plan Phase 3 item 4). Aggregated per day and per action rather
-- than one row per tap: this is for "is anyone actually contacting us", not analytics,
-- and it keeps the table from growing without bound on the free tier.
CREATE TABLE IF NOT EXISTS taps (
  day     TEXT NOT NULL,                   -- 'YYYY-MM-DD'
  action  TEXT NOT NULL,                   -- 'whatsapp' | 'call' | 'email' | 'map'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, action)
);
