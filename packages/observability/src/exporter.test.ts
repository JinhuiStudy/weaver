import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiomExporter, NoopExporter } from "./exporter";
import { endSpan, newSpan } from "./span";
import type { FinishedSpan, Tracer } from "./tracer";

function mkSpan(name: string): FinishedSpan {
  const span = newSpan({ name, traceId: "a".repeat(32), startTimeUnixNano: 0n });
  endSpan(span, 100n);
  return { ...span, endTimeUnixNano: 100n, resource: { "service.name": "weaver-runtime" } };
}

function mockTracer(finished: FinishedSpan[]): Tracer {
  const buffer = [...finished];
  return {
    drain() {
      const out = [...buffer];
      buffer.length = 0;
      return out;
    },
    finishedSpans() {
      return [...buffer];
    },
  } as unknown as Tracer;
}

describe("AxiomExporter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts drained spans to the Axiom OTLP endpoint with the configured token", async () => {
    const tracer = mockTracer([mkSpan("one"), mkSpan("two")]);
    const exporter = new AxiomExporter({
      token: "axiom-secret-token",
      dataset: "weaver",
      fetchImpl: fetchMock,
    });
    await exporter.flush(tracer);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const url = call?.[0] as string;
    const init = call?.[1] as RequestInit;
    expect(url).toContain("/v1/traces");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers as Record<string, string>);
    expect(headers.get("authorization")).toBe("Bearer axiom-secret-token");
    expect(headers.get("x-axiom-dataset")).toBe("weaver");
    expect(headers.get("content-type")).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.resourceSpans).toHaveLength(1);
    expect(body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2);
  });

  it("skips the POST when there are no spans to drain (no network call)", async () => {
    const tracer = mockTracer([]);
    const exporter = new AxiomExporter({
      token: "t",
      dataset: "weaver",
      fetchImpl: fetchMock,
    });
    await exporter.flush(tracer);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops the batch on HTTP 5xx (console.warn, no throw, no retry)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 503 }));

    const tracer = mockTracer([mkSpan("s")]);
    const exporter = new AxiomExporter({
      token: "t",
      dataset: "weaver",
      fetchImpl: fetchMock,
    });
    await expect(exporter.flush(tracer)).resolves.not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("drops the batch on a rejected fetch (network failure) without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("conn reset"));

    const tracer = mockTracer([mkSpan("s")]);
    const exporter = new AxiomExporter({
      token: "t",
      dataset: "weaver",
      fetchImpl: fetchMock,
    });
    await expect(exporter.flush(tracer)).resolves.not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("respects the configured endpoint override", async () => {
    const tracer = mockTracer([mkSpan("s")]);
    const exporter = new AxiomExporter({
      token: "t",
      dataset: "weaver",
      endpoint: "https://axiom.internal.example.com/v1/traces",
      fetchImpl: fetchMock,
    });
    await exporter.flush(tracer);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe("https://axiom.internal.example.com/v1/traces");
  });
});

describe("NoopExporter", () => {
  it("drains the tracer so buffers don't leak but does no I/O", async () => {
    const tracer = mockTracer([mkSpan("x"), mkSpan("y")]);
    const exporter = new NoopExporter();
    await exporter.flush(tracer);
    expect(tracer.finishedSpans()).toEqual([]);
  });
});
