# ADR-006 — Free-tier First 정책

- **상태**: 수락 (2026-04-21)
- **Supersedes**: ADR-002 (Durable Objects) — 무료 대안으로 전환
- **관련**: TECH_STACK.md, ARCHITECTURE.md

## 맥락

Weaver MVP는 **개인이 자력으로 런칭**하는 프로젝트. 수익 발생 전까지 고정 운영 비용이 발생하면 재정적 스트레스로 개발 지속성이 깨진다.

## 결정

**모든 레이어를 무료 tier만으로 구성한다.** 유료 대안은 "유저 트래픽 발생 후 결정".

### 원칙

1. **고정 월 비용 $0** — 런칭까지 단 한 달도 결제 카드 등록 없이 동작해야 함
2. **자체 호스팅 1:1 대안 필수** — 모든 유료 SaaS 의존 시 OSS self-host 경로 문서화
3. **BYOK (Bring Your Own Key)** — Claude/OpenAI 같은 per-usage 비용은 유저 부담
4. **Paid 전환은 트리거 기반** — 월 활성 유저 · 에러 수 · trace 량이 무료 한도에 도달할 때 의사결정

## 적용 결과

### Core 스택 (전부 $0)

| 영역 | 선택 | 무료 한도 | Paid 전환 트리거 |
|---|---|---|---|
| 엣지 런타임 | Cloudflare Workers Free | 100k req/day | DAU 5k+ |
| 프런트 | Cloudflare Pages | 무제한 | — |
| 메타 DB | Cloudflare D1 | 5GB · 25B reads/월 | 툴 10만 개+ |
| 파일 | Cloudflare R2 | 10GB · 1M Class A ops | 파일 100만 개+ |
| KV | Cloudflare KV | 100k reads/day | 세션 폭증 |
| 추론 (기본) | Workers AI | 10k neurons/day | 상업 배포 → BYOK |
| 추론 (고품질) | 유저 BYOK | 유저 부담 | — |
| Trace | Axiom Free | 500GB/월 | 초과 시 → 자체 호스팅 Jaeger |
| 에러 | Sentry Developer | 5k errors/월 | 초과 시 → GlitchTip 자체 호스팅 |
| CWV | Cloudflare Web Analytics | 무료 | — |
| CI | GitHub Actions (퍼블릭 레포) | 무제한 | — |
| 도메인 | `weaver.pages.dev` | 무료 서브도메인 | 수익 발생 후 `.dev` 구매 |
| 시크릿 | `wrangler secret` | 무료 | 팀 증가 시 1Password CLI |

### 제거된 유료 의존

| 제거 | 이유 | 대체 |
|---|---|---|
| Durable Objects | Workers Paid $5 필수 | **D1 + Cron Triggers** 아키텍처 (ADR-002 재작성) |
| Cloudflare Queues | Workers Paid | Cron Triggers + D1 state polling |
| ClickHouse Cloud $30 | 고정비 | Axiom Free (500GB/월) |
| Sentry Team $26 | 고정비 | Sentry Dev 5k errors/월 |
| Doppler Team | 불필요 | `.dev.vars` + `wrangler secret` |
| Chromatic | Playwright 빌트인 | `toHaveScreenshot` 시각 회귀 내장 |
| CircleCI | 무료 tier 6k분 한도 | GitHub Actions (퍼블릭 레포 무제한) |
| `weaver.dev` 도메인 | $12/년 | `weaver.pages.dev` 무료 |

## Trade-off

### 잃는 것

1. **실시간 멀티유저 캔버스 (MVP 제외)**
   - Yjs WebSocket 서버가 지속 실행 필요 → Workers Free 100k req/day 불가 (WebSocket 연결당 여러 req)
   - **대안**: Local-first. Y.Doc 로컬 저장 + D1 스냅샷 주기 동기화. 실시간 커서 없음.
   - **v1.x에서 확장**: Fly.io 무료 VM 3대(각 256MB, 영구 무료)에 y-websocket Docker 호스팅. $0 유지.

