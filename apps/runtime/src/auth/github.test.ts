import { describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCode, fetchGithubProfile } from "./github";

describe("buildAuthorizeUrl()", () => {
  it("returns the GitHub authorize endpoint with all params URL-encoded", () => {
    const url = buildAuthorizeUrl({
      clientId: "Ov23liXXX",
      state: "csrf-token-abc",
      redirectUri: "http://localhost:8787/auth/github/callback",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("Ov23liXXX");
    expect(parsed.searchParams.get("state")).toBe("csrf-token-abc");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8787/auth/github/callback",
    );
    expect(parsed.searchParams.get("scope")).toBe("read:user user:email");
  });

  it("honors custom scope", () => {
    const url = buildAuthorizeUrl({
      clientId: "x",
      state: "y",
      redirectUri: "https://example/cb",
      scope: "read:user",
    });
    expect(new URL(url).searchParams.get("scope")).toBe("read:user");
  });
});

describe("exchangeCode()", () => {
  it("POSTs code + client_id + client_secret to the token endpoint and returns access_token", async () => {
    const fetchImpl = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      expect(String(input)).toBe("https://github.com/login/oauth/access_token");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("accept")).toBe("application/json");
      expect(headers.get("content-type")).toBe("application/json");
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        client_id: "id",
        client_secret: "secret",
        code: "abc",
        redirect_uri: "http://localhost:8787/cb",
      });
      return new Response(
        JSON.stringify({ access_token: "gho_test", scope: "read:user", token_type: "bearer" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const out = await exchangeCode({
      code: "abc",
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://localhost:8787/cb",
      fetchImpl,
    });
    expect(out.accessToken).toBe("gho_test");
  });

  it("throws when GitHub returns an error body", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "bad_verification_code", error_description: "..." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    await expect(
      exchangeCode({
        code: "x",
        clientId: "i",
        clientSecret: "s",
        redirectUri: "http://x",
        fetchImpl,
      }),
    ).rejects.toThrow(/bad_verification_code/);
  });

  it("throws on non-2xx", async () => {
    const fetchImpl = (async () =>
      new Response("boom", { status: 500 })) as unknown as typeof fetch;
    await expect(
      exchangeCode({
        code: "x",
        clientId: "i",
        clientSecret: "s",
        redirectUri: "http://x",
        fetchImpl,
      }),
    ).rejects.toThrow(/500/);
  });
});

describe("fetchGithubProfile()", () => {
  it("returns profile with email when /user includes one", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          id: 1234,
          login: "jinhui",
          email: "dev@example.com",
          name: "박진희",
          avatar_url: "https://avatars.githubusercontent.com/u/1234",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const profile = await fetchGithubProfile({ accessToken: "gho_x", fetchImpl });
    expect(profile.id).toBe(1234);
    expect(profile.login).toBe("jinhui");
    expect(profile.email).toBe("dev@example.com");
    expect(profile.name).toBe("박진희");
    expect(profile.avatar_url).toBe("https://avatars.githubusercontent.com/u/1234");
  });

  it("falls back to /user/emails primary+verified when /user.email is null", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: Request | URL | string) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://api.github.com/user") {
        return new Response(
          JSON.stringify({ id: 5, login: "alice", email: null, name: null, avatar_url: null }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url === "https://api.github.com/user/emails") {
        return new Response(
          JSON.stringify([
            { email: "secondary@x.com", primary: false, verified: true },
            { email: "primary@x.com", primary: true, verified: true },
            { email: "unverified@x.com", primary: false, verified: false },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    }) as unknown as typeof fetch;

    const profile = await fetchGithubProfile({ accessToken: "gho_x", fetchImpl });
    expect(calls).toEqual(["https://api.github.com/user", "https://api.github.com/user/emails"]);
    expect(profile.email).toBe("primary@x.com");
  });

  it("returns email null when /user/emails has no primary+verified", async () => {
    const fetchImpl = (async (input: Request | URL | string) => {
      const url = String(input);
      if (url === "https://api.github.com/user") {
        return new Response(
          JSON.stringify({ id: 5, login: "alice", email: null, name: null, avatar_url: null }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const profile = await fetchGithubProfile({ accessToken: "x", fetchImpl });
    expect(profile.email).toBeNull();
  });

  it("throws when /user fails", async () => {
    const fetchImpl = (async () =>
      new Response("denied", { status: 401 })) as unknown as typeof fetch;
    await expect(fetchGithubProfile({ accessToken: "x", fetchImpl })).rejects.toThrow(/401/);
  });
});
