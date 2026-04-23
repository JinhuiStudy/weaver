# NEXT — 실행 계획 (Evolving Agent Network · 유저 $0 · 운영 $0)

> **버전**: 2026-04-23 (v3 · Sprint 0 완료 반영)
> **제품 한 줄**: Fork agents. Rate them. They evolve. Free forever.
> **타겟**: 개인 개발자 · 메이커 · 학생 · 크리에이터 (기업 아님)
> **예산**: 운영 $0 · 유저 $0 · 개인 개발도구는 예외 (ADR-006 §6)
> **런칭 목표**: Week 14 = 2026-W30

이 문서가 **유일한 실행 계획**. Sprint 중 다른 md (ROADMAP, WEEK-1-PLAN, VISION) 는 히스토리/참조용.

---

## 0. 현재 상태 (2026-04-23)

### 라이브
- **Runtime**: https://weaver-runtime.jinhuistudy.workers.dev (Hono + D1 + Cron + Workers AI)
- **Web (빌더)**: https://weaver-web.jinhuistudy.workers.dev (RR7 · Workers SSR)

### 작동 중
- NL → graph intent (`POST /api/compose`, Workers AI + stub fallback)
- Run 생성 · 그래프 스냅샷 영속 (`POST /api/runs` → D1, session 필수)
- Cron 자동 실행 (`* * * * *` · state machine step)
- 빌더 캔버스 (드래그 · 연결 · 인스펙터 · Yjs 로컬 영속)
- **Sprint 0 완료** — GitHub OAuth · 멀티테넌트 · per-user rate limit (D1-D5, 커밋 `8078af8`)

### 테스트 (2026-04-23 기준)
- core 단위 145 · runtime 단위 55 · runtime integration 33
- web e2e 44 (login · builder · regression)
- 총 277개 — 전부 green

### 계정/시크릿
- Cloudflare: `cleanjhpark@gmail.com` · Account `590c528f54d00045d032196dd7333d9b`
- D1 `weaver-db` (`a07b1744-70c6-4e5c-9934-41ac804a24cc`)
- Doppler Free · `weaver` project (dev + prd: `GITHUB_OAUTH_CLIENT_ID/SECRET`, `WEAVER_SESSION_SECRET`, `WEAVER_KEK`)
- GitHub: `JinhuiStudy/weaver` (private)

### Sprint 0 배포 전 유저 작업
1. **GitHub OAuth app callback URL 교체** (기존 `/auth/github/callback` on runtime → web):
   - Dev app: `http://localhost:5173/auth/github/callback`
   - Prd app: `https://weaver-web.jinhuistudy.workers.dev/auth/github/callback`
2. **프로덕션 wrangler secret 주입**:
   ```bash
   for K in GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET WEAVER_SESSION_SECRET WEAVER_KEK; do
     doppler secrets get $K --plain --project weaver --config prd |
       pnpm --filter=@weaver/runtime exec wrangler secret put $K
   done
   ```
3. `pnpm --filter=@weaver/runtime exec wrangler deploy`
4. `pnpm --filter=@weaver/web exec wrangler deploy --env production` (RUNTIME_URL=runtime worker URL)

---

## 1. $0 예산 선언 (운영 + 유저)

### 운영 ($0 확정)
Weaver 가 Cloudflare/Axiom/Resend 등에 내는 **월 청구서 $0**.

### 유저 ($0 확정)
유저가 Weaver 를 쓰는 모든 기본 기능이 **0 달러**. 회원가입 · 실행 · fork · 구독 전부 무료.

### 유저 비용 0 의 기술 근거

