# Week 1 Plan — Day-by-Day

> ✅ **완료됨 (2026-04-21)**. 실제로는 Week 2/3/4 스코프까지 같은 주에 진행.
> 현재 상태: 라이브 배포 · 프로덕션 E2E 검증 완료. 다음 우선순위는 [`NEXT.md`](./NEXT.md).
>
> 이 문서는 **참고용 기록**으로 보존. 앞으로 Day 루틴은 [`NEXT.md`](./NEXT.md) 참조.

> **전제**: [`KICKOFF.md`](./KICKOFF.md) 완료 상태 (Phase A-E).
> **목표 (Week 1 끝)**: 빈 xyflow 캔버스에 Agent 노드 1개 드래그, tokens.css 완전 적용, 로컬 + 프로덕션 배포 동기화. ✅

## 🧭 매일 시작 전 3분 루틴

```bash
cd ~/Desktop/dev/weaver
git pull
pnpm install
pnpm dev                       # apps/web localhost:5173
# 새 터미널
pnpm --filter=./apps/runtime dev   # localhost:8787
```

---

## 📅 Day 1 (월) — 디자인 토큰 + shadcn 재스타일

**목표**: 모든 shadcn 컴포넌트가 **tokens.css 값으로만** 동작. raw hex 0건.

### 오전 (2-3시간)
- [ ] `apps/web/app/app.css` 구성:
  ```css
  @import "tailwindcss";
  @import "./styles/tokens.css";

  @theme {
    --color-bg-base: var(--bg-base);
    --color-surface-1: var(--surface-1);
    --color-surface-2: var(--surface-2);
    --color-surface-3: var(--surface-3);
    --color-border: var(--border);
    --color-text-primary: var(--text-primary);
    --color-text-secondary: var(--text-secondary);
    --color-text-tertiary: var(--text-tertiary);
    --color-indigo: var(--weaver-indigo);
    --color-cyan: var(--weaver-cyan);
    /* 나머지 토큰 Tailwind 클래스 매핑 */
  }
  ```
- [ ] Inter + JetBrains Mono 웹폰트 로드 확인
- [ ] `<html>` 에 `data-theme="dark"` 기본 설정
- [ ] bg-base 배경 · text-primary 텍스트로 렌더

### 오후 (2-3시간)
- [ ] shadcn Button · Input · Card 3개 재스타일 (tokens만)
- [ ] 8 Button variant (primary/secondary/outlined/ghost/danger/success/ai/loading) 구현
- [ ] Storybook 대체로 `apps/web/app/routes/_dev.tsx` 만들어 컴포넌트 쇼케이스

### 커밋 (예상)
```
feat(web): integrate tokens.css into Tailwind v4 @theme
feat(web): restyle shadcn Button with 8 variants using weaver tokens
feat(web): dev route /_dev with component showcase
```

**Day 1 Exit Criteria**:
- [ ] `pnpm typecheck` · `pnpm lint` 0 에러
- [ ] 로컬에서 `/_dev` 열면 8개 버튼 variant + input + card 전부 디자인 시스템 맞춰 렌더
- [ ] raw hex 0건 (`grep -r "#[0-9a-f]\{6\}" apps/web/app --exclude-dir=node_modules` 결과 없음, 단 tokens.css 제외)

---

## 📅 Day 2 (화) — `packages/core` 노드 타입 + valibot

**목표**: 5개 노드 타입 valibot 스키마 완성, 독립 패키지로 export.

### 오전
- [ ] `packages/core/src/node.ts`:
  ```typescript
  import * as v from 'valibot'

  export const NodeTypeSchema = v.picklist(['input', 'agent', 'tool', 'branch', 'output'])
  export const BaseNodeSchema = v.object({
    id: v.string(),
    type: NodeTypeSchema,
    position: v.object({ x: v.number(), y: v.number() }),
    label: v.string(),
    version: v.number(),
    // ...
  })

  export const InputNodeSchema = v.object({...})
  export const AgentNodeSchema = v.object({...})
  // ... (specs/node-types.md 참고)
  ```
- [ ] `packages/core/src/edge.ts` — Edge 스키마 + 허용 연결 규칙
- [ ] `packages/core/src/graph.ts` — Graph 타입 + DAG 검증

### 오후
- [ ] Vitest 테스트 작성
  - 유효 노드 스키마 통과
  - 잘못된 엣지 연결 실패
  - DAG 순환 감지
- [ ] `packages/core/src/index.ts` 에서 public API export
- [ ] `apps/web`에서 import 확인 (`import { BaseNodeSchema } from '@weaver/core'`)

### 커밋
```
feat(core): valibot schemas for 5 node types (input/agent/tool/branch/output)
feat(core): edge connection rules + DAG validation
test(core): 15 cases covering schema + edge + graph
```

**Day 2 Exit Criteria**:
- [ ] `pnpm --filter=@weaver/core test:run` 15+ passing
- [ ] `apps/web`에서 타입 import 성공
- [ ] 커버리지 90%+

---

## 📅 Day 3 (수) — xyflow 통합 + 빈 캔버스

**목표**: `/builder/demo` 라우트에 xyflow 캔버스 + 24px 도트 배경 + 빈 상태.

### 오전
- [ ] `pnpm --filter=./apps/web add @xyflow/react`
- [ ] `apps/web/app/routes/builder.$id.tsx` 생성
- [ ] `apps/web/app/components/canvas/NodeCanvas.tsx`:
  - xyflow `<ReactFlow>` 래퍼
  - canvas backdrop: 24px dot grid CSS
  - minimap + zoom controls
  - `fitView` 기본
- [ ] 토큰 기반 캔버스 스타일 (`--bg-canvas`, zoom controls surface-2)

