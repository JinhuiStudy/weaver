import { Hono } from "hono";
import { type AiBinding, composeWithAi } from "./compose/ai";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./compose/stub";

/**
 * Cloudflare Worker entry. Minimal Hono app.
 *   • /api/compose — NL → graph diff (Workers AI or offline stub fallback).
 *   • /api/runs    — create + inspect runs (D1 binding optional in dev).
 */
type Env = {
  Bindings: {
    AI?: AiBinding;
    DB?: D1DatabaseLike;
  };
};

/**
 * Minimal D1 surface we need. Narrow on purpose so tests can mock.
 */
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedLike;
}
export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  run(): Promise<{ success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

function genId() {
  return crypto.randomUUID();
}

const app = new Hono<Env>();

app.get("/", (c) => c.text("weaver-runtime ok"));

app.get("/health", (c) => c.json({ ok: true, version: "0.0.0" }));

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
    /** Convenience for the UI — the diff is what actually changed. */
    diff: {
      addedNodes: next.nodes.slice(canvas.nodes.length),
      addedEdges: next.edges.slice(canvas.edges.length),
    },
    usedAi: Boolean(ai),
  });
});

/**
 * POST /api/runs — create a new agent_run row. Body:
 *   { tool_id: string, tool_version?: number, input?: unknown, org_id?: string }
 * Returns { id, status: "pending" } so the UI can navigate to /tools/:id/runs/:runId.
 *
 * If `env.DB` isn't bound (local dev without `wrangler dev` or the d1
 * binding turned off), we still return a synthetic id so the frontend wire
 * works end-to-end. The Cron handler's pickup will simply find no row.
 */
app.post("/api/runs", async (c) => {
  let body: { tool_id?: string; tool_version?: number; input?: unknown; org_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const toolId = typeof body.tool_id === "string" ? body.tool_id : null;
  if (!toolId) return c.json({ error: "tool_id is required" }, 400);

  const id = genId();
  const now = Date.now();
  const row = {
    id,
    tool_id: toolId,
    tool_version: body.tool_version ?? 1,
    org_id: body.org_id ?? "local",
    status: "pending" as const,
    input_json: JSON.stringify(body.input ?? {}),
    created_at: now,
    updated_at: now,
  };

  const db = c.env.DB;
  if (db) {
    await db
      .prepare(
        `INSERT INTO agent_runs (id, tool_id, tool_version, org_id, status, input, state, created_at, updated_at, retry_count, cost_usd_micro)
         VALUES (?, ?, ?, ?, 'pending', ?, '{}', ?, ?, 0, 0)`,
      )
      .bind(
        row.id,
        row.tool_id,
        row.tool_version,
        row.org_id,
        row.input_json,
        row.created_at,
        row.updated_at,
      )
      .run();
  }

  return c.json({ id, status: "pending", tool_id: toolId });
});

export default {
  fetch: app.fetch,
};