| 유저 행동 | 소요 자원 | 유저 비용 | 누가 부담 |
|---|---|---|---|
| 회원가입 (GitHub OAuth) | GitHub API · D1 write 1 | $0 | Weaver (Free tier) |
| Agent 만들기 | D1 writes ~3 | $0 | Weaver |
| Agent 실행 (기본 LLM) | Workers AI neurons | $0 | Weaver (공유 pool) |
| Agent fork | D1 copy | $0 | Weaver |
| Agent 구독 / feed 읽기 | Worker req 1 | $0 | Weaver |
| 외부 API 연동 (GitHub, RSS, 공개 웹) | 외부 free tier | $0 | 외부 서비스 |
| **Workers AI 한도 초과 시** | BYOK **선택** or 대기열 | $0 또는 유저 선택 | 유저가 선택할 때만 |

### 유저당 일일 cap (Free tier 공정 공유)

| 자원 | 유저당 일 cap | 전체 Free tier | 감당 가능 DAU |
|---|---|---|---|
| Worker req | 100 | 100,000 | 1,000 |
| Workers AI neurons | 50 (≈ 10 run) | 10,000 | 200 |
| D1 writes | 100 | 100,000 | 1,000 |

**병목: Workers AI** → 200 DAU 넘으면 대기열 또는 유저 선택 BYOK 안내.

### 사용 중 / 도입 예정 Free tier

| 자원 | 무료 한도 | 현재 | 도입 Sprint |
|---|---|---|---|
| Workers | 100k req/day | <0.1% | ✅ |
| D1 | 5GB · 100k writes/day | <0.01% | ✅ |
| Cron | 분당 1회 | 100% | ✅ |
| Workers AI (추론) | 10k neurons/day | 0 | ✅ |
| Workers AI (embeddings bge-base) | 10k neurons/day (공유 풀) | 0 | W5 |
| KV | 100k reads/day · 1k writes/day | 0 | W5 (rate limit) |
| Vectorize | 30M queried · 5M stored dims/월 | 0 | W8 (agent 검색) |
| Analytics Engine | 100k writes/day | 0 | W4 (cost), W12 (trending) |
| R2 | 10GB · 1M reads/월 | 0 | W11 (D1 백업) |
| Axiom | 500GB/월 trace | 0 | W7 |
| Sentry | 5k event/월 | 0 | W8 optional |
| Resend | 3,000 mail/월 | 0 | W13 (v2 알림 이메일) |
| Doppler | 5 user · 3 config | 1 user · 2 config | ✅ |
| GitHub | private repo + 2k min Actions/월 | <5% | ✅ |

---

## 2. 14주 계획 (Week 6-14 · W1-5 완료)

| W | 주제 | Sprint | Exit |
|---|---|---|---|
| W1-4 | ✅ 코어 런타임 + 캔버스 + D1 + Cron + 배포 | - | Done |
| W5 | ✅ Sprint 0 · 인증 + per-user rate limit | 5 commits | GitHub 로그인 · 익명 401 · 유저당 cap — 완료 `8078af8` |
| W6 | Sprint 1 · Agent 공개 모델 · 슬러그 URL · Fork | 2 PR | `weaver-web.../@user/agent-slug` 작동 · Fork 버튼 |
| W7 | Sprint 2 · OTEL + 비용 추적 + Run viewer | 2 PR | Axiom trace · run 페이지에 waterfall |
| W8 | Sprint 3 · Agent feed · 구독 · 검색 (Vectorize) | 2 PR | RSS-style feed · 검색 · tag |
| W9 | Sprint 4 · Feedback 수집 + Genealogy tree | 2 PR | 👍/👎 · fork 트리 시각화 |
| W10 | Sprint 5 · Evolution 엔진 Phase 1 (mutation) | 1 PR | Cron 이 매일 top agent 프롬프트 변형 |
| W11 | Sprint 6 · Shadow eval + v2 suggestion UI | 2 PR | 다이프 뷰어 + 수락/거절 + rollback |
| W12 | Sprint 7 · Trending · Explore · Discover | 1 PR | 인기 / 신규 / 카테고리 페이지 |
| W13 | Sprint 8 · Landing + Invite-only seed | 1 PR | 100 크리에이터 초대 · 100 seed agents |
| W14 | Sprint 9 · 퍼블릭 런칭 | 1 PR | HN · PH · Reddit 게시 |

