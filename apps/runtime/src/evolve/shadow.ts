import type { MutationKind } from "@weaver/core";

/**
 * Shadow eval — pairwise compare each unevaluated candidate against its
 * original version. We expose the judge as a hook so:
 *   • Production: a Workers-AI Llama 3B judge returns "candidate" | "original"
 *   • Dev / tests: deterministic mock judges keep the pipeline hermetic.
 *
 * Suggested_at is stamped when win_rate ≥ 0.6 — that's the same threshold
 * ADR-008 uses for its v2-suggestion banner.
 */

export interface ShadowPassInput {
  db: D1Database;
  /** How many synthetic cases to judge per candidate. */
  caseCount: number;
  /** Returns `"candidate"` if the mutated prompt beats the original, else `"original"`. */
  judge: (args: {
    strategy: MutationKind;
    candidateDefinition: string;
    originalDefinition: string;
    caseIndex: number;
  }) => Promise<"candidate" | "original" | "tie">;
}

export interface ShadowPassResult {
  evaluated: number;
  suggested: number;
}

const SUGGEST_THRESHOLD = 0.6;

export async function runShadowEvalPass(input: ShadowPassInput): Promise<ShadowPassResult> {
  const rows = await input.db
    .prepare(
      `SELECT e.id, e.agent_version_id, e.strategy, e.candidate_definition_json,
              av.definition_json AS original_definition_json
         FROM agent_evolutions e
         JOIN agent_versions av ON av.id = e.agent_version_id
        WHERE e.shadow_case_count = 0
          AND e.accepted_at IS NULL
          AND e.rejected_at IS NULL
        ORDER BY e.created_at ASC
        LIMIT 100`,
    )
    .all<{
      id: string;
      agent_version_id: string;
      strategy: string;
      candidate_definition_json: string;
      original_definition_json: string;
    }>();

  let evaluated = 0;
  let suggested = 0;
  for (const row of rows.results ?? []) {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (let i = 0; i < input.caseCount; i++) {
      const verdict = await input.judge({
        strategy: row.strategy as MutationKind,
        candidateDefinition: row.candidate_definition_json,
        originalDefinition: row.original_definition_json,
        caseIndex: i,
      });
      if (verdict === "candidate") wins += 1;
      else if (verdict === "original") losses += 1;
      else ties += 1;
    }
    const trials = wins + losses; // ties don't count towards the ratio
    const winRate = trials > 0 ? wins / trials : 0;
    const nowMs = Date.now();
    const markSuggested = winRate >= SUGGEST_THRESHOLD;
    await input.db
      .prepare(
        `UPDATE agent_evolutions
            SET shadow_case_count = ?,
                shadow_wins = ?,
                shadow_losses = ?,
                shadow_ties = ?,
                win_rate = ?,
                suggested_at = ?
          WHERE id = ?`,
      )
      .bind(input.caseCount, wins, losses, ties, winRate, markSuggested ? nowMs : null, row.id)
      .run();
    evaluated += 1;
    if (markSuggested) suggested += 1;
  }

  return { evaluated, suggested };
}
