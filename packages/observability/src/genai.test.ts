import { describe, expect, it } from "vitest";
import { GEN_AI_SYSTEM, genAiAttributes } from "./genai";
import { newSpan, setAttributes } from "./span";

describe("genAiAttributes", () => {
  it("produces OTEL gen_ai.* semantic-convention keys", () => {
    const attrs = genAiAttributes({
      system: "cloudflare-workers-ai",
      requestModel: "@cf/meta/llama-3.3-70b-instruct",
      responseModel: "@cf/meta/llama-3.3-70b-instruct",
      inputTokens: 120,
      outputTokens: 45,
      temperature: 0.2,
    });
    expect(attrs).toEqual({
      "gen_ai.system": "cloudflare-workers-ai",
      "gen_ai.request.model": "@cf/meta/llama-3.3-70b-instruct",
      "gen_ai.response.model": "@cf/meta/llama-3.3-70b-instruct",
      "gen_ai.usage.input_tokens": 120,
      "gen_ai.usage.output_tokens": 45,
      "gen_ai.request.temperature": 0.2,
    });
  });

  it("omits undefined fields (doesn't write empty attribute keys)", () => {
    const attrs = genAiAttributes({
      system: GEN_AI_SYSTEM.WORKERS_AI,
      requestModel: "@cf/meta/llama-3.3-70b-instruct",
    });
    expect(Object.keys(attrs).sort()).toEqual(["gen_ai.request.model", "gen_ai.system"]);
  });

  it("plays well with setAttributes on a span", () => {
    const span = newSpan({ name: "llm.call", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setAttributes(
      span,
      genAiAttributes({
        system: GEN_AI_SYSTEM.WORKERS_AI,
        requestModel: "@cf/meta/llama-3.3-70b-instruct",
        inputTokens: 10,
        outputTokens: 5,
      }),
    );
    expect(span.attributes["gen_ai.system"]).toBe("cloudflare-workers-ai");
    expect(span.attributes["gen_ai.usage.input_tokens"]).toBe(10);
    expect(span.attributes["gen_ai.usage.output_tokens"]).toBe(5);
  });
});

describe("GEN_AI_SYSTEM constants", () => {
  it("exposes the known Weaver LLM backends as stable strings", () => {
    expect(GEN_AI_SYSTEM.WORKERS_AI).toBe("cloudflare-workers-ai");
    expect(GEN_AI_SYSTEM.ANTHROPIC).toBe("anthropic");
    expect(GEN_AI_SYSTEM.OPENAI).toBe("openai");
  });
});
