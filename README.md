# Weaver

> **AI 에이전트를 내부툴의 원자 단위로 만드는 오픈소스 플랫폼**
> Weave agents, tools, and observability into one fabric.
> **$0 — 고정 월 비용 없이 런칭 가능한 풀 엣지 스택.**

---

## 한 문장

자연어로 내부툴을 만들면, 그 툴은 **AI 에이전트 워크플로우**로 돌아가고, 모든 실행은 **자동으로 trace·비용·eval**이 붙는다. **전부 무료 tier만으로.**

## 왜

| 기존 | 문제 |
|---|---|
| **Retool** | AI-native 아님. 에이전트는 외부 호출. 유료 ($10~50/유저) |
| **v0.dev / Bolt** | UI만 생성. 런타임·관측·eval 없음. 유료 |
| **Langfuse / Braintrust** | 관측만. 제품 만들지 못함 |
| **n8n / Zapier** | 자동화 중심, 에이전트 일등 시민 아님 |

**Weaver**는 "에이전트 = 내부툴의 단위"라는 테제로 이 네 공백을 한 제품으로 차지한다. 그리고 **MVP까지 $0**.

## 제품 모습 (30초 데모)

1. CS 팀원이 사이드바에 입력: *"환불 신청받으면 주문 조회하고, 7일 이내면 승인, 아니면 매니저에게 Slack 알림"*
2. Weaver가 xyflow 캔버스에 4개 노드 생성: `webhook → stripe_lookup → policy_check → branch{approve | slack_notify}`
3. 각 노드 클릭으로 Monaco에서 프롬프트·스키마 조정
4. **Eval 데이터셋** (과거 환불 30건) 자동 실행 → 정확도 93%, 평균 $0.04, 2.1s
5. "배포" 클릭 → shadow 모드(실 트래픽 10% 복제) → 3일 후 100% 롤아웃
6. 라이브 trace에서 팀원이 문제 케이스 북마크 → 프롬프트 개선

## 4개 레이어 (전부 Cloudflare 무료 tier)

1. **Canvas Builder** — xyflow + Monaco + **Workers AI** 자연어 생성 (BYOK 옵션)
2. **Agent Runtime** — Cloudflare Workers + D1 + Cron Trigger (Durable Objects 대신 무료 대안)
3. **Observability Core** — OTEL GenAI → **Axiom Free (500GB/월)**, 빌더 옆 실시간 재생
4. **Eval Gate** — 데이터셋 × 어서션 DSL, 배포 전 자동 차단, shadow traffic 지원

## 트렌디 스택 ($0)

- **React Router v7 Framework Mode** · **TypeScript 5.9 strict** · **Tailwind CSS 4** · 커스텀 디자인 시스템
- **xyflow v12** (캔버스) · **Monaco** · **Yjs + y-indexeddb** (local-first)
- **Zustand + TanStack Query + nuqs** · **valibot**
- **Cloudflare Workers + Pages + D1 + R2 + KV + Cron + Workers AI** (전부 무료)
- **Hono 4** · **Drizzle ORM**
- **Axiom Free** (OTEL) · **Sentry Developer** (에러)
- **Vitest 3** · **Playwright 1.59** · **MSW 2** · **Biome 2.4**
- **GitHub Actions** (퍼블릭 레포 무제한 무료)

## 💰 비용

**MVP: $0/월**

자세한 근거: [`docs/decisions/ADR-006-free-tier-first.md`](./docs/decisions/ADR-006-free-tier-first.md)

---

## 🚀 현재 진행 상황 (2026-04-21 · Week 1 완료)

> **Phase 1 core 완료 · 라이브 배포됨.** Runtime + Web 모두 Cloudflare Workers 에서 퍼블릭 동작.

### 🌐 라이브 URL

| 서비스 | URL | 스택 |
|---|---|---|
| **Runtime** | https://weaver-runtime.jinhuistudy.workers.dev | Hono 4 · D1 · Cron · Workers AI |
| **Web (빌더)** | https://weaver-web.jinhuistudy.workers.dev | RR7 Framework Mode · Workers SSR |

### ✅ 완료된 것

