import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

/**
 * Sprint 3 D1/D2: agent_outputs + JSON Feed.
 *
 * The terminal step of a run — when the state-machine transitions into
 * `complete` and the last visited node is an `output` node — should also
 * produce one `agent_outputs` row. That row is what /@h/s/feed.json paginates.
 *
 * Private agents' runs stay in run_history only; their outputs never land
 * in the feed table.
 */

const linearGraph = {
  nodes: [
    { id: "in", type: "input" },
    { id: "out", type: "output" },
  ],
  edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
};

async function createAgent(cookie: string, name: string, visibility = "public") {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name,
      visibility,
      definition: { nodes: [], edges: [] },
    }),
  });
  return (await res.json()) as { id: string; slug: string; current_version_id: string };
}

async function enqueueRun(cookie: string, toolId: string) {
  const res = await SELF.fetch("https://runtime.test/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ tool_id: toolId, graph: linearGraph }),
  });
  return (await res.json()) as { id: string; trace_id: string };
}

async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
  }
}

describe("cron · agent_outputs materialisation on complete", () => {
  it("writes one agent_outputs row when a public agent's run reaches complete", async () => {
    const session = await createAuthedSession({ githubId: 9100, login: "feed-author" });
    const agent = await createAgent(session.cookie, "Feed Test");
    const run = await enqueueRun(session.cookie, agent.id);

    // Attach the run to the agent_version so agent_outputs has a valid FK.
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    // 3 ticks: pending → running(in) → running(out) → complete.
    await tick(3);

    const rows = await env.DB.prepare(
      "SELECT id, agent_id, agent_version_id, run_id, output_json, published_at FROM agent_outputs WHERE run_id = ?",
    )
      .bind(run.id)
      .all<{
        id: string;
        agent_id: string;
        agent_version_id: string;
        run_id: string;
        output_json: string;
        published_at: number;
      }>();
    expect(rows.results).toHaveLength(1);
    const row = rows.results?.[0];
    expect(row?.agent_id).toBe(agent.id);
    expect(row?.agent_version_id).toBe(agent.current_version_id);
    expect(row?.published_at).toBeGreaterThan(0);
    // output_json is valid JSON (the run.state snapshot).
    expect(() => JSON.parse(row?.output_json ?? "")).not.toThrow();
  });

  it("does NOT write to agent_outputs when the agent is private", async () => {
    const session = await createAuthedSession({ githubId: 9101, login: "private-run" });
    const agent = await createAgent(session.cookie, "Private", "private");
    const run = await enqueueRun(session.cookie, agent.id);
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();

    await tick(3);

    const rows = await env.DB.prepare("SELECT id FROM agent_outputs WHERE run_id = ?")
      .bind(run.id)
      .all();
    expect(rows.results).toHaveLength(0);
  });

  it("does NOT write when the run's tool_id isn't a saved agent (free-form builder runs)", async () => {
    const session = await createAuthedSession({ githubId: 9102, login: "freeform" });
    // tool_id is a non-ULID → no agents row matches → skip.
    const run = await enqueueRun(session.cookie, "demo-freeform");
    await tick(3);
    const rows = await env.DB.prepare("SELECT id FROM agent_outputs WHERE run_id = ?")
      .bind(run.id)
      .all();
    expect(rows.results).toHaveLength(0);
  });

  it("is idempotent — repeated scheduled() invocations don't duplicate the row", async () => {
    const session = await createAuthedSession({ githubId: 9103, login: "idempotent-feed" });
    const agent = await createAgent(session.cookie, "Idempotent");
    const run = await enqueueRun(session.cookie, agent.id);
    await env.DB.prepare("UPDATE agent_runs SET agent_version_id = ? WHERE id = ?")
      .bind(agent.current_version_id, run.id)
      .run();
    await tick(5); // way more ticks than needed
    const rows = await env.DB.prepare("SELECT id FROM agent_outputs WHERE run_id = ?")
      .bind(run.id)
      .all();
    expect(rows.results).toHaveLength(1);
  });
});

describe("GET /@handle/slug/feed.json · public JSON Feed 1.1", () => {
  it("returns a JSON Feed document for a public agent, newest first", async () => {
    const session = await createAuthedSession({ githubId: 9200, login: "feeder" });
    const agent = await createAgent(session.cookie, "Hourly Brief");

    // Seed two completed runs manually (skip cron).
    for (const i of [1, 2]) {
      const runId = `run-feed-${i}`;
      await env.DB.prepare(
        `INSERT INTO agent_runs
          (id, tool_id, tool_version, org_id, status, input, state,
           graph_json, agent_version_id, created_at, updated_at,
           completed_at, retry_count, cost_usd_micro, created_by_user_id)
         VALUES (?, ?, 1, ?, 'complete', '{}', '{}',
                 '{}', ?, ?, ?, ?, 0, 0, ?)`,
      )
        .bind(
          runId,
          agent.id,
          "test-org",
          agent.current_version_id,
          Date.now() - (3 - i) * 1000,
          Date.now() - (3 - i) * 1000,
          Date.now() - (3 - i) * 1000,
          session.userId,
        )
        .run();
      await env.DB.prepare(
        `INSERT INTO agent_outputs
           (id, agent_id, agent_version_id, run_id, output_json, published_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          `out-${i}`,
          agent.id,
          agent.current_version_id,
          runId,
          JSON.stringify({ summary: `item #${i}` }),
          Date.now() - (3 - i) * 1000,
        )
        .run();
    }

    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/feeder/${agent.slug}/feed.json`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/(feed\+)?json/);

    const body = (await res.json()) as {
      version: string;
      title: string;
      home_page_url: string;
      feed_url: string;
      items: Array<{ id: string; date_published: string; content_text?: string; url?: string }>;
    };
    expect(body.version).toBe("https://jsonfeed.org/version/1.1");
    expect(body.title).toContain("Hourly Brief");
    expect(body.feed_url).toContain(`/feed.json`);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    // Newest first — item #2 precedes item #1.
    const firstContent = body.items[0]?.content_text ?? "";
    const secondContent = body.items[1]?.content_text ?? "";
    expect(firstContent).toContain("#2");
    expect(secondContent).toContain("#1");
  });

  it("returns 404 for a private agent's feed", async () => {
    const session = await createAuthedSession({ githubId: 9201, login: "secret-feeder" });
    const agent = await createAgent(session.cookie, "Hidden", "private");
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/secret-feeder/${agent.slug}/feed.json`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when agent doesn't exist", async () => {
    const res = await SELF.fetch("https://runtime.test/api/public/agents/nobody/ghost/feed.json");
    expect(res.status).toBe(404);
  });
});
