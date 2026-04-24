import { newTraceId } from "./id";
import type { Attributes, Span } from "./span";
import { endSpan, newSpan, setStatus } from "./span";

/**
 * Tracer — owns span ID generation, parent/child lineage, and a buffer of
 * finished spans the exporter drains periodically.
 *
 * Design notes:
 *   • Async-context stack is managed explicitly via `withSpan(fn)`. We
 *     deliberately avoid AsyncLocalStorage because Cloudflare Workers'
 *     support is still uneven across runtimes, and the tracer is usually
 *     scoped to a single `scheduled()` invocation anyway.
 *   • Resource attributes are declared per-tracer (service.name etc.) and
 *     attached to each finished span so the exporter can bucket by resource
 *     without the caller re-passing them on every span.
 */

export type Clock = () => bigint;

export interface TracerOptions {
  /**
   * Nanoseconds-since-epoch clock. Defaults to `Date.now()` ×1e6 — that's
   * millisecond precision, but good enough for Run timelines where the
   * variance between spans is ≫ 1ms.
   */
  clock?: Clock;
  /**
   * Attributes attached to every span as its OTEL "resource". Typically
   * `{ "service.name": "weaver-runtime", "deployment.environment": "production" }`.
   */
  resource?: Attributes;
}

export interface FinishedSpan extends Span {
  endTimeUnixNano: bigint;
  resource: Attributes;
}

function defaultClock(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

export class Tracer {
  private readonly clock: Clock;
  private readonly resource: Attributes;
  private readonly _active: Span[] = [];
  private readonly _finished: FinishedSpan[] = [];
  /** Track every started span so we can emit them even when ended outside `withSpan`. */
  private readonly _all = new Set<Span>();

  constructor(options: TracerOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.resource = { ...(options.resource ?? {}) };
  }

  startSpan(name: string): Span {
    const parent = this._active[this._active.length - 1];
    const span = newSpan({
      name,
      traceId: parent?.traceId ?? newTraceId(),
      parentSpanId: parent?.spanId,
      startTimeUnixNano: this.clock(),
    });
    this._all.add(span);
    return span;
  }

  endSpan(span: Span): void {
    if (!this._all.has(span)) return;
    endSpan(span, this.clock());
    if (!span.endTimeUnixNano) return;
    this._finished.push({
      ...span,
      endTimeUnixNano: span.endTimeUnixNano,
      resource: { ...this.resource },
    });
    this._all.delete(span);
  }

  /**
   * Run `fn` under a span that becomes the active parent for nested spans.
   * Auto-ends the span on return and on thrown error — the error message is
   * recorded on the span status before re-throw.
   */
  async withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    const span = this.startSpan(name);
    this._active.push(span);
    try {
      const result = await fn(span);
      if (span.status.code === "UNSET") setStatus(span, { code: "OK" });
      return result;
    } catch (err) {
      setStatus(span, {
        code: "ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this._active.pop();
      this.endSpan(span);
    }
  }

  finishedSpans(): FinishedSpan[] {
    return [...this._finished];
  }

  /** Pull every finished span and clear the buffer — exporter calls this. */
  drain(): FinishedSpan[] {
    const out = [...this._finished];
    this._finished.length = 0;
    return out;
  }
}
