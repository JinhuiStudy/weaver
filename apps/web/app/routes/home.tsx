import {
  Activity,
  ArrowRight,
  BookOpen,
  Compass,
  GitFork,
  Github,
  Rss,
  Search as SearchIcon,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { WvNode } from "~/components/canvas/WvNode";
import { Badge } from "~/components/ui";
import type { Session } from "~/lib/session";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
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

type RunSummary = {
  id: string;
  tool_id: string;
  status: string;
  created_at: number;
  completed_at: number | null;
  trace_id: string | null;
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
  let runs: RunSummary[] = [];
  if (session) {
    const [agentsRes, runsRes] = await Promise.all([
      callRuntime(env, "/api/agents", request),
      callRuntime(env, "/api/runs", request),
    ]);
    if (agentsRes.ok) {
      try {
        agents = ((await agentsRes.json()) as { agents: AgentSummary[] }).agents ?? [];
      } catch {
        agents = [];
      }
    }
    if (runsRes.ok) {
      try {
        runs = ((await runsRes.json()) as { runs: RunSummary[] }).runs ?? [];
      } catch {
        runs = [];
      }
    } else if (isDev(env)) {
      // Dev: runtime is offline, seed 3 fake runs so the "최근 runs" section
      // shows up and Playwright can assert against it.
      const now = Date.now();
      runs = [
        {
          id: "dev-run-0000001",
          tool_id: "demo",
          status: "complete",
          created_at: now - 30_000,
          completed_at: now - 15_000,
          trace_id: "a".repeat(32),
        },
        {
          id: "dev-run-0000002",
          tool_id: "demo",
          status: "running",
          created_at: now - 120_000,
          completed_at: null,
          trace_id: "b".repeat(32),
        },
        {
          id: "dev-run-0000003",
          tool_id: "demo",
          status: "failed",
          created_at: now - 1_800_000,
          completed_at: now - 1_500_000,
          trace_id: "c".repeat(32),
        },
      ];
    }
  }
  return { session, agents, runs };
}

export default function Home() {
  const { session, agents, runs } = useLoaderData<typeof loader>();
  return (
    <main className="relative min-h-screen">
      {/* Ambient gradient backdrop — sits behind everything, non-interactive. */}
      <div className="aurora-backdrop" aria-hidden />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">v0.0.0</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/explore" className="btn btn-ghost" data-testid="home-explore-link">
            <Compass className="lu" />
            Explore
          </Link>
          <Link to="/help" className="btn btn-ghost" data-testid="home-help-link">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to="/design" className="btn btn-ghost">
            Design System
          </Link>
          <a
            href="https://github.com/JinhuiStudy/weaver"
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

      <section className="relative px-8 pt-28 pb-24 md:px-16">
        <div className="hero-grid" aria-hidden />
        <div className="mx-auto max-w-5xl">
          <div className="fade-up fade-up-1 mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <span className="inline-block h-px w-6 bg-weaver-cyan" />
            Open-source · $0 forever · 2026-W30 launch
          </div>
          <h1 className="fade-up fade-up-1 max-w-4xl text-[56px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[72px]">
            Fork agents.
            <br />
            Rate them. <span className="gradient-text font-medium">They evolve.</span>
          </h1>
          <p className="fade-up fade-up-2 mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
            공개 에이전트를 한 번에 <b className="text-text-primary">fork</b> 하고, 👍/👎 로{" "}
            <b className="text-text-primary">rate</b> 하면, 매일 밤 Workers AI 가 프롬프트를 미세
            변형해 <b className="text-text-primary">evolve</b> 시킵니다. 유저 $0 · 운영 $0.
          </p>

          <form
            method="GET"
            action="/search"
            className="fade-up fade-up-2 mt-8 flex max-w-xl items-center gap-2"
            data-testid="home-search-form"
          >
            <div className="field-wrap flex-1">
              <span className="ico">
                <SearchIcon className="lu" />
              </span>
              <input
                name="q"
                type="search"
                placeholder="공개 agent 검색 — news summary · HN · CSS…"
                className="inp has-ico inp-lg"
                data-testid="home-search-input"
              />
            </div>
            <button type="submit" className="btn btn-outlined btn-lg">
              검색
            </button>
          </form>

          <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/builder/demo"
              className="btn btn-primary btn-lg cta-glow inline-flex items-center gap-1.5"
            >
              시작하기
              <ArrowRight className="lu" />
            </Link>
            <Link
              to="/help"
              className="btn btn-outlined btn-lg inline-flex items-center gap-1.5"
              data-testid="hero-help-link"
            >
              <BookOpen className="lu" />
              사용법 도움말
            </Link>
            <Link to="/design" className="btn btn-ghost btn-lg inline-flex items-center gap-1.5">
              <Sparkles className="lu" />
              Design System
            </Link>
          </div>

          <div className="fade-up fade-up-3 mt-14 grid max-w-3xl grid-cols-3 gap-4">
            <Metric icon={<GitFork className="lu" />} value="Fork" body="공개 agent 한 번에 복제" />
            <Metric icon={<Star className="lu" />} value="Rate" body="👍/👎 로 fitness 계산" />
            <Metric
              icon={<Sparkles className="lu" />}
              value="Evolve"
              body="밤새 자동 mutation + shadow eval"
            />
          </div>

          <div className="mt-14 flex flex-wrap gap-6 font-mono text-xs text-text-tertiary">
            <span>
              <b className="text-text-primary">5</b> node types
            </span>
            <span>
              <b className="text-text-primary">$0</b> 고정 월 비용
            </span>
            <span>
              <b className="text-text-primary">OTEL</b> trace 포함
            </span>
            <span>
              <b className="text-text-primary">Apache-2.0</b> OSS
            </span>
          </div>
        </div>
      </section>

      {session ? (
        <>
          <MyAgentsSection agents={agents} />
          <FeedLinkStrip />
          <RecentRunsSection runs={runs} />
        </>
      ) : null}

      <section className="canvas-bg relative border-y border-border px-8 py-20 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8">
          <div className="wv-float">
            <WvNode type="input" label="webhook" body="POST /refund" />
          </div>
          <div className="wv-float wv-float-d2">
            <WvNode
              type="agent"
              kind="AGENT · CLAUDE"
              label="policy_check"
              body="model: sonnet-4-6 · temp: 0.2"
              state="running"
              statusPill={<span style={{ color: "var(--weaver-indigo)" }}>running</span>}
            />
          </div>
          <div className="wv-float wv-float-d3">
            <WvNode type="tool" label="stripe_lookup" body="GET /charges/:id" state="selected" />
          </div>
          <div className="wv-float wv-float-d2">
            <WvNode type="branch" label="within_7d?" body="duration ≤ 7d" />
          </div>
          <div className="wv-float">
            <WvNode
              type="output"
              label="approve_or_slack"
              body="POST webhook"
              durationPill="2.1s"
            />
          </div>
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
          <div className="flex items-center gap-4 font-mono">
            <Link to="/help" className="hover:text-text-primary">
              도움말
            </Link>
            <Link to="/design" className="hover:text-text-primary">
              Design
            </Link>
            <a
              href="https://github.com/JinhuiStudy/weaver"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-text-primary"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeedLinkStrip() {
  return (
    <section className="px-8 pt-2 pb-4 md:px-16" data-testid="feed-link-strip">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/me/feed"
          className="group flex items-center justify-between gap-4 rounded-[10px] border border-border bg-surface-1/60 px-5 py-3 backdrop-blur transition hover:border-weaver-indigo hover:bg-weaver-indigo/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-weaver-indigo/40 bg-weaver-indigo/10 text-weaver-indigo">
              <Rss className="lu" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">내 구독 피드</div>
              <div className="text-xs text-text-tertiary">
                내가 구독한 agent 의 최근 output 을 한 눈에
              </div>
            </div>
          </div>
          <span className="font-mono text-xs text-text-tertiary group-hover:text-weaver-cyan">
            /me/feed →
          </span>
        </Link>
      </div>
    </section>
  );
}

function Metric({ icon, value, body }: { icon: ReactNode; value: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-1/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-weaver-cyan">
        {icon}
        {value}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-text-secondary">{body}</div>
    </div>
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
      {session.quota ? <NeuronsGauge quota={session.quota.neurons} /> : null}
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

function NeuronsGauge({ quota }: { quota: { used: number; cap: number; remaining: number } }) {
  const pct = Math.min(100, (quota.used / Math.max(1, quota.cap)) * 100);
  const tone = pct >= 80 ? "warn" : pct >= 50 ? "running" : "ok";
  const toneClass =
    tone === "warn"
      ? "text-amber-400"
      : tone === "running"
        ? "text-weaver-indigo"
        : "text-emerald-400";
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 font-mono text-[10px] text-text-secondary md:inline-flex"
      title={`Workers AI · 오늘 ${quota.used}/${quota.cap} neurons 소비 · ${quota.remaining} 남음`}
      data-testid="neurons-gauge"
    >
      <Zap className={`h-3 w-3 ${toneClass}`} />
      <span>
        <b className="text-text-primary">{quota.remaining}</b>
        <span className="text-text-tertiary">/{quota.cap}</span>
      </span>
    </div>
  );
}

function RecentRunsSection({ runs }: { runs: RunSummary[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="px-8 pt-4 pb-16 md:px-16" data-testid="recent-runs-section">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            최근 runs
          </h2>
          <span className="font-mono text-[10px] text-text-tertiary">{runs.length} / 50 표시</span>
        </div>
        <div className="flex flex-col gap-2">
          {runs.slice(0, 10).map((r) => (
            <Link
              key={r.id}
              to={`/tools/${r.tool_id}/runs/${r.id}`}
              className="card card-b grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 hover:border-weaver-indigo"
              data-testid="run-row"
            >
              <Activity className="lu text-text-tertiary" />
              <span className="font-mono text-xs text-text-secondary">
                <span className="text-text-primary">{r.tool_id}</span>
                <span className="text-text-tertiary"> · </span>
                <span className="text-text-tertiary">{r.id.slice(0, 8)}…</span>
              </span>
              <RunStatus status={r.status} />
              <span className="font-mono text-[10px] text-text-tertiary">
                {timeAgo(r.created_at)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RunStatus({ status }: { status: string }) {
  if (status === "complete") return <Badge tone="ok">complete</Badge>;
  if (status === "failed") return <Badge tone="warn">failed</Badge>;
  if (status === "running")
    return (
      <Badge tone="running" pulse>
        running
      </Badge>
    );
  if (status === "pending") return <Badge tone="info">pending</Badge>;
  return <Badge tone="muted">{status}</Badge>;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
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
