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

async function enqueueRun(cookie: string, toolId: string) {
  const res = await SELF.fetch("https://runtime.test/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      tool_id: toolId,
      graph: {
        nodes: [
          { id: "in", type: "input" },
          { id: "out", type: "output" },
        ],
        edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
      },
    }),
  });
  return (await res.json()) as { id: string };
}

async function forkAgent(cookie: string, id: string) {
  const res = await SELF.fetch(`https://runtime.test/api/agents/${id}/fork`, {
    method: "POST",
    headers: { cookie },
  });
  return (await res.json()) as { id: string; slug: string };
}

describe("POST /api/runs/:id/feedback", () => {
  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs/01JNOTHING/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("records a 👍 against a public agent's run and returns the stored row", async () => {
    const author = await createAuthedSession({ githubId: 9600, login: "fb-author" });
    const rater = await createAuthedSession({ githubId: 9601, login: "fb-rater" });
    const agent = await createAgent(author.cookie, "Fitness Test");
    const run = await enqueueRun(rater.cookie, agent.id);
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    const res = await SELF.fetch(`https://runtime.test/api/runs/${run.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: rater.cookie },
      body: JSON.stringify({ rating: 1, comment: "nice!" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      run_id: string;
      rating: number;
      comment: string | null;
      agent_id: string;
    };
    expect(body.rating).toBe(1);
    expect(body.comment).toBe("nice!");
    expect(body.agent_id).toBe(agent.id);

    const row = await env.DB.prepare(
      "SELECT rating, comment FROM agent_feedback WHERE run_id = ? AND user_id = ?",
    )
      .bind(run.id, rater.userId)
      .first<{ rating: number; comment: string | null }>();
    expect(row?.rating).toBe(1);
    expect(row?.comment).toBe("nice!");
  });

  it("overwrites the same user's prior rating (change 👎 → 👍)", async () => {
    const author = await createAuthedSession({ githubId: 9602, login: "fb-overwrite-auth" });
    const rater = await createAuthedSession({ githubId: 9603, login: "fb-overwrite" });
    const agent = await createAgent(author.cookie, "Update Test");
    const run = await enqueueRun(rater.cookie, agent.id);
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    for (const rating of [-1, 1]) {
      await SELF.fetch(`https://runtime.test/api/runs/${run.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: rater.cookie },
        body: JSON.stringify({ rating }),
      });
    }

    const row = await env.DB.prepare(
      "SELECT rating FROM agent_feedback WHERE run_id = ? AND user_id = ?",
    )
      .bind(run.id, rater.userId)
      .first<{ rating: number }>();
    expect(row?.rating).toBe(1);
  });

  it("rejects invalid rating values with 400", async () => {
    const author = await createAuthedSession({ githubId: 9604, login: "bad-rating-auth" });
    const rater = await createAuthedSession({ githubId: 9605, login: "bad-rating" });
    const agent = await createAgent(author.cookie, "Bad Rate");
    const run = await enqueueRun(rater.cookie, agent.id);
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    const res = await SELF.fetch(`https://runtime.test/api/runs/${run.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: rater.cookie },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(res.status).toBe(400);
  });

  it("refuses feedback on a run that belongs to a non-public agent (404)", async () => {
    const author = await createAuthedSession({ githubId: 9606, login: "priv-fb-auth" });
    const rater = await createAuthedSession({ githubId: 9607, login: "priv-fb-rater" });
    const agent = await createAgent(author.cookie, "Private", "private");
    const run = await enqueueRun(author.cookie, agent.id); // author's own run
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    const res = await SELF.fetch(`https://runtime.test/api/runs/${run.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: rater.cookie },
      body: JSON.stringify({ rating: 1 }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a run id that doesn't exist", async () => {
    const rater = await createAuthedSession({ githubId: 9608, login: "ghost-rater" });
    const res = await SELF.fetch(
      "https://runtime.test/api/runs/01JGHOSTGHOSTGHOSTGHOSTGH/feedback",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: rater.cookie },
        body: JSON.stringify({ rating: 1 }),
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/agents/:h/:s/stats", () => {
  it("reports likes/dislikes/ratio/fork count/subscriber count", async () => {
    const author = await createAuthedSession({ githubId: 9700, login: "stats-author" });
    const a = await createAuthedSession({ githubId: 9701, login: "stats-rater-a" });
    const b = await createAuthedSession({ githubId: 9702, login: "stats-rater-b" });
    const c = await createAuthedSession({ githubId: 9703, login: "stats-rater-c" });
    const forker = await createAuthedSession({ githubId: 9704, login: "stats-forker" });

    const agent = await createAgent(author.cookie, "Stats Probe");

    // Seed 3 feedback rows: 2× 👍, 1× 👎.
    for (const rater of [a, b, c]) {
      const run = await enqueueRun(rater.cookie, agent.id);
      await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
        .bind(agent.current_version_id, run.id)
        .run();
      await SELF.fetch(`https://runtime.test/api/runs/${run.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: rater.cookie },
        body: JSON.stringify({ rating: rater === c ? -1 : 1 }),
      });
    }

    // 1 subscriber + 1 forker.
    await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/subscribe`, {
      method: "POST",
      headers: { cookie: a.cookie },
    });
    await forkAgent(forker.cookie, agent.id);

    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/stats-author/${agent.slug}/stats`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      likes: number;
      dislikes: number;
      ratio: number;
      fork_count: number;
      subscriber_count: number;
    };
    expect(body.likes).toBe(2);
    expect(body.dislikes).toBe(1);
    expect(body.ratio).toBeCloseTo(2 / 3, 3);
    expect(body.fork_count).toBe(1);
    expect(body.subscriber_count).toBe(1);
  });

  it("returns zeros for a new agent with no activity", async () => {
    const author = await createAuthedSession({ githubId: 9710, login: "empty-stats" });
    const agent = await createAgent(author.cookie, "No Activity");
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/empty-stats/${agent.slug}/stats`,
    );
    const body = (await res.json()) as {
      likes: number;
      dislikes: number;
      ratio: number;
      fork_count: number;
      subscriber_count: number;
    };
    expect(body.likes).toBe(0);
    expect(body.dislikes).toBe(0);
    // ratio for 0/0 is null — caller should treat as "not rated yet".
    expect(body.ratio).toBeNull();
    expect(body.fork_count).toBe(0);
    expect(body.subscriber_count).toBe(0);
  });

  it("returns 404 for a private agent (no public stats leak)", async () => {
    const author = await createAuthedSession({ githubId: 9711, login: "private-stats" });
    const agent = await createAgent(author.cookie, "Hidden Stats", "private");
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/private-stats/${agent.slug}/stats`,
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/agents/:h/:s/genealogy", () => {
  it("returns ancestor chain + direct children (depth 2)", async () => {
    const origin = await createAuthedSession({ githubId: 9800, login: "tree-origin" });
    const mid = await createAuthedSession({ githubId: 9801, login: "tree-mid" });
    const leafA = await createAuthedSession({ githubId: 9802, login: "tree-leaf-a" });
    const leafB = await createAuthedSession({ githubId: 9803, login: "tree-leaf-b" });

    const root = await createAgent(origin.cookie, "Root Agent");
    const forked1 = await forkAgent(mid.cookie, root.id);
    const _leafFromForked1 = await forkAgent(leafA.cookie, forked1.id);
    // Second fork line off root.
    const _siblingFork = await forkAgent(leafB.cookie, root.id);

    // Query from the middle node — expect 1 ancestor (root) + 1 descendant (leaf).
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/tree-mid/${forked1.slug}/genealogy`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      current: { id: string; handle: string; slug: string };
      ancestors: Array<{ id: string; handle: string; slug: string; depth: number }>;
      descendants: Array<{ id: string; handle: string; slug: string; depth: number }>;
    };
    expect(body.current.handle).toBe("tree-mid");
    expect(body.ancestors).toHaveLength(1);
    expect(body.ancestors[0]?.handle).toBe("tree-origin");
    expect(body.ancestors[0]?.depth).toBe(1);

    expect(body.descendants.length).toBeGreaterThanOrEqual(1);
    expect(body.descendants.some((d) => d.handle === "tree-leaf-a")).toBe(true);
  });

  it("root agent · empty ancestors, siblings not included", async () => {
    const origin = await createAuthedSession({ githubId: 9810, login: "tree-solo-origin" });
    const mid = await createAuthedSession({ githubId: 9811, login: "tree-solo-mid" });
    const root = await createAgent(origin.cookie, "Solo Root");
    await forkAgent(mid.cookie, root.id);

    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/tree-solo-origin/${root.slug}/genealogy`,
    );
    const body = (await res.json()) as {
      ancestors: unknown[];
      descendants: Array<{ handle: string }>;
    };
    expect(body.ancestors).toEqual([]);
    expect(body.descendants.some((d) => d.handle === "tree-solo-mid")).toBe(true);
  });

  it("returns 404 for a private agent", async () => {
    const author = await createAuthedSession({ githubId: 9820, login: "tree-private" });
    const agent = await createAgent(author.cookie, "Private Tree", "private");
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/tree-private/${agent.slug}/genealogy`,
    );
    expect(res.status).toBe(404);
  });
});
