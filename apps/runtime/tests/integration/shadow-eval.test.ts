import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runEvolutionPass } from "../../src/evolve/engine";
import { runShadowEvalPass } from "../../src/evolve/shadow";
import { createAuthedSession } from "./_helpers/session";

async function createAgent(cookie: string, name: string) {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name,
      definition: {
        nodes: [
          {
            id: "ag1",
            type: "agent",
            data: { system_prompt: "You summarise news." },
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
    const runId = `sh-${Math.random().toString(36).slice(2, 12)}-${i}`;
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
    await env.DB.prepare(
      `INSERT INTO agent_feedback (run_id, user_id, agent_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
      .bind(runId, userId, agentId, rating, Date.now())
      .run();
  }
}

describe("runShadowEvalPass", () => {
  it("fills win_rate + shadow_* counters for every unseen candidate, marks ≥ 0.6 as suggested", async () => {
    const author = await createAuthedSession({ githubId: 11000, login: "shadow-author" });
    const agent = await createAgent(author.cookie, "Shadow Target");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 18, 2);
    await runEvolutionPass({
      db: env.DB as D1Database,
      topN: 1,
      candidatesPerStrategy: 1,
    });

    // Deterministic judge: every strategy except "format" wins 3/4, format loses 1/4.
    const result = await runShadowEvalPass({
      db: env.DB as D1Database,
      caseCount: 4,
      judge: async ({ strategy }) => (strategy === "format" ? "original" : "candidate"),
    });
    expect(result.evaluated).toBe(5);
    expect(result.suggested).toBeGreaterThanOrEqual(4);

    const rows = await env.DB.prepare(
      "SELECT strategy, shadow_case_count, shadow_wins, shadow_losses, win_rate, suggested_at FROM agent_evolutions WHERE agent_version_id = ?",
    )
      .bind(agent.current_version_id)
      .all<{
        strategy: string;
        shadow_case_count: number;
        shadow_wins: number;
        shadow_losses: number;
        win_rate: number;
        suggested_at: number | null;
      }>();

    for (const row of rows.results ?? []) {
      expect(row.shadow_case_count).toBe(4);
      if (row.strategy === "format") {
        expect(row.shadow_wins).toBe(0);
        expect(row.win_rate).toBe(0);
        expect(row.suggested_at).toBeNull();
      } else {
        expect(row.shadow_wins).toBe(4);
        expect(row.win_rate).toBe(1);
        expect(row.suggested_at).not.toBeNull();
      }
    }
  });

  it("is idempotent — repeated passes don't re-score already-evaluated candidates", async () => {
    const author = await createAuthedSession({ githubId: 11001, login: "shadow-idempotent" });
    const agent = await createAgent(author.cookie, "Idempotent Shadow");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });

    await runShadowEvalPass({
      db: env.DB as D1Database,
      caseCount: 2,
      judge: async () => "candidate",
    });
    const second = await runShadowEvalPass({
      db: env.DB as D1Database,
      caseCount: 2,
      judge: async () => "candidate",
    });
    expect(second.evaluated).toBe(0);
  });
});

describe("POST /api/evolutions/:id/accept", () => {
  it("creates a new agent_version · swaps current · marks evolution accepted_at", async () => {
    const author = await createAuthedSession({ githubId: 11100, login: "accept-author" });
    const agent = await createAgent(author.cookie, "Accept Target");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });
    await runShadowEvalPass({
      db: env.DB as D1Database,
      caseCount: 4,
      judge: async () => "candidate",
    });

    const pick = await env.DB.prepare(
      "SELECT id FROM agent_evolutions WHERE agent_version_id = ? LIMIT 1",
    )
      .bind(agent.current_version_id)
      .first<{ id: string }>();
    const evoId = pick?.id ?? "";

    const res = await SELF.fetch(`https://runtime.test/api/evolutions/${evoId}/accept`, {
      method: "POST",
      headers: { cookie: author.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      new_version_id: string;
      new_version: number;
      agent_id: string;
    };
    expect(body.new_version).toBe(2);
    expect(body.agent_id).toBe(agent.id);

    const updated = await env.DB.prepare("SELECT current_version_id FROM agents WHERE id = ?")
      .bind(agent.id)
      .first<{ current_version_id: string }>();
    expect(updated?.current_version_id).toBe(body.new_version_id);

    const evoRow = await env.DB.prepare(
      "SELECT accepted_at, accepted_version_id FROM agent_evolutions WHERE id = ?",
    )
      .bind(evoId)
      .first<{ accepted_at: number | null; accepted_version_id: string | null }>();
    expect(evoRow?.accepted_at).not.toBeNull();
    expect(evoRow?.accepted_version_id).toBe(body.new_version_id);
  });

  it("rejects a non-creator with 403", async () => {
    const author = await createAuthedSession({ githubId: 11101, login: "accept-owner" });
    const stranger = await createAuthedSession({ githubId: 11102, login: "accept-stranger" });
    const agent = await createAgent(author.cookie, "Hands Off");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });
    const pick = await env.DB.prepare(
      "SELECT id FROM agent_evolutions WHERE agent_version_id = ? LIMIT 1",
    )
      .bind(agent.current_version_id)
      .first<{ id: string }>();
    const evoId = pick?.id ?? "";

    const res = await SELF.fetch(`https://runtime.test/api/evolutions/${evoId}/accept`, {
      method: "POST",
      headers: { cookie: stranger.cookie },
    });
    expect(res.status).toBe(403);
  });

  it("refuses to accept an already-accepted evolution (409)", async () => {
    const author = await createAuthedSession({ githubId: 11103, login: "double-accept" });
    const agent = await createAgent(author.cookie, "No Double");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });
    const pick = await env.DB.prepare(
      "SELECT id FROM agent_evolutions WHERE agent_version_id = ? LIMIT 1",
    )
      .bind(agent.current_version_id)
      .first<{ id: string }>();
    const evoId = pick?.id ?? "";

    await SELF.fetch(`https://runtime.test/api/evolutions/${evoId}/accept`, {
      method: "POST",
      headers: { cookie: author.cookie },
    });
    const second = await SELF.fetch(`https://runtime.test/api/evolutions/${evoId}/accept`, {
      method: "POST",
      headers: { cookie: author.cookie },
    });
    expect(second.status).toBe(409);
  });
});

