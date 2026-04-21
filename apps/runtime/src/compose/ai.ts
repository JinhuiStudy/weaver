import type { NodeType } from "@weaver/core";
import * as v from "valibot";
import {
  applyComposeIntent,
  type CanvasSnapshot,
  type ComposeIntent,
  type ComposeOp,
  parseComposeIntent,
} from "./stub";

/**
 * The subset of Cloudflare Workers AI's runtime we actually use. In
 * production this is `env.AI` (from wrangler.jsonc's `ai.binding`). In tests
 * we inject a mock implementing only `run()`.
 */
export interface AiBinding {
  run(model: string, input: unknown): Promise<{ response?: string } | string>;
}

const MODEL = "@cf/meta/llama-3-8b-instruct";

const SYSTEM_PROMPT = [
  "You are Weaver's compose engine.",
  "Given a user's natural-language instruction and a snapshot of the current canvas,",
  'respond with a single JSON object of shape: {"ops": [...]}.',
  "Valid ops:",
  '  { "kind": "add_node", "nodeType": "input|agent|tool|branch|output" }',
  '  { "kind": "connect", "sourceLabel": "...", "targetLabel": "..." }',
  "Do NOT include any prose. JSON only.",
].join(" ");

/** Schema for whatever JSON the model hands back. Missing fields → rejected. */
const OpSchema = v.variant("kind", [
  v.object({
    kind: v.literal("add_node"),
    nodeType: v.picklist(["input", "agent", "tool", "branch", "output"]),
  }),
  v.object({
    kind: v.literal("connect"),
    sourceLabel: v.string(),
    targetLabel: v.string(),
  }),
]);
const IntentSchema = v.object({ ops: v.array(OpSchema) });

export interface ComposeWithAiInput {
  ai: AiBinding;
  prompt: string;
  canvas: CanvasSnapshot;
}

export async function composeWithAi({
  ai,
  prompt,
  canvas,
}: ComposeWithAiInput): Promise<{ intent: ComposeIntent; canvas: CanvasSnapshot }> {
  const userContent = [
    prompt,
    "---",
    "Current canvas (JSON):",
    JSON.stringify(
      {
        nodes: canvas.nodes.map((n) => ({ id: n.id, type: n.type, label: n.data.label })),
        edges: canvas.edges.map((e) => ({ source: e.source, target: e.target })),
      },
      null,
      2,
    ),
  ].join("\n");

  const raw = await ai.run(MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const text = typeof raw === "string" ? raw : typeof raw.response === "string" ? raw.response : "";

  const intentFromAi = tryParseAiIntent(text);
  if (intentFromAi) {
    const next = applyComposeIntent(canvas, intentFromAi);
    return { intent: intentFromAi, canvas: next };
  }

  // Model didn't return clean JSON or produced an invalid payload → fall back
  // to the offline grammar so the user still gets deterministic behavior.
  const stubIntent = parseComposeIntent(prompt);
  const next = applyComposeIntent(canvas, stubIntent);
  return { intent: stubIntent, canvas: next };
}

function tryParseAiIntent(text: string): ComposeIntent | null {
  // Models sometimes wrap JSON in ```json … ``` — strip fences if present.
  const stripped = text
    .replace(/```json\s*/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    const result = v.safeParse(IntentSchema, parsed);
    if (!result.success) return null;
    return {
      ops: result.output.ops as ComposeOp[],
    };
  } catch {
    return null;
  }
}

/** Re-exports for convenience at call sites. */
export type { CanvasSnapshot, ComposeIntent, NodeType };
