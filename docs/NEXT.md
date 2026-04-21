# NEXT — 실행 계획 (단일 소스 · $0 고정)

> **버전**: 2026-04-22 · Week 1 완료 시점
> **원칙**: 고정 월 비용 **$0**. 새 유료 SaaS 도입 금지 (ADR-006).
> **범위**: 지금부터 런칭(Week 14, 2026-W30)까지 해야 할 모든 구현 · 승인 대기 · 기술 부채.
> **업데이트**: Sprint 완료 시 해당 섹션 제거 + README/ROADMAP 반영 + `memory/` 갱신.

이 문서가 **유일한 실행 계획**. Sprint 중 다른 md(ROADMAP/WEEK-1-PLAN)는 히스토리용.

---

## 0. 현재 상태 (2026-04-22)

### 라이브
- **Runtime**: https://weaver-runtime.jinhuistudy.workers.dev (Hono + D1 + Cron + Workers AI)
- **Web (빌더)**: https://weaver-web.jinhuistudy.workers.dev (RR7 Framework Mode · Workers SSR)

### 작동 중
- NL → graph intent (`POST /api/compose`, Workers AI binding + offline stub fallback)
- Run 생성 + 그래프 스냅샷 영속 (`POST /api/runs` → D1 `agent_runs`)
- Cron 자동 실행 (`* * * * *` · state machine step)
- 빌더 캔버스 (드래그 · 엣지 연결 · 인스펙터 valibot 검증 · Yjs+y-indexeddb 로컬 영속 · 단축키 버튼화)

### 테스트
- `packages/core` Vitest 100+
- `apps/runtime` Vitest 단위 37 + 통합 7 (vitest-pool-workers + miniflare D1)
- `apps/web` Playwright e2e 42 (스크린샷 커밋)

### 계정/시크릿
- Cloudflare: `cleanjhpark@gmail.com` · Account `590c528f54d00045d032196dd7333d9b`
- D1 `weaver-db` uuid `a07b1744-70c6-4e5c-9934-41ac804a24cc`
- Doppler Free plan · `weaver` project · dev config
- GitHub: `JinhuiStudy/weaver` (private)

### 프로덕션 E2E 검증된 run
`c325ba1e-b79b-483b-8557-d6c1b8dd19d8` — pending → running(in) → running(out) → complete (via real cron)

---

## 1. $0 예산 선언 — Sprint 마다 검증해야 하는 항목

런칭까지 **고정 월 비용 $0**. 모든 새 디펜던시/서비스는 아래 표를 통과해야 함.

### 사용 중인 Free tier (실제 한도)

| 서비스 | 플랜 | 무료 한도 | 현재 소진 | 비고 |
|---|---|---|---|---|
| Cloudflare Workers | Free | 100,000 req/day · CPU 10ms | <0.1% | 2 Workers |
| Cloudflare D1 | Free | 5GB · 5M reads/day · 100k writes/day | <0.01% | 1 DB (weaver-db) |
| Cloudflare Cron | Free | 분당 1회 | 100% of 1/min | `* * * * *` 고정 |
| Workers AI | Free | 10,000 neurons/day | 0 | `/api/compose` 빈도 낮음 |
| Cloudflare KV | Free | 100k reads/day · 1k writes/day | 0 | Sprint 0에서 추가 예정 |
| Analytics Engine | Free | 100k writes/day | 0 | Sprint 0·2 활용 |
| R2 | Free | 10GB · 1M reads/월 | 0 | Sprint 3에서 R2 payload 분리 |
| Doppler | Free | 5 user · 3 config | 1 user · 2 config | secrets 관리 |
| GitHub | Free (private) | 무제한 repo · 2000min Actions/월 | <1% | |
| Axiom | **예정** Free | 500GB/월 trace ingest | - | Sprint 2 |
| Sentry | **예정** Developer | 5k event/월 | - | Sprint 2 optional |
| Resend | **예정** Free | 3,000 mail/월 | - | Sprint 0.5 optional |

