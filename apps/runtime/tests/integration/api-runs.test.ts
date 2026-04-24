import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

/**
 * POST /api/runs integration: boot the real Hono Worker + D1 sandbox and
 * verify a row is actually written. This catches bugs that the mocked
 * AiBinding / stubbed fetch tests can't — e.g. SQL syntax errors, binding
 * mismatches, Hono route typos.
 *
 * Sprint 0 D3: every /api/runs call must present a `weaver_session` cookie.
 * `org_id` is taken from the session, not the request body — we test that
 * a spoofed body `org_id` is ignored.
 */
describe("POST /api/runs · auth", () => {
  it("rejects an anonymous request with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    expect(res.status).toBe(401);
  });

  it("inserts a pending agent_runs row scoped to the session's user + org", async () => {
    const session = await createAuthedSession({ githubId: 500, login: "runner" });

    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo", input: { order_id: "ord_42" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string; tool_id: string };
    expect(body.status).toBe("pending");
    expect(body.tool_id).toBe("demo");

    const row = await env.DB.prepare("SELECT * FROM agent_runs WHERE id = ?").bind(body.id).first<{
      id: string;
      tool_id: string;
      status: string;
      input: string;
      org_id: string;
      created_by_user_id: string;
    }>();
    expect(row?.tool_id).toBe("demo");
    expect(row?.status).toBe("pending");
    expect(JSON.parse(row?.input ?? "{}")).toEqual({ order_id: "ord_42" });
    expect(row?.org_id).toBe(session.orgId);
    expect(row?.created_by_user_id).toBe(session.userId);
  });

  it("ignores a spoofed body.org_id and uses the session's default org", async () => {
    const session = await createAuthedSession({ githubId: 501, login: "spoofer" });
    const victim = await createAuthedSession({ githubId: 502, login: "victim" });

    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo", org_id: victim.orgId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };

    const row = await env.DB.prepare(
      "SELECT org_id, created_by_user_id FROM agent_runs WHERE id = ?",
    )
      .bind(body.id)
      .first<{ org_id: string; created_by_user_id: string }>();
    expect(row?.org_id).toBe(session.orgId);
    expect(row?.org_id).not.toBe(victim.orgId);
    expect(row?.created_by_user_id).toBe(session.userId);
  });

  it("rejects a body without tool_id (with valid session)", async () => {
    const session = await createAuthedSession({ githubId: 503, login: "sessioned" });
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON (with valid session)", async () => {
    const session = await createAuthedSession({ githubId: 504, login: "jsonfail" });
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: "{not really json",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/runs · Sprint 2 trace_id", () => {
  it("stamps a fresh OTEL trace id onto the row and returns it", async () => {
    const session = await createAuthedSession({ githubId: 600, login: "tracer-stamp" });
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    const body = (await res.json()) as { id: string; trace_id: string };
    expect(body.trace_id).toMatch(/^[0-9a-f]{32}$/);

    const row = await env.DB.prepare("SELECT trace_id FROM agent_runs WHERE id = ?")
      .bind(body.id)
      .first<{ trace_id: string | null }>();
    expect(row?.trace_id).toBe(body.trace_id);
  });
});

describe("GET /api/runs · caller's recent runs", () => {
  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs");
    expect(res.status).toBe(401);
  });

  it("returns only runs from the caller's org, newest first", async () => {
    const a = await createAuthedSession({ githubId: 700, login: "run-a" });
    const b = await createAuthedSession({ githubId: 701, login: "run-b" });

    async function enqueue(cookie: string) {
      const res = await SELF.fetch("https://runtime.test/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ tool_id: "demo" }),
      });
      return (await res.json()) as { id: string };
    }

    const aRun1 = await enqueue(a.cookie);
    await enqueue(b.cookie);
    const aRun2 = await enqueue(a.cookie);

    const listRes = await SELF.fetch("https://runtime.test/api/runs", {
      headers: { cookie: a.cookie },
    });
    expect(listRes.status).toBe(200);
    const { runs } = (await listRes.json()) as { runs: Array<{ id: string }> };
    const ids = runs.map((r) => r.id);
    expect(ids).toContain(aRun1.id);
    expect(ids).toContain(aRun2.id);
    // B's runs are invisible to A.
    expect(ids.every((id) => id !== "")).toBe(true);
    // Newest first — aRun2 is more recent than aRun1.
    expect(ids.indexOf(aRun2.id)).toBeLessThan(ids.indexOf(aRun1.id));
  });
});

describe("GET /api/runs/:id · run detail + history timeline", () => {
  it("returns the run + empty history when no steps have executed yet", async () => {
    const session = await createAuthedSession({ githubId: 710, login: "detail-pre" });
    const post = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    const { id } = (await post.json()) as { id: string };

    const res = await SELF.fetch(`https://runtime.test/api/runs/${id}`, {
      headers: { cookie: session.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      run: { id: string; status: string; trace_id: string };
      history: unknown[];
    };
    expect(body.run.id).toBe(id);
    expect(body.run.status).toBe("pending");
    expect(body.run.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(body.history).toEqual([]);
  });

  it("returns history rows in ascending order after cron ticks", async () => {
    const session = await createAuthedSession({ githubId: 720, login: "ticker" });

    const linearGraph = {
      nodes: [
        { id: "in", type: "input" },
        { id: "out", type: "output" },
      ],
      edges: [{ id: "e1", source: { node_id: "in" }, target: { node_id: "out" } }],
    };
    const post = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo", graph: linearGraph }),
    });
    const { id } = (await post.json()) as { id: string };

    // Three ticks to walk pending → running(in) → running(out) → complete.
    for (let i = 0; i < 3; i++) {
      await SELF.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" });
    }

    const res = await SELF.fetch(`https://runtime.test/api/runs/${id}`, {
      headers: { cookie: session.cookie },
    });
    const body = (await res.json()) as {
      run: { status: string };
      history: Array<{ node_id: string; duration_ms: number; span_id: string | null }>;
    };
    expect(body.run.status).toBe("complete");
    expect(body.history.length).toBeGreaterThanOrEqual(1);
    // Every history row carries a span_id (set by tickOnce).
    expect(body.history.every((h) => h.span_id && /^[0-9a-f]{16}$/.test(h.span_id))).toBe(true);
  });

  it("returns 404 for a run that belongs to another org", async () => {
    const a = await createAuthedSession({ githubId: 730, login: "own-a" });
    const b = await createAuthedSession({ githubId: 731, login: "own-b" });
    const post = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: a.cookie },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    const { id } = (await post.json()) as { id: string };

    const res = await SELF.fetch(`https://runtime.test/api/runs/${id}`, {
      headers: { cookie: b.cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /health · smoke", () => {
  it("returns ok", async () => {
    const res = await SELF.fetch("https://runtime.test/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
