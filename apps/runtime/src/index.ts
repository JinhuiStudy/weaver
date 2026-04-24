import {
  GEN_AI_SYSTEM,
  genAiAttributes,
  newTraceId,
  setAttributes,
  setStatus,
} from "@weaver/observability";
import { Hono } from "hono";
import {
  handleAcceptEvolution,
  handleCreateAgent,
  handleCreateVersion,
  handleForkAgent,
  handleGetAgent,
  handleGetPublicAgent,
  handleIsSubscribed,
  handleListAgentEvolutions,
  handleListAgents,
  handleListEvolutions,
  handleMyFeed,
  handleNewestAgents,
  handlePublicFeed,
  handlePublicGenealogy,
  handlePublicStats,
  handleRejectEvolution,
  handleSearchAgents,
  handleSubmitFeedback,
  handleToggleSubscribe,
  handleTrendingAgents,
  handleUpdateAgent,
} from "./api/agents";
import { handleGetRun, handleListMyRuns } from "./api/runs";
import { requireAuth, sessionMiddleware } from "./auth/middleware";
import { bumpBy, requireRateLimit, todayCount } from "./auth/rate-limit";
import { mountAuthRoutes } from "./auth/routes";
import { type AiBinding, composeWithAi } from "./compose/ai";
import { estimateNeurons, NEURONS_DAILY_CAP } from "./compose/cost";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./compose/stub";
import { processPendingRuns } from "./cron";
import type { AgentRun, StepEdge, StepNode } from "./executor/step";
import { newExporter, newTracer, type TracingEnv } from "./tracing";

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
type Env = TracingEnv & {
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

// Sprint 0 D5: per-user daily cap enforced BEFORE the handler writes to D1
// so a spammer can't blow past Workers AI's 10k neurons/day Free tier.
// Declared up here so /api/me can reference it when building today's quota.
const RUNS_DAILY_CAP = 10;

app.get("/api/agents", requireAuth(), handleListAgents);
app.post("/api/agents", requireAuth(), handleCreateAgent);
app.get("/api/agents/:id", requireAuth(), handleGetAgent);
app.patch("/api/agents/:id", requireAuth(), handleUpdateAgent);
app.post("/api/agents/:id/versions", requireAuth(), handleCreateVersion);
app.post("/api/agents/:id/fork", requireAuth(), handleForkAgent);
app.post("/api/agents/:id/subscribe", requireAuth(), handleToggleSubscribe);
app.get("/api/agents/:id/subscribe", requireAuth(), handleIsSubscribed);
app.get("/api/agents/:id/evolutions", requireAuth(), handleListAgentEvolutions);

// Sprint 6: Accept / Reject flow for mutation candidates.
app.post("/api/evolutions/:id/accept", requireAuth(), handleAcceptEvolution);
app.post("/api/evolutions/:id/reject", requireAuth(), handleRejectEvolution);

// Unauthenticated — public profile page.
// Search / trending / new come BEFORE :handle/:slug so they aren't
// mis-parsed as a handle.
app.get("/api/public/agents/search", handleSearchAgents);
app.get("/api/public/agents/trending", handleTrendingAgents);
app.get("/api/public/agents/new", handleNewestAgents);
app.get("/api/public/agents/:handle/:slug", handleGetPublicAgent);
app.get("/api/public/agents/:handle/:slug/feed.json", handlePublicFeed);
app.get("/api/public/agents/:handle/:slug/stats", handlePublicStats);
app.get("/api/public/agents/:handle/:slug/genealogy", handlePublicGenealogy);

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

  const now = Date.now();
  const [neuronsUsed, runsUsed] = await Promise.all([
    todayCount(db, session.sub, "neurons", now),
    todayCount(db, session.sub, "runs", now),
  ]);

  return c.json({
    user: userRow,
    org: orgRow,
    quota: {
      neurons: {
        used: neuronsUsed,
        cap: NEURONS_DAILY_CAP,
        remaining: Math.max(0, NEURONS_DAILY_CAP - neuronsUsed),
      },
      runs: {
        used: runsUsed,
        cap: RUNS_DAILY_CAP,
        remaining: Math.max(0, RUNS_DAILY_CAP - runsUsed),
      },
    },
  });
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
  const session = c.get("session");
  const db = c.env.DB;

  const tracer = newTracer(c.env);
  const exporter = newExporter(c.env);

  const { intent, next, usedNeurons } = await tracer.withSpan("compose", async (span) => {
    setAttributes(span, {
      "weaver.compose.prompt_length": prompt.length,
      "weaver.compose.canvas_nodes": canvas.nodes.length,
      "weaver.compose.canvas_edges": canvas.edges.length,
      "weaver.compose.used_ai": Boolean(ai),
    });
    if (ai) {
      const result = await tracer.withSpan("compose.llm_call", async (llmSpan) => {
        const composed = await composeWithAi({ ai, prompt, canvas });
        // Estimate neurons from prompt + response sizes. response body size
        // stands in for completion chars — Workers AI doesn't return usage.
        const responseChars = JSON.stringify(composed.intent).length;
        const est = estimateNeurons(prompt.length, responseChars);
        setAttributes(
          llmSpan,
          genAiAttributes({
            system: GEN_AI_SYSTEM.WORKERS_AI,
            requestModel: "@cf/meta/llama-3.3-70b-instruct",
            inputTokens: est.inputTokens,
            outputTokens: est.outputTokens,
            neurons: est.neurons,
          }),
        );
        return { composed, neurons: est.neurons };
      });
      setAttributes(span, { "weaver.neurons": result.neurons });
      return {
        intent: result.composed.intent,
        next: result.composed.canvas,
        usedNeurons: result.neurons,
      };
    }
    const parsed = parseComposeIntent(prompt);
    const applied = applyComposeIntent(canvas, parsed);
    return { intent: parsed, next: applied, usedNeurons: 0 };
  });

  // Meter Workers AI consumption so the free-tier cap is observable in
  // /api/me. `session` is optional — /api/compose doesn't currently require
  // auth, so unauthenticated calls (local dev) skip attribution.
  if (db && session && usedNeurons > 0) {
    await bumpBy(db, session.sub, "neurons", usedNeurons, Date.now());
  }

  // Fire-and-forget — never block the response on Axiom.
  c.executionCtx.waitUntil(exporter.flush(tracer));

  return c.json({
    intent,
    canvas: next,
    diff: {
      addedNodes: next.nodes.slice(canvas.nodes.length),
      addedEdges: next.edges.slice(canvas.edges.length),
    },
    usedAi: Boolean(ai),
    neurons: usedNeurons,
  });
});

