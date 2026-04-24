import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signSession } from "../../src/auth/jwt";
import { createAuthedSession, TEST_SESSION_SECRET } from "./_helpers/session";

describe("GET /api/me", () => {
  it("returns 401 for anonymous requests", async () => {
    const res = await SELF.fetch("https://runtime.test/api/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a forged cookie (wrong signature)", async () => {
    const forged =
      "weaver_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMUpVU0VSMDAwMDAwMDAwMDAwMDAwMDAwIiwib3JnIjoiMDFKT1JHMDAwMDAwMDAwMDAwMDAwMDAwMCIsImhhbmRsZSI6ImhhY2tlciIsImlhdCI6MSwiZXhwIjo5OTk5OTk5OTk5fQ.INVALIDSIG";
    const res = await SELF.fetch("https://runtime.test/api/me", {
      headers: { cookie: forged },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired session", async () => {
    const session = await createAuthedSession({ githubId: 700, login: "expiry-test" });
    // Mint a token that's already 1s past exp.
    const expired = await signSession(
      { sub: session.userId, org: session.orgId, handle: session.handle },
      TEST_SESSION_SECRET,
      -1,
      Math.floor(Date.now() / 1000) - 10,
    );
    const res = await SELF.fetch("https://runtime.test/api/me", {
      headers: { cookie: `weaver_session=${expired}` },
    });
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user and default org", async () => {
    const session = await createAuthedSession({
      githubId: 800,
      login: "me-endpoint",
      email: "me@example.com",
      name: "Me User",
    });
    const res = await SELF.fetch("https://runtime.test/api/me", {
      headers: { cookie: session.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; handle: string; email: string | null };
      org: { id: string; slug: string };
    };
    expect(body.user.id).toBe(session.userId);
    expect(body.user.handle).toBe("me-endpoint");
    expect(body.user.email).toBe("me@example.com");
    expect(body.org.id).toBe(session.orgId);
    expect(body.org.slug).toBe("me-endpoint-personal");
  });

  it("includes today's Free-tier quota (neurons + runs) starting at 0/50 and 0/10", async () => {
    const session = await createAuthedSession({ githubId: 810, login: "fresh-quota" });
    const res = await SELF.fetch("https://runtime.test/api/me", {
      headers: { cookie: session.cookie },
    });
    const body = (await res.json()) as {
      quota: {
        neurons: { used: number; cap: number; remaining: number };
        runs: { used: number; cap: number; remaining: number };
      };
    };
    expect(body.quota.neurons.cap).toBe(50);
    expect(body.quota.neurons.used).toBe(0);
    expect(body.quota.neurons.remaining).toBe(50);
    expect(body.quota.runs.cap).toBe(10);
    expect(body.quota.runs.used).toBe(0);
    expect(body.quota.runs.remaining).toBe(10);
  });

  it("runs quota.used climbs by 1 for each /api/runs creation", async () => {
    const session = await createAuthedSession({ githubId: 811, login: "quota-climb" });
    // Consume 3 runs.
    for (let i = 0; i < 3; i++) {
      await SELF.fetch("https://runtime.test/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ tool_id: "demo" }),
      });
    }
    const res = await SELF.fetch("https://runtime.test/api/me", {
      headers: { cookie: session.cookie },
    });
    const body = (await res.json()) as {
      quota: { runs: { used: number; remaining: number } };
    };
    expect(body.quota.runs.used).toBe(3);
    expect(body.quota.runs.remaining).toBe(7);
  });
});
