import type { Context } from "hono";

/**
 * Run viewer backing data.
 *
 *   GET /api/runs       — caller's most recent 50 runs (all tools)
 *   GET /api/runs/:id   — one run + its run_history timeline (span list)
 *
 * Both are scoped to the session's org_id, so users can only see runs their
 * org executed. A future Sprint adds feedback (👍/👎) and cost roll-ups onto
 * the detail response.
 */

type RunRow = {
  id: string;
  tool_id: string;
  tool_version: number;
  status: string;
  current_node_id: string | null;
  trace_id: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  cost_usd_micro: number;
  created_by_user_id: string | null;
};

type HistoryRow = {
  id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  input: string | null;
  output: string | null;
  duration_ms: number | null;
  cost_usd_micro: number | null;
  span_id: string | null;
  error_message: string | null;
  created_at: number;
};

export async function handleListMyRuns(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const rows = await db
    .prepare(
      `SELECT id, tool_id, tool_version, status, current_node_id, trace_id,
              created_at, updated_at, completed_at, cost_usd_micro,
              created_by_user_id
         FROM agent_runs
        WHERE org_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
    )
    .bind(session.org)
    .all<RunRow>();

  return c.json({ runs: rows.results ?? [] });
}

export async function handleGetRun(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const run = await db
    .prepare(
      `SELECT id, tool_id, tool_version, status, current_node_id, trace_id,
              created_at, updated_at, completed_at, cost_usd_micro,
              created_by_user_id
         FROM agent_runs
        WHERE id = ? AND org_id = ?`,
    )
    .bind(id, session.org)
    .first<RunRow>();
  if (!run) return c.json({ error: "not found" }, 404);

  const history = await db
    .prepare(
      `SELECT id, run_id, node_id, node_type, input, output,
              duration_ms, cost_usd_micro, span_id, error_message, created_at
         FROM run_history
        WHERE run_id = ?
        ORDER BY created_at ASC`,
    )
    .bind(id)
    .all<HistoryRow>();

  return c.json({ run, history: history.results ?? [] });
}
