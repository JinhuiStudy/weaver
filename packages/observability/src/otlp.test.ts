import { describe, expect, it } from "vitest";
import { encodeOtlpJson } from "./otlp";
import { endSpan, newSpan, setAttributes, setStatus } from "./span";
import type { FinishedSpan } from "./tracer";

function toFinished(spans: ReturnType<typeof newSpan>[]): FinishedSpan[] {
  return spans.map((span) => {
    if (span.endTimeUnixNano === undefined) {
      throw new Error("toFinished: span must have endSpan() called before encoding");
    }
    return {
      ...span,
      endTimeUnixNano: span.endTimeUnixNano,
      resource: { "service.name": "weaver-runtime" },
    };
  });
}

describe("encodeOtlpJson", () => {
  it("wraps spans in the resourceSpans/scopeSpans envelope Axiom expects", () => {
    const span = newSpan({
      name: "run",
      traceId: "a".repeat(32),
      startTimeUnixNano: 1_700_000_000_000_000_000n,
    });
    endSpan(span, 1_700_000_001_000_000_000n);
    setStatus(span, { code: "OK" });
    setAttributes(span, { "gen_ai.system": "cloudflare-workers-ai" });

    const body = encodeOtlpJson(toFinished([span]));
    expect(body.resourceSpans).toHaveLength(1);
    const rs = body.resourceSpans[0];
    expect(rs?.resource.attributes).toContainEqual({
      key: "service.name",
      value: { stringValue: "weaver-runtime" },
    });
    expect(rs?.scopeSpans).toHaveLength(1);
    const encoded = rs?.scopeSpans[0]?.spans[0];
    expect(encoded?.name).toBe("run");
    expect(encoded?.traceId).toBe("a".repeat(32));
    expect(encoded?.startTimeUnixNano).toBe("1700000000000000000");
    expect(encoded?.endTimeUnixNano).toBe("1700000001000000000");
    expect(encoded?.attributes).toContainEqual({
      key: "gen_ai.system",
      value: { stringValue: "cloudflare-workers-ai" },
    });
  });

  it("encodes numeric attributes as intValue (integers) and doubleValue (floats)", () => {
    const span = newSpan({ name: "x", traceId: "b".repeat(32), startTimeUnixNano: 0n });
    endSpan(span, 1n);
    setAttributes(span, {
      "gen_ai.usage.input_tokens": 120,
      "gen_ai.request.temperature": 0.2,
    });
    const body = encodeOtlpJson(toFinished([span]));
    const attrs = body.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.attributes ?? [];
    expect(attrs).toContainEqual({
      key: "gen_ai.usage.input_tokens",
      value: { intValue: "120" },
    });
    expect(attrs).toContainEqual({
      key: "gen_ai.request.temperature",
      value: { doubleValue: 0.2 },
    });
  });

  it("encodes boolean attributes as boolValue", () => {
    const span = newSpan({ name: "x", traceId: "c".repeat(32), startTimeUnixNano: 0n });
    endSpan(span, 1n);
    setAttributes(span, { "weaver.cache_hit": true });
    const body = encodeOtlpJson(toFinished([span]));
    const attrs = body.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.attributes ?? [];
    expect(attrs).toContainEqual({
      key: "weaver.cache_hit",
      value: { boolValue: true },
    });
  });

  it("maps span status codes to OTEL numeric (UNSET=0, OK=1, ERROR=2)", () => {
    const span = newSpan({ name: "x", traceId: "d".repeat(32), startTimeUnixNano: 0n });
    endSpan(span, 1n);
    setStatus(span, { code: "ERROR", message: "boom" });
    const body = encodeOtlpJson(toFinished([span]));
    const status = body.resourceSpans[0]?.scopeSpans[0]?.spans[0]?.status;
    expect(status?.code).toBe(2);
    expect(status?.message).toBe("boom");
  });

  it("groups spans with the same resource into one resourceSpans entry", () => {
    const a = newSpan({ name: "a", traceId: "e".repeat(32), startTimeUnixNano: 0n });
    const b = newSpan({ name: "b", traceId: "e".repeat(32), startTimeUnixNano: 1n });
    endSpan(a, 10n);
    endSpan(b, 20n);
    const body = encodeOtlpJson(toFinished([a, b]));
    expect(body.resourceSpans).toHaveLength(1);
    expect(body.resourceSpans[0]?.scopeSpans[0]?.spans).toHaveLength(2);
  });
});
