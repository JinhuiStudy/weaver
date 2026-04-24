/**
 * Fitness — a single scalar in [0, 1] that the evolution engine compares
 * across agent versions. Uses the Wilson score lower bound at a 95%
 * confidence level so a 20/20 run beats a 2/2 run at the same ratio:
 *
 *   z = 1.96 (two-tailed 95%)
 *   p = likes / n
 *   lower = (p + z²/(2n) − z · √((p(1−p) + z²/(4n)) / n)) / (1 + z²/n)
 *
 * Returns `null` when there aren't enough runs yet — callers treat that as
 * "don't rank this version for mutation, not enough signal."
 *
 * Pure function (no I/O) so `packages/core` stays side-effect-free and
 * unit tests can hammer edge cases without a live D1.
 */

export const MIN_SAMPLE_RUNS = 10;

const Z_95 = 1.96;

export interface FitnessInput {
  runCount: number;
  likes: number;
  dislikes: number;
}

export function computeFitness(input: FitnessInput): number | null {
  if (input.runCount < MIN_SAMPLE_RUNS) return null;
  const n = Math.max(1, input.likes + input.dislikes);
  // Zero-feedback (all runs, no 👍/👎) → null for now; future work can fall
  // back to run_count-based weighting.
  if (n === 0) return 0;
  const p = input.likes / n;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / n;
  const numerator = p + z2 / (2 * n) - Z_95 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  const lower = numerator / denominator;
  // Clamp for the perfect-zero / perfect-one tail.
  return Math.max(0, Math.min(1, lower));
}
