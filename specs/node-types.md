# Spec — Node Types

> 5개 노드 프리미티브의 스키마 · 실행 의미 · UI 계약.
> **시각 사양**은 [`design-system.md §8`](./design-system.md) · [`screens.md §3`](./screens.md) · `example/design/` 와이어프레임 참고.

## Visual Anatomy (모든 노드 공통)

```
┌─────────────────────────────┐   <- radius 10, border 1px
│ ● AGENT · CLAUDE            │      (border = node-color 40% blend)
│ policy_check                │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
│ model: sonnet-4-6           │
│ temp: 0.2 · cache: on       │
└────●─────────────────────●──┘
```

| 요소 | 크기 · 스타일 | 규칙 |
|---|---|---|
| **Type dot** | 6×6 · 2px radius | node-color · 6px glow |
| **Kind kicker** | 9px mono UPPERCASE · 0.1em | `AGENT · CLAUDE` 형식 |
| **Label** | 13px/600 · -0.005em | snake_case · 20자 이내 |
| **Body** | 11px mono · 1.55 lh · 4줄 max | 점선 divider 위 |
| **Port** | 10×10 circle · 2px border | -6px offset · bg-canvas border |
| **Status pill** | 상단 -8, 우측 12 | 모델명 · HTTP status · LIVE |
| **Duration pill** | 하단 -8, 우측 12 | 시간 · 비용 (실행 후) |

## 노드 색 (`design-system.md §2.5`)

| 타입 | Hex | 토큰 |
|---|---|---|
| Input | `#3B82F6` | `--node-input` |
| Agent | `#A855F7` | `--node-agent` |
| Tool | `#10B981` | `--node-tool` |
| Branch | `#F59E0B` | `--node-branch` |
| Output | `#EF4444` | `--node-output` |

Border: `color-mix(in srgb, var(--node-color) 40%, var(--border-strong))`

## 7가지 노드 상태

| 상태 | 스타일 |
|---|---|
| default | base |
| hover | `--shadow-raised` · `border-strong` |
| selected | indigo 2px ring · `--shadow-node-selected` |
| running | indigo border · conic-gradient rotate |
| error | red border · status-error-soft bg |
| warning | amber border · status-warning-soft bg |
| disabled | opacity 0.5 · saturate(0.3) |
| ok / complete | base + status-ok pill |

## Size Variants

| variant | 크기 | 구성 |
|---|---|---|
| **compact** | 140×48 | no kicker · label 12 · no body |
| **default** | 200×min | 전체 anatomy |
| **expanded** | 240×auto | status + duration pill + 4줄 body |

---


## 공통 필드

모든 노드는 다음 필드를 가진다:

```typescript
interface BaseNode {
  id: string                  // ULID
  type: NodeType              // 'input' | 'agent' | 'tool' | 'branch' | 'output'
  position: { x: number; y: number }  // 캔버스 좌표
  label: string               // 유저 노출 이름
  description?: string        // 툴팁
  retry?: RetryPolicy
  timeout_ms?: number
  version: number             // 버전 관리용
}

interface RetryPolicy {
  max_attempts: number        // 기본 3
  backoff: 'exponential' | 'fixed'
  initial_ms: number          // 기본 1000
}
```

## Node Types

### 1. Input

진입점. 워크플로우는 반드시 1개 이상의 Input 노드를 가진다.

```typescript
interface InputNode extends BaseNode {
  type: 'input'
  trigger: InputTrigger
  schema: ZodSchema           // input payload 타입
}

type InputTrigger =
  | { kind: 'webhook'; auth: 'none' | 'hmac' | 'bearer' }
  | { kind: 'schedule'; cron: string }
  | { kind: 'manual' }
  | { kind: 'api'; method: 'GET' | 'POST' | 'PUT' | 'DELETE' }
```

**실행**: 외부 이벤트 수신 → schema 검증 → 통과 시 워크플로우 시작.
**UI**: 🔵 파란색, 좌측 배치. 트리거 kind별 아이콘.

### 2. Agent

LLM 호출 노드. 프롬프트 + 모델 설정 + tool_choice 여부.

```typescript
interface AgentNode extends BaseNode {
  type: 'agent'
  model: ModelRef              // 'claude-sonnet-4-6' | 'gpt-5' | ...
  system_prompt: string        // Monaco 편집 대상
  user_prompt: string          // variable 보간 지원 ({{ input.email }})
  output_schema?: ZodSchema    // structured output 요구 시
  tool_choice: 'auto' | 'any' | 'none' | { name: string }
  temperature?: number
  max_tokens?: number
  use_prompt_cache: boolean    // Claude 전용
}

type ModelRef = string          // 모델 ID, router가 provider 결정
```