describe("POST /api/evolutions/:id/reject", () => {
  it("marks rejected_at and leaves agents.current_version_id untouched", async () => {
    const author = await createAuthedSession({ githubId: 11200, login: "reject-author" });
    const agent = await createAgent(author.cookie, "Reject Target");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });
    const pick = await env.DB.prepare(
      "SELECT id FROM agent_evolutions WHERE agent_version_id = ? LIMIT 1",
    )
      .bind(agent.current_version_id)
      .first<{ id: string }>();
    const evoId = pick?.id ?? "";

    const res = await SELF.fetch(`https://runtime.test/api/evolutions/${evoId}/reject`, {
      method: "POST",
      headers: { cookie: author.cookie },
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT rejected_at FROM agent_evolutions WHERE id = ?")
      .bind(evoId)
      .first<{ rejected_at: number | null }>();
    expect(row?.rejected_at).not.toBeNull();
    const agentRow = await env.DB.prepare("SELECT current_version_id FROM agents WHERE id = ?")
      .bind(agent.id)
      .first<{ current_version_id: string }>();
    // Still the original version.
    expect(agentRow?.current_version_id).toBe(agent.current_version_id);
  });
});

describe("GET /api/agents/:id/evolutions", () => {
  it("creator lists suggestions for their agent", async () => {
    const author = await createAuthedSession({ githubId: 11300, login: "evo-list" });
    const agent = await createAgent(author.cookie, "List Target");
    await seedFitness(agent.id, agent.current_version_id, author.orgId, author.userId, 15, 5);
    await runEvolutionPass({ db: env.DB as D1Database, topN: 1, candidatesPerStrategy: 1 });
    await runShadowEvalPass({
      db: env.DB as D1Database,
      caseCount: 4,
      judge: async () => "candidate",
    });

    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/evolutions`, {
      headers: { cookie: author.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      evolutions: Array<{ strategy: string; win_rate: number | null; suggested_at: number | null }>;
    };
    expect(body.evolutions.length).toBe(5);
    for (const e of body.evolutions) {
      expect(e.win_rate).toBeGreaterThan(0);
      expect(e.suggested_at).not.toBeNull();
    }
  });

  it("rejects non-creator with 404", async () => {
    const author = await createAuthedSession({ githubId: 11301, login: "evo-hidden" });
    const stranger = await createAuthedSession({ githubId: 11302, login: "evo-stranger" });
    const agent = await createAgent(author.cookie, "Only Mine");
    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/evolutions`, {
      headers: { cookie: stranger.cookie },
    });
    expect(res.status).toBe(404);
  });
});
