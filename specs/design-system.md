# Spec — Design System

> **Dark-first · Designer-friendly · Engineer-ready.**
> 420+ 디자인 토큰이 `example/design/tokens.css` 에 구현돼 있고, 이 문서는 **단일 진실의 원천**으로 해석·적용 규칙을 정의한다.

## 0. 원칙

1. **한 노드 = 한 색**. 5개 node color(파랑·보라·초록·주황·빨강)는 절대 섞지 않는다 — type 식별성.
2. **Status color는 의미 고정** — green=ok, red=error, amber=warning, blue=info, indigo=running.
3. **Dark-first**. Light mode(`[data-theme="dawn"]`)는 제공하지만 기본은 dark.
4. **색깔만으로 정보 전달 금지** — 항상 icon + text + pattern 병행.
5. **밀도 > 여백** — Retool 수준의 정보 밀도 유지 (base font 13px).

---

## 1. Brand

### 슬로건
- **EN**: *"Weave agents, tools, and observability into one fabric."*
- **KO**: *"하나의 직물로 엮인 에이전트 · 툴 · 관측성."*

### 톤 (Voice)
- **DO** — 개발자 친화 · 진지 · 장인 감성
  - *"Weaver is an open-source platform where AI agents are the unit of internal tools. Every run is a trace. Every deploy is gated by evals."*
- **DON'T** — 이모지 · 과장
  - ❌ *"🚀 Super awesome AI agent builder with magic ✨ that just works!"*

### 로고 컨셉
| 변종 | 설명 |
|---|---|
| **Woven knot (primary)** | 4색 선(indigo·cyan·purple·emerald)이 한 노드에서 교차 |
| **Geometric W** | W자 모양을 4색 선으로 분리 (node type palette 반영) |
| **Loom circle** | 원 안에 3 스트랜드가 짜여있는 형태 |

### 워드마크
- **Font**: Inter Variable 600
- **Tracking**: -0.02em
- **Position**: 로고 오른쪽

---

## 2. Color System

### 2.1 Primary Brand

| 이름 | Hex | CSS 토큰 | 용도 |
|---|---|---|---|
| Weaver Indigo | `#6366F1` | `--weaver-indigo` | CTA · 활성 · 로고 · focus ring · running |
| Indigo Hover | `#7C7FF5` | `--weaver-indigo-hover` | hover |
| Indigo Soft | `rgba(99,102,241,0.12)` | `--weaver-indigo-soft` | soft bg |
| Indigo Ring | `rgba(99,102,241,0.35)` | `--weaver-indigo-ring` | focus outline |
| Weaver Cyan | `#06B6D4` | `--weaver-cyan` | accent · selection · link · trace id |
| Cyan Soft | `rgba(6,182,212,0.14)` | `--weaver-cyan-soft` | soft accent bg |

### 2.2 Surface (6단계)

| 토큰 | Hex | 용도 |
|---|---|---|
| `--bg-base` | `#030305` | app background |
| `--bg-canvas` | `#07070C` | canvas backdrop |
| `--surface-1` | `#0F0F14` | cards · panels · trace viewer |
| `--surface-2` | `#1A1A22` | node bg · raised panel · hover |
| `--surface-3` | `#22222D` | hover · selected row |
| `--surface-4` | `#2A2A35` | pressed · ports · tertiary interactive |

### 2.3 Border

| 토큰 | 값 | 용도 |
|---|---|---|
| `--border` | `#2A2A35` | default divider |
| `--border-strong` | `#3A3A47` | emphasized |
| `--border-subtle` | `rgba(255,255,255,0.06)` | whisper line |

### 2.4 Text (3단 + inverse)

| 토큰 | Hex | Contrast on bg-base | WCAG |
|---|---|:-:|:-:|
| `--text-primary` | `#F0F0F0` | 15.7:1 | AAA |
| `--text-secondary` | `#AAAAAA` | 8.2:1 | AA |
| `--text-tertiary` | `#666666` | 3.8:1 | meta only |
| `--text-inverse` | `#0F0F14` | — | (light bg 위) |

### 2.5 Node Type 팔레트 (5색 고정)

| 타입 | Hex | 토큰 | Soft 토큰 | 의미 |
|---|---|---|---|---|
| **Input** | `#3B82F6` | `--node-input` | `--node-input-soft` | webhook · schedule · manual |
| **Agent** | `#A855F7` | `--node-agent` | `--node-agent-soft` | LLM (Claude · GPT · Workers AI) |
| **Tool** | `#10B981` | `--node-tool` | `--node-tool-soft` | HTTP · SQL · Slack · Stripe · 커스텀 |
| **Branch** | `#F59E0B` | `--node-branch` | `--node-branch-soft` | expression · LLM classifier |
| **Output** | `#EF4444` | `--node-output` | `--node-output-soft` | HTTP response · webhook · return |

