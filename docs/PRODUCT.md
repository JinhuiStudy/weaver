# Product

## 0. 비용 (핵심 차별화)

**MVP 고정 월 비용 $0.** ADR-006 [Free-tier First](./decisions/ADR-006-free-tier-first.md) 정책에 따라 전 스택이 무료 tier. 유료 대안은 트래픽 임계 도달 시에만 전환.

- **Workers Free** (100k req/day) · **D1** (5GB) · **R2** (10GB) · **Workers AI** (10k neurons/day)
- **Axiom Free** (500GB/월) · **Sentry Dev** (5k/월) · **GitHub Actions** (퍼블릭 무제한)
- **BYOK** — 고품질 LLM 필요 시 유저가 Claude/OpenAI 키로 사용 (우리 비용 0)

Retool $250/팀 · Braintrust $250/팀 · Langfuse $99/팀 대비 **도입 마찰 0**.

## 1. 킬러 피처 6개

### ① Time-Travel 디버깅
과거 실행 한 건을 **동일한 LLM·툴 상태로 재생**. 프롬프트만 바꿔서 "그때 v2였다면 어땠을까?" 확인.

- **구현**: DO의 `run.history[]` 가 모든 LLM 응답·툴 결과를 결정론 재생 가능하게 저장
- **비교 대상**: Langfuse는 로그만 보여주고 재생 없음

### ② 자연어 리팩토링
*"이 에이전트에서 refund 로직만 분리해줘"* → Claude가 노드 분리·엣지 재배선 diff를 제안.

- **구현**: 현재 그래프 JSON + 자연어 → Claude → 그래프 diff JSON → Yjs Y.applyUpdate
- **비교 대상**: v0는 UI만. Cursor는 코드만. **워크플로우 리팩토링은 공백**

### ③ Local-first 캔버스 (+ Phase 2 실시간 협업)
**MVP**: 로컬 Y.Doc + IndexedDB 영속 → 오프라인 편집, D1에 3초 디바운스 스냅샷. 충돌 시 CRDT merge.
**Phase 2 (post-launch)**: Fly.io 무료 VM 3대에 y-websocket 서버 배포 → 실시간 커서·presence 추가. 비용 여전히 $0.

- **구현**: Yjs + y-indexeddb (Phase 1) → y-websocket (Phase 2)
- **비교 대상**: Retool pessimistic lock. ADR-004 참고.

### ④ 비용 가드레일
실행 전 예상 비용 표시, 월 한도 도달 시 자동 차단.

- **구현**: 프롬프트 토큰 estimate × 모델 단가 + 툴별 평균 비용
- **비교 대상**: 어떤 에이전트 플랫폼도 pre-execution cost estimate 없음

### ⑤ 타입 안전 툴 레지스트리
툴 = 타입 있는 함수. OpenAPI → Zod → 에이전트 function-calling JSON Schema 자동 동기화.

- **구현**: `packages/core/tool.ts`의 `defineTool()` 팩토리. 실행 시 input/output을 zod로 검증
- **비교 대상**: LangChain 툴은 런타임 검증 부재. Pydantic 쓰려면 파이썬.

### ⑥ Shadow Eval
새 버전을 프로덕션 real 요청의 N%로 섀도 실행. 구버전과 정량 비교 후 승격.

- **구현**: Runtime에서 요청 수신 시 version 라우팅 + shadow 호출 병렬 실행 (결과는 버림, trace만 남김)
- **비교 대상**: 이 기능이 내장된 에이전트 플랫폼은 현재 **한 개도 없음**

---

## 2. 데모 시나리오 5개

각 시나리오는 3분 비디오로 제작, YouTube + Product Hunt에 게시.

### 시나리오 A — CS 환불 자동화 (1차 데모)

**타깃 청중**: SaaS 창업자, CS 팀 리드

```
00:00  CS 매니저가 Weaver 열기
00:05  "환불 신청을 받으면 주문 조회하고, 7일 이내면 승인, 아니면 매니저에게 Slack 알림"
00:15  → 4개 노드 자동 생성 (webhook / stripe_lookup / policy_check / branch{approve, slack})
00:25  각 노드 클릭하며 프롬프트 미세조정
00:40  과거 환불 30건 데이터셋 업로드 → eval 실행
01:00  정확도 93%, 평균 $0.04, 2.1s
01:10  Shadow 10% 배포
01:30  3일 후 결과 비교 화면 (v1 vs v2)
01:45  100% 승격
02:00  라이브 trace 패널 → 문제 케이스 북마크
02:30  프롬프트 개선 → 새 버전
03:00  정리: Retool로는 이 전체 워크플로를 만들 수 없음
```

### 시나리오 B — 리드 스코어링 파이프라인

**타깃**: B2B SaaS RevOps

- Webhook → enrich(Apollo) → score(Claude) → branch(high/low) → Salesforce upsert / Slack notify
- eval: 과거 1000 리드 → conversion rate 예측 정확도

### 시나리오 C — 주간 리포트 에이전트

**타깃**: 스타트업 전체

- Cron → SQL 쿼리 5개 → summarize(LLM) → Slack DM to founders
- 비용 가드레일: 월 $5 한도

