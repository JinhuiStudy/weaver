# @weaver/runtime-edge

> **에이전트 런타임 — Cloudflare Workers + D1 + Cron Triggers** (Durable Objects 없음)

## 상태 (2026-04-21)

🚀 **라이브 배포**: https://weaver-runtime.jinhuistudy.workers.dev

| 바인딩 | 리소스 |
|---|---|
| `AI` | Workers AI (10k neurons/day 무료) |
| `DB` | D1 `weaver-db` (`a07b1744-70c6-4e5c-9934-41ac804a24cc`) |
| Cron | `* * * * *` (매 1분) |

## 엔드포인트

| Method · Path | 역할 |
|---|---|
| `GET /health` | `{ ok: true, version: "0.0.0" }` |
| `POST /api/compose` | NL prompt + canvas snapshot → graph diff (Workers AI 또는 offline stub) |
| `POST /api/runs` | `agent_runs` INSERT · 그래프 스냅샷 저장 · `{ id, status: "pending" }` 반환 |

## `scheduled()` 흐름

1. D1 에서 `status IN ('pending','running')` 행 최대 10개 SELECT (`next_step_at` 필터)
2. `graph_json` 으로 버킷팅 → 그래프별 `processPendingRuns` 호출
3. 각 run 한 스텝 진행 → `status / current_node_id / state / completed_at` UPDATE

핵심 파일: [`src/index.ts`](./src/index.ts), [`src/executor/step.ts`](./src/executor/step.ts), [`src/cron.ts`](./src/cron.ts)

## 개발

```bash
# 로컬 개발 (miniflare + D1)
doppler run --project weaver --config dev -- pnpm exec wrangler dev --port 8787 --local

# 테스트
pnpm test:run          # 단위 (vitest)
pnpm test:integration  # 통합 (vitest-pool-workers + miniflare D1)

# 배포
doppler run --project weaver --config dev -- pnpm exec wrangler deploy
```

## 마이그레이션

```bash
# 로컬 (miniflare)
wrangler d1 execute weaver-db --local --file=migrations/0001_agent_runs.sql
wrangler d1 execute weaver-db --local --file=migrations/0002_graph_snapshot.sql

# 리모트 (프로덕션) — Doppler 필수
doppler run --project weaver --config dev -- pnpm exec wrangler d1 execute weaver-db --remote --file=migrations/0001_agent_runs.sql
doppler run --project weaver --config dev -- pnpm exec wrangler d1 execute weaver-db --remote --file=migrations/0002_graph_snapshot.sql
```

## 왜 Durable Objects 안 쓰나

Workers Paid $5/월 필수. ADR-006 "Free-tier First" 정책. D1 + Cron + self-fetch 로 대체.

자세히: [`../../docs/decisions/ADR-002-runtime-d1-cron.md`](../../docs/decisions/ADR-002-runtime-d1-cron.md)

## 다음 개발 (Phase 1 잔여 + Phase 2)

- **OTEL tracer** (`src/otel/`) — Axiom Free OTLP/HTTP exporter
- **Tool Registry** (`src/tools/`) — HTTP · SQL · Slack · Stripe + permission 체크
- **Error handling** — failed run retry · `retry_count` 기반 backoff
- **`GET /runs/:id/stream`** — SSE for live trace UI

참고:
- [`../../docs/ARCHITECTURE.md#2-agent-runtime`](../../docs/ARCHITECTURE.md)
- [`../../docs/NEXT.md`](../../docs/NEXT.md) — 지금 해야 할 작업
