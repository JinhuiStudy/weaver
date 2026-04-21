# Spec — Eval DSL

> 배포 전 에이전트 품질 검증을 위한 선언적 어서션 언어.

## 설계 목표

1. **비엔지니어 접근** — YAML로 정의, 학습 곡선 완만
2. **엔지니어 확장** — 복잡한 케이스는 JavaScript 함수 plug-in
3. **정량 지표** — 정확도·비용·지연을 셀 단위 측정
4. **프로덕션 게이트** — 통과 시에만 배포 승격

## 데이터셋 포맷

```yaml
# cs-refund-dataset-v1.yaml
dataset:
  id: cs-refund-v1
  description: 과거 6개월 환불 케이스 30건
  version: 1

cases:
  - id: case-001
    input:
      order_id: pi_3ABC123
      reason: customer_request
    ground_truth:
      decision: approve
      refund_amount_usd: 45.00
    tags: [within_7_days, high_confidence]

  - id: case-002
    input:
      order_id: pi_3DEF456
      reason: fraud
    ground_truth:
      decision: escalate
    tags: [escalation]
```

## 어서션 DSL

```yaml
# eval-config.yaml
assertions:
  # 1. 기본값 일치
  - name: decision_accuracy
    type: ground_truth_match
    field: output.decision
    threshold: 0.90                    # 90% 이상 정확도 요구

  # 2. 메트릭 상한/하한
  - name: cost_under_5_cents
    type: metric_bound
    metric: avg_cost_usd
    max: 0.05

  - name: latency_p95_under_3s
    type: metric_bound
    metric: p95_duration_ms
    max: 3000

  # 3. 정규식 존재·부재
  - name: no_pii_leak
    type: regex_absent
    field: output.message
    pattern: '\b\d{13,16}\b'           # 카드번호 감지

  - name: includes_refund_amount
    type: regex_present
    field: output.message
    pattern: '\$\d+\.\d{2}'

  # 4. 수치 비교
  - name: refund_amount_within_10pct
    type: numeric_close
    actual_field: output.refund_amount_usd
    expected_field: ground_truth.refund_amount_usd
    tolerance_pct: 10

  # 5. JSON 구조 검증
  - name: valid_output_schema
    type: schema_match
    schema_ref: schemas/refund-output.zod.ts

  # 6. LLM 심사관 (meta-eval)
  - name: polite_tone
    type: llm_judge
    judge_model: claude-sonnet-4-6
    rubric: |
      고객에게 전달되는 메시지가 공손하고 공감적인가?
      공손(3), 중립(2), 차가움(1) 중 점수.
    threshold: 2.5                     # 평균 2.5점 이상

  # 7. 커스텀 함수
  - name: no_manager_escalation_for_small_orders
    type: custom
    function_ref: evals/custom/small-order-check.js
```

## 커스텀 함수 예시

```javascript
// evals/custom/small-order-check.js
export function evaluate(case_, run) {
  // $10 이하 주문은 절대 매니저 에스컬레이션 안 함
  const amount = case_.input.amount ?? run.output.refund_amount_usd ?? 0
  if (amount < 10 && run.output.decision === 'escalate') {
    return { pass: false, reason: `$${amount} order escalated unnecessarily` }
  }
  return { pass: true }
}
```

## 실행 의미

### 배치 실행

```
for each case in dataset:
  run = execute_agent(tool_version, case.input)
  collect(run)

for each assertion:
  if assertion.type in ['ground_truth_match', 'custom', ...]:
    evaluate per-case, aggregate → pass_rate
    if pass_rate < threshold: FAIL
  if assertion.type == 'metric_bound':
    compute metric over all runs
    if exceeds bound: FAIL
```

### 결과 포맷

```json
{
  "eval_id": "eval_01J7F...",
  "tool_id": "cs-refund-agent",
  "tool_version": 3,
  "dataset": "cs-refund-v1",
  "dataset_version": 1,
  "started_at": "2026-04-21T...",
  "completed_at": "2026-04-21T...",
  "total_cases": 30,

  "assertions": [
    {
      "name": "decision_accuracy",
      "status": "pass",
      "threshold": 0.90,
      "actual": 0.933,
      "per_case": [
        { "case_id": "case-001", "pass": true },
        { "case_id": "case-002", "pass": false, "reason": "expected escalate, got approve" },
        // ...
      ]
    },
    // ...
  ],

  "metrics": {
    "avg_cost_usd": 0.042,
    "p95_duration_ms": 2134,
    "total_tokens": 45230
  },

  "overall_status": "pass"
}
```

## 배포 게이트 통합

```yaml
# tool-deploy.yaml
tool: cs-refund-agent
deploy_gate:
  required_assertions:
    - decision_accuracy      # 반드시 통과
    - no_pii_leak
  optional_assertions:
    - polite_tone           # 경고만

  required_datasets:
    - cs-refund-v1           # 2025 Q4 데이터
    - cs-refund-v2           # 2026 Q1 데이터 (drift check)
```

**승격 버튼 클릭 시**:
1. `required_assertions` × `required_datasets` 모두 실행
2. 하나라도 FAIL → 배포 블록, 실패 상세 표시
3. 모두 PASS → shadow 또는 prod 승격 가능

## Shadow Traffic 통합

Shadow로 실행된 프로덕션 트래픽은 **실시간 eval**:

```yaml
# shadow-eval.yaml
shadow:
  v_current: v2
  v_candidate: v3
  sample_rate: 0.1            # 10% 요청 복제

  live_assertions:
    - type: divergence
      field: output.decision
      max_divergence_rate: 0.05    # 5% 이상 달라지면 경고

    - type: cost_regression
      max_increase_pct: 20          # 비용 20% 이상 증가 시 경고

    - type: latency_regression
      max_increase_pct: 50
```

## CLI (엔지니어 친화)

```bash
# 로컬에서 eval 실행
npx weaver eval run \
  --tool cs-refund-agent \
  --version 3 \
  --dataset cs-refund-v1 \
  --config eval-config.yaml

# 결과 요약
Weaver Eval Runner
  Tool:     cs-refund-agent v3
  Dataset:  cs-refund-v1 (30 cases)
  Runtime:  42s

  ✓ decision_accuracy         93.3% ≥ 90%
  ✓ cost_under_5_cents        $0.042 ≤ $0.050
  ✓ latency_p95_under_3s      2134ms ≤ 3000ms
  ✓ no_pii_leak               0 leaks
  ✗ polite_tone               2.3 ≥ 2.5  (soft fail)

  Overall: PASS (soft warnings)
```

## 데이터셋 버전 관리

- 데이터셋은 R2에 JSON 형태로 저장
- 메타데이터는 D1 `eval_datasets` 테이블
- 버전 = content-addressed hash (변경 시 자동 새 버전)

## 권장 워크플로우

1. **주간 리그레션**: 매주 월요일 모든 툴 × 최신 데이터셋 자동 실행 (cron)
2. **PR 게이트**: 프로덕션 승격 PR에 eval 결과 자동 댓글
3. **드리프트 감지**: 데이터셋 업데이트 후 old vs new 비교 리포트

## 비 MVP 로드맵

- **AutoEval** — 프로덕션 trace를 자동으로 "유사 케이스"로 클러스터링해 새 데이터셋 제안
- **Human-in-the-loop 라벨링** — 실패 케이스를 팀이 수동 라벨링 → 데이터셋에 추가
- **A/B 통계 유의성 검정** — shadow 비교에 Welch's t-test 내장
