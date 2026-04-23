import type { MiddlewareHandler } from "hono";

const MS_PER_DAY = 86_400_000;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  cap: number;
  resetAt: number;
};

/**
 * Atomically increments the per-user daily counter for `resource` and returns
 * whether the caller is still under `cap`. A single `INSERT ... ON CONFLICT`
 * keeps this race-safe under concurrent Cron + HTTP traffic — D1 serializes
 * the upsert at the row level.
 *
 * `windowStartMs` is the Unix-day bucket; exposing `now` as an argument (not
 * a side effect) makes the function pure and unit-testable.
 */
export async function bumpAndCheck(
  db: D1Database,
  userId: string,
  resource: string,
  cap: number,
  nowMs: number,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(nowMs / MS_PER_DAY);
  await db
    .prepare(
      `INSERT INTO rate_limits (user_id, resource, window_start, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, resource, window_start)
       DO UPDATE SET count = count + 1`,
    )
    .bind(userId, resource, windowStart)
    .run();

  const row = await db
    .prepare(
      `SELECT count FROM rate_limits
       WHERE user_id = ? AND resource = ? AND window_start = ?`,
    )
    .bind(userId, resource, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  const resetAt = (windowStart + 1) * MS_PER_DAY;
  return { allowed: count <= cap, count, cap, resetAt };
}

/**
 * Middleware factory: enforces a per-user daily cap for `resource`. Must be
 * mounted *after* `sessionMiddleware()` and `requireAuth()` — we read the
 * session to identify the caller.
 *
 * Adds `X-RateLimit-Remaining` and `X-RateLimit-Reset` to every response.
 * On overflow: 429 JSON + `Retry-After` header with seconds until the next
 * day bucket.
 */
export function requireRateLimit(resource: string, cap: number): MiddlewareHandler {
  return async (c, next) => {
    const session = c.get("session");
    const db = (c.env as { DB?: D1Database }).DB;
    if (!session || !db) return next();

    const now = Date.now();
    const result = await bumpAndCheck(db, session.sub, resource, cap, now);

    const remaining = Math.max(0, cap - result.count);
    c.res.headers.set("X-RateLimit-Remaining", String(remaining));
    c.res.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "rate limit exceeded",
          resource,
          cap,
          count: result.count,
          reset_at: Math.floor(result.resetAt / 1000),
        },
        429,
      );
    }

    return next();
  };
}
