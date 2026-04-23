import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { SessionPayload } from "./jwt";
import { verifySession } from "./jwt";
import { SESSION_COOKIE } from "./routes";

export type AuthSession = SessionPayload;

export type AuthBindings = {
  WEAVER_SESSION_SECRET?: string;
};

/**
 * Publish `session` to Hono's global `ContextVariableMap` so every
 * `c.get("session")` is typed as `AuthSession | null` across the app —
 * no per-generic wiring on `new Hono<...>()`.
 */
declare module "hono" {
  interface ContextVariableMap {
    session: AuthSession | null;
  }
}

/**
 * Runs on every request: look for a `weaver_session` cookie, verify the
 * HS256 JWT, stash the payload on `c.set("session", ...)` (or null if
 * missing / invalid / expired). Never short-circuits — routes decide for
 * themselves whether the request needs auth via `requireAuth()`.
 */
export function sessionMiddleware(): MiddlewareHandler<{ Bindings: AuthBindings }> {
  return async (c, next) => {
    const secret = c.env.WEAVER_SESSION_SECRET;
    const token = getCookie(c, SESSION_COOKIE);
    if (!secret || !token) {
      c.set("session", null);
    } else {
      const payload = await verifySession(token, secret);
      c.set("session", payload);
    }
    await next();
  };
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "authentication required" }, 401);
    }
    return next();
  };
}
