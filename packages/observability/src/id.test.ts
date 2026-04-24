import { describe, expect, it } from "vitest";
import { newSpanId, newTraceId } from "./id";

/**
 * OTEL spec:
 *   trace_id = 16 bytes (32 hex chars), non-zero
 *   span_id  = 8  bytes (16 hex chars), non-zero
 * Both must be lowercase hex.
 */

describe("newTraceId", () => {
  it("returns 32 lowercase hex characters", () => {
    const id = newTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is not the all-zero reserved value", () => {
    for (let i = 0; i < 50; i++) {
      expect(newTraceId()).not.toBe("00000000000000000000000000000000");
    }
  });

  it("is unique across calls (no duplicates in 1000)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newTraceId());
    expect(set.size).toBe(1000);
  });
});

describe("newSpanId", () => {
  it("returns 16 lowercase hex characters", () => {
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is not the all-zero reserved value", () => {
    for (let i = 0; i < 50; i++) {
      expect(newSpanId()).not.toBe("0000000000000000");
    }
  });

  it("is unique across calls (no duplicates in 1000)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newSpanId());
    expect(set.size).toBe(1000);
  });
});
