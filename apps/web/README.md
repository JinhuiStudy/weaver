# @weaver/web

> **빌더 UI** — React Router v7 Framework Mode on Cloudflare Workers

## 상태 (2026-04-22)

🚀 **라이브**: https://weaver-web.jinhuistudy.workers.dev

## 라우트

| 경로 | 역할 |
|---|---|
| `/` | 랜딩 · 히어로 · 4노드 데모 |
| `/design` | 디자인 시스템 쇼케이스 (10 섹션) |
| `/builder/:id` | 에이전트 캔버스 빌더 |
| `/tools/:toolId/runs/:runId` | Run 상세 페이지 |

## 핵심 기능

- Claude Design v2 토큰 ⇒ Tailwind v4 `@theme` 바인딩 (raw hex 0)
- 컴포넌트 라이브러리: `Button` · `Input` · `Badge` · `Card` · `Tabs` · `Kbd` · `Tooltip` · `Skeleton` · `Empty` · `Toast`
- `WvNode` 캔버스 프리미티브 (5 type × 7 state) + xyflow `Handle`
- 팔레트 → 캔버스 드래그&드롭 · 포트 엣지 연결 · 인스펙터 valibot 검증 · branch outputs chip 편집
- **Yjs + y-indexeddb** 로컬 영속 (새로고침해도 보존)
- 키보드 단축키 + 버튼 + Help 패널
- Run 버튼 → Runtime API 프록시

## 개발

```bash
pnpm dev              # http://localhost:5173
pnpm build            # react-router build
pnpm typecheck        # tsc strict 0 에러
pnpm test:e2e         # Playwright (headless)
pnpm test:e2e:ui      # Playwright UI 모드

# 배포 (Doppler 필요)
doppler run --project weaver --config dev -- pnpm deploy
```

환경 변수:
- `VITE_RUN_URL` — runtime base URL (prod: `https://weaver-runtime.jinhuistudy.workers.dev`)

## 테스트

- Playwright e2e **42 시나리오** · 스크린샷 `tests/screenshots/` 에 commit
- 단계별 PNG 눈 검증 필수 (CLAUDE.md 테스트 규율)

## 다음 개발

`docs/NEXT.md` Sprint 0~9 참조. 가까운 작업:
- **Sprint 0 (W5)**: `/login` 페이지 · 세션 hook · loader 가드
- **Sprint 1 (W6)**: `/@{handle}/{slug}` 공개 agent 페이지 · Fork 버튼
- **Sprint 2 (W7)**: `/runs/:runId` timeline waterfall · span 상세

## 참고
- [`../../docs/NEXT.md`](../../docs/NEXT.md) — 실행 계획
- [`../../docs/decisions/ADR-007-evolving-agent-network.md`](../../docs/decisions/ADR-007-evolving-agent-network.md) — 피봇 맥락
- [`../../specs/design-system.md`](../../specs/design-system.md) — 디자인 규칙
- [`../../example/design/tokens.css`](../../example/design/tokens.css) — 토큰 단일 진실 원천
