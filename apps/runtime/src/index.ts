import { Hono } from "hono";
import { type AiBinding, composeWithAi } from "./compose/ai";
import { applyComposeIntent, type CanvasSnapshot, parseComposeIntent } from "./compose/stub";

/**
 * Cloudflare Worker entry. Minimal Hono app with a `/api/compose` endpoint.
 * Compose path:
 *   1. If `env.AI` is bound (Workers AI enabled via wrangler.jsonc), use it.
 *   2. Otherwise fall back to the offline stub grammar — lets us exercise the
 *      pipeline end-to-end in dev without a Cloudflare account.
 */
type Env = {
  Bindings: {
    AI?: AiBinding;
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

export default {
  fetch: app.fetch,
};
