import { describe, expect, it } from "vitest";
import { isWeaverId, newId } from "./id";

describe("newId()", () => {
  it("returns a 26-char ULID (Crockford base32)", () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("generates unique values across rapid calls", () => {
    const batch = new Set<string>();
    for (let i = 0; i < 1_000; i++) batch.add(newId());
    expect(batch.size).toBe(1_000);
  });

  it("produces lexicographically sortable ids (monotonic in time)", async () => {
    const first = newId();
    // Force next millisecond bucket to prove sort-by-time holds across ticks.
    await new Promise((r) => setTimeout(r, 2));
    const second = newId();
    expect(second > first).toBe(true);
  });
});

describe("isWeaverId()", () => {
  it("accepts well-formed ULIDs", () => {
    expect(isWeaverId(newId())).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isWeaverId("01J")).toBe(false);
    expect(isWeaverId("01J000000000000000000000000")).toBe(false);
  });

  it("rejects forbidden chars (I, L, O, U, lowercase)", () => {
    expect(isWeaverId("01J00000000000000000000I00")).toBe(false);
    expect(isWeaverId("01j00000000000000000000000")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isWeaverId(null)).toBe(false);
    expect(isWeaverId(123)).toBe(false);
    expect(isWeaverId(undefined)).toBe(false);
  });
});