### 새 서비스 도입 체크리스트 (PR 단위)
- [ ] 무료 한도 명시 (수치 포함)
- [ ] 현재 프로젝트에서 예상 소진 (MAU 또는 req/일 기준 계산)
- [ ] 초과 시 대응 전략 (유료 전환 vs 기능 축소)
- [ ] ADR-006 트리거 조건과 정합성

### 유료 전환 트리거 (ADR-006 재검토)
1. Workers req 일일 80% 도달 → per-org rate limit 강화 먼저, 부족하면 Paid $5/월
2. D1 쓰기 한도 도달 → 배치 쓰기 패턴 먼저, Queues ($5/월) 는 최후
3. Resend 월 2,500 초과 → 자체 메일 (MailChannels 복구 or SES)
4. Workers AI neurons 초과 → 유저 BYOK 강제 (기본 LLM 사용 중단)

---

## 2. 우선순위 요약

| Sprint | 기간 | PR | 우선도 | 상태 |
|---|---|---|---|---|
| **0. 인증 · 멀티테넌트 · Rate limit** | 5일 | 2-3 | 🔴 최우선 (보안 리스크) | 대기 |
| 1. UI ↔ Runtime 루프 마무리 | 3-4일 | 1-2 | 🟠 High | 대기 |
| 2. OTEL + Trace Viewer | 5-7일 | 2-3 | 🟠 High (테제: 관측성) | 대기 |
| 3. Tool registry + HTTP built-in | 5일 | 2 | 🟡 Mid | 대기 |
| 4. BYOK UX + 모델 선택 | 2일 | 1 | 🟡 Mid | 대기 |
| 5. Eval α | 5-7일 | 2-3 | 🟡 Mid | 대기 |
| 백로그 (실시간 협업·Shadow deploy·Time-travel·docs-site·Launch) | - | - | ⚪ Later | - |

### 왜 이 순서
- **Sprint 0 먼저**: 익명 퍼블릭 상태에서 `/api/runs` 스팸 1회면 D1 writes 100k/day 고갈. 다른 모든 sprint 도 "org" 가 전제.
- **Sprint 1 다음**: 지금 Runtime 배포됐지만 빌더 UI 가 `/api/compose`·`/api/runs` 를 완전히 소비 못 함. 이 루프 닫기 전엔 관측성 붙여도 볼 run 자체가 거의 없음.
- **Sprint 2 (OTEL)**: Weaver 테제("관측성은 구조"). 런칭 demo에 필수.
- **Sprint 3 (Tool registry)**: 실전 사례(환불·Slack 알림 등) 에 필요. OTEL 위에 올려야 각 툴 호출이 추적됨.
- **Sprint 4 (BYOK)**: Workers AI 품질로 초기 데모는 충분. 유저 확보 후 Claude/GPT 연결 필요.
- **Sprint 5 (Eval)**: 런칭 핵심 차별점. Tool registry + OTEL 완성 후 올려야 비용/정확도 계산 가능.

---

## Sprint 0 — 인증 · 멀티테넌트 · Rate Limit 🔴 **최우선**

### 0.1 근거
현재 익명 퍼블릭 노출. 3 공격 벡터:
- `/api/runs` 스팸 → D1 writes 100k/day 고갈
- `/api/compose` 스팸 → Workers AI 10k neurons/day 고갈
- HTTP 전체 스팸 → Workers 100k req/day 고갈

BYOK(Sprint 4), Eval(Sprint 5) 도 org 단위 격리 전제.

### 0.2 선택 ($0 유지)

| 방식 | 평가 | 결정 |
|---|---|---|
| Cloudflare Access | 50 user free, 외부 유저 CF 계정 필요 → 퍼블릭 SaaS 불가 | ❌ |
| Supabase Auth | 50k MAU free, 새 vendor 2원화 | ❌ |
| Clerk / Auth0 | 유료 전환 리스크 · 벤더 락 | ❌ |
| **GitHub OAuth (직접)** | 무제한 $0 · 타겟(dev/ops)과 일치 · 0 의존성 | ✅ **Primary** |
| Email Magic Link (Resend Free) | 3,000 mail/월 | ✅ Optional (Day 5 이후) |
| Passkey/WebAuthn | 무제한, 공수 큼 | 📌 Phase 2 |

