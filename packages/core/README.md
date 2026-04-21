# @weaver/core

> 공유 타입 · 스키마 · 순수 함수.

## 의도

Weaver 전체가 의존하는 **단일 진실의 원천**. 다른 package와 app은 여기서 타입을 import.

## 주요 타입 (예정)

- `Node`, `Edge`, `Graph`
- `NodeType = 'input' | 'agent' | 'tool' | 'branch' | 'output'`
- `ToolDefinition<TInput, TOutput>`
- `Run`, `RunContext`, `Span`
- `EvalCase`, `EvalAssertion`, `EvalResult`

### 스키마

Zod 스키마가 타입의 1차 source. TypeScript 타입은 `z.infer<>` 로 파생.

## 의존성

- `zod` (런타임 검증)
- `ulid` (ID 생성)
- **절대 React·DOM·Cloudflare 의존 금지** — 순수 TS만.

## 상태

📦 빈 디렉토리. Week 2 (2026-W18) 노드 스키마 구현 시 시작.
