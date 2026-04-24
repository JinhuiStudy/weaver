-- Sprint 3 · Agent feed + subscriptions.
-- An `agent_output` is the terminal payload a run emitted through its
-- output node. We materialise it into a dedicated table so the JSON Feed
-- endpoint can paginate cheaply without scanning agent_runs / run_history.
-- Only public/unlisted agents' outputs land here; private runs stay in
-- run_history only.

CREATE TABLE IF NOT EXISTS agent_outputs (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  agent_version_id  TEXT NOT NULL REFERENCES agent_versions(id),
  run_id            TEXT NOT NULL REFERENCES agent_runs(id),
  output_json       TEXT NOT NULL,
  published_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outputs_agent
  ON agent_outputs (agent_id, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outputs_run
  ON agent_outputs (run_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id     TEXT NOT NULL REFERENCES users(id),
  agent_id    TEXT NOT NULL REFERENCES agents(id),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_subs_agent ON subscriptions (agent_id);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id, created_at DESC);
