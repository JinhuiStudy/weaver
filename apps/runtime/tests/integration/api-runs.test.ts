import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * POST /api/runs integration: boot the real Hono Worker + D1 sandbox and
 * verify a row is actually written. This catches bugs that the mocked
 * AiBinding / stubbed fetch tests can't — e.g. SQL syntax errors, binding
 * mismatches, Hono route typos.
 */
describe("POST /api/runs · D1 integration", () => {
  it("inserts a pending agent_runs row and returns its id", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool_id: "demo", input: { order_id: "ord_42" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string; tool_id: string };
    expect(body.status).toBe("pending");
    expect(body.tool_id).toBe("demo");
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/); // crypto.randomUUID()

    const row = await env.DB.prepare("SELECT * FROM agent_runs WHERE id = ?").bind(body.id).first<{
      id: string;
      tool_id: string;
      status: string;
      input: string;
      state: string;
    }>();
    expect(row).not.toBeNull();
    expect(row?.tool_id).toBe("demo");
    expect(row?.status).toBe("pending");
    expect(JSON.parse(row?.input ?? "{}")).toEqual({ order_id: "ord_42" });
  });

  it("rejects a body without tool_id", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
