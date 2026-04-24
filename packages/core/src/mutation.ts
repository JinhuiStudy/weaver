/**
 * Prompt-mutation strategies used by the evolution engine (ADR-008).
 *
 * Each strategy is a small deterministic local transform that prepends or
 * appends a directive to the source prompt. When Workers AI is available,
 * the orchestrator layer calls it with the mutated prompt as the seed so the
 * model can rewrite while preserving the directive's intent — but the
 * deterministic transform ensures the prompt stays different from the
 * original even when the LLM is unavailable.
 *
 * Idempotent: applying the same strategy twice is a no-op. Orchestrator
 * calls this once per candidate.
 */

export type MutationKind = "concise" | "specific" | "cot" | "role" | "format";

export interface MutationStrategy {
  kind: MutationKind;
  label: string;
  description: string;
  directive: string;
}

export const MUTATION_STRATEGIES: readonly MutationStrategy[] = Object.freeze([
  {
    kind: "concise",
    label: "Concise",
    description: "짧고 명료하게 답하도록 지시",
    directive: "Be concise — prefer a tight answer over a long one.",
  },
  {
    kind: "specific",
    label: "Specific",
    description: "추상 답변 대신 구체 예시 요청",
    directive: "Include concrete examples, numbers, and identifiers wherever useful.",
  },
  {
    kind: "cot",
    label: "Chain-of-Thought",
    description: "단계별로 생각하도록 유도",
    directive: "Think step-by-step before you answer; show the reasoning briefly.",
  },
  {
    kind: "role",
    label: "Role framing",
    description: "시니어 에디터 역할로 재프레이밍",
    directive: "You are a senior editor with deep domain expertise.",
  },
  {
    kind: "format",
    label: "Structured output",
    description: "JSON 포맷으로 응답 요청",
    directive: "Respond as JSON with { summary, details, confidence } keys only.",
  },
]);

const STRATEGY_MAP = new Map<MutationKind, MutationStrategy>(
  MUTATION_STRATEGIES.map((s) => [s.kind, s]),
);

export function applyMutation(prompt: string, kind: MutationKind): string {
  const strat = STRATEGY_MAP.get(kind);
  if (!strat) throw new Error(`unknown mutation strategy: ${kind}`);
  // Idempotence — don't stack the same directive twice.
  if (prompt.includes(strat.directive)) return prompt;
  return `${strat.directive}\n\n${prompt}`;
}

export interface MutationPlanInput {
  candidatesPerStrategy: number;
  /** Restrict the plan to a subset of strategy kinds (defaults to all 5). */
  only?: MutationKind[];
}

export interface PlannedMutation {
  kind: MutationKind;
  candidateIndex: number;
}

export function planMutations(input: MutationPlanInput): PlannedMutation[] {
  if (input.candidatesPerStrategy <= 0) {
    throw new Error("candidatesPerStrategy must be ≥ 1");
  }
  const kinds = input.only ?? MUTATION_STRATEGIES.map((s) => s.kind);
  const plan: PlannedMutation[] = [];
  for (const kind of kinds) {
    for (let i = 0; i < input.candidatesPerStrategy; i++) {
      plan.push({ kind, candidateIndex: i });
    }
  }
  return plan;
}