2. **Durable Objects의 우아한 상태 관리**
   - 1 DO = 1 run 개념은 매력적이지만 Paid 필수.
   - **대안**: D1 `agent_runs` 테이블에 상태 기록, Cron Trigger가 매 1분 pending 건 처리.
   - **추가**: "self-fetch" 패턴으로 step 완료 직후 즉시 다음 step 호출 → latency 거의 유지.

3. **ClickHouse의 고급 집계 쿼리**
   - `quantile()`, `histogram()` 네이티브.
   - **대안**: Axiom이 OTEL 네이티브 + APL(Axiom Processing Language)로 유사 집계 지원. 500GB/월 무료는 MVP 수준 압도.

### 얻는 것

1. **런칭까지 $0** — 카드 등록 스트레스 0
2. **자체 호스팅 경로 명확** — 엔터프라이즈 제안 시 "같은 OSS 스택 + on-prem" 즉시 가능
3. **Cloudflare 단일 생태계** — `wrangler.toml` 한 파일로 전 인프라
4. **공격적 런칭 가능** — 트래픽 폭발해도 무료 한도 내 수용, 그 다음 Paid 결정

## 트리거: Paid 전환 시점

| 지표 | 발동 조건 | Paid 선택 |
|---|---|---|
| DAU > 5,000 | Workers Free 100k req/day 초과 | Workers Paid $5 |
| 에이전트 실행 > 10k/day 장기 | Cron 1분 간격 한계 | Durable Objects 복원 ($5) |
| Trace > 500GB/월 | Axiom Free 초과 | Axiom Pro 또는 자체 호스팅 Jaeger |
| 에러 > 5k/월 | Sentry Dev 초과 | GlitchTip self-host ($0) 또는 Sentry Team ($26) |
| 실시간 협업 요구 다수 | Yjs 서버 필요 | Fly.io 무료 3VM → 초과 시 Fly.io Paid |
| 커스텀 도메인 요구 | 브랜딩 수준 | `weaver.dev` 등록 ($12/년) |

## OSS 자체 호스팅 문서화

모든 유료 의존은 `docs/self-host/` 가이드 포함:

- `self-host/trace-jaeger.md` — Jaeger + Elasticsearch on Docker
- `self-host/error-glitchtip.md` — GlitchTip Docker Compose
- `self-host/ai-ollama.md` — Ollama + Open WebUI 연동
- `self-host/collab-yjs-fly.md` — Fly.io 무료 VM에 y-websocket

## 결과 예측

### 런칭 (Week 14)
- 인프라 비용 **$0**
- Product Hunt · HN 런칭 자산 100%

### 런칭 후 3개월
- DAU ~500, 에이전트 실행 ~5k/day
- **여전히 $0** (무료 한도 내)

### 런칭 후 6개월
- 만약 DAU 5k+ 도달 → Workers Paid $5 + Axiom Pro 검토
- 수익 (유료 호스팅 tier $49/팀) 시작 가능

## 대안 거부

### A. "일단 유료 쓰고 수익 나오면 유지"
거부 이유: 개인 프로젝트에서 월 $100+ 부담은 개발 지속성 위협. 재정 여유가 기술 선택을 왜곡하면 안 됨.

### B. "자체 호스팅 Oracle Cloud Free ARM VM 사용"
거부 이유: Oracle Cloud Free는 4 OCPU/24GB 매우 관대하나 관리 부담 증가. Cloudflare 생태계 우아함 상실. MVP엔 불필요.

### C. "AWS Free Tier 12개월"
거부 이유: 12개월 후 갑자기 과금. 예측 불가. Cloudflare는 영구 무료 tier.

## 참고

- [Cloudflare Workers Free plan](https://developers.cloudflare.com/workers/platform/pricing/)
- [Axiom Free](https://axiom.co/pricing)
- [Sentry Developer plan](https://sentry.io/pricing/)
- [Fly.io Free Allowance](https://fly.io/docs/about/pricing/)
