import { type AgentRun, executeOneStep, type StepEdge, type StepNode } from "./executor/step";

/**
 * Core Cron logic extracted as a pure function. The real handler does:
 *   1. SELECT pending agent_runs FROM D1 WHERE status IN ('pending','running')
 *      AND (next_step_at IS NULL OR next_step_at <= NOW()) LIMIT N
 *   2. Load the matching tool's graph (for now, injected per run)
 *   3. Call this to advance each run one step
 *   4. UPDATE agent_runs in D1 with the new rows
 *   5. self-fetch to continue runs that are still not terminal
 *
 * Keeping the logic pure means Vitest covers the branching without a live D1.
 */
export interface ProcessInput {
  runs: AgentRun[];
  graph: { nodes: StepNode[]; edges: StepEdge[] };
  now: number;
  /** Hard cap on runs processed per invocation (Cron throughput control). */
  limit?: number;
}

export interface ProcessResult {
  updated: AgentRun[];
  /** Runs that still need another step (caller should self-fetch). */
  stillPending: AgentRun[];
  /** Runs that reached `complete` this invocation. */
  justCompleted: AgentRun[];
  /** Runs that reached `failed` this invocation. */
  justFailed: AgentRun[];
}

const TERMINAL = new Set(["complete", "failed"]);

export function processPendingRuns({ runs, graph, now, limit = 10 }: ProcessInput): ProcessResult {
  const picked = runs.filter((r) => !TERMINAL.has(r.status)).slice(0, limit);

  const ctx = { nodes: graph.nodes, edges: graph.edges, now };

  const updated = picked.map((r) => executeOneStep(r, ctx));

  return {
    updated,
    stillPending: updated.filter((r) => !TERMINAL.has(r.status)),
    justCompleted: updated.filter((r) => r.status === "complete"),
    justFailed: updated.filter((r) => r.status === "failed"),
  };
}
