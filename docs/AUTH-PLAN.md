# Auth Plan — GitHub OAuth + Magic Link ($0)

> 2026-04-22 기안. Weaver에 **로그인·멀티테넌트 기반** 을 도입하면서 $0 정책을 지키는 구체 계획.
> 승인 후 [`NEXT.md`](./NEXT.md)의 Sprint 0 으로 편입.

---

## 1. 왜 지금 auth 가 필요한가

현재 상태: **앱 전체가 익명 퍼블릭**. 누구나 `/api/runs` · `/api/compose` 호출 가능.

실제 리스크 (지금 Free tier 한도를 적대적 트래픽이 태워버릴 수 있음):

| 한도 | 한 번에 태울 방법 | 회복 |
|---|---|---|
| Workers 100k req/day | `curl` 루프로 `/api/compose` 스팸 | 24h 대기 또는 유료 전환 |
| Workers AI 10k neurons/day | 긴 prompt `/api/compose` 반복 호출 | 24h 대기 |
| D1 100k writes/day | `/api/runs` INSERT 스팸 | 24h 대기 |

$0 정책의 안전성은 **per-org rate limit + 익명 접근 차단**으로 확보. 그러려면 "org" 가 구분 가능해야 하고 → 로그인 필요.

추가 필요성:
- **BYOK**: 유저가 Claude/OpenAI 키 저장 (Sprint 4) → 키 주인 식별 필수
- **멀티 워크스페이스**: 회사/팀 단위 tool 격리 (`agent_runs.org_id` 이미 컬럼 존재)
- **run 소유권**: 내가 실행한 run 만 보이게
- **eval 결과 / deploy 이력**: 당연히 org 단위

결론: 로그인은 **Sprint 1(UI↔Runtime 루프) 보다 먼저** 들어가야 한다. 지금 NEXT.md의 Sprint 1은 익명 전제로 설계되어 있어서, auth를 끼고 다시 정리.

---

## 2. $0 tier 옵션 비교

| 방식 | 무료 한도 | 장점 | 단점 | 결정 |
|---|---|---|---|---|
| **Cloudflare Access** | 50 user free | CF 내장, 0 의존성 | 타사 유저는 CF 계정 필요 → 퍼블릭 SaaS로 부적합 | ❌ |
| **Supabase Auth** | 50k MAU | OAuth 다 됨 | 새 vendor, 데이터 이원화(Supabase ↔ D1) | ❌ |
| **Clerk** | 10k MAU free | UX 좋음 | 오픈소스 비호환 (벤더 락) · 마케팅 워터마크 | ❌ |
| **Auth0** | 7.5k MAU free | 업계 표준 | 무료 티어가 작고 축소 추세 | ❌ |
| **GitHub OAuth (직접)** | 무제한 | $0 · Weaver 타겟(dev/ops)과 정확히 일치 · 0 의존성 | 비개발자는 접근 어려움 | ✅ Primary |
| **Google OAuth (직접)** | 무제한 | 일반 유저 접근성 | 설정 공수, 심사 필요할 수 있음 | ✅ Phase 2 |
| **Email Magic Link (Resend Free)** | 3,000 mail/월 | 일반 유저 커버 | 메일 벤더 의존 · 초과 시 유료 | ✅ Fallback |
| **WebAuthn/Passkey** | 무제한 | 가장 안전 · UX 깔끔 | 구현 공수 큼 | 📌 Phase 2 |

### 선택

**Primary**: **GitHub OAuth (직접 구현)** — Weaver 초기 유저 99%가 개발자. 깃헙 없는 유저 = 타겟 아님.

**Fallback**: **Email magic link (Resend Free)** — Sprint 0.5 선택 사항. 일반 사용자 확장 시 도입. 3,000/월 초과 위험 < 월 간.

**세션**: **HttpOnly cookie + 서명된 JWT** (stateless). 별도 세션 스토어 불필요. `HS256 + WEAVER_SESSION_SECRET` (Doppler 저장).

---

## 3. 데이터 모델 (D1)

### Migration `0003_auth.sql`

