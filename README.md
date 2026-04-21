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

- **React Router v7 Framework Mode** · **TypeScript 5.9 strict** · **Tailwind CSS 4** · **shadcn/ui**
- **xyflow v12** (캔버스) · **Monaco** · **Yjs + y-indexeddb** (local-first)
- **Zustand + TanStack Query + nuqs** · **react-hook-form + valibot**
- **Cloudflare Workers + Pages + D1 + R2 + KV + Cron + Workers AI** (전부 무료)
- **Hono 4** · **Drizzle ORM**
- **Axiom Free** (OTEL) · **Sentry Developer** (에러)
- **Vitest 3** · **Playwright 1.5x** · **MSW 2** · **Biome 2**
- **GitHub Actions** (퍼블릭 레포 무제한 무료)

## 💰 비용

**MVP: $0/월**

자세한 근거: [`docs/decisions/ADR-006-free-tier-first.md`](./docs/decisions/ADR-006-free-tier-first.md)

## 상태

🏗️ **Ready for Week 1 kickoff** — 문서 42 파일 · 517KB · ADR 6건 · spec 6건 · design system 완성.
**코드 시작일: 2026-W17 (2026-04-27 월)**.

## 🚀 시작하기

첫 접속이라면 순서대로:

1. **[`docs/KICKOFF.md`](./docs/KICKOFF.md)** — 0시간부터 첫 커밋까지 (3시간, $0)
2. **[`docs/WEEK-1-PLAN.md`](./docs/WEEK-1-PLAN.md)** — Day-by-day 실행 계획

## 빠른 읽기 순서

1. [`docs/VISION.md`](./docs/VISION.md) — 왜 이것이 새 카테고리인가
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 4 레이어 + mermaid (D1 + Cron 기반)
3. [`docs/PRODUCT.md`](./docs/PRODUCT.md) — 킬러 피처 6개
4. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 14주 주차별 마일스톤
5. [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) — 선택 + 무료 tier 한도
6. [`docs/COMPETITION.md`](./docs/COMPETITION.md) — 포지셔닝
7. [`docs/LAUNCH.md`](./docs/LAUNCH.md) — 5채널 런칭 전략
8. [`docs/decisions/`](./docs/decisions/) — ADR 6건
9. [`specs/`](./specs/) — **design-system** · **screens** · node-types · tool-registry · observability · eval
10. [`example/design/`](./example/design/) — Claude Design HTML 라이브 데모 + `tokens.css` (420+ 토큰)

## 라이선스

Apache 2.0 — [`LICENSE`](./LICENSE)

자체 호스팅 가이드는 Week 14 런칭 준비 시 `docs/self-host/` 에 추가:
- Ollama (Workers AI 대신)
- Jaeger (Axiom 대신)
- GlitchTip (Sentry 대신)
- y-websocket on Fly.io Free (실시간 협업 확장)

---

Maintained by **박진희 (JinhuiStudy)** · `dev.park.jinhui@gmail.com`
