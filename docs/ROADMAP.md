# Roadmap — 14주 주차별 마일스톤 ($0 Free-tier)

> **시작 기준**: 2026-W17 (2026-04-27) 첫 커밋
> **런칭 목표**: Week 14 = 2026-W30
> **예산**: $0 (ADR-006)
>
> **실제 실행 시**:
> - 최초 1회 세팅 → [`KICKOFF.md`](./KICKOFF.md) (Phase A–E, ~3시간)
> - Week 1 Day-by-Day → [`WEEK-1-PLAN.md`](./WEEK-1-PLAN.md)

---

## Phase 1 — Scaffold & Core (Week 1-4)

### Week 1 · "Hello Canvas"
**목표**: 레포 초기화 + **디자인 토큰 주입** + 빈 캔버스 노드 드래그

- [ ] pnpm workspaces 설정
- [ ] **`example/design/tokens.css` → `apps/web/app/styles/tokens.css` import, Tailwind v4 `@theme` 바인딩**
- [ ] Inter + JetBrains Mono 웹폰트 로드
- [ ] `apps/web` — RR7 Framework Mode + Tailwind 4 + shadcn/ui 초기 3 컴포넌트 (Button · Input · Card) 토큰 기반 재스타일
- [ ] `apps/web` — xyflow 통합, 빈 canvas backdrop(24px dot grid) + Agent 노드 1개 드래그
- [ ] `packages/core` — Node·Edge·Graph 기본 타입 (valibot)
- [ ] Vitest + Playwright 스캐폴드
- [ ] **GitHub Actions** 기본 파이프라인 (typecheck, biome, vitest, build)
- [ ] Cloudflare Pages 최초 배포 — `weaver.pages.dev`

**산출물**: `https://weaver.pages.dev` 접속 → 빈 캔버스 + 노드 드래그. **비용 $0.**

### Week 2 · "노드 프리미티브 5종 + 디자인 적용"

- [ ] `packages/core` — Input/Agent/Tool/Branch/Output valibot 스키마 (`specs/node-types.md`)
- [ ] `apps/web/components/canvas/nodes/` — 5 노드 컴포넌트
  - Anatomy: type dot(6×6) + kicker(9 mono UPPERCASE) + label(13/600) + divider + body(11 mono)
  - Border: `color-mix(in srgb, var(--node-color) 40%, var(--border-strong))`
  - 7 상태(default/hover/selected/running/error/warning/disabled/ok) 구현
- [ ] 엣지: default/selected/flowing(dashed anim)/error 4 타입
- [ ] Port: 10×10 · 5 상태 (empty/connected/hover/dragging/invalid)
- [ ] 노드 속성 사이드 패널 + Monaco 에디터 + kbd 힌트
- [ ] 캔버스 상태 Zustand + **y-indexeddb 로컬 영속**
- [ ] D1 테이블 생성 (`canvas_snapshots`, `tools`, `tool_versions`)

**산출물**: 5 노드 드래그·연결·편집·저장. 새로고침해도 로컬 보존.

### Week 3 · "NL Composer — Workers AI로 자연어 생성"

- [ ] `apps/runtime` — Hono app 스캐폴드, Worker 엔트리
- [ ] `/api/compose` 엔드포인트
- [ ] **Workers AI 바인딩** (Llama 3.3 70B 기본 모델)
- [ ] BYOK 경로 (유저가 Claude/OpenAI 키 입력 시 라우팅)
- [ ] System prompt: 현재 그래프 JSON + 유저 입력 → diff JSON
- [ ] Frontend DiffPreview UI
- [ ] 수락 시 Zustand + Y.Doc apply

**산출물**: "환불 신청 처리 에이전트 만들어줘" → 4 노드 자동 생성 **(Workers AI 무료)**.

### Week 4 · "에이전트 런타임 α — D1 + Cron"

- [ ] D1 스키마: `agent_runs`, `run_history`
- [ ] `apps/runtime/executor/step.ts` — `executeOneStep()`
- [ ] `apps/runtime/cron.ts` — scheduled handler (매 1분)
- [ ] Self-fetch 패턴 (`ctx.waitUntil(fetch(/internal/step))`)
- [ ] Workers AI LLM 어댑터
- [ ] HTTP 툴 1개 (빌트인)
- [ ] SSE `/api/runs/:id/stream` (D1 row 1s 폴링 기반)
- [ ] Frontend: Trace 패널 실시간 업데이트