/**
 * POST /api/runs — create an agent_run row. Returns `{ id, status: "pending" }`
 * so the UI can navigate to `/tools/:id/runs/:runId`. Falls back to a
 * synthetic id when `env.DB` is missing so the frontend remains wired in
 * dev without a Cloudflare account. The RUNS_DAILY_CAP constant is declared
 * near the top of the file so `/api/me`'s quota block can reference it.
 */
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
  const traceId = newTraceId(); // Sprint 2: every run carries an OTEL trace.
  const now = Date.now();
  const db = c.env.DB;
  let agentVersionId: string | null = null;
  if (db) {
    // Sprint 6 D4: if tool_id is a saved agent, pin the run to its current
    // version. agent_outputs materialisation (Sprint 3) needs this to know
    // which prompt version emitted the output.
    const agentRow = await db
      .prepare("SELECT current_version_id FROM agents WHERE id = ?")
      .bind(toolId)
      .first<{ current_version_id: string | null }>();
    agentVersionId = agentRow?.current_version_id ?? null;

    await db
      .prepare(
        `INSERT INTO agent_runs
          (id, tool_id, tool_version, org_id, status, input, state, graph_json,
           trace_id, agent_version_id, created_at, updated_at,
           retry_count, cost_usd_micro, created_by_user_id)
         VALUES (?, ?, ?, ?, 'pending', ?, '{}', ?, ?, ?, ?, ?, 0, 0, ?)`,
      )
      .bind(
        id,
        toolId,
        body.tool_version ?? 1,
        session.org,
        JSON.stringify(body.input ?? {}),
        body.graph == null ? null : JSON.stringify(body.graph),
        traceId,
        agentVersionId,
        now,
        now,
        session.sub,
      )
      .run();
  }
  return c.json({
    id,
    status: "pending",
    tool_id: toolId,
    trace_id: traceId,
    agent_version_id: agentVersionId,
  });
});

// Sprint 2 D5: Run viewer backing data.
app.get("/api/runs", requireAuth(), handleListMyRuns);
app.get("/api/runs/:id", requireAuth(), handleGetRun);
// Sprint 4 D1: per-run feedback.
app.post("/api/runs/:id/feedback", requireAuth(), handleSubmitFeedback);

// Sprint 3 D3: subscribed agents' aggregated timeline.
app.get("/api/me/feed", requireAuth(), handleMyFeed);

