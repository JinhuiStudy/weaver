import {
  ArrowLeft,
  BookOpen,
  Cpu,
  Database,
  GitBranch,
  Layers,
  Leaf,
  Network,
  Server,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge } from "~/components/ui";
import type { Route } from "./+types/docs";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Weaver · Docs · Architecture & Concepts" },
    {
      name: "description",
      content: "Weaver 의 4-layer 아키텍처 · 용어 · ADR 요약 · $0 예산 구조를 한 곳에.",
    },
  ];
}

export default function DocsRoute() {
  return (
    <main className="relative min-h-screen">
      <div className="aurora-backdrop" aria-hidden />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">docs</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/help" className="btn btn-ghost btn-sm">
            <BookOpen className="lu" />
            사용법
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />홈
          </Link>
        </nav>
      </header>

      <section className="px-8 pt-14 pb-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <Layers className="h-3 w-3" />
            weaver · /docs
          </div>
          <h1 className="text-[48px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[56px]">
            <span className="gradient-text font-medium">Architecture</span> & concepts
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Weaver 의 설계 원칙은 세 문장으로 요약돼요 —{" "}
            <b className="text-text-primary">관측성은 구조</b>, 유저/운영 비용은{" "}
            <b className="text-text-primary">$0 고정</b>, 모든 에이전트는{" "}
            <b className="text-text-primary">진화하는 공개 미디어</b>. 이 페이지는 그 세 가지를
            어떻게 D1 · Cron · Workers AI 위에서 구현했는지의 축약본.
          </p>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Layers className="lu" />}
            kicker="architecture"
            title="4-layer stack"
            blurb="한 요청이 어떻게 흐르는지를 4 단계로 나눠요."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Pillar
              icon={<Network className="lu" />}
              name="1 · Web (apps/web)"
              body="React Router 7 Framework Mode · xyflow 빌더 · 로컬 Yjs + IndexedDB 로 오프라인 편집 · Cloudflare Workers 에서 SSR."
            />
            <Pillar
              icon={<Server className="lu" />}
              name="2 · Runtime (apps/runtime)"
              body="Hono + Cloudflare Workers · OTEL 래핑 · scheduled() Cron 매 1분마다 pending agent_runs 한 step 씩 진행."
            />
            <Pillar
              icon={<Database className="lu" />}
              name="3 · D1 (SQLite)"
              body="users / orgs / agents / agent_versions / agent_runs / run_history / agent_outputs / subscriptions / agent_feedback / agent_evolutions / waitlist / agent_reports · 9 migrations"
            />
            <Pillar
              icon={<Cpu className="lu" />}
              name="4 · Workers AI & Axiom"
              body="기본 LLM 은 Workers AI (Llama-3.3 / Gemma) · trace 는 Axiom OTLP/HTTP JSON · 둘 다 env 키가 없으면 Noop 으로 degrade."
            />
          </div>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Workflow className="lu" />}
            kicker="data model"
            title="핵심 엔티티"
            blurb="D1 테이블 레벨 요약."
          />
          <dl className="mt-6 grid gap-3 md:grid-cols-2">
            <Entity
              name="users / orgs / memberships"
              body="GitHub OAuth 유저 · 1 인 1 개인 org · role=member|owner."
            />
            <Entity
              name="agents · agent_versions"
              body="agent 는 불변 slug 를 가진 identity · 매 저장마다 새 version row · current_version_id swap."
            />
            <Entity
              name="agent_runs · run_history"
              body="run = 실행 1회 · graph 스냅샷 · history 는 node 단위 span + cost."
            />
            <Entity
              name="agent_outputs · subscriptions"
              body="complete run 의 terminal output · 구독 PK(user, agent)."
            />
            <Entity
              name="agent_feedback"
              body="(run_id, user_id) PK · rating ∈ {-1, 1} · comment 280 cap."
            />
            <Entity
              name="agent_evolutions"
              body="5 mutation strategies × N candidates · shadow_* + win_rate · suggested/accepted/rejected_at."
            />
            <Entity name="waitlist_signups" body="런칭 전 이메일 수집 · (email, source) UNIQUE." />
            <Entity
              name="agent_reports"
              body="(agent, reporter) PK · reason enum · 자동 hidden + 수동 review."
            />
          </dl>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader icon={<Sparkles className="lu" />} kicker="terms" title="용어" blurb="" />
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-text-secondary">
            <Term name="Fork">
              남의 공개 agent 를 내 워크스페이스로 복제. fork_of_agent_id 로 genealogy 형성.
            </Term>
            <Term name="Rate">
              Run 종료 후 👍/👎. fitness 계산에 쓰이고 evolution 엔진의 ranker.
            </Term>
            <Term name="Evolve">
              Wilson lower bound 로 top agent 선정 → Workers AI 가 prompt 변형 → shadow eval → 60%+
              승률은 creator 에게 v2 suggestion.
            </Term>
            <Term name="Shadow eval">
              candidate 를 원본과 같은 input 으로 돌려 Llama 3B judge 가 pairwise 선호 판정. 실제
              트래픽 0%.
            </Term>
            <Term name="Genealogy">
              agent 의 fork 트리 · 깊이 최대 3 으로 /@h/s/genealogy 에서 시각화.
            </Term>
            <Term name="Neuron">
              Workers AI 청구 단위 (대략 토큰 ÷ 8) · 유저당 일 50 cap · BYOK 로 우회 가능.
            </Term>
          </div>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Leaf className="lu" />}
            kicker="budget"
            title="$0 예산 구조"
            blurb="ADR-006 · 운영비도 0 · 유저 비용도 0."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Quota title="Workers" value="100k req/일 · free" />
            <Quota title="D1" value="5 GB · 100k writes/일 · free" />
            <Quota title="Cron" value="1 invocation/분 · free" />
            <Quota title="Workers AI" value="10k neurons/일 · free · 유저당 50" />
            <Quota title="Axiom" value="500 GB/월 · free plan" />
            <Quota title="Vectorize" value="30M query · 5M store · free · W8 이후" />
          </div>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<GitBranch className="lu" />}
            kicker="decisions"
            title="ADR 요약"
            blurb="/docs/decisions/ 의 6개 ADR 핵심만 뽑았어요."
          />
          <div className="mt-6 space-y-3">
            <Adr
              id="001"
              title="Framework · RR7 Framework Mode"
              body="SSR + file routing + types 한 번에. 대안 Next.js 는 Workers 배포시 제약."
            />
            <Adr
              id="002"
              title="Cron + D1 > Durable Objects"
              body="무료 tier 유지 · DO 는 유료 진입이라 보류. self-fetch 로 multi-step 확장."
            />
            <Adr
              id="006"
              title="$0 free-tier first"
              body="유저 $0 · 운영 $0 동시 충족. 유료 SaaS 의존 금지. 예외는 ADR 로 문서화."
            />
            <Adr
              id="007"
              title="Evolving Agent Network 피봇"
              body="horizontal 내부툴 빌더 → fork/rate/evolve 공개 네트워크. 기존 LangGraph 등과 정면 경쟁 피함."
            />
            <Adr
              id="008"
              title="Evolution engine"
              body="GA 스타일 · 5 strategies × shadow eval · creator opt-in 수락."
            />
          </div>
        </div>
      </section>

      <section className="px-8 py-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Shield className="lu" />}
            kicker="moderation"
            title="모더레이션"
            blurb="Sprint 9 · 런칭 준비."
          />
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>
              Agent 생성 시 name + description 에 대해 키워드 블록리스트
              (nsfw/malware/phishing/cp/bomb 등) 를 1차 스캔해서 걸리는 경우{" "}
              <b className="text-text-primary">moderation_hidden = 1</b> 로 자동 숨김. 크리에이터
              워크스페이스엔 남아 있지만 공개 엔드포인트 (feed / search / explore / @handle/slug) 에
              노출되지 않음.
            </p>
            <p>
              로그인 유저는 모든 공개 agent 에 대해 <b className="text-text-primary">🚩 신고</b>{" "}
              가능. reason enum (spam / nsfw / malware / phishing / other) + 400 chars detail. 한
              유저가 한 agent 에 여러 번 신고하면 최신 reason 으로 upsert.
            </p>
            <p>
              런칭 후 dashboard (관리자 전용) 에서 reports 큐를 보고 dismiss / hide / delete 액션
              적용. Workers AI 기반 자동 분류는 Sprint 10+ 이후.
            </p>
          </div>
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
              사용법
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

function SectionHeader({
  icon,
  kicker,
  title,
  blurb,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  blurb: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
        <span className="text-weaver-indigo">{icon}</span>
        {kicker}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]" data-docs-section={kicker}>
        {title}
      </h2>
      {blurb ? (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">{blurb}</p>
      ) : null}
    </div>
  );
}

function Pillar({ icon, name, body }: { icon: ReactNode; name: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-1/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
        {icon}
        {name}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function Entity({ name, body }: { name: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-1 px-4 py-3">
      <dt className="font-mono text-xs text-text-primary">{name}</dt>
      <dd className="mt-1 text-xs leading-relaxed text-text-secondary">{body}</dd>
    </div>
  );
}

function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[8px] border border-border bg-surface-1 p-4">
      <Badge tone="info">{name}</Badge>
      <span className="flex-1 text-text-secondary">{children}</span>
    </div>
  );
}

function Quota({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-1 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
        {title}
      </div>
      <div className="mt-1 font-mono text-sm text-text-primary">{value}</div>
    </div>
  );
}

function Adr({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <details className="rounded-[8px] border border-border bg-surface-1 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-text-primary">
        ADR-{id} · {title}
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{body}</p>
    </details>
  );
}
