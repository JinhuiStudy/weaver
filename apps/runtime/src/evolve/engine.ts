import {
  applyMutation,
  computeFitness,
  MIN_SAMPLE_RUNS,
  MUTATION_STRATEGIES,
  type MutationKind,
  newId,
} from "@weaver/core";

/**
 * Evolution orchestrator — ADR-008.
 *
 * Every daily cron tick invokes `runEvolutionPass`, which:
 *   1. Picks the top-N public agent_versions by fitness (min 10 runs).
 *   2. For each version, runs every mutation strategy + `candidatesPerStrategy`
 *      copies, writing the mutated definition into `agent_evolutions`.
 *   3. Skips pairs that already have a candidate (idempotent by
 *      (agent_version_id, strategy, candidateIndex-as-id)).
 *
 * Shadow eval (pairwise compare candidate vs original) lives in a separate
 * cron pass — this file is the generate-step only. Stays AI-binding-free so
 * it can run in Playwright's dev fallback and in unit integration tests.
 */

export interface EvoVersion {
  agent_version_id: string;
  agent_id: string;
  slug: string;
  handle: string;
  run_count: number;
  likes: number;
  dislikes: number;
  fitness: number;
}

export async function pickTopAgentVersions(db: D1Database, limit: number): Promise<EvoVersion[]> {
  // Aggregate run counts + feedback per version, join with user handle for
  // logging. We filter to public/unlisted and MIN_SAMPLE_RUNS client-side
  // after computing fitness (so the Wilson formula lives in one place).
  const rows = await db
    .prepare(
      `SELECT
          av.id        AS agent_version_id,
          av.agent_id  AS agent_id,
          a.slug       AS slug,
          u.handle     AS handle,
          (SELECT COUNT(*) FROM agent_runs r WHERE r.agent_version_id = av.id AND r.status = 'complete')      AS run_count,
          (SELECT COUNT(*) FROM agent_feedback f WHERE f.agent_id = av.agent_id AND f.rating = 1)             AS likes,
          (SELECT COUNT(*) FROM agent_feedback f WHERE f.agent_id = av.agent_id AND f.rating = -1)            AS dislikes
        FROM agent_versions av
        JOIN agents a ON a.id = av.agent_id
        JOIN users  u ON u.id = a.creator_user_id
       WHERE a.visibility IN ('public', 'unlisted')
         AND av.id = a.current_version_id`,
    )
    .all<{
      agent_version_id: string;
      agent_id: string;
      slug: string;
      handle: string;
      run_count: number;
      likes: number;
      dislikes: number;
    }>();

  const ranked: EvoVersion[] = [];
  for (const row of rows.results ?? []) {
    if (row.run_count < MIN_SAMPLE_RUNS) continue;
    const f = computeFitness({
      runCount: row.run_count,
      likes: row.likes,
      dislikes: row.dislikes,
    });
    if (f === null) continue;
    ranked.push({ ...row, fitness: f });
  }
  ranked.sort((a, b) => b.fitness - a.fitness);
  return ranked.slice(0, Math.max(0, limit));
}

export interface RunPassInput {
  db: D1Database;
  topN: number;
  candidatesPerStrategy: number;
  /**
   * Optional LLM rewriter. When present, each candidate's seed prompt is
   * handed to the LLM along with the strategy directive. When absent, the
   * deterministic `applyMutation` transform is used verbatim — still useful
   * in tests and as a fallback when Workers AI is down.
   */
  rewritePrompt?: (args: { original: string; kind: MutationKind }) => Promise<string>;
  /** Filter on specific strategies; defaults to all 5. */
  only?: MutationKind[];
}

export interface RunPassResult {
  picked: EvoVersion[];
  candidatesCreated: number;
}

export async function runEvolutionPass(input: RunPassInput): Promise<RunPassResult> {
  const picked = await pickTopAgentVersions(input.db, input.topN);
  let created = 0;

  for (const version of picked) {
    const defRow = await input.db
      .prepare("SELECT definition_json FROM agent_versions WHERE id = ?")
      .bind(version.agent_version_id)
      .first<{ definition_json: string }>();
    if (!defRow) continue;

    let parsedDefinition: {
      nodes?: Array<{
        type?: string;
        data?: { system_prompt?: string; [key: string]: unknown };
        [key: string]: unknown;
      }>;
      edges?: unknown[];
    };
    try {
      parsedDefinition = JSON.parse(defRow.definition_json);
    } catch {
      continue;
    }

    const agentNode = (parsedDefinition.nodes ?? []).find((n) => n?.type === "agent");
    const seedPrompt =
      (agentNode?.data as { system_prompt?: string } | undefined)?.system_prompt ?? "";
    if (!seedPrompt) continue;

    const strategies = input.only ?? MUTATION_STRATEGIES.map((s) => s.kind);
    for (const kind of strategies) {
      // Idempotency guard: if any row exists for (version, strategy), skip.
      // Future work can extend to per-candidate_index.
      const existing = await input.db
        .prepare(
          "SELECT id FROM agent_evolutions WHERE agent_version_id = ? AND strategy = ? LIMIT 1",
        )
        .bind(version.agent_version_id, kind)
        .first();
      if (existing) continue;

      for (let i = 0; i < input.candidatesPerStrategy; i++) {
        const baseMutated = applyMutation(seedPrompt, kind);
        const rewritten = input.rewritePrompt
          ? await input.rewritePrompt({ original: seedPrompt, kind })
          : baseMutated;

        const candidateDef = {
          ...parsedDefinition,
          nodes: (parsedDefinition.nodes ?? []).map((n) => {
            if (n?.type !== "agent" || (n === agentNode) === false) {
              // only mutate the first agent node
            }
            if (n === agentNode) {
              return {
                ...n,
                data: {
                  ...(n.data ?? {}),
                  system_prompt: rewritten,
                },
              };
            }
            return n;
          }),
        };

        await input.db
          .prepare(
            `INSERT INTO agent_evolutions
               (id, agent_version_id, strategy, candidate_definition_json, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(newId(), version.agent_version_id, kind, JSON.stringify(candidateDef), Date.now())
          .run();
        created += 1;
      }
    }
  }

  return { picked, candidatesCreated: created };
}
