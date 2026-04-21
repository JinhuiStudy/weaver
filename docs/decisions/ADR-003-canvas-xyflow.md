# ADR-003 — Canvas: xyflow (React Flow)

- **상태**: ✅ Implemented (2026-04-21) · `apps/web/app/components/canvas/`
- **관련**: ARCHITECTURE §1, PRODUCT §3.2

## 맥락

에이전트 워크플로우의 시각 편집 캔버스가 필요하다. 요구사항:

- 노드 드래그·줌·팬 · 미니맵
- 커스텀 노드 컴포넌트 (노드 타입 5+개)
- 엣지 연결·검증·라벨
- 실시간 업데이트 (트레이스 진행 상태 오버레이)
- 멀티유저 협업 (Yjs CRDT 연동 가능)
- TypeScript 우선
- 활발한 유지보수

## 후보

| 라이브러리 | 장점 | 단점 |
|---|---|---|
| **xyflow (React Flow v12)** | 업계 표준, TS 완벽, 커스텀 노드 자유, 안정적 | 대형 그래프(1k+ 노드)에서 무거움 (우리 스코프는 <200) |
| **tldraw 3** | 예쁨, Figma 감성, 멀티유저 기본 제공 | 그래프 모델 아닌 캔버스 중심. 노드-엣지 관계 관리 약함 |
| **rete.js 2** | 비주얼 프로그래밍 전용 | 커뮤니티 작음, 문서 약함 |
| **Diagram.js (bpmn-io)** | BPMN 표준 | 너무 정형적, LLM 워크플로와 불일치 |
| **D3-force 직접** | 자유도 최대 | 모든 걸 직접 구축, 개발 기간 증가 |

## 결정

**xyflow (React Flow v12)** 선택.

### 근거

1. **생태계 성숙도**: 2019년부터 유지, 1.3만 GitHub star, 활발한 이슈·PR 대응.
2. **TypeScript 우선**: v12부터 완전 TS 재작성. 제네릭 `Node<T>` · `Edge<T>`로 우리 노드 타입 안전.
3. **커스텀 노드 자유**: `nodeTypes` map에 React 컴포넌트 등록. 5 프리미티브(Input/Agent/Tool/Branch/Output) 별 UI 차별화 용이.
4. **Yjs 바인딩 경로**: `useNodesState` / `useEdgesState`를 Yjs Y.Map/Y.Array로 교체하는 커뮤니티 예제 존재.
5. **트레이스 오버레이**: 노드 위에 커스텀 오버레이(실행 중 애니메이션, cost badge, latency ring) 추가 쉬움.
6. **성능**: 우리 스코프 <200 노드/캔버스에서 60fps 여유.

## tldraw와의 비교 (거부 이유 상세)

tldraw는 Figma 감성 캔버스로 매력적이지만:

1. **그래프 모델 부재** — 노드-엣지 관계를 제품에 녹이려면 자체 레이어 구축 필요
2. **실행 파이프라인과 미스매치** — tldraw는 "그림" 중심, Weaver는 "실행 가능한 DAG" 중심
3. **Yjs 기본 제공이 매력이나** xyflow + Yjs 수동 통합이 크게 어렵지 않음 (2-3일)

## 구체적 통합 계획

### Week 1-2
- `apps/web/components/canvas/NodeCanvas.tsx` — xyflow 래퍼
- `apps/web/components/canvas/nodes/` — 5 노드 컴포넌트 (InputNode, AgentNode, ToolNode, BranchNode, OutputNode)
- `packages/canvas/` — 재사용 컴포넌트 분리

### Week 11 (Yjs 통합)
- Y.Map `nodes` · Y.Array `edges` 로 저장
- `useYNodes()` / `useYEdges()` 커스텀 hook으로 xyflow `useNodesState` 대체
- Awareness (presence 커서 · 선택)

### 확장 시나리오

- **노드 타입 추가** (Cron, Webhook, Human approval 등) → `nodeTypes` map에 추가만
- **서브플로우** (그룹 노드) → xyflow `<Group>` 기능 활용
- **시간 뷰** (waterfall) → xyflow 외 별도 d3 컴포넌트. 공통 데이터 모델만 공유

## 위험 · 완화

| 위험 | 완화 |
|---|---|
| xyflow 의존성 유지 위험 | MIT 라이선스 OSS, fork 가능 |
| 대형 그래프 성능 | <200 노드 제한 명시, 넘으면 서브플로우로 분할 |
| 커스텀 노드 스타일 드리프트 | `packages/canvas/` 공용 컴포넌트로 강제 |

## 대안 거부 이유 요약

- **tldraw**: 그래프 모델 부재, 제품 성격 mismatch
- **rete.js**: 커뮤니티·문서 약함
- **D3-force**: 개발 기간 과다
