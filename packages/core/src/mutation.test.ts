import { describe, expect, it } from "vitest";
import { applyMutation, MUTATION_STRATEGIES, planMutations } from "./mutation";

describe("MUTATION_STRATEGIES", () => {
  it("exposes exactly the 5 strategies specified in ADR-008", () => {
    expect(MUTATION_STRATEGIES.map((s) => s.kind).sort()).toEqual(
      ["concise", "cot", "format", "role", "specific"].sort(),
    );
  });

  it("each strategy has a human label and a short description", () => {
    for (const s of MUTATION_STRATEGIES) {
      expect(s.label.length).toBeGreaterThan(1);
      expect(s.description.length).toBeGreaterThan(5);
    }
  });
});

describe("applyMutation (deterministic local transform)", () => {
  const basePrompt = "You summarise news stories.";

  it("concise · prepends an instruction to stay short", () => {
    const out = applyMutation(basePrompt, "concise");
    expect(out.toLowerCase()).toContain("concise");
    expect(out).not.toBe(basePrompt);
  });

  it("specific · asks for concrete examples", () => {
    const out = applyMutation(basePrompt, "specific");
    expect(out.toLowerCase()).toContain("concrete");
  });

  it("cot · injects a step-by-step directive", () => {
    const out = applyMutation(basePrompt, "cot");
    expect(out.toLowerCase()).toMatch(/step[- ]by[- ]step|think/);
  });

  it("role · prepends a senior-editor role frame", () => {
    const out = applyMutation(basePrompt, "role");
    expect(out.toLowerCase()).toContain("senior");
  });

  it("format · asks for JSON output", () => {
    const out = applyMutation(basePrompt, "format");
    expect(out.toLowerCase()).toContain("json");
  });

  it("is idempotent — applying the same strategy twice doesn't stack the directive", () => {
    const once = applyMutation(basePrompt, "concise");
    const twice = applyMutation(once, "concise");
    expect(twice).toBe(once);
  });

  it("throws on an unknown strategy", () => {
    expect(() => applyMutation(basePrompt, "mystery" as never)).toThrow();
  });
});

describe("planMutations", () => {
  it("schedules every available strategy × `candidatesPerStrategy`", () => {
    const plan = planMutations({ candidatesPerStrategy: 2 });
    expect(plan).toHaveLength(MUTATION_STRATEGIES.length * 2);
    // First strategies come first, in the canonical order.
    expect(plan[0]?.kind).toBe(MUTATION_STRATEGIES[0]?.kind);
    expect(plan[1]?.kind).toBe(MUTATION_STRATEGIES[0]?.kind);
    expect(plan[2]?.kind).toBe(MUTATION_STRATEGIES[1]?.kind);
  });

  it("filters by explicit `only` list", () => {
    const plan = planMutations({ candidatesPerStrategy: 1, only: ["concise", "cot"] });
    expect(plan.map((p) => p.kind)).toEqual(["concise", "cot"]);
  });

  it("rejects candidatesPerStrategy ≤ 0", () => {
    expect(() => planMutations({ candidatesPerStrategy: 0 })).toThrow();
  });
});