**규칙**: 노드 border = `color-mix(in srgb, var(--node-color) 40%, var(--border-strong))`.

### 2.6 Status

| 토큰 | Hex | 용도 |
|---|---|---|
| `--status-ok` | `#10B981` | (node-tool 과 동일) |
| `--status-error` | `#EF4444` | (node-output 과 동일) |
| `--status-warning` | `#F59E0B` | (node-branch 와 동일) |
| `--status-info` | `#3B82F6` | (node-input 과 동일) |
| `--status-running` | `#6366F1` (indigo, pulse) | in-progress |

각 status는 `*-soft` 변형(`rgba(·, 0.14)`)을 가짐.

---

## 3. Typography

### 3.1 Font Stacks

| 토큰 | 값 |
|---|---|
| `--font-sans` | `'Inter', 'Pretendard Variable', -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace` |
| `--font-display` | `'Inter', sans-serif` |

### 3.2 Type Scale

| 토큰 | 크기 | 무게 | line-height | tracking | 용도 |
|---|---:|:-:|---:|---:|---|
| `--fs-micro` | 10px | 500 | 14 | 0.1em UPPERCASE | kicker · meta |
| `--fs-xs` | 11px | 400 | 16 | 0 | badges · span labels · inline meta (mono) |
| `--fs-sm` | 12px | 400 | 18 | 0 | compact UI · rows · side panels |
| `--fs-base` | 13px | 400 | 20 | 0 | body default (denser than 14) |
| `--fs-md` | 14px | 400 | 20 | 0 | default label · UI |
| `--fs-lg` | 16px | 500 | 24 | 0 | emphasized body |
| `--fs-xl` | 18px | 600 | 24 | -0.01em | card title |
| `--fs-2xl` | 20px | 600 | 24 | -0.01em | page title (dense) |
| `--fs-3xl` | 24px | 600 | 28 | -0.02em | section title |
| `--fs-display` | 40px | 600 | 44 | -0.025em | brand wordmark |

### 3.3 Tracking · Line-height 규칙

- **제목(lg 이상)**: 반드시 음의 tracking (`-0.01em` ~ `-0.025em`)
- **Kicker(micro)**: 항상 `UPPERCASE + 0.1em`
- **Mono**: 1.55 ~ 1.7 line-height (코드 가독성)
- **Body**: 1.5 ~ 1.6
- **Paragraph > 2줄**: `text-wrap: pretty` 필수

---

## 4. Spacing & Layout

### 4.1 Spacing (4px grid)

| 토큰 | 값 | 용도 |
|---|---:|---|
| `--space-1` | 4 | micro |
| `--space-2` | 8 | component gap |
| `--space-3` | 12 | padding small |
| `--space-4` | 16 | gap · padding standard |
| `--space-5` | 20 | — |
| `--space-6` | 24 | section padding |
| `--space-8` | 32 | layout padding |
| `--space-10` | 40 | — |
| `--space-12` | 48 | major section break |
| `--space-16` | 64 | hero · page spacing |

### 4.2 Radius

| 토큰 | 값 | 용도 |
|---|---:|---|
| `--radius-xs` | 4 | chips inside chips |
| `--radius-sm` | 6 | badges · small |
| `--radius-md` | 8 | buttons · inputs |
| `--radius-lg` | 10 | **nodes** |
| `--radius-xl` | 12 | cards · panels |
| `--radius-2xl` | 16 | dialogs |
| `--radius-full` | 9999 | pills · avatars |

### 4.3 Shadow (dark-tuned)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)` | resting nodes · cards |
| `--shadow-raised` | `0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)` | dropdown · popover · hover |
| `--shadow-popover` | `0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)` | menus · tooltips |
| `--shadow-node-selected` | `0 0 0 2px var(--weaver-indigo), 0 8px 24px rgba(99,102,241,0.25)` | selected node |
| `--shadow-focus-ring` | `0 0 0 3px var(--weaver-indigo-ring)` | button · input focus |

### 4.4 Z-index

| 레이어 | 토큰 | 값 |
|---|---|---:|
| canvas | `--z-canvas` | 0 |
| edge | `--z-edge` | 5 |
| node | `--z-node` | 10 |
| panel | `--z-panel` | 20 |
| chrome | `--z-chrome` | 40 |
| modal | `--z-modal` | 50 |
| toast | `--z-toast` | 9000 |
| progress | `--z-progress` | 9999 |

---

## 5. Motion

### 5.1 Duration