**산출물**: 환불 에이전트 실행 → 캔버스 옆 패널 실시간 노드 진행 표시.

---

## Phase 2 — Observability & Tools (Week 5-8)

### Week 5 · "OTEL + Axiom"

- [ ] `apps/runtime/otel/` — OTEL SDK (minimal)
- [ ] GenAI 스펙 span attributes (`gen_ai.*`)
- [ ] Axiom OTLP/HTTP exporter (배치 10s)
- [ ] Axiom Free 계정 가입 + dataset 생성
- [ ] `wrangler secret put AXIOM_TOKEN`
- [ ] `specs/observability-schema.md` 확정

**산출물**: 실행 1건 → Axiom에 5-20 spans. APL 쿼리로 검증. **무료 500GB/월.**

### Week 6 · "Trace Viewer"

- [ ] `packages/observability` — Trace 데이터 모델
- [ ] `apps/web/components/trace/TimelineView.tsx` — Canvas waterfall
- [ ] `apps/web/components/trace/CostHeatmap.tsx` — 비용·지연
- [ ] `/tools/:id/runs/:runId` 상세 페이지
- [ ] Axiom API에서 단일 run 전체 trace fetch
- [ ] 노드별 입출력 JSON diff (react-diff-viewer)

**산출물**: 실행 완료 → 2초 안에 trace 패널 렌더. 각 span 클릭 시 프롬프트·응답 표시.

### Week 7 · "툴 레지스트리 + 4 빌트인"

- [ ] `packages/core/tool.ts` — `defineTool()` 팩토리
- [ ] `apps/runtime/tools/builtin/{http,sql,slack,stripe}.ts`
- [ ] 툴 레지스트리 UI `/admin/tools`
- [ ] Custom HTTP 툴 추가 폼 (URL, method, auth, schema)
- [ ] Permission token (HMAC 서명 + scope 검증)

**산출물**: CS 환불 시나리오를 캔버스에서 End-to-end 실행 (Stripe 테스트 계정).

### Week 8 · "Time-Travel 디버깅"

- [ ] D1 `run_history` 결정론 저장 (LLM 응답 캐시)
- [ ] R2 대용량 페이로드 분리 저장
- [ ] `/runs/:id/replay` 엔드포인트 (cache hit 우선)
- [ ] Frontend "프롬프트 수정 후 재생" 버튼
- [ ] diff view (원본 vs 재생 결과)

**산출물**: Run #123 → 프롬프트 한 줄 수정 → 재생 → 결과 diff.

---

## Phase 3 — Eval · Deploy · Polish (Week 9-12)

### Week 9 · "Eval Runner"

- [ ] `packages/eval` — DSL 파서 (`specs/eval-dsl.md`)
- [ ] R2 데이터셋 저장, D1 `eval_datasets` 메타
- [ ] Cron 기반 배치 실행 (각 case = 새 agent_run)
- [ ] Frontend `/tools/:id/eval` 페이지
- [ ] 결과 매트릭스 (버전 × 데이터셋)

**산출물**: 30건 데이터셋 업로드 → eval 실행 → 정확도 93% 결과.

### Week 10 · "배포 게이트 + Shadow Traffic"

- [ ] 버전 개념 (`tool.published_version`, `shadow_version`, `shadow_sample_rate`)
- [ ] Runtime에서 요청 수신 시 `ctx.waitUntil(shadowExecution)`
- [ ] 비교 뷰 v1 vs v2 (정확도·비용·지연)
- [ ] 승격 버튼 (eval 통과 강제)

**산출물**: v2 shadow 10% 배포 → 하루 후 v1 비교 지표.

### Week 11 · "폴리싱 + Local-first 강화"

> **변경**: 기존 Yjs 멀티유저 대신 **local-first 강화**에 집중. 실시간은 Phase 2(post-launch) 확장.

- [ ] y-indexeddb 오프라인 완전 동작 검증
- [ ] D1 스냅샷 merge 로직 견고화 (concurrent save 시 Y.applyUpdate로 CRDT merge)
- [ ] `specs/sync-strategy.md` 작성
- [ ] UI: 마지막 저장 시각 표시 + 동기화 상태 인디케이터
- [ ] (Stretch) Fly.io 무료 VM y-websocket 서버 시험 배포 (Phase 2 준비)

