# ADR-008 — Evolution Engine (Prompt Mutation · Crossover · Selection)

- **상태**: ✅ Accepted (2026-04-22) · 구현은 W9-W11
- **관련**: ADR-007 (Pivot), ADR-006 (Free-tier First)

## 맥락

ADR-007 의 핵심 혁신 축은 "agent 가 자가 진화" 한다는 것. 진짜 작동해야 런칭 메시지가 성립. 이 ADR 은 진화 엔진의 알고리즘·데이터 플로우·비용·품질 보증을 정의.

## 결정

**Genetic Algorithm (GA) 를 prompt 공간에 적용** + LLM-driven mutation. 전체 flow:

```
매일 23:00 UTC (Cron)
  ↓
[feedback aggregator]   지난 24h agent_feedback 집계 (👍-👎 score per agent_version)
  ↓
[selection]             top-k agents (최소 N=10 runs 기준) 선발
  ↓
[mutation]              각 agent 의 prompt 1개를 Workers AI (Llama) 로 rewrite
                        — "Rewrite this prompt to be more precise/concise:" 계열 5 variations
  ↓
[crossover]             top agent A의 prompt + top agent B의 graph (유사 카테고리 한정) 결합
  ↓
[candidate pool]        변형 후보들을 agent_evolutions 테이블에 저장 (아직 적용 X)
  ↓
[shadow eval]           지난 24h 실행 input 을 candidate 에게도 돌려봄 (최대 5 case)
                        Workers AI 로 pairwise 비교 ("A vs B 어느게 더 정확?")
  ↓
[suggestion]            shadow win-rate 60%+ 인 candidate → creator 에게 "v2 suggestion" 알림
                        creator 가 수락하면 agent_versions 에 새 row 생성 + 현재 버전 교체
```

### 왜 GA 인가

- **Prompt 공간은 연속 아님**: gradient descent 불가. mutation + selection 이 자연스러움.
- **Implicit feedback (👍/👎)** 이 fitness function 역할.
- **LLM mutation** = 사람의 "prompt 튜닝" 을 자동화 (Llama 가 프롬프트를 rewrite).
- **Shadow eval pairwise compare** = Workers AI 로 무료 정답 근사 (절대 정확도는 못 재지만 상대 비교는 가능).

### Fitness 정의

각 agent_version 의 fitness score:

```
fitness = (like - dislike) / max(1, run_count)
         × log10(run_count + 1)            -- 샘플 수 penalty
         × (1 - error_rate)                -- 오류 페널티
```

- 최소 샘플: `run_count >= 10` 인 버전만 evolution 대상
- 오류율 (`status='failed'`) 30% 넘으면 제외

## 알고리즘 상세

### Mutation 전략 (5가지)

각 top-k agent 에서 prompt 하나를 랜덤 선택 후:

1. **Conciseness**: "이 프롬프트를 더 간결하게 (30% 짧게) rewrite."
2. **Specificity**: "이 프롬프트에 더 구체적인 예시 하나 추가."
3. **Chain-of-thought**: "이 프롬프트에 'step by step 생각하고' 지시 추가."
4. **Role-play**: "이 프롬프트 앞에 전문가 role 설정 추가."
5. **Output format**: "이 프롬프트의 출력 형식을 JSON 스키마로 명시."

Workers AI (Llama 3.3 70B) 1회 호출 = 약 50 neurons. 5 mutation × 10 agents = 2,500 neurons/일. **Free 10k 의 25%**.

### Crossover 조건

- 같은 **카테고리 태그** (creator 가 지정, 없으면 embeddings 유사도 >0.8)
- 서로 다른 creator (동일 creator 간 crossover 금지 · 다양성 보장)
- Graph 구조가 호환 (노드 수 ±2 이내, 입출력 타입 매칭)

크로스오버 자체는 LLM 없이 수행 (코드 조합). 비용 0.

### Shadow Eval

Candidate 당 지난 24h 실행 input 최대 5개로 돌려봄:

- 원본 agent output O, candidate output C 를 Llama 로 pairwise compare
- 프롬프트: "Given input X, which output better matches the intent? A: O / B: C. Answer A, B, or TIE."
- 결과 ≥ 60% wins 이면 suggestion 생성

비용: 5 case × 2 실행 + 5 pairwise = 15 LLM calls per candidate. 50 candidate × 15 = 750 calls/일 × 50 neurons = **37,500 neurons/일** → Free 한도 **초과 리스크!**

### 비용 최적화 (Free tier 지킴)

Shadow eval 을 다음으로 축소:

| 항목 | 원안 | 수정 |
|---|---|---|
| Candidate 당 case | 5 | **2** |
| Pairwise 모델 | Llama 70B | **Llama 3B (300 neurons/1k tokens)** |
| 일일 candidate 수 | 50 | **20 (top-4 agents × 5 variants)** |
| 총 neurons/일 | ~37,500 | **~5,000** (50% Free) |

