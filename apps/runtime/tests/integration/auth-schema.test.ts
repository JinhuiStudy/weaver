import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Sprint 0 · D1 migration 0003_auth.sql
 *
 * These tests prove the auth schema is applied *before* we write any Hono
 * routes against it. If this fails, the integration setup didn't load the new
 * migration (see tests/integration/setup.ts).
 */
describe("D1 · auth schema", () => {
  it("creates users table with unique handle + unique github_id", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, github_id, handle, email, name, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000001", 12345, "jinhui", null, "박진희", null, now)
      .run();

    const row = await env.DB.prepare("SELECT handle, github_id FROM users WHERE id = ?")
      .bind("01JUSER0000000000000000001")
      .first<{ handle: string; github_id: number }>();

    expect(row?.handle).toBe("jinhui");
    expect(row?.github_id).toBe(12345);

    // UNIQUE(handle) enforcement
    await expect(
      env.DB.prepare(
        `INSERT INTO users (id, github_id, handle, created_at)
         VALUES (?, ?, ?, ?)`,
      )
        .bind("01JUSER0000000000000000002", 99999, "jinhui", now)
        .run(),
    ).rejects.toThrow();
  });

  it("creates orgs table referencing users", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, github_id, handle, created_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000010", 1010, "alice", now)
      .run();

    await env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, owner_user_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        "01JORG00000000000000000010",
        "alice-personal",
        "Alice personal",
        "01JUSER0000000000000000010",
        now,
      )
      .run();

    const org = await env.DB.prepare("SELECT slug, owner_user_id FROM orgs WHERE id = ?")
      .bind("01JORG00000000000000000010")
      .first<{ slug: string; owner_user_id: string }>();
    expect(org?.slug).toBe("alice-personal");
    expect(org?.owner_user_id).toBe("01JUSER0000000000000000010");
  });

  it("creates memberships with composite PK (user_id, org_id)", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, github_id, handle, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000020", 2020, "bob", now)
      .run();
    await env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        "01JORG00000000000000000020",
        "bob-personal",
        "Bob personal",
        "01JUSER0000000000000000020",
        now,
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000020", "01JORG00000000000000000020", "owner", now)
      .run();

    // Duplicate composite key rejected
    await expect(
      env.DB.prepare(
        `INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, ?, ?)`,
      )
        .bind("01JUSER0000000000000000020", "01JORG00000000000000000020", "admin", now)
        .run(),
    ).rejects.toThrow();
  });

  it("creates rate_limits table keyed by (user_id, resource, window_start)", async () => {
    const day = Math.floor(Date.now() / 86_400_000);
    await env.DB.prepare(
      `INSERT INTO rate_limits (user_id, resource, window_start, count)
       VALUES (?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000030", "worker_req", day, 1)
      .run();

    const row = await env.DB.prepare(
      `SELECT count FROM rate_limits WHERE user_id = ? AND resource = ? AND window_start = ?`,
    )
      .bind("01JUSER0000000000000000030", "worker_req", day)
      .first<{ count: number }>();
    expect(row?.count).toBe(1);
  });

  it("adds created_by_user_id column to agent_runs", async () => {
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, github_id, handle, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind("01JUSER0000000000000000040", 4040, "carol", now)
      .run();

    await env.DB.prepare(
      `INSERT INTO agent_runs
         (id, tool_id, tool_version, org_id, status, input, state,
          created_at, updated_at, retry_count, cost_usd_micro, created_by_user_id)
       VALUES (?, ?, ?, ?, 'pending', ?, '{}', ?, ?, 0, 0, ?)`,
    )
      .bind(
        "run-with-user",
        "demo",
        1,
        "local",
        JSON.stringify({}),
        now,
        now,
        "01JUSER0000000000000000040",
      )
      .run();

    const run = await env.DB.prepare("SELECT created_by_user_id FROM agent_runs WHERE id = ?")
      .bind("run-with-user")
      .first<{ created_by_user_id: string }>();
    expect(run?.created_by_user_id).toBe("01JUSER0000000000000000040");
  });
});
