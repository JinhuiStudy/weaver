# Spec — Tool Registry

> 외부 시스템 호출을 **타입 안전 함수**로 추상화하는 레지스트리.

## 설계 원칙

1. **타입 안전** — input/output 스키마 명시 (Zod), 런타임 검증
2. **권한 격리** — permission token으로 scope 제한
3. **관측 가능** — 모든 호출이 OTEL span 생성
4. **재사용** — 4 내장 + 커스텀 HTTP 추가 가능
5. **타 언어 SDK 확장 가능** — 추후 Python·Go로 툴 작성 지원

## Tool 정의

```typescript
// packages/core/tool.ts
import { z } from 'zod'

export interface ToolDefinition<TInput, TOutput> {
  id: string                            // 'http' | 'sql' | 'slack_send' | ...
  version: string                       // semver
  name: string                          // 유저 노출
  description: string                   // LLM function description

  input_schema: z.ZodType<TInput>
  output_schema: z.ZodType<TOutput>

  /** 실행 함수 */
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>

  /** 권한 scope */
  scopes: string[]                      // ['http:*'] | ['db:read'] | ...
}

export interface ToolContext {
  run_id: string
  tool_call_id: string
  permission_token: string
  abort_signal: AbortSignal
  tracer: Tracer                        // OTEL
}

export function defineTool<TInput, TOutput>(
  def: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return def
}
```

## 내장 Tool 4종

### 1. HTTP

```typescript
export const httpTool = defineTool({
  id: 'http',
  version: '1.0.0',
  name: 'HTTP Request',
  description: 'Make an HTTP request to an external API',

  input_schema: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    timeout_ms: z.number().max(30000).default(10000),
  }),

  output_schema: z.object({
    status: z.number(),
    headers: z.record(z.string()),
    body: z.unknown(),
    duration_ms: z.number(),
  }),

  scopes: ['http:*'],

  async execute(input, ctx) {
    return ctx.tracer.startActiveSpan('http.request', async (span) => {
      span.setAttribute('http.method', input.method)
      span.setAttribute('http.url', input.url)

      const start = performance.now()
      const res = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: AbortSignal.timeout(input.timeout_ms),
      })
      const body = await res.json().catch(() => null)
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body,
        duration_ms: performance.now() - start,
      }
    })
  },
})
```

### 2. SQL

```typescript
export const sqlTool = defineTool({
  id: 'sql',
  version: '1.0.0',
  name: 'SQL Query',
  description: 'Execute a parameterized SQL query against a registered database',

  input_schema: z.object({
    connection_id: z.string(),        // 레지스트리 DB 참조
    query: z.string(),
    params: z.array(z.unknown()).default([]),
  }),

  output_schema: z.object({
    rows: z.array(z.record(z.unknown())),
    row_count: z.number(),
    duration_ms: z.number(),
  }),

  scopes: ['db:read'],                // write는 별도 scope

  async execute(input, ctx) {
    // connection_id → organization DB 크레덴셜 조회
    // pg or mysql client로 실행
    // read-only check (INSERT/UPDATE/DELETE 차단)
  },
})
```

### 3. Slack Send

```typescript
export const slackSendTool = defineTool({
  id: 'slack_send',
  version: '1.0.0',
  name: 'Send Slack Message',
  description: 'Send a message to a Slack channel or user',

  input_schema: z.object({
    channel: z.string(),             // '#general' or '@user'
    text: z.string(),
    blocks: z.array(z.unknown()).optional(),  // Block Kit
  }),

  output_schema: z.object({
    ts: z.string(),                  // 메시지 timestamp
    channel: z.string(),
  }),

  scopes: ['slack:write'],

  async execute(input, ctx) {
    // ctx에서 Slack OAuth token 조회
    // chat.postMessage 호출
  },
})
```

### 4. Stripe Lookup Order

```typescript
export const stripeLookupTool = defineTool({
  id: 'stripe_lookup_order',
  version: '1.0.0',
  name: 'Stripe Lookup Order',
  description: 'Fetch order and payment details from Stripe',

  input_schema: z.object({
    order_id: z.string(),            // Stripe payment_intent ID
  }),

  output_schema: z.object({
    amount: z.number(),
    currency: z.string(),
    status: z.enum(['succeeded', 'pending', 'failed', 'refunded']),
    created_at: z.string().datetime(),
    customer_email: z.string().email().nullable(),
  }),

  scopes: ['stripe:read'],

  async execute(input, ctx) {
    // Stripe SDK 호출
  },
})
```

## 커스텀 HTTP Tool 추가 UI

유저가 새 HTTP API를 툴로 등록하려면:

```yaml
name: MyInternalAPI
description: Fetch user by ID from internal user service

base_url: https://users.internal.example.com
auth:
  kind: bearer
  secret_ref: USER_API_TOKEN         # wrangler secret 참조

endpoints:
  - id: get_user
    method: GET
    path: /users/:user_id
    input_schema:
      type: object
      properties:
        user_id: { type: string }
      required: [user_id]
    output_schema:
      type: object
      properties:
        id: { type: string }
        email: { type: string }
        name: { type: string }
```

위 YAML → Zod 스키마 자동 생성 → 레지스트리 등록 → 캔버스에 새 Tool 노드 사용 가능.

## Function Calling 변환

LLM에게 툴을 제공할 때 OpenAI/Claude function calling 스펙으로 자동 변환:

```typescript
function toolToFunctionSchema(tool: ToolDefinition<any, any>) {
  return {
    name: tool.id,
    description: tool.description,
    parameters: zodToJsonSchema(tool.input_schema),
  }
}
```

## Permission Token

```typescript
// 에이전트 실행 시작 시 발급
interface PermissionToken {
  run_id: string
  tool_id: string
  scopes: string[]
  expires_at: number
  org_id: string
  signature: string         // HMAC(secret, payload)
}

// 툴 실행 직전 검증
async function verifyToken(token: PermissionToken, tool: ToolDefinition) {
  if (token.expires_at < Date.now()) throw new Error('expired')
  if (!tool.scopes.every(s => token.scopes.includes(s))) throw new Error('insufficient_scope')
  // HMAC 검증
}
```

## 관측성 (OTEL)

모든 툴 실행은 다음 속성을 span에 기록:

```
tool.id:            'http'
tool.version:       '1.0.0'
tool.call_id:       ULID
tool.duration_ms:   134
tool.status:        'ok' | 'error' | 'timeout'
tool.error_message: (optional)
```

HTTP tool은 추가로:
```
http.method:  'POST'
http.url:     'https://api.stripe.com/v1/...'
http.status:  200
```

## 확장: 커뮤니티 Tool Marketplace (v1.x)

- 커뮤니티가 tool 정의(Zod 스키마 + execute 함수)를 npm 패키지로 배포
- 조직이 `weaver add @community/notion-tool` 로 설치
- Weaver runtime이 런타임에 동적 로드 (WASM 격리 검토)

이 부분은 post-MVP 로드맵.
