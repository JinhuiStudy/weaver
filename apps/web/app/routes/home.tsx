import { ArrowRight, Github, Sparkles } from "lucide-react";
import { Link, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { WvNode } from "~/components/canvas/WvNode";
import { Badge } from "~/components/ui";
import type { Session } from "~/lib/session";
import { callRuntime, loadSessionServer } from "~/lib/session.server";
import type { Route } from "./+types/home";

type AgentSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  category: string | null;
  updated_at: number;
};

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

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  let agents: AgentSummary[] = [];
  if (session) {
    const res = await callRuntime(env, "/api/agents", request);
    if (res.ok) {
      try {
        agents = ((await res.json()) as { agents: AgentSummary[] }).agents ?? [];
      } catch {
        agents = [];
      }
    }
  }
  return { session, agents };
}

export default function Home() {
  const { session, agents } = useLoaderData<typeof loader>();
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
          {session ? (
            <UserBadge session={session} />
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm" data-testid="home-login-link">
              로그인
            </Link>
          )}
          <Link
            to="/builder/demo"
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            빌더 열기
            <ArrowRight className="lu" />
          </Link>
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
            <Link
              to="/builder/demo"
              className="btn btn-primary btn-lg inline-flex items-center gap-1.5"
            >
              시작하기
              <ArrowRight className="lu" />
            </Link>
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

      {session ? <MyAgentsSection agents={agents} /> : null}

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

function MyAgentsSection({ agents }: { agents: AgentSummary[] }) {
  return (
    <section className="px-8 pt-8 pb-12 md:px-16" data-testid="my-agents-section">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            내 Agents
          </h2>
          <Link
            to="/builder/new"
            className="text-xs text-weaver-indigo hover:underline"
            data-testid="new-agent-link"
          >
            + 새 agent 만들기
          </Link>
        </div>
        {agents.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <Link
                key={a.id}
                to={`/builder/${a.id}`}
                className="card card-b hover:border-weaver-indigo"
                data-testid="agent-card"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                    @{a.slug}
                  </span>
                  <Badge tone={a.visibility === "public" ? "ok" : "info"}>{a.visibility}</Badge>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold tracking-tight">{a.name}</h3>
                {a.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{a.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-b text-center">
              <p className="text-sm text-text-secondary">
                아직 저장한 agent 가 없어요. 빌더에서 만들고{" "}
                <span className="font-mono text-weaver-indigo">Save to workspace</span> 를 누르면
                여기에 나타납니다.
              </p>
              <Link
                to="/builder/new"
                className="btn btn-primary btn-sm mt-4 inline-flex items-center gap-1.5"
              >
                첫 agent 만들기
                <ArrowRight className="lu" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function UserBadge({ session }: { session: Session }) {
  const handle = session.user.handle;
  const avatar = session.user.avatar_url;
  return (
    <div className="flex items-center gap-2" data-testid="user-badge">
      {avatar ? (
        <img src={avatar} alt={handle} className="h-6 w-6 rounded-full border border-border" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-1 text-xs text-text-secondary">
          {handle.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="font-mono text-xs text-text-secondary">@{handle}</span>
      <form method="POST" action="/auth/logout">
        <button type="submit" className="btn btn-ghost btn-sm" data-testid="logout-button">
          로그아웃
        </button>
      </form>
    </div>
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
