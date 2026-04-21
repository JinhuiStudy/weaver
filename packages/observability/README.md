# @weaver/observability

> OTEL GenAI exporter (→ Axiom Free) + Trace Viewer React 컴포넌트

## 의도

OTEL GenAI 스펙 span을 수신·조회하는 백엔드 유틸 + 시각화 UI 컴포넌트 모두 포함.

## 주요 export (예정)

### 서버 (Cloudflare Worker)

```typescript
export function createOtlpHandler(config: OtlpConfig): Handler
export class ClickhouseExporter { /* OTLP → ClickHouse */ }
export async function queryTraces(filter: TraceFilter): Promise<Trace[]>
export async function streamRun(runId: string): ReadableStream
```

### 클라이언트 (React)

```typescript
export function TracePanel({ runId }: { runId: string })
export function TimelineView({ spans }: { spans: Span[] })
export function CostHeatmap({ runs }: { runs: Run[] })
```

## 의존성

- `@weaver/core`
- `@opentelemetry/sdk-trace-base` (표준)
- 서버: 없음 (Cloudflare 기본)
- 클라이언트: `react`, `recharts`, `d3-scale`

## 상태

📦 빈 디렉토리. Week 5-6 (2026-W21-22) OTEL 계측 + Trace Viewer 구현.
