import {
  AlertCircle,
  Check,
  ChevronRight,
  Command,
  Info,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { type NodeType, WvNode } from "~/components/canvas/WvNode";
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Kbd,
  Skeleton,
  Tabs,
  Toast,
  Tooltip,
} from "~/components/ui";
import type { Route } from "./+types/design";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Weaver · Design System" }];
}

export default function DesignPage() {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <TocSidebar />
      <main className="min-w-0">
        <Hero />
        <Section
          num="01"
          id="color"
          title="Color"
          lead="dark-first. 5개 노드 컬러는 절대 섞지 않음."
        >
          <ColorSection />
        </Section>
        <Section
          num="02"
          id="type"
          title="Typography"
          lead="Inter (UI) + JetBrains Mono (code). 8단 스케일."
        >
          <TypeSection />
        </Section>
        <Section num="03" id="nodes" title="Nodes · 5 types" lead="1 노드 = 1 색. 100% 고정.">
          <NodesSection />
        </Section>
        <Section
          num="04"
          id="node-states"
          title="Node states"
          lead="default · hover · selected · running · error · warn · disabled."
        >
          <NodeStatesSection />
        </Section>
        <Section
          num="05"
          id="buttons"
          title="Buttons"
          lead="7 variant × 4 size. primary는 화면당 1개."
        >
          <ButtonsSection />
        </Section>
        <Section
          num="06"
          id="inputs"
          title="Inputs · Toggles"
          lead="compact · mono 옵션 · state 3종."
        >
          <InputsSection />
        </Section>
        <Section num="07" id="badges" title="Badges · Chips · Keyboard">
          <BadgesSection />
        </Section>
        <Section num="08" id="tabs" title="Tabs · Menus · Tooltips">
          <TabsSection />
        </Section>
        <Section num="09" id="cards" title="Cards · Panels">
          <CardsSection />
        </Section>
        <Section
          num="10"
          id="states"
          title="Empty · Loading · Toast"
          lead="feedback states — 사용자에게 말을 거는 지점."
        >
          <FeedbackSection />
        </Section>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function TocSidebar() {
  const groups: { title: string; items: { n: string; id: string; label: string }[] }[] = [
    {
      title: "Foundations",
      items: [
        { n: "01", id: "color", label: "Color" },
        { n: "02", id: "type", label: "Type" },
      ],
    },
    {
      title: "Graph primitives",
      items: [
        { n: "03", id: "nodes", label: "Nodes · 5 types" },
        { n: "04", id: "node-states", label: "Node states" },
      ],
    },
    {
      title: "Controls",
      items: [
        { n: "05", id: "buttons", label: "Buttons" },
        { n: "06", id: "inputs", label: "Inputs · Toggles" },
        { n: "07", id: "badges", label: "Badges · Chips" },
        { n: "08", id: "tabs", label: "Tabs · Menus" },
      ],
    },
    {
      title: "Layout · Feedback",
      items: [
        { n: "09", id: "cards", label: "Cards · Panels" },
        { n: "10", id: "states", label: "Empty · Toast" },
      ],
    },
  ];

  return (
    <aside className="sticky top-0 h-screen overflow-y-auto border-r border-border bg-surface-1 px-4 py-7">
      <div className="mb-7 flex items-center gap-2.5 px-1">
        <svg viewBox="0 0 56 56" className="h-[22px] w-[22px]" role="img" aria-label="Weaver logo">
          <title>Weaver</title>
          <path
            d="M8 20 C 20 20, 20 36, 32 36"
            stroke="var(--weaver-indigo)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M8 36 C 20 36, 20 20, 32 20"
            stroke="var(--weaver-cyan)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M32 20 C 44 20, 44 36, 48 36"
            stroke="var(--node-agent)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M32 36 C 44 36, 44 20, 48 20"
            stroke="var(--node-tool)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <b className="text-sm font-semibold tracking-tight">Weaver</b>
        <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
          v2
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <div className="px-1.5 pt-1 pb-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-text-tertiary">
            {g.title}
          </div>
          {g.items.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className="flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              <span className="w-4 text-[10px] text-text-tertiary">{it.n}</span>
              {it.label}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}

function Hero() {
  return (
    <div className="border-b border-border px-16 pt-20 pb-14">
      <div className="mb-5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-weaver-indigo">
        <span className="inline-block h-px w-6 bg-weaver-indigo" />
        Design System · v2.0 · 2026 W17
      </div>
      <h1 className="max-w-4xl text-[56px] font-semibold leading-[1.05] tracking-[-0.025em]">
        모든 토큰, 모든 컴포넌트,
        <br />
        <em
          className="font-medium not-italic"
          style={{
            backgroundImage: "linear-gradient(90deg, var(--weaver-indigo), var(--weaver-cyan))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          모든 상태
        </em>{" "}
        까지.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">
        Weaver의 모든 비주얼 언어를 한 곳에. 브랜드 색상 · 5개 노드 타입 · 7개 버튼 variant · input
        · 배지 · 탭 · 빈 상태 — 복붙할 수 있게.
      </p>
      <div className="mt-7 flex gap-6 font-mono text-[11px] text-text-tertiary">
        <span>
          <b className="text-text-primary">10</b> sections
        </span>
        <span>
          <b className="text-text-primary">50+</b> components
        </span>
        <span>
          <b className="text-text-primary">420+</b> tokens
        </span>
        <span>
          <b className="text-text-primary">dark-first</b> · dawn-ready
        </span>
      </div>
    </div>
  );
}

function Section({
  num,
  id,
  title,
  lead,
  children,
}: {
  num: string;
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-border px-16 py-16 scroll-mt-6">
      <header className="mb-8 flex items-baseline gap-4 border-b border-dashed border-border pb-4">
        <span className="font-mono text-[11px] tracking-[0.15em] text-text-tertiary">{num}</span>
        <h2 className="text-[28px] font-semibold tracking-[-0.02em]">{title}</h2>
        {lead ? <p className="ml-auto max-w-[540px] text-xs text-text-secondary">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

/* ──────────────────────────────────────────────────────── */

function Swatch({
  name,
  token,
  hex,
  color,
}: {
  name: string;
  token: string;
  hex: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-surface-1">
      <div className="h-[88px]" style={{ background: color }} />
      <div className="p-3">
        <div className="text-xs font-medium">{name}</div>
        <div className="mt-0.5 font-mono text-[10px] leading-tight text-text-tertiary">
          <b className="font-normal text-text-secondary">{token}</b>
          <br />
          {hex}
        </div>
      </div>
    </div>
  );
}

function ColorSection() {
  return (
    <div className="space-y-10">
      <SubHeader>Brand</SubHeader>
      <div className="grid grid-cols-4 gap-3">
        <Swatch
          name="Weaver Indigo"
          token="--weaver-indigo"
          hex="#6366F1"
          color="var(--weaver-indigo)"
        />
        <Swatch
          name="Indigo Hover"
          token="--weaver-indigo-hover"
          hex="#7C7FF5"
          color="var(--weaver-indigo-hover)"
        />
        <Swatch
          name="Indigo Soft"
          token="--weaver-indigo-soft"
          hex="rgba(99,102,241,.12)"
          color="var(--weaver-indigo-soft)"
        />
        <Swatch name="Weaver Cyan" token="--weaver-cyan" hex="#06B6D4" color="var(--weaver-cyan)" />
      </div>

      <SubHeader>Surface · 6 stop</SubHeader>
      <div className="grid grid-cols-6 gap-3">
        <Swatch name="bg-base" token="--bg-base" hex="#030305" color="var(--bg-base)" />
        <Swatch name="bg-canvas" token="--bg-canvas" hex="#07070C" color="var(--bg-canvas)" />
        <Swatch name="surface-1" token="--surface-1" hex="#0F0F14" color="var(--surface-1)" />
        <Swatch name="surface-2" token="--surface-2" hex="#1A1A22" color="var(--surface-2)" />
        <Swatch name="surface-3" token="--surface-3" hex="#22222D" color="var(--surface-3)" />
        <Swatch name="surface-4" token="--surface-4" hex="#2A2A35" color="var(--surface-4)" />
      </div>

      <SubHeader>Node type · 5 fixed</SubHeader>
      <div className="grid grid-cols-5 gap-3">
        <Swatch name="● Input" token="--node-input" hex="#3B82F6" color="var(--node-input)" />
        <Swatch name="● Agent" token="--node-agent" hex="#A855F7" color="var(--node-agent)" />
        <Swatch name="● Tool" token="--node-tool" hex="#10B981" color="var(--node-tool)" />
        <Swatch name="● Branch" token="--node-branch" hex="#F59E0B" color="var(--node-branch)" />
        <Swatch name="● Output" token="--node-output" hex="#EF4444" color="var(--node-output)" />
      </div>

      <SubHeader>Status</SubHeader>
      <div className="grid grid-cols-4 gap-3">
        <Swatch name="OK" token="--status-ok" hex="#10B981" color="var(--status-ok)" />
        <Swatch
          name="Warning"
          token="--status-warning"
          hex="#F59E0B"
          color="var(--status-warning)"
        />
        <Swatch name="Error" token="--status-error" hex="#EF4444" color="var(--status-error)" />
        <Swatch name="Info" token="--status-info" hex="#3B82F6" color="var(--status-info)" />
      </div>
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <h3 className="text-sm font-semibold tracking-tight">{children}</h3>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary" />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

const TYPE_ROWS: { name: string; tokens: string; className: string; sample: string }[] = [
  {
    name: "display",
    tokens: "40/44 · 600 · -0.025em",
    className: "text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]",
    sample: "Weave agents.",
  },
  {
    name: "3xl",
    tokens: "24/28 · 600 · -0.02em",
    className: "text-2xl font-semibold tracking-[-0.02em]",
    sample: "Section title",
  },
  {
    name: "2xl",
    tokens: "20/24 · 600 · -0.01em",
    className: "text-xl font-semibold tracking-[-0.01em]",
    sample: "Page title (dense)",
  },
  { name: "xl", tokens: "18/24 · 600", className: "text-lg font-semibold", sample: "Card title" },
  {
    name: "lg",
    tokens: "16/24 · 500",
    className: "text-base font-medium",
    sample: "Emphasized body",
  },
  { name: "md", tokens: "14/20 · 400", className: "text-sm", sample: "Default label · 14px" },
  {
    name: "base",
    tokens: "13/20 · 400",
    className: "text-[13px]",
    sample: "Body default — denser than Office's 14px.",
  },
  {
    name: "sm",
    tokens: "12/18 · 400",
    className: "text-xs text-text-secondary",
    sample: "Compact UI · rows · side panels",
  },
  {
    name: "xs",
    tokens: "11/16 mono",
    className: "font-mono text-[11px] text-text-secondary",
    sample: "badges · span labels · inline meta",
  },
  {
    name: "micro",
    tokens: "10/14 mono · +0.15em · UPPER",
    className: "font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary",
    sample: "KICKER · SECTION HEADER",
  },
];

function TypeSection() {
  return (
    <div className="card px-8 py-7">
      {TYPE_ROWS.map((row, i) => (
        <div
          key={row.name}
          className="grid grid-cols-[140px_1fr_180px] gap-6 border-b border-dashed border-border py-4 last:border-none"
          style={i === TYPE_ROWS.length - 1 ? { borderBottom: "none" } : undefined}
        >
          <span className="font-mono text-[11px] text-text-tertiary">{row.name}</span>
          <span className={row.className}>{row.sample}</span>
          <span className="text-right font-mono text-[10px] text-text-tertiary">{row.tokens}</span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function NodesSection() {
  const nodes: { type: NodeType; kind: string; label: string; body: string }[] = [
    {
      type: "input",
      kind: "INPUT · WEBHOOK",
      label: "webhook_refund",
      body: "POST /refund\nauth: bearer\ntimeout: 30s",
    },
    {
      type: "agent",
      kind: "AGENT · CLAUDE",
      label: "policy_check",
      body: "model: sonnet-4-6\ntemp: 0.2 · cache: on",
    },
    {
      type: "tool",
      kind: "TOOL · HTTP",
      label: "stripe_lookup",
      body: "GET /charges/:id\nretry: 3 · backoff: exp",
    },
    {
      type: "branch",
      kind: "BRANCH · IF",
      label: "within_7d",
      body: "condition: age ≤ 7d\ntrue → approve",
    },
    {
      type: "output",
      kind: "OUTPUT · SLACK",
      label: "notify_manager",
      body: "channel: #cs-refunds\nthread: true",
    },
  ];
  return (
    <div className="canvas-bg rounded-xl border border-border p-10">
      <div className="flex flex-wrap items-center justify-center gap-10">
        {nodes.map((n) => (
          <WvNode key={n.type} {...n} />
        ))}
      </div>
    </div>
  );
}

function NodeStatesSection() {
  const states: { label: string; props: Partial<Parameters<typeof WvNode>[0]> }[] = [
    {
      label: "default",
      props: { type: "agent", label: "policy_check", body: "model: sonnet-4-6" },
    },
    {
      label: "hover",
      props: { type: "agent", label: "policy_check", body: "model: sonnet-4-6", state: "hover" },
    },
    {
      label: "selected",
      props: { type: "agent", label: "policy_check", body: "model: sonnet-4-6", state: "selected" },
    },
    {
      label: "running",
      props: {
        type: "agent",
        label: "policy_check",
        body: "model: sonnet-4-6",
        state: "running",
        statusPill: <span style={{ color: "var(--weaver-indigo)" }}>running</span>,
      },
    },
    {
      label: "error",
      props: {
        type: "agent",
        label: "policy_check",
        body: "model timeout\n30000ms",
        state: "error",
        statusPill: <span style={{ color: "var(--status-error)" }}>error</span>,
      },
    },
    {
      label: "warn",
      props: {
        type: "agent",
        label: "policy_check",
        body: "cost > budget",
        state: "warn",
        statusPill: <span style={{ color: "var(--status-warning)" }}>warn</span>,
      },
    },
    {
      label: "disabled",
      props: { type: "agent", label: "policy_check", body: "model: sonnet-4-6", state: "disabled" },
    },
    {
      label: "ok · complete",
      props: {
        type: "agent",
        label: "policy_check",
        body: "return: approved",
        statusPill: <span style={{ color: "var(--status-ok)" }}>ok</span>,
        durationPill: "2.14s",
      },
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3.5">
      {states.map((s) => (
        <div
          key={s.label}
          className="canvas-bg flex min-h-[160px] flex-col items-center justify-center gap-3.5 rounded-[10px] border border-border px-5 py-7"
        >
          <WvNode {...(s.props as Parameters<typeof WvNode>[0])} />
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            state: <b className="text-text-primary font-medium">{s.label}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function ButtonsSection() {
  return (
    <div className="space-y-8">
      <div>
        <SubHeader>Variants</SubHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ai" leftIcon={<Sparkles className="lu" />}>
            AI compose
          </Button>
          <Button variant="success" leftIcon={<Check className="lu" />}>
            Success
          </Button>
          <Button variant="danger" leftIcon={<Trash2 className="lu" />}>
            Danger
          </Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      <div>
        <SubHeader>Sizes</SubHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="xs">
            xs
          </Button>
          <Button variant="primary" size="sm">
            sm
          </Button>
          <Button variant="primary">md</Button>
          <Button variant="primary" size="lg">
            lg · Save changes
          </Button>
        </div>
      </div>

      <div>
        <SubHeader>Icon · Group</SubHeader>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" iconOnly aria-label="play">
              <Play className="lu" />
            </Button>
            <Button variant="secondary" iconOnly aria-label="add">
              <Plus className="lu" />
            </Button>
            <Button variant="outlined" iconOnly aria-label="command">
              <Command className="lu" />
            </Button>
          </div>
          <div className="btn-group">
            <button type="button" className="btn active">
              Design
            </button>
            <button type="button" className="btn">
              Preview
            </button>
            <button type="button" className="btn">
              Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function InputsSection() {
  return (
    <div className="grid grid-cols-2 gap-10">
      <div className="space-y-4">
        <Field label="Agent label" help="snake_case · max 40 chars">
          <Input placeholder="policy_check" />
        </Field>
        <Field label="Trace ID" help="immutable · ULID">
          <Input mono placeholder="01j7f3a2xvp4bnw" defaultValue="01j7f3a2xvp4bnw" />
        </Field>
        <Field label="Error state" help="duplicate label" helpTone="err">
          <Input state="error" defaultValue="policy_check" />
        </Field>
        <Field label="OK state">
          <Input state="ok" defaultValue="policy_check_v2" />
        </Field>
        <Field label="Search · with icon · kbd">
          <Input
            leftIcon={<Search className="lu" />}
            kbdHint="⌘K"
            placeholder="Search actions..."
          />
        </Field>
        <Field label="Disabled">
          <Input disabled defaultValue="locked" />
        </Field>
      </div>

      <div className="space-y-5">
        <SubHeader>Toggles</SubHeader>
        <Checkbox label="Enable cache" defaultChecked />
        <Checkbox label="Indeterminate · 3 of 5" indeterminate />
        <Radio label="Workers AI · free" name="model" defaultChecked />
        <Radio label="Claude Sonnet 4.6 · BYOK" name="model" />
        <Switch label="Shadow mode · 10%" defaultOn />

        <div>
          <div className="label">
            Volume · <code className="text-weaver-cyan">0.2</code>
          </div>
          <div className="relative pt-2">
            <div className="sld">
              <div className="fill" style={{ width: "20%" }} />
              <div className="thumb" style={{ left: "calc(20% - 6px)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  help,
  helpTone,
  children,
}: {
  label: string;
  help?: string;
  helpTone?: "err";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
      {help ? <div className={`help${helpTone === "err" ? " err" : ""}`}>{help}</div> : null}
    </div>
  );
}

const srOnly =
  "absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]";

function Checkbox({
  label,
  defaultChecked,
  indeterminate,
}: {
  label: string;
  defaultChecked?: boolean;
  indeterminate?: boolean;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
      <input
        type="checkbox"
        className={srOnly}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      <span
        aria-hidden
        className={`cbx ${indeterminate ? "indeterminate" : on ? "checked" : ""}`}
      />
      {label}
    </label>
  );
}

function Radio({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
      <input
        type="radio"
        name={name}
        className={srOnly}
        checked={on}
        onChange={() => setOn(true)}
      />
      <span aria-hidden className={`rdo ${on ? "checked" : ""}`} />
      {label}
    </label>
  );
}

function Switch({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
      <input
        type="checkbox"
        role="switch"
        aria-checked={on}
        className={srOnly}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      <span aria-hidden className={`tgl ${on ? "on" : ""}`} />
      {label}
    </label>
  );
}

/* ──────────────────────────────────────────────────────── */

function BadgesSection() {
  return (
    <div className="space-y-8">
      <div>
        <SubHeader>Status badges</SubHeader>
        <div className="flex flex-wrap gap-2">
          <Badge tone="ok">ok</Badge>
          <Badge tone="err">error</Badge>
          <Badge tone="warn">warn</Badge>
          <Badge tone="info">info</Badge>
          <Badge tone="running" pulse>
            running
          </Badge>
          <Badge tone="muted">draft</Badge>
          <Badge tone="solid-ok">shipped</Badge>
          <Badge tone="solid-err">blocked</Badge>
        </div>
      </div>

      <div>
        <SubHeader>Chips</SubHeader>
        <div className="flex flex-wrap gap-2">
          <span className="chip">tag:auth</span>
          <span className="chip">env:prod</span>
          <span className="chip sel">owner:me</span>
          <span className="chip">
            model:sonnet-4-6{" "}
            <span className="x" aria-hidden>
              <X className="h-3 w-3" />
            </span>
          </span>
        </div>
      </div>

      <div>
        <SubHeader>Keyboard</SubHeader>
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> command palette
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>S</Kbd> save
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>⏎</Kbd> run agent
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>Z</Kbd> undo
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function TabsSection() {
  return (
    <div className="grid grid-cols-2 gap-10">
      <div>
        <SubHeader>Line tabs</SubHeader>
        <Tabs
          items={[
            {
              id: "props",
              label: "PROPS",
              content: <TabDemoBody title="prompt · schema · retry · timeout" />,
            },
            {
              id: "trace",
              label: "TRACE",
              content: <TabDemoBody title="last 10 runs · cost heatmap" />,
            },
            {
              id: "compose",
              label: "COMPOSE",
              content: <TabDemoBody title="자연어 → diff preview" />,
            },
          ]}
        />
      </div>

      <div>
        <SubHeader>Pill tabs · Tooltip · Menu</SubHeader>
        <div className="space-y-6">
          <Tabs
            variant="pill"
            items={[
              { id: "dark", label: "Dark" },
              { id: "dawn", label: "Dawn" },
              { id: "system", label: "System" },
            ]}
          />
          <div className="flex flex-col items-start gap-4">
            <Tooltip>⌘K · open palette</Tooltip>
            <div className="menu">
              <div className="mi active">
                <Sparkles className="lu" />
                Compose with AI
                <span className="kbd-slot">⌘K</span>
              </div>
              <div className="mi">
                <Play className="lu" />
                Run agent
                <span className="kbd-slot">⌘⏎</span>
              </div>
              <div className="sep" />
              <div className="mi danger">
                <Trash2 className="lu" />
                Delete
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabDemoBody({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        tab body
      </div>
      <div className="mt-2 text-[13px] text-text-primary">{title}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function CardsSection() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card
        header={
          <>
            <Sparkles className="lu" /> policy_check
          </>
        }
      >
        <div className="font-mono text-[11px] leading-relaxed text-text-secondary">
          model: sonnet-4-6
          <br />
          temp: 0.2 · cache: on
        </div>
        <div className="mt-3 flex gap-2">
          <Badge tone="ok">ok</Badge>
          <Badge tone="muted">v3</Badge>
        </div>
      </Card>

      <Card
        header={
          <>
            <Info className="lu" /> Run summary
          </>
        }
      >
        <dl className="grid grid-cols-[80px_1fr] gap-y-1.5 font-mono text-[11px]">
          <dt className="text-text-tertiary">trace_id</dt>
          <dd className="text-weaver-cyan">01j7f3a2xvp4bnw</dd>
          <dt className="text-text-tertiary">duration</dt>
          <dd className="text-status-ok" style={{ color: "var(--status-ok)" }}>
            2.14s
          </dd>
          <dt className="text-text-tertiary">tokens</dt>
          <dd>523 → 127</dd>
          <dt className="text-text-tertiary">cost</dt>
          <dd style={{ color: "var(--status-ok)" }}>$0.0042</dd>
        </dl>
      </Card>

      <Card
        header={
          <>
            <TriangleAlert className="lu" /> Budget guard
          </>
        }
      >
        <div className="text-[12px] text-text-secondary">월 예산 소진 78%</div>
        <div className="mt-3 progress">
          <div className="p" style={{ width: "78%" }} />
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-text-tertiary">
          <span>$38.92 / $50.00</span>
          <Badge tone="warn">warn</Badge>
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */

function FeedbackSection() {
  return (
    <div className="grid grid-cols-2 gap-10">
      <div>
        <SubHeader>Empty state</SubHeader>
        <Empty
          icon={<AlertCircle className="h-5 w-5" />}
          title="No runs yet"
          description="webhook을 트리거하거나 schedule을 추가하면 여기에 실행 결과가 표시됩니다."
          action={
            <Button variant="primary" size="sm" leftIcon={<Play className="lu" />}>
              Trigger manually
            </Button>
          }
        />
      </div>

      <div>
        <SubHeader>Loading (skeleton)</SubHeader>
        <Card header={<>Trace timeline</>}>
          <div className="space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      </div>

      <div className="col-span-2">
        <SubHeader>Toast · Banner</SubHeader>
        <div className="flex flex-wrap items-start gap-4">
          <Toast
            tone="ok"
            icon={<Check className="lu" />}
            title="Deploy shipped"
            description="v3 is now serving 100% traffic."
          />
          <Toast
            tone="err"
            icon={<AlertCircle className="lu" />}
            title="Eval failed"
            description="accuracy 72% < threshold 85%."
          />
          <Toast
            tone="warn"
            icon={<TriangleAlert className="lu" />}
            title="Budget guard"
            description="월 예산의 78%에 도달했습니다."
          />
          <Toast
            tone="info"
            icon={<Info className="lu" />}
            title="New version"
            description="v3 draft는 shadow 10%로 실행 중."
          />
        </div>
        <div className="mt-6 space-y-3">
          <div className="banner info">
            <Info className="lu" />
            <span>Workers AI 무료 tier: 오늘 3,241 / 10,000 neurons 사용</span>
            <span className="actions">
              <Button variant="ghost" size="xs" rightIcon={<ChevronRight className="lu" />}>
                details
              </Button>
            </span>
          </div>
          <div className="banner warn">
            <TriangleAlert className="lu" />
            <span>shadow v3의 비용이 v2보다 18% 높습니다. 승격 전 eval 재실행 권장.</span>
          </div>
          <div className="banner err">
            <AlertCircle className="lu" />
            <span>stripe_lookup tool: 최근 5분간 3 회 연속 실패. retry 정책 확인 필요.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
