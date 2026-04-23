import { newId, normalizeHandleCandidate } from "@weaver/core";
import type { Context } from "hono";

/**
 * Public agent CRUD. Scoped to the session's user — every POST attributes
 * `creator_user_id` to `c.get("session").sub` and every GET filters by that
 * same id. Slug uniqueness is per-creator (see migration 0004); collisions
 * fall back to `-2`, `-3`, …
 */

type AgentRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  category: string | null;
  current_version_id: string | null;
  fork_of_agent_id: string | null;
  created_at: number;
  updated_at: number;
};

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pickAvailableSlugForUser(
  db: D1Database,
  userId: string,
  base: string,
): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const row = await db
      .prepare("SELECT 1 FROM agents WHERE creator_user_id = ? AND slug = ?")
      .bind(userId, candidate)
      .first();
    if (!row) return candidate;
  }
  throw new Error(`no free agent slug for base=${base}`);
}

export async function handleCreateAgent(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  let body: {
    slug?: unknown;
    name?: unknown;
    description?: unknown;
    category?: unknown;
    visibility?: unknown;
    definition?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  if (name.length > 80) return c.json({ error: "name must be ≤ 80 chars" }, 400);

  const definition = body.definition;
  if (!definition || typeof definition !== "object") {
    return c.json({ error: "definition is required" }, 400);
  }

  const visibility = typeof body.visibility === "string" ? body.visibility : "public";
  if (!["public", "unlisted", "private"].includes(visibility)) {
    return c.json({ error: "visibility must be public|unlisted|private" }, 400);
  }

  const slugSource = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : name;
  const baseSlug = normalizeHandleCandidate(slugSource, "agent");
  const slug = await pickAvailableSlugForUser(db, session.sub, baseSlug);

  const now = Date.now();
  const agentId = newId();
  const versionId = newId();
  const definitionJson = JSON.stringify(definition);
  const promptHash = await sha256Hex(definitionJson);

  await db.batch([
    db
      .prepare(
        `INSERT INTO agents
           (id, slug, creator_user_id, name, description, visibility, category,
            current_version_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        agentId,
        slug,
        session.sub,
        name,
        typeof body.description === "string" ? body.description : null,
        visibility,
        typeof body.category === "string" ? body.category : null,
        versionId,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO agent_versions
           (id, agent_id, version, definition_json, prompt_hash, created_at)
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
      .bind(versionId, agentId, definitionJson, promptHash, now),
  ]);

  return c.json({
    id: agentId,
    slug,
    name,
    description: typeof body.description === "string" ? body.description : null,
    visibility,
    category: typeof body.category === "string" ? body.category : null,
    current_version_id: versionId,
    created_at: now,
    updated_at: now,
  });
}

export async function handleListAgents(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const rows = await db
    .prepare(
      `SELECT id, slug, name, description, visibility, category,
              current_version_id, fork_of_agent_id, created_at, updated_at
         FROM agents
        WHERE creator_user_id = ?
        ORDER BY updated_at DESC
        LIMIT 100`,
    )
    .bind(session.sub)
    .all<AgentRow>();

  return c.json({ agents: rows.results ?? [] });
}
