import { ArrowLeft, BookOpen, Search as SearchIcon } from "lucide-react";
import { Link, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import { callRuntime, isDev } from "~/lib/session.server";
import type { Route } from "./+types/search";

type SearchResult = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  updated_at: number;
  handle: string;
  avatar_url: string | null;
};

const CATEGORIES = ["productivity", "news", "research", "coding", "creative", "fun", "etc"];

export function meta({ data }: Route.MetaArgs) {
  const q = data?.q ?? "";
  return [{ title: q ? `"${q}" 검색 · Weaver` : "Agent 검색 · Weaver" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();

  if (!q) return { q: "", category, agents: [] as SearchResult[] };

  const qs = new URLSearchParams({ q });
  if (category) qs.set("category", category);
  const res = await callRuntime(env, `/api/public/agents/search?${qs.toString()}`, request);

  if (res.ok) {
    try {
      const body = (await res.json()) as { agents: SearchResult[] };
      return { q, category, agents: body.agents ?? [] };
    } catch {
      return { q, category, agents: [] as SearchResult[] };
    }
  }

  if (isDev(env)) {
    // Dev fallback: a handful of realistic results so the page isn't empty.
    return {
      q,
      category,
      agents: [
        {
          id: "dev-a-1",
          slug: "hn-digest",
          name: "HN Daily Digest",
          description: "매일 HN 톱 10 요약",
          category: "news",
          updated_at: Date.now() - 30 * 60_000,
          handle: "alex",
          avatar_url: null,
        },
        {
          id: "dev-a-2",
          slug: "github-trending",
          name: "GitHub Trending",
          description: "인기 repo 모음",
          category: "news",
          updated_at: Date.now() - 60 * 60_000,
          handle: "sora",
          avatar_url: null,
        },
        {
          id: "dev-a-3",
          slug: "rss-weekly",
          name: "RSS Weekly Brief",
          description: "구독 RSS 주간 리포트",
          category: "productivity",
          updated_at: Date.now() - 6 * 3_600_000,
          handle: "jinhui",
          avatar_url: null,
        },
      ] as SearchResult[],
    };
  }

  return { q, category, agents: [] as SearchResult[] };
}

export default function SearchRoute() {
  const { q, category, agents } = useLoaderData<typeof loader>();
  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">검색</span>
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
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <SearchIcon className="h-3 w-3" />
            discover · 공개 agent
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            <span className="gradient-text font-medium">어떤 agent</span> 를 찾고 있나요?
          </h1>

          <form
            method="GET"
            action="/search"
            className="mt-6 flex items-center gap-3"
            data-testid="search-form"
          >
            <div className="field-wrap flex-1">
              <span className="ico">
                <SearchIcon className="lu" />
              </span>
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="예: news summary · github trending · HN"
                className="inp has-ico inp-lg"
                data-testid="search-input"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg">
              검색
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="category-filters">
            <CategoryChip current={category} value="" q={q}>
              전체
            </CategoryChip>
            {CATEGORIES.map((c) => (
              <CategoryChip key={c} current={category} value={c} q={q}>
                {c}
              </CategoryChip>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-4xl">
          {q === "" ? (
            <EmptyHint />
          ) : agents.length === 0 ? (
            <NoResults q={q} />
          ) : (
            <>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
                {agents.length} results · "{q}"{category ? ` · ${category}` : ""}
              </div>
              <ul className="grid gap-3 md:grid-cols-2" data-testid="search-results">
                {agents.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/@${a.handle}/${a.slug}`}
                      className="card card-b block h-full transition hover:border-weaver-indigo"
                      data-testid="search-result"
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
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function CategoryChip({
  current,
  value,
  q,
  children,
}: {
  current: string;
  value: string;
  q: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (value) qs.set("category", value);
  return (
    <Link
      to={`/search?${qs.toString()}`}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
        active
          ? "border-weaver-indigo bg-weaver-indigo/15 text-weaver-indigo"
          : "border-border text-text-tertiary hover:border-border-strong hover:text-text-secondary"
      }`}
      data-testid={`category-chip-${value || "all"}`}
    >
      {children}
    </Link>
  );
}

function EmptyHint() {
  return (
    <div
      className="rounded-[12px] border border-border bg-surface-1 px-8 py-10 text-center"
      data-testid="search-empty"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-tertiary">
        <SearchIcon className="lu" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">무엇을 찾아드릴까요?</h3>
      <p className="mt-2 text-sm text-text-secondary">
        예시: <span className="font-mono text-weaver-cyan">news</span> ·{" "}
        <span className="font-mono text-weaver-cyan">productivity</span> ·{" "}
        <span className="font-mono text-weaver-cyan">HN</span>
      </p>
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div
      className="rounded-[12px] border border-border bg-surface-1 px-8 py-10 text-center"
      data-testid="search-no-results"
    >
      <h3 className="text-base font-semibold tracking-tight">"{q}" 에 대한 결과가 없어요</h3>
      <p className="mt-2 text-sm text-text-secondary">
        다른 키워드로 시도하거나, 카테고리 필터를 해제해 보세요.
      </p>
    </div>
  );
}