**세션**: JWT HS256 + HttpOnly 쿠키 (stateless). 별도 세션 스토어 불필요.

**Cross-origin**: `weaver-web` 이 `weaver-runtime` 을 **서버 측에서 프록시** (쿠키의 JWT → `X-Weaver-Session` 헤더로 전달). 브라우저는 web 만 호출.

### 0.3 데이터 모델

#### `migrations/0003_auth.sql`
```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  github_id     INTEGER UNIQUE,
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS orgs (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  owner_user_id   TEXT NOT NULL REFERENCES users(id),
  plan            TEXT NOT NULL DEFAULT 'free',   -- free | byok
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id      TEXT NOT NULL REFERENCES users(id),
  org_id       TEXT NOT NULL REFERENCES orgs(id),
  role         TEXT NOT NULL,                      -- owner | admin | editor | viewer
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships (org_id);

CREATE TABLE IF NOT EXISTS magic_tokens (
  token         TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  consumed_at   INTEGER,
  created_at    INTEGER NOT NULL
);

-- BYOK (Sprint 4 에서 채움)
CREATE TABLE IF NOT EXISTS user_secrets (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  provider      TEXT NOT NULL,
  label         TEXT NOT NULL,
  ciphertext    TEXT NOT NULL,
  iv            TEXT NOT NULL,
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_secrets_org_provider ON user_secrets (org_id, provider);
```

#### `migrations/0004_ownership.sql`
```sql
ALTER TABLE agent_runs ADD COLUMN created_by TEXT;
```

### 0.4 OAuth 플로우

```
Browser → weaver-web /auth/github (state 쿠키 발급) → 302 github.com/login/oauth/authorize
         → GitHub → weaver-web /auth/callback?code&state
         → POST github /login/oauth/access_token  { access_token }
         → GET github /user  → upsert users/orgs/memberships in D1
         → sign JWT(HS256, { sub:user_id, org:org_id, exp:+7d })
         → Set-Cookie weaver_session=<jwt>; HttpOnly; Secure; SameSite=Lax
         → 302 /app
```

**보안**:
- `state` 32 bytes random (CSRF 방어)
- `oauth_state` 쿠키: `HttpOnly; Secure; SameSite=Lax; path=/auth; max-age=600`
- `weaver_session` 쿠키: `HttpOnly; Secure; SameSite=Lax; path=/; max-age=604800`

### 0.5 API 계약

#### `weaver-web` (RR7 server routes)
| Method · Path | 역할 |
|---|---|
| `GET /auth/github` | OAuth authorize 302 |
| `GET /auth/callback` | code 교환 · JWT 발급 · 302 /app |
| `GET /auth/magic?token=X` | 매직링크 토큰 소비 (Sprint 0.5) |
| `POST /auth/magic/request` | 이메일로 토큰 발송 (Sprint 0.5) |
| `POST /auth/logout` | 쿠키 clear · 204 |
| `GET /api/me` | 세션 정보: `{ user, org, memberships }` |

#### `weaver-runtime` middleware
```ts
app.use('/api/*', async (c, next) => {
  const jwt = c.req.header('x-weaver-session');
  if (!jwt) return c.json({ error: 'unauthorized' }, 401);
  const claims = await verifyJwt(jwt, c.env.WEAVER_SESSION_SECRET);
  if (!claims) return c.json({ error: 'invalid session' }, 401);
  c.set('session', claims);
  await next();
});
```

`POST /api/runs` 는 `body.org_id` 무시, `c.var.session.org` 사용 (요청 본문 신뢰 금지).

### 0.6 Rate Limiting

- **익명 (헬스체크/랜딩만 허용)**: IP 기반 KV bucket, 10 req/분
- **인증 org**: Analytics Engine counter, plan=free 기준 1,000 runs/일
- **Workers AI**: org 단위 neurons 누적, 1,000 neurons/day (Free의 10%)

초과 시 429 + `Retry-After`.

### 0.7 Secrets (Doppler 주입)

