import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

const DEF = { nodes: [{ id: "in1", type: "input" }], edges: [] };

describe("POST /api/agents", () => {
  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x", definition: DEF }),
    });
    expect(res.status).toBe(401);
  });

  it("creates agent + version 1, returns slug + current_version_id", async () => {
    const session = await createAuthedSession({ githubId: 7001, login: "creator1" });
    const res = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({
        name: "HN Summary",
        description: "Daily Hacker News digest",
        category: "news",
        definition: DEF,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      slug: string;
      name: string;
      current_version_id: string;
    };
    expect(body.slug).toBe("hn-summary");
    expect(body.name).toBe("HN Summary");
    expect(body.current_version_id).toBeTruthy();

    const agent = await env.DB.prepare(
      "SELECT creator_user_id, current_version_id FROM agents WHERE id = ?",
    )
      .bind(body.id)
      .first<{ creator_user_id: string; current_version_id: string }>();
    expect(agent?.creator_user_id).toBe(session.userId);
    expect(agent?.current_version_id).toBe(body.current_version_id);

    const version = await env.DB.prepare(
      "SELECT version, definition_json, prompt_hash FROM agent_versions WHERE id = ?",
    )
      .bind(body.current_version_id)
      .first<{ version: number; definition_json: string; prompt_hash: string }>();
    expect(version?.version).toBe(1);
    expect(JSON.parse(version?.definition_json ?? "{}")).toEqual(DEF);
    expect(version?.prompt_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("appends -2 to slug when the same creator has the same slug", async () => {
    const session = await createAuthedSession({ githubId: 7002, login: "slug-repeat" });
    const post = async (name: string) =>
      SELF.fetch("https://runtime.test/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ name, definition: DEF }),
      });
    const a = (await (await post("news")).json()) as { slug: string };
    const b = (await (await post("news")).json()) as { slug: string };
    expect(a.slug).toBe("news");
    expect(b.slug).toBe("news-2");
  });

  it("accepts explicit slug and normalizes it", async () => {
    const session = await createAuthedSession({ githubId: 7003, login: "slugger" });
    const res = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ name: "My Agent", slug: "My_Cool.Thing", definition: DEF }),
    });
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBe("my-cool-thing");
  });

  it("rejects missing name with 400", async () => {
    const session = await createAuthedSession({ githubId: 7004, login: "noname" });
    const res = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ definition: DEF }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing definition with 400", async () => {
    const session = await createAuthedSession({ githubId: 7005, login: "nodef" });
    const res = await SELF.fetch("https://runtime.test/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/agents", () => {
  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch("https://runtime.test/api/agents");
    expect(res.status).toBe(401);
  });

  it("lists my own agents in updated_at DESC, scoped to the session", async () => {
    const me = await createAuthedSession({ githubId: 7100, login: "me-owner" });
    const other = await createAuthedSession({ githubId: 7101, login: "other-owner" });

    const create = async (cookie: string, name: string) =>
      SELF.fetch("https://runtime.test/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ name, definition: DEF }),
      });
    await create(me.cookie, "alpha");
    await new Promise((r) => setTimeout(r, 5));
    await create(me.cookie, "beta");
    await create(other.cookie, "theirs");

    const res = await SELF.fetch("https://runtime.test/api/agents", {
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agents: Array<{ slug: string; name: string }>;
    };
    expect(body.agents.map((a) => a.slug)).toEqual(["beta", "alpha"]);
    expect(body.agents.find((a) => a.slug === "theirs")).toBeUndefined();
  });
});