추가 안전 장치:
- Cron 시작 시 잔여 neurons 확인 (CF Analytics) → 잔여 <30% 이면 skip
- 월말 주간은 mutation 만 (crossover/shadow eval 스킵) → 안전 마진

### 품질 보증 루프

- 수락된 v2 가 실제로 나빠지면 auto-rollback: 7일간 fitness 가 v1 대비 20%+ 낮으면 v1 로 자동 복원
- Creator 가 언제든 manual revert 가능
- A/B 테스트 모드: 수락 대신 "10% 트래픽으로 시험" 선택

## 데이터 모델

### `agent_evolutions`
```sql
CREATE TABLE agent_evolutions (
  id                   TEXT PRIMARY KEY,
  agent_version_id     TEXT NOT NULL REFERENCES agent_versions(id),
  strategy             TEXT NOT NULL,           -- 'mutation_concise' | 'mutation_cot' | 'crossover' | ...
  candidate_definition TEXT NOT NULL,           -- JSON (new graph/prompts)
  shadow_case_count    INTEGER NOT NULL DEFAULT 0,
  shadow_wins          INTEGER NOT NULL DEFAULT 0,
  shadow_ties          INTEGER NOT NULL DEFAULT 0,
  shadow_losses        INTEGER NOT NULL DEFAULT 0,
  win_rate             REAL,
  suggested_at         INTEGER,
  accepted_at          INTEGER,
  accepted_version_id  TEXT REFERENCES agent_versions(id),
  rejected_at          INTEGER,
  created_at           INTEGER NOT NULL
);
CREATE INDEX idx_evolutions_agent ON agent_evolutions (agent_version_id, created_at);
```

### `agent_feedback` (ADR-007 에서 도입)
```sql
CREATE TABLE agent_feedback (
  run_id       TEXT PRIMARY KEY REFERENCES agent_runs(id),
  user_id      TEXT REFERENCES users(id),
  rating       INTEGER NOT NULL,   -- 1 = thumbs up, -1 = thumbs down
  comment      TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_feedback_agent_version ON agent_feedback (run_id);
```

## UX (Creator 관점)

### v2 suggestion 알림 (dashboard 배너)

```
🧬 Your agent "HN Summary" evolved
   Weaver tried 4 variations and found one that scored 73% better.

   [ View diff ]  [ Accept as v2 ]  [ Try shadow 10% ]  [ Dismiss ]
```

- View diff: 원본 vs candidate prompt 사이드 by 사이드
- Accept as v2: 즉시 agent_versions 에 새 row + 현재 버전 교체
- Try shadow 10%: 10% 트래픽만 candidate 로 라우트, 7일 후 자동 평가
- Dismiss: rejected_at 기록, 해당 strategy 가 같은 prompt 에 재시도 안 함

### Creator 는 언제든 off 가능

`/settings/evolution` 에 "Let Weaver evolve my agents" 토글. Default ON. OFF 시 suggestion 생성 안 함.

## 위험 & 대응

| 위험 | 대응 |
|---|---|
| Llama 의 prompt rewrite 품질 나쁨 | 5 strategies 중 shadow eval 승자만 제안. 실제 나쁘면 자동 걸러짐 |
| Shadow eval 비용 초과 | 유량 제한 + fallback (mutation 만) |
| Creator 가 변형을 원치 않음 | 기본 ON 이지만 토글 존재 |
| 진화가 local minima 수렴 | Mutation 전략 다양화 + 주 1회 crossover 강제 |
| 악의적 feedback (👍/👎 조작) | 유저당 하루 피드백 수 제한 + IP 추적 · 의심스러운 패턴 제외 |
| Workers AI 한도 도달 | Cron 시작 시 잔여 확인 · <30% 면 skip |
| Creator 가 accept 안 함 (suggestion UI 무시) | 이메일 알림 추가 (Resend · Sprint 0.5 이후), 그래도 ignore 시 자동 rejection 처리 |

## 성공 지표

- [ ] v2 suggestion 수락률 **40%+** (실제로 좋다는 증거)
- [ ] 수락 후 agent fitness 평균 **+15%+** (진짜 개선)
- [ ] Rollback 비율 **<10%** (안정성)
- [ ] 일일 neurons 사용 **Free 한도의 60% 이하** (비용 안전)

## 구현 단계 (Week 9-11)

- **W9**: Feedback 수집 (`agent_feedback`) + fitness 계산 · 관리자 dashboard 에만 노출
- **W10**: Mutation 루프 (5 strategies) + shadow eval · evolutions 테이블에 저장만 · suggestion 아직 노출 안 함
- **W11**: Suggestion UI + diff viewer + accept/reject 흐름 · 프로덕션 활성화

Phase 2 (런칭 후):
- Crossover 확장
- Multi-objective fitness (정확도 + 비용 + 지연)
- Creator marketplace 에서 "best evolved agent" 뱃지