```sql
-- 유저 (GitHub OAuth primary)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,              -- 내부 uuid
  github_id     INTEGER UNIQUE,                -- GitHub numeric user id
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 워크스페이스 (org)
CREATE TABLE IF NOT EXISTS orgs (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,         -- URL용 (e.g. "acme")
  name            TEXT NOT NULL,
  owner_user_id   TEXT NOT NULL REFERENCES users(id),
  plan            TEXT NOT NULL DEFAULT 'free', -- free | byok | later
  created_at      INTEGER NOT NULL
);

-- 멤버십
CREATE TABLE IF NOT EXISTS memberships (
  user_id      TEXT NOT NULL REFERENCES users(id),
  org_id       TEXT NOT NULL REFERENCES orgs(id),
  role         TEXT NOT NULL,                   -- owner | admin | editor | viewer
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships (org_id);

-- 매직 링크 토큰 (Sprint 0.5, Resend 사용 시)
CREATE TABLE IF NOT EXISTS magic_tokens (
  token         TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  consumed_at   INTEGER,
  created_at    INTEGER NOT NULL
);

-- BYOK 키 (Sprint 4와 공유 · 여기 스키마만 예약)
CREATE TABLE IF NOT EXISTS user_secrets (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  provider      TEXT NOT NULL,                  -- anthropic | openai | stripe | ...
  label         TEXT NOT NULL,
  ciphertext    TEXT NOT NULL,                  -- AES-GCM(WEAVER_KEK, plaintext)
  iv            TEXT NOT NULL,
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_secrets_org_provider ON user_secrets (org_id, provider);
```

### 기존 테이블 보강

`agent_runs.org_id` 는 이미 존재. 로그인 이후엔 `INSERT` 시 세션 org로 채워지고, 익명 요청은 거부.

추가 migration `0004_ownership.sql`:
```sql
ALTER TABLE agent_runs ADD COLUMN created_by TEXT;  -- user_id, nullable for legacy
```

(Tool / Canvas 스키마가 도입되면 동일하게 org_id/created_by 붙임.)

---

## 4. 인증 플로우

### 4.1 GitHub OAuth 플로우

```
Browser                    weaver-web (Worker)            GitHub                weaver-runtime
  │  1. click "Sign in"       │                             │                        │
  ├───────────────────────────▶│                             │                        │
  │                            │  2. generate state          │                        │
  │                            │     → cookie (oauth_state)  │                        │
  │  3. 302 → github.com/login/oauth/authorize              │                        │
  │◀───────────────────────────┤                             │                        │
  │  4. redirect to GitHub     │                             │                        │
  ├────────────────────────────┼────────────────────────────▶│                        │
  │                            │                             │ (user approves)        │
  │  5. GH → /auth/callback?code=X&state=Y                  │                        │
  │◀───────────────────────────┼─────────────────────────────┤                        │
  │  6. GET /auth/callback?code=X&state=Y                   │                        │
  ├───────────────────────────▶│                             │                        │
  │                            │  7. verify state cookie     │                        │
  │                            │  8. POST /login/oauth/access_token                   │
  │                            ├────────────────────────────▶│                        │
  │                            │  9. { access_token }        │                        │
  │                            │◀────────────────────────────┤                        │
  │                            │ 10. GET /user (bearer)      │                        │
  │                            ├────────────────────────────▶│                        │
  │                            │ 11. { id, login, email,...} │                        │
  │                            │◀────────────────────────────┤                        │
  │                            │ 12. upsert users/orgs/memberships in D1              │
  │                            ├──────────────────────────────────────────────────────▶│
  │                            │ 13. sign JWT (sub=user_id, org=org_id, exp=+7d)      │
  │                            │ 14. Set-Cookie weaver_session=<jwt>                  │
  │ 15. 302 → /app             │                             │                        │
  │◀───────────────────────────┤                             │                        │
```

**키 결정**:
- `weaver-web` 워커가 OAuth callback 을 처리 (같은 origin = 쿠키 간단)
- D1 upsert 는 `weaver-runtime` 과 같은 `DB` 바인딩 공유 (이미 바인딩된 `weaver-db` 재사용)
- JWT 발급: `HS256(WEAVER_SESSION_SECRET, { sub, org, exp })`. 양 Worker 모두 `SECRET` 주입 → 어느 쪽이든 검증 가능

**보안**:
- `state` 파라미터 = 랜덤 32 bytes (CSRF 방어)
- `oauth_state` 쿠키: `HttpOnly; Secure; SameSite=Lax; path=/auth; max-age=600`
- 세션 쿠키 `weaver_session`: `HttpOnly; Secure; SameSite=Lax; path=/; max-age=604800` (7일)
- 재로그인 시 새 JWT 발급, 기존 JWT 는 TTL 만료로 자연 폐기

### 4.2 Magic Link 플로우 (Sprint 0.5, optional)

