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
 * Creator-only — edit agent metadata (name/description/category/visibility).
 * Slug is intentionally immutable here: public `/@handle/slug` URLs are load-
 * bearing once shared, so renaming needs a dedicated flow (future Sprint).
 *
 * 404 is returned for both "not found" and "not the creator" — same as
 * handleGetAgent — so a stranger can't probe whether an agent id exists.
 */
export async function handleUpdateAgent(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const existing = await db
    .prepare(
      `SELECT id, slug, creator_user_id, name, description, visibility, category,
              current_version_id, fork_of_agent_id, created_at, updated_at
         FROM agents WHERE id = ? AND creator_user_id = ?`,
    )
    .bind(id, session.sub)
    .first<AgentRow>();
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: unknown;
    description?: unknown;
    category?: unknown;
    visibility?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  // Build the SET clause dynamically so callers can PATCH a single field
  // without clobbering the rest. `undefined` = keep; `null` = explicit clear
  // (for nullable columns: description/category).
  const updates: string[] = [];
  const binds: Array<string | number | null> = [];
  let nextName = existing.name;
  let nextDescription = existing.description;
  let nextCategory = existing.category;
  let nextVisibility = existing.visibility;

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return c.json({ error: "name must be a string" }, 400);
    }
    const trimmed = body.name.trim();
    if (!trimmed) return c.json({ error: "name must not be empty" }, 400);
    if (trimmed.length > 80) return c.json({ error: "name must be ≤ 80 chars" }, 400);
    nextName = trimmed;
    updates.push("name = ?");
    binds.push(trimmed);
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      nextDescription = null;
      updates.push("description = NULL");
    } else if (typeof body.description === "string") {
      const trimmed = body.description.trim();
      if (trimmed.length > 400) {
        return c.json({ error: "description must be ≤ 400 chars" }, 400);
      }
      nextDescription = trimmed || null;
      updates.push("description = ?");
      binds.push(trimmed || null);
    } else {
      return c.json({ error: "description must be a string or null" }, 400);
    }
  }

  if (body.category !== undefined) {
    if (body.category === null) {
      nextCategory = null;
      updates.push("category = NULL");
    } else if (typeof body.category === "string") {
      const trimmed = body.category.trim();
      if (trimmed.length > 40) return c.json({ error: "category must be ≤ 40 chars" }, 400);
      nextCategory = trimmed || null;
      updates.push("category = ?");
      binds.push(trimmed || null);
    } else {
      return c.json({ error: "category must be a string or null" }, 400);
    }
  }

  if (body.visibility !== undefined) {
    if (
      typeof body.visibility !== "string" ||
      !["public", "unlisted", "private"].includes(body.visibility)
    ) {
      return c.json({ error: "visibility must be public|unlisted|private" }, 400);
    }
    nextVisibility = body.visibility;
    updates.push("visibility = ?");
    binds.push(body.visibility);
  }

  if (updates.length === 0) {
    // No-op PATCH — still touch updated_at so the "내 Agents" list re-orders.
    // Return the row as-is.
    return c.json({
      id: existing.id,
      slug: existing.slug,
      name: existing.name,
      description: existing.description,
      visibility: existing.visibility,
      category: existing.category,
      current_version_id: existing.current_version_id,
      fork_of_agent_id: existing.fork_of_agent_id,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
    });
  }

  const now = Date.now();
  updates.push("updated_at = ?");
  binds.push(now);
  binds.push(id);

  const stmt = db.prepare(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`);
  await stmt.bind(...binds).run();

  return c.json({
    id: existing.id,
    slug: existing.slug,
    name: nextName,
    description: nextDescription,
    visibility: nextVisibility,
    category: nextCategory,
    current_version_id: existing.current_version_id,
    fork_of_agent_id: existing.fork_of_agent_id,
    created_at: existing.created_at,
    updated_at: now,
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
 * POST /api/runs/:id/feedback — record a 👍/👎 + optional comment.
 *
 * Auth required. The run must belong to a public/unlisted agent (private
 * runs can't receive public feedback — 404 keeps us from leaking their
 * existence). UPSERT pattern so a user can flip their vote later.
 */
export async function handleSubmitFeedback(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const runId = c.req.param("id");
  if (!runId) return c.json({ error: "run id is required" }, 400);

  let body: { rating?: unknown; comment?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const rating = body.rating;
  if (rating !== 1 && rating !== -1) {
    return c.json({ error: "rating must be 1 or -1" }, 400);
  }
  let comment: string | null = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== "string") {
      return c.json({ error: "comment must be a string" }, 400);
    }
    const trimmed = body.comment.trim();
    if (trimmed.length > 280) {
      return c.json({ error: "comment must be ≤ 280 chars" }, 400);
    }
    comment = trimmed || null;
  }

  // Resolve the agent + visibility via the run row.
  const row = await db
    .prepare(
      `SELECT r.id AS run_id, r.tool_id AS agent_id, a.visibility AS visibility
         FROM agent_runs r
         JOIN agents a ON a.id = r.tool_id
        WHERE r.id = ?`,
    )
    .bind(runId)
    .first<{ run_id: string; agent_id: string; visibility: string }>();
  if (!row || row.visibility === "private") {
    return c.json({ error: "not found" }, 404);
  }

  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO agent_feedback (run_id, user_id, agent_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(run_id, user_id)
       DO UPDATE SET rating = excluded.rating,
                     comment = excluded.comment,
                     created_at = excluded.created_at`,
    )
    .bind(row.run_id, session.sub, row.agent_id, rating, comment, now)
    .run();

  return c.json({
    run_id: row.run_id,
    agent_id: row.agent_id,
    rating,
    comment,
    created_at: now,
  });
}

