# Spec — Screens

> 8개 핵심 화면 레이아웃. `example/design/Weaver Wireframes.html` 와 1:1 대응. 디자인 토큰은 [`design-system.md`](./design-system.md).

## 0. 공통 Chrome

### Topbar (48px)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo]  Tools · Runs · Evals · Registry · Admin │ org • status  🧑 │
└──────────────────────────────────────────────────────────────────────┘
  48px height · border-bottom 1px · bg surface-1
```
- 좌: 로고 + 수평 탭 (line tabs · 12px mono UPPERCASE · indigo underline = active)
- 우: org 이름 · status dot (green pulse) · avatar (28×28 radius-full)

### Left Sidebar (220px, 선택적)
- **Nav groups** — 11px mono UPPERCASE `text-tertiary` kicker
- **Nav items** — icon (14) + label (12) + optional count badge
- **Active**: `surface-3` bg · indigo left border 2px

### 공통 레이아웃 그리드
- Base container: `max-width: 1440px` · horizontal padding 40 (space-10)
- Main area: 40 padding · `gap: 24` between sections

---

## 1. `/sign-in` — Sign In

```
┌────────────────────────────────────────┐
│                                        │
│             [⋈ logo 52×52]             │
│                                        │
│        Sign in to Weaver (18/600)      │
│   Open-source agent builder — $0       │
│                                        │
│   [     Continue with GitHub     ]     │ <- white bg, black text
│   [   Email magic link (primary) ]     │ <- indigo primary
│                                        │
│  ──────── or self-host ────────        │
│  wrangler deploy (mono hint)           │
│                                        │
│  Apache 2.0 · github.com/getweaver     │
└────────────────────────────────────────┘
```

**레이아웃**:
- Centered card 400px · radius 12 · surface-1 · padding 32
- Background: `radial-gradient(at top, indigo-soft 0%, bg-base 60%)`
- Logo: 52×52 woven knot SVG (4색 스트로크)
- Heading: 18px/600 `text-primary`
- Sub: 12px `text-secondary`
- Footer: 11px mono · cyan link

---

## 2. `/` — Dashboard

### Layout
```
┌─Topbar (48)──────────────────────────────────────────────────────────┐
├─Sidebar(220)─┬──Main(1fr, padding 40, gap 24)────────┬─Side(360)────┤
│ Workspace    │ H1 Dashboard          [New Tool +]    │ Activity     │
│ · Tools  12  │ Sub: 10 tools running, 2 drafts       │ · feed       │
│ · Runs  38   │                                        │              │
│ · Evals      │ KPI grid (4 cols, gap 16)             │              │
│              │ [Runs 24h] [$$$] [Success %] [p95]    │              │
│ Catalog      │                                        │              │
│ · Registry   │ Tool list (12-col grid)               │              │
│ · Datasets   │ ┌─────────────────────────────────┐   │              │
│              │ │ [icon] name + desc │ 24 runs │  │   │              │
│ System       │ │        │ 93%       │ ▁▂▃▅▆▅   │  │   │              │
│ · Admin      │ │        │ [active]  │ →        │  │   │              │
│ · Audit      │ └─────────────────────────────────┘   │              │
└──────────────┴───────────────────────────────────────┴──────────────┘
```

### 상세

**KPI 카드 (4개)**:
- label (11px mono UPPERCASE `text-tertiary`)
- value (24px/600)
- delta (11px mono, green/red)
- sparkline (60×24 SVG polyline)

**Tool list row (12-col grid)**:
- Col 1: icon 28×28 · node color soft bg
- Col 2 (span 4): name (13/600) + description (12 `text-secondary`)
- Col 3: 24h runs (13 mono)
- Col 4: success % (badge)
- Col 5 (span 2): sparkline
- Col 6: status badge
- Col 7: chevron icon →

**Side column (360px)**: 최근 활동 피드 · 24h 실행 이력 · incident 배지

---

## 3. `/builder/:id` — Builder (핵심 화면)

### Layout
```
┌─Topbar──────────────────────────────────────────────────────────────┐
├─Palette(72)─┬─Canvas(1fr)────────────────────┬─Inspector(360)──────┤
│             │                                │ [ PROPS · TRACE ]   │
│  [+Input]   │  ┌──── grid 24px dots ────┐   │ ─────────────────── │
│  [+Tool]    │  │                         │   │ Node: policy_check  │
│  [+Agent]   │  │  [Input]→[Agent]        │   │ ─────────────────── │
│  [+Branch]  │  │     ↓       ↓           │   │ model: claude-4.6   │
│  [+Output]  │  │  [Tool]  [Branch]       │   │ temp: 0.2           │
│             │  │     ↓       ↓           │   │ prompt: (Monaco)    │
│  ─────      │  │  [Output][Slack]        │   │ ─────────────────── │
│             │  │                         │   │ NL composer:        │
│  [↶] [↷]    │  └─────────────────────────┘   │ [refund 로직 분리]  │
│             │  [−] 100% [+] [fit]             │ [Apply] [Cancel]    │
│             │                    [minimap]   │                     │
└─────────────┴────────────────────────────────┴─────────────────────┘
```

### 상세 규격

**Palette (72px)**:
- 수직 정렬 icon buttons (28×28 square)
- 각 버튼: node color dot + hover highlight
- 구분선 (border 1px)
- 하단: Undo / Redo · bg transparent

**Canvas**:
- bg `--bg-canvas`
- 24px dot grid (design-system.md §9.3 참고)
- Nodes 절대 위치 · 상태 styling 적용
- Zoom controls: bottom-left · surface-2 · radius 8
- Minimap: 180×120 · bottom-right

**Inspector (360px)**:
- Tabs: `PROPS` `TRACE` (line tabs · 11px mono UPPERCASE)
- **PROPS**: 폼 필드 (mono inputs, label 11 UPPERCASE, help 11 secondary)
- **TRACE**: 미니 로그 (최근 실행 10건 · 각 행: node name · duration · cost · status dot)
- **NL composer**: textarea (mono, cyan 키워드 highlight) · [Apply] [Cancel] 버튼

---

## 4. `/run/:id` — Run Detail

### Layout
```
┌─Topbar───────────────────────────────────────────────────────┐
├──Main(1fr)─────────────────────────────┬──Side(380)─────────┤
│ Run #01j7f3a2... (mono 11 cyan)        │ SELECTED SPAN       │
│ Tool: cs-refund-agent v3               │ ───────────────     │
│ Duration: 2.1s · Cost: $0.042          │ span_id: ...        │
│                                        │ model: claude...    │
│ ┌─Canvas read-only───────────────┐     │ input_tokens: 523   │
│ │ ● · ● · ● (status pills)       │     │ output_tokens: 127  │
│ └────────────────────────────────┘     │ ─────── prompt ─── │
│                                        │ (Monaco read-only)  │
│ WATERFALL                              │ ─────── response ── │
│ ┌────────────────────────────────┐     │ (Monaco read-only)  │
│ │ Input        [▓▓         ] 15  │     │                     │
│ │ Agent        [   ▓▓▓▓▓    ] 420│     │ [ Replay with edit ]│
│ │ Tool:http    [         ▓▓ ] 180│     │ [ Bookmark ]        │
│ │ Branch       [            ▓] 5 │     │                     │
│ │ Output       [             ▓] 2│     │                     │
│ └────────────────────────────────┘     │                     │
└────────────────────────────────────────┴────────────────────┘
```

### 상세

**Waterfall grid**: `280px · 1fr · 70px · 70px`
- Col 1: span label + node color dot
- Col 2: timeline bar (color by node type, width by duration ratio)
- Col 3: duration (mono)
- Col 4: cost (mono)

**Span inspector**:
- key-value pairs (mono 11)
- dashed separator between groups
- Monaco read-only for prompt/response

**Actions**:
- "Replay with edit" → Time-travel 디버깅 진입
- "Bookmark" → 문제 케이스 저장 (팀 공유)

---

## 5. `/eval/:id` — Eval Matrix

### Layout
```
┌─Topbar───────────────────────────────────────────────────────┐
│ Eval: cs-refund-agent v3 × cs-refund-v1                      │
│ Status: PASS (3/4 assertions, 1 soft fail)                   │
│                                                              │
│ ASSERTION MATRIX                                             │
│ ┌──────────────┬────────┬────────┬────────┬────────┬───────┐│
│ │              │ v1 sample│ v1 prod │ v2 edge│ v2 drift│v3 new││
│ │ accuracy     │ 91% 90 ✓│ 89% 90 ✗│ 93% 90 ✓│ 94% 90 ✓│95% ✓│
│ │ cost_5c      │ .04 5 ✓│ .05 5 ⚠│ .04 5 ✓│ .04 5 ✓│.04 ✓│
│ │ latency_3s   │ 2.1 3 ✓│ 2.8 3 ✓│ 2.1 3 ✓│ 2.1 3 ✓│1.9 ✓│
│ │ no_pii_leak  │ 0 0 ✓  │ 0 0 ✓  │ 0 0 ✓  │ 2 0 ✗ │ 0 ✓ │
│ │ polite_tone  │ 2.3 2.5⚠│ 2.4 2.5⚠│ 2.5 2.5✓│ 2.5 2.5✓│2.6 ✓│
│ └──────────────┴────────┴────────┴────────┴────────┴───────┘│
└──────────────────────────────────────────────────────────────┘
```

### 상세

**Matrix**: 6 col grid `200px · 5 × 1fr`
- Header row: mono 10px UPPERCASE kicker
- Left label: 13px/500 assertion name
- Cell:
  - Value 13px + target 10px mono
  - Left border 2px (green=pass, red=fail, amber=soft fail)
  - Hover → surface-2

**Case drill-down** (클릭 시 하단 expand):
- 개별 case ID · input · expected · actual · diff
- Monaco diff view

---

## 6. `/deploy/:id` — Deploy & Shadow

### Layout
```
┌─Topbar───────────────────────────────────────────────────────┐
│ Deploy: cs-refund-agent                                      │
│                                                              │
│ VERSION TRACK                                                │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│ │ v1 PROD  │  │ v2 SHADOW│  │ v3 DRAFT │                    │
│ │ ──────── │  │ ──────── │  │ ──────── │                    │
│ │ 93% acc  │  │ 94% acc  │  │ —        │                    │
│ │ $0.04/r  │  │ $0.04/r  │  │ —        │                    │
│ │ 2.1s p95 │  │ 1.9s p95 │  │ —        │                    │
│ │ [active] │  │ 10% live │  │ [edit]   │                    │
│ └──────────┘  └──────────┘  └──────────┘                    │
│                                                              │
│ PROMOTE GATE                                                 │
│ ✓ accuracy ≥ 90% (94%)                                       │
│ ✓ cost ≤ $0.05 ($0.04)                                       │
│ ✓ latency p95 ≤ 3s (1.9s)                                    │
│ ✓ no_pii_leak (0 detected)                                   │
│                                                              │
│ [   Cancel   ]          [   Promote to prod   ]              │
└──────────────────────────────────────────────────────────────┘
```

### 상세

**Version 카드 (3개)**:
- surface-1 · radius 12 · padding 16
- Border top 3px 색:
  - PROD → green
  - SHADOW → indigo
  - DRAFT → muted
- State 배지 (우상단)
- 지표 rows (dashed separator)

**Promote Gate**:
- surface-2 · radius 10 · padding 20
- 각 check: icon (✓ / ✗) + name + result (mono)
- 모든 ✓일 때만 promote 버튼 활성화

---

## 7. `/registry` — Tool Registry

### Layout
```
┌─Topbar───────────────────────────────────────────────────────┐
│ Tool Registry                          [+ Add Custom Tool]   │
│                                                              │
│ ┌──────┬────────────────────┬──────────┬─────────┬───────┐  │
│ │ ICON │ NAME + DESC        │ SCHEMA   │ STATE   │  →    │  │
│ ├──────┼────────────────────┼──────────┼─────────┼───────┤  │
│ │ 🌐   │ http               │ zod...   │ active  │       │  │
│ │      │ HTTP Request       │          │         │       │  │
│ │ 🗄   │ sql                │ zod...   │ active  │       │  │
│ │ 💬   │ slack_send         │ zod...   │ active  │       │  │
│ │ 💳   │ stripe_lookup      │ zod...   │ active  │       │  │
│ │ 📝   │ my_internal_api    │ openapi  │ draft   │       │  │
│ └──────┴────────────────────┴──────────┴─────────┴───────┘  │
│                                                              │
│ SELECTED TOOL: http                                          │
│ ┌─ Input Schema (Zod) ──┐  ┌─ Output Schema (Zod) ─┐       │
│ │ {                      │  │ {                       │       │
│ │   method: "GET"|...    │  │   status: number       │       │
│ │   url: string          │  │   body: unknown        │       │
│ │   ...                  │  │   ...                  │       │
│ │ }                      │  │ }                       │       │
│ └────────────────────────┘  └────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### 상세

