import { ArrowLeft, Clock, DollarSign, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { Badge } from "~/components/ui";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
import type { Route } from "./+types/tools.$toolId.runs.$runId";

type RunDetail = {
  run: {
    id: string;
    tool_id: string;
    tool_version: number;
    status: string;
    current_node_id: string | null;
    trace_id: string | null;
    created_at: number;
    updated_at: number;
    completed_at: number | null;
    cost_usd_micro: number;
  };
  history: Array<{
    id: string;
    run_id: string;
    node_id: string;
    node_type: string;
    input: string | null;
    output: string | null;
    duration_ms: number | null;
    cost_usd_micro: number | null;
    span_id: string | null;
    error_message: string | null;
    created_at: number;
  }>;
};

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Weaver · ${params.toolId} · run ${params.runId}` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  // Anonymous visitors see the empty placeholder — useful for the design system.
  let detail: RunDetail | null = null;
  let error: string | null = null;
  if (session) {
    const res = await callRuntime(env, `/api/runs/${params.runId}`, request);
    if (res.ok) {
      try {
        detail = (await res.json()) as RunDetail;
      } catch {
        error = "응답 파싱 실패";
      }
    } else if (isDev(env)) {
      // Dev Playwright: runtime isn't reachable (502/503/missing). Seed a
      // realistic 4-step waterfall so the page renders with data and visual
      // snapshots stay stable.
      detail = devMockRun(params.toolId, params.runId);
    } else if (res.status === 404) {
      error = "이 run 을 찾을 수 없어요 (다른 org 이거나 삭제됨).";
    } else {
      error = `runtime 오류 (${res.status})`;
    }
  }
  return { session, detail, error, params };
}

function devMockRun(toolId: string, runId: string): RunDetail {
  const start = Date.now() - 9_000;
  return {
    run: {
      id: runId,
      tool_id: toolId,
      tool_version: 1,
      status: "complete",
      current_node_id: "seed-out1",
      trace_id: "a".repeat(32),
      created_at: start,
      updated_at: start + 9_000,
      completed_at: start + 9_000,
      cost_usd_micro: 1200,
    },
    history: [
      {
        id: "h1",
        run_id: runId,
        node_id: "seed-in1",
        node_type: "input",
        input: JSON.stringify({ order_id: "ord_42" }),
        output: null,
        duration_ms: 320,
        cost_usd_micro: 0,
        span_id: "0000000000000001",
        error_message: null,
        created_at: start + 1_000,
      },
      {
        id: "h2",
        run_id: runId,
        node_id: "seed-ag1",
        node_type: "agent",
        input: null,
        output: "refund ok",
        duration_ms: 2400,
        cost_usd_micro: 850,
        span_id: "0000000000000002",
        error_message: null,
        created_at: start + 3_500,
      },
      {
        id: "h3",
        run_id: runId,
        node_id: "seed-br1",
        node_type: "branch",
        input: null,
        output: "approve",
        duration_ms: 180,
        cost_usd_micro: 0,
        span_id: "0000000000000003",
        error_message: null,
        created_at: start + 6_200,
      },
      {
        id: "h4",
        run_id: runId,
        node_id: "seed-out1",
        node_type: "output",
        input: null,
        output: "200 ok",
        duration_ms: 260,
        cost_usd_micro: 0,
        span_id: "0000000000000004",
        error_message: null,
        created_at: start + 8_600,
      },
    ],
  };
}

export default function TraceRoute({ params }: Route.ComponentProps) {
  const { detail, error } = useLoaderData<typeof loader>();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const history = detail?.history ?? [];
  const selected = selectedIndex !== null ? history[selectedIndex] : null;

  const totalDurationMs = detail
    ? Math.max(0, (detail.run.completed_at ?? detail.run.updated_at) - detail.run.created_at)
    : null;
  const stepCount = history.length;
  const totalNeurons = history.reduce((sum, h) => sum + (h.cost_usd_micro ?? 0), 0);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <header className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            to={`/builder/${params.toolId}`}
            className="btn btn-ghost btn-sm"
            aria-label="Back to builder"
          >
            <ArrowLeft className="lu" />
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              trace
            </span>
            <h1 className="text-sm font-semibold tracking-tight">Trace · {params.runId}</h1>
            <StatusBadge status={detail?.run.status ?? (error ? "missing" : "loading")} />
          </div>
        </div>
        <div className="font-mono text-[10px] text-text-tertiary">
          tool {params.toolId}
          {detail?.run.trace_id ? (
            <>
              {" · trace "}
              <span title={detail.run.trace_id}>{detail.run.trace_id.slice(0, 12)}…</span>
            </>
          ) : null}
        </div>
      </header>

      {error ? (
        <section className="px-8 py-8">
          <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-3 gap-4 px-8 py-6">
        <StatTile
          icon={<Clock className="lu" />}
          label="duration"
          value={totalDurationMs !== null ? formatMs(totalDurationMs) : "—"}
          hint="start → end"
        />
        <StatTile
          icon={<Zap className="lu" />}
          label="steps"
          value={stepCount > 0 ? String(stepCount) : "—"}
          hint={
            detail
              ? `${history.filter((h) => h.error_message).length} errored`
              : "agent · tool · branch"
          }
        />
        <StatTile
          icon={<DollarSign className="lu" />}
          label="cost"
          value={totalNeurons > 0 ? `${totalNeurons} μ$` : "0 μ$"}
          hint="USD micro · estimate"
        />
      </section>

      <section className="px-8">
        <div className="card">
          <div className="card-h">Waterfall · node timeline</div>
          <div className="card-b">
            {history.length === 0 ? (
              <div className="empty">
                <div className="ico">—</div>
                <h4>아직 step 이 기록되지 않았어요</h4>
                <p>
                  Cron (매 1분) 이 pending → running 으로 한 step 씩 진행하며 row 를 추가합니다.
                  새로고침하면 timeline 이 자랍니다.
                </p>
              </div>
            ) : (
              <Waterfall
                history={history}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            )}
          </div>
        </div>
      </section>

      <section className="px-8 py-6">
        <div className="card">
          <div className="card-h">Selected span · input/output</div>
          <div className="card-b">
            {selected ? (
              <SpanDetail row={selected} />
            ) : (
              <div className="empty">
                <div className="ico">▸</div>
                <h4>span 을 선택하세요</h4>
                <p>
                  waterfall 행을 클릭하면 node_type · span_id · prompt · 응답 · 에러 메시지가 여기에
                  표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete") return <Badge tone="ok">complete</Badge>;
  if (status === "failed") return <Badge tone="warn">failed</Badge>;
  if (status === "running")
    return (
      <Badge tone="running" pulse>
        running
      </Badge>
    );
  if (status === "pending") return <Badge tone="info">pending</Badge>;
  if (status === "missing") return <Badge tone="muted">missing</Badge>;
  return <Badge tone="muted">{status}</Badge>;
}

function Waterfall({
  history,
  selectedIndex,
  onSelect,
}: {
  history: RunDetail["history"];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}) {
  if (history.length === 0) return null;
  const t0 = history[0]?.created_at ?? 0;
  const tN = history[history.length - 1]?.created_at ?? t0;
  const spanMs = Math.max(1, tN - t0);

  return (
    <ul className="flex flex-col gap-1.5" data-testid="waterfall">
      {history.map((row, i) => {
        const offsetPct = ((row.created_at - t0) / spanMs) * 100;
        const durPct = Math.max(2, ((row.duration_ms ?? 50) / spanMs) * 100);
        const active = selectedIndex === i;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={`grid w-full grid-cols-[120px_1fr_80px] items-center gap-3 rounded-[6px] border px-3 py-2 text-left text-xs transition ${
                active
                  ? "border-weaver-indigo bg-weaver-indigo/10"
                  : "border-border hover:border-border-strong hover:bg-surface-2"
              }`}
              data-testid={`waterfall-row-${i}`}
            >
              <span className="font-mono text-text-secondary">
                {row.node_type} · {row.node_id || "—"}
              </span>
              <span className="relative h-3 rounded-[2px] bg-surface-2">
                <span
                  className="absolute top-0 h-full rounded-[2px] bg-weaver-indigo/60"
                  style={{ left: `${offsetPct}%`, width: `${Math.min(100 - offsetPct, durPct)}%` }}
                />
              </span>
              <span className="text-right font-mono text-text-tertiary">
                {formatMs(row.duration_ms ?? 0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SpanDetail({ row }: { row: RunDetail["history"][number] }) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <KV k="node_id" v={row.node_id || "—"} />
        <KV k="node_type" v={row.node_type} />
        <KV k="span_id" v={row.span_id ?? "—"} mono />
        <KV k="duration" v={formatMs(row.duration_ms ?? 0)} />
        <KV k="cost (μ$)" v={String(row.cost_usd_micro ?? 0)} />
        <KV k="created_at" v={new Date(row.created_at).toISOString()} mono />
      </div>
      {row.error_message ? (
        <div className="rounded-[6px] border border-rose-500/30 bg-rose-500/5 px-3 py-2 font-mono text-rose-300">
          {row.error_message}
        </div>
      ) : null}
      <details className="rounded-[6px] border border-border bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer font-semibold">input</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-text-secondary">
          {row.input ?? "(없음)"}
        </pre>
      </details>
      <details className="rounded-[6px] border border-border bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer font-semibold">output</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-text-secondary">
          {row.output ?? "(없음)"}
        </pre>
      </details>
    </div>
  );
}

function KV({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {k}
      </span>
      <span className={mono ? "font-mono text-text-primary" : "text-text-primary"}>{v}</span>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card">
      <div className="card-b flex flex-col gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          <span className="text-text-secondary">{icon}</span>
          {label}
        </div>
        <div className="text-xl font-semibold tracking-tight" data-testid={`stat-${label}`}>
          {value}
        </div>
        <div className="font-mono text-[10px] text-text-tertiary">{hint}</div>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}
