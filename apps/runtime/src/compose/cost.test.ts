import { describe, expect, it } from "vitest";
import { estimateNeurons, NEURONS_DAILY_CAP } from "./cost";

describe("estimateNeurons", () => {
  it("returns floor of 1 neuron even for a tiny call (no free requests)", () => {
    expect(estimateNeurons(0, 0).neurons).toBe(1);
    expect(estimateNeurons(1, 1).neurons).toBe(1);
  });

  it("splits prompt/completion chars into token estimates (4 chars ≈ 1 token)", () => {
    const est = estimateNeurons(400, 200);
    expect(est.inputTokens).toBe(100);
    expect(est.outputTokens).toBe(50);
    expect(est.totalTokens).toBe(150);
  });

  it("scales neurons roughly ~tokens/8 with a ceil", () => {
    // 800 chars ≈ 200 tokens ≈ 25 neurons.
    expect(estimateNeurons(800, 0).neurons).toBe(25);
    // 80 chars ≈ 20 tokens ≈ ceil(20/8) = 3.
    expect(estimateNeurons(80, 0).neurons).toBe(3);
  });

  it("treats negative inputs as zero (clamp, not crash)", () => {
    const est = estimateNeurons(-10, -5);
    expect(est.inputTokens).toBe(0);
    expect(est.outputTokens).toBe(0);
    expect(est.neurons).toBe(1);
  });
});

describe("NEURONS_DAILY_CAP", () => {
  it("matches the Free-tier quota decision from docs/NEXT.md (50 per day)", () => {
    expect(NEURONS_DAILY_CAP).toBe(50);
  });
});
