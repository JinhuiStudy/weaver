# Roadmap — 14주 Evolving Agent Network (운영 $0 · 유저 $0)

> **피봇 (2026-04-22)**: "내부툴 빌더" → **"Evolving Agent Network"** (ADR-007)
> **제품 한 줄**: Fork agents. Rate them. They evolve. Free forever.
> **시작 기준**: 2026-W17 · 실제 코어 배포 2026-04-21
> **런칭 목표**: Week 14 = 2026-W30 (2026-07-20)
> **예산**: 운영 $0 · 유저 $0 (ADR-006 개정 · ADR-007)
> **현재 (2026-04-22)**: **Phase 1 코어 완료 · 라이브 배포**
>
> - Runtime: https://weaver-runtime.jinhuistudy.workers.dev
> - Web: https://weaver-web.jinhuistudy.workers.dev
>
> **실행 계획**: [`NEXT.md`](./NEXT.md) (Sprint 0~9)

---

## Phase 1 — Scaffold & Core (Week 1-4)

### Week 1 · "Hello Canvas" ✅ **완료**
**목표**: 레포 초기화 + **디자인 토큰 주입** + 빈 캔버스 노드 드래그

- [x] pnpm workspaces 설정
- [x] **`example/design/tokens.css` → `apps/web/app/styles/tokens.css` import, Tailwind v4 `@theme` 바인딩**
- [x] Inter + JetBrains Mono 웹폰트 로드
- [x] `apps/web` — RR7 Framework Mode + Tailwind 4 + shadcn/ui 초기 컴포넌트 (Button · Input · Card · Badge · Tabs · Kbd · Tooltip · Skeleton · Empty · Toast) 토큰 기반 재스타일
- [x] `apps/web` — xyflow 통합, 빈 canvas backdrop(24px dot grid) + 5종 노드 드래그
- [x] `packages/core` — Node·Edge·Graph 기본 타입 (valibot)
- [x] Vitest + Playwright 스캐폴드
- [x] **GitHub Actions** 기본 파이프라인 (typecheck, biome, vitest, build)
- [x] Cloudflare Workers 최초 배포 — `weaver-web.jinhuistudy.workers.dev` *(Pages 대신 Workers 선택 · RR7 Framework Mode 호환)*

**산출물**: https://weaver-web.jinhuistudy.workers.dev 접속 → 빈 캔버스 + 노드 드래그. **비용 $0.** ✅

### Week 2 · "노드 프리미티브 5종 + 디자인 적용" ✅ **대부분 완료**

- [x] `packages/core` — Input/Agent/Tool/Branch/Output valibot 스키마
- [x] `apps/web/components/canvas/nodes/` — 5 노드 컴포넌트 (7 상태)
- [x] 엣지: default/selected/flowing/error 4 타입
- [x] Port: 10×10 · 5 상태
- [x] 노드 속성 사이드 패널 + 실시간 valibot 검증 + kbd 힌트
- [x] 캔버스 상태 Zustand + **y-indexeddb 로컬 영속**
- [ ] D1 테이블 `canvas_snapshots`, `tools`, `tool_versions` *(현재는 agent_runs만 · 툴 영속화 Phase 2)*
- [ ] Monaco 에디터 통합 *(현재 textarea · 대형 에이전트 프롬프트용 upgrade 예정)*

**산출물**: 5 노드 드래그·연결·편집·저장. 새로고침해도 로컬 보존. ✅

### Week 3 · "NL Composer — Workers AI로 자연어 생성" ✅ **코어 완료**

- [x] `apps/runtime` — Hono app 스캐폴드, Worker 엔트리
- [x] `/api/compose` 엔드포인트 · Workers AI 바인딩 · offline stub fallback
- [x] System prompt: 현재 그래프 + 유저 입력 → intent (canvas diff)
- [ ] BYOK 경로 (Claude/OpenAI API 키 저장 UI) → Phase 2
- [ ] Frontend DiffPreview UI · 수락 시 Zustand apply → Phase 2

**산출물**: `POST /api/compose` live. NL → graph intent 동작 ✅ (**Workers AI 무료**). UI 통합은 Phase 2.

### Week 4 · "에이전트 런타임 α — D1 + Cron" ✅ **코어 완료**

