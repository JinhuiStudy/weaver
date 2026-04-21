# @weaver/eval

> Eval DSL 파서 + 배치 러너

## 의도

어서션 DSL을 파싱해 배치 실행하는 순수 라이브러리. CI (GitHub Action), CLI, 서버 측 배포 게이트에서 공통 사용.

## 주요 export (예정)

```typescript
// DSL 파서
export function parseEvalConfig(yaml: string): EvalConfig

// 러너
export class EvalRunner {
  async run(config: EvalConfig, dataset: Dataset, tool: ToolVersion): Promise<EvalResult>
}

// 어서션 타입
export type Assertion =
  | GroundTruthMatch
  | MetricBound
  | RegexAbsent | RegexPresent
  | NumericClose
  | SchemaMatch
  | LLMJudge
  | Custom
```

## 의존성

- `@weaver/core`
- `yaml` (설정 파싱)
- `zod` (스키마 검증)

## CLI

```bash
npx @weaver/eval run --tool cs-refund --version 3 --dataset cs-refund-v1
```

## 상태

📦 빈 디렉토리. Week 9 (2026-W25) 구현 시작.
