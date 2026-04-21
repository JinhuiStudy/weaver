import { ArrowRight, Github, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { WvNode } from "~/components/canvas/WvNode";
import { Badge, Button } from "~/components/ui";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Weaver · AI 에이전트를 내부툴의 원자 단위로" },
    {
      name: "description",
      content:
        "자연어로 내부툴을 만들면 AI 에이전트 워크플로우로 돌아가고, 모든 실행에 trace·비용·eval이 붙습니다. 전부 $0.",
    },
  ];
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">v0.0.0</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/design" className="btn btn-ghost">
            Design System
          </Link>
          <a
            href="https://github.com/getweaver/weaver"
            className="btn btn-ghost"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Github className="lu" />
            GitHub
          </a>
          <Button variant="primary" size="sm" rightIcon={<ArrowRight className="lu" />}>
            빌더 열기
          </Button>
        </nav>
      </header>

      <section className="px-8 pt-24 pb-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-indigo">
            <span className="inline-block h-px w-6 bg-weaver-indigo" />
            Open-source · $0 Free-tier
          </div>
          <h1 className="max-w-4xl text-[56px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[64px]">
            AI 에이전트를 내부툴의{" "}
            <em
              className="font-medium not-italic"
              style={{
                backgroundImage: "linear-gradient(90deg, var(--weaver-indigo), var(--weaver-cyan))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              원자 단위
            </em>
            로.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary">
            자연어로 내부툴을 만들면, 그 툴은 AI 에이전트 워크플로우로 돌아가고, 모든 실행은
            자동으로 <b className="text-text-primary">trace · 비용 · eval</b>이 붙습니다. 전부 무료
            tier만으로.
          </p>

          <div className="mt-10 flex items-center gap-3">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="lu" />}>
              시작하기
            </Button>
            <Link to="/design" className="btn btn-outlined btn-lg inline-flex items-center gap-1.5">
              <Sparkles className="lu" />
              Design System 보기
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap gap-6 font-mono text-xs text-text-tertiary">
            <span>
              <b className="text-text-primary">4</b> layers
            </span>
            <span>
              <b className="text-text-primary">5</b> node types
            </span>
            <span>
              <b className="text-text-primary">$0</b> 고정 월 비용
            </span>
            <span>
              <b className="text-text-primary">2026-W30</b> launch target
            </span>
          </div>
        </div>
      </section>

      <section className="canvas-bg border-y border-border px-8 py-16 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8">
          <WvNode type="input" label="webhook" body="POST /refund" />
          <WvNode
            type="agent"
            kind="AGENT · CLAUDE"
            label="policy_check"
            body="model: sonnet-4-6 · temp: 0.2"
            state="running"
            statusPill={<span style={{ color: "var(--weaver-indigo)" }}>running</span>}
          />
          <WvNode type="tool" label="stripe_lookup" body="GET /charges/:id" state="selected" />
          <WvNode type="branch" label="within_7d?" body="duration ≤ 7d" />
          <WvNode type="output" label="approve_or_slack" body="POST webhook" durationPill="2.1s" />
        </div>
      </section>

      <section className="px-8 py-20 md:px-16">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="card-b">
                <Badge tone={f.tone} className="mb-3" pulse={f.tone === "running"}>
                  {f.tone}
                </Badge>
                <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-8 py-10 text-xs text-text-tertiary md:px-16">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>
            © 2026 Weaver · Apache 2.0 ·{" "}
            <a href="mailto:dev.park.jinhui@gmail.com" className="hover:text-text-primary">
              박진희
            </a>
          </span>
          <span className="font-mono">weaver.pages.dev</span>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    tone: "ok" as const,
    title: "관측성은 구조다",
    body: "모든 실행이 OTEL trace. Langfuse를 따로 붙일 필요 없음.",
  },
  {
    tone: "info" as const,
    title: "Eval 게이트",
    body: "배포 전 데이터셋·어서션이 자동 실행. 임계값 미달이면 블록.",
  },
  {
    tone: "running" as const,
    title: "Shadow 트래픽",
    body: "새 버전을 real 요청 N%로 섀도 실행, 정량 비교 후 승격.",
  },
];

function WeaverMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 56 56" role="img" aria-label="Weaver logo">
      <title>Weaver</title>
      <path
        d="M8 20 C 20 20, 20 36, 32 36"
        stroke="var(--weaver-indigo)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 36 C 20 36, 20 20, 32 20"
        stroke="var(--weaver-cyan)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 20 C 44 20, 44 36, 48 36"
        stroke="var(--node-agent)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M32 36 C 44 36, 44 20, 48 20"
        stroke="var(--node-tool)"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
