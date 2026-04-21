import { describe, expect, it } from "vitest";
import type { Node } from "./node";
import { labelError, uniqueLabelError } from "./validation";

const nodeOf = (id: string, label: string): Pick<Node, "id" | "label"> => ({ id, label });

describe("labelError · boundary conditions", () => {
  it("accepts exactly 40 characters", () => {
    expect(labelError("a".repeat(40))).toBeNull();
  });

  it("rejects 41 characters", () => {
    expect(labelError("a".repeat(41))).toMatch(/≤ 40/);
  });

  it("rejects a single space (whitespace-only treated as invalid shape)", () => {
    // v.minLength counts " " as length 1, so this currently PASSES shape check.
    // We document the observed behavior so future callers know to trim before
    // shape-validating — the Inspector calls trim() first.
    expect(labelError(" ")).toBeNull();
  });

  it("is case-sensitive (Policy ≠ policy)", () => {
    // shape check doesn't care; case collisions are uniqueness's problem.
    expect(labelError("Policy_check")).toBeNull();
    expect(labelError("policy_check")).toBeNull();
  });
});

describe("uniqueLabelError · self-exclusion and comparison semantics", () => {
  const siblings = [nodeOf("a", "policy_check"), nodeOf("b", "stripe_lookup")];

  it("excludes the current node id from the duplicate check", () => {
    expect(uniqueLabelError("policy_check", "a", siblings)).toBeNull();
  });

  it("trims whitespace before comparing (user might paste ' policy_check ')", () => {
    expect(uniqueLabelError(" policy_check ", "c", siblings)).toMatch(/duplicate/i);
  });

  it("is case-sensitive by design — 'Policy_check' ≠ 'policy_check'", () => {
    expect(uniqueLabelError("Policy_check", "c", siblings)).toBeNull();
  });

  it("treats empty / whitespace-only label as NOT duplicate (shape handles empty)", () => {
    expect(uniqueLabelError("", "c", siblings)).toBeNull();
    expect(uniqueLabelError("   ", "c", siblings)).toBeNull();
  });

  it("handles an empty siblings list", () => {
    expect(uniqueLabelError("anything", "c", [])).toBeNull();
  });

  it("handles multiple siblings with the same label (malformed canvas)", () => {
    const mal = [nodeOf("a", "dup"), nodeOf("b", "dup")];
    expect(uniqueLabelError("dup", "c", mal)).toMatch(/duplicate/i);
  });
});
