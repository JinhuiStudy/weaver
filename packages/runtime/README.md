# @weaver/runtime

> 에이전트 실행 엔진 — apps/runtime의 내부 라이브러리

## 의도

순수 TypeScript 에이전트 실행 로직. Cloudflare 런타임 바인딩과 분리해 테스트·재사용 용이.
**MVP는 D1 + Cron 구현**. 추후 Paid 전환 시 Durable Objects 백엔드를 같은 인터페이스로 갈아끼움.

## 주요 export (예정)

```typescript
// 에이전트 실행
export class AgentExecutor {
  async execute(graph: Graph, input: unknown): Promise<RunResult>
}

// LLM 라우팅
export function createLLMRouter(config: LLMConfig): LLMRouter

// Tool 실행
export class ToolExecutor {
  async invoke(tool: ToolDefinition, input: unknown, ctx: ToolContext)
}

// 상태 머신
export type RunState = 'pending' | 'running' | 'waiting_llm' | 'waiting_tool' | 'waiting_human' | 'complete' | 'failed'
```

## 의존성

- `@weaver/core`
- Workers AI 바인딩 (Cloudflare 네이티브)
- `@anthropic-ai/sdk` (BYOK 경로)
- `openai` (BYOK 경로)

## 상태

📦 빈 디렉토리. Week 4-5 (2026-W20-21) 실행 엔진 구현 시 시작.
