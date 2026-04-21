# @weaver/runtime-edge

> 에이전트 런타임 — **Cloudflare Workers Free + D1 + Cron Triggers** (Durable Objects 없음)

## 책임

1. **Hono app** — API 엔드포인트 (`/runs`, `/canvas`, `/compose`, `/eval`, `/deploy`)
2. **Agent Run 실행** — D1 `agent_runs` 레코드 단위, Cron + self-fetch 이중 실행
3. **LLM 라우팅** — Workers AI (기본) + 유저 BYOK (Claude/OpenAI)
4. **Tool Registry 실행** — HTTP / SQL / Slack / Stripe + 커스텀
5. **OTEL 계측** — Axiom Free 로 trace 전송
6. **Cron** — 매 1분 pending run 처리

## 왜 Durable Objects 안 쓰나

Workers Paid $5/월 필수. ADR-006 "Free-tier First" 정책에 따라 D1 + Cron + self-fetch로 대체.
자세히: [ADR-002](../../docs/decisions/ADR-002-runtime-d1-cron.md)

## 개발 예정 구조

```
apps/runtime/
├── src/
│   ├── index.ts                    # Hono + Cron export
│   ├── routes/
│   │   ├── runs.ts                 # POST /runs · GET /runs/:id/stream
│   │   ├── canvas.ts               # PUT /canvas/:id/snapshot
│   │   ├── compose.ts              # POST /api/compose (NL → nodes)
│   │   ├── eval.ts                 # POST /eval/run
│   │   └── deploy.ts               # POST /deploy/promote
│   ├── cron.ts                     # scheduled handler
│   ├── executor/
│   │   ├── step.ts                 # executeOneStep()
│   │   ├── graph.ts                # 다음 노드 계산
│   │   └── self-fetch.ts           # ctx.waitUntil(fetch) 패턴
│   ├── llm/
│   │   ├── router.ts               # Workers AI + BYOK
│   │   ├── adapters/
│   │   │   ├── workersai.ts        # Cloudflare Workers AI
│   │   │   ├── anthropic.ts        # Claude (BYOK)
│   │   │   └── openai.ts           # OpenAI (BYOK)
│   │   ├── cache.ts                # Claude prompt caching
│   │   └── cost.ts                 # neurons / tokens → USD
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── permission.ts
│   │   └── builtin/{http,sql,slack,stripe}.ts
│   └── otel/
│       ├── tracer.ts               # minimal OTEL SDK
│       └── axiom.ts                # OTLP/HTTP → Axiom Free
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## wrangler.toml 예시 (핵심)

```toml
name = "weaver-runtime"
main = "src/index.ts"
compatibility_date = "2026-04-20"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"                      # Workers AI (무료 10k neurons/day)

[[d1_databases]]
binding = "DB"
database_name = "weaver-db"

[[r2_buckets]]
binding = "FILES"
bucket_name = "weaver-files"

[[kv_namespaces]]
binding = "FLAGS"
id = "..."

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "weaver_counters"

[triggers]
crons = ["* * * * *"]              # 매 1분

[vars]
INTERNAL_URL = "https://weaver-runtime.your-subdomain.workers.dev"

# AXIOM_TOKEN, SENTRY_DSN, INTERNAL_TOKEN 은 wrangler secret put 으로
```

## 상태

📦 빈 디렉토리. Week 3 (2026-W19) Hono 엔트리 + Week 4 Cron + executor 시작.

참고:
- [`../../docs/ARCHITECTURE.md#2-agent-runtime`](../../docs/ARCHITECTURE.md)
- [`../../docs/decisions/ADR-002-runtime-d1-cron.md`](../../docs/decisions/ADR-002-runtime-d1-cron.md)
- [`../../docs/decisions/ADR-006-free-tier-first.md`](../../docs/decisions/ADR-006-free-tier-first.md)
