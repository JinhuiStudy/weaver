# Vision

> **"에이전트가 내부툴의 새 원자 단위이며, 관측성은 선택이 아닌 구조다."**

## 1. 시대가 요구하는 새 카테고리

2026년 현재, 내부툴 시장에서 네 가지 흐름이 동시에 일어나고 있다.

1. **내부툴의 민주화** — 엔지니어가 아닌 ops/cs/revops 팀원이 직접 툴을 만들고 싶어 한다. (Retool이 증명.)
2. **AI 에이전트의 프로덕션화** — 단순 프롬프트를 넘어 **툴을 호출하고 상태를 유지하는 에이전트**가 실무에 배포되고 있다. (LangGraph, OpenAI Assistants.)
3. **자연어로 UI 생성** — v0.dev·Bolt·Lovable이 검증한 "LLM → 코드"는 이미 돌이킬 수 없다.
4. **관측성 표준화** — OTEL의 GenAI 확장이 LLM/에이전트 trace를 공식 계측 대상으로 만들었다.

이 네 흐름을 **하나의 제품에서 통합한 플랫폼이 아직 없다**. Weaver는 그 공백을 차지한다.

## 2. 기존 솔루션의 한계

| 제품 | 강점 | 한계 |
|---|---|---|
| **Retool** | 성숙한 컴포넌트·DB 커넥터·RBAC | AI 에이전트가 외부 호출이고, 툴 자체가 상태를 가진 에이전트 워크플로가 아님 |
| **v0.dev / Bolt / Lovable** | 자연어로 UI 생성 | 런타임·권한·감사·관측 없음. 생성된 코드를 팀이 협업으로 유지보수할 인프라 없음 |
| **Langfuse / Braintrust / Helicone** | 에이전트 실행 관측 | 관측만 한다. 제품을 만들거나 배포 게이트를 걸지는 못함 |
| **n8n / Zapier / Make** | 자동화 플로우 | LLM 호출은 노드 하나일 뿐, 에이전트가 일등 시민이 아님. 비용·eval 관리 없음 |
| **LangGraph / Vercel AI SDK** | 에이전트 프레임워크 | 코드 전용. 비엔지니어 불가. 시각화·팀 협업·관측 별도 구축 |

**어떤 제품도 "자연어로 에이전트-기반 내부툴을 만들고, 실행을 관측하고, eval로 배포를 게이팅하는 End-to-end 플랫폼"이 아니다.**

## 3. Weaver의 핵심 테제

### 테제 1 — 에이전트가 내부툴의 단위다

> 기존 Retool의 단위는 **"쿼리 + UI 컴포넌트"**였다. 단순 CRUD에 최적화된 모델이다.
>
> Weaver의 단위는 **"에이전트 워크플로우"**이다. 단순 CRUD부터 복잡한 판단·툴 호출·사람 개입까지 같은 모델로 표현된다.

실제 예시:
- **CS 환불 처리** = `webhook → lookup_order → policy_check → [approve | escalate_to_manager]` 에이전트
- **리드 스코어링** = `new_lead → enrich → score(LLM) → [assign_to_sales | nurture]` 에이전트
- **데이터 요약 리포트** = `schedule → query_db → summarize(LLM) → send_slack` 에이전트

기존 Retool로도 위 셋을 만들 수는 있지만, LLM이 들어간 순간 **관측·비용·eval·버전 관리가 부재**해 프로덕션에 띄울 수 없다. Weaver는 그 부재를 제품 구조로 강제한다.

### 테제 2 — 관측성은 선택이 아닌 구조다

> Langfuse·Braintrust가 별도 제품인 이유는, 기존 에이전트 프레임워크가 관측을 **애드온**으로 취급하기 때문이다.
>
> Weaver에서는 **모든 에이전트 실행이 trace다.** 관측 없이는 실행조차 불가능한 구조.

결과:
- `trace-viewer`가 빌더 옆에 **항상** 열려 있다. 실행 즉시 재생 가능.
- **비용 가드레일** — 에이전트 실행 전 예상 비용이 표시되고, 월 한도 초과 시 자동 차단.
- **Eval 게이트** — 프로덕션 배포 전 데이터셋 × 어서션이 자동 실행되고, 임계값 미달 시 배포 블록.
- **Shadow 트래픽** — 새 버전을 프로덕션 real 요청의 N%로 섀도 실행, 기존 버전과 정량 비교 후 승격.

### 테제 3 — 비엔지니어가 만들고, 엔지니어가 감수한다

> Retool은 엔지니어 전용. v0는 누구든 쓸 수 있지만 유지보수 구조가 없음.
>
> Weaver는 두 집단의 역할을 **구조적으로 분리**한다.

- **ops/cs/revops** — 자연어로 에이전트 정의, 데모 데이터로 테스트, shadow 모드 요청
- **엔지니어** — 툴 레지스트리(HTTP/SQL/내부 API)에 새 툴 추가, eval 데이터셋 큐레이션, 프로덕션 승격 승인

이 협업 구조가 **제품에 내장**되어 있다. 별도 Slack 규약이 필요하지 않다.

## 4. 이것이 왜 지금인가

**Weaver는 2024년이었다면 설익었고, 2028년이었다면 늦다.**

| 시점 | 조건 |
|---|---|
| 2024 | 에이전트가 프로덕션에 덜 배포됨. 관측 표준 없음. 자연어 UI 생성 검증 전. |
| **2026 현재** | OTEL GenAI 표준, Claude 4.x 코드 생성 성숙, v0 이후 자연어 UI 검증, 에이전트 배포 폭증 중 |
| 2028 | OpenAI/Vercel/Retool 중 하나가 이 공백을 차지 완료. |

**창 = 12-18개월.** 이 안에 런칭해 카테고리를 정의하는 것이 미션이다.

## 5. 성공 지표

### 기술 지표 (12개월)
- GitHub star 5,000+
- npm weekly downloads 10,000+
- 자체 호스팅 팀 수 500+
- OSS 컨트리뷰터 20+

### 시장 지표 (18개월)
- OpenAI·Anthropic 공식 이벤트 연사
- YC 배치 합격 or Tier 1 VC 시드 라운드
- 유료 호스티드 팀 100+

### 개인 지표 (6개월)
- Product Hunt Daily Top 3
- HN Front page 2회 이상
- Anthropic·Vercel·Retool 중 1곳의 인재 팀에서 cold outreach 수신

## 6. 안 하는 것 (명시적 non-goals)

- **코드 생성 IDE 대체** — v0·Cursor·Bolt의 영역은 건드리지 않는다. Weaver는 에이전트 워크플로우 중심.
- **범용 자동화** — Zapier처럼 수천 개 통합을 지원하지 않는다. 내부툴 상위 20개 커넥터에 집중.
- **자체 LLM 학습** — 모델은 Claude·OpenAI·Gemini·Ollama 어댑터. 모델 자체는 타사 것.
- **클라이언트 앱** — 모바일/데스크톱 네이티브 앱은 로드맵에 없음. 웹 only.
- **no-code가 아닌 full-code 프레임워크** — LangGraph와 경쟁하지 않는다. Weaver는 **시각 + 팀 협업 + 관측**이 핵심.

---

**References**
- Ink & Switch — *Local-first software* (2019)
- Anthropic — *Effective agents* (2024)
- OpenAI — *Function calling + Assistants API*
- LangChain — *LangGraph state machines*
- Retool — *$3B valuation thesis*
- OTEL — *GenAI semantic conventions* (2025)
