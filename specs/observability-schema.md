# Spec — Observability Schema

> **OTEL GenAI 스펙 준수** + Weaver 확장. 저장소: **Axiom Free (500GB/월)** + 메타는 D1 `run_history`.

## 기반 표준

- **OpenTelemetry GenAI Semantic Conventions** (2025-04 stable)
- **OTLP/HTTP** JSON 포맷
- **Axiom Free** — 500GB/월 ingest, APL(Axiom Processing Language) 쿼리
- **D1 `run_history`** — 간단 조회용 (org 내 최근 N건)

## Trace 모델

한 `run` = 한 `trace`. run 안의 모든 LLM · tool · control flow는 span.

```
trace_id = run_id (ULID)
└─ span: "weaver.run"  (root, full duration)
   ├─ span: "weaver.node.input"
   ├─ span: "weaver.node.agent"
   │   └─ span: "gen_ai.chat_completion"   (LLM 호출)
   ├─ span: "weaver.node.tool"
   │   └─ span: "tool.http"                 (툴 호출)
   ├─ span: "weaver.node.branch"
   └─ span: "weaver.node.output"
```

## Span 속성

### 공통

| 속성 | 타입 | 예시 | 필수 |
|---|---|---|:-:|
| `weaver.run_id` | string | `01J7F...` | ✅ |
| `weaver.tool_id` | string | `cs-refund-agent` | ✅ |
| `weaver.tool_version` | int | `3` | ✅ |
| `weaver.org_id` | string | `org_abc` | ✅ |
| `weaver.node_id` | string | `01J7G...` | ✅ for node span |
| `weaver.node_type` | enum | `input\|agent\|tool\|branch\|output` | ✅ for node span |
| `weaver.node_label` | string | `Stripe Lookup` | ❌ |
| `weaver.span_kind` | enum | `llm\|tool\|control` | ✅ |
| `status` | enum | `ok\|error\|timeout` | ✅ |
| `error.message` | string | `HTTP 500` | only if error |

### LLM 스팬 (OTEL GenAI)

| 속성 | 예시 | 출처 |
|---|---|---|
| `gen_ai.system` | `cloudflare-workers-ai` / `anthropic` / `openai` | OTEL GenAI |
| `gen_ai.request.model` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | OTEL |
| `gen_ai.response.model` | 응답 모델 ID | OTEL |
| `gen_ai.request.temperature` | `0.7` | OTEL |
| `gen_ai.request.max_tokens` | `2048` | OTEL |
| `gen_ai.usage.input_tokens` | `523` | OTEL |
| `gen_ai.usage.output_tokens` | `127` | OTEL |
| `gen_ai.usage.cache_read_input_tokens` | `450` | Claude BYOK 시 |
| `gen_ai.usage.cache_creation_input_tokens` | `73` | Claude BYOK 시 |
| `gen_ai.response.finish_reason` | `end_turn\|tool_use\|max_tokens` | OTEL |
| `weaver.cost_usd_micro` | `4230` (= $0.00423) | Weaver 확장 |
| `weaver.byok` | `true\|false` | Weaver — 유저 키 사용 여부 |
| `weaver.workers_ai_neurons` | `12.3` | Weaver — Workers AI 실행 시 |

### Tool 스팬

| 속성 | 예시 |
|---|---|
| `tool.id` | `http` |
| `tool.version` | `1.0.0` |
| `tool.call_id` | ULID |
| `tool.input_size_bytes` | 412 |
| `tool.output_size_bytes` | 2048 |
| HTTP 전용: `http.method`, `http.url`, `http.status_code` | |
| SQL 전용: `db.system`, `db.statement` (REDACTED), `db.rows_affected` | |

### Branch 스팬

| 속성 | 예시 |
|---|---|
| `branch.condition_kind` | `expression\|llm_classifier` |
| `branch.chosen_output_id` | `approve` |
| `branch.outputs_count` | 2 |

## 저장소 (이원화)

### Axiom (풍부한 조회 · 집계)
- OTLP/HTTP 수신 엔드포인트
- 배치 10s flush (Worker 측 버퍼링)
- 500GB/월 무료
- APL 쿼리 · 대시보드 · 알림 내장

### D1 `run_history` (간단 조회 · 최근 N건)
- 실행 중 라이브 SSE 스트림용
- Axiom API 없이 "최근 실행 50건" 같은 간단 뷰
- 90일 TTL (Cron 정리 job)

