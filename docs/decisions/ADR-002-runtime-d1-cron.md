# ADR-002 — Agent Runtime: D1 + Cron Triggers (not Durable Objects)

- **상태**: ✅ Implemented (2026-04-21) · 라이브 배포됨
- **Supersedes**: 초기 DO 기반 설계
- **관련**: ADR-006 (Free-tier First), ARCHITECTURE §2
- **구현**: `apps/runtime/src/index.ts` (`scheduled()` + `tickOnce`), `executor/step.ts`, migrations 0001+0002

## 맥락

에이전트 실행은 다음 요건이 필요하다:

1. **상태 영속** — 실행 중 재시작해도 이어서 진행
2. **격리** — 한 에이전트의 오류가 다른 에이전트에 전파되지 않음
3. **재개 가능** — LLM 응답, 툴 호출, 사람 승인 대기 수용
4. **관측 가능** — 모든 상태 전이가 trace로 남음
5. **저지연** — 엣지 글로벌 배치

**추가 제약 (ADR-006)**: 고정 월 비용 $0.

## 거부: Durable Objects

초기에는 Durable Objects로 결정했으나 **Workers Paid ($5/월) 필수**이므로 ADR-006 "Free-tier First" 정책에 따라 거부.

## 결정: D1 + Cron Triggers

```
┌─────────────────────────────────────────────────────────────┐
│ Client                                                       │
│   ├─ POST /runs     → 에이전트 실행 요청                       │
│   └─ GET /runs/:id  → SSE 스트림 (진행 상황)                   │
└─────────────┬───────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────┐
│ Worker (on-demand)                                           │
│   ├─ POST /runs     → D1에 run 레코드 INSERT (status=pending) │
│   ├─ GET /runs/:id  → D1 폴링 + SSE push                     │
│   └─ POST /runs/:id/step → 클라이언트 드리븐 즉시 step 실행       │
└─────────────┬───────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────┐
│ Cron Trigger Worker (매 1분)                                  │
│   ├─ SELECT * FROM runs WHERE status IN ('pending','running') │
│   │    AND (next_step_at IS NULL OR next_step_at <= NOW())   │
│   │    LIMIT 10                                              │
│   ├─ 각 run에 대해 1 step 실행 (LLM or tool 호출)              │
│   ├─ UPDATE runs SET status, step, next_step_at              │
│   └─ OTEL span → Axiom                                       │
└─────────────┬───────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────┐
│ D1 Tables                                                    │
│   ├─ runs              (실행 메타, 상태, 현재 step)           │
│   ├─ run_history       (각 step 실행 이벤트, 재생 가능)       │
│   └─ run_pending_tools (사람 승인 대기 등)                   │
└─────────────────────────────────────────────────────────────┘
```

### 상태 머신 (D1 컬럼으로 표현)

```sql
CREATE TABLE agent_runs (
  id              TEXT PRIMARY KEY,           -- ULID
  tool_id         TEXT NOT NULL,
  tool_version    INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN (
    'pending', 'running',
    'waiting_llm', 'waiting_tool', 'waiting_human',
    'complete', 'failed'
  )),
  input           TEXT NOT NULL,              -- JSON
  current_node_id TEXT,
  state           TEXT NOT NULL DEFAULT '{}', -- JSON: 각 노드 output 누적
  next_step_at    INTEGER,                    -- Unix ms, NULL = 즉시
  retry_count     INTEGER DEFAULT 0,
  cost_usd_micro  INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE INDEX idx_pending ON agent_runs(status, next_step_at)
  WHERE status IN ('pending', 'running');

CREATE TABLE run_history (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES agent_runs(id),
  node_id         TEXT NOT NULL,
  node_type       TEXT NOT NULL,
  input           TEXT,                       -- JSON
  output          TEXT,                       -- JSON
  duration_ms     INTEGER,
  cost_usd_micro  INTEGER,
  trace_id        TEXT,                       -- Axiom 조인용
  span_id         TEXT,
  error_message   TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_history_run ON run_history(run_id, created_at);
```

### 실행 로직

```typescript
// apps/runtime/src/cron.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const pending = await env.DB.prepare(`
      SELECT * FROM agent_runs
      WHERE status IN ('pending', 'running')
        AND (next_step_at IS NULL OR next_step_at <= ?)
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(Date.now()).all()

    // 병렬 처리 (Worker 30s CPU 한계 내)
    await Promise.all(pending.results.map(run => executeOneStep(run, env)))
  },
}

