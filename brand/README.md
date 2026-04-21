# Weaver Brand

> 브랜드 요약. 디자인 시스템 전체는 [`specs/design-system.md`](../specs/design-system.md), 토큰 소스는 [`example/design/tokens.css`](../example/design/tokens.css).

## 1. 메시지

- **한 줄 (EN)**: *"Weave agents, tools, and observability into one fabric."*
- **한 줄 (KO)**: *"하나의 직물로 엮인 에이전트 · 툴 · 관측성."*
- **포지셔닝**: Retool의 밀도 + Linear의 침착함을 AI 에이전트 워크플로우 시대로.

## 2. 톤

- **DO**: 명확 · 진지 · 장인 감성 · 기술적
- **DON'T**: 이모지 남용 · 과장 형용사 ("super awesome", "magic")

### 좋은 예
> Weaver is an open-source platform where AI agents are the unit of internal tools. Every run is a trace. Every deploy is gated by evals. Every change is collaborative.

### 나쁜 예
> 🚀🚀 Super awesome AI agent builder with magic ✨ that just works!

## 3. 로고

### 컨셉
| 변종 | 설명 | 용도 |
|---|---|---|
| **Woven knot (primary)** | 4색 스트랜드(indigo·cyan·purple·emerald)가 한 노드에서 교차 | 메인 로고 |
| **Geometric W** | W자를 4색 선으로 분리 | 컴팩트 |
| **Loom circle** | 원 안 3 스트랜드 짜임 | 파비콘 |

### 워드마크
- Font: **Inter Variable 600**
- Tracking: **-0.02em**
- 로고 오른쪽 배치, 로고 높이의 0.5배 여백

### 사용 규칙
- 최소 크기: **24px**
- 최소 여백: 로고 높이의 **0.5배**
- 배경 대비: 다크 배경 권장 (`--bg-base #030305`)

## 4. 핵심 색

| 역할 | Hex | 용도 |
|---|---|---|
| Primary | `#6366F1` Weaver Indigo | CTA · 활성 · 로고 |
| Accent | `#06B6D4` Weaver Cyan | 선택 · 링크 · 강조 |
| Bg | `#030305` bg-base | 다크 기본 배경 |

### 노드 타입 5색 (절대 섞지 말 것)

| 타입 | Hex |
|---|---|
| 🔵 Input | `#3B82F6` |
| 🟣 Agent | `#A855F7` |
| 🟢 Tool | `#10B981` |
| 🟡 Branch | `#F59E0B` |
| 🔴 Output | `#EF4444` |

## 5. 타이포

- **Sans (UI)**: Inter Variable (fallback Pretendard Variable for 한글)
- **Mono (code, meta, telemetry)**: JetBrains Mono
- **Display**: Inter 600 · -0.02em tracking · max 40px

## 6. 채널

### 확정
- 슬로건: *"Weave agents, tools, and observability"*
- 메인 도메인: `weaver.pages.dev` (Cloudflare 무료 서브도메인)

### 보류 (수익 발생 후)
- 커스텀 도메인 `weaver.dev`
- 소셜:
  - X: `@weaverdev` (후보)
  - Discord: `discord.gg/weaver` (후보)
  - GitHub org: `getweaver` or `weaver-oss`

### npm / 패키지 네임스페이스
- `@weaver/core`, `@weaver/canvas`, `@weaver/runtime`, `@weaver/observability`, `@weaver/eval`

## 7. 오픈소스 배지 · 소셜 카드

- shields.io 배지: Apache 2.0 · npm version · downloads · GitHub stars
- Open Graph 이미지: 다크 배경 (`--bg-base`) + 로고 + 한 줄 카피
- Social card template은 런칭 Week 13 준비

## 8. 디자인 시스템 소스

- **토큰**: `example/design/tokens.css` (420+ tokens)
- **시스템 문서**: `specs/design-system.md`
- **화면 와이어프레임**: `specs/screens.md`
- **노드 스펙**: `specs/node-types.md`
- **HTML 라이브 데모**: `example/design/Weaver Design System v2.html` 브라우저로 열기

## 9. 접근성

| 조합 | 대비 | WCAG |
|---|:-:|:-:|
| text-primary / bg-base | 15.7:1 | AAA |
| text-secondary / bg-base | 8.2:1 | AA |
| indigo / bg-base | 6.1:1 | AA |

**색만으로 정보 전달 금지** — 아이콘·텍스트·패턴을 항상 병행.