```
Browser       weaver-web         Resend          Recipient
  │ enter email  │                │                │
  ├─────────────▶│                │                │
  │              │ POST /auth/magic/request        │
  │              │ (email, token=rand, ttl=15min)  │
  │              │ INSERT magic_tokens             │
  │              │ POST resend.com/emails          │
  │              ├───────────────▶│                │
  │              │                │ (email sent)   │
  │              │                ├───────────────▶│
  │              │                │                │ clicks link
  │              │                │◀──────────────────┐
  │ GET /auth/magic?token=X      │                │   │
  ├──────────────┼──────────────────────────────────┘   │
  │              │ SELECT magic_tokens WHERE token=X AND NOT consumed AND not expired
  │              │ mark consumed, upsert user, issue session JWT, 302 /app
  │◀─────────────┤
```

---

## 5. API 계약

### `weaver-web` (Cloudflare Worker, RR7 server routes)

| Method · Path | 역할 | 응답 |
|---|---|---|
| `GET /auth/github` | OAuth authorize 로 302 | 302 |
| `GET /auth/callback` | GitHub code 교환 → JWT 발급 → 302 /app | 302 |
| `GET /auth/magic?token=X` | 매직링크 토큰 소비 → JWT | 302 |
| `POST /auth/magic/request` | 이메일 입력, Resend 전송 | 204 |
| `POST /auth/logout` | 쿠키 clear | 204 |
| `GET /api/me` | 현재 세션 정보 | `{ user, org, memberships }` |

### `weaver-runtime` (Hono)

기존 `/api/runs`, `/api/compose` 에 **auth middleware** 적용:

```ts
app.use('/api/*', async (c, next) => {
  const jwt = c.req.header('x-weaver-session') ?? parseCookie(c, 'weaver_session');
  if (!jwt) return c.json({ error: 'unauthorized' }, 401);
  const claims = await verifyJwt(jwt, c.env.WEAVER_SESSION_SECRET);
  if (!claims) return c.json({ error: 'invalid session' }, 401);
  c.set('session', claims);  // { sub, org }
  await next();
});
```

`POST /api/runs` 는 `body.org_id` 대신 `c.var.session.org` 사용 (요청 본문 신뢰 금지).

### Cross-origin 처리

현재 `weaver-web.jinhuistudy.workers.dev` 와 `weaver-runtime.jinhuistudy.workers.dev` 는 **서로 다른 origin**. 쿠키는 도메인마다 따로 저장됨.

**해결 옵션**:
- **A**: 모든 API 호출을 `weaver-web` 서버 라우트에서 프록시 (쿠키 있는 쪽에서 JWT 를 헤더로 붙여 runtime 호출). 브라우저는 web 만 호출.
- **B**: Runtime 을 `api.` 경로가 아니라 web 과 동일 origin 하위 path 로 mount (커스텀 도메인 1개 잡으면 가능. 무료: `weaver.pages.dev` 한 개로 routing).
- **C**: JWT 를 Authorization 헤더로 명시 (브라우저에서 localStorage → 보안 약함).

**결정**: **A (프록시)**. 보안 기본 + 추가 인프라 0.

RR7 server loader/action 에서 `fetch('https://weaver-runtime...')` 할 때 `X-Weaver-Session: ${jwt}` 헤더 추가. 런타임은 헤더만 믿음.

---

## 6. 프론트엔드 변경

### 라우트 구조
- `/` — 퍼블릭 랜딩 (변경 없음)
- `/login` — GitHub 버튼 + (선택) 이메일 입력
- `/app` — 로그인 전용 대시보드 (org 선택, tool 목록)
- `/builder/:id` — **로그인 필수**, loader 에서 세션 체크
- `/tools/:toolId/runs/:runId` — 로그인 필수, org 소유 확인

### `useSession()` hook
```ts
// apps/web/app/lib/session.ts
export function useSession() {
  const { data } = useSWR('/api/me', fetcher);
  return data as { user: User; org: Org; memberships: Membership[] } | null;
}
```

### Route guard (RR7 loader 에서)
```ts
export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (!session) throw redirect('/login?next=' + request.url);
  return { session };
}
```

### 팔레트/스토어 수정
`canvas.ts` Zustand: 현재 tool_id 가 URL 로만 존재. 세션 들어오면 서버 영속(D1 `tools` 테이블 도입 — Sprint 별도) 로 확장. 당장은 org 체크만.

---

## 7. Rate limiting (무료 유지 방어선)

### Middleware
- **익명 (unauth)**: IP 기반, KV bucket, 10 req/분 (헬스체크 / 랜딩만 허용)
- **인증됨 (per org)**: D1 + Analytics Engine counter, `plan=free` 기준 1,000 runs/일
- **Workers AI**: org 단위 neurons 누적, 1,000 neurons/day (Free tier 10% 사용 보장)