---

## Sprint 0 ✅ 완료 (2026-04-23)

커밋: `04fe53c` (D1) · `23a73a7` (D2) · `bbd4f06` (D3) · `5a70d3f` (D4) · `8078af8` (D5).

### 달성
- D1 migration `0003_auth.sql` — users · orgs · memberships · rate_limits + `agent_runs.created_by_user_id`
- `packages/core`: ULID (Web Crypto) · HandleSchema · User/Org/Membership valibot
- `apps/runtime/src/auth/`: jwt (HS256) · github (OAuth) · upsert · routes (`/auth/github` + callback + logout) · middleware (session 주입 + requireAuth) · rate-limit (per-user daily cap)
- `apps/web`: `/login` 페이지 · `useSession` hook · workers `/auth|/api` 프록시 · 헤더 avatar/로그아웃
- 테스트: core 145 · runtime unit 55 · runtime integration 33 · web e2e 44 → **277 total · all green**

### Sprint 1 로 이월된 항목
- **Hard guard**: 빌더 loader 에서 익명 → `/login` redirect. 로컬 dev 에서 runtime 워커를 상시 띄우는 방식을 정하면 재활성화 (loader side fetch 가능하게).
- **Workers AI neurons 추적**: Sprint 2 (W7) observability 와 합쳐서. 현재 `rate_limits.resource` 는 `runs` 만 사용.
- **BYOK 흐름**: WEAVER_KEK 은 주입해뒀지만 아직 encrypt/decrypt 없음 — 유저 setting 페이지와 함께.

---

## Sprint 1 — Public Agent · Slug URL · Fork (W6, 5일)

### 왜
진화 네트워크의 기반. Agent 가 공개 URL 을 갖고 fork 가능해야 genealogy · evolution 이 의미 있음.

### D1 스키마 (migration `0004_agents.sql`)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,                  -- URL 용, e.g. "hn-summary"
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',  -- 'public' | 'unlisted' | 'private'
  fork_of_agent_id TEXT REFERENCES agents(id),
  category TEXT,                       -- 'productivity' | 'news' | 'research' | ...
  current_version_id TEXT,             -- 뒤에 FK 설정
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (creator_user_id, slug)
);
CREATE INDEX idx_agents_creator ON agents (creator_user_id, updated_at);
CREATE INDEX idx_agents_fork ON agents (fork_of_agent_id);
CREATE INDEX idx_agents_category ON agents (category, updated_at) WHERE visibility = 'public';

CREATE TABLE agent_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  version INTEGER NOT NULL,
  definition_json TEXT NOT NULL,       -- graph snapshot (nodes/edges/prompts)
  prompt_hash TEXT NOT NULL,           -- 중복 감지
  created_at INTEGER NOT NULL,
  UNIQUE (agent_id, version)
);
CREATE INDEX idx_versions_agent ON agent_versions (agent_id, version);

