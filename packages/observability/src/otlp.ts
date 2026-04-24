import type { Attributes, AttributeValue, Span, SpanStatusCode } from "./span";
import type { FinishedSpan } from "./tracer";

/**
 * OTLP/HTTP JSON encoding — the exact wire format Axiom's `/v1/traces`
 * endpoint expects. We purposely emit the JSON (not the binary proto) form:
 * one-dependency, human-readable, and matches Axiom's docs.
 *
 * BigInts become strings per OTLP's convention ("startTimeUnixNano":"170000…")
 * because JSON numbers lose precision above 2^53. Status codes map to the
 * numeric OTEL enum:  UNSET=0, OK=1, ERROR=2.
 */

export interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpSpanStatus {
  code: number;
  message?: string;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  status: OtlpSpanStatus;
}

export interface OtlpScope {
  name: string;
  version?: string;
}

export interface OtlpScopeSpans {
  scope: OtlpScope;
  spans: OtlpSpan[];
}

export interface OtlpResource {
  attributes: OtlpKeyValue[];
}

export interface OtlpResourceSpans {
  resource: OtlpResource;
  scopeSpans: OtlpScopeSpans[];
}

export interface OtlpTracesBody {
  resourceSpans: OtlpResourceSpans[];
}

const STATUS_CODE_MAP: Record<SpanStatusCode, number> = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
};

export const SPAN_KIND_INTERNAL = 1;

function encodeValue(v: AttributeValue): OtlpAnyValue {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { boolValue: v };
  // Number: integer → intValue (as string per proto3 JSON rule), float → doubleValue.
  if (Number.isInteger(v)) return { intValue: String(v) };
  return { doubleValue: v };
}

function encodeAttributes(attrs: Attributes): OtlpKeyValue[] {
  return Object.entries(attrs).map(([key, value]) => ({
    key,
    value: encodeValue(value),
  }));
}

function encodeOneSpan(span: Span): OtlpSpan {
  // Axiom rejects open spans (no end time); if a caller forgot to endSpan,
  // fall back to startTime so the request doesn't 400. In practice the
  // Tracer only hands us finished spans.
  const end = span.endTimeUnixNano ?? span.startTimeUnixNano;
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: SPAN_KIND_INTERNAL,
    startTimeUnixNano: span.startTimeUnixNano.toString(),
    endTimeUnixNano: end.toString(),
    attributes: encodeAttributes(span.attributes),
    status: {
      code: STATUS_CODE_MAP[span.status.code],
      ...(span.status.message !== undefined ? { message: span.status.message } : {}),
    },
  };
}

/**
 * Group spans by their resource fingerprint. Two spans from the same Tracer
 * share a resource, so the common case produces exactly one resourceSpans
 * entry and one scopeSpans entry.
 */
function resourceKey(attrs: Attributes): string {
  return Object.entries(attrs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("|");
}

export function encodeOtlpJson(spans: FinishedSpan[]): OtlpTracesBody {
  const buckets = new Map<string, { resource: Attributes; spans: Span[] }>();
  for (const span of spans) {
    const key = resourceKey(span.resource);
    const existing = buckets.get(key);
    if (existing) {
      existing.spans.push(span);
    } else {
      buckets.set(key, { resource: span.resource, spans: [span] });
    }
  }

  const resourceSpans: OtlpResourceSpans[] = [];
  for (const { resource, spans: groupSpans } of buckets.values()) {
    resourceSpans.push({
      resource: { attributes: encodeAttributes(resource) },
      scopeSpans: [
        {
          scope: { name: "@weaver/observability", version: "0.0.0" },
          spans: groupSpans.map(encodeOneSpan),
        },
      ],
    });
  }

  return { resourceSpans };
}
