import { GitFork } from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge, Button } from "~/components/ui";
import { callRuntime } from "~/lib/session.server";
import type { Route } from "./+types/handle-agent";

type PublicAgent = {
  agent: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: string;
    category: string | null;
    fork_of_agent_id: string | null;
    created_at: number;
    updated_at: number;
  };
  creator: {
    handle: string;
    name: string | null;
    avatar_url: string | null;
  };
  definition: {
    nodes?: Array<{ id: string; type: string; data?: { label?: string } }>;
    edges?: Array<{ id: string; source: string; target: string }>;
  } | null;
};

export function meta({ data }: Route.MetaArgs) {
  if (!data?.agent) return [{ title: "Weaver · not found" }];
  return [
    { title: `@${data.creator.handle}/${data.agent.slug} · Weaver` },
    {
      name: "description",
      content: data.agent.description ?? `${data.agent.name} on Weaver`,
    },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  // Route path is `:prefixedHandle/:slug`; the public URL must start with
  // `@` so we 404 on anything else — that keeps this catch-all from
  // stealing hits intended for future top-level sections.
  const { prefixedHandle, slug } = params as { prefixedHandle: string; slug: string };
  if (!prefixedHandle.startsWith("@")) {
    throw new Response("not found", { status: 404 });
  }
  const handle = prefixedHandle.slice(1);
  const res = await callRuntime(env, `/api/public/agents/${handle}/${slug}`, request);
  if (res.status === 404) {
    throw new Response("agent not found", { status: 404 });
  }
  if (!res.ok) {
    throw new Response("failed to load agent", { status: 502 });
  }
  const data = (await res.json()) as PublicAgent;
  return data;
}

export default function HandleAgentRoute() {
  const data = useLoaderData<typeof loader>();
  const { agent, creator, definition } = data;
  const navigate = useNavigate();
  const [forking, setForking] = useState(false);

  const nodes = definition?.nodes ?? [];
  const edges = definition?.edges ?? [];

  const onFork = async () => {
    setForking(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/fork`, { method: "POST" });
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`fork failed (${res.status}): ${msg}`);
      }
      const body = (await res.json()) as { id: string };
      navigate(`/builder/${body.id}`);
    } catch (err) {
      window.alert(`Fork 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setForking(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-8 py-4">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/design" className="btn btn-ghost">
            Design System
          </Link>
        </nav>
      </header>

      <section className="px-8 pt-16 pb-8 md:px-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-text-tertiary">
            agent · @{creator.handle}
          </div>
          <h1
            className="text-[44px] font-semibold leading-[1.05] tracking-[-0.025em]"
            data-testid="agent-title"
          >
            {agent.name}
          </h1>
          {agent.description ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
              {agent.description}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone={agent.visibility === "public" ? "ok" : "info"}>{agent.visibility}</Badge>
            {agent.category ? <Badge tone="muted">{agent.category}</Badge> : null}
            {agent.fork_of_agent_id ? (
              <Badge tone="info" className="inline-flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                forked
              </Badge>
            ) : null}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={onFork}
              loading={forking}
              disabled={forking}
              leftIcon={<GitFork className="lu" />}
              data-testid="fork-button"
            >
              Fork to workspace
            </Button>
            <span className="font-mono text-xs text-text-tertiary">
              @{creator.handle}/{agent.slug}
            </span>
          </div>
        </div>
      </section>

      <section
        className="canvas-bg border-y border-border px-8 py-12 md:px-16"
        data-testid="agent-preview"
      >
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
            graph preview · {nodes.length} nodes · {edges.length} edges
          </h2>
          <div className="grid gap-2 md:grid-cols-3">
            {nodes.slice(0, 9).map((node) => (
              <div
                key={node.id}
                className="card"
                data-testid="preview-node"
                data-node-type={node.type}
              >
                <div className="card-b">
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                    {node.type}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold tracking-tight">
                    {node.data?.label ?? node.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {nodes.length === 0 ? (
            <p className="mt-4 text-center text-sm text-text-tertiary">
              no graph · 아직 정의가 비어 있습니다
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-tertiary">404</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Agent not found</h1>
        <p className="mt-4 text-sm text-text-secondary">
          이 <code className="font-mono">@handle/slug</code> 로 저장된 공개 agent 를 찾을 수 없어요.
        </p>
        <Link to="/" className="btn btn-primary mt-6 inline-flex">
          홈으로
        </Link>
      </div>
    </main>
  );
}
