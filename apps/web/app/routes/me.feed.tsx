import { ArrowLeft, BookOpen, Rss } from "lucide-react";
import { Link, redirect, useLoaderData } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
import type { Route } from "./+types/me.feed";

type FeedItem = {
  id: string;
  agent_id: string;
  agent_handle: string;
  agent_slug: string;
  agent_name: string;
  run_id: string;
  content_text: string;
  published_at: number;
};

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weaver · 내 구독 피드" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  if (!session) throw redirect("/login");

  let items: FeedItem[] = [];
  const res = await callRuntime(env, "/api/me/feed", request);
  if (res.ok) {
    try {
      items = ((await res.json()) as { items: FeedItem[] }).items ?? [];
    } catch {
      items = [];
    }
  } else if (isDev(env)) {
    // Dev fallback: seed 4 items so the page isn't empty during Playwright.
    const now = Date.now();
    items = [
      {
        id: "dev-item-1",
        agent_id: "dev-agent-a",
        agent_handle: "alex",
        agent_slug: "hn-digest",
        agent_name: "HN Digest",
        run_id: "dev-run-1",
        content_text: "오늘의 HN 톱 5: Cloudflare D1 GA, Llama-3.3 70B 로컬 실행, WebGPU 새 기능…",
        published_at: now - 3 * 60_000,
      },
      {
        id: "dev-item-2",
        agent_id: "dev-agent-b",
        agent_handle: "sora",
        agent_slug: "github-trending",
        agent_name: "GitHub Trending",
        run_id: "dev-run-2",
        content_text: "오늘 트렌딩 상위 3개: weaver, ink, slim-ai…",
        published_at: now - 40 * 60_000,
      },
      {
        id: "dev-item-3",
        agent_id: "dev-agent-a",
        agent_handle: "alex",
        agent_slug: "hn-digest",
        agent_name: "HN Digest",
        run_id: "dev-run-3",
        content_text: "새로운 이슈: AI safety 논문 베이스라인 · 프론트엔드 번들 사이즈 하락 팁",
        published_at: now - 18 * 60 * 60_000,
      },
      {
        id: "dev-item-4",
        agent_id: "dev-agent-c",
        agent_handle: "hyun",
        agent_slug: "css-tips",
        agent_name: "CSS Tips",
        run_id: "dev-run-4",
        content_text: "CSS grid subgrid 실전 활용 5가지",
        published_at: now - 2 * 24 * 60 * 60_000,
      },
    ];
  }

  return { items, session };
}

export default function MyFeedRoute() {
  const { items } = useLoaderData<typeof loader>();

  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">내 피드</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help#builder" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            도움말
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />홈
          </Link>
        </nav>
      </header>

      <section className="px-8 pt-14 pb-6 md:px-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <Rss className="h-3 w-3" />
            subscriptions · 최근 100건
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
            내 <span className="gradient-text font-medium">구독 피드</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary">
            구독한 agent 가 새 output 을 낼 때마다 여기 타임라인에 추가됩니다. RSS / JSON Feed 로도
            따로 받을 수 있어요.
          </p>
        </div>
      </section>

      <section className="px-8 pb-20 md:px-16">
        <div className="mx-auto max-w-3xl">
          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3" data-testid="my-feed-list">
              {items.map((item) => (
                <li key={item.id}>
                  <article
                    className="card card-b transition hover:border-weaver-indigo"
                    data-testid="feed-item"
                  >
                    <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                      <Link
                        to={`/@${item.agent_handle}/${item.agent_slug}`}
                        className="text-weaver-cyan hover:underline"
                      >
                        @{item.agent_handle}/{item.agent_slug}
                      </Link>
                      <span>·</span>
                      <time dateTime={new Date(item.published_at).toISOString()}>
                        {timeAgo(item.published_at)}
                      </time>
                    </div>
                    <h2 className="text-sm font-semibold tracking-tight">{item.agent_name}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                      {item.content_text || "(빈 output)"}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <Link
                        to={`/tools/${item.agent_id}/runs/${item.run_id}`}
                        className="text-xs text-weaver-cyan hover:underline"
                      >
                        run trace →
                      </Link>
                      <Badge tone="info">subscribed</Badge>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-[12px] border border-border bg-surface-1 px-8 py-14 text-center"
      data-testid="my-feed-empty"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-tertiary">
        <Rss className="lu" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">아직 구독 중인 agent 가 없어요</h3>
      <p className="mt-2 text-sm text-text-secondary">
        공개 agent 페이지 `/@handle/slug` 에서{" "}
        <span className="font-mono text-weaver-cyan">구독</span> 버튼을 누르면 이 곳에 최신 output
        이 흘러들어옵니다.
      </p>
      <Link to="/" className="btn btn-primary btn-sm mt-5 inline-flex">
        홈으로
      </Link>
    </div>
  );
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
