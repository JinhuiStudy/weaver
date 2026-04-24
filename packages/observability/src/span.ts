import { newSpanId } from "./id";

/**
 * A minimal OTEL span shape — just the fields Axiom's OTLP/HTTP endpoint
 * cares about + a lightweight status discriminant. No events/links yet;
 * those are cheap to add when needed (Sprint 4 feedback might use events).
 */

export type AttributeValue = string | number | boolean;
export type Attributes = Record<string, AttributeValue>;

export type SpanStatusCode = "UNSET" | "OK" | "ERROR";
export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTimeUnixNano: bigint;
  endTimeUnixNano?: bigint;
  status: SpanStatus;
  attributes: Attributes;
}

export interface NewSpanInput {
  name: string;
  traceId: string;
  parentSpanId?: string;
  startTimeUnixNano: bigint;
}

export function newSpan(input: NewSpanInput): Span {
  return {
    name: input.name,
    traceId: input.traceId,
    spanId: newSpanId(),
    parentSpanId: input.parentSpanId,
    startTimeUnixNano: input.startTimeUnixNano,
    status: { code: "UNSET" },
    attributes: {},
  };
}

export function setAttribute(span: Span, key: string, value: AttributeValue): void {
  span.attributes[key] = value;
}

export function setAttributes(span: Span, values: Attributes): void {
  for (const [k, v] of Object.entries(values)) {
    span.attributes[k] = v;
  }
}

export function setStatus(span: Span, status: SpanStatus): void {
  span.status = { code: status.code };
  if (status.message !== undefined) span.status.message = status.message;
}

export function endSpan(span: Span, endTimeUnixNano: bigint): void {
  // Preserve the first end — double-ending usually means a bug in caller code
  // (e.g., withSpan catch + re-throw also calling endSpan).
  if (span.endTimeUnixNano !== undefined) return;
  span.endTimeUnixNano = endTimeUnixNano;
}
