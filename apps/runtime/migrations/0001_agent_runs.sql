-- Week 4 — D1 agent_runs / run_history.
-- See docs/ARCHITECTURE.md §2. Cron pulls from `agent_runs` by
-- (status, next_step_at), advances one step via executor/step.ts, writes back.

CREATE TABLE IF NOT EXISTS agent_runs (
  id              TEXT PRIMARY KEY,           -- ULID / UUID
  tool_id         TEXT NOT NULL,
  tool_version    INTEGER NOT NULL,
  org_id          TEXT NOT NULL,
  status          TEXT NOT NULL,              -- pending|running|waiting_*|complete|failed
  input           TEXT NOT NULL,              -- JSON payload
  current_node_id TEXT,
  state           TEXT NOT NULL DEFAULT '{}', -- JSON (accumulated node outputs)
  next_step_at    INTEGER,                    -- Unix ms; NULL = run now
  retry_count     INTEGER NOT NULL DEFAULT 0,
  cost_usd_micro  INTEGER NOT NULL DEFAULT 0,
  trace_id        TEXT,                       -- Axiom join key
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

-- "Pickup" query: SELECT … WHERE status IN ('pending','running')
--   AND (next_step_at IS NULL OR next_step_at <= ?). Needs a compound index.
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
  span_id         TEXT,                       -- Axiom correlation
  error_message   TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_run ON run_history (run_id, created_at);
