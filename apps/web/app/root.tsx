import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/root";
import { WeaverMark } from "./components/brand/WeaverMark";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://rsms.me" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  return (
    <>
      {/* Top-of-page navigation progress bar — visible whenever React Router
         is fetching a new route (loader-bound navigation). Gives users
         instant feedback instead of an apparently frozen click. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed top-0 left-0 z-[9999] h-[2px] w-full overflow-hidden transition-opacity ${
          pending ? "opacity-100" : "opacity-0"
        }`}
        data-testid="nav-progress"
      >
        <div className="nav-progress-bar" />
      </div>
      <Outlet />
    </>
  );
}

/**
 * Shared ErrorBoundary — brand-consistent, explains what happened, and
 * offers concrete next steps per status code. Individual routes can still
 * define their own (e.g. handle-agent has a tailored "agent not found"
 * page); this is the catch-all.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let code: string = "";
  let title = "예상치 못한 오류가 발생했어요";
  let detail = "잠시 후 다시 시도하거나 아래 링크로 돌아가 주세요.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    if (error.status === 404) {
      title = "페이지를 찾을 수 없어요";
      detail =
        "URL 이 정확한지 확인해 주세요. 이전에 공개돼 있었다면 비공개 전환됐거나 삭제됐을 수 있어요.";
    } else if (error.status === 401) {
      title = "로그인이 필요해요";
      detail = "이 페이지를 보려면 먼저 GitHub 로 로그인해 주세요.";
    } else if (error.status === 403) {
      title = "접근 권한이 없어요";
      detail = "이 agent 의 creator 본인 또는 관리자만 열 수 있는 페이지예요.";
    } else if (error.status === 429) {
      title = "잠깐, 너무 빨라요";
      detail =
        "하루 Free-tier 한도를 잠시 넘은 것 같아요. 1–2 분 쉬었다가 다시 시도하거나 BYOK 을 연결하면 계속 쓸 수 있어요.";
    } else if (error.status >= 500) {
      title = "서버 오류가 발생했어요";
      detail =
        "Cloudflare Workers 또는 D1 이 잠시 이상해요. 몇 초 뒤 새로고침하거나, 계속되면 GitHub 이슈를 올려주세요.";
    } else {
      detail = error.statusText || detail;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
    stack = error.stack;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="aurora-backdrop" aria-hidden />
      <div className="w-full max-w-xl space-y-6 text-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2.5">
          <WeaverMark className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">Weaver</span>
        </Link>

        <div className="space-y-3">
          {code ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-weaver-cyan">
              HTTP {code}
            </div>
          ) : null}
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
            <span className="gradient-text font-medium">{title}</span>
          </h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">{detail}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Link to="/" className="btn btn-primary btn-sm">
            홈으로
          </Link>
          <Link to="/explore" className="btn btn-outlined btn-sm">
            Explore
          </Link>
          <Link to="/help" className="btn btn-ghost btn-sm">
            도움말
          </Link>
          <a
            href="https://github.com/JinhuiStudy/weaver/issues/new"
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost btn-sm"
          >
            버그 신고
          </a>
        </div>

        {stack ? (
          <details className="mt-6 rounded-[8px] border border-border bg-surface-1 p-4 text-left">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              dev stack trace
            </summary>
            <pre className="mt-3 overflow-x-auto text-xs">
              <code>{stack}</code>
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}
