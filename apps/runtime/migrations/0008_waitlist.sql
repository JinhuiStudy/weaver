-- Sprint 8 · waitlist for the pre-launch invite flow.
-- email + source 한 쌍을 UNIQUE 로 → 같은 이메일이 여러 경로(home/help/waitlist
-- 직링크)에서 들어와도 집계 편하게 한 번씩 저장.
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'home',
  note        TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE (email, source)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created
  ON waitlist_signups (created_at DESC);
