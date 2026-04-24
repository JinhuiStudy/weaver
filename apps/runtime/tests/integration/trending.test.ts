import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

async function createAgent(cookie: string, name: string, category?: string) {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name,
      category,
      definition: { nodes: [], edges: [] },
    }),
  });
  return (await res.json()) as { id: string; slug: string; current_version_id: string };
}

async function seedRun(
  agentId: string,
  versionId: string,
  orgId: string,
  userId: string,
  createdAtMs: number,
) {
  const runId = `trend-${Math.random().toString(36).slice(2, 12)}`;
  await env.DB.prepare(
    `INSERT INTO agent_runs
       (id, tool_id, tool_version, org_id, status, input, state,
        graph_json, agent_version_id, created_at, updated_at,
        completed_at, retry_count, cost_usd_micro, created_by_user_id)
     VALUES (?, ?, 1, ?, 'complete', '{}', '{}',
             '{}', ?, ?, ?, ?, 0, 0, ?)`,
  )
    .bind(runId, agentId, orgId, versionId, createdAtMs, createdAtMs, createdAtMs, userId)
    .run();
}

describe("GET /api/public/agents/trending", () => {
  it("ranks by recent run count within the 24h window by default", async () => {
    const author = await createAuthedSession({ githubId: 12000, login: "trending-author" });
    const hot = await createAgent(author.cookie, "Hot");
    const mid = await createAgent(author.cookie, "Mid");
    const stale = await createAgent(author.cookie, "Stale");

    const now = Date.now();
    const hour = 3_600_000;
    const day = 24 * hour;
    for (let i = 0; i < 10; i++) {
      await seedRun(hot.id, hot.current_version_id, author.orgId, author.userId, now - i * hour);
    }
    for (let i = 0; i < 5; i++) {
      await seedRun(mid.id, mid.current_version_id, author.orgId, author.userId, now - i * hour);
    }
    for (let i = 0; i < 20; i++) {
      // stale - all runs 3 days ago → out of 24h window
      await seedRun(
        stale.id,
        stale.current_version_id,
        author.orgId,
        author.userId,
        now - 3 * day - i * hour,
      );
    }

    const res = await SELF.fetch("https://runtime.test/api/public/agents/trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      window: string;
      agents: Array<{ slug: string; run_count: number }>;
    };
    expect(body.window).toBe("24h");
    const slugs = body.agents.map((a) => a.slug);
    expect(slugs[0]).toBe("hot");
    expect(slugs[1]).toBe("mid");
    // stale is filtered out (no runs in 24h)
    expect(slugs).not.toContain("stale");
  });

  it("accepts window=7d · includes runs from the last 7 days", async () => {
    const author = await createAuthedSession({ githubId: 12001, login: "trending-week" });
    const a = await createAgent(author.cookie, "Week Agent");
    const now = Date.now();
    const day = 24 * 3_600_000;
    for (let i = 0; i < 3; i++) {
      await seedRun(a.id, a.current_version_id, author.orgId, author.userId, now - (i + 1) * day);
    }
    const res = await SELF.fetch("https://runtime.test/api/public/agents/trending?window=7d");
    const body = (await res.json()) as {
      window: string;
      agents: Array<{ slug: string; run_count: number }>;
    };
    expect(body.window).toBe("7d");
    const found = body.agents.find((x) => x.slug === "week-agent");
    expect(found?.run_count).toBe(3);
  });

  it("filters by category", async () => {
    const author = await createAuthedSession({ githubId: 12002, login: "trending-cat" });
    const n = await createAgent(author.cookie, "News Cat", "news");
    const p = await createAgent(author.cookie, "Prod Cat", "productivity");
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await seedRun(n.id, n.current_version_id, author.orgId, author.userId, now - i * 3_600_000);
      await seedRun(p.id, p.current_version_id, author.orgId, author.userId, now - i * 3_600_000);
    }
    const res = await SELF.fetch("https://runtime.test/api/public/agents/trending?category=news");
    const body = (await res.json()) as { agents: Array<{ slug: string; category: string | null }> };
    const slugs = body.agents.map((a) => a.slug);
    expect(slugs).toContain("news-cat");
    expect(slugs).not.toContain("prod-cat");
  });

  it("rejects unknown window values with 400", async () => {
    const res = await SELF.fetch("https://runtime.test/api/public/agents/trending?window=nonsense");
    expect(res.status).toBe(400);
  });

  it("works without authentication", async () => {
    const res = await SELF.fetch("https://runtime.test/api/public/agents/trending");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/public/agents/new", () => {
  it("returns the most recently created public agents", async () => {
    const author = await createAuthedSession({ githubId: 12100, login: "newest-author" });
    await createAgent(author.cookie, "First");
    await createAgent(author.cookie, "Second");
    await createAgent(author.cookie, "Latest");

    const res = await SELF.fetch("https://runtime.test/api/public/agents/new");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agents: Array<{ slug: string; handle: string }>;
    };
    const slugs = body.agents.map((a) => a.slug);
    // "latest" is the newest created.
    expect(slugs[0]).toBe("latest");
    expect(slugs).toContain("first");
    expect(slugs).toContain("second");
    expect(slugs.indexOf("latest")).toBeLessThan(slugs.indexOf("first"));
    // Row returned with handle so the UI can build @handle/slug links.
    expect(body.agents[0]?.handle).toBe("newest-author");
  });
});
