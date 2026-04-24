import {
  Activity,
  ArrowLeft,
  Compass,
  GitFork,
  Home,
  Keyboard,
  LayoutDashboard,
  LogIn,
  Play,
  Settings,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { WeaverMark } from "~/components/brand/WeaverMark";
import { Badge, Kbd } from "~/components/ui";
import type { Route } from "./+types/help";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Weaver · 사용법 도움말" },
    { name: "description", content: "Weaver 의 모든 페이지와 기능 사용법 한 곳에." },
  ];
}

export default function HelpRoute() {
  return (
    <main className="min-h-screen">
      {/* Ambient gradient backdrop — respects tokens.css via variables. */}
      <div className="aurora-backdrop" aria-hidden />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-bg-base/80 px-8 py-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <WeaverMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Weaver</span>
          <span className="kbd">도움말</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft className="lu" />홈
          </Link>
          <a href="#toc" className="btn btn-ghost btn-sm">
            목차로
          </a>
        </nav>
      </header>

      <section className="relative px-8 pt-16 pb-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-cyan">
            <span className="inline-block h-px w-6 bg-weaver-cyan" />
            weaver · /help
          </div>
          <h1 className="max-w-3xl text-[48px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[56px]">
            <span
              style={{
                backgroundImage: "linear-gradient(90deg, var(--weaver-indigo), var(--weaver-cyan))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              모든 사용법
            </span>
            , 한 페이지에.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">
            빌더부터 run viewer · fork · free-tier 한도까지, Weaver 에서 쓰는 모든 페이지와
            키보드·용어를 모아뒀어요. 처음이면{" "}
            <a href="#quickstart" className="text-weaver-cyan hover:underline">
              3분 투어
            </a>
            부터 시작하세요.
          </p>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <QuickCard
              step="1"
              title="로그인"
              body="GitHub 계정으로 한 번만. 공개 프로필만 읽습니다."
              href="/login"
            />
            <QuickCard
              step="2"
              title="빌더에서 조립"
              body="5 노드 타입 드래그 · ⌘K 로 Compose AI."
              href="/builder/demo"
            />
            <QuickCard
              step="3"
              title="Save · Run · 공개"
              body="@handle/slug URL 로 누구나 fork 가능."
              href="#builder"
            />
          </div>
        </div>
      </section>

      <section id="toc" className="px-8 pb-8 md:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
            목차
          </h2>
          <ol className="grid gap-2 font-mono text-xs text-text-secondary md:grid-cols-2">
            {TOC.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="flex items-center justify-between rounded-[6px] border border-border px-3 py-2 transition hover:border-weaver-indigo hover:bg-weaver-indigo/5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-text-tertiary">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-text-primary">{t.title}</span>
                  </span>
                  <span className="text-text-tertiary">→</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="quickstart" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Play className="lu" />}
            kicker="quickstart"
            title="3분 투어"
            blurb="처음 써보는 분을 위한 최소 경로."
          />
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-text-secondary">
            <Step
              n="1"
              title="홈에서 '시작하기' → 빌더 열기"
              body="로그인 안 한 상태면 /login 으로 리다이렉트됩니다. 로그인 후 돌아오면 빌더가 뜹니다."
            />
            <Step
              n="2"
              title="좌측 팔레트에서 노드 드래그"
              body="INPUT → AGENT → OUTPUT 최소 3개로 시작. xyflow 캔버스에서 점끼리 드래그로 연결."
            />
            <Step
              n="3"
              title="⌘K → Compose with AI"
              body="자연어로 '리펀드 처리 흐름 만들어' 같은 요청을 넣으면 Workers AI 가 그래프 diff를 제안, 수락 시 canvas 에 반영."
            />
            <Step
              n="4"
              title="'Save to workspace'"
              body="Agent 이름 입력 후 저장. 홈의 '내 Agents' 섹션에 카드로 등장."
            />
            <Step
              n="5"
              title="Run"
              body="빌더 우측 상단 Run 버튼 → pending 으로 D1 에 기록 → Cron (매 1분) 이 한 step 씩 진행 → Run Viewer 에서 timeline 확인."
            />
            <Step
              n="6"
              title="공개 URL 공유"
              body="visibility=public 으로 저장하면 /@handle/slug 로 누구나 열람 가능. 'Fork to workspace' 한 번이면 다른 유저가 복제 가능."
            />
          </ol>
        </div>
      </section>

      <PageGuide
        id="home"
        icon={<Home className="lu" />}
        kicker="/"
        title="홈 (랜딩)"
        bullets={[
          {
            label: "Hero",
            body: '"Fork agents. Rate them. They evolve." 제품 한 줄과 시작하기 CTA.',
          },
          {
            label: "내 Agents",
            body: "로그인 상태에서만. 저장한 agent 카드 목록 · 각 카드는 빌더로 이동.",
          },
          {
            label: "최근 Runs",
            body: "최근 50건 중 10건 표시. 상태 뱃지 · 시간 · 클릭 시 Run Viewer.",
          },
          {
            label: "neurons gauge",
            body: "헤더 우측 ⚡ 배지. 오늘 사용한 neurons / 일 cap 50 · 80% 넘으면 주황.",
          },
          {
            label: "Features 3 카드",
            body: "Weaver 의 차별점 3가지 — 관측성 · eval · shadow 트래픽.",
          },
        ]}
      />

      <PageGuide
        id="login"
        icon={<LogIn className="lu" />}
        kicker="/login"
        title="로그인"
        bullets={[
          {
            label: "GitHub OAuth",
            body: "Sign in with GitHub 한 번. 공개 프로필(handle, avatar) 만 읽어옵니다.",
          },
          {
            label: "핸들",
            body: "GitHub login 이 Weaver 의 @handle 이 됨. 'jinhui' → /@jinhui/agent-slug.",
          },
          {
            label: "개인 org 자동 생성",
            body: "첫 로그인 때 '{handle}-personal' 슬러그의 org 가 생성됨. 지금은 솔로만 지원.",
          },
          {
            label: "로그아웃",
            body: "모든 화면 헤더의 '로그아웃' 버튼 · 세션 쿠키만 지움.",
          },
        ]}
      />

      <PageGuide
        id="builder"
        icon={<Workflow className="lu" />}
        kicker="/builder/:id"
        title="빌더 (캔버스)"
        bullets={[
          {
            label: "좌측 팔레트",
            body: "5 노드 타입 — INPUT · TOOL · AGENT · BRANCH · OUTPUT. 드래그해서 캔버스에 드롭.",
          },
          {
            label: "캔버스",
            body: "xyflow v12. 점(dot)끼리 드래그로 연결. branch 는 여러 output handle 가짐.",
          },
          {
            label: "우측 Inspector",
            body: "선택한 노드의 props 편집. Agent 노드는 model · system_prompt · user_prompt · temperature 편집 가능.",
          },
          {
            label: "Compose with AI",
            body: "⌘K → compose 모드. 자연어 프롬프트 → Workers AI 가 그래프 diff 생성 → 수락 시 반영.",
          },
          {
            label: "Save / Import / Save to workspace",
            body: "Save: @weaver/core 스키마 Graph JSON 다운로드. Save to workspace: agent 로 저장 (D1).",
          },
          {
            label: "Settings 모달",
            body: "저장된 agent 만 ⚙︎ Settings 버튼 활성. name / description / category / visibility 편집 (slug 불변).",
          },
          {
            label: "Run",
            body: "우측 상단 Run → /api/runs POST · 일 10건 rate limit · pending → Cron 가 step 별 진행.",
          },
          {
            label: "Yjs + IndexedDB 로컬 저장",
            body: "unsaved 편집은 브라우저에 자동 저장. 새로고침·탭 재열기해도 복원.",
          },
        ]}
      />

      <PageGuide
        id="public-agent"
        icon={<GitFork className="lu" />}
        kicker="/@handle/slug"
        title="공개 agent 프로필"
        bullets={[
          {
            label: "카드 영역",
            body: "agent 이름 · 설명 · visibility · category · fork 여부 뱃지.",
          },
          {
            label: "Fork to workspace",
            body: "로그인 된 상태에서 버튼 → /api/agents/:id/fork → 내 워크스페이스에 복제 (slug 충돌 시 -2).",
          },
          {
            label: "Graph preview",
            body: "노드 최대 9개 카드로 미리보기. 전체 canvas 는 fork 후 빌더에서.",
          },
          {
            label: "Private agent",
            body: "visibility=private 이면 공개 URL 로 접근 불가 (404). 본인만 빌더에서 엶.",
          },
        ]}
      />

      <PageGuide
        id="run-viewer"
        icon={<Activity className="lu" />}
        kicker="/tools/:toolId/runs/:runId"
        title="Run Viewer (trace)"
        bullets={[
          {
            label: "헤더",
            body: "run id · 상태 뱃지 · tool id · trace_id 앞 12자 (Axiom 에서 검색 가능).",
          },
          {
            label: "stat tiles",
            body: "duration · steps · cost(μ$) · errored step 개수.",
          },
          {
            label: "Waterfall",
            body: "run_history 의 step 순서대로. 각 bar 는 시작 offset + duration 비례. 클릭 시 상세.",
          },
          {
            label: "Span detail",
            body: "선택 step 의 node_id · node_type · span_id · duration · cost · created_at · input/output (disclosure).",
          },
          {
            label: "OTEL trace",
            body: "모든 step 이 Axiom 으로 흐름. AXIOM_TOKEN 환경변수 있을 때만 exporter 활성 (free 500GB/월).",
          },
        ]}
      />

      <PageGuide
        id="design-system"
        icon={<LayoutDashboard className="lu" />}
        kicker="/design"
        title="Design System"
        bullets={[
          {
            label: "Color · Typography",
            body: "tokens.css 기반. Inter + JetBrains Mono · dark-only.",
          },
          {
            label: "Nodes · 5 types",
            body: "INPUT / TOOL / AGENT / BRANCH / OUTPUT · 색 + 아이콘 + kicker.",
          },
          {
            label: "Node states",
            body: "default · hover · selected · running · error · warn · disabled · ok.",
          },
          {
            label: "Buttons · Inputs · Badges",
            body: "모든 primitive 를 /design 한 곳에서 사용 예시까지 스토리형으로.",
          },
        ]}
      />

      <section id="shortcuts" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Keyboard className="lu" />}
            kicker="keyboard"
            title="단축키"
            blurb="빌더에서 바로 쓸 수 있는 전역 단축키."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.label}
                className="flex items-start justify-between gap-4 rounded-[8px] border border-border bg-surface-1 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-text-primary">{s.label}</div>
                  <div className="mt-1 text-xs text-text-tertiary">{s.desc}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">{s.keys}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="quotas" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Zap className="lu" />}
            kicker="quotas"
            title="Free-tier 일일 한도"
            blurb="$0 공정 공유를 위한 유저당 cap. 초과 시 429 + Retry-After."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <QuotaCard
              title="Workers AI · neurons"
              value="50 / 일"
              blurb="Compose AI · 진행될 agent LLM 호출 합계 (≈ 10 run). 초과 시 대기 혹은 BYOK 유도."
            />
            <QuotaCard
              title="/api/runs 생성"
              value="10 / 일"
              blurb="한 유저가 하루 10건 Run. 자동 reset은 UTC 자정 기준."
            />
            <QuotaCard
              title="D1 writes"
              value="100k / 일 공유"
              blurb="전체 Free-tier. 유저당 명시 cap 없음 (agent 저장 3 write 정도)."
            />
            <QuotaCard
              title="Axiom trace ingest"
              value="500 GB / 월"
              blurb="Free plan. spans 는 10초 배치 flush 로 묶어서 전송."
            />
          </div>
        </div>
      </section>

      <section id="evolution" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Sparkles className="lu" />}
            kicker="terms"
            title="Fork / Rate / Evolve"
            blurb="Weaver 의 핵심 컨셉 — 런칭까지 주요 용어 정리."
          />
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-text-secondary">
            <Term
              name="Fork"
              body="남의 공개 agent 를 내 워크스페이스로 복제. fork_of_agent_id 기록으로 족보(genealogy) 형성."
            />
            <Term
              name="Rate (Sprint 4 합류)"
              body="Run 종료 후 👍/👎 + 짧은 코멘트. 집계는 agent 카드의 like ratio 로 표시."
            />
            <Term
              name="Evolve (Sprint 5 · 2026-W10 목표)"
              body="매일 23:00 UTC Cron · top agent 의 prompt 를 Workers AI 가 5 strategies (concise / specific / cot / role / format) 로 mutate · shadow eval 로 pairwise compare · 60% 이상 win 이면 v2 suggestion 배너."
            />
            <Term
              name="Shadow eval"
              body="candidate version 을 원본과 같은 input 으로 실행 후 Llama 3B judge 가 pairwise 선호 선택. 실제 트래픽 0%."
            />
            <Term
              name="Genealogy"
              body="agent 의 fork 트리. Sprint 4 UI 에 d3-hierarchy 로 시각화 예정."
            />
          </div>
        </div>
      </section>

      <section id="faq" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Compass className="lu" />}
            kicker="faq"
            title="자주 묻는 질문"
            blurb=""
          />
          <div className="mt-6 space-y-3">
            {FAQ.map((q) => (
              <details
                key={q.q}
                className="group rounded-[8px] border border-border bg-surface-1 px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                  {q.q}
                </summary>
                <div className="mt-2 text-sm leading-relaxed text-text-secondary">{q.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="links" className="px-8 py-10 md:px-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            icon={<Settings className="lu" />}
            kicker="references"
            title="더 깊이 보고 싶다면"
            blurb=""
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <LinkCard
              href="/design"
              title="Design System"
              body="tokens · 노드 · 컴포넌트 쇼케이스"
            />
            <LinkCard
              href="https://github.com/JinhuiStudy/weaver"
              title="GitHub · JinhuiStudy/weaver"
              body="Apache-2.0 · 이슈/PR 환영"
              external
            />
            <LinkCard
              href="https://axiom.co/docs/endpoints/opentelemetry"
              title="Axiom OTLP docs"
              body="trace ingest 엔드포인트"
              external
            />
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
          <span className="font-mono">weaver.pages.dev</span>
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
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em]" data-help-section={kicker}>
        {title}
      </h2>
      {blurb ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{blurb}</p>
      ) : null}
    </div>
  );
}

