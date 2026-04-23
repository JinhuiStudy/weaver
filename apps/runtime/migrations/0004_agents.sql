-- Sprint 1 · public agents + versioned graph snapshots.
-- See docs/NEXT.md Sprint 1 for rationale. An `agent` is the evolving
-- identity (slug, fork genealogy); an `agent_version` is an immutable
-- snapshot of the graph (nodes/edges/prompts) at a point in time —
-- so editing an agent mid-run never corrupts the in-flight execution.

CREATE TABLE IF NOT EXISTS agents (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL,
  creator_user_id     TEXT NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,
  description         TEXT,
  visibility          TEXT NOT NULL DEFAULT 'public',  -- 'public' | 'unlisted' | 'private'
  fork_of_agent_id    TEXT REFERENCES agents(id),
  category            TEXT,
  current_version_id  TEXT,                             -- FK filled after agent_versions insert
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  UNIQUE (creator_user_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents (creator_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_agents_fork ON agents (fork_of_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_category
  ON agents (category, updated_at) WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS agent_versions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  version         INTEGER NOT NULL,
  definition_json TEXT NOT NULL,       -- graph snapshot (nodes/edges/prompts)
  prompt_hash     TEXT NOT NULL,       -- content-addressed duplicate detection
  created_at      INTEGER NOT NULL,
  UNIQUE (agent_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_agent ON agent_versions (agent_id, version);

-- Every run now points at the exact agent_version it executed, not just the
-- agent — this is what lets fitness/eval aggregate results per prompt revision
-- instead of only per agent.
ALTER TABLE agent_runs ADD COLUMN agent_version_id TEXT REFERENCES agent_versions(id);