**실행**:
1. prompt 변수 보간
2. LLM 호출 (router가 provider 선택)
3. tool_use 응답 시 Tool 노드로 분기 (function calling)
4. output_schema 있으면 zod.parse

**UI**: 🟣 보라색. 모델 뱃지 (Claude/OpenAI/Gemini), 프롬프트 미리보기 3줄, 캐시 여부 아이콘.

### 3. Tool

외부 시스템 호출 노드. 내장 4종(HTTP·SQL·Slack·Stripe) + 커스텀 HTTP.

```typescript
interface ToolNode extends BaseNode {
  type: 'tool'
  tool_id: string              // 레지스트리 참조
  input_mapping: Record<string, Expression>   // { email: '{{ agent.extracted_email }}' }
  output_variable: string      // tool 결과를 저장할 변수명
}
```

**실행**:
1. input_mapping 평가 → tool input 조립
2. 레지스트리에서 tool 조회, permission token 검증
3. 실행 (timeout · retry 적용)
4. 결과를 output_variable에 저장

**UI**: 🟢 초록색. tool 아이콘 (HTTP·DB·Slack·Stripe 등), 입력/출력 스키마 요약.

### 4. Branch

조건 분기. LLM 출력·툴 결과·입력 필드 기반.

```typescript
interface BranchNode extends BaseNode {
  type: 'branch'
  condition_kind: 'expression' | 'llm_classifier'
  expression?: string          // JavaScript-like DSL: 'agent.score > 0.8'
  llm_classifier?: {
    prompt: string
    choices: string[]          // ['approve', 'escalate', 'reject']
    model: ModelRef
  }
  outputs: Array<{
    id: string                 // 엣지 식별자
    label: string              // 'approve' 등
    value?: string             // expression은 boolean, classifier는 choice
  }>
}
```

**실행**:
- `expression`: sandbox에서 평가 (safe-eval), boolean 반환 → true/false 엣지
- `llm_classifier`: LLM에게 choices 중 하나 선택 요청 → 매칭 엣지로 진행

**UI**: 🟡 주황색. 다이아몬드 형태. 각 outputs이 개별 엣지로 나감.

### 5. Output

종료점. 워크플로우 결과를 외부로 반환.

```typescript
interface OutputNode extends BaseNode {
  type: 'output'
  response_kind: OutputResponseKind
  schema?: ZodSchema           // 외부로 나가는 응답 스키마
}

type OutputResponseKind =
  | { kind: 'http_response'; status: number }
  | { kind: 'webhook'; url: string }
  | { kind: 'return_value' }   // API 호출자에게 반환
  | { kind: 'none' }            // fire-and-forget
```

**실행**: 최종 변수 상태를 response_kind에 따라 외부 전달 → run 종료.

**UI**: 🔴 빨간색, 우측 배치.

## 엣지 규칙

```typescript
interface Edge {
  id: string
  source: { node_id: string; output_id?: string }  // Branch는 output_id 필수
  target: { node_id: string }
}
```

### 허용 연결

| From → To | 허용 |
|---|:-:|
| Input → Agent/Tool/Branch/Output | ✅ |
| Agent → Tool/Branch/Output/Agent | ✅ |
| Tool → Agent/Tool/Branch/Output | ✅ |
| Branch → Agent/Tool/Output | ✅ (output_id 지정) |
| Output → * | ❌ |
| * → Input | ❌ |
| 순환 | ❌ (DAG 강제) |

## 변수 네임스페이스

노드 간 데이터 공유는 전역 변수 맵으로.

```typescript
interface RunContext {
  input: unknown              // Input 노드의 페이로드
  [nodeId: string]: unknown   // 각 노드의 output
}
```

참조는 템플릿 표현: `{{ input.email }}`, `{{ agent_1.decision }}`, `{{ tool_stripe.amount }}`.

## 검증 규칙

- Input 노드 ≥ 1개 필수
- Output 노드 ≥ 1개 필수
- 모든 노드는 Input에서 도달 가능해야 함 (isolated 금지)
- DAG (순환 없음)
- Branch의 outputs 중 최소 1개는 타 노드에 연결되어야 함 (dead branch 경고)

## 직렬화 포맷

```json
{
  "version": 1,
  "tool_id": "cs-refund-agent",
  "tool_version": 3,
  "nodes": [
    {
      "id": "01J7F...",
      "type": "input",
      "position": { "x": 0, "y": 0 },
      "label": "Webhook",
      "trigger": { "kind": "webhook", "auth": "hmac" },
      "schema": { "type": "object", "properties": { "order_id": { "type": "string" } } }
    }
    // ...
  ],
  "edges": [ /* ... */ ]
}
```

위 JSON이 Y.Doc의 `nodes` · `edges`와 대응. 로컬 export/import 지원.