- [x] D1 스키마: `agent_runs`, `run_history` (migrations 0001, 0002)
- [x] `apps/runtime/executor/step.ts` — `executeOneStep()` state machine
- [x] `apps/runtime/src/index.ts` `scheduled()` — 매 1분, 그래프 스냅샷 기반
- [x] Workers AI LLM 어댑터 (`executor/agent.ts` · `{{ input.field }}` interpolation)
- [x] **프로덕션 E2E 검증됨** — pending → running → complete via real cron
- [ ] HTTP 툴 1개 (빌트인) → Phase 2 (`packages/core` tool registry)
- [ ] SSE `/api/runs/:id/stream` → Phase 2 (현재 RR7 page loader 폴링)
- [ ] Frontend Trace 패널 실시간 업데이트 → Phase 2 (OTEL 붙일 때)

**산출물**: `POST /api/runs` → Cron → D1 UPDATE, end-to-end 라이브 동작 ✅

---

## Phase 2 — Network Foundation (Week 5-8)

### Week 5 · "Auth + Rate Limit" (Sprint 0)
- [ ] GitHub OAuth · `/auth/github` · `/auth/callback` · JWT HS256 쿠키
- [ ] D1 migration: `users`, `orgs`, `memberships`, `rate_limits`
- [ ] Hono middleware · `/api/me` · body override 방지
- [ ] 유저당 일 cap: worker req 100, AI neurons 50, D1 writes 100
- [ ] `/login` UI · loader 가드 · 아바타 뱃지

**산출물**: 익명 `/api/runs` → 401. GitHub 로그인 후 동일 호출 → 200, row 에 `created_by`/`org_id` 정확.

### Week 6 · "Public Agent · Slug URL · Fork" (Sprint 1)
- [ ] D1: `agents`, `agent_versions` · `agent_runs.agent_version_id`
- [ ] `POST /api/agents` (save as) · `/@{handle}/{slug}` 공개 라우트
- [ ] Fork 버튼 · `POST /api/agents/:id/fork` · `fork_of_agent_id` 기록
- [ ] 빌더 "Save as..." 다이얼로그

**산출물**: `/@jinhui/hn-summary` 공개 URL · Fork → `/@you/hn-summary` 즉시 복제.

### Week 7 · "OTEL + Cost · Run Viewer" (Sprint 2)
- [ ] `packages/observability` — minimal OTEL SDK · `gen_ai.*` 속성
- [ ] Axiom OTLP exporter · 10초 배치 flush
- [ ] Analytics Engine 에 neurons/user/agent 카운터
- [ ] `/runs/:runId` — timeline waterfall · span 클릭 시 prompt/response

**산출물**: run 1건 → Axiom 5-15 spans · viewer 에서 지연/비용/프롬프트 확인.

### Week 8 · "Feed · Subscribe · Search" (Sprint 3)
- [ ] D1: `agent_outputs`, `subscriptions` · Vectorize 인덱스
- [ ] `/@{handle}/{slug}/feed.json` (JSON Feed 1.1)
- [ ] Subscribe 버튼 · `/@me/feed` 통합 타임라인
- [ ] `/search` — bge-base 임베딩 + 키워드 하이브리드

**산출물**: RSS-style agent feed · 구독 · 유사 agent 검색.

---

## Phase 3 — Evolution (Week 9-11)

### Week 9 · "Feedback + Genealogy Tree" (Sprint 4)
- [ ] D1: `agent_feedback` (run_id, rating, comment)
- [ ] 👍/👎 버튼 · post-run toast
- [ ] Like ratio · fitness 차트 (30일)
- [ ] Genealogy tree (d3-hierarchy) · `/@{handle}/{slug}/genealogy`

**산출물**: "@alex/hn-digest → 나 → 3 forks" 시각화. Like ratio 82%.

### Week 10 · "Evolution Engine: Mutation" (Sprint 5)
- [ ] D1: `agent_evolutions`
- [ ] Daily cron (23:00 UTC) · Fitness 계산 · top-4 선발
- [ ] 5 mutation strategies (concise/specific/cot/role/format) via Llama
- [ ] Shadow eval (Llama 3B pairwise judge, 2 case, 60%+ win 시 suggest)
- [ ] 비용 가드 · 관리자 dashboard

**산출물**: 매일 밤 top-4 agent 에 대해 5 variations × shadow eval. 일 neurons <5k (Free 50%).