| 토큰 | 값 | 용도 |
|---|---:|---|
| `--dur-instant` | 80ms | 즉시 피드백 (linear) |
| `--dur-fast` | 150ms | 기본 interactive (ease-out) |
| `--dur-base` | 200ms | 중간 transition (ease-in-out) |
| `--dur-slow` | 300ms | 페이지 전환 (ease-out) |
| spring | 600ms | success 피드백 전용 |

### 5.2 Easing

| 토큰 | 값 |
|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### 5.3 패턴

- **Active press**: `scale(0.98)` · dur-fast
- **Node port hover**: 2px → 4px 확장
- **Selection ring**: conic-gradient rotate
- **Running edge**: dashed `stroke-dasharray: 6 4` · offset 애니메이션 0.6s linear infinite

---

## 6. Icon System

- **Library**: Lucide (이모지 금지)
- **Stroke width**: 1.75 고정 (1.5는 too thin)
- **Sizes**: 12 (xs) · 14 (sm, default) · 16 (md, buttons) · 20 (lg, empty) · 28 (xl, hero)
- **Color**: `currentColor` 우선 · node color는 node-specific 아이콘에만

---

## 7. Component Patterns

### 7.1 Button

**Variants (8종)**:

| variant | bg | text | 용도 |
|---|---|---|---|
| `primary` | indigo | white | CTA — 화면당 1개 |
| `secondary` | surface-3 | text-primary | 보조 |
| `outlined` | transparent | text-primary | tertiary |
| `ghost` | transparent | text-secondary | icon button · chrome |
| `danger` | status-error | white | destructive |
| `success` | status-ok | white | positive |
| `ai` | gradient(indigo-soft, cyan-soft) | text-primary | AI action |
| `loading` | inherit | spinner | disabled |

**Sizes**:

| size | padding | font | radius |
|---|---|---:|---:|
| `xs` | 4×8 | 11 | 4 |
| `sm` | 5×10 | 11 | 6 |
| `md` (default) | 7×12 | 12 | 6 |
| `lg` | 11×18 | 14 | 8 |
| `icon` | 6 | — | 6 (28×28) |

### 7.2 Input

- **Base**: `surface-2` bg · `border` · 12px · radius 6
- **States**:
  - hover → `border-strong`
  - focus → indigo border + `--shadow-focus-ring`
  - error → red border + `status-error-soft` ring
  - success → green border
  - disabled → 50% opacity · no pointer
- **Variants**: mono (code), 좌측 icon(30px pad), 우측 kbd badge

### 7.3 Badge

| class | bg | text | 비고 |
|---|---|---|---|
| `badge-ok` | status-ok-soft | status-ok | |
| `badge-err` | status-error-soft | status-error | |
| `badge-warn` | status-warning-soft | status-warning | |
| `badge-info` | status-info-soft | status-info | |
| `badge-running` | indigo-soft | indigo | `<span class="pulse">` 포함 |
| `badge-muted` | surface-3 | text-secondary | border 1px |
| `badge-solid-ok` | status-ok | white | solid 변형 |

**Pulse**: `animation: pulse 1.2s ease-in-out infinite; 0/100% opacity 1 · 50% 0.35`

### 7.4 Card · Panel

- bg `surface-1` · border 1px `--border` · radius 10px
- **card-h** (header): 12×14 padding · border-bottom
- **card-b** (body): 14 padding

### 7.5 Tabs

- **line tabs**: 12px mono · underline indicator (indigo)
- **pill tabs**: 3px gap · `surface-4` active · 5×12 padding

### 7.6 Menu · Popover

- bg `surface-2` · border `border-strong` · radius 8 · `--shadow-popover`
- items: 6×10 · hover `surface-3`
- separator: 1px `border`

### 7.7 Tooltip

- bg `surface-4` · border `border-strong` · 4×8 · 11px mono
- pointer: CSS `::after` triangle

### 7.8 Toast · Alert

- bg `surface-2` · left border-3 (색은 상태별) · 10×14 padding

### 7.9 Skeleton · Loading

- shimmer: `animation: shimmer 1.4s ease-in-out infinite`
- gradient: `surface-2 → surface-3 → surface-2`

### 7.10 Empty State

- 중앙 정렬 · 44×44 아이콘 박스(dashed border)
- Headline 14px/600 · description 12px tertiary
- 예: *"No runs yet"* / *"Trigger a webhook or schedule to see results here"*

### 7.11 Command Palette

- 다이얼로그 24 padding · surface-1 · radius 12
- 입력: mono · 14px · kbd 힌트
- 항목: 8×12 · hover surface-3

### 7.12 Keyboard (kbd)

