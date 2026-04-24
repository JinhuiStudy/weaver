-- Sprint 9 · Content moderation · report queue.
-- 한 유저가 같은 agent 를 중복 신고하는 건 idempotent — PK (agent_id, reporter_user_id)
-- reason 은 고정 enum 으로 시작 (nsfw · malware · phishing · spam · other).
-- review_* 컬럼은 운영자가 채움 (Sprint 9+ 수동 처리).

CREATE TABLE IF NOT EXISTS agent_reports (
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  reporter_user_id  TEXT NOT NULL REFERENCES users(id),
  reason            TEXT NOT NULL,
  detail            TEXT,
  created_at        INTEGER NOT NULL,
  reviewed_at       INTEGER,
  reviewed_by       TEXT REFERENCES users(id),
  action            TEXT,                  -- 'dismissed' | 'hidden' | 'deleted'
  PRIMARY KEY (agent_id, reporter_user_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_open
  ON agent_reports (created_at DESC) WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_agent
  ON agent_reports (agent_id, created_at DESC);

-- `agents.moderation_hidden` defaults to 0 — flips to 1 when an admin takes
-- action. hidden agents disappear from public lookups / feeds / search even
-- though the row still exists (so forks still resolve for genealogy, but new
-- traffic can't discover them).
ALTER TABLE agents ADD COLUMN moderation_hidden INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_agents_visible
  ON agents (visibility, moderation_hidden);
