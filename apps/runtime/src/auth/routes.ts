import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { buildAuthorizeUrl, exchangeCode, fetchGithubProfile } from "./github";
import { signSession } from "./jwt";
import { upsertUserFromGithub } from "./upsert";

export type AuthEnv = {
  DB?: D1Database;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  WEAVER_SESSION_SECRET?: string;
  FRONTEND_URL?: string;
  // The URL GitHub will redirect to after authorize. Set explicitly per env
  // because the runtime sits behind the web worker's /auth proxy — using
  // `c.req.url` here would produce a runtime-host callback that never gets
  // back through the proxy for cookie-on-web-origin delivery.
  AUTH_CALLBACK_URL?: string;
};

/**
 * Integration tests stub the outbound fetch to github.com by replacing this
 * module-level function. Production code never touches it; `fetch` is the
 * Workers runtime default.
 */
let githubFetchImpl: typeof fetch = fetch;
export function setGithubFetchImplForTests(impl: typeof fetch): void {
  githubFetchImpl = impl;
}
export function resetGithubFetchImplForTests(): void {
  githubFetchImpl = fetch;
}

export const SESSION_COOKIE = "weaver_session";
export const OAUTH_STATE_COOKIE = "oauth_state";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d
const STATE_TTL_SECONDS = 10 * 60; // 10m

function isSecure(requestUrl: string): boolean {
  return new URL(requestUrl).protocol === "https:";
}

function callbackUrl(env: AuthEnv, requestUrl: string): string {
  return env.AUTH_CALLBACK_URL ?? new URL("/auth/github/callback", requestUrl).toString();
}

function frontendRedirect(env: AuthEnv, requestUrl: string): string {
  return env.FRONTEND_URL ?? new URL("/", requestUrl).toString();
}

export function mountAuthRoutes(app: Hono<{ Bindings: AuthEnv }>): void {
  app.get("/auth/github", (c) => {
    const clientId = c.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) return c.json({ error: "oauth not configured" }, 503);

    const state = crypto.randomUUID();
    setCookie(c, OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      sameSite: "Lax",
      path: "/auth/github",
      maxAge: STATE_TTL_SECONDS,
    });

    return c.redirect(
      buildAuthorizeUrl({
        clientId,
        state,
        redirectUri: callbackUrl(c.env, c.req.url),
      }),
      302,
    );
  });

  app.get("/auth/github/callback", async (c) => {
    const clientId = c.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = c.env.GITHUB_OAUTH_CLIENT_SECRET;
    const sessionSecret = c.env.WEAVER_SESSION_SECRET;
    const db = c.env.DB;
    if (!clientId || !clientSecret || !sessionSecret || !db) {
      return c.json({ error: "auth not configured" }, 503);
    }

    const code = c.req.query("code");
    const stateQuery = c.req.query("state");
    const stateCookie = getCookie(c, OAUTH_STATE_COOKIE) ?? null;
    if (!code || !stateQuery || !stateCookie || stateQuery !== stateCookie) {
      return c.json({ error: "invalid oauth state" }, 400);
    }
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/auth/github" });

    let accessToken: string;
    try {
      const result = await exchangeCode({
        code,
        clientId,
        clientSecret,
        redirectUri: callbackUrl(c.env, c.req.url),
        fetchImpl: githubFetchImpl,
      });
      accessToken = result.accessToken;
    } catch (err) {
      return c.json({ error: "oauth exchange failed", detail: String(err) }, 400);
    }

    let profile: Awaited<ReturnType<typeof fetchGithubProfile>>;
    try {
      profile = await fetchGithubProfile({ accessToken, fetchImpl: githubFetchImpl });
    } catch (err) {
      return c.json({ error: "github profile fetch failed", detail: String(err) }, 502);
    }

    const upserted = await upsertUserFromGithub(db, profile);

    const jwt = await signSession(
      {
        sub: upserted.user.id,
        org: upserted.defaultOrg.id,
        handle: upserted.user.handle,
      },
      sessionSecret,
      SESSION_TTL_SECONDS,
    );

    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: isSecure(c.req.url),
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return c.redirect(frontendRedirect(c.env, c.req.url), 302);
  });

  app.post("/auth/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });
}
