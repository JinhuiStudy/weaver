import { newId, normalizeHandleCandidate } from "@weaver/core";
import type { Context } from "hono";

/**
 * Agent CRUD + public lookups + fork.
 *
 * Private endpoints (`/api/agents/*`) go through requireAuth() in index.ts
 * and scope every query by `c.get("session").sub`. The public endpoint
 * (`/api/public/agents/:handle/:slug`) is intentionally unauthenticated
 * so the `@handle/slug` SSR page works for logged-out visitors; it filters
 * visibility to `public|unlisted` server-side.
 */

type AgentRow = {
  id: string;
  slug: string;
  creator_user_id: string;
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

async function loadDefinition(db: D1Database, versionId: string): Promise<unknown> {
  const version = await db
    .prepare("SELECT definition_json FROM agent_versions WHERE id = ?")
    .bind(versionId)
    .first<{ definition_json: string }>();
  if (!version) return null;
  try {
    return JSON.parse(version.definition_json);
  } catch {
    return null;
  }
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
    fork_of_agent_id: null,
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

/**
 * Private detail endpoint — returns the agent + its current version's
 * definition so the builder can hydrate the canvas. Scoped to the session's
 * user (404 on not-found OR visibility-filtered miss, not 403, to avoid
 * leaking slug existence).
 */
export async function handleGetAgent(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  const agent = await db
    .prepare(
      `SELECT id, slug, creator_user_id, name, description, visibility, category,
              current_version_id, fork_of_agent_id, created_at, updated_at
         FROM agents WHERE id = ? AND creator_user_id = ?`,
    )
    .bind(id, session.sub)
    .first<AgentRow>();
  if (!agent) return c.json({ error: "not found" }, 404);

  const definition = agent.current_version_id
    ? await loadDefinition(db, agent.current_version_id)
    : null;

  return c.json({
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    visibility: agent.visibility,
    category: agent.category,
    current_version_id: agent.current_version_id,
    fork_of_agent_id: agent.fork_of_agent_id,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    definition,
  });
}

/**
 * Creator-only — push a new version and atomically swap
 * `agents.current_version_id`. Monotonic version number is max+1 scoped to
 * the agent. Duplicate prompt_hash is fine (we store the version anyway so
 * the creator can see the snapshot); eval-side dedup is a later concern.
 */
export async function handleCreateVersion(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  const agent = await db
    .prepare("SELECT id, creator_user_id FROM agents WHERE id = ?")
    .bind(id)
    .first<{ id: string; creator_user_id: string }>();
  if (!agent) return c.json({ error: "not found" }, 404);
  if (agent.creator_user_id !== session.sub) {
    return c.json({ error: "only the creator can push new versions" }, 403);
  }

  let body: { definition?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (!body.definition || typeof body.definition !== "object") {
    return c.json({ error: "definition is required" }, 400);
  }

  const maxRow = await db
    .prepare("SELECT MAX(version) AS m FROM agent_versions WHERE agent_id = ?")
    .bind(id)
    .first<{ m: number | null }>();
  const nextVersion = (maxRow?.m ?? 0) + 1;

  const now = Date.now();
  const versionId = newId();
  const definitionJson = JSON.stringify(body.definition);
  const promptHash = await sha256Hex(definitionJson);

  await db.batch([
    db
      .prepare(
        `INSERT INTO agent_versions
           (id, agent_id, version, definition_json, prompt_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(versionId, id, nextVersion, definitionJson, promptHash, now),
    db
      .prepare("UPDATE agents SET current_version_id = ?, updated_at = ? WHERE id = ?")
      .bind(versionId, now, id),
  ]);

  return c.json({
    id: versionId,
    agent_id: id,
    version: nextVersion,
    prompt_hash: promptHash,
    created_at: now,
  });
}

/**
 * Copy an agent + its current version's definition into the caller's
 * workspace. `fork_of_agent_id` records the parent so genealogy can surface
 * the lineage later. Private agents are unforkable except by their own
 * creator; unlisted + public are fair game.
 */
export async function handleForkAgent(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  const source = await db
    .prepare(
      `SELECT id, slug, creator_user_id, name, description, visibility, category,
              current_version_id
         FROM agents WHERE id = ?`,
    )
    .bind(id)
    .first<AgentRow>();
  if (!source) return c.json({ error: "not found" }, 404);
  if (source.visibility === "private" && source.creator_user_id !== session.sub) {
    return c.json({ error: "private agent cannot be forked" }, 403);
  }
  if (!source.current_version_id) {
    return c.json({ error: "source agent has no current version" }, 409);
  }

  const versionRow = await db
    .prepare("SELECT definition_json FROM agent_versions WHERE id = ?")
    .bind(source.current_version_id)
    .first<{ definition_json: string }>();
  if (!versionRow) return c.json({ error: "source version missing" }, 500);

  const slug = await pickAvailableSlugForUser(db, session.sub, source.slug);

  const now = Date.now();
  const newAgentId = newId();
  const newVersionId = newId();
  const promptHash = await sha256Hex(versionRow.definition_json);

  await db.batch([
    db
      .prepare(
        `INSERT INTO agents
           (id, slug, creator_user_id, name, description, visibility, category,
            current_version_id, fork_of_agent_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'public', ?, ?, ?, ?, ?)`,
      )
      .bind(
        newAgentId,
        slug,
        session.sub,
        source.name,
        source.description,
        source.category,
        newVersionId,
        id,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO agent_versions
           (id, agent_id, version, definition_json, prompt_hash, created_at)
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
      .bind(newVersionId, newAgentId, versionRow.definition_json, promptHash, now),
  ]);

  return c.json({
    id: newAgentId,
    slug,
    name: source.name,
    fork_of_agent_id: id,
    current_version_id: newVersionId,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Unauthenticated lookup by @handle/slug. Only exposes agents whose
 * visibility is public or unlisted. Returns the creator's handle + name
 * for the card and the full current-version definition so the server-
 * rendered preview can draw the graph.
 */
export async function handleGetPublicAgent(c: Context): Promise<Response> {
  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const handle = c.req.param("handle");
  const slug = c.req.param("slug");
  if (!handle || !slug) return c.json({ error: "handle and slug required" }, 400);

  const user = await db
    .prepare("SELECT id, handle, name, avatar_url FROM users WHERE handle = ?")
    .bind(handle)
    .first<{ id: string; handle: string; name: string | null; avatar_url: string | null }>();
  if (!user) return c.json({ error: "not found" }, 404);

  const agent = await db
    .prepare(
      `SELECT id, slug, creator_user_id, name, description, visibility, category,
              current_version_id, fork_of_agent_id, created_at, updated_at
         FROM agents
        WHERE creator_user_id = ? AND slug = ?
          AND visibility IN ('public', 'unlisted')`,
    )
    .bind(user.id, slug)
    .first<AgentRow>();
  if (!agent) return c.json({ error: "not found" }, 404);

  const definition = agent.current_version_id
    ? await loadDefinition(db, agent.current_version_id)
    : null;

  return c.json({
    agent: {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      visibility: agent.visibility,
      category: agent.category,
      fork_of_agent_id: agent.fork_of_agent_id,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    },
    creator: { handle: user.handle, name: user.name, avatar_url: user.avatar_url },
    definition,
  });
}
