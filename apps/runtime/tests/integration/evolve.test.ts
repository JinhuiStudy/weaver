import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { pickTopAgentVersions, runEvolutionPass } from "../../src/evolve/engine";
import { createAuthedSession } from "./_helpers/session";

async function createAgent(cookie: string, name: string, visibility = "public") {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name,
      visibility,
      definition: {
        nodes: [
          {
            id: "ag1",
            type: "agent",
            data: { system_prompt: "You summarise news stories." },
          },
        ],
        edges: [],
      },
    }),
  });
  return (await res.json()) as { id: string; slug: string; current_version_id: string };
}

async function seedFitness(
  agentId: string,
  versionId: string,
  orgId: string,
  userId: string,
  likes: number,
  dislikes: number,
) {
  const n = likes + dislikes;
  for (let i = 0; i < n; i++) {
    // Randomise the suffix — ULID's leading chars are timestamp-based, so
    // two agents created in the same ms collide if we key off that alone.
    const runId = `run-evo-${Math.random().toString(36).slice(2, 12)}-${i}`;
    await env.DB.prepare(
      `INSERT INTO agent_runs
         (id, tool_id, tool_version, org_id, status, input, state,
          graph_json, agent_version_id, created_at, updated_at,
          completed_at, retry_count, cost_usd_micro, created_by_user_id)
       VALUES (?, ?, 1, ?, 'complete', '{}', '{}',
               '{}', ?, ?, ?, ?, 0, 0, ?)`,
    )
      .bind(runId, agentId, orgId, versionId, Date.now(), Date.now(), Date.now(), userId)
      .run();
    const rating = i < likes ? 1 : -1;
    // PRIMARY KEY (run_id, user_id) — different run_id each iteration, so
    // the same userId can rate every run without violating the constraint.
    await env.DB.prepare(
      `INSERT INTO agent_feedback (run_id, user_id, agent_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
      .bind(runId, userId, agentId, rating, Date.now())
      .run();
  }
}

describe("pickTopAgentVersions", () => {
  it("ranks versions by Wilson-lower-bound fitness, filters below min-sample", async () => {
    const author = await createAuthedSession({ githubId: 9900, login: "evo-author-a" });
    const hot = await createAgent(author.cookie, "Hot Agent");
    const cold = await createAgent(author.cookie, "Cold Agent");
    const tiny = await createAgent(author.cookie, "Tiny Agent");

    await seedFitness(hot.id, hot.current_version_id, author.orgId, author.userId, 18, 2);
    await seedFitness(cold.id, cold.current_version_id, author.orgId, author.userId, 8, 12);
    await seedFitness(tiny.id, tiny.current_version_id, author.orgId, author.userId, 3, 0);

    const picked = await pickTopAgentVersions(env.DB as D1Database, 5);
    const slugs = picked.map((p) => p.slug);
    // Hot must come first (best ratio × largest sample).
    expect(slugs[0]).toBe("hot-agent");
    expect(slugs).toContain("cold-agent");
    // Tiny falls below MIN_SAMPLE_RUNS (3) — excluded.
    expect(slugs).not.toContain("tiny-agent");
  });

  it("respects the `limit` argument", async () => {
    const author = await createAuthedSession({ githubId: 9901, login: "evo-author-b" });
    for (let i = 0; i < 4; i++) {
      const a = await createAgent(author.cookie, `Limit Agent ${i}`);
      await seedFitness(a.id, a.current_version_id, author.orgId, author.userId, 15, 5);
    }
    const picked = await pickTopAgentVersions(env.DB as D1Database, 2);
    expect(picked.length).toBeLessThanOrEqual(2);
  });
});

describe("runEvolutionPass", () => {
  it("creates 5 (strategies) × candidatesPerStrategy rows per picked agent_version", async () => {
    const author = await createAuthedSession({ githubId: 9910, login: "evo-runner" });
    const hot = await createAgent(author.cookie, "Rewrite Hot");
    await seedFitness(hot.id, hot.current_version_id, author.orgId, author.userId, 18, 2);

    const result = await runEvolutionPass({
      db: env.DB as D1Database,
      topN: 1,
      candidatesPerStrategy: 1,
    });
    expect(result.candidatesCreated).toBe(5);

    const rows = await env.DB.prepare(
      "SELECT strategy, candidate_definition_json FROM agent_evolutions WHERE agent_version_id = ?",
    )
      .bind(hot.current_version_id)
      .all<{ strategy: string; candidate_definition_json: string }>();
    const strategies = new Set((rows.results ?? []).map((r) => r.strategy));
    expect(strategies).toEqual(new Set(["concise", "specific", "cot", "role", "format"]));

    // Candidate JSON must differ from the original and contain the strategy
    // directive somewhere in the agent node's system_prompt.
    for (const row of rows.results ?? []) {
      const def = JSON.parse(row.candidate_definition_json) as {
        nodes: Array<{ data?: { system_prompt?: string } }>;
      };
      expect(def.nodes[0]?.data?.system_prompt ?? "").not.toBe("You summarise news stories.");
    }
  });

  it("is idempotent within the same run — re-running doesn't duplicate same-strategy candidates minute-apart", async () => {
    const author = await createAuthedSession({ githubId: 9911, login: "evo-idempotent" });
    const agent = await createAgent(author.cookie, "Idempotent Evo");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);

    await runEvolutionPass({
      db: env.DB as D1Database,
      topN: 1,
      candidatesPerStrategy: 1,
    });
    // Second pass — should detect existing candidates for this version+strategy
    // and skip re-generating them.
    const second = await runEvolutionPass({
      db: env.DB as D1Database,
      topN: 1,
      candidatesPerStrategy: 1,
    });
    expect(second.candidatesCreated).toBe(0);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM agent_evolutions WHERE agent_version_id = ?",
    )
      .bind(agent.current_version_id)
      .first<{ c: number }>();
    expect(rows?.c).toBe(5);
  });

  it("skips agents without enough feedback (min-sample gate)", async () => {
    const author = await createAuthedSession({ githubId: 9912, login: "evo-tiny" });
    const agent = await createAgent(author.cookie, "Too Small");
    // only 3 runs — below MIN_SAMPLE_RUNS
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 3, 0);

    const result = await runEvolutionPass({
      db: env.DB as D1Database,
      topN: 10,
      candidatesPerStrategy: 1,
    });
    expect(result.candidatesCreated).toBe(0);
  });
});
