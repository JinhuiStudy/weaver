import type { Session } from "./session";

/**
 * Proxy an RR7 loader call through to the runtime worker, reusing the
 * incoming cookie. Same service-binding-first / URL-fallback shape as the
 * worker's top-level proxy in workers/app.ts.
 */
export async function callRuntime(
  env: Env,
  path: string,
  request: Request,
  init?: { method?: string; body?: string },
): Promise<Response> {
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    cookie: request.headers.get("cookie") ?? "",
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["content-type"] = "application/json";
  }
  const url = new URL(path, request.url);
  const upstreamReq = new Request(url, { method, headers, body: init?.body });

  try {
    if (env.RUNTIME) return await env.RUNTIME.fetch(upstreamReq);
    if (env.RUNTIME_URL) {
      const upstreamUrl = new URL(path, env.RUNTIME_URL).toString();
      return await fetch(upstreamUrl, { method, headers, body: init?.body });
    }
    return new Response(JSON.stringify({ error: "runtime not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "runtime unreachable", detail: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Server-side session lookup for RR7 loaders. Uses the RUNTIME service binding
 * in production (bypasses Cloudflare's loopback-fetch 403). Falls back to a
 * local dev-only mock session when the runtime isn't reachable so Playwright
 * and manual dev can still exercise the builder without spinning a second
 * worker process.
 *
 * The dev fallback is keyed on `RUNTIME_URL` pointing at localhost — the
 * production wrangler.jsonc has the prod URL baked in, so a misconfiguration
 * can't accidentally ship this fake session to users.
 */
export async function loadSessionServer(request: Request, env: Env): Promise<Session | null> {
  const res = await callRuntime(env, "/api/me", request);
  if (res.status === 401) return isDev(env) ? devSession() : null;
  if (!res.ok) return isDev(env) ? devSession() : null;
  try {
    return (await res.json()) as Session;
  } catch {
    return isDev(env) ? devSession() : null;
  }
}

export function isDev(env: Env): boolean {
  const url = env.RUNTIME_URL ?? "";
  // Treat "no RUNTIME_URL" / localhost / vitest-style hosts as dev so Playwright,
  // Vite dev, and tests all share the same fallback path. Production keeps
  // RUNTIME_URL pointing at the live worker so this branch stays dormant.
  if (url === "") return !env.RUNTIME;
  return url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

function devSession(): Session {
  return {
    user: {
      id: "dev-user-00000000000000000000",
      handle: "dev",
      name: "Dev User",
      email: null,
      avatar_url: null,
    },
    org: { id: "dev-org-000000000000000000000", slug: "dev-personal", name: "Dev personal" },
    quota: {
      neurons: { used: 7, cap: 50, remaining: 43 },
      runs: { used: 2, cap: 10, remaining: 8 },
    },
  };
}
