import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

async function createAgent(cookie: string, name: string, visibility = "public") {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name, visibility, definition: { nodes: [], edges: [] } }),
  });
  return (await res.json()) as { id: string; slug: string; current_version_id: string };
}

async function seedOutput(
  agentId: string,
  versionId: string,
  orgId: string,
  userId: string,
  contentText: string,
  tMs: number,
) {
  const runId = `run-sub-${Math.random().toString(36).slice(2, 10)}`;
  await env.DB.prepare(
    `INSERT INTO agent_runs
       (id, tool_id, tool_version, org_id, status, input, state,
        graph_json, agent_version_id, created_at, updated_at,
        completed_at, retry_count, cost_usd_micro, created_by_user_id)
     VALUES (?, ?, 1, ?, 'complete', '{}', '{}',
             '{}', ?, ?, ?, ?, 0, 0, ?)`,
  )
    .bind(runId, agentId, orgId, versionId, tMs, tMs, tMs, userId)
    .run();
  await env.DB.prepare(
    `INSERT INTO agent_outputs (id, agent_id, agent_version_id, run_id, output_json, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `out-${Math.random().toString(36).slice(2, 10)}`,
      agentId,
      versionId,
      runId,
      JSON.stringify({ summary: contentText }),
      tMs,
    )
    .run();
  return runId;
}

describe("POST /api/agents/:id/subscribe · toggle", () => {
  it("rejects anonymous callers with 401", async () => {
    const res = await SELF.fetch(
      "https://runtime.test/api/agents/01JNOBODY00000000000000000/subscribe",
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("creates a subscription the first time, removes it on the second call (toggle)", async () => {
    const author = await createAuthedSession({ githubId: 9301, login: "sub-author" });
    const reader = await createAuthedSession({ githubId: 9302, login: "sub-reader" });
    const agent = await createAgent(author.cookie, "Daily News");

    const r1 = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/subscribe`, {
      method: "POST",
      headers: { cookie: reader.cookie },
    });
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as { subscribed: boolean };
    expect(b1.subscribed).toBe(true);

    // DB has the row.
    const row = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND agent_id = ?",
    )
      .bind(reader.userId, agent.id)
      .first();
    expect(row).toBeTruthy();

    // Second POST toggles off.
    const r2 = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/subscribe`, {
      method: "POST",
      headers: { cookie: reader.cookie },
    });
    const b2 = (await r2.json()) as { subscribed: boolean };
    expect(b2.subscribed).toBe(false);

    const row2 = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND agent_id = ?",
    )
      .bind(reader.userId, agent.id)
      .first();
    expect(row2).toBeNull();
  });

  it("blocks subscribing to a private agent with 403", async () => {
    const author = await createAuthedSession({ githubId: 9303, login: "private-sub-author" });
    const reader = await createAuthedSession({ githubId: 9304, login: "blocked-reader" });
    const agent = await createAgent(author.cookie, "Hidden", "private");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/subscribe`, {
      method: "POST",
      headers: { cookie: reader.cookie },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent agent", async () => {
    const reader = await createAuthedSession({ githubId: 9305, login: "ghost-reader" });
    const res = await SELF.fetch(
      "https://runtime.test/api/agents/01JNOTEXIST000000000000000/subscribe",
      { method: "POST", headers: { cookie: reader.cookie } },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/me/feed · aggregated timeline", () => {
  it("returns newest outputs from agents the caller subscribed to", async () => {
    const author = await createAuthedSession({ githubId: 9400, login: "feed-author-a" });
    const other = await createAuthedSession({ githubId: 9401, login: "feed-author-b" });
    const reader = await createAuthedSession({ githubId: 9402, login: "feed-reader" });

    const a = await createAgent(author.cookie, "Morning");
    const b = await createAgent(other.cookie, "Night");
    const noSub = await createAgent(author.cookie, "Not Subscribed");

    await seedOutput(
      a.id,
      a.current_version_id,
      author.orgId,
      author.userId,
      "morning-1",
      Date.now() - 5_000,
    );
    await seedOutput(
      b.id,
      b.current_version_id,
      other.orgId,
      other.userId,
      "night-1",
      Date.now() - 2_000,
    );
    await seedOutput(
      noSub.id,
      noSub.current_version_id,
      author.orgId,
      author.userId,
      "shouldnt-see",
      Date.now() - 1_000,
    );

    // Subscribe reader to a + b only.
    for (const id of [a.id, b.id]) {
      await SELF.fetch(`https://runtime.test/api/agents/${id}/subscribe`, {
        method: "POST",
        headers: { cookie: reader.cookie },
      });
    }

    const res = await SELF.fetch("https://runtime.test/api/me/feed", {
      headers: { cookie: reader.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        agent_handle: string;
        agent_slug: string;
        content_text: string;
        published_at: number;
      }>;
    };
    const texts = body.items.map((i) => i.content_text);
    expect(texts).toContain("night-1");
    expect(texts).toContain("morning-1");
    expect(texts).not.toContain("shouldnt-see");
    // Newest first: night-1 (more recent) precedes morning-1.
    expect(texts.indexOf("night-1")).toBeLessThan(texts.indexOf("morning-1"));
    expect(body.items[0]?.agent_handle).toBe("feed-author-b");
    expect(body.items[0]?.agent_slug).toBe("night");
  });

  it("returns empty list when the user subscribes to nothing", async () => {
    const reader = await createAuthedSession({ githubId: 9403, login: "empty-reader" });
    const res = await SELF.fetch("https://runtime.test/api/me/feed", {
      headers: { cookie: reader.cookie },
    });
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("rejects anonymous callers with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/me/feed");
    expect(res.status).toBe(401);
  });
});