**`apps/web` (배포됨)** — React Router v7 Framework Mode on Cloudflare Workers
- Claude Design v2 토큰 ⇒ Tailwind v4 `@theme` 바인딩 (raw hex 0)
- 컴포넌트 라이브러리: `Button`(7 variant) · `Input` · `Badge` · `Card` · `Tabs` · `Kbd` · `Tooltip` · `Skeleton` · `Empty` · `Toast`
- `WvNode` 캔버스 프리미티브 (5 type × 7 state) + xyflow `Handle` 통합
- **`/` 홈 히어로** — 브랜드 워드마크 · 4노드 데모 스트립 · 피처 카드
- **`/design` 쇼케이스** — 10개 섹션
- **`/builder/:id` 빌더** — 팔레트 드래그&드롭 · 포트 엣지 연결 · 인스펙터 valibot 검증 · Yjs + y-indexeddb 로컬 영속 · 단축키 버튼화 · help 패널
- **`/tools/:id/runs/:runId` Run 페이지** — 실행 상태 폴링

**`apps/runtime` (배포됨)** — Hono on Cloudflare Workers
- `POST /api/compose` — 자연어 → graph diff (Workers AI 바인딩 + stub fallback)
- `POST /api/runs` — D1 `agent_runs` INSERT · 그래프 스냅샷 저장
- `scheduled()` handler — Cron `* * * * *` · pending/running 행 SELECT → `processPendingRuns` → UPDATE
- `executor/step.ts` — state machine (input → agent → tool → branch → output)
- `executor/agent.ts` — `runAgent` with `{{ input.field }}` interpolation (Workers AI or BYOK)

**`packages/core`** — 공유 스키마 (순수 TS, zero React/DOM)
- 5개 노드 타입 valibot 스키마 · Edge 연결 매트릭스 · Graph DAG 검증
- **100+ tests**

**테스트 종합 (총 179+)**
- `packages/core` Vitest 단위: 100+
- `apps/runtime` Vitest 단위: 37 (stub parser · executor/step · runAgent · cron)
- `apps/runtime` vitest-pool-workers 통합: 7 (api-runs 4 + cron 3, 실제 miniflare D1)
- `apps/web` Playwright e2e: 42 (스크린샷 commit)

**프로덕션 E2E 검증됨**
- `POST /api/runs` → D1 `pending` row 저장
- Cron tick → `running(in)` → `running(out)` → `complete`, `completed_at` 기록
- run id `c325ba1e-b79b-483b-8557-d6c1b8dd19d8` 로 확인