/**
 * GET /api/public/agents/:h/:s/stats — aggregate fitness signal for a public
 * agent card. Returns likes/dislikes/ratio (null if no votes), fork count,
 * subscriber count. One query per metric keeps D1 planning simple.
 */
export async function handlePublicStats(c: Context): Promise<Response> {
  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const handle = c.req.param("handle");
  const slug = c.req.param("slug");
  if (!handle || !slug) return c.json({ error: "handle and slug required" }, 400);

  const agent = await db
    .prepare(
      `SELECT a.id
         FROM agents a
         JOIN users u ON u.id = a.creator_user_id
        WHERE u.handle = ? AND a.slug = ?
          AND a.visibility IN ('public', 'unlisted')`,
    )
    .bind(handle, slug)
    .first<{ id: string }>();
  if (!agent) return c.json({ error: "not found" }, 404);

  const feedback = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)  AS likes,
         SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS dislikes
       FROM agent_feedback WHERE agent_id = ?`,
    )
    .bind(agent.id)
    .first<{ likes: number | null; dislikes: number | null }>();
  const likes = feedback?.likes ?? 0;
  const dislikes = feedback?.dislikes ?? 0;
  const total = likes + dislikes;
  const ratio = total > 0 ? likes / total : null;

  const forks = await db
    .prepare("SELECT COUNT(*) AS c FROM agents WHERE fork_of_agent_id = ?")
    .bind(agent.id)
    .first<{ c: number }>();
  const subs = await db
    .prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE agent_id = ?")
    .bind(agent.id)
    .first<{ c: number }>();

  return c.json({
    agent_id: agent.id,
    likes,
    dislikes,
    ratio,
    fork_count: forks?.c ?? 0,
    subscriber_count: subs?.c ?? 0,
  });
}

type GenealogyNode = {
  id: string;
  handle: string;
  slug: string;
  name: string;
  depth: number;
  fork_of_agent_id: string | null;
};

/**
 * GET /api/public/agents/:h/:s/genealogy — walks up the fork chain
 * (ancestors, depth=1..3) and down (direct + grand-children, depth=1..3)
 * and returns them as flat arrays keyed by depth. The UI renders this as
 * a vertical tree centred on `current`.
 */
export async function handlePublicGenealogy(c: Context): Promise<Response> {
  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const handle = c.req.param("handle");
  const slug = c.req.param("slug");
  if (!handle || !slug) return c.json({ error: "handle and slug required" }, 400);

  const current = await db
    .prepare(
      `SELECT a.id AS id, a.slug AS slug, a.name AS name,
              a.fork_of_agent_id AS fork_of_agent_id, u.handle AS handle
         FROM agents a
         JOIN users u ON u.id = a.creator_user_id
        WHERE u.handle = ? AND a.slug = ?
          AND a.visibility IN ('public', 'unlisted')`,
    )
    .bind(handle, slug)
    .first<{
      id: string;
      slug: string;
      name: string;
      fork_of_agent_id: string | null;
      handle: string;
    }>();
  if (!current) return c.json({ error: "not found" }, 404);

  const maxDepth = 3;
  const ancestors: GenealogyNode[] = [];
  let parentId: string | null = current.fork_of_agent_id;
  for (let depth = 1; depth <= maxDepth && parentId; depth++) {
    const row = await db
      .prepare(
        `SELECT a.id AS id, a.slug AS slug, a.name AS name,
                a.fork_of_agent_id AS fork_of_agent_id, u.handle AS handle
           FROM agents a
           JOIN users u ON u.id = a.creator_user_id
          WHERE a.id = ? AND a.visibility IN ('public', 'unlisted')`,
      )
      .bind(parentId)
      .first<{
        id: string;
        slug: string;
        name: string;
        fork_of_agent_id: string | null;
        handle: string;
      }>();
    if (!row) break;
    ancestors.push({ ...row, depth });
    parentId = row.fork_of_agent_id;
  }

  const descendants: GenealogyNode[] = [];
  let frontier: string[] = [current.id];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const placeholders = frontier.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT a.id AS id, a.slug AS slug, a.name AS name,
                a.fork_of_agent_id AS fork_of_agent_id, u.handle AS handle
           FROM agents a
           JOIN users u ON u.id = a.creator_user_id
          WHERE a.fork_of_agent_id IN (${placeholders})
            AND a.visibility IN ('public', 'unlisted')
          ORDER BY a.created_at ASC`,
      )
      .bind(...frontier)
      .all<{
        id: string;
        slug: string;
        name: string;
        fork_of_agent_id: string | null;
        handle: string;
      }>();
    const list = rows.results ?? [];
    for (const row of list) descendants.push({ ...row, depth });
    frontier = list.map((r) => r.id);
  }

  return c.json({
    current: {
      id: current.id,
      handle: current.handle,
      slug: current.slug,
      name: current.name,
    },
    ancestors,
    descendants,
  });
}

