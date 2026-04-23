import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { upsertUserFromGithub } from "../../src/auth/upsert";

const now = 1_700_000_000_000;

describe("upsertUserFromGithub · first login", () => {
  it("inserts user + personal org + owner membership atomically", async () => {
    const result = await upsertUserFromGithub(
      env.DB,
      {
        id: 100,
        login: "jinhui",
        email: "dev@example.com",
        name: "박진희",
        avatar_url: "https://avatars.githubusercontent.com/u/100",
      },
      now,
    );

    expect(result.isNew).toBe(true);
    expect(result.user.github_id).toBe(100);
    expect(result.user.handle).toBe("jinhui");
    expect(result.user.email).toBe("dev@example.com");
    expect(result.user.name).toBe("박진희");
    expect(result.user.created_at).toBe(now);
    expect(result.user.last_seen_at).toBe(now);

    expect(result.defaultOrg.slug).toBe("jinhui-personal");
    expect(result.defaultOrg.owner_user_id).toBe(result.user.id);
    expect(result.defaultOrg.name).toBe("jinhui personal");

    const membership = await env.DB.prepare(
      "SELECT role FROM memberships WHERE user_id = ? AND org_id = ?",
    )
      .bind(result.user.id, result.defaultOrg.id)
      .first<{ role: string }>();
    expect(membership?.role).toBe("owner");
  });

  it("normalizes uppercase / non-handle chars from github login", async () => {
    const result = await upsertUserFromGithub(
      env.DB,
      { id: 101, login: "Alice_Dev.42", email: null, name: null, avatar_url: null },
      now,
    );
    expect(result.user.handle).toBe("alice-dev-42");
    expect(result.defaultOrg.slug).toBe("alice-dev-42-personal");
  });

  it("falls back to user-{id} when login normalizes to empty", async () => {
    const result = await upsertUserFromGithub(
      env.DB,
      { id: 102, login: "!!!", email: null, name: null, avatar_url: null },
      now,
    );
    expect(result.user.handle).toBe("user-102");
  });
});

describe("upsertUserFromGithub · handle / slug collisions", () => {
  it("appends -2 to handle when normalized login collides with existing user", async () => {
    await upsertUserFromGithub(
      env.DB,
      { id: 200, login: "bob", email: null, name: null, avatar_url: null },
      now,
    );
    const second = await upsertUserFromGithub(
      env.DB,
      { id: 201, login: "bob", email: null, name: null, avatar_url: null },
      now + 1,
    );
    expect(second.user.handle).toBe("bob-2");
    expect(second.defaultOrg.slug).toBe("bob-2-personal");
  });

  it("appends -2 to org slug when handle is free but slug is taken", async () => {
    // Seed: an existing org with slug "carol-personal" owned by a different user
    const seededUser = await upsertUserFromGithub(
      env.DB,
      { id: 300, login: "temp-owner", email: null, name: null, avatar_url: null },
      now,
    );
    await env.DB.prepare(
      `INSERT INTO orgs (id, slug, name, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        "01JSEED000000000000000001",
        "carol-personal",
        "carol personal",
        seededUser.user.id,
        now,
      )
      .run();

    const carol = await upsertUserFromGithub(
      env.DB,
      { id: 301, login: "carol", email: null, name: null, avatar_url: null },
      now + 1,
    );
    expect(carol.user.handle).toBe("carol");
    expect(carol.defaultOrg.slug).toBe("carol-personal-2");
  });
});

describe("upsertUserFromGithub · re-login", () => {
  it("updates last_seen_at and profile fields, keeps same ids, isNew=false", async () => {
    const first = await upsertUserFromGithub(
      env.DB,
      {
        id: 400,
        login: "dave",
        email: "dave@old.com",
        name: "Dave Old",
        avatar_url: "https://old/avatar.png",
      },
      now,
    );

    const second = await upsertUserFromGithub(
      env.DB,
      {
        id: 400,
        login: "dave",
        email: "dave@new.com",
        name: "Dave New",
        avatar_url: "https://new/avatar.png",
      },
      now + 60_000,
    );

    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.email).toBe("dave@new.com");
    expect(second.user.name).toBe("Dave New");
    expect(second.user.avatar_url).toBe("https://new/avatar.png");
    expect(second.user.last_seen_at).toBe(now + 60_000);
    expect(second.user.created_at).toBe(now); // unchanged

    // No second org created for the same user
    const orgCount = await env.DB.prepare("SELECT COUNT(*) as n FROM orgs WHERE owner_user_id = ?")
      .bind(first.user.id)
      .first<{ n: number }>();
    expect(orgCount?.n).toBe(1);

    expect(second.defaultOrg.id).toBe(first.defaultOrg.id);
  });
});