**산출물**: 오프라인 편집 후 복귀 시 매끄러운 merge. 실시간 협업은 post-launch.

### Week 12 · "RBAC · 감사 · 비용 가드레일"

- [ ] `viewer / editor / admin` 3 역할
- [ ] D1 `audit_event` 테이블 (CRUD + 배포 + 실행)
- [ ] 툴 단위 월 예산 (D1 기반 차단)
- [ ] 실행 전 예상 비용 표시 (프롬프트 토큰 × 단가, Workers AI neurons 단위)
- [ ] GitHub OAuth 로그인 (무료)

**산출물**: 유료 팀 수용 준비 수준 보안·감사·예산.

---

## Phase 4 — Launch (Week 13-14)

### Week 13 · "문서 · 데모 · 랜딩"

- [ ] `apps/docs-site` — Astro + Starlight
- [ ] 가이드 10편 (Getting started, 5 시나리오, 커스텀 툴, eval, shadow, self-host)
- [ ] 랜딩 페이지 (`weaver.pages.dev`)
- [ ] **Self-host 가이드** (`docs/self-host/`):
  - `ai-ollama.md` — Workers AI 대신 Ollama
  - `trace-jaeger.md` — Axiom 대신 Jaeger + ClickHouse on Oracle Cloud Free
  - `error-glitchtip.md` — Sentry 대신 GlitchTip Docker
  - `collab-yjs-fly.md` — Yjs 실시간 Fly.io 무료
- [ ] 데모 영상 × 5 (각 3분, 시나리오 A-E)
- [ ] Product Hunt 자산 (GIF × 30)
- [ ] Discord 서버 개설

### Week 14 · "런칭"

**월요일**
- [ ] GitHub repo public
- [ ] `weaver.pages.dev` 최종 배포
- [ ] Discord 공개
- [ ] X 스레드 (10 트윗, GIF 5)
- [ ] dev.to 영문 Part 1
- [ ] velog 한글 버전

**화요일 00:01 PST (= 17:01 KST)**
- [ ] Product Hunt 발행
- [ ] HN "Show HN: Weaver"

**수요일-금요일**
- [ ] 피드백 트리아지
- [ ] Issue 첫 기여자 환영
- [ ] 미디어 outreach (TechCrunch, Latent Space, Changelog)

---

## 위험 · 완화

| 위험 | 확률 | 완화 |
|---|:-:|---|
| Workers Free 100k req/day 초과 | 낮 | Cron 1분 간격 유지, rate limit middleware |
| Cron 1분 지연 불만 | 중 | Self-fetch 패턴으로 실시간 수준 |
| Workers AI 모델 품질 불충분 | 중 | BYOK Claude/OpenAI 경로 강조 (유저 선택) |
| Axiom 500GB 초과 | 낮 | MVP 단계엔 불가능. 초과 시 Jaeger self-host |
| D1 5GB 초과 | 낮 | 툴 10만개 필요. 초과 시 Postgres(Neon Free) 마이그레이션 |
| 런칭 시점 경쟁자 등장 | 중 | Week 12에 private beta 10팀 확보 |

---

## 런칭 후 지표 (12주 후)

| 지표 | 보수 | 목표 | 성공 |
|---|:-:|:-:|:-:|
| GitHub star | 500 | 2,000 | 5,000 |
| Discord 멤버 | 100 | 500 | 1,500 |
| 자체 호스팅 팀 | 10 | 50 | 200 |
| Product Hunt | Top 20 | Top 10 | Top 3 |
| HN Front page | 1회 | 2회 | 3회 |
| 영입 cold outreach | 2 | 5 | 10+ |
| **인프라 비용 유지** | **$0** | **$0** | **$0** |

---

## Paid 전환 예상 시점 (런칭 후 6개월)

트리거 시점이 오면:
- Workers Paid $5 → DO·Queues 복원
- 커스텀 도메인 `weaver.dev` 등록
- Axiom Pro or Jaeger self-host

모든 결정은 **유료 tier($49/팀 cloud-hosted) 수익 발생 후**. 그 전엔 $0 유지.