function QuickCard({
  step,
  title,
  body,
  href,
}: {
  step: string;
  title: string;
  body: string;
  href: string;
}) {
  const isExternal = href.startsWith("http") || href.startsWith("#");
  const inner = (
    <div className="card card-b group h-full transition hover:border-weaver-indigo hover:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
          step · {step}
        </span>
        <span className="text-weaver-cyan opacity-0 transition group-hover:opacity-100">→</span>
      </div>
      <h3 className="mt-1.5 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
  if (isExternal) return <a href={href}>{inner}</a>;
  return <Link to={href}>{inner}</Link>;
}

function PageGuide({
  id,
  icon,
  kicker,
  title,
  bullets,
}: {
  id: string;
  icon: ReactNode;
  kicker: string;
  title: string;
  bullets: { label: string; body: string }[];
}) {
  return (
    <section id={id} className="px-8 py-10 md:px-16">
      <div className="mx-auto max-w-5xl">
        <SectionHeader icon={icon} kicker={kicker} title={title} blurb="" />
        <dl className="mt-6 grid gap-3 md:grid-cols-2">
          {bullets.map((b) => (
            <div
              key={b.label}
              className="rounded-[8px] border border-border bg-surface-1 px-4 py-3"
            >
              <dt className="text-sm font-semibold text-text-primary">{b.label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-text-secondary">{b.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-4 rounded-[8px] border border-border bg-surface-1 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-weaver-indigo bg-weaver-indigo/10 font-mono text-sm font-semibold text-weaver-indigo">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="mt-1 text-xs text-text-tertiary">{body}</div>
      </div>
    </li>
  );
}

function QuotaCard({ title, value, blurb }: { title: string; value: string; blurb: string }) {
  return (
    <div className="rounded-[8px] border border-border bg-surface-1 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
        {title}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{value}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-text-secondary">{blurb}</div>
    </div>
  );
}

function Term({ name, body }: { name: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-[8px] border border-border bg-surface-1 p-4">
      <Badge tone="info">{name}</Badge>
      <span className="flex-1 text-text-secondary">{body}</span>
    </div>
  );
}

function LinkCard({
  href,
  title,
  body,
  external,
}: {
  href: string;
  title: string;
  body: string;
  external?: boolean;
}) {
  const inner = (
    <div className="card card-b h-full transition hover:border-weaver-cyan">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-weaver-cyan">
        {external ? "external" : "internal"}
      </div>
      <h3 className="mt-1.5 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-text-tertiary">{body}</p>
    </div>
  );
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {inner}
      </a>
    );
  return <Link to={href}>{inner}</Link>;
}

const TOC = [
  { id: "quickstart", title: "3분 투어" },
  { id: "home", title: "홈 (랜딩)" },
  { id: "login", title: "로그인" },
  { id: "builder", title: "빌더 (캔버스)" },
  { id: "public-agent", title: "공개 agent 프로필" },
  { id: "run-viewer", title: "Run Viewer (trace)" },
  { id: "design-system", title: "Design System" },
  { id: "shortcuts", title: "키보드 단축키" },
  { id: "quotas", title: "Free-tier 한도" },
  { id: "evolution", title: "Fork / Rate / Evolve 용어" },
  { id: "faq", title: "자주 묻는 질문" },
  { id: "links", title: "관련 링크" },
];

const SHORTCUTS = [
  {
    label: "Command palette",
    desc: "모든 명령 · 노드 추가 · jump · Compose AI 검색",
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
  },
  {
    label: "Save / Export",
    desc: "canvas 를 Graph JSON 으로 다운로드",
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>S</Kbd>
      </>
    ),
  },
  {
    label: "Undo / Redo",
    desc: "편집 히스토리 스택 · 최대 50",
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>Z</Kbd>
        <span className="text-text-tertiary">·</span>
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>Z</Kbd>
      </>
    ),
  },
  {
    label: "노드 삭제",
    desc: "선택 노드 + 연결 엣지 cascade 제거",
    keys: (
      <>
        <Kbd>Delete</Kbd>
        <span className="text-text-tertiary">·</span>
        <Kbd>⌫</Kbd>
      </>
    ),
  },
  {
    label: "도움말 모달 (빌더)",
    desc: "빌더 내 단축키 치트시트",
    keys: <Kbd>?</Kbd>,
  },
  {
    label: "모달 닫기",
    desc: "도움말 · 팔레트 · Settings · command palette",
    keys: <Kbd>Esc</Kbd>,
  },
];

const FAQ = [
  {
    q: "Weaver 는 진짜 $0 인가요?",
    a: "네. 유저가 내는 돈 0원 · Weaver 운영 비용 0원. Cloudflare Workers + D1 + Workers AI 의 free tier 에 맞춰 설계했고, 필요하면 유저가 BYOK(Claude/OpenAI 자기 키) 를 쓸 수 있게 해뒀어요.",
  },
  {
    q: "Workers AI neurons 를 다 쓰면요?",
    a: "기본 50 neurons/일을 초과하면 Compose AI 요청이 실패하거나 대기 안내를 받게 됩니다. 향후 BYOK 유도 또는 대기열 옵션 추가 예정 (NEXT.md D3 참고).",
  },
  {
    q: "Slug 를 바꿀 수 있나요?",
    a: "지금은 불가. 공개 URL @handle/slug 가 load-bearing 이라 의도적으로 막아뒀습니다. 이름·설명·카테고리·visibility 는 Settings 모달에서 자유롭게 편집 가능.",
  },
  {
    q: "Private agent 는 정말 비공개인가요?",
    a: "예. /@handle/slug 공개 엔드포인트가 visibility='public'|'unlisted' 만 반환해요. 다른 사람이 fork 할 수도 없습니다 (403).",
  },
  {
    q: "Run 이 'pending' 에서 멈춘 것 같아요",
    a: "Cron 은 매 1분에 한 번 돕니다. 5분 이상 pending 이면 graph 에 input 노드가 없거나, Cron 이 자원 부족으로 실패한 것. Run Viewer 의 에러 메시지 확인 후 재실행하세요.",
  },
  {
    q: "기여/피드백은 어디로?",
    a: "GitHub JinhuiStudy/weaver 이슈 / PR / Discussions 모두 환영. 스파크 아이디어는 docs/NEXT.md 백로그 섹션도 참고하세요.",
  },
];
