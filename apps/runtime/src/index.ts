import { Hono } from "hono";
import { handleCreateAgent, handleListAgents } from "./api/agents";
import { requireAuth, sessionMiddleware } from "./auth/middleware";
import { requireRateLimit } from "./auth/rate-limit";
import { mountAuthRoutes } from "./auth/routes";
import { type AiBinding, composeWithAi } from "./compose/ai";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./compose/stub";
import { processPendingRuns } from "./cron";
import type { AgentRun, StepEdge, StepNode } from "./executor/step";

/**
 * Cloudflare Worker entry. Minimal Hono app.
 *   • /api/compose             — NL → graph diff (Workers AI or offline stub fallback).
 *   • /api/runs                — create a run (D1 binding optional in dev).
 *   • /auth/github             — GitHub OAuth login redirect.
 *   • /auth/github/callback    — OAuth code exchange + session mint.
 *   • /auth/logout             — clear session cookie.
 *   • scheduled()              — Cron; every minute, advance pending runs
 *                                one step via `processPendingRuns`.
 */
type Env = {
  AI?: AiBinding;
  DB?: D1Database;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  WEAVER_SESSION_SECRET?: string;
  FRONTEND_URL?: string;
  AUTH_CALLBACK_URL?: string;
};

function genId() {
  return crypto.randomUUID();
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", sessionMiddleware());

app.get("/", (c) => c.text("weaver-runtime ok"));
app.get("/health", (c) => c.json({ ok: true, version: "0.0.0" }));

mountAuthRoutes(app);

app.get("/api/agents", requireAuth(), handleListAgents);
app.post("/api/agents", requireAuth(), handleCreateAgent);

app.get("/api/me", requireAuth(), async (c) => {
  const session = c.get("session");
  const db = c.env.DB;
  if (!db || !session) return c.json({ error: "db not available" }, 503);

  const userRow = await db
    .prepare("SELECT id, handle, name, email, avatar_url FROM users WHERE id = ?")
    .bind(session.sub)
    .first<{
      id: string;
      handle: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    }>();
  const orgRow = await db
    .prepare("SELECT id, slug, name FROM orgs WHERE id = ?")
    .bind(session.org)
    .first<{ id: string; slug: string; name: string }>();

  if (!userRow || !orgRow) {
    return c.json({ error: "session references a user or org that no longer exists" }, 404);
  }

  return c.json({ user: userRow, org: orgRow });
});

app.post("/api/compose", async (c) => {
  let body: { prompt?: string; canvas?: CanvasSnapshot };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const canvas: CanvasSnapshot = body.canvas ?? { nodes: [], edges: [] };
  const ai = c.env.AI;
  let intent: ReturnType<typeof parseComposeIntent>;
  let next: CanvasSnapshot;
  if (ai) {
    const result = await composeWithAi({ ai, prompt, canvas });
    intent = result.intent;
    next = result.canvas;
  } else {
    intent = parseComposeIntent(prompt);
    next = applyComposeIntent(canvas, intent);
  }
  return c.json({
    intent,
    canvas: next,
    diff: {
      addedNodes: next.nodes.slice(canvas.nodes.length),
      addedEdges: next.edges.slice(canvas.edges.length),
    },
    usedAi: Boolean(ai),
  });
});

/**
 * POST /api/runs — create an agent_run row. Returns `{ id, status: "pending" }`
 * so the UI can navigate to `/tools/:id/runs/:runId`. Falls back to a
 * synthetic id when `env.DB` is missing so the frontend remains wired in
 * dev without a Cloudflare account.
 */
// Sprint 0 D5: per-user daily cap enforced BEFORE the handler writes to D1
// so a spammer can't blow past Workers AI's 10k neurons/day Free tier.
const RUNS_DAILY_CAP = 10;

app.post("/api/runs", requireAuth(), requireRateLimit("runs", RUNS_DAILY_CAP), async (c) => {
  let body: {
    tool_id?: string;
    tool_version?: number;
    input?: unknown;
    graph?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const toolId = typeof body.tool_id === "string" ? body.tool_id : null;
  if (!toolId) return c.json({ error: "tool_id is required" }, 400);

  const session = c.get("session");
  if (!session) return c.json({ error: "authentication required" }, 401);

  const id = genId();
  const now = Date.now();
  const db = c.env.DB;
  if (db) {
    await db
      .prepare(
        `INSERT INTO agent_runs
          (id, tool_id, tool_version, org_id, status, input, state, graph_json,
           created_at, updated_at, retry_count, cost_usd_micro, created_by_user_id)
         VALUES (?, ?, ?, ?, 'pending', ?, '{}', ?, ?, ?, 0, 0, ?)`,
      )
      .bind(
        id,
        toolId,
        body.tool_version ?? 1,
        session.org,
        JSON.stringify(body.input ?? {}),
        body.graph == null ? null : JSON.stringify(body.graph),
        now,
        now,
        session.sub,
      )
      .run();
  }
  return c.json({ id, status: "pending", tool_id: toolId });
});

/**
 * Cron body — extracted so we can call it both from `scheduled()` (Cloudflare
 * trigger) and from tests (SELF.scheduled()).
 *
 * One invocation does:
 *   1. SELECT pending/running rows (with their graph snapshot) from D1.
 *   2. Call processPendingRuns → one step per run.
 *   3. UPDATE each row with the new status / current_node_id / completed_at.
 *
 * Graph snapshots live on each row (`agent_runs.graph_json`) — that way a
 * tool edit mid-run doesn't break in-flight executions. We group by
 * graph_json so processPendingRuns can assume a single graph per batch.
 */
async function tickOnce(db: D1Database, now: number): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT id, tool_id, tool_version, org_id, status, input,
              current_node_id, state, graph_json, retry_count, trace_id,
              created_at, updated_at, completed_at
         FROM agent_runs
        WHERE status IN ('pending', 'running')
          AND (next_step_at IS NULL OR next_step_at <= ?)
        ORDER BY created_at ASC
        LIMIT 10`,
    )
    .bind(now)
    .all<AgentRunRow>();

  const pending = rows.results ?? [];
  if (pending.length === 0) return;

  // Bucket by graph_json (string) so we can call processPendingRuns per
  // unique graph. Each run carries its own snapshot.
  const byGraph = new Map<string, AgentRun[]>();
  for (const r of pending) {
    const key = r.graph_json ?? "";
    if (!byGraph.has(key)) byGraph.set(key, []);
    byGraph.get(key)!.push(rowToRun(r));
  }

  for (const [graphJson, runs] of byGraph) {
    const graph = parseGraphOrFailed(graphJson);
    const { updated } = processPendingRuns({ runs, graph, now });
    for (const next of updated) {
      await db
        .prepare(
          `UPDATE agent_runs
             SET status = ?, current_node_id = ?, state = ?, updated_at = ?, completed_at = ?
           WHERE id = ?`,
        )
        .bind(
          next.status,
          next.current_node_id,
          JSON.stringify(next.state ?? {}),
          next.updated_at,
          next.completed_at,
          next.id,
        )
        .run();
    }
  }
}

interface AgentRunRow {
  id: string;
  tool_id: string;
  tool_version: number;
  org_id: string;
  status: string;
  input: string;
  current_node_id: string | null;
  state: string;
  graph_json: string | null;
  retry_count: number;
  trace_id: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

function rowToRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    tool_id: row.tool_id,
    tool_version: row.tool_version,
    org_id: row.org_id,
    status: row.status as AgentRun["status"],
    input: safeJson(row.input),
    current_node_id: row.current_node_id,
    state: (safeJson(row.state) as Record<string, unknown>) ?? {},
    retry_count: row.retry_count,
    trace_id: row.trace_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

function parseGraphOrFailed(graphJson: string | ""): { nodes: StepNode[]; edges: StepEdge[] } {
  if (!graphJson) return { nodes: [], edges: [] };
  try {
    const g = JSON.parse(graphJson);
    return {
      nodes: Array.isArray(g?.nodes) ? (g.nodes as StepNode[]) : [],
      edges: Array.isArray(g?.edges) ? (g.edges as StepEdge[]) : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (!env.DB) return;
    await tickOnce(env.DB, Date.now());
  },
};