ALTER TABLE agent_runs ADD COLUMN agent_version_id TEXT REFERENCES agent_versions(id);
```

### Tasks

- **D1**: `agents`/`agent_versions` 마이그레이션 · "save as agent" API (`POST /api/agents`) · creator 자동 연결
- **D2**: 공개 라우트 `/@{handle}/{slug}` (RR7 route) · SSR 로 agent 카드 · 그래프 미리보기
- **D3**: Fork 버튼 · 서버 action (`POST /api/agents/:id/fork`) · 새 agent row (slug 충돌 시 `-2`) · fork_of_agent_id 기록
- **D4**: 빌더 UI "Save as..." 다이얼로그 (slug, description, category) · 기존 build 에서 연결
- **D5**: E2E (스크린샷 5장: public agent 페이지 · fork 모달 · 포크 후 빌더 · 내 profile 리스트 · private toggle)

### Exit
- `/@jinhui/hn-summary` 공개 URL 동작
- Fork 누르면 `/@you/hn-summary` 로 복제 (nodes · prompts 같음, runs 는 분리)
- 프로필 페이지 `/@{handle}` 에 내 agent 목록

---

## Sprint 2 — OTEL + 비용 추적 + Run Viewer (W7, 5-7일)

### 왜
- Weaver 의 원래 테제 "관측성은 구조"
- 진화 엔진이 fitness 계산에 쓸 데이터 기반
- 유저에게 "얼마나 썼는지" 보여줘 공정 공유 이해

### Tasks

- **D1-2**: Minimal OTEL SDK (`packages/observability/src/tracer.ts`) · `gen_ai.*` 속성 · 각 step 1 span
- **D3**: Axiom OTLP/HTTP exporter · 10초 배치 flush · `scheduled()` 종료 시 `ctx.waitUntil(flush())`
- **D4**: Cost attribution — Analytics Engine 에 `neurons` 카운터 쓰기 (유저별 · agent 별)
- **D5**: Run Viewer (`/runs/:runId` 페이지) · timeline waterfall · span 클릭 시 prompt/response 패널
- **D6-7**: 테스트 · 프로덕션 smoke

### Exit
- 1 run → Axiom 5-15 spans
- `/runs/:runId` 에서 각 span 지연 · 비용 · prompt JSON 확인
- 유저 profile 에 "오늘 남은 neurons" 표시

---

## Sprint 3 — Agent Feed · Subscribe · Search (W8, 5-7일)

### 왜
Agent 를 "구독 가능한 미디어" 로 만드는 핵심.

### D1 스키마 (migration `0005_feed.sql`)

```sql
CREATE TABLE agent_outputs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  agent_version_id TEXT NOT NULL REFERENCES agent_versions(id),
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  output_json TEXT NOT NULL,
  published_at INTEGER NOT NULL
);
CREATE INDEX idx_outputs_agent ON agent_outputs (agent_id, published_at DESC);

