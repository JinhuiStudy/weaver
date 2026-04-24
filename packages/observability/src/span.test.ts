import { describe, expect, it } from "vitest";
import type { Span } from "./span";
import { endSpan, newSpan, setAttribute, setAttributes, setStatus } from "./span";

describe("newSpan", () => {
  it("captures name, trace/span ids, and a start timestamp in nanoseconds", () => {
    const span = newSpan({
      name: "agent.step",
      traceId: "a".repeat(32),
      startTimeUnixNano: 1_700_000_000_000_000_000n,
    });
    expect(span.name).toBe("agent.step");
    expect(span.traceId).toBe("a".repeat(32));
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.startTimeUnixNano).toBe(1_700_000_000_000_000_000n);
    expect(span.status).toEqual({ code: "UNSET" });
    expect(span.attributes).toEqual({});
    expect(span.endTimeUnixNano).toBeUndefined();
    expect(span.parentSpanId).toBeUndefined();
  });

  it("inherits parent span id when given", () => {
    const span = newSpan({
      name: "child",
      traceId: "b".repeat(32),
      parentSpanId: "c".repeat(16),
      startTimeUnixNano: 0n,
    });
    expect(span.parentSpanId).toBe("c".repeat(16));
  });
});

describe("setAttribute / setAttributes", () => {
  it("sets a single attribute and preserves existing ones", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setAttribute(span, "gen_ai.system", "cloudflare-workers-ai");
    setAttribute(span, "gen_ai.request.model", "@cf/meta/llama-3.3-70b-instruct");
    expect(span.attributes["gen_ai.system"]).toBe("cloudflare-workers-ai");
    expect(span.attributes["gen_ai.request.model"]).toBe("@cf/meta/llama-3.3-70b-instruct");
  });

  it("accepts numbers and booleans in addition to strings", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setAttribute(span, "gen_ai.usage.input_tokens", 123);
    setAttribute(span, "gen_ai.usage.output_tokens", 45);
    setAttribute(span, "weaver.cache_hit", true);
    expect(span.attributes["gen_ai.usage.input_tokens"]).toBe(123);
    expect(span.attributes["gen_ai.usage.output_tokens"]).toBe(45);
    expect(span.attributes["weaver.cache_hit"]).toBe(true);
  });

  it("bulk-sets via setAttributes", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setAttributes(span, { "service.name": "weaver-runtime", "http.status_code": 200 });
    expect(span.attributes["service.name"]).toBe("weaver-runtime");
    expect(span.attributes["http.status_code"]).toBe(200);
  });
});

describe("setStatus", () => {
  it("marks a span as error with a message", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setStatus(span, { code: "ERROR", message: "workers-ai 429" });
    expect(span.status.code).toBe("ERROR");
    expect(span.status.message).toBe("workers-ai 429");
  });

  it("marks a span OK without a message", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 0n });
    setStatus(span, { code: "OK" });
    expect(span.status).toEqual({ code: "OK" });
  });
});

describe("endSpan", () => {
  it("records the end timestamp", () => {
    const span: Span = newSpan({
      name: "s",
      traceId: "a".repeat(32),
      startTimeUnixNano: 100n,
    });
    endSpan(span, 350n);
    expect(span.endTimeUnixNano).toBe(350n);
  });

  it("is a no-op when the span has already ended (preserves the first end)", () => {
    const span = newSpan({ name: "s", traceId: "a".repeat(32), startTimeUnixNano: 100n });
    endSpan(span, 200n);
    endSpan(span, 500n);
    expect(span.endTimeUnixNano).toBe(200n);
  });
});
