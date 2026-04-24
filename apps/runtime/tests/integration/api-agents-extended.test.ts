import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

const DEF = {
  nodes: [
    { id: "in1", type: "input", position: { x: 0, y: 0 }, data: { label: "in" } },
    { id: "out1", type: "output", position: { x: 200, y: 0 }, data: { label: "out" } },
  ],
  edges: [{ id: "e1", source: "in1", target: "out1" }],
};

async function createAgent(cookie: string, name: string, def: unknown = DEF) {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name, definition: def }),
  });
  return (await res.json()) as { id: string; slug: string; current_version_id: string };
}

describe("GET /api/agents/:id", () => {
  it("returns the agent + its current version definition (owner only)", async () => {
    const session = await createAuthedSession({ githubId: 8001, login: "owner-get" });
    const created = await createAgent(session.cookie, "Detail Agent");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      headers: { cookie: session.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      slug: string;
      definition: { nodes: unknown[]; edges: unknown[] };
    };
    expect(body.id).toBe(created.id);
    expect(body.slug).toBe("detail-agent");
    expect(body.definition.nodes).toHaveLength(2);
    expect(body.definition.edges).toHaveLength(1);
  });

  it("returns 404 for an agent that belongs to another user", async () => {
    const a = await createAuthedSession({ githubId: 8002, login: "owner-a" });
    const b = await createAuthedSession({ githubId: 8003, login: "owner-b" });
    const aAgent = await createAgent(a.cookie, "Mine");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${aAgent.id}`, {
      headers: { cookie: b.cookie },
    });
    expect(res.status).toBe(404);
  });

  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/agents/01JANY00000000000000000000");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/agents/:id/versions", () => {
  it("creator pushes v2, current_version_id flips, version monotonically increments", async () => {
    const session = await createAuthedSession({ githubId: 8100, login: "versioner" });
    const created = await createAgent(session.cookie, "My Agent");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ definition: { nodes: [], edges: [] } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; version: number };
    expect(body.version).toBe(2);
    expect(body.id).not.toBe(created.current_version_id);

    const agent = await env.DB.prepare("SELECT current_version_id FROM agents WHERE id = ?")
      .bind(created.id)
      .first<{ current_version_id: string }>();
    expect(agent?.current_version_id).toBe(body.id);
  });

  it("rejects a non-creator with 403", async () => {
    const a = await createAuthedSession({ githubId: 8101, login: "creator-x" });
    const b = await createAuthedSession({ githubId: 8102, login: "stranger" });
    const agent = await createAgent(a.cookie, "Locked");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: b.cookie },
      body: JSON.stringify({ definition: { nodes: [], edges: [] } }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the agent doesn't exist", async () => {
    const session = await createAuthedSession({ githubId: 8103, login: "notfound-test" });
    const res = await SELF.fetch(
      "https://runtime.test/api/agents/01JGHOST000000000000000000/versions",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ definition: { nodes: [], edges: [] } }),
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agents/:id/fork", () => {
  it("forks a public agent into the caller's workspace and records fork_of_agent_id", async () => {
    const author = await createAuthedSession({ githubId: 8200, login: "author" });
    const forker = await createAuthedSession({ githubId: 8201, login: "forker" });
    const src = await createAgent(author.cookie, "Viral");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${src.id}/fork`, {
      method: "POST",
      headers: { cookie: forker.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      slug: string;
      fork_of_agent_id: string;
    };
    expect(body.fork_of_agent_id).toBe(src.id);
    expect(body.slug).toBe("viral"); // forker 워크스페이스엔 아직 'viral' 없음

    const row = await env.DB.prepare(
      "SELECT creator_user_id, fork_of_agent_id FROM agents WHERE id = ?",
    )
      .bind(body.id)
      .first<{ creator_user_id: string; fork_of_agent_id: string }>();
    expect(row?.creator_user_id).toBe(forker.userId);
    expect(row?.fork_of_agent_id).toBe(src.id);

    // Forked definition matches the source's current version.
    const copied = await env.DB.prepare(
      `SELECT av.definition_json
         FROM agents a JOIN agent_versions av ON av.id = a.current_version_id
        WHERE a.id = ?`,
    )
      .bind(body.id)
      .first<{ definition_json: string }>();
    expect(JSON.parse(copied?.definition_json ?? "{}")).toEqual(DEF);
  });

  it("appends -2 to the slug when the forker already owns that slug", async () => {
    const author = await createAuthedSession({ githubId: 8210, login: "author2" });
    const forker = await createAuthedSession({ githubId: 8211, login: "forker2" });
    // Forker has a pre-existing "viral"
    await createAgent(forker.cookie, "Viral");
    const src = await createAgent(author.cookie, "Viral");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${src.id}/fork`, {
      method: "POST",
      headers: { cookie: forker.cookie },
    });
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBe("viral-2");
  });

  it("refuses to fork a private agent owned by someone else (403)", async () => {
    const author = await createAuthedSession({ githubId: 8220, login: "private-author" });
    const stranger = await createAuthedSession({ githubId: 8221, login: "stranger2" });

    const createRes = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: author.cookie },
      body: JSON.stringify({ name: "Hidden", visibility: "private", definition: DEF }),
    });
    const src = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`https://runtime.test/api/agents/${src.id}/fork`, {
      method: "POST",
      headers: { cookie: stranger.cookie },
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/agents/:id", () => {
  it("updates name/description/category/visibility for the creator", async () => {
    const session = await createAuthedSession({ githubId: 8400, login: "metadata-editor" });
    const created = await createAgent(session.cookie, "Old Name");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({
        name: "Brand New Name",
        description: "A freshly edited description.",
        category: "productivity",
        visibility: "unlisted",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      category: string | null;
      visibility: string;
    };
    expect(body.name).toBe("Brand New Name");
    expect(body.description).toBe("A freshly edited description.");
    expect(body.category).toBe("productivity");
    expect(body.visibility).toBe("unlisted");
    // Slug should NOT change on a metadata edit — agents keep stable public URLs.
    expect(body.slug).toBe("old-name");

    const row = await env.DB.prepare(
      "SELECT name, description, category, visibility, slug FROM agents WHERE id = ?",
    )
      .bind(created.id)
      .first<{
        name: string;
        description: string | null;
        category: string | null;
        visibility: string;
        slug: string;
      }>();
    expect(row?.name).toBe("Brand New Name");
    expect(row?.visibility).toBe("unlisted");
    expect(row?.slug).toBe("old-name");
  });

  it("supports partial edits (description only)", async () => {
    const session = await createAuthedSession({ githubId: 8401, login: "partial-editor" });
    const created = await createAgent(session.cookie, "Partial");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ description: "Just a blurb." }),
    });
    expect(res.status).toBe(200);

    const row = await env.DB.prepare("SELECT name, description FROM agents WHERE id = ?")
      .bind(created.id)
      .first<{ name: string; description: string | null }>();
    expect(row?.name).toBe("Partial");
    expect(row?.description).toBe("Just a blurb.");
  });

  it("allows clearing description/category with explicit null", async () => {
    const session = await createAuthedSession({ githubId: 8402, login: "null-editor" });
    const res0 = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({
        name: "Fill",
        description: "drop me",
        category: "research",
        definition: DEF,
      }),
    });
    const created = (await res0.json()) as { id: string };

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ description: null, category: null }),
    });
    expect(res.status).toBe(200);

    const row = await env.DB.prepare("SELECT description, category FROM agents WHERE id = ?")
      .bind(created.id)
      .first<{ description: string | null; category: string | null }>();
    expect(row?.description).toBeNull();
    expect(row?.category).toBeNull();
  });

  it("rejects a non-creator with 404 (to avoid leaking existence)", async () => {
    const a = await createAuthedSession({ githubId: 8403, login: "owner-p" });
    const b = await createAuthedSession({ githubId: 8404, login: "stranger-p" });
    const agent = await createAgent(a.cookie, "Not Yours");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: b.cookie },
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects an invalid visibility with 400", async () => {
    const session = await createAuthedSession({ githubId: 8405, login: "bad-vis" });
    const created = await createAgent(session.cookie, "Vis Test");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ visibility: "secret" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty name with 400", async () => {
    const session = await createAuthedSession({ githubId: 8406, login: "empty-name" });
    const created = await createAgent(session.cookie, "Has Name");

    const res = await SELF.fetch(`https://runtime.test/api/agents/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ name: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/agents/01JPATCH0000000000000000000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "anon" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/public/agents/:handle/:slug", () => {
  it("serves a public agent anonymously (no session cookie)", async () => {
    const author = await createAuthedSession({ githubId: 8300, login: "public-author" });
    await createAgent(author.cookie, "Daily Digest");

    const res = await SELF.fetch(
      "https://runtime.test/api/public/agents/public-author/daily-digest",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agent: { slug: string; name: string };
      creator: { handle: string };
      definition: { nodes: unknown[] };
    };
    expect(body.agent.slug).toBe("daily-digest");
    expect(body.agent.name).toBe("Daily Digest");
    expect(body.creator.handle).toBe("public-author");
    expect(body.definition.nodes).toHaveLength(2);
  });

  it("returns 404 for unknown handle or slug", async () => {
    const resA = await SELF.fetch("https://runtime.test/api/public/agents/nobody/anything");
    expect(resA.status).toBe(404);

    const author = await createAuthedSession({ githubId: 8301, login: "has-author" });
    await createAgent(author.cookie, "Known");
    const resB = await SELF.fetch("https://runtime.test/api/public/agents/has-author/unknown-slug");
    expect(resB.status).toBe(404);
  });

  it("hides private agents from anonymous lookup", async () => {
    const author = await createAuthedSession({ githubId: 8302, login: "private-hider" });
    await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: author.cookie },
      body: JSON.stringify({ name: "Secret", visibility: "private", definition: DEF }),
    });

    const res = await SELF.fetch("https://runtime.test/api/public/agents/private-hider/secret");
    expect(res.status).toBe(404);
  });
});