CREATE TABLE subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, agent_id)
);
CREATE INDEX idx_subs_agent ON subscriptions (agent_id);
```

### Tasks

- **D1**: Agent 실행 완료 시 output → `agent_outputs` 에 기록 (run 의 terminal output node)
- **D2**: JSON feed endpoint `/@{handle}/{slug}/feed.json` · RSS-compatible JSON Feed 1.1 스펙
- **D3**: Subscribe 버튼 · `/@me/feed` 페이지 (구독한 agent 들 최근 출력 통합 타임라인)
- **D4**: Vectorize 인덱스 생성 · agent description + category 를 bge-base 로 임베딩 · 유사 agent 추천
- **D5**: 검색 바 (`/search?q=...`) · 임베딩 검색 + 키워드 매칭 하이브리드
- **D6-7**: 모바일 반응형 · 스크린샷 · 테스트

### Exit
- `/@jinhui/hn-summary/feed.json` → 최근 10 output JSON
- 다른 유저가 구독 · `/@me/feed` 에 타임라인
- 검색에서 "news summary" 입력 → 관련 agent 3개 이상 반환

---

## Sprint 4 — Feedback · Genealogy Tree (W9, 5일)

### D1 스키마 (migration `0006_feedback_genealogy.sql`)

```sql
CREATE TABLE agent_feedback (
  run_id TEXT PRIMARY KEY REFERENCES agent_runs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,             -- 1 = thumbs up, -1 = thumbs down
  comment TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_feedback_agent ON agent_feedback (user_id, created_at);
```

### Tasks

- **D1**: Run viewer 에 👍/👎 버튼 · post-run toast "How was this?"
- **D2**: Aggregate view — agent 카드에 like ratio · 최근 30일 fitness 차트
- **D3**: Genealogy tree 시각화 (d3-hierarchy 또는 자체 구현) — root agent · branches · fork 카운트
- **D4**: `/@{handle}/{slug}/genealogy` 페이지 (tree + 리스트)
- **D5**: 스크린샷 (트리 UI · 피드백 토스트) · E2E

### Exit
- Run 종료 후 👍 탭 → feedback row 기록
- Agent 페이지에서 "like ratio 82%" 표시
- Genealogy tree 에 "이 agent 는 @alex/hn-digest 에서 fork 됨 → 3명이 나에서 다시 fork"

---

## Sprint 5 — Evolution 엔진 Phase 1: Mutation (W10, 5-7일)

### 왜
Agent 가 "자가 진화" 하는 핵심 차별점. ADR-008 참조.

### D1 스키마 (migration `0007_evolution.sql`)

```sql
CREATE TABLE agent_evolutions (
  id TEXT PRIMARY KEY,
  agent_version_id TEXT NOT NULL REFERENCES agent_versions(id),
  strategy TEXT NOT NULL,              -- 'concise' | 'specific' | 'cot' | 'role' | 'format' | 'crossover'
  candidate_definition TEXT NOT NULL,
  shadow_case_count INTEGER NOT NULL DEFAULT 0,
  shadow_wins INTEGER NOT NULL DEFAULT 0,
  shadow_ties INTEGER NOT NULL DEFAULT 0,
  shadow_losses INTEGER NOT NULL DEFAULT 0,
  win_rate REAL,
  suggested_at INTEGER,
  accepted_at INTEGER,
  accepted_version_id TEXT REFERENCES agent_versions(id),
  rejected_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_evo_agent ON agent_evolutions (agent_version_id, created_at);
```

### Tasks

- **D1**: Fitness 계산 함수 (`packages/core/src/fitness.ts`) · 최소 샘플 10 run 필터 · unit test
- **D2**: Nightly cron (현재 `* * * * *` 외에 23:00 UTC daily job 분리 · 또는 본 cron 안에서 분기)
- **D3-4**: Mutation 5 strategies · Workers AI 로 prompt rewrite · `agent_evolutions` 에 저장만 (아직 UI 노출 X)
- **D5**: Shadow eval 샘플러 · 지난 24h input 2개로 원본 vs candidate pairwise compare · Llama 3B 로 judge
- **D6**: 비용 가드 — cron 시작 시 잔여 neurons 체크 · <30% 면 skip
- **D7**: 관리자 dashboard (`/admin/evolutions`) — 생성된 candidate · win_rate 모니터

### Exit
- 매일 23:00 UTC 에 top-4 agent 에 대해 5 mutation × 2 candidate = 10 candidate 생성
- Shadow eval 수행 · 60%+ win_rate 은 suggested_at 마크
- 일 neurons 소비 <5,000 (Free 50%)

---

## Sprint 6 — Shadow Eval UI + v2 Suggestion (W11, 5-7일)

### Tasks

- **D1**: Diff viewer (원본 vs candidate prompt · react-diff-viewer)
- **D2**: Suggestion 배너 (agent 대시보드) — "🧬 Your agent evolved. 17% better."
- **D3**: Accept 플로우 — `accepted_at` 기록 · 새 `agent_versions` row 생성 · `agents.current_version_id` 업데이트
- **D4**: Shadow 10% 라우팅 옵션 — 10% 트래픽을 candidate 로 · 7일 후 자동 평가
- **D5**: Rollback 자동화 — 수락 후 7일간 fitness -20%+ 이면 자동 v1 로 복원
- **D6-7**: 테스트 · 프로덕션 smoke · 스크린샷

### Exit
- 수락된 v2 가 agent 의 current version 으로 교체
- Shadow 10% 옵션 선택 시 실제로 10% 분기
- 악화 시 자동 rollback 동작 확인

---

## Sprint 7 — Trending · Explore · Discovery (W12, 3-5일)

### Tasks

- **D1**: Analytics Engine 에 쓴 execution 카운터 · 최근 24h · 7d · 30d 집계 쿼리
- **D2**: `/explore` 페이지 — trending · 신규 · 카테고리별 그리드
- **D3**: Agent 카드 개선 (like ratio · fork count · subscriber count · neurons 비용)
- **D4**: 태그 시스템 (creator 지정 + category 자동)
- **D5**: `/explore/trending` · `/explore/new` · `/explore/:category` 라우트

### Exit
- `/explore` 에 인기 agent 10개 (지난 7일 실행 수 기준)
- 각 agent 카드에 genealogy hint ("from @alex" 같은)
- 검색/카테고리 필터 작동

---

## Sprint 8 — Landing + Invite-only Seed (W13, 5일)

### Tasks

- **D1**: `/` 루트 페이지 재작성 — "Fork agents. Rate them. They evolve. Free forever." hero + 실제 공개 agent 3개 미리보기
- **D2**: `/waitlist` 페이지 · 이메일 수집 (D1 `waitlist_signups`) · Resend 환영 메일
- **D3**: Invite code 시스템 (초기 100명) · `/login` 에 invite code 입력
- **D4**: Seed agents 10개 직접 제작 (HN 요약 · GitHub 트렌드 · RSS 주간 브리프 등) · Featured 배너
- **D5**: 첫 20명 초대 · 피드백 수집 · 긴급 패치

### Exit
- `/` 랜딩 · waitlist 수집 작동
- 20명 베타 유저 · 10 seed agents 라이브
- 피드백 기반 Sprint 9 우선순위 조정

---

## Sprint 9 — Public Launch (W14, 5일)

### Tasks

- **D1**: Rate limit · 모더레이션 (LLM 기반 report 자동 처리) · 부하 시뮬레이션 (k6 scripts)
- **D2**: Landing 개선 · 3분 데모 영상 (Loom) · documentation basics (`/docs` 단순 페이지)
- **D3**: HN post 초안 · ProductHunt 준비 · Reddit r/LocalLLaMA/r/SideProject 드래프트
- **D4**: **HN 런칭** (화요일 오전 9 PT 최적) · 실시간 응답 · 긴급 이슈 대응
- **D5**: 회고 · 다음 분기 로드맵 초안

### Exit
- HN front page 도달 (stretch goal)
- 500+ waitlist → 100+ 활성 가입
- Production 안정 (downtime 0)
- Post-launch backlog 정리

---

## 백로그 (런칭 후)

| 항목 | Sprint | 이유 |
|---|---|---|
| Crossover 진화 (ADR-008 Phase 2) | +2주 | Mutation 안정화 후 |
| 실시간 협업 (y-websocket on Fly.io) | +1주 | 팀 쓰는 유저 생기면 |
| Custom LLM 선택 + BYOK UI | +2일 | 파워유저 요청 오면 |
| Time-travel 디버깅 | +1주 | 복잡한 agent 만들수록 필요 |
| Agent 템플릿 마켓플레이스 (카테고리별) | +1주 | 검색/discovery 개선 |
| Creator tip (GitHub Sponsors / Stripe Connect) | +2주 | 첫 유료 플랜 실험 |
| Enterprise tier (SSO · audit · private) | +1달 | B2B 관심 오면 |
| Mobile app (PWA) | +1주 | 모바일 유저 늘면 |
| 다국어 (영어 · 일본어) | +1주 | 해외 유입 생기면 |
| Agent network protocol (cross-platform) | +2주 | MCP 등 표준과 통합 |

---

## 기술 부채 (짬날 때)

- [ ] Monaco 통합 (현재 textarea) — 대형 프롬프트용
- [ ] D1 migration CLI 체계화 (`wrangler d1 migrations`)
- [ ] `apps/web/wrangler.jsonc` 의 `vars.VALUE_FROM_CLOUDFLARE` 레거시 제거
- [ ] `apps/docs-site` 빈 디렉토리 정리 (W13 전엔 touch 안 할 것)
- [ ] GitHub Actions e2e 자동화 (현재 수동)
- [ ] `canvas.ts` Zustand 스냅샷 deep clone 최적화 (노드 100+)
- [ ] `example/design/` 과 `tokens.css` 동기 자동 검사 스크립트
- [ ] Cold start 분석 · Workers 번들 <1MB 유지 모니터링

---

## 의사결정 대기

### D1 · 타겟 유저 narrow 확인
- [ ] "개인 개발자 · 메이커 · 학생 · 크리에이터" 정확?
- 아니면 "AI 취미자" · "자동화 얼리어답터" 같은 더 좁은 정의?
- 권장: **현재 정의 유지**, 런칭 후 실 유저 segment 를 보고 narrow.

### D2 · 수익 모델 우선순위
첫 유료 실험을 뭐로?
1. **GitHub Sponsors** (가장 간단, 즉시 가능)
2. **Creator tip** (Stripe Connect · 구현 2주)
3. **Enterprise** (SSO · audit · 구현 1달+)
- 권장: **런칭 후 3개월 지표 보고 결정**. 지금은 Option 1만 준비.

### D3 · Workers AI 고갈 시 기본 UX
- 옵션 A: 대기열 ("지금 바쁩니다, 5분 후 시도")
- 옵션 B: BYOK 유도 ("Claude API 키 넣으면 즉시 실행")
- 옵션 C: Paid $5 전환
- 권장: **A + B 병행**. 파워유저는 B, 일반 유저는 A.

### D4 · 첫 100명 초대 경로
- [ ] 본인 트위터/링크드인?
- [ ] Korean dev 커뮤니티 (geeknews, okky)?
- [ ] 영문 (HN ShowHN Week 14 전 조기 피드백)?
- 권장: **한국 커뮤니티 W13, 영문 W14 공식 런칭**.

### D5 · 커스텀 도메인
- [ ] `weaver.dev` ($12/년) vs `*.jinhuistudy.workers.dev`
- 권장: **W14 런칭 직전**에 판단. $12 는 ADR-006 에서 예외 인정하는 선 — 브랜딩 가치 > 비용.

### D6 · 모더레이션 초기 방침
- [ ] 모든 public agent 에 auto-LLM 모더레이션?
- [ ] Report 버튼만 두고 reactive?
- 권장: **둘 다**. LLM 은 위험 단어/카테고리만 차단 (NSFW, malware, phishing), 나머지는 report 기반.

### D7 · 진화 엔진 기본 ON vs OFF
- [ ] 새 유저의 agent 에 기본 "Evolution enabled" ON?
- [ ] OFF 로 두고 설정에서 켜게?
- 권장: **ON (opt-out)**. 제품 차별점을 기본 경험으로.

---

## 업데이트 규칙

- Sprint 완료 시 해당 섹션 삭제 · README/ROADMAP 반영 · `memory/` 갱신
- 신규 우선순위는 Sprint 0 상단에 추가 (간단 메모 후 다음 sprint 때 재평가)
- `$0` 예산 표는 Sprint 완료 시 소진률 재측정
- ADR 변경 시 이 문서의 관련 섹션도 업데이트

---

## 참고 링크

- [`ROADMAP.md`](./ROADMAP.md) — 14주 히스토리 뷰
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 4 레이어 설계
- [`decisions/ADR-007-evolving-agent-network.md`](./decisions/ADR-007-evolving-agent-network.md) — 피봇 전체 맥락
- [`decisions/ADR-008-evolution-engine.md`](./decisions/ADR-008-evolution-engine.md) — 진화 엔진 알고리즘
- [`decisions/ADR-006-free-tier-first.md`](./decisions/ADR-006-free-tier-first.md) — $0 정책 (유저 포함)
- [`specs/`](../specs/) — 노드 타입 · observability · eval DSL
- GitHub OAuth: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- Axiom OTLP: https://axiom.co/docs/endpoints/opentelemetry
- Cloudflare Vectorize: https://developers.cloudflare.com/vectorize/
- Cloudflare Analytics Engine: https://developers.cloudflare.com/analytics/analytics-engine/
- JSON Feed spec: https://www.jsonfeed.org/
