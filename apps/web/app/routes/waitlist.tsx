import { ArrowLeft, ArrowRight, BookOpen, Check, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Button, Input } from "~/components/ui";
import type { Route } from "./+types/waitlist";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Weaver · 런칭 대기자 · Join the waitlist" },
    {
      name: "description",
      content:
        "Fork agents. Rate them. They evolve. Free forever. Week 14 런칭에 맞춰 초대 코드를 보내드려요.",
    },
  ];
}

export default function WaitlistRoute() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "waitlist",
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`등록 실패 (${res.status}): ${text.slice(0, 140)}`);
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <div className="aurora-backdrop" aria-hidden />

      <header className="flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">waitlist</span>
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

      <section className="flex flex-1 items-start justify-center px-6 py-16">
        <div className="w-full max-w-lg space-y-7 text-center">
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-weaver-cyan">
              2026-W30 launch · invite-only beta
            </div>
            <h1 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.025em]">
              <span className="gradient-text font-medium">초대장</span> 을 받아보세요
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              Fork agents. Rate them. They evolve.{" "}
              <b className="text-text-primary">Free forever.</b>
              <br />
              Week 14 런칭 전 최대 100명에게 초대 코드를 먼저 보내드려요.
            </p>
          </div>

          {state === "done" ? (
            <div
              className="rounded-[12px] border border-emerald-400/30 bg-emerald-500/10 px-6 py-6 text-left"
              data-testid="waitlist-done"
            >
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                <Check className="h-3 w-3" />
                접수 완료
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">
                <b className="text-text-primary">{email}</b> 로 초대 코드를 보내드릴게요. 런칭
                주간에 다시 뵈요!
              </p>
              <div className="mt-5 flex items-center gap-2 text-xs text-text-tertiary">
                <Link to="/help" className="text-weaver-cyan hover:underline">
                  그 동안 도움말 보기 →
                </Link>
                <span>·</span>
                <Link to="/explore" className="text-weaver-cyan hover:underline">
                  공개 agent 둘러보기
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-3 text-left" onSubmit={onSubmit} data-testid="waitlist-form">
              <div>
                <label
                  htmlFor="waitlist-email"
                  className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
                >
                  Email
                </label>
                <Input
                  id="waitlist-email"
                  type="email"
                  required
                  leftIcon={<Mail className="lu" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  size="lg"
                  maxLength={254}
                  data-testid="waitlist-email"
                />
              </div>
              <div>
                <label
                  htmlFor="waitlist-note"
                  className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
                >
                  한 줄 소개 (선택)
                </label>
                <textarea
                  id="waitlist-note"
                  className="inp h-auto min-h-[72px] w-full resize-y"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={280}
                  placeholder="어떤 agent 를 만들고 싶어요? (1-2줄)"
                  data-testid="waitlist-note"
                />
              </div>

              {error ? (
                <div
                  className="rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
                  role="alert"
                  data-testid="waitlist-error"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={state === "saving"}
                disabled={state === "saving"}
                leftIcon={state === "saving" ? undefined : <ArrowRight className="lu" />}
                data-testid="waitlist-submit"
              >
                {state === "saving" ? "접수 중..." : "초대장 받기"}
              </Button>

              <p className="text-center text-[11px] text-text-tertiary">
                스팸 안 보내요. 런칭 전 최대 2회만 이메일 드려요.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
