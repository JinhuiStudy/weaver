# Competition & Positioning

## 1. 카테고리 맵

```
                   (AI-native)
                        ▲
                        │
       LangGraph ●      │      ● Weaver
         (dev-only)     │      (NEW: dev + ops)
                        │
                        │
 ●──────────────────────┼──────────────────────● (ops-native)
  v0.dev                │                   Retool
  (UI only)             │                   (no AI-native)
                        │
                        │
      n8n / Zapier ●    │    ● Langfuse
        (flow only)     │      (observe only)
                        ▼
                 (non-AI / limited)
```

Weaver는 **우상단** — "AI-native × ops-native" 유일 참여자.

## 2. 경쟁 제품 심층 분석

### 2.1 Retool ($3B valuation)

| 축 | 평가 |
|---|---|
| 강점 | 성숙한 쿼리 빌더, 100+ DB/API 커넥터, 엔터프라이즈 RBAC, 감사 |
| 약점 | AI는 외부 호출일 뿐. 에이전트 워크플로 일등 시민 아님. Pessimistic lock |
| 포지션 | 엔지니어·테크 ops 전용 |
| 가격 | 유저당 $10~$50 |

**Weaver 차별**: "에이전트 = 단위" 테제. Retool로 AI 에이전트 만들려면 custom components로 깎아야 함. Weaver는 네이티브.

**Weaver 전략**: Retool 유저의 **AI 파이프라인만 분리 이관**을 타깃. "Retool은 그대로, AI는 Weaver에."

---

### 2.2 v0.dev / Bolt / Lovable

| 축 | 평가 |
|---|---|
| 강점 | 자연어 → UI 생성 최초 검증. 디자인 품질 높음 |
| 약점 | 런타임 없음. 생성 후 자체 호스팅/유지보수는 유저 책임. 관측·eval·권한 없음 |
| 포지션 | 프로토타이핑, 신규 앱 시작 |
| 가격 | $20~50/월 |

**Weaver 차별**: v0는 **새로 만드는** 제품, Weaver는 **운영하는** 제품. 타깃 워크로드가 다름.

**Weaver 전략**: "v0로 만든 UI를 Weaver 에이전트로 연결" 블로그 포스트로 트래픽 유입.

---

### 2.3 Langfuse / Braintrust / Helicone

| 축 | 평가 |
|---|---|
| 강점 | LLM trace 관측, eval, 비용 대시보드 |
| 약점 | 관측만 한다. 제품을 만들거나 배포 게이트 걸지 못함. 비엔지니어 접근 불가 |
| 포지션 | AI 엔지니어 대상 애드온 |
| 가격 | Langfuse OSS 무료 + $99/월 cloud |

**Weaver 차별**: Weaver는 관측이 **제품의 구조**. 별도 가입·계측 불필요.

**Weaver 전략**: Langfuse와 **상호 호환**. OTEL exporter를 Langfuse로도 보낼 수 있게 해 기존 유저가 마찰 없이 옮기게.

---

### 2.4 n8n / Zapier / Make

| 축 | 평가 |
|---|---|
| 강점 | 수천 개 통합, 비주얼 워크플로, 대중성 |
| 약점 | LLM이 노드 하나일 뿐. 에이전트 상태·메모리·툴 체인 관리 부재 |
| 포지션 | 범용 자동화 |
| 가격 | n8n OSS 무료, Zapier $20~$250/월 |

**Weaver 차별**: 범용 자동화 vs 에이전트 전용. Weaver는 **"LLM이 주인공"**인 경우에만 사용.

**Weaver 전략**: "Zapier는 단순 CRUD 자동화, Weaver는 판단 에이전트" 메시지. 겹치지 않음.

---

### 2.5 LangGraph / Vercel AI SDK / Mastra

| 축 | 평가 |
|---|---|
| 강점 | 에이전트 프레임워크, 타입 안전, 활발한 커뮤니티 |
| 약점 | 코드 전용. 비엔지니어 불가. 시각화·협업·관측·eval 전부 별도 구축 |
| 포지션 | AI 엔지니어 |
| 가격 | OSS 무료 |

**Weaver 차별**: Weaver는 LangGraph 위에 **비주얼 레이어 + 운영 레이어**를 쌓는 제품이라고 볼 수도 있음.

**Weaver 전략**: LangGraph를 내부에 embed하지 말고 **호환 레이어** 제공. LangGraph로 짠 에이전트를 Weaver로 import → 캔버스 + 관측 + eval 추가.

---

### 2.6 OpenAI Assistants / GPTs

| 축 | 평가 |
|---|---|
| 강점 | OpenAI 생태계, 쉬운 시작 |
| 약점 | OpenAI 독점, 조직 RBAC 약함, 자체 호스팅 불가 |
| 포지션 | 개인 유저·스타트업 프로토타입 |

