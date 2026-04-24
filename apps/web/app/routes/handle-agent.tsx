import { BellPlus, BellRing, BookOpen, GitFork, Network, Rss, ThumbsUp, Users } from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge, Button } from "~/components/ui";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
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
  const { prefixedHandle, slug } = params as { prefixedHandle: string; slug: string };
  if (!prefixedHandle.startsWith("@")) {
    throw new Response("not found", { status: 404 });
  }
  const handle = prefixedHandle.slice(1);
  const res = await callRuntime(env, `/api/public/agents/${handle}/${slug}`, request);
  let data: PublicAgent;
  if (res.ok) {
    data = (await res.json()) as PublicAgent;
  } else if (isDev(env)) {
    // Dev: runtime offline — mint a deterministic mock so the page renders.
    data = {
      agent: {
        id: `dev-agent-${slug}`,
        slug,
        name: slug.replace(/-/g, " "),
        description: "Dev mock agent — 실제 runtime 이 없을 때 보여집니다.",
        visibility: "public",
        category: "news",
        fork_of_agent_id: null,
        created_at: Date.now() - 86_400_000,
        updated_at: Date.now() - 3_600_000,
      },
      creator: { handle, name: handle, avatar_url: null },
      definition: { nodes: [], edges: [] },
    };
  } else if (res.status === 404) {
    throw new Response("agent not found", { status: 404 });
  } else {
    throw new Response("failed to load agent", { status: 502 });
  }

  // If the visitor is logged in, check their subscription status so the
  // Subscribe button can render the correct state server-side.
  let subscribed = false;
  const session = await loadSessionServer(request, env);
  if (session) {
    const subRes = await callRuntime(env, `/api/agents/${data.agent.id}/subscribe`, request);
    if (subRes.ok) {
      try {
        subscribed = ((await subRes.json()) as { subscribed: boolean }).subscribed ?? false;
      } catch {}
    }
  }

  // Fetch aggregate stats (likes / forks / subs). Dev fallback mirrors
  // the shape so the page always has something to render.
  let stats: {
    likes: number;
    dislikes: number;
    ratio: number | null;
    fork_count: number;
    subscriber_count: number;
  } = { likes: 0, dislikes: 0, ratio: null, fork_count: 0, subscriber_count: 0 };
  const statsRes = await callRuntime(env, `/api/public/agents/${handle}/${slug}/stats`, request);
  if (statsRes.ok) {
    try {
      stats = await statsRes.json();
    } catch {}
  } else if (isDev(env)) {
    stats = { likes: 42, dislikes: 6, ratio: 42 / 48, fork_count: 9, subscriber_count: 15 };
  }

  return { ...data, subscribed, stats, loggedIn: Boolean(session), handle, slug };
}

export default function HandleAgentRoute() {
  const data = useLoaderData<typeof loader>();
  const { agent, creator, definition, handle, slug } = data;
  const navigate = useNavigate();
  const [forking, setForking] = useState(false);
  const [subscribed, setSubscribed] = useState(data.subscribed);
  const [subBusy, setSubBusy] = useState(false);

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

  const onToggleSubscribe = async () => {
    if (!data.loggedIn) {
      navigate("/login");
      return;
    }
    setSubBusy(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/subscribe`, { method: "POST" });
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`);
      const body = (await res.json()) as { subscribed: boolean };
      setSubscribed(body.subscribed);
    } catch (err) {
      window.alert(`구독 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubBusy(false);
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
          <Link to="/help" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to="/design" className="btn btn-ghost btn-sm">
            Design
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

          <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="agent-badges">
            <Badge tone={agent.visibility === "public" ? "ok" : "info"}>{agent.visibility}</Badge>
            {agent.category ? <Badge tone="muted">{agent.category}</Badge> : null}
            {agent.fork_of_agent_id ? (
              <Badge tone="info" className="inline-flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                forked
              </Badge>
            ) : null}
            {data.stats.ratio !== null ? (
              <Badge
                tone={data.stats.ratio >= 0.7 ? "ok" : data.stats.ratio >= 0.4 ? "info" : "warn"}
                className="inline-flex items-center gap-1"
                data-testid="stat-likes"
              >
                <ThumbsUp className="h-3 w-3" />
                {Math.round(data.stats.ratio * 100)}% · {data.stats.likes + data.stats.dislikes}표
              </Badge>
            ) : null}
            {data.stats.fork_count > 0 ? (
              <Badge
                tone="muted"
                className="inline-flex items-center gap-1"
                data-testid="stat-forks"
              >
                <GitFork className="h-3 w-3" />
                {data.stats.fork_count} forks
              </Badge>
            ) : null}
            {data.stats.subscriber_count > 0 ? (
              <Badge
                tone="muted"
                className="inline-flex items-center gap-1"
                data-testid="stat-subs"
              >
                <Users className="h-3 w-3" />
                {data.stats.subscriber_count}
              </Badge>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
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
            <Button
              variant={subscribed ? "outlined" : "secondary"}
              onClick={onToggleSubscribe}
              loading={subBusy}
              disabled={subBusy}
              leftIcon={subscribed ? <BellRing className="lu" /> : <BellPlus className="lu" />}
              data-testid="subscribe-button"
            >
              {subscribed ? "구독 중" : "구독"}
            </Button>
            <Link
              to={`/@${handle}/${slug}/genealogy`}
              className="btn btn-ghost inline-flex items-center gap-1.5"
              data-testid="genealogy-link"
            >
              <Network className="lu" />
              Genealogy
            </Link>
            <a
              href={`/api/public/agents/${handle}/${slug}/feed.json`}
              className="btn btn-ghost inline-flex items-center gap-1.5"
              data-testid="feed-json-link"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Rss className="lu" />
              JSON Feed
            </a>
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