**Table (7col grid)**: `56 · 1fr · 240 · 100 · 40`
- Icon col: 32×32 · node-tool soft bg · radius 6
- Name + desc: 13/600 + 12 secondary
- Schema col: truncated mono preview · click to expand
- State: badge
- → icon

**Schema block**:
- Monaco read-only · syntax highlight
- mono 11px · 1.65 line-height

---

## 8. `/admin` — Admin (Members + Audit)

### Members Tab
```
┌──────┬──────────┬─────────┬───────────┬─────────────┬────────┐
│ AVAT │ NAME     │ ROLE    │ EMAIL     │ LAST ACTIVE │ ACTION │
├──────┼──────────┼─────────┼───────────┼─────────────┼────────┤
│ [JP] │ 박진희   │ [admin] │ dev@...   │ 2m ago      │ [⋯]    │
│ [KS] │ Kim S.   │ [editor]│ kim@...   │ 1h ago      │ [⋯]    │
│ [LM] │ Lee M.   │ [viewer]│ lee@...   │ 2d ago      │ [⋯]    │
└──────┴──────────┴─────────┴───────────┴─────────────┴────────┘
```

- 7 col grid: `40 · 1fr · 100 · 1fr · 120 · 40`
- Role chip 색:
  - `admin` → indigo-soft / indigo
  - `editor` → tool-soft / tool (green)
  - `viewer` → surface-3 / text-secondary