**Infra**
- pnpm workspace · biome 2.4 · tsconfig strict · TypeScript 0 에러
- Doppler Free plan `weaver` project (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 등)
- D1 `weaver-db` remote 프로비저닝 · migrations 0001+0002 적용
- Cloudflare 계정: `cleanjhpark@gmail.com`
- GitHub Actions 워크플로우 (typecheck/lint/build/e2e)
- Repo: [`JinhuiStudy/weaver`](https://github.com/JinhuiStudy/weaver) (private)

### 🔜 다음 (`docs/NEXT.md` 참조)

- **OTEL + Trace Viewer** — Axiom Free ingest + `/tools/:id/runs/:runId` 실시간 재생
- **BYOK UX + 모델 선택 UI** — Claude/OpenAI 키 저장, 노드별 모델 지정
- **Eval α** — `packages/eval` DSL 파서 + 데이터셋 업로드 + accuracy/cost report
- **Tool registry** — HTTP/SQL tool definition + secret 주입

전체 로드맵: [`docs/ROADMAP.md`](./docs/ROADMAP.md) · 세부 우선순위: [`docs/NEXT.md`](./docs/NEXT.md)

---

## 🚀 로컬에서 돌려보기

```bash
# 최초 1회
pnpm install

# 개발 서버 (apps/web → http://localhost:5173)
pnpm dev
```

주요 페이지:
- **http://localhost:5173/** — 홈
- **http://localhost:5173/design** — 디자인 시스템 쇼케이스
- **http://localhost:5173/builder/demo** — 빌더 (빈 tool_id 자유롭게)

### 공통 스크립트

```bash
pnpm typecheck       # 전 패키지 tsc strict
pnpm lint            # biome check (CSS는 제외)
pnpm lint:fix        # 자동 포맷 + 수정
pnpm test:run        # packages/core Vitest
pnpm build           # 전 패키지 빌드

# apps/web 전용
pnpm --filter=@weaver/web test:e2e       # Playwright (headless)
pnpm --filter=@weaver/web test:e2e:ui    # Playwright UI 모드
```

---

## 📐 아키텍처

```
weaver/
├── apps/
│   ├── web/              # ✅ 빌더 UI — RR7 + Cloudflare Workers (배포됨)
│   │   ├── app/
│   │   │   ├── routes/          # home · design · builder.$id
│   │   │   ├── components/
│   │   │   │   ├── canvas/      # NodeCanvas · FlowNodeShell · Palette · Inspector
│   │   │   │   └── ui/          # Button · Badge · Card · Tabs · …
│   │   │   ├── stores/canvas.ts # Zustand (nodes/edges/selection/actions)
│   │   │   ├── lib/
│   │   │   │   ├── yjs-provider.ts        # Y.Doc + IndexeddbPersistence
│   │   │   │   └── useCanvasPersistence.ts
│   │   │   └── styles/tokens.css # 420+ 디자인 토큰
│   │   └── tests/         # Playwright + screenshots
│   ├── runtime/           # ✅ Hono on Workers + D1 + Cron (배포됨)
│   └── docs-site/         # 🔜 Astro (Week 13)
│
├── packages/
│   ├── core/              # ✅ valibot 스키마 · DAG 검증 · 100+ tests
│   ├── canvas/            # 🔜 xyflow 노드 재사용 컴포넌트
│   ├── runtime/           # 🔜 AgentExecutor
│   ├── observability/     # 🔜 OTEL exporter + Trace Viewer
│   └── eval/              # 🔜 DSL 파서 · runner
│
├── docs/                  # 📄 VISION · ARCHITECTURE · ROADMAP · ADR 6건
├── specs/                 # 📐 design-system · screens · node-types · tool-registry · observability · eval
└── example/design/        # 🎨 Claude Design HTML 라이브 데모 + tokens.css (단일 진실의 원천)
```

각 4개 레이어의 상세: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

## 📚 문서 읽기 순서

첫 방문이라면:
1. **[`docs/VISION.md`](./docs/VISION.md)** — 왜 이것이 새 카테고리인가
2. **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — 4 레이어 (D1 + Cron 기반)
3. **[`docs/PRODUCT.md`](./docs/PRODUCT.md)** — 킬러 피처 6개
4. **[`docs/ROADMAP.md`](./docs/ROADMAP.md)** — 14주 마일스톤

결정 근거:
- [`docs/decisions/`](./docs/decisions/) — ADR 6건 (특히 ADR-006 Free-tier First 가 핵심 정책)

구현 스펙:
- [`specs/design-system.md`](./specs/design-system.md) — 색·타이포·컴포넌트 규칙
- [`specs/screens.md`](./specs/screens.md) — 화면별 레이아웃
- [`specs/node-types.md`](./specs/node-types.md) — 노드 스키마 · UI 계약
- [`specs/tool-registry.md`](./specs/tool-registry.md) · [`specs/observability-schema.md`](./specs/observability-schema.md) · [`specs/eval-dsl.md`](./specs/eval-dsl.md)

경쟁 · 런칭:
- [`docs/COMPETITION.md`](./docs/COMPETITION.md) · [`docs/LAUNCH.md`](./docs/LAUNCH.md) · [`docs/TECH_STACK.md`](./docs/TECH_STACK.md)

---

## 라이선스

Apache 2.0 — [`LICENSE`](./LICENSE)

자체 호스팅 가이드는 Week 14 런칭 준비 시 `docs/self-host/` 에 추가:
- Ollama (Workers AI 대신)
- Jaeger (Axiom 대신)
- GlitchTip (Sentry 대신)
- y-websocket on Fly.io Free (실시간 협업 확장)

---

Maintained by **박진희 (JinhuiStudy)** · `dev.park.jinhui@gmail.com`
