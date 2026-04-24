import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

async function createAgent(cookie: string, args: { name: string; description?: string }) {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name: args.name,
      description: args.description,
      definition: { nodes: [], edges: [] },
    }),
  });
  return (await res.json()) as { id: string; slug: string };
}

describe("POST /api/agents/:id/report", () => {
  it("rejects anonymous with 401", async () => {
    const res = await SELF.fetch(
      "https://runtime.test/api/agents/01JANYID00000000000000000/report",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "spam" }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("records a report and returns 200 with idempotent behaviour", async () => {
    const author = await createAuthedSession({ githubId: 13000, login: "report-author" });
    const reader = await createAuthedSession({ githubId: 13001, login: "report-reader" });
    const agent = await createAgent(author.cookie, { name: "Target" });

    const r1 = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: reader.cookie },
      body: JSON.stringify({ reason: "spam", detail: "repeats output" }),
    });
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as { reported: boolean; reason: string };
    expect(b1.reported).toBe(true);
    expect(b1.reason).toBe("spam");

    // Second submit with a different reason overwrites the same row (idempotent key).
    const r2 = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: reader.cookie },
      body: JSON.stringify({ reason: "nsfw" }),
    });
    expect(r2.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT reason FROM agent_reports WHERE agent_id = ? AND reporter_user_id = ?",
    )
      .bind(agent.id, reader.userId)
      .first<{ reason: string }>();
    expect(row?.reason).toBe("nsfw");
  });

  it("rejects invalid reason with 400", async () => {
    const author = await createAuthedSession({ githubId: 13002, login: "report-bad" });
    const reader = await createAuthedSession({ githubId: 13003, login: "report-bad-reader" });
    const agent = await createAgent(author.cookie, { name: "Another" });
    const res = await SELF.fetch(`https://runtime.test/api/agents/${agent.id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: reader.cookie },
      body: JSON.stringify({ reason: "not-an-enum" }),
    });
    expect(res.status).toBe(400);
  });

  it("404s for a non-existent agent", async () => {
    const reader = await createAuthedSession({ githubId: 13004, login: "report-ghost" });
    const res = await SELF.fetch(
      "https://runtime.test/api/agents/01JGHOSTGHOSTGHOSTGHOSTGH/report",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: reader.cookie },
        body: JSON.stringify({ reason: "spam" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("auto-hides an agent whose name or description contains a blocklist term (nsfw/malware/phishing)", async () => {
    const author = await createAuthedSession({ githubId: 13005, login: "bad-author" });
    const agent = await createAgent(author.cookie, {
      name: "Clean Name",
      description: "Follow these phishing steps to harvest passwords",
    });

    // Check public lookup is 404 because auto-moderation flipped moderation_hidden.
    const res = await SELF.fetch(`https://runtime.test/api/public/agents/bad-author/${agent.slug}`);
    expect(res.status).toBe(404);
  });

  it("does NOT auto-hide benign content", async () => {
    const author = await createAuthedSession({ githubId: 13006, login: "clean-author" });
    const agent = await createAgent(author.cookie, {
      name: "HN Morning Summary",
      description: "Daily top 10 from Hacker News · plain English",
    });
    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/clean-author/${agent.slug}`,
    );
    expect(res.status).toBe(200);
  });
});

describe("public lookups respect moderation_hidden", () => {
  it("a manually hidden agent disappears from /@h/s even if visibility is public", async () => {
    const author = await createAuthedSession({ githubId: 13100, login: "hidden-author" });
    const agent = await createAgent(author.cookie, { name: "Clean Again" });
    await env.DB.prepare("UPDATE agents SET moderation_hidden = 1 WHERE id = ?")
      .bind(agent.id)
      .run();

    const res = await SELF.fetch(
      `https://runtime.test/api/public/agents/hidden-author/${agent.slug}`,
    );
    expect(res.status).toBe(404);
  });

  it("a hidden agent disappears from search results", async () => {
    const author = await createAuthedSession({ githubId: 13101, login: "hidden-search" });
    const agent = await createAgent(author.cookie, { name: "Needle Agent" });
    await env.DB.prepare("UPDATE agents SET moderation_hidden = 1 WHERE id = ?")
      .bind(agent.id)
      .run();
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=needle");
    const body = (await res.json()) as { agents: Array<{ name: string }> };
    expect(body.agents.map((a) => a.name)).not.toContain("Needle Agent");
  });
});
