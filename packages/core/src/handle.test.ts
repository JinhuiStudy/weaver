import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { HandleSchema, handleError, normalizeHandleCandidate } from "./handle";

describe("HandleSchema", () => {
  it("accepts simple lowercase handle", () => {
    expect(v.parse(HandleSchema, "jinhui")).toBe("jinhui");
  });

  it("accepts internal hyphens and digits", () => {
    expect(v.parse(HandleSchema, "jin-hui-42")).toBe("jin-hui-42");
  });

  it("accepts single char", () => {
    expect(v.parse(HandleSchema, "a")).toBe("a");
  });

  it("accepts 39-char boundary", () => {
    expect(v.parse(HandleSchema, "a".repeat(39))).toHaveLength(39);
  });

  it("rejects 40-char over-length", () => {
    expect(() => v.parse(HandleSchema, "a".repeat(40))).toThrow();
  });

  it("rejects empty handle", () => {
    expect(() => v.parse(HandleSchema, "")).toThrow();
  });

  it("rejects uppercase", () => {
    expect(() => v.parse(HandleSchema, "Jinhui")).toThrow();
  });

  it("rejects leading hyphen", () => {
    expect(() => v.parse(HandleSchema, "-jinhui")).toThrow();
  });

  it("rejects trailing hyphen", () => {
    expect(() => v.parse(HandleSchema, "jinhui-")).toThrow();
  });

  it("rejects consecutive hyphens", () => {
    expect(() => v.parse(HandleSchema, "jin--hui")).toThrow();
  });

  it("rejects underscore or dot", () => {
    expect(() => v.parse(HandleSchema, "jin_hui")).toThrow();
    expect(() => v.parse(HandleSchema, "jin.hui")).toThrow();
  });
});

describe("handleError()", () => {
  it("returns null for valid handle", () => {
    expect(handleError("jinhui")).toBeNull();
  });

  it("returns a message for invalid handle", () => {
    const msg = handleError("BAD_HANDLE!");
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe("string");
  });
});

describe("normalizeHandleCandidate()", () => {
  it("lowercases and replaces non-conforming chars with hyphen", () => {
    expect(normalizeHandleCandidate("Jinhui Park")).toBe("jinhui-park");
  });

  it("collapses consecutive hyphens and trims ends", () => {
    expect(normalizeHandleCandidate("--Jin__Hui--")).toBe("jin-hui");
  });

  it("truncates to 39 chars", () => {
    expect(normalizeHandleCandidate("a".repeat(60))).toHaveLength(39);
  });

  it("falls back to provided fallback on empty result", () => {
    expect(normalizeHandleCandidate("!!!", "anon")).toBe("anon");
  });
});