```sql
CREATE TABLE run_history (
  id              TEXT PRIMARY KEY,           -- = span_id
  run_id          TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  tool_id         TEXT NOT NULL,
  tool_version    INTEGER NOT NULL,
  node_id         TEXT,
  node_type       TEXT,
  node_label      TEXT,
  span_kind       TEXT NOT NULL,              -- 'llm' | 'tool' | 'control' | 'input' | 'output'

  start_ns        INTEGER NOT NULL,
  end_ns          INTEGER NOT NULL,

  status          TEXT NOT NULL,              -- 'ok' | 'error' | 'timeout'
  error_message   TEXT,

  -- LLM 전용 (nullable)
  llm_system          TEXT,
  llm_model_request   TEXT,
  llm_input_tokens    INTEGER,
  llm_output_tokens   INTEGER,
  cost_usd_micro      INTEGER,

  -- Tool 전용
  tool_name       TEXT,
  tool_status_code INTEGER,

  -- Axiom 조인 키
  trace_id        TEXT NOT NULL,
  span_id         TEXT NOT NULL,

  -- 자유 필드
  attributes_json TEXT,                       -- JSON

  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_hist_run ON run_history(run_id, start_ns);
CREATE INDEX idx_hist_org_recent ON run_history(org_id, created_at DESC);
```

## 샘플 쿼리 (Axiom APL)

### 1. 특정 run의 전체 trace

```apl
['weaver-traces']
| where trace_id == "01J7F..."
| order by _time asc
```

### 2. 최근 24시간 툴별 실패율

```apl
['weaver-traces']
| where _time > ago(24h)
| where ['weaver.span_kind'] == "tool"
| where ['weaver.org_id'] == "org_abc"
| summarize
    total = count(),
    errors = countif(status == "error")
  by tool_id = ['weaver.tool_id'], node_label = ['weaver.node_label']
| extend error_rate = errors * 100.0 / total
| order by error_rate desc
```

### 3. LLM 비용 트렌드 (일별, 모델별)

```apl
['weaver-traces']
| where _time > ago(7d)
| where ['weaver.span_kind'] == "llm"
| where ['weaver.org_id'] == "org_abc"
| summarize
    cost_usd = sum(['weaver.cost_usd_micro']) / 1000000.0,
    input_tokens = sum(['gen_ai.usage.input_tokens']),
    output_tokens = sum(['gen_ai.usage.output_tokens'])
  by bin(_time, 1d), model = ['gen_ai.request.model']
| order by _time, cost_usd desc
```

### 4. p99 지연 (LLM 호출, 모델별)

```apl
['weaver-traces']
| where ['weaver.span_kind'] == "llm"
| where status == "ok"
| where _time > ago(7d)
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99)
  by model = ['gen_ai.request.model']
```

### 5. Workers AI vs BYOK 비용 비교

```apl
['weaver-traces']
| where _time > ago(30d)
| where ['weaver.span_kind'] == "llm"
| summarize
    count = count(),
    avg_cost = avg(['weaver.cost_usd_micro']) / 1000000.0,
    total_cost = sum(['weaver.cost_usd_micro']) / 1000000.0
  by byok = tostring(['weaver.byok'])
```

### 6. D1 로컬 — 최근 실행 50건 (SSE 스트림용)

```sql
SELECT * FROM run_history
WHERE org_id = ? AND tool_id = ?
ORDER BY created_at DESC
LIMIT 50;
```

## Trace Viewer UI

### 타임라인 (waterfall)
- x축: 시간 (ns)
- y축: span (node_type별 색상)
- 각 span 너비 = duration, 호버 시 속성 툴팁

### 비용 히트맵
- y축: 노드, x축: 분 단위 시간
- 셀 색상: $ (빨강=높음)

### 실시간 스트리밍
- SSE `/api/runs/:id/stream` → D1 `run_history` 1s 폴링 (구현 단순)
- live indicator

### 드릴다운
- span 클릭 → Axiom API로 full attributes fetch (지연 로드)
- R2 저장된 대용량 페이로드는 lazy-load

## R2 대용량 페이로드 저장

LLM 프롬프트·응답이 10KB 초과 시:

```
R2 key: {org_id}/{run_id}/{span_id}/prompt.json
         {org_id}/{run_id}/{span_id}/response.json
```

Span 속성에 `weaver.payload_url` 키만 저장. Viewer가 필요 시 fetch.

## 보존 정책

- **Axiom**: 500GB 한도 내 자동 보존. 한도 근접 시 가장 오래된 삭제
- **D1 `run_history`**: Cron 정리 (90일 TTL)
- **R2 payload**: 90일 TTL (Cron 정리)

Paid 전환 시:
- Axiom Pro로 업그레이드 → 1년 보존
- 또는 Jaeger self-host → 사용자 정책

## 프라이버시

- PII 자동 마스킹 (이메일·전화·카드번호 정규식) — span 보내기 전 `sanitize()` 거침
- `weaver.org_id` 기반 row-level security — 모든 APL 쿼리에 `where org_id == ?` 강제
- Weaver 관리자 권한도 유저 프롬프트 평문 직접 조회 불가 (옵션: 암호화 저장 + 조직별 키)

## Self-host 경로

Axiom 대신 Jaeger + ClickHouse:
- OTLP 수신: Jaeger Collector
- 저장: ClickHouse (Docker, Oracle Cloud Free 4 vCPU 24GB)
- 쿼리: Jaeger UI + Grafana
- 가이드: `docs/self-host/trace-jaeger.md` (Week 14)
