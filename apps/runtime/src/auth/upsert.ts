import {
  newId,
  normalizeHandleCandidate,
  type Org,
  parseOrg,
  parseUser,
  type User,
} from "@weaver/core";
import type { GithubProfile } from "./github";

type UserRow = {
  id: string;
  github_id: number;
  handle: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
  last_seen_at: number | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  owner_user_id: string;
  created_at: number;
};

function userFromRow(r: UserRow): User {
  return parseUser(r);
}

function orgFromRow(r: OrgRow): Org {
  return parseOrg(r);
}

/**
 * Linear-scan collision picker. 50 suffix attempts is enough for even a
 * wildly popular handle — if we ever need more we should probably batch
 * a single SELECT ... IN (...) instead of N trips. For now, simple wins.
 */
async function pickAvailable(db: D1Database, sql: string, base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const row = await db.prepare(sql).bind(candidate).first();
    if (!row) return candidate;
  }
  throw new Error(`no free candidate for base=${base}`);
}

export type UpsertResult = {
  user: User;
  defaultOrg: Org;
  isNew: boolean;
};

/**
 * Find-or-create a user from a GitHub profile. First login provisions a
 * personal org + owner membership in a single D1 batch. Subsequent logins
 * refresh email/name/avatar and bump `last_seen_at` — ids never change.
 */
export async function upsertUserFromGithub(
  db: D1Database,
  profile: GithubProfile,
  now: number = Date.now(),
): Promise<UpsertResult> {
  const existing = await db
    .prepare("SELECT * FROM users WHERE github_id = ?")
    .bind(profile.id)
    .first<UserRow>();

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET email = ?, name = ?, avatar_url = ?, last_seen_at = ?
         WHERE id = ?`,
      )
      .bind(profile.email, profile.name, profile.avatar_url, now, existing.id)
      .run();
    const userRow = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(existing.id)
      .first<UserRow>();
    const orgRow = await db
      .prepare("SELECT * FROM orgs WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1")
      .bind(existing.id)
      .first<OrgRow>();
    if (!userRow || !orgRow) {
      throw new Error("upsertUserFromGithub: existing user has no default org");
    }
    return { user: userFromRow(userRow), defaultOrg: orgFromRow(orgRow), isNew: false };
  }

  const baseHandle = normalizeHandleCandidate(profile.login, `user-${profile.id}`);
  const handle = await pickAvailable(db, "SELECT 1 FROM users WHERE handle = ?", baseHandle);
  const slug = await pickAvailable(db, "SELECT 1 FROM orgs WHERE slug = ?", `${handle}-personal`);

  const userId = newId();
  const orgId = newId();

  await db.batch([
    db
      .prepare(
        `INSERT INTO users
           (id, github_id, handle, email, name, avatar_url, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(userId, profile.id, handle, profile.email, profile.name, profile.avatar_url, now, now),
    db
      .prepare(
        `INSERT INTO orgs (id, slug, name, owner_user_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(orgId, slug, `${handle} personal`, userId, now),
    db
      .prepare(
        `INSERT INTO memberships (user_id, org_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, orgId, "owner", now),
  ]);

  const userRow = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  const orgRow = await db.prepare("SELECT * FROM orgs WHERE id = ?").bind(orgId).first<OrgRow>();
  if (!userRow || !orgRow) {
    throw new Error("upsertUserFromGithub: batch insert did not persist");
  }

  return { user: userFromRow(userRow), defaultOrg: orgFromRow(orgRow), isNew: true };
}
