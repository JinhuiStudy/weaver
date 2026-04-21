# ADR-007 — Pivot: Evolving Agent Network (유저 $0 · Fork · Evolution)

- **상태**: ✅ Accepted (2026-04-22)
- **Supersedes**: 초기 "내부툴 플랫폼 (CS agent 포함 · BYOK)" 방향
- **관련**: ADR-006 (Free-tier First), ADR-008 (Evolution 엔진)

## 맥락

Week 1 코어 배포 완료 후 제품 방향 재검토. 2026년 AI agent 시장은 다음 방향으로 수렴:

1. **프레임워크 레이어**: LangGraph, Mastra, Vercel AI SDK v5 (이미 포화)
2. **빌더 UX 레이어**: Retool AI, Dify, Flowise (빠르게 성숙)
3. **관측성 레이어**: Langfuse, Helicone, Arize (이미 상용)

Weaver 가 "horizontal 에이전트 빌더 + 관측성 + $0 edge" 로 포지셔닝하면 위 경쟁사들과 정면 충돌. 1인 14주로는 차별화 불충분.

**동시에 시장에 없는 공백**:
- Agent 가 **공유/포크/진화** 하는 구조 — ChatGPT Custom GPTs가 유일하게 가깝지만 OpenAI 잠금 + 편집 제한
- Agent 출력이 **구독 가능한 스트림** 으로 존재 — RSS-for-agents 는 없음
- **유저 비용 $0** — 거의 모든 AI agent 플랫폼이 유저 과금 (API, 구독, usage)

## 결정

Weaver 는 **"Evolving Agent Network"** 로 재포지셔닝. 한 줄:

> **Fork agents. Rate them. They evolve. Free forever.**

### 4가지 축

1. **Agent as Media**: 모든 agent 는 기본 공개, 공개 URL (`weaver.dev/@user/agent-slug`), 출력은 구독 가능한 JSON feed.
2. **Fork + Genealogy**: Fork 버튼이 1등 시민 (CodePen/Observable 모델). 원작자 credit + 포크 트리 시각화.
3. **Evolution**: 실행마다 implicit feedback (👍/👎) 수집 → 자동 prompt mutation/crossover/selection 으로 agent 가 자가 개선 (상세: ADR-008).
4. **User Cost $0**: 유저는 BYOK 없이도 Workers AI (Llama 3.3) 로 작동. 유저당 일 cap (10 run ≈ 50 neurons/일) 으로 Free tier 공유.

### 타겟 유저 (재정의)

| 제거됨 | 새 타겟 |
|---|---|
| 기업 CS 팀 (Stripe/Zendesk 필요) | 개인 개발자 · 메이커 |
| 엔터프라이즈 구매자 | 학생 · 연구자 · 리서처 |
| SaaS 팀 (Slack 유료 워크스페이스) | 크리에이터 (유튜버, 블로거) |

초기 시나리오:
- "내 GitHub PR 요약 → 매일 아침 이메일"
- "HN 탑 10 → 한국어 요약 feed"
- "내 RSS 20개 → 주간 브리핑"
- "북마크한 글 → 주제별 노션 정리"

### 수익 모델 (장기 · 유저 $0 유지)

첫 1년은 OSS + $0 운영 (GitHub Sponsors). 이후 선택:
- **Enterprise tier** (SSO · audit · private mode · $99+/월) — 개인 유저 영향 없음
- **크리에이터 tip** (Stripe Connect, 팁 주는 사람 선택) — 기본 유저 $0
- **Sponsored agents** (feed 광고, 정돈된 포맷) — 유저 아닌 스폰서 지출

## 대안 고려

### A. Horizontal agent builder (기존 방향)
- **Pros**: 범용성, 큰 TAM
- **Cons**: LangGraph/Mastra/Dify 와 정면 경쟁, 1인 14주로 승산 낮음
- **결과**: 기각

