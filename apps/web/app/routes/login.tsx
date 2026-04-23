import { Github } from "lucide-react";
import { WeaverMark } from "~/components/brand/WeaverMark";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weaver · Sign in" }];
}

export default function LoginRoute() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2.5">
            <WeaverMark className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">Weaver</span>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Fork agents. Rate them. They evolve.
          </p>
        </div>

        <a
          href="/auth/github"
          className="btn btn-primary btn-lg inline-flex w-full items-center justify-center gap-2"
          data-testid="github-signin"
        >
          <Github className="lu" />
          Sign in with GitHub
        </a>

        <p className="text-xs text-text-tertiary">Free forever · 공개 프로필만 읽습니다</p>
      </div>
    </main>
  );
}