| 이름 | 생성 | 용도 |
|---|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | github.com/settings/developers | OAuth dev/prod App 2개 |
| `GITHUB_OAUTH_CLIENT_SECRET` | 동상 | 동상 |
| `WEAVER_SESSION_SECRET` | `openssl rand -base64 32` | JWT HS256 |
| `WEAVER_KEK` | `openssl rand -base64 32` | user_secrets AES-GCM 암호화 (Sprint 4) |
| `RESEND_API_KEY` | resend.com (Sprint 0.5) | magic link |

```bash
doppler secrets set GITHUB_OAUTH_CLIENT_ID=... -p weaver -c dev
doppler secrets set GITHUB_OAUTH_CLIENT_SECRET=... -p weaver -c dev
doppler secrets set WEAVER_SESSION_SECRET=$(openssl rand -base64 32) -p weaver -c dev
doppler secrets set WEAVER_KEK=$(openssl rand -base64 32) -p weaver -c dev
```

### 0.8 Day-by-Day (5일)

#### Day 1 — Migration · JWT · Doppler
- **Red (Vitest)**: `signJwt/verifyJwt` 라운드트립 (valid · expired · tampered)
- **Green**: `apps/runtime/src/auth/jwt.ts` (Web Crypto HMAC-SHA256)
- Migration `0003_auth.sql` + `0004_ownership.sql` 작성
- 로컬 D1 적용 (miniflare) → 리모트 적용 (dry-run 먼저)
- Doppler secrets 4개 주입 (GitHub OAuth 는 Day 2)

#### Day 2 — GitHub OAuth
- GitHub OAuth App **2개** 생성 (dev: localhost:8787, prod: weaver-web.jinhuistudy.workers.dev)
- **Red (통합)**: `/auth/callback` 플로우 MSW 로 github.com mock
- **Green**: `apps/web/app/routes/auth.github.tsx`, `auth.callback.tsx`
- `upsertUserFromGithub(db, ghUser)` D1 함수 (users + 기본 org + membership 한번에)
- 세션 쿠키 발급 · 로그아웃
- 로컬에서 실제 GitHub OAuth 수동 테스트

#### Day 3 — Runtime middleware · /api/me
- **Red**: `/api/runs` 401 · 세션 있을 때 org 주입 · body override 방지
- **Green**: Hono middleware · `c.var.session`
- `/api/me` 엔드포인트 (web 서버 라우트)
- 기존 익명 테스트 전체 "세션 주입" 모드로 재작성

#### Day 4 — Frontend
- **Red (Playwright)**: `/login` 렌더 · "Sign in with GitHub" 버튼 · RR7 loader 가드
- **Green**:
  - `/login` 페이지 (GitHub 버튼, 이메일 입력은 Sprint 0.5)
  - `useSession()` hook (SWR `/api/me`)
  - 아바타 뱃지 · 로그아웃 버튼
  - `/builder/:id`, `/tools/:id/runs/:runId` loader 에 세션 가드 추가
- **스크린샷 4장** 눈 검증: /login · /app · 빌더(세션) · 401 UI

#### Day 5 — Rate limit · 배포 · 스모크
- KV 바인딩 `RATE` 추가 (wrangler.jsonc)
- `apps/runtime/src/ratelimit.ts` sliding window
- 프로덕션 Doppler 주입 · 배포
- 실제 GitHub 로그인 → `/api/me` 확인 → `/api/runs` 실행 → 리모트 D1 row 에 `created_by`, `org_id` 기록 확인
- README / NEXT.md / ROADMAP 업데이트 · 커밋

### 0.9 Exit Criteria
- [ ] 익명 `/api/runs` → 401
- [ ] GitHub 로그인 후 동일 호출 → 200, row `created_by`/`org_id` 정확
- [ ] `/api/me` 세션 정보 반환
- [ ] 로그아웃 → `/api/me` 401
- [ ] Rate limit: 분당 10회 초과 시 429
- [ ] 유닛 + 통합 + e2e 전부 그린
- [ ] 스크린샷 4장 커밋

### 0.10 $0 검증

