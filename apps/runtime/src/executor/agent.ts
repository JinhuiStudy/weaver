import type { AiBinding } from "../compose/ai";

/**
 * Minimal config an Agent node needs to run end-to-end. Sourced from
 * node.data in the canvas / from AgentNode in @weaver/core's Graph schema.
 */
export interface AgentNodeConfig {
  id: string;
  /** The agent's snake_case label — used as the key under which its output
   *  is stored in run.state, so downstream nodes can reference it. */
  label: string;
  model: string;
  system_prompt: string;
  user_prompt: string;
  temperature?: number;
  max_tokens?: number;
  tool_choice?: "auto" | "any" | "none" | string;
}

export interface RunContext {
  /** The initial payload handed to the run (Input node's JSON). */
  input: Record<string, unknown>;
  /** Outputs of previous agent/tool nodes keyed by their labels. */
  state: Record<string, unknown>;
}

export interface AgentResult {
  output: string;
  stateDelta: Record<string, unknown>;
}

/**
 * Execute an Agent node: interpolate the prompt template against the run
 * context, call the AI binding, return the response + a `state[label]`
 * delta. Pure w.r.t. the injected `ai` — no D1 / global side effects here.
 */
export async function runAgent({
  ai,
  config,
  runContext,
}: {
  ai: AiBinding;
  config: AgentNodeConfig;
  runContext: RunContext;
}): Promise<AgentResult> {
  const userContent = interpolate(config.user_prompt, runContext);

  const raw = await ai.run(config.model, {
    messages: [
      { role: "system", content: config.system_prompt },
      { role: "user", content: userContent },
    ],
    temperature: config.temperature ?? 0.2,
    max_tokens: config.max_tokens,
  });

  const output =
    typeof raw === "string"
      ? raw
      : typeof raw.response === "string"
        ? raw.response
        : JSON.stringify(raw);

  return {
    output,
    stateDelta: { [config.label]: output },
  };
}

/**
 * Very small `{{ input.<field> }}` / `{{ <node_label>.<key> }}` substituter.
 * Tokens that can't be resolved are left intact so they're visible in the
 * final prompt — easier to spot at debug time than an empty string.
 */
function interpolate(tpl: string, ctx: RunContext): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_whole, expr: string) => {
    const parts = expr.split(".");
    const root = parts[0];
    if (!root) return `{{ ${expr} }}`;
    const container = root === "input" ? ctx.input : (ctx.state[root] as unknown);
    const value = deepGet(container, parts.slice(1));
    return value === undefined ? `{{ ${expr} }}` : String(value);
  });
}

function deepGet(obj: unknown, path: string[]): unknown {
  if (obj == null || typeof obj !== "object") {
    return path.length === 0 ? obj : undefined;
  }
  if (path.length === 0) return obj;
  const head = path[0] as string;
  return deepGet((obj as Record<string, unknown>)[head], path.slice(1));
}