### B. Narrow vertical (Stripe CS 자동화)
- **Pros**: 명확한 moat, 런칭 demo 강력
- **Cons**: 유저 Stripe 계정 + 비용 발생 → 유저 $0 정책 위배
- **결과**: 기각 (유저 $0 전제에서)

### C. Local-first (WebLLM 브라우저 실행)
- **Pros**: 궁극적 privacy, $0
- **Cons**: 2026년 WebLLM 실용 속도 미달, 14주 구현 위험
- **결과**: 2027+ Phase

### D. **Evolving Agent Network** (채택)
- **Pros**:
  1. 시장 공백 (agent 소셜 + 진화 = 아무도 안 함)
  2. 유저 $0 달성 가능 (Workers AI 공유 + per-user cap)
  3. 네트워크 효과 moat (fork 트리 · eval 데이터)
  4. 14주 1인 delivery 가능 (기존 기술 스택 연장)
- **Cons**:
  1. 바이럴 시 Workers AI 10k neurons/일 한도 (→ 대기열 + 선택적 BYOK 대응)
  2. 악성 agent 모더레이션 부담 (→ 초기 invite-only + LLM 모더레이션)
  3. 수익 모델 불확실 (→ 1년 장기전 수용)

## 기술적 영향

### 새 Cloudflare 자원 도입 (전부 Free tier)
- **Vectorize**: agent 검색 · 유사 agent 추천 (30M queried · 5M stored dims/월 free)
- **Analytics Engine**: trending · genealogy 통계 (100k writes/day free)
- **Workers AI embeddings** (bge-base-en-v1.5): agent 벡터화 (기존 AI binding 재사용)

### 스키마 확장 (Sprint 0~2 에 걸쳐 도입)
- `agents`: public slug, creator_user_id, fork_of_agent_id, visibility
- `agent_versions`: 각 버전 graph snapshot · prompt 해시
- `agent_feedback`: 실행당 👍/👎 · 코멘트
- `agent_subscriptions`: 누가 누구를 follow
- `agent_evolutions`: 자동 생성된 prompt 변형 제안 로그

### 런타임 변경
- `POST /api/runs` → session org 대신 **agent slug 기반** (fork 실행 시에도 creator 추적)
- 유저당 rate limit: 일 10 run, 분 3 run (남용 차단)
- Workers AI 호출 전 neurons budget 체크 (유저 cap 초과 시 429 + Retry-After)

## 런칭 메시지 변경

| 이전 (A 방향) | 이후 (E 방향) |
|---|---|
| "AI 에이전트를 내부툴의 원자 단위로" | "**Fork agents. Rate them. They evolve. Free forever.**" |
| "$0 월 비용 SaaS" | "**유저도, 우리도, 영원히 $0**" |
| "관측성 통합" | "**당신이 좋아요를 누르면 agent 가 진화합니다**" |

## 성공 지표 (Week 14 런칭 D+30일)

- [ ] 100+ seed agents (W13 invite-only 단계)
- [ ] 1,000 DAU (Free tier 상한)
- [ ] 20% agents 가 fork 됨 (네트워크 효과 증거)
- [ ] v2 suggestion 수락률 40%+ (evolution 엔진 실제 작동)
- [ ] Workers AI neurons 소진 유저당 평균 30% 이하 (cap 실효성)

## 관련 문서 업데이트

- `docs/NEXT.md` — 14주 주차별 계획 전면 재작성 (horizontal → evolving network)
- `docs/ROADMAP.md` — Week 5-14 재구성
- `README.md` — 한 줄 pitch 및 타겟 유저 변경
- `CLAUDE.md` — 설계 원칙 #1 "에이전트 = 내부툴의 단위" → "**에이전트 = 진화하는 공개 미디어**" 로 업데이트
- `VISION.md` — "카테고리 창출" 서사 재작성
- ADR-006 — "유저 비용 $0" 조항 추가
- ADR-008 (신규) — Evolution 엔진 알고리즘 상세