| 요소 | 소진 예측 (100 MAU) | Free 한도 | 여유 |
|---|---|---|---|
| OAuth redirect (GitHub) | 500/월 | 무제한 | ∞ |
| JWT 발급 (`/auth/callback`) | 500/월 | Worker 3M/월 | ×6,000 |
| `/api/me` 세션 검증 | 10k/월 | Worker 3M/월 | ×300 |
| D1 auth upsert | 600/월 | 3M writes/월 | ×5,000 |
| KV rate limit reads | 5k/월 | 3M reads/월 | ×600 |
| Resend mail (Sprint 0.5) | 200/월 | 3k/월 | ×15 |

**결론**: 1,000 MAU 까지 $0 유지. 그 전에 Sprint 5 (Eval) 완료 후 런칭 ≤ 예상.

---

## Sprint 1 — UI ↔ Runtime 루프 마무리

### 1.1 왜
Runtime 배포됐지만 빌더에서 `/api/compose` · `/api/runs` 를 풀 플로우로 쓰지 못함. 이 루프 닫아야 "AI 로 만들고 돌린다" 기본기 완성.

### 1.2 Task

#### 1.1 Compose DiffPreview UI
- **Red (Playwright)**: 빌더 상단 NL 입력창 · "Generate" 버튼 · 응답 시 diff 모달에 added nodes/edges 렌더 · 수락 후 캔버스 반영
- **Green**:
  - `apps/web/app/components/canvas/ComposePrompt.tsx`
  - `apps/web/app/lib/compose.ts` — `fetch('/api/compose')` (서버 loader 경유해 runtime 프록시)
  - Diff 모달 · 수락 시 Zustand `addNodes`/`addEdges` + Yjs sync
- URL 설정 일반화: `VITE_RUNTIME_URL` (base) → `/api/runs`, `/api/compose`
- **스크린샷 3장**: 입력 전 · 응답 후 diff · 수락 후 캔버스

#### 1.2 Run 상태 실시간 폴링
- 현재 `/tools/:id/runs/:runId` 는 loader 1회 fetch
- **Red**: pending → running → complete 3 스냅샷 eval
- **Green**:
  - Runtime: `GET /api/runs/:id` 추가 (session-scoped)
  - Web: SWR 폴링 2초 간격, status terminal(`complete|failed`) 시 멈춤
- **스크린샷 3장**: 상태 전환

#### 1.3 실행 실패 경로 UI
- Migration `0005_run_errors.sql`: `agent_runs.error_message TEXT`
- `executor/agent.ts` try/catch → `status='failed'` + `error_message` 저장
- 빨간 배너 + "다시 실행" 버튼 (새 run 생성)
- **스크린샷**: 실패 상태 UI

### 1.3 Exit
- 빌더에서 "환불 에이전트 만들어줘" → diff 수락 → Run 클릭 → 상태 실시간 반영 → complete 또는 failed 표시.

### 1.4 $0 검증
- 폴링 2초 간격, 평균 3회/run. 1,000 run/일 → 3k req/일 (Worker 100k/일 의 3%)
- `GET /api/runs/:id` D1 read 1회/폴링 → 3k read/일 (5M/일 의 0.06%)

**결론**: 여유 충분.

---

## Sprint 2 — OTEL + Trace Viewer

### 2.1 왜
Weaver 테제("관측성은 구조"). 런칭 demo 에 필수. 이 sprint 없이 Tool registry 를 올리면 실제 LLM/HTTP 호출이 블랙박스.

### 2.2 Task