// Sprint 5 D4: admin dashboard — evolution candidates list.
app.get("/api/admin/evolutions", requireAuth(), handleListEvolutions);

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
async function tickOnce(env: Env, db: D1Database, now: number): Promise<void> {
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
    const list = byGraph.get(key);
    if (list) list.push(rowToRun(r));
    else byGraph.set(key, [rowToRun(r)]);
  }

  const tracer = newTracer(env);

  for (const [graphJson, runs] of byGraph) {
    const graph = parseGraphOrFailed(graphJson);
    const { updated } = processPendingRuns({ runs, graph, now });

    for (let i = 0; i < updated.length; i++) {
      const next = updated[i];
      const prev = runs[i];
      if (!next || !prev) continue;

      // One OTEL span per step transition. Root of each run's trace is
      // seeded from agent_runs.trace_id created at /api/runs time, so
      // cross-cron steps in the same run share a trace.
      const rootTraceId = prev.trace_id ?? newTraceId();
      const span = tracer.startSpan(`run.step.${prev.status}->${next.status}`);
      // Override traceId to the per-run trace so multi-tick runs thread.
      span.traceId = rootTraceId;
      setAttributes(span, {
        "weaver.run_id": prev.id,
        "weaver.tool_id": prev.tool_id,
        "weaver.node_id": next.current_node_id ?? "",
        "weaver.from_status": prev.status,
        "weaver.to_status": next.status,
      });
      if (next.status === "failed") {
        setStatus(span, { code: "ERROR", message: "state machine entered failed" });
      } else if (next.status === "complete") {
        setStatus(span, { code: "OK" });
      }
      tracer.endSpan(span);

      // Persist one run_history row per step so the Run Viewer has a
      // durable timeline even before Axiom ingests the trace.
      const durationMs = Math.max(0, next.updated_at - prev.updated_at);
      await db
        .prepare(
          `INSERT INTO run_history
             (id, run_id, node_id, node_type, input, output, duration_ms, cost_usd_micro, span_id, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        )
        .bind(
          genId(),
          prev.id,
          next.current_node_id ?? "",
          lookupNodeType(graph, next.current_node_id),
          null,
          null,
          durationMs,
          span.spanId,
          next.status === "failed" ? "state-machine failed" : null,
          next.updated_at,
        )
        .run();

      await db
        .prepare(
          `UPDATE agent_runs
             SET status = ?, current_node_id = ?, state = ?,
                 updated_at = ?, completed_at = ?, trace_id = COALESCE(trace_id, ?)
           WHERE id = ?`,
        )
        .bind(
          next.status,
          next.current_node_id,
          JSON.stringify(next.state ?? {}),
          next.updated_at,
          next.completed_at,
          rootTraceId,
          next.id,
        )
        .run();

      // Sprint 3 D1: materialise into agent_outputs when a run transitions
      // into `complete`. Only public/unlisted agents (tool_id points at a
      // saved agent row) get feed entries; private runs stay in run_history.
      if (next.status === "complete" && prev.status !== "complete") {
        await maybeMaterialiseOutput({
          db,
          toolId: prev.tool_id,
          runId: prev.id,
          state: next.state,
          completedAt: next.updated_at,
        });
      }
    }
  }

  // Ship this tick's spans — fire-and-forget via the Exporter; NoopExporter
  // just drains when AXIOM_TOKEN isn't set, so this is always safe.
  const exporter = newExporter(env);
  await exporter.flush(tracer);
}

/**
 * Write an `agent_outputs` row when a run linked to a *public* (or unlisted)
 * agent reaches `complete`. The run's `tool_id` must match an existing agent
 * id AND its `agent_version_id` must be set. Private agents skip this path.
 * Idempotent via the unique index on `agent_outputs.run_id`.
 */
async function maybeMaterialiseOutput({
  db,
  toolId,
  runId,
  state,
  completedAt,
}: {
  db: D1Database;
  toolId: string;
  runId: string;
  state: Record<string, unknown>;
  completedAt: number | null;
}): Promise<void> {
  const agent = await db
    .prepare("SELECT id, visibility FROM agents WHERE id = ?")
    .bind(toolId)
    .first<{ id: string; visibility: string }>();
  if (!agent) return;
  if (agent.visibility === "private") return;

  const runRow = await db
    .prepare("SELECT agent_version_id FROM agent_runs WHERE id = ?")
    .bind(runId)
    .first<{ agent_version_id: string | null }>();
  const versionId = runRow?.agent_version_id;
  if (!versionId) return;

  const existing = await db
    .prepare("SELECT id FROM agent_outputs WHERE run_id = ?")
    .bind(runId)
    .first();
  if (existing) return;

  await db
    .prepare(
      `INSERT INTO agent_outputs
         (id, agent_id, agent_version_id, run_id, output_json, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      genId(),
      agent.id,
      versionId,
      runId,
      JSON.stringify(state ?? {}),
      completedAt ?? Date.now(),
    )
    .run();
}

function lookupNodeType(graph: { nodes: StepNode[] }, nodeId: string | null): string {
  if (!nodeId) return "unknown";
  return graph.nodes.find((n) => n.id === nodeId)?.type ?? "unknown";
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
    // Await directly — scheduled()'s lifetime already covers the full tick,
    // and miniflare's test harness doesn't resolve waitUntil tasks before
    // returning, which would make integration tests flaky.
    await tickOnce(env, env.DB, Date.now());
  },
};
