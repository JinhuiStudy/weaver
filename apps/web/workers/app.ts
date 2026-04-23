import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/**
 * `/auth/*` and `/api/*` are owned by the runtime worker, but the browser
 * must see them on the same origin as the web app — otherwise the
 * `weaver_session` cookie is set on the runtime host and `workers.dev`'s
 * public-suffix status prevents us from sharing it via `Domain=`. So we
 * pass-through fetch here and the Set-Cookie from runtime lands on the
 * web origin.
 */
const PROXY_PREFIXES = ["/auth/", "/api/"] as const;

function isProxyPath(pathname: string): boolean {
  return PROXY_PREFIXES.some((p) => pathname === p.slice(0, -1) || pathname.startsWith(p));
}

async function proxyToRuntime(request: Request, runtimeUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, runtimeUrl);
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };
  try {
    return await fetch(upstream.toString(), init);
  } catch (err) {
    // Connection refused / DNS failure (runtime worker not running locally).
    // Return a real Response so Vite doesn't treat this as a server error
    // and pop up its HMR overlay — callers get a normal 502 to handle.
    return new Response(JSON.stringify({ error: "runtime unavailable", detail: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isProxyPath(url.pathname)) {
      // Production: a worker → worker service binding bypasses the public
      // internet and sidesteps Cloudflare's loopback-fetch block that
      // returns 403 when weaver-web tries to fetch weaver-runtime by URL.
      if (env.RUNTIME) {
        return env.RUNTIME.fetch(request);
      }
      // Dev fallback: plain HTTP to a separately-running runtime worker.
      const runtimeUrl = env.RUNTIME_URL;
      if (!runtimeUrl) {
        return new Response("RUNTIME_URL not configured", { status: 503 });
      }
      return proxyToRuntime(request, runtimeUrl);
    }
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
