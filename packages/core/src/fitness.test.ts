import { describe, expect, it } from "vitest";
import { computeFitness, MIN_SAMPLE_RUNS } from "./fitness";

describe("computeFitness", () => {
  it("returns null when the version has fewer than MIN_SAMPLE_RUNS runs (too early to rank)", () => {
    expect(computeFitness({ runCount: 0, likes: 0, dislikes: 0 })).toBeNull();
    expect(computeFitness({ runCount: MIN_SAMPLE_RUNS - 1, likes: 9, dislikes: 0 })).toBeNull();
  });

  it("returns a score in [0, 1] once there are enough runs", () => {
    const f = computeFitness({ runCount: 20, likes: 14, dislikes: 6 });
    expect(f).not.toBeNull();
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  it("is Wilson-lower-bound-ish — 20/20 beats 2/2 even at same ratio", () => {
    const a = computeFitness({ runCount: 20, likes: 20, dislikes: 0 });
    const b = computeFitness({ runCount: MIN_SAMPLE_RUNS, likes: MIN_SAMPLE_RUNS, dislikes: 0 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // More evidence ⇒ a is at least as confident as b.
    expect(a ?? 0).toBeGreaterThan(b ?? 0);
  });

  it("rewards a positive ratio over a mixed one", () => {
    const positive = computeFitness({ runCount: 20, likes: 18, dislikes: 2 });
    const mixed = computeFitness({ runCount: 20, likes: 10, dislikes: 10 });
    expect(positive ?? 0).toBeGreaterThan(mixed ?? 0);
  });

  it("returns near-zero for an all-dislikes version (still ≥ 0)", () => {
    const f = computeFitness({ runCount: 20, likes: 0, dislikes: 20 });
    expect(f ?? -1).toBeGreaterThanOrEqual(0);
    expect(f ?? 1).toBeLessThan(0.2);
  });
});
