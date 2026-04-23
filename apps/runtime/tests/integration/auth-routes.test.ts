import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifySession } from "../../src/auth/jwt";
import {
  resetGithubFetchImplForTests,
  SESSION_COOKIE,
  setGithubFetchImplForTests,
} from "../../src/auth/routes";

const SECRET = "test-session-secret-at-least-64-bytes-long-abcdefghijklmnopqrstuvwxyz";

type FetchArgs = [input: Request | URL | string, init?: RequestInit];

function parseSetCookies(
  header: string | null,
): Array<{ name: string; value: string; raw: string }> {
  if (!header) return [];
  return header.split(/,(?=[^;]+=[^;]+)/).map((raw) => {
    const first = raw.split(";")[0]?.trim() ?? "";
    const eq = first.indexOf("=");
    return {
      name: first.slice(0, eq),
      value: first.slice(eq + 1),
      raw: raw.trim(),
    };
  });
}

afterEach(() => {
  resetGithubFetchImplForTests();
});

describe("GET /auth/github", () => {
  it("redirects to GitHub authorize URL and sets oauth_state cookie", async () => {
    const res = await SELF.fetch("http://runtime.test/auth/github", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    const authorize = new URL(location ?? "");
    expect(authorize.origin).toBe("https://github.com");
    expect(authorize.pathname).toBe("/login/oauth/authorize");
    expect(authorize.searchParams.get("client_id")).toBe("test-client-id");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "http://runtime.test/auth/github/callback",
    );
    expect(authorize.searchParams.get("scope")).toBe("read:user user:email");
    const state = authorize.searchParams.get("state");
    expect(state).toBeTruthy();

    const cookies = parseSetCookies(res.headers.get("set-cookie"));
    const stateCookie = cookies.find((c) => c.name === "oauth_state");
    expect(stateCookie?.value).toBe(state);
    expect(stateCookie?.raw).toMatch(/HttpOnly/i);
    expect(stateCookie?.raw).toMatch(/SameSite=Lax/i);
  });
});

describe("GET /auth/github/callback · state validation", () => {
  it("returns 400 when state query is absent", async () => {
    const res = await SELF.fetch("http://runtime.test/auth/github/callback?code=x", {
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie state and query state mismatch", async () => {
    const res = await SELF.fetch("http://runtime.test/auth/github/callback?code=x&state=bad", {
      headers: { cookie: "oauth_state=good" },
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when cookie is missing", async () => {
    const res = await SELF.fetch("http://runtime.test/auth/github/callback?code=x&state=any", {
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /auth/github/callback · happy path", () => {
  beforeEach(() => {
    setGithubFetchImplForTests((async (...args: FetchArgs) => {
      const url = String(args[0]);
      if (url === "https://github.com/login/oauth/access_token") {
        return new Response(JSON.stringify({ access_token: "gho_testtoken" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "https://api.github.com/user") {
        return new Response(
          JSON.stringify({
            id: 9999,
            login: "integration-user",
            email: "integration@example.com",
            name: "Integration User",
            avatar_url: "https://avatars/9999.png",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected mock fetch url: ${url}`);
    }) as unknown as typeof fetch);
  });

  it("exchanges code, upserts user + org, sets weaver_session, redirects to FRONTEND_URL", async () => {
    const state = "csrf-state-happy";
    const res = await SELF.fetch(
      `http://runtime.test/auth/github/callback?code=real-code&state=${state}`,
      {
        headers: { cookie: `oauth_state=${state}` },
        redirect: "manual",
      },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://web.test/");

    const cookies = parseSetCookies(res.headers.get("set-cookie"));
    const session = cookies.find((c) => c.name === SESSION_COOKIE);
    expect(session).toBeTruthy();
    expect(session?.raw).toMatch(/HttpOnly/i);
    expect(session?.raw).toMatch(/SameSite=Lax/i);

    // Signed JWT decodes back to the user we just upserted.
    const payload = await verifySession(session?.value ?? "", SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.handle).toBe("integration-user");

    const userRow = await env.DB.prepare("SELECT id, handle, email FROM users WHERE github_id = ?")
      .bind(9999)
      .first<{ id: string; handle: string; email: string }>();
    expect(userRow?.handle).toBe("integration-user");
    expect(userRow?.email).toBe("integration@example.com");
    expect(userRow?.id).toBe(payload?.sub);

    const orgRow = await env.DB.prepare(
      "SELECT id, slug FROM orgs WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1",
    )
      .bind(userRow?.id)
      .first<{ id: string; slug: string }>();
    expect(orgRow?.slug).toBe("integration-user-personal");
    expect(orgRow?.id).toBe(payload?.org);
  });
});

describe("POST /auth/logout", () => {
  it("responds 200 and clears weaver_session cookie", async () => {
    const res = await SELF.fetch("http://runtime.test/auth/logout", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const cookies = parseSetCookies(res.headers.get("set-cookie"));
    const session = cookies.find((c) => c.name === SESSION_COOKIE);
    expect(session?.value).toBe("");
  });
});