async function executeOneStep(run: AgentRun, env: Env) {
  const tracer = createTracer(env.AXIOM_TOKEN)
  return tracer.startActiveSpan('weaver.run.step', async (span) => {
    try {
      span.setAttribute('weaver.run_id', run.id)
      const graph = await loadGraph(run.tool_id, run.tool_version, env)
      const nextNode = computeNextNode(graph, run)

      const result = await executeNode(nextNode, run.state, env, span)

      const nextStepAt = result.done ? null : Date.now()  // 즉시 다음 step
      await env.DB.prepare(`
        UPDATE agent_runs
        SET status = ?, state = ?, current_node_id = ?, next_step_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        result.done ? 'complete' : 'running',
        JSON.stringify(result.newState),
        result.nextNodeId,
        nextStepAt,
        Date.now(),
        run.id,
      ).run()
    } catch (err) {
      await markFailed(run.id, err, env)
    }
  })
}
```

### Self-fetch 패턴 (Cron 1분 지연 해결)

Cron은 1분 간격이라 긴 체인에서 누적 지연 발생. 해결책:

```typescript
// 각 step 완료 직후 즉시 다음 step 호출 (Worker → Worker)
if (!result.done) {
  // ctx.waitUntil로 백그라운드 fire-and-forget
  ctx.waitUntil(
    fetch(`${env.WORKER_URL}/runs/${run.id}/step`, {
      method: 'POST',
      headers: { 'X-Internal-Token': env.INTERNAL_TOKEN },
    })
  )
}
```

- **결과**: 체인 에이전트도 초 단위로 진행
- **Cron은 fallback** — self-fetch 실패 시 매 1분 pick-up

### Human-in-the-loop

승인 대기:
```sql
UPDATE agent_runs SET status = 'waiting_human', next_step_at = NULL WHERE id = ?
```
Cron은 이 run을 선택하지 않음. 승인 URL 호출 시:
```sql
UPDATE agent_runs SET status = 'running', next_step_at = ? WHERE id = ?
```
Cron 또는 self-fetch로 재개.

### Retry

```sql
UPDATE agent_runs SET
  status = 'running',
  retry_count = retry_count + 1,
  next_step_at = ? + (1000 * POWER(2, retry_count))  -- exponential backoff
WHERE id = ?
```

## 비교 매트릭스

| 요건 | DO 방식 | D1 + Cron 방식 | 평가 |
|---|---|---|---|
| 상태 영속 | DO storage | D1 | 동등 |
| 격리 | 1 DO = 1 run | D1 row-level, transaction | 동등 |
| 재개 | alarm + storage | status + next_step_at | 동등 |
| 관측 | OTEL span | OTEL span | 동등 |
| 저지연 | <200ms | self-fetch 시 <500ms, Cron fallback 최대 60s | 약간 저하 |
| **비용** | **$5/월** | **$0** | **핵심** |
| 긴 체인 | 자연스러움 | self-fetch 체인 | 동등 |
| 동시성 | DO isolate | D1 transaction + Worker 병렬 | 동등 |
| **구현 복잡도** | DO class 설계 | SQL + 상태 머신 | D1 약간 단순 |

## 위험 · 완화

| 위험 | 완화 |
|---|---|
| Worker 30s CPU 제한 | 1 step = 1 LLM or tool call로 제한. 30s 내 충분 |
| Cron 분 단위 지연 | self-fetch 패턴으로 실시간 수준 유지 |
| D1 쓰기 속도 (초당 ~1000 writes) | Worker AI가 병목이지 D1이 아님 |
| 동시 Cron 실행 race | `UPDATE ... WHERE status='pending'` optimistic locking |
| Worker 100k req/day 한도 | DAU 5k+까지 OK, 초과 시 ADR-006 트리거 |

## 확장 경로 (Paid 전환)

트리거 (ADR-006):
- DAU > 5k 또는 에이전트 실행 > 10k/day → Workers Paid + Durable Objects
- 마이그레이션: `agent_runs` 테이블 → DO 인스턴스로 1:1 매핑. 스키마·API 동일 유지.
- `packages/runtime/AgentExecutor` 인터페이스가 DO/D1 양쪽 구현 수용

## 참고

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare D1 transactions](https://developers.cloudflare.com/d1/sql-api/transactions/)
- [Worker CPU limits](https://developers.cloudflare.com/workers/platform/limits/)
