import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

/**
 * Sprint 0 D5: /api/runs is capped at 10/day per user. We drain the quota,
 * hit the cap, and verify the 429 response + Retry-After header contract.
 */
describe("POST /api/runs · rate limit", () => {
  it("returns 429 on the 11th request and sets Retry-After", async () => {
    const session = await createAuthedSession({ githubId: 9001, login: "flooder" });

    for (let i = 0; i < 10; i++) {
      const res = await SELF.fetch("https://runtime.test/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ tool_id: "demo" }),
      });
      expect(res.status).toBe(200);
      expect(Number(res.headers.get("x-ratelimit-remaining"))).toBe(10 - (i + 1));
    }

    const overflow = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    expect(overflow.status).toBe(429);
    expect(Number(overflow.headers.get("retry-after"))).toBeGreaterThan(0);

    const body = (await overflow.json()) as { error: string; cap: number };
    expect(body.error).toMatch(/rate limit/i);
    expect(body.cap).toBe(10);
  });

  it("scopes the counter per user (one user's cap doesn't block another)", async () => {
    const heavy = await createAuthedSession({ githubId: 9100, login: "heavy" });
    const light = await createAuthedSession({ githubId: 9101, login: "light" });

    // Drain heavy to the cap.
    for (let i = 0; i < 10; i++) {
      await SELF.fetch("https://runtime.test/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: heavy.cookie },
        body: JSON.stringify({ tool_id: "demo" }),
      });
    }

    // Light's first call still succeeds.
    const lightRes = await SELF.fetch("https://runtime.test/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: light.cookie },
      body: JSON.stringify({ tool_id: "demo" }),
    });
    expect(lightRes.status).toBe(200);
  });

  it("persists the counter in the rate_limits table keyed by (user, resource, day)", async () => {
    const session = await createAuthedSession({ githubId: 9200, login: "counter" });
    for (let i = 0; i < 3; i++) {
      await SELF.fetch("https://runtime.test/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ tool_id: "demo" }),
      });
    }
    const day = Math.floor(Date.now() / 86_400_000);
    const row = await env.DB.prepare(
      `SELECT count FROM rate_limits WHERE user_id = ? AND resource = ? AND window_start = ?`,
    )
      .bind(session.userId, "runs", day)
      .first<{ count: number }>();
    expect(row?.count).toBe(3);
  });
});
