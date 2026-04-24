-- Sprint 4 · Feedback + genealogy (docs/NEXT.md Sprint 4).
-- One feedback row per (run_id, user_id). rating is -1 (👎) or 1 (👍).
-- Comment is optional · capped client-side at 280 chars.

CREATE TABLE IF NOT EXISTS agent_feedback (
  run_id       TEXT NOT NULL REFERENCES agent_runs(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  agent_id     TEXT NOT NULL REFERENCES agents(id),
  rating       INTEGER NOT NULL CHECK (rating IN (-1, 1)),
  comment      TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (run_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_agent
  ON agent_feedback (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user
  ON agent_feedback (user_id, created_at DESC);
