-- Sprint 5 · Evolution engine candidates (ADR-008).
-- Each row is one mutated prompt proposal. The orchestrator fills in
-- `candidate_definition_json` + `strategy` + `suggested_at`; later a
-- shadow-eval pass populates the win/loss counters and `win_rate`.
-- Acceptance flips `accepted_at` and points `accepted_version_id` at the
-- resulting `agent_versions.id` (see Sprint 6 work).

CREATE TABLE IF NOT EXISTS agent_evolutions (
  id                         TEXT PRIMARY KEY,
  agent_version_id           TEXT NOT NULL REFERENCES agent_versions(id),
  strategy                   TEXT NOT NULL,
  candidate_definition_json  TEXT NOT NULL,
  shadow_case_count          INTEGER NOT NULL DEFAULT 0,
  shadow_wins                INTEGER NOT NULL DEFAULT 0,
  shadow_ties                INTEGER NOT NULL DEFAULT 0,
  shadow_losses              INTEGER NOT NULL DEFAULT 0,
  win_rate                   REAL,
  suggested_at               INTEGER,
  accepted_at                INTEGER,
  accepted_version_id        TEXT REFERENCES agent_versions(id),
  rejected_at                INTEGER,
  created_at                 INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evo_agent_version
  ON agent_evolutions (agent_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evo_suggested
  ON agent_evolutions (suggested_at DESC) WHERE suggested_at IS NOT NULL;
