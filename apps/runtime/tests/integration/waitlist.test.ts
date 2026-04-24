import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("POST /api/waitlist", () => {
  it("records a new signup and returns 200 with the stored row's id", async () => {
    const res = await SELF.fetch("https://runtime.test/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", source: "home" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; email: string; source: string };
    expect(body.email).toBe("a@example.com");
    expect(body.source).toBe("home");
    expect(body.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const row = await env.DB.prepare(
      "SELECT id FROM waitlist_signups WHERE email = ? AND source = ?",
    )
      .bind("a@example.com", "home")
      .first<{ id: string }>();
    expect(row?.id).toBe(body.id);
  });

  it("is idempotent — second submit of the same (email, source) returns the same id", async () => {
    const once = await SELF.fetch("https://runtime.test/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "b@example.com", source: "home" }),
    });
    const twice = await SELF.fetch("https://runtime.test/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "b@example.com", source: "home" }),
    });
    const o = (await once.json()) as { id: string };
    const t = (await twice.json()) as { id: string };
    expect(t.id).toBe(o.id);
  });

  it("rejects obviously invalid emails with 400", async () => {
    for (const email of ["", "not-email", "  @  ", `${"a".repeat(250)}@x.io`]) {
      const res = await SELF.fetch("https://runtime.test/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      expect(res.status).toBe(400);
    }
  });

  it("rejects unknown source values with 400", async () => {
    const res = await SELF.fetch("https://runtime.test/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "c@example.com", source: "mystery-zone" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON body with 400", async () => {
    const res = await SELF.fetch("https://runtime.test/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    expect(res.status).toBe(400);
  });
});
