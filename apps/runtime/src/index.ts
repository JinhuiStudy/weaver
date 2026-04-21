import { Hono } from "hono";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./compose/stub";

/**
 * Cloudflare Worker entry. Minimal Hono app with a `/api/compose` endpoint
 * backed by the offline stub grammar (see `compose/stub.ts`). Workers AI will
 * replace the stub in Week 3 behind an env flag so the dev-only path remains
 * reviewable end-to-end.
 */
type Env = {
  Bindings: {
    AI?: unknown; // Workers AI binding — injected by wrangler.jsonc
  };
};

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

  const intent = parseComposeIntent(prompt);
  const next = applyComposeIntent(canvas, intent);

  return c.json({
    intent,
    canvas: next,
    /** Convenience for the UI — the diff is what actually changed. */
    diff: {
      addedNodes: next.nodes.slice(canvas.nodes.length),
      addedEdges: next.edges.slice(canvas.edges.length),
    },
  });
});

export default {
  fetch: app.fetch,
};