### 구현
- Cloudflare KV 바인딩 `RATE` 추가 (Free 100k reads/day)
- `RateLimiter` 라이브러리 간단히 내부 구현 (sliding window)
- 초과 시 429 + `Retry-After` 헤더

### 트리거 (유료 전환 조건 ADR-006 업데이트)
- 단일 org 가 월 10k runs 초과 → 유료 플랜 제안
- Workers 100k/day 70% 도달 (daily) → 슬랙 알림 → 유료 전환 검토

---

## 8. Secrets 관리

| 시크릿 | 생성 | 저장 | 주입 |
|---|---|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | github.com/settings/developers | Doppler | Worker env |
| `GITHUB_OAUTH_CLIENT_SECRET` | 동상 | Doppler | Worker env |
| `WEAVER_SESSION_SECRET` | `openssl rand -base64 32` | Doppler | Worker env |
| `WEAVER_KEK` (BYOK 암호화) | `openssl rand -base64 32` | Doppler | Worker env |
| `RESEND_API_KEY` (optional) | resend.com | Doppler | Worker env |

배포 루틴:
```bash
# 최초 1회
doppler secrets set GITHUB_OAUTH_CLIENT_ID=... -p weaver -c dev
doppler secrets set GITHUB_OAUTH_CLIENT_SECRET=... -p weaver -c dev
doppler secrets set WEAVER_SESSION_SECRET=$(openssl rand -base64 32) -p weaver -c dev
doppler secrets set WEAVER_KEK=$(openssl rand -base64 32) -p weaver -c dev

# 각 deploy 에서
doppler run -p weaver -c dev -- pnpm exec wrangler deploy  # 기존과 동일
# Wrangler v4에선 `wrangler secret` 대신 deploy 시 자동으로 env 주입되는지 재확인 필요.
# 안 되면: wrangler secret bulk <(doppler secrets download --no-file --format json)
```

---

## 9. 테스트 전략 (TDD 규율 유지)

### 단위 (Vitest · `apps/runtime/src/auth/*.test.ts`)
- `signJwt` + `verifyJwt` 라운드트립 (valid · expired · tampered)
- OAuth state 생성/검증 함수
- `upsertUserFromGithub` 함수 (github user → D1 user + org 생성)
- `requireSession` middleware (401 vs pass)

### 통합 (`vitest-pool-workers`)
- GitHub OAuth callback mock (MSW로 github.com/user, oauth/access_token stub)
- `/api/runs` 가 익명이면 401
- `/api/runs` 가 세션이면 body.org_id 무시하고 session.org 사용

### E2E (Playwright)
- `/login` → "Sign in with GitHub" 버튼 확인
- OAuth flow mocking (playwright route interception)
- 로그인 후 `/app` 으로 redirect, `/api/me` 가 사용자 반환
- 로그아웃 → `/login` 으로 복귀

**스크린샷 눈 검증**:
1. `/login` 초기 상태
2. `/app` 로그인 후 (org selector)
3. `/builder/:id` — 세션 뱃지 (아바타) 표시
4. 401 에러 UI (만료된 세션)

---

## 10. Sprint 0 세부 일정 (5일)

### Day 1 — 인프라 · 마이그레이션 · JWT 라이브러리
- **Red**: `signJwt/verifyJwt` 테스트 작성
- **Green**: `apps/runtime/src/auth/jwt.ts` (Web Crypto HMAC)
- Migration `0003_auth.sql` · `0004_ownership.sql` 작성
- Doppler 시크릿 5개 등록 (ID/SECRET은 나중 GitHub 앱 만들고 주입)
- 로컬 D1 적용, 리모트 적용 (dry-run 먼저)

### Day 2 — GitHub OAuth 서버 사이드
- **Red**: OAuth callback 플로우 통합 테스트 (MSW로 GitHub API mock)
- **Green**: `/auth/github`, `/auth/callback` 라우트 in `apps/web/app/routes/auth.*.tsx`
- `upsertUserFromGithub` D1 함수
- 세션 쿠키 발급 / 로그아웃
- 로컬에서 실제 깃헙 OAuth 테스트 (OAuth App 생성 필요)

### Day 3 — Runtime middleware + /api/me
- **Red**: `/api/runs` 401 테스트 · 세션 있을 때 org 주입 테스트
- **Green**: Hono middleware · `c.var.session` · body override 방지
- `/api/me` 엔드포인트 (web 쪽)
- 기존 익명 테스트/통합 테스트 전부 "세션 주입" 모드로 재작성

