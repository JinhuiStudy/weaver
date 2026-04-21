import { describe, expect, it } from "vitest";
import type { Node } from "./node";
import { labelError, uniqueLabelError } from "./validation";

const nodeOf = (id: string, label: string): Node => ({
  id,
  type: "agent",
  position: { x: 0, y: 0 },
  label,
  version: 1,
  model: "claude",
  system_prompt: "",
  user_prompt: "",
  tool_choice: "auto",
  use_prompt_cache: false,
});

describe("labelError", () => {
  it("accepts well-formed snake_case labels", () => {
    expect(labelError("policy_check")).toBeNull();
  });

  it("rejects empty labels", () => {
    expect(labelError("")).toMatch(/required/);
  });

  it("rejects labels over 40 chars", () => {
    expect(labelError("a".repeat(41))).toMatch(/≤ 40/);
  });
});

describe("uniqueLabelError", () => {
  const siblings: Node[] = [nodeOf("a", "policy_check"), nodeOf("b", "stripe_lookup")];

  it("returns null when the label is fresh", () => {
    expect(uniqueLabelError("brand_new", "c", siblings)).toBeNull();
  });

  it("returns null when keeping the same label on the same node", () => {
    expect(uniqueLabelError("policy_check", "a", siblings)).toBeNull();
  });

  it("flags duplicates across different nodes", () => {
    expect(uniqueLabelError("policy_check", "c", siblings)).toMatch(/duplicate/i);
  });

  it("layered with labelError: empty label still returns the label error first", () => {
    const err = labelError("") ?? uniqueLabelError("", "c", siblings);
    expect(err).toMatch(/required/);
  });
});
