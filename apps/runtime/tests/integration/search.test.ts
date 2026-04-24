import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthedSession } from "./_helpers/session";

/**
 * Sprint 3 D4: public agent search.
 *
 * Hybrid endpoint: defaults to a SQL-LIKE keyword scan over (name, slug,
 * description). Vectorize-backed semantic ranking lives behind a binding —
 * tests here only exercise the keyword path so they stay hermetic.
 *
 * The endpoint is intentionally unauthenticated so logged-out visitors can
 * discover public agents without creating an account first.
 */

async function createAgent(
  cookie: string,
  args: { name: string; description?: string; category?: string; visibility?: string },
) {
  const res = await SELF.fetch("https://runtime.test/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name: args.name,
      description: args.description,
      category: args.category,
      visibility: args.visibility ?? "public",
      definition: { nodes: [], edges: [] },
    }),
  });
  return (await res.json()) as { id: string; slug: string };
}

describe("GET /api/public/agents/search", () => {
  it("matches by name (case-insensitive substring)", async () => {
    const author = await createAuthedSession({ githubId: 9500, login: "searcher" });
    await createAgent(author.cookie, {
      name: "HN Daily Summary",
      description: "Every day, the HN front page condensed into 10 bullets.",
      category: "news",
    });
    await createAgent(author.cookie, {
      name: "GitHub Trending",
      description: "Top repos by stars across languages.",
      category: "news",
    });
    await createAgent(author.cookie, {
      name: "CSS Tips",
      description: "Weekly subgrid and nesting refreshers.",
      category: "creative",
    });

    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=hn");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agents: Array<{ name: string; slug: string; handle: string; category: string | null }>;
    };
    const names = body.agents.map((a) => a.name);
    expect(names).toContain("HN Daily Summary");
    expect(names).not.toContain("CSS Tips");
  });

  it("matches by description substring", async () => {
    const author = await createAuthedSession({ githubId: 9501, login: "desc-searcher" });
    await createAgent(author.cookie, {
      name: "Noise Agent",
      description: "filtering out the noise using policy rules",
    });
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=policy+rules");
    const body = (await res.json()) as { agents: Array<{ name: string }> };
    const names = body.agents.map((a) => a.name);
    expect(names).toContain("Noise Agent");
  });

  it("filters by category when provided", async () => {
    const author = await createAuthedSession({ githubId: 9502, login: "cat-searcher" });
    await createAgent(author.cookie, {
      name: "Daily News A",
      description: "ai news",
      category: "news",
    });
    await createAgent(author.cookie, {
      name: "Productivity Hack",
      description: "ai productivity",
      category: "productivity",
    });
    const res = await SELF.fetch(
      "https://runtime.test/api/public/agents/search?q=ai&category=productivity",
    );
    const body = (await res.json()) as { agents: Array<{ name: string; category: string | null }> };
    const names = body.agents.map((a) => a.name);
    expect(names).toContain("Productivity Hack");
    expect(names).not.toContain("Daily News A");
  });

  it("hides private agents from search results", async () => {
    const author = await createAuthedSession({ githubId: 9503, login: "hide-searcher" });
    await createAgent(author.cookie, {
      name: "Secret Scanner",
      description: "internal tool",
      visibility: "private",
    });
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=secret");
    const body = (await res.json()) as { agents: Array<{ name: string }> };
    expect(body.agents.map((a) => a.name)).not.toContain("Secret Scanner");
  });

  it("returns empty array for zero matches (not 404)", async () => {
    const res = await SELF.fetch(
      "https://runtime.test/api/public/agents/search?q=xyzzy-no-match-term",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: unknown[] };
    expect(body.agents).toEqual([]);
  });

  it("rejects empty q with 400", async () => {
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=");
    expect(res.status).toBe(400);
  });

  it("works without authentication (public discovery)", async () => {
    // No cookie on the request — this is the default test harness.
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=a");
    expect(res.status).not.toBe(401);
  });

  it("returns creator handle joined in so the result links can build @handle/slug URLs", async () => {
    const author = await createAuthedSession({ githubId: 9504, login: "handle-join" });
    await createAgent(author.cookie, { name: "Handle Probe" });
    const res = await SELF.fetch("https://runtime.test/api/public/agents/search?q=handle+probe");
    const body = (await res.json()) as {
      agents: Array<{ name: string; slug: string; handle: string }>;
    };
    const probe = body.agents.find((a) => a.name === "Handle Probe");
    expect(probe?.handle).toBe("handle-join");
    expect(probe?.slug).toBe("handle-probe");
  });
});