### Day 4 — 프론트엔드 UI
- **Red**: Playwright `/login` e2e · `/app` redirect 가드
- **Green**: `/login` 페이지 · 세션 훅 · 아바타 뱃지 · 로그아웃 버튼
- 빌더 로더에 세션 가드 추가
- 스크린샷 4장 찍고 눈 검증

### Day 5 — Rate limiting · 배포 · 스모크
- KV 바인딩 추가 · IP/org rate limiter
- `WEAVER_SESSION_SECRET` 프로덕션 주입 · GitHub OAuth App production URL 등록
- 배포 후 실제 깃헙 로그인 시도 → `/api/me` 확인 → `/api/runs` 실행 → 리모트 D1 row 에 `created_by`, `org_id` 기록 확인
- README / NEXT.md / ROADMAP 업데이트, 커밋

**Exit criteria (Sprint 0 종료)**:
- [x] 익명으로 `/api/runs` 호출 시 401
- [x] GitHub 로그인 후 동일 호출 시 200, row 에 `created_by`, `org_id` 정확히 기록
- [x] 로그아웃 후 `/api/me` 404
- [x] 통합/유닛/e2e 전부 그린
- [x] 프로덕션 스모크 스크린샷 4장 commit

---

## 11. 유지보수 · 확장

- **Google OAuth 추가**: `/auth/google`, `/auth/callback?provider=google` 분기 추가. 1일 작업.
- **Passkey**: WebAuthn SimpleWebAuthn 라이브러리 + challenge 저장 (D1 또는 KV). 3일 예상.
- **SSO (SAML/OIDC)**: 유료 플랜 이후. Enterprise 고객 전용.
- **Org 초대**: `/app/settings/members` + 메일 초대. Sprint 별도.
- **2FA (TOTP)**: users 테이블에 `totp_secret` 추가 + RFC 6238 구현 (1일).

---

## 12. $0 유지 검증

| 요소 | 소진 예측 (초기 100 MAU 기준) | Free 한도 |
|---|---|---|
| GitHub OAuth calls | 100 users × 월 5 login ≈ 500 req/월 | 무제한 |
| JWT 발급 | 500/월 | CPU free tier 안 |
| `/api/me` 세션 검증 | 10k req/월 | Worker 100k/일 = 3M/월 |
| D1 auth 테이블 writes | 600/월 (upsert users) | 100k/일 |
| KV rate limit reads | 5,000/월 | 100k/일 |
| Resend mail (optional) | 200/월 | 3,000/월 |

**결론**: 1천 MAU 까지는 $0 유지 가능. 1만 MAU 초과 시 재검토 트리거.

**트리거 시 대응** (ADR-006 업데이트 필요):
1. Workers 100k/day 80% → Workers Paid $5/월 전환 검토
2. Resend 2,500/월 → 자체 메일 서버 or 유료 플랜 ($20/월부터)
3. D1 쓰기 한도 → Cloudflare Queues 로 배치 (Queues 는 paid tier 필요 → $5/월)

---

## 13. 의사결정 대기 사항

- [ ] **Sprint 0 를 지금 바로 시작?** vs Sprint 1 (compose UI) 먼저?
  - 권장: **Sprint 0 먼저**. 현재 익명 `/api/runs` 가 뚫려 있음 → 스팸 리스크.
- [ ] **Magic link 포함 범위?** GitHub only 로 MVP → Resend 는 Sprint 0.5 선택
- [ ] **org 초기 생성 정책?** 첫 로그인 시 `{username}-personal` org 자동 생성 → Sprint 0 권장
- [ ] **기존 `org_id='local'` 데이터 처리?** 개발 중 생긴 row → migration 에서 `NULL` 로 초기화 또는 삭제
- [ ] **OAuth App 설정 주체?** 박진희 개인 계정에 등록 (Organization 은 없음) → dev/prod 2개 app

---

## 14. 참고

- GitHub OAuth docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- Cloudflare Workers JWT example: Web Crypto `crypto.subtle.sign('HMAC', ...)`
- Cloudflare KV rate limit 패턴: https://developers.cloudflare.com/workers/examples/
- Resend Workers integration: https://resend.com/docs/send-with-cloudflare-workers

---

**다음 액션**: 이 문서 리뷰 → Sprint 0 킥오프 승인 → GitHub OAuth App 2개 생성 (dev/prod) → Day 1 작업 시작.