### Audit Log Tab
- 시간순 table: `140 · 100 · 1fr · 180`
- Col 1: timestamp (mono 11 tertiary)
- Col 2: event kind (badge)
- Col 3: description (13 primary)
- Col 4: actor (avatar + name)

---

## 9. 반응형

### Breakpoints
- `< 768px` (mobile): 사이드바 → drawer, builder 캔버스 읽기 전용
- `768-1280px` (tablet): 사이드바 collapsible, inspector sidebar overlay
- `1280-1920px` (laptop): 기본 레이아웃
- `> 1920px` (monitor): max-width 1440 centered

**Builder는 태블릿 이상에서만 편집 가능**. 모바일은 viewer 전용.

---

## 10. 상태 표시 원칙

모든 화면에서 "실행 중 / 완료 / 실패" 상태는 **동일 배지 시스템**으로 통일:

- Running: `badge-running` + pulse dot
- OK: `badge-ok` + check icon
- Error: `badge-err` + x icon + 에러 메시지 첫 줄
- Warning: `badge-warn` + ! icon
- Draft: `badge-muted`

## 11. 빈 상태 카피 예시

| 화면 | 카피 |
|---|---|
| Dashboard tool list | *"No tools yet. Create your first agent."* |
| Run list | *"No runs yet. Trigger a webhook or schedule."* |
| Eval | *"No evals yet. Upload a dataset to start."* |
| Members | *"You're the only member. Invite teammates."* |
| Audit | *"No activity in the last 7 days."* |

## 12. 참고

- `example/design/Weaver Wireframes.html` — 원본 와이어프레임 라이브 데모
- `example/design/Weaver Design System v2.html` — 디자인 시스템 최신 버전
- [`design-system.md`](./design-system.md) — 토큰 상세
- [`node-types.md`](./node-types.md) — 노드 타입 스펙