type AgentOutputRow = {
  id: string;
  agent_id: string;
  agent_version_id: string;
  run_id: string;
  output_json: string;
  published_at: number;
};

/**
 * POST /api/agents/:id/subscribe — idempotent toggle. First POST creates a
 * subscription; second removes it. Private agents refuse with 403 so a
 * reader can't use subscription as a back-channel to detect a private
 * id exists.
 */
export async function handleToggleSubscribe(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const agent = await db
    .prepare("SELECT id, visibility FROM agents WHERE id = ?")
    .bind(id)
    .first<{ id: string; visibility: string }>();
  if (!agent) return c.json({ error: "not found" }, 404);
  if (agent.visibility === "private") {
    return c.json({ error: "cannot subscribe to a private agent" }, 403);
  }

  const existing = await db
    .prepare("SELECT user_id FROM subscriptions WHERE user_id = ? AND agent_id = ?")
    .bind(session.sub, id)
    .first();

  if (existing) {
    await db
      .prepare("DELETE FROM subscriptions WHERE user_id = ? AND agent_id = ?")
      .bind(session.sub, id)
      .run();
    return c.json({ subscribed: false, agent_id: id });
  }

  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, agent_id, created_at)
       VALUES (?, ?, ?)`,
    )
    .bind(session.sub, id, Date.now())
    .run();
  return c.json({ subscribed: true, agent_id: id });
}

/**
 * GET /api/me/feed — aggregate timeline of outputs from every agent the
 * caller has subscribed to. Joined once so a single query services the
 * whole feed; capped at 100 items to keep the response body small.
 */
export async function handleMyFeed(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const rows = await db
    .prepare(
      `SELECT
         o.id          AS id,
         o.agent_id    AS agent_id,
         o.run_id      AS run_id,
         o.output_json AS output_json,
         o.published_at AS published_at,
         a.slug        AS agent_slug,
         a.name        AS agent_name,
         u.handle      AS agent_handle
       FROM subscriptions s
       JOIN agents a ON a.id = s.agent_id
       JOIN users  u ON u.id = a.creator_user_id
       JOIN agent_outputs o ON o.agent_id = s.agent_id
       WHERE s.user_id = ?
       ORDER BY o.published_at DESC
       LIMIT 100`,
    )
    .bind(session.sub)
    .all<{
      id: string;
      agent_id: string;
      run_id: string;
      output_json: string;
      published_at: number;
      agent_slug: string;
      agent_name: string;
      agent_handle: string;
    }>();

  const items = (rows.results ?? []).map((row) => ({
    id: row.id,
    agent_id: row.agent_id,
    agent_handle: row.agent_handle,
    agent_slug: row.agent_slug,
    agent_name: row.agent_name,
    run_id: row.run_id,
    content_text: extractSummary(safeParse(row.output_json)),
    published_at: row.published_at,
  }));
  return c.json({ items });
}

/**
 * GET /api/public/agents/search?q=...&category=...
 *
 * Hybrid search — for now just a SQL LIKE scan over (name, slug, description)
 * filtered to `visibility IN ('public', 'unlisted')`. When a Vectorize
 * binding is available the endpoint can optionally re-rank with bge-base
 * embeddings (kept out of the hot path so absence of the binding doesn't
 * degrade the UX — ADR-006 free-tier first).
 *
 * Unauthenticated on purpose: discovery is a pre-login experience.
 */
export async function handleSearchAgents(c: Context): Promise<Response> {
  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const url = new URL(c.req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  if (!q) return c.json({ error: "q is required" }, 400);

  // SQLite LIKE is case-insensitive for ASCII. We wrap with % to make it a
  // substring search. 3 LIKE clauses (name, slug, description) joined OR.
  const like = `%${q.replace(/%/g, "")}%`;
  const binds: Array<string> = [like, like, like];
  let sql = `
    SELECT a.id, a.slug, a.name, a.description, a.category, a.updated_at,
           u.handle AS handle, u.avatar_url AS avatar_url
      FROM agents a
      JOIN users u ON u.id = a.creator_user_id
     WHERE a.visibility IN ('public', 'unlisted')
       AND (a.name LIKE ? OR a.slug LIKE ? OR a.description LIKE ?)
  `;
  if (category) {
    sql += " AND a.category = ?";
    binds.push(category);
  }
  sql += " ORDER BY a.updated_at DESC LIMIT 30";

  const rows = await db
    .prepare(sql)
    .bind(...binds)
    .all<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      category: string | null;
      updated_at: number;
      handle: string;
      avatar_url: string | null;
    }>();

  return c.json({ q, category: category || null, agents: rows.results ?? [] });
}

/**
 * POST /api/evolutions/:id/accept — the creator promotes a candidate to v2.
 *
 * Creates a new `agent_versions` row with the candidate's definition, swaps
 * `agents.current_version_id`, and stamps the evolution row's `accepted_at`
 * + `accepted_version_id`. Refuses on already-accepted rows (409) so the
 * endpoint is safe to retry.
 */
export async function handleAcceptEvolution(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const evo = await db
    .prepare(
      `SELECT e.id, e.agent_version_id, e.strategy, e.candidate_definition_json,
              e.accepted_at, e.rejected_at,
              av.agent_id AS agent_id, a.creator_user_id AS creator_user_id
         FROM agent_evolutions e
         JOIN agent_versions av ON av.id = e.agent_version_id
         JOIN agents a ON a.id = av.agent_id
        WHERE e.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      agent_version_id: string;
      strategy: string;
      candidate_definition_json: string;
      accepted_at: number | null;
      rejected_at: number | null;
      agent_id: string;
      creator_user_id: string;
    }>();
  if (!evo) return c.json({ error: "not found" }, 404);
  if (evo.creator_user_id !== session.sub) {
    return c.json({ error: "only the creator can accept an evolution" }, 403);
  }
  if (evo.accepted_at) return c.json({ error: "already accepted" }, 409);
  if (evo.rejected_at) return c.json({ error: "already rejected" }, 409);

  const maxRow = await db
    .prepare("SELECT MAX(version) AS m FROM agent_versions WHERE agent_id = ?")
    .bind(evo.agent_id)
    .first<{ m: number | null }>();
  const nextVersion = (maxRow?.m ?? 0) + 1;

  const now = Date.now();
  const newVersionId = newId();
  const definitionJson = evo.candidate_definition_json;
  const promptHash = await sha256Hex(definitionJson);

  await db.batch([
    db
      .prepare(
        `INSERT INTO agent_versions
           (id, agent_id, version, definition_json, prompt_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(newVersionId, evo.agent_id, nextVersion, definitionJson, promptHash, now),
    db
      .prepare("UPDATE agents SET current_version_id = ?, updated_at = ? WHERE id = ?")
      .bind(newVersionId, now, evo.agent_id),
    db
      .prepare("UPDATE agent_evolutions SET accepted_at = ?, accepted_version_id = ? WHERE id = ?")
      .bind(now, newVersionId, evo.id),
  ]);

  return c.json({
    evolution_id: evo.id,
    agent_id: evo.agent_id,
    new_version_id: newVersionId,
    new_version: nextVersion,
    strategy: evo.strategy,
    accepted_at: now,
  });
}

/** POST /api/evolutions/:id/reject — creator dismisses a candidate. */
export async function handleRejectEvolution(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const evo = await db
    .prepare(
      `SELECT e.id, e.accepted_at, e.rejected_at,
              a.creator_user_id AS creator_user_id
         FROM agent_evolutions e
         JOIN agent_versions av ON av.id = e.agent_version_id
         JOIN agents a ON a.id = av.agent_id
        WHERE e.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      accepted_at: number | null;
      rejected_at: number | null;
      creator_user_id: string;
    }>();
  if (!evo) return c.json({ error: "not found" }, 404);
  if (evo.creator_user_id !== session.sub) {
    return c.json({ error: "only the creator can reject an evolution" }, 403);
  }
  if (evo.accepted_at) return c.json({ error: "already accepted" }, 409);
  if (evo.rejected_at) return c.json({ error: "already rejected" }, 409);

  await db
    .prepare("UPDATE agent_evolutions SET rejected_at = ? WHERE id = ?")
    .bind(Date.now(), id)
    .run();
  return c.json({ evolution_id: id, rejected_at: Date.now() });
}

/** GET /api/agents/:id/evolutions — creator lists candidates for their agent. */
export async function handleListAgentEvolutions(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const agent = await db
    .prepare("SELECT id, current_version_id FROM agents WHERE id = ? AND creator_user_id = ?")
    .bind(id, session.sub)
    .first<{ id: string; current_version_id: string }>();
  if (!agent) return c.json({ error: "not found" }, 404);

  const rows = await db
    .prepare(
      `SELECT id, agent_version_id, strategy, shadow_case_count, shadow_wins,
              shadow_losses, win_rate, suggested_at, accepted_at, rejected_at,
              created_at, candidate_definition_json
         FROM agent_evolutions
        WHERE agent_version_id IN (
                SELECT id FROM agent_versions WHERE agent_id = ?
              )
        ORDER BY created_at DESC`,
    )
    .bind(agent.id)
    .all<{
      id: string;
      agent_version_id: string;
      strategy: string;
      shadow_case_count: number;
      shadow_wins: number;
      shadow_losses: number;
      win_rate: number | null;
      suggested_at: number | null;
      accepted_at: number | null;
      rejected_at: number | null;
      created_at: number;
      candidate_definition_json: string;
    }>();

  const evolutions = (rows.results ?? []).map((row) => ({
    id: row.id,
    agent_version_id: row.agent_version_id,
    strategy: row.strategy,
    shadow_case_count: row.shadow_case_count,
    shadow_wins: row.shadow_wins,
    shadow_losses: row.shadow_losses,
    win_rate: row.win_rate,
    suggested_at: row.suggested_at,
    accepted_at: row.accepted_at,
    rejected_at: row.rejected_at,
    created_at: row.created_at,
    candidate_prompt: extractAgentPrompt(row.candidate_definition_json),
  }));
  return c.json({ agent_id: agent.id, evolutions });
}

function extractAgentPrompt(defJson: string): string | null {
  try {
    const def = JSON.parse(defJson) as {
      nodes?: Array<{ type?: string; data?: { system_prompt?: string } }>;
    };
    const agentNode = (def.nodes ?? []).find((n) => n?.type === "agent");
    return agentNode?.data?.system_prompt ?? null;
  } catch {
    return null;
  }
}

type EvolutionRow = {
  id: string;
  agent_version_id: string;
  strategy: string;
  shadow_case_count: number;
  shadow_wins: number;
  shadow_losses: number;
  win_rate: number | null;
  suggested_at: number | null;
  accepted_at: number | null;
  rejected_at: number | null;
  created_at: number;
  agent_id: string;
  agent_slug: string;
  agent_name: string;
  agent_handle: string;
};

/**
 * GET /api/admin/evolutions — Sprint 5 D4 · admin-only list of generated
 * mutation candidates. Requires a session whose handle matches
 * `ADMIN_HANDLE` env var (falls back to "dev" so local Playwright works).
 */
export async function handleListEvolutions(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  const adminHandle = (c.env as { ADMIN_HANDLE?: string }).ADMIN_HANDLE ?? "dev";
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);
  if (session.handle !== adminHandle) {
    return c.json({ error: "admin only" }, 403);
  }

  const rows = await db
    .prepare(
      `SELECT
          e.id, e.agent_version_id, e.strategy,
          e.shadow_case_count, e.shadow_wins, e.shadow_losses, e.win_rate,
          e.suggested_at, e.accepted_at, e.rejected_at, e.created_at,
          a.id   AS agent_id,
          a.slug AS agent_slug,
          a.name AS agent_name,
          u.handle AS agent_handle
         FROM agent_evolutions e
         JOIN agent_versions av ON av.id = e.agent_version_id
         JOIN agents a ON a.id = av.agent_id
         JOIN users  u ON u.id = a.creator_user_id
        ORDER BY e.created_at DESC
        LIMIT 200`,
    )
    .all<EvolutionRow>();

  return c.json({ evolutions: rows.results ?? [] });
}

