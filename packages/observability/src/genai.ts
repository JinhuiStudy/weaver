import type { Attributes } from "./span";

/**
 * OTEL gen_ai.* semantic conventions — matches the 2025 draft spec for
 * LLM spans. Axiom's UI recognises these keys and renders tokens/model/etc.
 * in dedicated columns.
 *
 * Only include what we actually measure; missing fields are skipped so
 * attribute maps stay compact.
 */

export const GEN_AI_SYSTEM = {
  WORKERS_AI: "cloudflare-workers-ai",
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
} as const;

export type GenAiSystem = (typeof GEN_AI_SYSTEM)[keyof typeof GEN_AI_SYSTEM] | string;

export interface GenAiAttributeInput {
  system: GenAiSystem;
  requestModel?: string;
  responseModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  temperature?: number;
  /** Cloudflare neurons billed for this call — Weaver-specific, not OTEL. */
  neurons?: number;
}

export function genAiAttributes(input: GenAiAttributeInput): Attributes {
  const out: Attributes = {
    "gen_ai.system": input.system,
  };
  if (input.requestModel !== undefined) out["gen_ai.request.model"] = input.requestModel;
  if (input.responseModel !== undefined) out["gen_ai.response.model"] = input.responseModel;
  if (input.inputTokens !== undefined) out["gen_ai.usage.input_tokens"] = input.inputTokens;
  if (input.outputTokens !== undefined) out["gen_ai.usage.output_tokens"] = input.outputTokens;
  if (input.temperature !== undefined) out["gen_ai.request.temperature"] = input.temperature;
  if (input.neurons !== undefined) out["weaver.neurons"] = input.neurons;
  return out;
}
