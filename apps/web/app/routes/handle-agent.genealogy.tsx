import { ArrowLeft, BookOpen, GitFork, Network } from "lucide-react";
import { Link, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import { callRuntime, isDev } from "~/lib/session.server";
import type { Route } from "./+types/handle-agent.genealogy";

type Node = {
  id: string;
  handle: string;
  slug: string;
  name: string;
  depth: number;
  fork_of_agent_id: string | null;
};

type Genealogy = {
  current: { id: string; handle: string; slug: string; name: string };
  ancestors: Node[];
  descendants: Node[];
};

export function meta({ data }: Route.MetaArgs) {
  if (!data?.current) return [{ title: "Genealogy · Weaver" }];
  return [{ title: `${data.current.name} · genealogy · Weaver` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { prefixedHandle, slug } = params as { prefixedHandle: string; slug: string };
  if (!prefixedHandle.startsWith("@")) {
    throw new Response("not found", { status: 404 });
  }
  const handle = prefixedHandle.slice(1);
  const res = await callRuntime(env, `/api/public/agents/${handle}/${slug}/genealogy`, request);

  if (res.ok) {
    try {
      const body = (await res.json()) as Genealogy;
      return { ...body, handle, slug };
    } catch {}
  }

  if (isDev(env)) {
    // Dev fallback: seed a tiny tree so the SVG renders.
    return {
      current: { id: "cur", handle, slug, name: slug.replace(/-/g, " ") },
      ancestors: [
        {
          id: "anc1",
          handle: "origin",
          slug: "hn-digest",
          name: "HN Digest",
          depth: 1,
          fork_of_agent_id: null,
        },
      ],
      descendants: [
        {
          id: "dsc1",
          handle: "alex",
          slug: "hn-morning",
          name: "HN Morning",
          depth: 1,
          fork_of_agent_id: "cur",
        },
        {
          id: "dsc2",
          handle: "sora",
          slug: "hn-evening",
          name: "HN Evening",
          depth: 1,
          fork_of_agent_id: "cur",
        },
        {
          id: "dsc3",
          handle: "hyun",
          slug: "hn-weekly",
          name: "HN Weekly",
          depth: 2,
          fork_of_agent_id: "dsc1",
        },
      ] as Node[],
      handle,
      slug,
    };
  }

  throw new Response("agent not found", { status: 404 });
}

export default function GenealogyRoute() {
  const { current, ancestors, descendants, handle, slug } = useLoaderData<typeof loader>();

  // Sort ancestors deepest-first (root at the top) for the rendering.
  const ancestorsTop = [...ancestors].sort((a, b) => b.depth - a.depth);
  const byDepth = new Map<number, Node[]>();
  for (const d of descendants) {
    if (!byDepth.has(d.depth)) byDepth.set(d.depth, []);
    byDepth.get(d.depth)?.push(d);
  }
  const maxDescendantDepth = Math.max(0, ...[...byDepth.keys()]);

  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">genealogy</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help#public-agent" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to={`/@${handle}/${slug}`} className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />
            agent 돌아가기
          </Link>
        </nav>
      </header>

      <section className="px-8 pt-14 pb-6 md:px-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <Network className="h-3 w-3" />
            lineage · ancestors {ancestors.length} · descendants {descendants.length}
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            <span className="gradient-text font-medium">{current.name}</span> 의 족보
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            fork 관계로 연결된 agent 들의 계보예요. 위로는 이 agent 가 어디서 왔는지, 아래로는 누가
            다시 이걸 fork 해 갔는지 보여줍니다 (최대 깊이 3).
          </p>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-4xl">
          <ol className="flex flex-col items-center gap-3" data-testid="genealogy-list">
            {ancestorsTop.length === 0 ? (
              <li>
                <span className="rounded-full border border-border bg-surface-1 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
                  root · 원류 agent
                </span>
              </li>
            ) : null}
            {ancestorsTop.map((n) => (
              <NodeCard key={n.id} node={n} tone="ancestor" />
            ))}
            <NodeCard
              key="current"
              node={{
                id: current.id,
                handle: current.handle,
                slug: current.slug,
                name: current.name,
                depth: 0,
                fork_of_agent_id: null,
              }}
              tone="current"
            />
            {maxDescendantDepth > 0 ? (
              Array.from({ length: maxDescendantDepth }, (_, i) => i + 1).map((depth) => {
                const group = byDepth.get(depth) ?? [];
                return (
                  <li
                    key={`descendants-depth-${depth}`}
                    className="flex flex-col items-center gap-2"
                  >
                    <DownStem />
                    <div className="flex flex-wrap items-stretch justify-center gap-2">
                      {group.map((n) => (
                        <NodeCard key={n.id} node={n} tone="descendant" inline />
                      ))}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="text-xs text-text-tertiary">
                아직 이 agent 를 fork 한 사람이 없어요.
              </li>
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}

function NodeCard({
  node,
  tone,
  inline,
}: {
  node: Node;
  tone: "ancestor" | "current" | "descendant";
  inline?: boolean;
}) {
  const isCurrent = tone === "current";
  const cls = isCurrent
    ? "border-weaver-indigo bg-weaver-indigo/10 ring-1 ring-weaver-indigo/30"
    : tone === "ancestor"
      ? "border-border bg-surface-1"
      : "border-border bg-surface-1";
  const href = `/@${node.handle}/${node.slug}`;

  const inner = (
    <Link
      to={href}
      className={`flex w-[240px] items-center gap-2 rounded-[10px] border px-3 py-2 transition hover:border-weaver-indigo ${cls}`}
      data-testid={`genealogy-node-${tone}`}
    >
      <GitFork
        className={`h-3.5 w-3.5 ${isCurrent ? "text-weaver-indigo" : "text-text-tertiary"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-text-primary">{node.name}</div>
        <div className="truncate font-mono text-[10px] text-text-tertiary">
          @{node.handle}/{node.slug}
        </div>
      </div>
      {isCurrent ? <Badge tone="ok">현재</Badge> : null}
    </Link>
  );

  if (inline) return inner;
  return (
    <li className="flex flex-col items-center gap-2">
      {tone === "current" ? <DownStem /> : null}
      {inner}
    </li>
  );
}

function DownStem() {
  return <span aria-hidden className="h-5 w-px bg-weaver-indigo/40" />;
}
