# example/design/

> Weaver 디자인 시스템 소스 파일. Claude Design 으로 생성된 HTML 라이브 데모 + CSS 토큰.

## 파일 목록

| 파일 | 역할 | 줄 수 |
|---|---|---:|
| `tokens.css` | **디자인 토큰 단일 진실의 원천** (색·타이포·간격·모션 등 420+ 토큰) | 150 |
| `Weaver Design System.html` | 디자인 시스템 v1 라이브 데모 (legacy) | 784 |
| `Weaver Design System v2.html` | **최신 버전** — 컴포넌트 카탈로그 · 상태 매트릭스 | 1,792 |
| `Weaver Wireframes.html` | 8개 화면 와이어프레임 라이브 데모 | 1,551 |

## 어떻게 보나

브라우저에서 바로 열기:

```bash
open "example/design/Weaver Design System v2.html"
open "example/design/Weaver Wireframes.html"
```

## 어떻게 적용되나

1. **`tokens.css`** → `apps/web` 에서 import 후 Tailwind v4 `@theme` 바인딩
2. **디자인 시스템 스펙** → `specs/design-system.md` (해석 · 사용 규칙)
3. **화면 레이아웃** → `specs/screens.md` (구현 가이드)
4. **노드 시각 규격** → `specs/node-types.md`

## 변경 관리

- 디자인 변경 제안은 ADR로 (예: `docs/decisions/ADR-007-*.md`)
- `tokens.css` 를 먼저 수정한 뒤, `specs/design-system.md` 갱신
- HTML 데모는 참고용. 프로덕션 UI는 RR7 + React로 재구현
