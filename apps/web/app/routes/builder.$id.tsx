import type { Edge, Node } from "@xyflow/react";
import { ArrowLeft, Play, Save, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { NodeCanvas } from "~/components/canvas/NodeCanvas";
import type { WvFlowNodeData } from "~/components/canvas/nodes";
import { Badge, Button, Kbd } from "~/components/ui";
import type { Route } from "./+types/builder.$id";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Weaver · ${params.id} · builder` }];
}

type DemoNode = Node<WvFlowNodeData>;
const demoNodes: DemoNode[] = [
  {
    id: "in1",
    type: "input",
    position: { x: 0, y: 120 },
    data: {
      kind: "INPUT · WEBHOOK",
      label: "refund_received",
      body: "POST /refund\nauth: hmac",
    },
  },
  {
    id: "tool1",
    type: "tool",
    position: { x: 280, y: 40 },
    data: {
      kind: "TOOL · HTTP",
      label: "stripe_lookup",
      body: "GET /charges/:id\nretry: 3",
    },
  },
  {
    id: "ag1",
    type: "agent",
    position: { x: 280, y: 200 },
    data: {
      kind: "AGENT · CLAUDE",
      label: "policy_check",
      body: "model: sonnet-4-6\ncache: on",
      state: "running",
      statusPill: <span style={{ color: "var(--weaver-indigo)" }}>running</span>,
    },
  },
  {
    id: "br1",
    type: "branch",
    position: { x: 560, y: 120 },
    data: {
      kind: "BRANCH · IF",
      label: "within_7d",
      body: "age ≤ 7 days",
      outputs: ["approve", "escalate"],
    },
  },
  {
    id: "out1",
    type: "output",
    position: { x: 840, y: 40 },
    data: {
      kind: "OUTPUT · HTTP",
      label: "approve_refund",
      body: "return 200\nbody: { ok: true }",
    },
  },
  {
    id: "out2",
    type: "output",
    position: { x: 840, y: 220 },
    data: {
      kind: "OUTPUT · SLACK",
      label: "notify_manager",
      body: "channel: #cs-refunds",
    },
  },
];

const demoEdges: Edge[] = [
  { id: "e-in-tool", source: "in1", target: "tool1", animated: true },
  { id: "e-in-ag", source: "in1", target: "ag1" },
  { id: "e-tool-br", source: "tool1", target: "br1" },
  { id: "e-ag-br", source: "ag1", target: "br1" },
  { id: "e-br-out1", source: "br1", sourceHandle: "approve", target: "out1", label: "approve" },
  { id: "e-br-out2", source: "br1", sourceHandle: "escalate", target: "out2", label: "escalate" },
];

export default function BuilderRoute({ params }: Route.ComponentProps) {
  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      <header className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn btn-ghost btn-sm" aria-label="Back to home">
            <ArrowLeft className="lu" />
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              tool
            </span>
            <span className="text-sm font-semibold tracking-tight">{params.id}</span>
            <Badge tone="muted">v0 · draft</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Sparkles className="lu" />}>
            Compose
            <Kbd className="ml-1">⌘K</Kbd>
          </Button>
          <Button variant="outlined" size="sm" leftIcon={<Save className="lu" />}>
            Save
            <Kbd className="ml-1">⌘S</Kbd>
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Play className="lu" />}>
            Run
            <Kbd className="ml-1 bg-transparent text-white/70">⌘⏎</Kbd>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[72px] flex-col items-center gap-1 border-r border-border bg-surface-1 py-3">
          {[
            { type: "input", label: "Input", color: "var(--node-input)" },
            { type: "tool", label: "Tool", color: "var(--node-tool)" },
            { type: "agent", label: "Agent", color: "var(--node-agent)" },
            { type: "branch", label: "Branch", color: "var(--node-branch)" },
            { type: "output", label: "Output", color: "var(--node-output)" },
          ].map((p) => (
            <button
              key={p.type}
              type="button"
              title={`Add ${p.label}`}
              className="flex w-14 flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] uppercase tracking-[0.1em] text-text-tertiary hover:bg-surface-2 hover:text-text-primary"
            >
              <span
                aria-hidden
                className="h-3 w-3 rounded-[3px]"
                style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
              />
              <span className="font-mono">{p.label}</span>
            </button>
          ))}
        </aside>

        <main className="relative flex-1">
          <NodeCanvas initialNodes={demoNodes} initialEdges={demoEdges} />
        </main>

        <aside className="flex w-[360px] flex-col border-l border-border bg-surface-1">
          <div className="tabs px-4">
            <button type="button" className="t active">
              PROPS
            </button>
            <button type="button" className="t">
              TRACE
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-xs text-text-secondary">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              선택된 노드 없음
            </div>
            <p className="leading-relaxed">
              캔버스에서 노드를 선택하면 프롬프트 · 스키마 · 재시도 · 타임아웃 등의 설정이 여기에
              나타납니다. 좌측 팔레트에서 새 노드를 드래그해 추가할 수도 있어요.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
