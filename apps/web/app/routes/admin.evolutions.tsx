import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { Link, redirect, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
import type { Route } from "./+types/admin.evolutions";

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
  agent_id: string;
  agent_slug: string;
  agent_name: string;
  agent_handle: string;
};

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weaver · Evolutions admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  if (!session) throw redirect("/login");

  let evolutions: Evolution[] = [];
  const res = await callRuntime(env, "/api/admin/evolutions", request);
  if (res.ok) {
    try {
      evolutions = ((await res.json()) as { evolutions: Evolution[] }).evolutions ?? [];
    } catch {}
  } else if (isDev(env)) {
    // Dev fallback — 5 rows, one per strategy, mixed statuses.
    const base = Date.now();
    const strategies = ["concise", "specific", "cot", "role", "format"] as const;
    evolutions = strategies.map((strategy, i) => ({
      id: `dev-evo-${i}`,
      agent_version_id: `dev-ver-${i}`,
      strategy,
      shadow_case_count: 4,
      shadow_wins: 3 - (i % 2),
      shadow_losses: i % 2,
      win_rate: (3 - (i % 2)) / 4,
      suggested_at: i < 3 ? base - i * 3_600_000 : null,
      accepted_at: i === 0 ? base - 60_000 : null,
      rejected_at: i === 4 ? base - 7_200_000 : null,
      created_at: base - i * 3_600_000,
      agent_id: `dev-agent-${i}`,
      agent_slug: "hn-digest",
      agent_name: "HN Digest",
      agent_handle: "alex",
    }));
  }

  return { evolutions, session };
}

export default function AdminEvolutionsRoute() {
  const { evolutions } = useLoaderData<typeof loader>();
  const accepted = evolutions.filter((e) => e.accepted_at).length;
  const suggested = evolutions.filter(
    (e) => e.suggested_at && !e.accepted_at && !e.rejected_at,
  ).length;
  const rejected = evolutions.filter((e) => e.rejected_at).length;

  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">admin · evolutions</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help#evolution" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />홈
          </Link>
        </nav>
      </header>

      <section className="px-8 pt-14 pb-6 md:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <Sparkles className="h-3 w-3" />
            evolution engine · candidates (최근 200)
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            <span className="gradient-text font-medium">Evolutions</span> 관리 콘솔
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            매일 밤 Cron 이 top agent 에 5 가지 prompt mutation 을 돌려 candidate 를 생성합니다.
            shadow eval 승률이 기준을 넘으면 suggested, 크리에이터가 accept 하면 v2 로 승격.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <MetricTile label="suggested" value={suggested} tone="info" />
            <MetricTile label="accepted" value={accepted} tone="ok" />
            <MetricTile label="rejected" value={rejected} tone="warn" />
          </div>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          {evolutions.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface-1 px-8 py-10 text-center text-sm text-text-tertiary">
              아직 generation 된 candidate 가 없어요 — nightly cron 이 한 번 돌고 나면 여기에
              나타납니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-border bg-surface-1">
              <table className="w-full border-collapse text-sm" data-testid="evolutions-table">
                <thead className="bg-surface-2">
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
                    <th className="px-4 py-2">agent</th>
                    <th className="px-4 py-2">strategy</th>
                    <th className="px-4 py-2">cases</th>
                    <th className="px-4 py-2">wins/losses</th>
                    <th className="px-4 py-2">win rate</th>
                    <th className="px-4 py-2">status</th>
                    <th className="px-4 py-2">created</th>
                  </tr>
                </thead>
                <tbody>
                  {evolutions.map((e) => (
                    <tr key={e.id} className="border-t border-border" data-testid="evolution-row">
                      <td className="px-4 py-2">
                        <Link
                          to={`/@${e.agent_handle}/${e.agent_slug}`}
                          className="text-weaver-cyan hover:underline"
                        >
                          @{e.agent_handle}/{e.agent_slug}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.strategy}</td>
                      <td className="px-4 py-2 font-mono text-xs text-text-tertiary">
                        {e.shadow_case_count}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-text-tertiary">
                        {e.shadow_wins}/{e.shadow_losses}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {e.win_rate !== null ? `${Math.round(e.win_rate * 100)}%` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge e={e} />
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-text-tertiary">
                        {new Date(e.created_at).toISOString().slice(5, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ e }: { e: Evolution }) {
  if (e.accepted_at) return <Badge tone="ok">accepted</Badge>;
  if (e.rejected_at) return <Badge tone="warn">rejected</Badge>;
  if (e.suggested_at) return <Badge tone="info">suggested</Badge>;
  return <Badge tone="muted">candidate</Badge>;
}

function MetricTile({
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