### 시나리오 D — 고객 문의 분류·라우팅

**타깃**: 지원팀

- 이메일 수신 → classify(12 카테고리) → branch → {FAQ bot, Tier 1, Tier 2, urgent-to-oncall}
- Time-travel 디버깅: 분류 실패 케이스를 다시 돌려 개선

### 시나리오 E — 데이터 품질 에이전트

**타깃**: 데이터팀

- Nightly → 10 테이블 anomaly 체크 → LLM이 root cause 후보 제안 → PagerDuty or Slack

---

## 3. 주요 화면 목록

### 3.1 대시보드 `/`

- 내 툴 목록 (최근 실행 기준)
- 조직 비용 이번 달 / 한도
- 실패율 이상치 알림
- 승인 대기 human-in-the-loop 건수

### 3.2 빌더 `/tools/:id`

> **상세 레이아웃은 [`specs/screens.md §3`](../specs/screens.md)** 참고. 라이브 데모: `example/design/Weaver Wireframes.html`.

- **Palette (72px)** — 좌측 수직 아이콘 버튼: Input · Tool · Agent · Branch · Output (node color dot 포함) + Undo/Redo
- **Canvas** — `--bg-canvas` 도트 그리드(24px) · 노드 drag/select/connect · bottom-left zoom controls · bottom-right 미니맵(180×120)
- **Inspector (360px)** — 상단 탭 `PROPS` / `TRACE` (line tabs · 11 mono UPPERCASE)
  - **PROPS**: 선택 노드의 프롬프트(Monaco), 스키마(valibot), 재시도·타임아웃, 모델 설정
  - **TRACE**: 최근 실행 10건 미니 로그 + Live 인디케이터 (pulse dot)
  - **NL composer 토글**: 자연어 입력 → diff preview → Apply/Cancel

디자인 토큰·색상·간격은 [`specs/design-system.md`](../specs/design-system.md).

### 3.3 실행 상세 `/tools/:id/runs/:runId`

- 시간순 waterfall (D3 or xyflow time view)
- 노드별 입출력 JSON diff
- LLM 호출: 원본 프롬프트 · 응답 · 토큰 · 비용
- 툴 호출: HTTP 요청·응답 full dump
- 재생 버튼 (Time-travel)
- 북마크, 팀 공유 링크, 코멘트

### 3.4 Eval `/tools/:id/eval`

- 데이터셋 탭 (업로드, 버전, 10-20건 미리보기)
- 어서션 DSL 에디터 (Monaco + schema)
- 실행 기록 (버전 × 데이터셋 매트릭스)
- 개별 케이스 드릴다운

### 3.5 배포 `/tools/:id/deploy`

- 현재 프로덕션 버전
- Shadow 중인 버전 + 비교 지표
- 승격 버튼 (eval 통과 필수)
- 롤백 이력

### 3.6 조직 `/admin`

- 멤버 · 역할
- 툴 레지스트리 (HTTP · SQL · Slack · Stripe · 커스텀 HTTP)
- 예산 · 사용량
- 감사 로그

---

## 4. 경쟁 제품 대비 피처 매트릭스

| 피처 | Weaver | Retool | v0 | Langfuse | LangGraph | n8n |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 자연어 → UI·워크플로 | ✅ | ❌ | ✅ UI만 | ❌ | ❌ | ❌ |
| 에이전트 일등 시민 | ✅ | ❌ | ❌ | ✅ | ✅ | 부분 |
| 관측성 내장 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Eval 배포 게이트 | ✅ | ❌ | ❌ | 부분 | ❌ | ❌ |
| Shadow 트래픽 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 실시간 협업 캔버스 | ✅ | 부분 | ❌ | ❌ | ❌ | ❌ |
| Time-travel 디버깅 | ✅ | ❌ | ❌ | ❌ | 부분 | ❌ |
| 비엔지니어 사용 | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| 비용 가드레일 | ✅ | ❌ | ❌ | 부분 | ❌ | ❌ |
| 자체 호스팅 | ✅ | 부분($) | ❌ | ✅ | ✅ | ✅ |

**Weaver만이 10/10.** 한 제품도 6개 이상 체크 못함.

---

## 5. 로드맵 범위 (상세는 ROADMAP.md)

### v0.1 MVP — Week 1-8
- Canvas + 5 노드 프리미티브
- Claude 자연어 생성
- Durable Object 런타임
- OTEL trace + 기본 뷰어
- 4 내장 툴 (HTTP/SQL/Slack/Stripe)
- 로컬 단일 유저

### v0.5 Beta — Week 9-12
- Eval 러너 + 어서션 DSL
- Shadow 트래픽
- Yjs 멀티유저 캔버스
- RBAC · 감사 로그

### v1.0 Launch — Week 13-14
- 문서 사이트 (Astro)
- 데모 영상 × 5
- HN · Product Hunt · dev.to · X · Discord 동시 런칭

### v1.x Post-launch — Month 4-6
- 엔터프라이즈 SSO
- 커스텀 툴 marketplace
- Ollama · vLLM 어댑터 (자체 호스팅 LLM)
- Python SDK (툴 작성용)