**Weaver 차별**: 멀티 모델, 자체 호스팅, 엔터프라이즈 감사, 팀 협업.

---

## 3. 피처 매트릭스 요약

| 피처 | Weaver | Retool | v0 | Langfuse | n8n | LangGraph |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 자연어 → 워크플로 | ✅ | ❌ | ✅ UI | ❌ | ❌ | ❌ |
| 에이전트 일등 시민 | ✅ | ❌ | ❌ | ✅ | 부분 | ✅ |
| 관측성 내장 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Eval 배포 게이트 | ✅ | ❌ | ❌ | 부분 | ❌ | ❌ |
| Shadow 트래픽 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 실시간 협업 | ✅ | 부분 | ❌ | ❌ | ❌ | ❌ |
| Time-travel 디버깅 | ✅ | ❌ | ❌ | ❌ | 부분 | ❌ |
| 비엔지니어 사용 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 비용 가드레일 | ✅ | ❌ | ❌ | 부분 | ❌ | ❌ |
| 자체 호스팅 | ✅ | 부분 | ❌ | ✅ | ✅ | ✅ |
| **10/10 스코어** | **✅** | 2 | 2 | 3 | 2 | 2 |

## 3.5 비용 차별 (결정적)

| 제품 | 최소 월 비용 (팀 5명) | Weaver |
|---|---:|---:|
| Retool Business | $250 | — |
| Langfuse Cloud Core | $99 | — |
| Braintrust Pro | $250 | — |
| n8n Cloud | $25 | — |
| Weaver (Self-host + Workers AI) | $0 | ✅ |
| Weaver (Self-host + BYOK Claude) | $0 (유저 키 비용만) | ✅ |

**구조적 우위**: $0 스택이라서 유저는 "시험해보고 싶을 때 즉시" 도입. 신용카드 장벽 0.

## 4. Weaver의 해자 (moat)

### 4.1 구조적 해자
- **관측성이 제품 구조**라는 테제 자체. 후발주자가 따라오려면 아키텍처 재설계 필요.
- **"에이전트 = 단위"** 레토릭. 한번 이 프레임을 사람들에게 심으면 Retool은 "AI 기능 있는 옛날 제품"으로 포지셔닝됨.
- **$0 Free-tier 스택**. 경쟁사 대부분 $25+/월 최소. 채택 마찰 0.

### 4.2 기술적 해자
- **OTEL GenAI + ClickHouse + Durable Objects 조합**을 이만큼 깊게 통합한 OSS가 0개.
- **xyflow + Yjs + Monaco 협업 조합**을 자연어 생성과 붙인 제품 0개.
- **Shadow traffic + eval gate**는 2026년 현재 어떤 AI 플랫폼에도 없음.

### 4.3 시장 해자
- **12-18개월 창** — OpenAI·Vercel·Retool이 이 공간에 들어오기 전 카테고리 정의 가능.
- **박진희 고유 자산** — maps-platform 10일 408커밋 실증. 동일한 속도·품질로 Weaver 런칭 가능하다는 신뢰.

## 5. 포지셔닝 메시지

### 개발자 대상
> *"Retool for AI agents — with observability as a first-class citizen."*

### Ops/CS 대상
> *"자연어로 AI 기반 내부툴을 만드세요. 엔지니어가 레일을 깔고, 당신이 운전합니다."*

### 투자자 대상
> *"$3B Retool 시장이 AI-native로 리셋되는 순간 포지션을 잡는다. 관측성이 구조인 첫 번째 제품."*

### 기술 커뮤니티 대상
> *"LangGraph + Langfuse + v0 + Retool의 교집합. OSS 라이선스, 자체 호스팅 가능."*

## 6. 리스크: 경쟁자 개입 시나리오

| 시나리오 | 확률 | 대응 |
|---|:-:|---|
| Retool이 AI-native 피처 출시 | 중 | 시각적 캔버스 × 관측성 통합 난이도가 moat |
| Anthropic이 Claude Agent Studio 런칭 | 중 | Weaver는 멀티 모델, 자체 호스팅 — 벤더 중립성 |
| Vercel이 AI SDK Studio 확장 | 낮 | Vercel은 빌드 중심, 운영 중심 아님 |
| LangChain이 Langfuse와 합병 | 중 | Weaver는 `운영 제품`, 상대는 `개발자 툴킷` |
| OSS fork 등장 | 낮 | 커뮤니티·문서·지원 품질이 방어선 |

## 7. 성공 시나리오 (24개월)

- GitHub star 10k+
- 유료 호스팅 팀 500+ ($25k/월 MRR)
- YC S26 or Tier 1 VC 시드 라운드 ($1.5-3M)
- Kubecon·DevDay·재플라이·Anthropic 공식 이벤트 연사
- Retool·Anthropic·OpenAI·Vercel 중 1곳 인수 오퍼 or 영입
