-- Week 4 · D1 agent_runs / run_history.
-- Cron selects by (status, next_step_at) and advances one step via
-- executor/step.ts. See docs/ARCHITECTURE.md 2.

CREATE TABLE IF NOT EXISTS agent_runs (
  id              TEXT PRIMARY KEY,
  tool_id         TEXT NOT NULL,
  tool_version    INTEGER NOT NULL,
  org_id          TEXT NOT NULL,
  status          TEXT NOT NULL,
  input           TEXT NOT NULL,
  current_node_id TEXT,
  state           TEXT NOT NULL DEFAULT '{}',
  graph_json      TEXT,
  next_step_at    INTEGER,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  cost_usd_micro  INTEGER NOT NULL DEFAULT 0,
  trace_id        TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_runs_pending
  ON agent_runs (status, next_step_at)
  WHERE status IN ('pending', 'running');

CREATE TABLE IF NOT EXISTS run_history (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  node_id         TEXT NOT NULL,
  node_type       TEXT NOT NULL,
  input           TEXT,
  output          TEXT,
  duration_ms     INTEGER,
  cost_usd_micro  INTEGER,
  span_id         TEXT,
  error_message   TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_run ON run_history (run_id, created_at);