### 오후
- [ ] `apps/web/app/components/canvas/nodes/AgentNode.tsx`:
  - anatomy: type dot + kicker + label + body + port
  - 7 상태 스타일 (default/hover/selected/running/error/warning/disabled)
- [ ] xyflow `nodeTypes` map 등록
- [ ] 로컬 상태로 빈 캔버스에 AgentNode 1개 하드코딩 배치
- [ ] 스크린샷 저장 → `docs/screenshots/day3-canvas.png`

### 커밋
```
feat(web): /builder/:id route with xyflow canvas
feat(web): canvas backdrop (24px dot grid) + zoom controls
feat(canvas): AgentNode with 7 visual states
```

**Day 3 Exit Criteria**:
- [ ] `https://weaver.pages.dev/builder/demo` 접속 시 canvas + 1 Agent 노드 표시
- [ ] 노드 selected 상태 시 indigo ring 나타남
- [ ] Tailwind · tokens.css만 사용 (inline style 금지)

---

## 📅 Day 4 (목) — 나머지 4개 노드 + 엣지

**목표**: Input/Tool/Branch/Output 컴포넌트 + 엣지 4 타입.

### 오전
- [ ] InputNode · ToolNode · BranchNode · OutputNode 컴포넌트
- [ ] 각 노드 type color · anatomy · 7 상태 구현
- [ ] xyflow `nodeTypes` 5개 전부 등록

### 오후
- [ ] `apps/web/app/components/canvas/edges/FlowEdge.tsx`:
  - default / selected / flowing (dashed animate) / error
- [ ] 엣지 연결 가드: 허용 연결만 (`packages/core`의 규칙 사용)
- [ ] Port 5 상태 (empty/connected/hover/dragging/invalid) 구현
- [ ] 4개 노드를 하드코딩으로 배치하고 엣지 연결된 데모 화면

### 커밋
```
feat(canvas): Input/Tool/Branch/Output nodes with full anatomy
feat(canvas): FlowEdge with 4 variants + port states
feat(web): builder demo with 4-node flow
```

**Day 4 Exit Criteria**:
- [ ] 5 노드 타입 전부 렌더
- [ ] 엣지 flowing 애니메이션 동작
- [ ] 잘못된 연결 시도 시 invalid port 시각화

---

## 📅 Day 5 (금) — Zustand + y-indexeddb 로컬 영속

**목표**: 캔버스 상태를 Zustand로 관리 + y-indexeddb 로컬 저장.

### 오전
- [ ] `apps/web/app/stores/canvas.ts`:
  - nodes · edges · selection · drag state
  - 액션: addNode · removeNode · connectEdge · moveNode
- [ ] xyflow `onNodesChange` · `onEdgesChange`를 Zustand dispatch로 연결

### 오후
- [ ] `pnpm add yjs y-indexeddb`
- [ ] `apps/web/app/lib/yjs-provider.ts` — Y.Doc + IndexeddbPersistence
- [ ] Zustand ↔ Yjs 양방향 동기화
- [ ] 로컬 저장 확인: 새로고침해도 노드 위치 유지
- [ ] (옵션) 오프라인 편집 테스트

### 커밋
```
feat(web): Zustand canvas store (nodes/edges/selection)
feat(web): yjs + y-indexeddb local-first persistence
test(web): canvas reload retains node positions
```

**Day 5 Exit Criteria**:
- [ ] 노드 드래그 → 새로고침 → 위치 보존
- [ ] IndexedDB devtools에 Y.Doc 업데이트 확인
- [ ] `pnpm test:run` 전부 통과

---

## 📅 주말 — 폴리싱 + 스크린샷 + 블로그 초안

**목표**: Week 1 성과물 정리 + Week 2 준비.

### 폴리싱
- [ ] `pnpm lint --fix`
- [ ] README.md 데모 GIF 추가 (loom or scoop)
- [ ] Lighthouse CI 통과 (`pnpm --filter=./apps/web lhci autorun`)
- [ ] 번들 크기 확인 (`pnpm --filter=./apps/web build` output 관찰)

### 스크린샷
- [ ] `docs/screenshots/` 폴더
- [ ] `day3-empty-canvas.png`, `day4-5-nodes.png`, `day5-flow-complete.png`

### 블로그 초안 (Week 14 런칭 대비 사전 자산)
- [ ] `docs/blog-drafts/week-1-scaffold.md`:
  - "5일간 어떻게 에이전트 빌더 뼈대를 만들었나"
  - 디자인 토큰 주입 + xyflow 통합 + 노드 타입 설계

---

## 🎯 Week 1 Exit Criteria (주말 밤 점검)

- [ ] GitHub repo 커밋 수 ≥ 15
- [ ] `weaver.pages.dev/builder/demo` → 5 노드 타입 배치 가능
- [ ] 디자인 토큰 누수 0건 (raw hex 0)
- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm test:run` 전부 0 에러
- [ ] CI 그린
- [ ] 로컬 영속 동작 (새로고침 후 유지)
- [ ] **인프라 비용 $0 유지**

---

## 🔜 Week 2 예고

- **"NL Composer"** — Workers AI + 유저 BYOK로 자연어 → 노드 트리 생성
- `/api/compose` 엔드포인트 + DiffPreview UI
- Monaco에서 프롬프트 편집

상세: [`ROADMAP.md § Week 2`](./ROADMAP.md).

---

## 📌 막혔을 때

1. **5분 안에 안 풀리면** — `docs/` 관련 문서 재확인
2. **아키텍처 의문** — `docs/decisions/` ADR 탐색
3. **디자인 의문** — `specs/design-system.md` 또는 `example/design/` HTML 열기
4. **GitHub issue로 자문자답** — 해결되면 PR로 닫기

Good luck. 🧵
