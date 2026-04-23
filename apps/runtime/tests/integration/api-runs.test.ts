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

describe("GET /health · smoke", () => {
  it("returns ok", async () => {
    const res = await SELF.fetch("https://runtime.test/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