- `<kbd>` · mono 10px · surface-3 bg · 2px bottom border
- 예: `⌘1` · `Ctrl+S` · `Shift+Enter`

---

## 8. Node Anatomy

노드는 canvas의 핵심 요소. 자세한 스펙은 [`node-types.md`](./node-types.md).

### 요약 (모든 노드 공통)

```
┌─────────────────────────────┐   <- radius 10, border 1px (node color 40% blend)
│ ● AGENT · CLAUDE            │   <- type dot 6×6 + kicker 9px mono UPPERCASE
│ policy_check                │   <- label 13px/600, -0.005em
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │   <- dashed divider
│ model: sonnet-4-6           │   <- body 11px mono, 1.55 lh, max 4 lines
│ temp: 0.2 · cache: on       │
└────●─────────────────────●──┘   <- port 10×10, -6px offset, bg-canvas border
```

**7 상태**: default · hover · selected · running · error · warning · disabled · ok

---

## 9. Edge · Port

### 9.1 Edge

| 타입 | 스타일 | 용도 |
|---|---|---|
| default | 1.5px · `border-strong` | idle |
| selected | 2px · indigo | highlight |
| flowing | 2px indigo dashed `6 4` · offset animate | running |
| error | 2px red | last-run failed |

### 9.2 Port

| 상태 | 스타일 |
|---|---|
| empty | 10×10 · surface-4 · border bg-canvas |
| connected | node-color · 6px glow |
| hover | node-color · 4px outer ring (soft alpha) |
| dragging | 12×12 · cyan dashed border · transparent |
| invalid | red · 3px error-soft ring |

### 9.3 Canvas Backdrop

- bg `--bg-canvas` (`#07070C`)
- 20px·24px 도트 그리드: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0) 0 0 / 24px 24px`

### 9.4 Canvas Controls

- **Zoom**: −/+/fit · 100% label · mono 11px · bottom-left
- **Minimap**: 180×120 · bottom-right · 컬러 노드 rect · indigo viewport border
- **Selection marquee**: dashed indigo · semi-transparent fill
- **Align guide**: cyan vertical/horizontal · 미세 glow

---

## 10. Accessibility

### 10.1 Contrast (검증 완료)

| 조합 | 비율 | WCAG |
|---|:-:|:-:|
| text-primary / bg-base | 15.7:1 | AAA |
| text-secondary / bg-base | 8.2:1 | AA |
| indigo / bg-base | 6.1:1 | AA |
| text-tertiary / bg-base | 3.8:1 | meta only |

### 10.2 Focus Ring

`0 0 0 3px rgba(99,102,241,0.35)` — 모든 interactive 요소에 적용.

### 10.3 Keyboard

- `⌘K` — command palette
- `⌘S` — save
- `⌘Z / ⌘⇧Z` — undo / redo
- `⌘Enter` — run agent
- `Esc` — close dialog · deselect

### 10.4 Color Accessibility

- 5 node color는 **절대 섞지 않음**
- Status는 항상 의미 고정
- **색만으로 정보 전달 금지** — 항상 icon + text 병행

---

## 11. Light Mode (Dawn, 선택적)

`[data-theme="dawn"]` 속성으로 활성화. `bg-base` · `surface-*` · `text-*` 토큰 자동 반전.

| 토큰 | dark | dawn |
|---|---|---|
| `--bg-base` | `#030305` | `#FAFAFB` |
| `--surface-1` | `#0F0F14` | `#FFFFFF` |
| `--surface-2` | `#1A1A22` | `#F8F8FA` |
| `--border` | `#2A2A35` | `#E4E4E8` |
| `--text-primary` | `#F0F0F0` | `#0A0A0F` |

Shadow 토큰도 light 변형. Brand · node · status color는 **변경 없음** (의미 일관성).

---

## 12. Token 사용 원칙

1. **Raw hex 금지** — 모든 색은 CSS 변수 참조. 예외: SVG 로고.
2. **spacing은 토큰 조합만** — `16px` 대신 `var(--space-4)`
3. **텍스트 크기는 스케일 내에서만** — 임의 `15px` 같은 값 금지
4. **Radius / Shadow 동일** — 토큰 외 새 값 추가 시 ADR 필요
5. **Motion duration** — 토큰 외 값 금지. 새 값 필요하면 토큰 추가 제안

---

## 13. 참고 자료

- `example/design/tokens.css` — 토큰 소스
- `example/design/Weaver Design System v2.html` — 최신 디자인 시스템 라이브 데모
- `example/design/Weaver Wireframes.html` — 8개 화면 와이어프레임
- [`screens.md`](./screens.md) — 화면별 레이아웃 상세
- [`node-types.md`](./node-types.md) — 노드 타입 스펙
