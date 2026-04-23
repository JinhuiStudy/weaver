import { env } from "cloudflare:test";
import { signSession } from "../../../src/auth/jwt";
import { upsertUserFromGithub } from "../../../src/auth/upsert";

/**
 * Must match vitest.integration.config.ts > miniflare.bindings.WEAVER_SESSION_SECRET.
 * Tests that forge cookies directly need the same key the worker verifies with.
 */
export const TEST_SESSION_SECRET =
  "test-session-secret-at-least-64-bytes-long-abcdefghijklmnopqrstuvwxyz";

export async function createAuthedSession(params: {
  githubId?: number;
  login?: string;
  email?: string | null;
  name?: string | null;
}): Promise<{
  cookie: string;
  userId: string;
  orgId: string;
  handle: string;
}> {
  const result = await upsertUserFromGithub(env.DB, {
    id: params.githubId ?? 12345,
    login: params.login ?? "tester",
    email: params.email ?? null,
    name: params.name ?? null,
    avatar_url: null,
  });
  const jwt = await signSession(
    {
      sub: result.user.id,
      org: result.defaultOrg.id,
      handle: result.user.handle,
    },
    TEST_SESSION_SECRET,
    3600,
  );
  return {
    cookie: `weaver_session=${jwt}`,
    userId: result.user.id,
    orgId: result.defaultOrg.id,
    handle: result.user.handle,
  };
}
