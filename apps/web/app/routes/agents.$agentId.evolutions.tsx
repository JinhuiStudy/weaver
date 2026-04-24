import { ArrowLeft, BookOpen, Check, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge, Button } from "~/components/ui";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
import type { Route } from "./+types/agents.$agentId.evolutions";

type Evolution = {
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
  candidate_prompt: string | null;
};

type LoaderPayload = {
  agentId: string;
  evolutions: Evolution[];
  original_prompt: string | null;
  agent_name: string;
  agent_handle: string;
  agent_slug: string;
};

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Evolutions · Weaver" }];
  return [{ title: `${data.agent_name} · evolutions · Weaver` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  if (!session) throw redirect("/login");

  const agentId = params.agentId;
  const res = await callRuntime(env, `/api/agents/${agentId}/evolutions`, request);

  if (res.ok) {
    try {
      const body = (await res.json()) as { agent_id: string; evolutions: Evolution[] };
      // Fetch the original prompt + display metadata from /api/agents/:id.
      const agentRes = await callRuntime(env, `/api/agents/${agentId}`, request);
      let originalPrompt: string | null = null;
      let name = "Agent";
      const handle = session.user.handle;
      let slug = "agent";
      if (agentRes.ok) {
        const agentBody = (await agentRes.json()) as {
          name: string;
          slug: string;
          definition: {
            nodes?: Array<{ type?: string; data?: { system_prompt?: string } }>;
          } | null;
        };
        const agentNode = (agentBody.definition?.nodes ?? []).find((n) => n?.type === "agent");
        originalPrompt = agentNode?.data?.system_prompt ?? null;
        name = agentBody.name;
        slug = agentBody.slug;
      }
      return {
        agentId,
        evolutions: body.evolutions,
        original_prompt: originalPrompt,
        agent_name: name,
        agent_handle: handle,
        agent_slug: slug,
      } satisfies LoaderPayload;
    } catch {}
  }

  if (isDev(env)) {
    const base = Date.now();
    const strategies = [
      { kind: "concise", wr: 0.75 },
      { kind: "specific", wr: 0.8 },
      { kind: "cot", wr: 0.5 },
      { kind: "role", wr: 0.9 },
      { kind: "format", wr: 0.25 },
    ] as const;
    return {
      agentId,
      evolutions: strategies.map((s, i) => ({
        id: `dev-evo-${agentId}-${i}`,
        agent_version_id: `dev-ver-${agentId}`,
        strategy: s.kind,
        shadow_case_count: 4,
        shadow_wins: Math.round(s.wr * 4),
        shadow_losses: 4 - Math.round(s.wr * 4),
        win_rate: s.wr,
        suggested_at: s.wr >= 0.6 ? base - i * 3600_000 : null,
        accepted_at: null,
        rejected_at: s.wr < 0.3 ? base - 7200_000 : null,
        created_at: base - i * 7200_000,
        candidate_prompt: `${directiveFor(s.kind)}\n\nYou summarise news stories.`,
      })),
      original_prompt: "You summarise news stories.",
      agent_name: "HN Digest",
      agent_handle: session.user.handle,
      agent_slug: "hn-digest",
    } satisfies LoaderPayload;
  }

  throw new Response("not found", { status: 404 });
}

function directiveFor(kind: string): string {
  switch (kind) {
    case "concise":
      return "Be concise — prefer a tight answer over a long one.";
    case "specific":
      return "Include concrete examples, numbers, and identifiers wherever useful.";
    case "cot":
      return "Think step-by-step before you answer; show the reasoning briefly.";
    case "role":
      return "You are a senior editor with deep domain expertise.";
    case "format":
      return "Respond as JSON with { summary, details, confidence } keys only.";
    default:
      return "";
  }
}

export default function EvolutionsRoute() {
  const data = useLoaderData<typeof loader>();
  const { agentId, evolutions, original_prompt, agent_name, agent_handle, agent_slug } = data;
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [local, setLocal] = useState<Evolution[]>(evolutions);

  const suggested = local.filter((e) => e.suggested_at && !e.accepted_at && !e.rejected_at);
  const accepted = local.filter((e) => e.accepted_at);
  const rejected = local.filter((e) => e.rejected_at);

  async function act(evoId: string, action: "accept" | "reject") {
    setBusy(evoId);
    try {
      const res = await fetch(`/api/evolutions/${evoId}/${action}`, { method: "POST" });
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocal((prev) =>
        prev.map((e) =>
          e.id === evoId
            ? {
                ...e,
                accepted_at: action === "accept" ? Date.now() : e.accepted_at,
                rejected_at: action === "reject" ? Date.now() : e.rejected_at,
              }
            : e,
        ),
      );
      setToast(action === "accept" ? "🧬 v2 로 승격됨" : "candidate 거절됨");
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast(`실패: ${err instanceof Error ? err.message : String(err)}`);
      window.setTimeout(() => setToast(null), 3500);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">evolutions</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help#evolution" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to={`/builder/${agentId}`} className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />
            빌더
          </Link>
        </nav>
      </header>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed top-14 left-1/2 z-20 -translate-x-1/2 rounded-full border border-weaver-indigo/40 bg-surface-1/90 px-4 py-2 text-xs text-text-primary shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur"
          data-testid="evo-toast"
        >
          {toast}
        </div>
      ) : null}

      <section className="px-8 pt-14 pb-6 md:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <Sparkles className="h-3 w-3" />
            candidates · @{agent_handle}/{agent_slug}
          </div>
          <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
            <span className="gradient-text font-medium">{agent_name}</span> 의 진화 제안
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Workers AI 가 매일 밤 이 agent 의 프롬프트를 미세 변형해 shadow eval 로 승률을 계산해요.
            60% 이상 이긴 candidate 는 suggested 로 뜹니다. accept 하면 v2 로 승격.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Metric label="suggested" value={suggested.length} tone="info" />
            <Metric label="accepted" value={accepted.length} tone="ok" />
            <Metric label="rejected" value={rejected.length} tone="warn" />
          </div>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-5xl space-y-4" data-testid="evo-cards">
          {local.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface-1 px-8 py-10 text-center text-sm text-text-tertiary">
              아직 생성된 candidate 가 없어요. 24시간 내에 nightly cron 이 한 번 도네요.
            </div>
          ) : null}
          {local.map((e) => (
            <article
              key={e.id}
              className="card overflow-hidden"
              data-testid="evo-card"
              data-evo-strategy={e.strategy}
            >
              <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge tone="muted">{e.strategy}</Badge>
                  <StateBadge e={e} />
                  {e.win_rate !== null ? (
                    <span className="font-mono text-xs text-text-tertiary">
                      win rate <b className="text-text-primary">{Math.round(e.win_rate * 100)}%</b>
                      <span className="ml-2 opacity-60">
                        ({e.shadow_wins}/{e.shadow_wins + e.shadow_losses})
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-text-tertiary">pending eval</span>
                  )}
                </div>
                {!e.accepted_at && !e.rejected_at && e.suggested_at ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => act(e.id, "reject")}
                      disabled={busy !== null}
                      leftIcon={<X className="lu" />}
                      data-testid={`evo-reject-${e.strategy}`}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => act(e.id, "accept")}
                      disabled={busy !== null}
                      loading={busy === e.id}
                      leftIcon={<Check className="lu" />}
                      data-testid={`evo-accept-${e.strategy}`}
                    >
                      Accept v2
                    </Button>
                  </div>
                ) : null}
              </header>
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-border p-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
                    original prompt
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
                    {original_prompt ?? "(없음)"}
                  </pre>
                </div>
                <div className="p-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-weaver-cyan">
                    candidate prompt
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-primary">
                    {e.candidate_prompt ?? "(없음)"}
                  </pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StateBadge({ e }: { e: Evolution }) {
  if (e.accepted_at) return <Badge tone="ok">accepted</Badge>;
  if (e.rejected_at) return <Badge tone="warn">rejected</Badge>;
  if (e.suggested_at) return <Badge tone="info">suggested</Badge>;
  return <Badge tone="muted">candidate</Badge>;
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "info" | "warn";
}) {
  const color =
    tone === "ok" ? "text-emerald-400" : tone === "info" ? "text-weaver-indigo" : "text-amber-400";
  return (
    <div
      className="rounded-[10px] border border-border bg-surface-1/60 px-4 py-3 backdrop-blur"
      data-testid={`metric-${label}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
