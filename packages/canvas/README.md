# @weaver/canvas

> xyflow 노드 컴포넌트 + Yjs 통합 hook

## 의도

캔버스 관련 UI를 재사용 가능한 패키지로 분리. `apps/web` 뿐 아니라 임베드형 데모·Storybook에서도 사용 가능.

## 주요 export (예정)

```typescript
// 노드 컴포넌트
export { InputNode, AgentNode, ToolNode, BranchNode, OutputNode }

// 엣지 컴포넌트
export { FlowEdge }

// Yjs 통합
export { useYNodes, useYEdges, useAwareness }

// 캔버스 루트
export { NodeCanvas }  // xyflow + Yjs 통합 래퍼
```

## 의존성

- `@weaver/core` (타입)
- `@xyflow/react`
- `yjs`, `y-indexeddb` (MVP · local-first)
- `y-websocket` (Phase 2 · 실시간 협업, Fly.io 무료 서버)
- `react`

## 상태

📦 빈 디렉토리. Week 1-2 (2026-W17-18) 기본 노드 컴포넌트 → Week 11 Yjs 통합.
