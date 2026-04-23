-- Sprint 0 · D1 · auth (users / orgs / memberships / rate_limits)
-- See docs/NEXT.md Sprint 0 for schema rationale. 1 user = 1 default
-- personal org (slug "{handle}-personal") seeded on first GitHub login.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  github_id     INTEGER UNIQUE,
  handle        TEXT NOT NULL UNIQUE,
  email         TEXT,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

CREATE TABLE IF NOT EXISTS orgs (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  owner_user_id  TEXT NOT NULL REFERENCES users(id),
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON orgs (owner_user_id);

CREATE TABLE IF NOT EXISTS memberships (
  user_id     TEXT NOT NULL REFERENCES users(id),
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships (org_id);

-- Per-user daily cap. window_start is the Unix day bucket
-- (floor(Date.now() / 86_400_000)). Sparse — only rows for days
-- the user was actually active. 90-day retention sweep lives in cron.
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id       TEXT NOT NULL,
  resource      TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, resource, window_start)
);

-- Attribute each run to the user who started it (nullable during the
-- migration window; new inserts MUST populate it via the auth middleware).
ALTER TABLE agent_runs ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
