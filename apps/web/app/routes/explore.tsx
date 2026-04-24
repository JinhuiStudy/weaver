import { ArrowLeft, BookOpen, Compass, Flame, Sparkles } from "lucide-react";
import { Link, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import { callRuntime, isDev } from "~/lib/session.server";
import type { Route } from "./+types/explore";

type TrendingRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  updated_at: number;
  handle: string;
  avatar_url: string | null;
  run_count?: number;
  like_count?: number;
  sub_count?: number;
  fork_count?: number;
};

const TABS = ["trending", "new"] as const;
type Tab = (typeof TABS)[number];
const CATEGORIES = ["productivity", "news", "research", "coding", "creative", "fun", "etc"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Explore · Weaver" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") ?? "trending") as Tab;
  const category = (url.searchParams.get("category") ?? "").trim();
  const window = (url.searchParams.get("window") ?? "24h") as "24h" | "7d" | "30d";

  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tab === "trending") params.set("window", window);
  const endpoint = tab === "new" ? "new" : "trending";
  const qs = params.toString();
  const res = await callRuntime(
    env,
    `/api/public/agents/${endpoint}${qs ? `?${qs}` : ""}`,
    request,
  );

  let agents: TrendingRow[] = [];
  if (res.ok) {
    try {
      agents = ((await res.json()) as { agents: TrendingRow[] }).agents ?? [];
    } catch {}
  } else if (isDev(env)) {
    // Dev fallback — seed 4 rows, mixed categories.
    const base = Date.now();
    agents = [
      {
        id: "dev-1",
        slug: "hn-digest",
        name: "HN Daily Digest",
        description: "매일 HN 톱 10 요약",
        category: "news",
        updated_at: base - 20 * 60_000,
        handle: "alex",
        avatar_url: null,
        run_count: 124,
        like_count: 42,
        sub_count: 18,
        fork_count: 7,
      },
      {
        id: "dev-2",
        slug: "github-trending",
        name: "GitHub Trending",
        description: "스타 많은 repo 매일 브리핑",
        category: "news",
        updated_at: base - 2 * 3600_000,
        handle: "sora",
        avatar_url: null,
        run_count: 64,
        like_count: 22,
        sub_count: 9,
        fork_count: 3,
      },
      {
        id: "dev-3",
        slug: "css-tips",
        name: "CSS Tips Weekly",
        description: "subgrid · container query 실전",
        category: "creative",
        updated_at: base - 6 * 3600_000,
        handle: "hyun",
        avatar_url: null,
        run_count: 31,
        like_count: 11,
        sub_count: 5,
        fork_count: 1,
      },
      {
        id: "dev-4",
        slug: "rss-weekly",
        name: "RSS Weekly Brief",
        description: "구독한 RSS 주간 리포트",
        category: "productivity",
        updated_at: base - 12 * 3600_000,
        handle: "jinhui",
        avatar_url: null,
        run_count: 20,
        like_count: 3,
        sub_count: 2,
        fork_count: 0,
      },
    ];
    if (category) agents = agents.filter((a) => a.category === category);
  }

  return { tab, category, window, agents };
}

export default function ExploreRoute() {
  const { tab, category, window, agents } = useLoaderData<typeof loader>();

  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">explore</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help" className="btn btn-ghost btn-sm">
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
            <Compass className="h-3 w-3" />
            discover · 공개 agent
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            오늘 <span className="gradient-text font-medium">핫한 agent</span> 를 둘러봐요
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-3" data-testid="explore-tabs">
            <TabLink current={tab} value="trending" category={category} window={window}>
              <Flame className="h-3 w-3" /> Trending
            </TabLink>
            <TabLink current={tab} value="new" category={category} window={window}>
              <Sparkles className="h-3 w-3" /> New
            </TabLink>
            {tab === "trending" ? (
              <div className="ml-auto flex items-center gap-1" data-testid="explore-window-switch">
                {(["24h", "7d", "30d"] as const).map((w) => (
                  <TabLink key={w} current={window} value={w} tab={tab} category={category} small>
                    {w}
                  </TabLink>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="explore-categories">
            <CategoryChip tab={tab} current={category} value="" window={window}>
              전체
            </CategoryChip>
            {CATEGORIES.map((c) => (
              <CategoryChip key={c} tab={tab} current={category} value={c} window={window}>
                {c}
              </CategoryChip>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          {agents.length === 0 ? (
            <div
              className="rounded-[12px] border border-border bg-surface-1 px-8 py-10 text-center text-sm text-text-tertiary"
              data-testid="explore-empty"
            >
              아직 결과가 없어요. 다른 카테고리나 시간 창을 골라보세요.
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="explore-grid">
              {agents.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/@${a.handle}/${a.slug}`}
                    className="card card-b block h-full transition hover:border-weaver-indigo"
                    data-testid="explore-card"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                        @{a.handle}/{a.slug}
                      </span>
                      {a.category ? <Badge tone="muted">{a.category}</Badge> : null}
                    </div>
                    <h2 className="mt-1.5 text-sm font-semibold tracking-tight">{a.name}</h2>
                    {a.description ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                        {a.description}
                      </p>
                    ) : null}
                    {tab === "trending" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-tertiary">
                        <span>
                          <b className="text-text-primary">{a.run_count ?? 0}</b> runs
                        </span>
                        <span>
                          · <b className="text-text-primary">{a.like_count ?? 0}</b> 👍
                        </span>
                        <span>
                          · <b className="text-text-primary">{a.sub_count ?? 0}</b> subs
                        </span>
                        <span>
                          · <b className="text-text-primary">{a.fork_count ?? 0}</b> forks
                        </span>
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function TabLink({
  current,
  value,
  tab,
  category,
  window,
  small,
  children,
}: {
  current: string;
  value: string;
  tab?: string;
  category?: string;
  window?: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  const active = current === value;
  const qs = new URLSearchParams();
  if (tab && current !== value) qs.set("tab", tab);
  else if (!tab) qs.set("tab", value);
  if (category) qs.set("category", category);
  if (window && (tab ?? value) === "trending") qs.set("window", tab ? value : window);
  const to = `/explore?${qs.toString()}`;
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
        small ? "" : ""
      } ${
        active
          ? "border-weaver-indigo bg-weaver-indigo/15 text-weaver-indigo"
          : "border-border text-text-tertiary hover:border-border-strong hover:text-text-secondary"
      }`}
      data-testid={`explore-tab-${value}`}
    >
      {children}
    </Link>
  );
}

function CategoryChip({
  tab,
  current,
  value,
  window,
  children,
}: {
  tab: string;
  current: string;
  value: string;
  window: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  const qs = new URLSearchParams({ tab });
  if (value) qs.set("category", value);
  if (tab === "trending") qs.set("window", window);
  return (
    <Link
      to={`/explore?${qs.toString()}`}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition ${
        active
          ? "border-weaver-indigo bg-weaver-indigo/15 text-weaver-indigo"
          : "border-border text-text-tertiary hover:border-border-strong hover:text-text-secondary"
      }`}
      data-testid={`explore-cat-${value || "all"}`}
    >
      {children}
    </Link>
  );
}
