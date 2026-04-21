/**
 * Executor · step 1 (Week 4 MVP)
 *
 * Advances an agent_run by exactly one node and returns the next row value.
 * This is a pure function on purpose — Cron pulls pending rows from D1, runs
 * this, writes the result back. Keeping it pure means we can Vitest it
 * exhaustively without a live DB, and (eventually) swap to Durable Objects
 * without rewriting the state machine.
 *
 * The node type here is a minimal shape so step.ts can live without pulling
 * in @weaver/core's full valibot stack. Cron converts D1 rows → these.
 */

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_llm"
  | "waiting_tool"
  | "waiting_human"
  | "complete"
  | "failed";

export interface AgentRun {
  id: string;
  tool_id: string;
  tool_version: number;
  org_id: string;
  status: RunStatus;
  input: unknown;
  current_node_id: string | null;
  state: Record<string, unknown>;
  retry_count: number;
  trace_id: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

/** Minimal node/edge shapes consumed by the executor. */
export interface StepNode {
  id: string;
  type: "input" | "agent" | "tool" | "branch" | "output";
}

export interface StepEdge {
  id: string;
  source: { node_id: string; output_id?: string };
  target: { node_id: string };
}

export interface RunContext {
  nodes: StepNode[];
  edges: StepEdge[];
  /** Allows tests to inject a stable timestamp. */
  now: number;
}

export function executeOneStep(run: AgentRun, ctx: RunContext): AgentRun {
  const ts = ctx.now;

  // Pending — find the input node, become running.
  if (run.status === "pending") {
    const firstInput = ctx.nodes.find((n) => n.type === "input");
    if (!firstInput) {
      return { ...run, status: "failed", updated_at: ts, completed_at: ts };
    }
    return {
      ...run,
      status: "running",
      current_node_id: firstInput.id,
      updated_at: ts,
    };
  }

  // Running — walk the outgoing edge.
  if (run.status === "running") {
    const cur = run.current_node_id;
    if (!cur) {
      return { ...run, status: "failed", updated_at: ts, completed_at: ts };
    }
    const node = ctx.nodes.find((n) => n.id === cur);
    if (!node) {
      return { ...run, status: "failed", updated_at: ts, completed_at: ts };
    }

    // Output node → done.
    if (node.type === "output") {
      return { ...run, status: "complete", updated_at: ts, completed_at: ts };
    }

    // Walk to next via first outgoing edge. Branch nodes will route by
    // `output_id` later — for Week 4 MVP we just take the first.
    const nextEdge = ctx.edges.find((e) => e.source.node_id === cur);
    if (!nextEdge) {
      // Dead-end but not an output — treat as completion; specs/validateGraph
      // flags isolation separately so by the time we get here the graph has
      // been sanity-checked.
      return { ...run, status: "complete", updated_at: ts, completed_at: ts };
    }

    return {
      ...run,
      current_node_id: nextEdge.target.node_id,
      updated_at: ts,
    };
  }

  // Terminal states pass through unchanged.
  return run;
}