### Week 11 · "Shadow UI + v2 Suggestion" (Sprint 6)
- [ ] Diff viewer (원본 vs candidate)
- [ ] Suggestion 배너 ("🧬 Your agent evolved. 17% better.")
- [ ] Accept / Shadow 10% / Reject · auto-rollback (7일 -20% 이하 시)

**산출물**: 수락한 v2 가 current version 으로 교체 · shadow 10% 라우팅 · 악화 시 자동 복원.

---

## Phase 4 — Launch (Week 12-14)

### Week 12 · "Trending · Explore · Discover" (Sprint 7)
- [ ] Analytics Engine 집계 (24h · 7d · 30d)
- [ ] `/explore` · `/explore/trending` · `/explore/:category`
- [ ] Agent 카드 (like · fork count · subscriber · neurons)
- [ ] 태그 시스템

**산출물**: `/explore` 에 trending agent 10개 · 카테고리 필터.

### Week 13 · "Landing + Invite-only" (Sprint 8)
- [ ] `/` 랜딩 재작성 — "Fork agents. Rate them. They evolve. Free forever."
- [ ] `/waitlist` · 이메일 수집 · Resend 환영 메일
- [ ] Invite code 시스템 (초기 100명)
- [ ] Seed agents 10개 직접 제작 (HN · GitHub trends · RSS brief)
- [ ] 첫 20명 초대 · 피드백

**산출물**: 랜딩 · waitlist · 20 베타 유저 · 10 seed agents.

### Week 14 · "퍼블릭 런칭" (Sprint 9)

**월요일**
- [ ] Rate limit · LLM 모더레이션 · k6 부하 시뮬레이션
- [ ] `/docs` 기본 페이지 · 3분 데모 Loom

**화요일-수요일**
- [ ] HN "Show HN: Weaver — fork AI agents, they evolve, free forever"
- [ ] ProductHunt 발행
- [ ] Reddit r/LocalLLaMA, r/SideProject · Korean: geeknews, okky

**목요일-금요일**
- [ ] 피드백 트리아지 · 긴급 이슈 대응
- [ ] Post-launch backlog 정리

---

## 위험 · 완화

| 위험 | 확률 | 완화 |
|---|:-:|---|
| Workers AI 10k neurons/day 초과 (바이럴 시) | 높음 | 유저당 일 cap · 대기열 · 선택적 BYOK |
| 악성 agent (스팸, NSFW) | 중 | 초기 invite-only · LLM 모더레이션 · report 버튼 |
| 진화 엔진 품질 나쁨 (shadow eval 실패) | 중 | 5 strategies 다양화 · auto-rollback · creator toggle |
| Cron 1분 지연 불만 | 낮 | agent feed 에서 "last run" 타임스탬프 노출 |
| D1 5GB 초과 | 낮 | 10만 agents 필요, 초과 시 R2 archive |
| Axiom 500GB 초과 | 낮 | run 1건 5KB · 1,000 run/일 = 150MB/월 · 여유 3,300배 |
| Resend 3k mail/월 초과 (v2 알림) | 중 | 이메일 대신 in-app 알림 fallback |
| 런칭 시점 경쟁자 (LangGraph 에 fork 기능 추가) | 중 | Week 13 invite-only seed · 원작자 credit 강조 |
| 수익 모델 불명확 | 중 | 1년 OSS + GitHub Sponsors · Enterprise tier 는 후행 실험 |

---

## 런칭 후 지표 (Week 14 + 30일)

| 지표 | 보수 | 목표 | 성공 |
|---|:-:|:-:|:-:|
| GitHub star | 300 | 1,500 | 5,000 |
| 활성 유저 (DAU) | 50 | 300 | 1,000 (Free tier 한계) |
| 공개 agent 수 | 100 | 500 | 2,000 |
| Fork 비율 | 10% | 20% | 35% |
| v2 suggestion 수락률 | 25% | 40% | 60% |
| Product Hunt | Top 20 | Top 10 | Top 3 |
| HN Front page | 1회 | 2회 | Top 10 |
| 영입 cold outreach | 2 | 5 | 10+ |
| **인프라 비용 유지** | **$0** | **$0** | **$0** |

---

## Paid 전환 예상 시점 (런칭 후 6개월)

트리거 시점이 오면:
- Workers Paid $5 → DO·Queues 복원
- 커스텀 도메인 `weaver.dev` 등록
- Axiom Pro or Jaeger self-host

모든 결정은 **유료 tier($49/팀 cloud-hosted) 수익 발생 후**. 그 전엔 $0 유지.
