import { describe, expect, it, vi } from "vitest";
import { Tracer } from "./tracer";

describe("Tracer", () => {
  it("creates a root span with a fresh trace id and no parent", () => {
    // Clock contract: returns nanoseconds-since-epoch directly. Tracer
    // doesn't re-scale — callers hand in whichever unit OTEL expects.
    const clock = vi.fn().mockReturnValue(1_700_000_000_000_000_000n);
    const tracer = new Tracer({ clock });
    const span = tracer.startSpan("run");
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.parentSpanId).toBeUndefined();
    expect(span.startTimeUnixNano).toBe(1_700_000_000_000_000_000n);
  });

  it("nested startSpan inside `withSpan` inherits traceId and sets parentSpanId", async () => {
    const clock = vi.fn().mockReturnValue(1n);
    const tracer = new Tracer({ clock });
    const result = await tracer.withSpan("parent", async (parent) => {
      const child = tracer.startSpan("child");
      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
      tracer.endSpan(child);
      return 42;
    });
    expect(result).toBe(42);
  });

  it("records every span created via the tracer into its internal buffer", () => {
    const tracer = new Tracer();
    const a = tracer.startSpan("a");
    const b = tracer.startSpan("b");
    tracer.endSpan(a);
    tracer.endSpan(b);
    const spans = tracer.finishedSpans();
    const names = spans.map((s) => s.name).sort();
    expect(names).toEqual(["a", "b"]);
  });

  it("in-flight spans (not yet ended) are NOT returned by finishedSpans()", () => {
    const tracer = new Tracer();
    const a = tracer.startSpan("a");
    const b = tracer.startSpan("b");
    tracer.endSpan(a);
    // b is still active
    expect(tracer.finishedSpans().map((s) => s.name)).toEqual(["a"]);
    tracer.endSpan(b);
    expect(
      tracer
        .finishedSpans()
        .map((s) => s.name)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("drain() returns finished spans and clears the buffer", () => {
    const tracer = new Tracer();
    const a = tracer.startSpan("a");
    tracer.endSpan(a);
    const first = tracer.drain();
    expect(first).toHaveLength(1);
    expect(tracer.drain()).toEqual([]);
    expect(tracer.finishedSpans()).toEqual([]);
  });

  it("withSpan auto-ends the span on success and on thrown errors", async () => {
    const tracer = new Tracer();
    await tracer.withSpan("ok", async () => "done");
    await expect(
      tracer.withSpan("boom", async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");

    const spans = tracer.finishedSpans();
    expect(spans).toHaveLength(2);
    const boom = spans.find((s) => s.name === "boom");
    expect(boom?.status.code).toBe("ERROR");
    expect(boom?.status.message).toBe("x");
  });

  it("per-tracer resource attributes land on every finished span output (via drain)", () => {
    const tracer = new Tracer({
      resource: { "service.name": "weaver-runtime", "deployment.environment": "test" },
    });
    const s = tracer.startSpan("x");
    tracer.endSpan(s);
    const [finished] = tracer.finishedSpans();
    expect(finished?.resource["service.name"]).toBe("weaver-runtime");
    expect(finished?.resource["deployment.environment"]).toBe("test");
  });
});
