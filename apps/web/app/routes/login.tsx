import { BookOpen, Github } from "lucide-react";
import { Link } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weaver · Sign in" }];
}

export default function LoginRoute() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="aurora-backdrop" aria-hidden />
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <Link to="/" className="flex items-center justify-center gap-2.5">
            <WeaverMark className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">Weaver</span>
          </Link>
          <p className="gradient-text text-sm font-medium leading-relaxed">
            Fork agents. Rate them. They evolve.
          </p>
        </div>

        <a
          href="/auth/github"
          className="btn btn-primary btn-lg cta-glow inline-flex w-full items-center justify-center gap-2"
          data-testid="github-signin"
        >
          <Github className="lu" />
          Sign in with GitHub
        </a>

        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Free forever · 공개 프로필만 읽습니다</p>
          <Link
            to="/help"
            className="inline-flex items-center gap-1.5 text-xs text-weaver-cyan hover:underline"
            data-testid="login-help-link"
          >
            <BookOpen className="h-3 w-3" />
            처음이신가요? 사용법 도움말
          </Link>
        </div>
      </div>
    </main>
  );
}