#### 2.1 Minimal OTEL SDK (Workers 호환)
- **Red (Vitest)**: span 생성 · 중첩 · attribute · JSON 직렬화
- **Green**: `packages/observability/src/tracer.ts`
  - `@opentelemetry/*` 대신 **직접 구현** (Workers bundle size 제약)
  - `gen_ai.*` 스펙 속성 (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`)
  - 각 `executor/step` 호출 = 1 span · LLM 호출 = 중첩 span

#### 2.2 Axiom OTLP/HTTP exporter
- Axiom Free 계정 생성 · dataset `weaver` · API token
- Doppler `AXIOM_TOKEN` · `AXIOM_ORG_ID` 저장
- **Green**: `packages/observability/src/axiom.ts`
  - OTLP/HTTP POST (Workers `fetch`)
  - **10초 배치 flush** (여러 span 을 1 req 로)
  - `scheduled()` 종료 전 강제 flush (`ctx.waitUntil`)

#### 2.3 Trace Viewer (frontend)
- `packages/observability/src/types.ts` — `Trace`, `Span` 공유 타입
- **Red (Playwright)**: trace 패널 렌더 · span 클릭 시 prompt/response 표시
- **Green**:
  - `apps/web/app/components/trace/TimelineView.tsx` — canvas waterfall
  - `/tools/:id/runs/:runId` 페이지에 패널 추가
  - Axiom API fetch (`_time` 기반 run 단위 쿼리, web 서버 라우트에서 AXIOM_TOKEN 사용)

### 2.3 Exit
- 실행 1건 → Axiom 5-20 spans → viewer 에서 span 클릭 시 prompt/response JSON · 지연 · 비용

### 2.4 $0 검증

| 요소 | 예측 | Free 한도 | 여유 |
|---|---|---|---|
| Axiom ingest | 1 run ≈ 5KB. 1,000 run/일 = 5MB/일 = 150MB/월 | 500GB/월 | ×3,300 |
| Axiom queries (viewer) | 10k query/월 | 넉넉 | 문제없음 |

---

## Sprint 3 — Tool Registry + HTTP Built-in

### 3.1 왜
실전 에이전트가 돌아가려면 외부 API 호출 필수 (환불=Stripe, 알림=Slack). 일반 HTTP 툴 하나로 80% 커버 가능.

### 3.2 Task

#### 3.1 `defineTool()` 팩토리
- **Red**: `defineTool({name, input, output, execute})` 타입 + 런타임 검증
- **Green**: `packages/core/src/tool.ts` — valibot 강제 · permission scope 선언

#### 3.2 HTTP built-in
- **Red (통합)**: `tool` 노드에 HTTP 설정 → run 시 MSW 로 외부 API mock → 응답이 다음 노드 input 으로 흐름
- **Green**: `apps/runtime/src/tools/builtin/http.ts`
  - URL · method · auth (bearer/basic/header) · response schema
  - secrets 참조: `env.SECRET_XXX` 또는 `org.user_secrets` lookup
- `executor/step.ts` 의 `tool` 노드 타입에서 이름으로 lookup · 실행 · span 기록

#### 3.3 Custom Tool 추가 UI
- Migration `0006_tools.sql`:
  ```sql
  CREATE TABLE tools (id, org_id, name, input_schema, output_schema, created_by, created_at);
  CREATE TABLE tool_versions (id, tool_id, version, definition_json, created_at);
  ```
- 인스펙터에서 JSON-schema 폼 입력 → D1 저장
- (stretch) `/admin/tools` 페이지

### 3.3 Exit
- 노드에서 "call github.getRepo(owner,name)" → 실 API 호출 → 응답 trace 됨 · 다음 노드에 흐름

### 3.4 $0 검증
- Tool 호출은 외부 API 라 Worker CPU 만 소진. 호출당 10ms 예상 → 10ms × 10 tool/run × 1,000 run/일 = 100s CPU/일 (Free 제한 없음, req 단위 10ms 만 제약)
- D1 읽기 증가 (tool definition lookup) 미미

---

## Sprint 4 — BYOK + 모델 선택

### 4.1 왜
Workers AI (Llama 3.3) 품질로 초기 demo 는 충분하지만 실전은 Claude/GPT 필요. 유저가 직접 키 주면 Weaver 는 0원 유지 (ADR-006 정확히).

### 4.2 Task

#### 4.1 유저 API 키 저장 (암호화)
- `user_secrets` 테이블 Sprint 0 에서 이미 스키마 생성됨
- **Red**: 키 저장 → 조회 시 복호화 테스트 (랜덤 key + WEAVER_KEK)
- **Green**:
  - `apps/runtime/src/crypto.ts` — Web Crypto AES-GCM
  - `/api/secrets` POST/DELETE (org-scoped)
  - `/settings/api-keys` UI
  - 키 displayable form: `sk-ant-...1234` (last 4 only)

#### 4.2 모델 선택 UI
- Agent 노드 인스펙터에 "Model" 드롭다운:
  - Workers AI (Llama 3.3 70B) — 기본, 무료
  - Workers AI (Gemma 2B) — 경량
  - Claude Sonnet 4.6 — BYOK
  - GPT-4o — BYOK
- 모델별 비용 추정치 표시 (input/output 토큰 단가 static table)
- **Red**: 모델 선택 저장 → 실행 시 provider 라우팅 검증
- **Green**: `executor/agent.ts` provider switch

### 4.3 Exit
- 인스펙터에서 Claude 선택 · API 키 저장 · 실행 → 실제 Claude 호출 → Axiom 에 `gen_ai.system=anthropic`

### 4.4 $0 검증
- 키 저장: AES-GCM 로컬 연산, 외부 호출 0
- BYOK 호출: **유저가 비용 지불**. Weaver 는 프록시만
- 기본(Workers AI) 한도 방어: Sprint 0 의 per-org neurons limit

---

## Sprint 5 — Eval α

### 5.1 왜
런칭 핵심 차별점 (v0/Retool/Langfuse 모두 안 함). 배포 전 자동 품질 게이트.

### 5.2 Task

#### 5.1 DSL 파서
- `specs/eval-dsl.md` 참조
- **Red**: YAML/JSON 파싱 · 어서션 (`contains`, `equals`, `regex`, `json_schema`)
- **Green**: `packages/eval/src/parser.ts`

#### 5.2 Runner
- Migration `0007_eval.sql`:
  ```sql
  CREATE TABLE eval_datasets (id, org_id, tool_id, name, case_count, created_at);
  CREATE TABLE eval_cases (id, dataset_id, input, expected);
  CREATE TABLE eval_runs (id, dataset_id, tool_version, started_at, completed_at, pass_rate, avg_cost);
  CREATE TABLE eval_results (id, eval_run_id, case_id, agent_run_id, pass, error);
  ```
- **Red (통합)**: 3건 데이터셋 → eval run → 결과 집계
- **Green**: `apps/runtime/src/eval.ts`
  - `POST /api/eval/run` — 각 case = 새 `agent_run`
  - Cron 또는 on-demand
  - 결과 집계 → `eval_runs` 업데이트

#### 5.3 UI
- `/tools/:id/eval` 페이지:
  - 데이터셋 업로드 (CSV 또는 JSONL)
  - 실행 버튼
  - 결과 매트릭스 (버전 × 데이터셋 · pass rate · cost · p50/p95 latency)
- **스크린샷 3장**: 업로드 · 실행 중 · 결과

### 5.3 Exit
- 30건 CSV 업로드 → eval 실행 → 93% pass · 평균 $0.04/case 리포트

### 5.4 $0 검증
- 30 case × 3 step = 90 agent_run step. 하루 10 eval run 가정 → 900 step/일 (Cron 여유)
- D1 writes 초과? 30 case × 4 write/case × 10 eval/일 = 1,200 writes/일 (Free 100k/일)

---

## 백로그 (런칭 후 또는 필요 시)

| 항목 | 근거 | 예상 공수 |
|---|---|---|
| 실시간 협업 (y-websocket on Fly.io Free) | 팀 쓰는 유저 생기면 | 1주 |
| 배포 게이트 + Shadow Traffic | Week 10 스펙 · 프로덕션 도입 | 1주 |
| Time-Travel 디버깅 | Week 8 스펙 · R2 페이로드 분리 | 1주 |
| docs-site (Astro on Cloudflare Pages) | Week 13 런칭 준비 | 3일 |
| 런칭 페이지 + HN/Product Hunt post | Week 14 | 3일 |
| Google OAuth 추가 | 비개발자 유저 확장 시 | 1일 |
| Passkey/WebAuthn | 보안 강화 | 3일 |
| Org 초대 (이메일 기반) | 팀 워크스페이스 | 2일 |
| 2FA (TOTP) | 엔터프라이즈 대비 | 1일 |

---

## 기술 부채 (짬날 때 처리)

- [ ] Monaco 통합 (현재 textarea) — 대형 에이전트 프롬프트 편집 불편
- [ ] D1 migration 시스템 체계화 (현재 수동 실행) — `wrangler d1 migrations` CLI 또는 drizzle-kit
- [ ] `apps/web/wrangler.jsonc` 의 `vars.VALUE_FROM_CLOUDFLARE` 레거시 제거
- [ ] `apps/docs-site` 빈 디렉토리 정리 (Week 13 전엔 touch 안 할 거면 scaffold 제거)
- [ ] `apps/runtime` cold start 분석 · Workers 번들 크기 모니터 (<1MB 유지)
- [ ] GitHub Actions e2e 가 항상 돌도록 (현재 수동) · Playwright headless CI
- [ ] `canvas.ts` Zustand 스냅샷 deep clone 성능 최적화 (노드 100+ 기준)
- [ ] `example/design/` 과 `apps/web/app/styles/tokens.css` 동기 자동 검사 (생성 스크립트)

---

## 의사결정 대기 (답변 주시면 즉시 반영)

### D1 · Sprint 0 진행 방식
1. **Sprint 0 (인증) 를 바로 시작?** vs Sprint 1 (compose UI) 먼저?
   - 권장: **Sprint 0 먼저**. 현재 스팸 리스크.

### D2 · 매직 링크 포함 범위
2. Sprint 0 에 **GitHub only MVP**? 아니면 Resend 매직 링크 같이?
   - 권장: **GitHub only 먼저**. 개발자 타겟 상 충분. 일반 유저 문의 오면 Sprint 0.5 추가.

### D3 · org 자동 생성
3. 첫 GitHub 로그인 시 자동으로 `{github_login}-personal` org 만들기?
   - 권장: **예**. 로그인 즉시 사용 가능하게 (slug 충돌 시 suffix `-2`).

### D4 · 기존 `org_id='local'` row 처리
4. 개발 중 생긴 row 들 → migration 에서 삭제? NULL 로 방치?
   - 권장: **삭제** (`DELETE FROM agent_runs WHERE org_id='local'`). 테스트 데이터.

### D5 · GitHub OAuth App 수
5. dev/prod **2개 App** 따로? 1개를 공용?
   - 권장: **2개**. 로컬 `localhost:8787` callback 과 프로덕션 callback 분리. 보안 + 디버깅 편함.

### D6 · 커스텀 도메인
6. `weaver.dev` 또는 `jinhui.work` 같은 도메인 구매? ($12/년)
   - 권장: **런칭(Week 14) 전까지 workers.dev 서브도메인 유지**. 도메인 비용은 ADR-006 예외 (연 $12 vs 브랜딩 가치) — Week 13 에 재판단.

### D7 · Claude 공식 지원 여부
7. Weaver 가 Anthropic API 를 **기본** 포함할지?
   - 권장: **BYOK only**. Weaver 자체 비용 0 유지. 마케팅에서 "Workers AI 무료 + BYOK 선택" 명확히.

---

## 업데이트 규칙

- Sprint 완료 시 해당 섹션 **삭제** · README/ROADMAP 반영 · `memory/` 의 `project_*.md` 갱신
- 새 우선순위는 Sprint 0 상단에 추가
- Sprint 내에서 Task 순서가 바뀌면 Day 표기만 수정
- $0 예산 표는 분기별 (혹은 Sprint 종료 시) 소진률 재측정

---

## 참고 링크

- [`ROADMAP.md`](./ROADMAP.md) — 14주 전체 로드맵 (히스토리)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 4 레이어 설계
- [`decisions/ADR-006-free-tier-first.md`](./decisions/ADR-006-free-tier-first.md) — $0 정책
- [`decisions/ADR-002-runtime-d1-cron.md`](./decisions/ADR-002-runtime-d1-cron.md) — Runtime 구현
- [`specs/`](../specs/) — 스펙 (node-types, tool-registry, observability-schema, eval-dsl 등)
- GitHub OAuth docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- Axiom OTLP: https://axiom.co/docs/endpoints/opentelemetry
- Resend Workers: https://resend.com/docs/send-with-cloudflare-workers
