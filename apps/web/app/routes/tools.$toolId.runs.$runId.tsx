import { ArrowLeft, Clock, DollarSign, Zap } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui";
import type { Route } from "./+types/tools.$toolId.runs.$runId";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Weaver · ${params.toolId} · run ${params.runId}` }];
}

/**
 * Trace viewer placeholder · Week 4 runtime → Week 5-6 OTEL + Axiom 합류.
 * 현재는 RunContext 페이지 구조만 선언: header · 3 stat tile · waterfall
 * placeholder · node-detail empty state. Playwright에서 로드 확인용.
 */
export default function TraceRoute({ params }: Route.ComponentProps) {
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
            <Badge tone="running" pulse>
              running
            </Badge>
          </div>
        </div>
        <div className="font-mono text-[10px] text-text-tertiary">tool {params.toolId}</div>
      </header>

      <section className="grid grid-cols-3 gap-4 px-8 py-6">
        <StatTile icon={<Clock className="lu" />} label="duration" value="—" hint="start→end" />
        <StatTile
          icon={<Zap className="lu" />}
          label="tokens"
          value="—"
          hint="prompt · completion"
        />
        <StatTile
          icon={<DollarSign className="lu" />}
          label="cost"
          value="—"
          hint="USD · cache hit %"
        />
      </section>

      <section className="px-8">
        <div className="card">
          <div className="card-h">Waterfall · node timeline</div>
          <div className="card-b">
            <div className="empty">
              <div className="ico">—</div>
              <h4>Live trace 스트림 연결 전</h4>
              <p>
                Week 5 (OTEL + Axiom) 에서 /runs/:id/stream SSE 로 span 이 실시간 waterfall 에
                채워질 예정입니다. 현재는 레이아웃 확정용 placeholder.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 py-6">
        <div className="card">
          <div className="card-h">Selected span · input/output</div>
          <div className="card-b">
            <div className="empty">
              <div className="ico">▸</div>
              <h4>span 을 선택하세요</h4>
              <p>
                waterfall 행을 클릭하면 해당 노드의 prompt · 응답 · 에러 페이로드가 여기에
                표시됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
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
        <div className="text-xl font-semibold tracking-tight">{value}</div>
        <div className="font-mono text-[10px] text-text-tertiary">{hint}</div>
      </div>
    </div>
  );
}