/** GET /api/agents/:id/subscribe — is the current user subscribed? */
export async function handleIsSubscribed(c: Context): Promise<Response> {
  const session = c.get("session");
  const db = (c.env as { DB?: D1Database }).DB;
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!db) return c.json({ error: "db unavailable" }, 503);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const row = await db
    .prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND agent_id = ?")
    .bind(session.sub, id)
    .first();
  return c.json({ subscribed: Boolean(row), agent_id: id });
}

/**
 * Public JSON Feed (https://www.jsonfeed.org/version/1.1/). Paginates
 * `agent_outputs` for a given @handle/slug in reverse-chronological order.
 * Served with `application/feed+json` so feed readers recognise it; a
 * short cache-control is fine because agents rarely publish more than once
 * a minute.
 */
export async function handlePublicFeed(c: Context): Promise<Response> {
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
      `SELECT id, slug, name, description
         FROM agents
        WHERE creator_user_id = ? AND slug = ?
          AND visibility IN ('public', 'unlisted')`,
    )
    .bind(user.id, slug)
    .first<{ id: string; slug: string; name: string; description: string | null }>();
  if (!agent) return c.json({ error: "not found" }, 404);

  const rows = await db
    .prepare(
      `SELECT id, agent_id, agent_version_id, run_id, output_json, published_at
         FROM agent_outputs
        WHERE agent_id = ?
        ORDER BY published_at DESC
        LIMIT 50`,
    )
    .bind(agent.id)
    .all<AgentOutputRow>();

  const url = new URL(c.req.url);
  const origin = `${url.protocol}//${url.host}`;
  const homePageUrl = `${origin}/@${user.handle}/${agent.slug}`;
  const feedUrl = `${origin}/@${user.handle}/${agent.slug}/feed.json`;

  const items = (rows.results ?? []).map((row) => {
    const parsed = safeParse(row.output_json);
    const summary = extractSummary(parsed);
    return {
      id: row.id,
      url: `${origin}/tools/${agent.id}/runs/${row.run_id}`,
      date_published: new Date(row.published_at).toISOString(),
      content_text: summary,
    };
  });

  const body = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${agent.name} · @${user.handle}`,
    description: agent.description ?? undefined,
    home_page_url: homePageUrl,
    feed_url: feedUrl,
    authors:
      user.name || user.handle
        ? [{ name: user.name ?? user.handle, url: `${origin}/@${user.handle}` }]
        : undefined,
    items,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function extractSummary(parsed: unknown): string {
  if (typeof parsed === "string") return parsed;
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const key of ["summary", "output", "text", "content", "message"]) {
      const v = record[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    // Fall back to a compact JSON dump, capped.
    const dump = JSON.stringify(parsed);
    return dump.length > 400 ? `${dump.slice(0, 400)}…` : dump;
  }
  return String(parsed ?? "");
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
