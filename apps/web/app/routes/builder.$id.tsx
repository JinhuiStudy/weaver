import type { Edge } from "@xyflow/react";
import { ArrowLeft, Play, Save, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { Inspector } from "~/components/canvas/Inspector";
import { NodeCanvas } from "~/components/canvas/NodeCanvas";
import { Palette } from "~/components/canvas/Palette";
import { Badge, Button, Kbd } from "~/components/ui";
import { type CanvasNode, useCanvas } from "~/stores/canvas";
import type { Route } from "./+types/builder.$id";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Weaver · ${params.id} · builder` }];
}

const demoNodes: CanvasNode[] = [
  {
    id: "seed-in1",
    type: "input",
    position: { x: 0, y: 120 },
    data: {
      kind: "INPUT · WEBHOOK",
      label: "refund_received",
      body: "POST /refund\nauth: hmac",
    },
  },
  {
    id: "seed-tool1",
    type: "tool",
    position: { x: 280, y: 40 },
    data: {
      kind: "TOOL · HTTP",
      label: "stripe_lookup",
      body: "GET /charges/:id\nretry: 3",
    },
  },
  {
    id: "seed-ag1",
    type: "agent",
    position: { x: 280, y: 200 },
    data: {
      kind: "AGENT · CLAUDE",
      label: "policy_check",
      body: "model: sonnet-4-6\ncache: on",
    },
  },
  {
    id: "seed-br1",
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
    id: "seed-out1",
    type: "output",
    position: { x: 840, y: 40 },
    data: {
      kind: "OUTPUT · HTTP",
      label: "approve_refund",
      body: "return 200\nbody: { ok: true }",
    },
  },
  {
    id: "seed-out2",
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
  { id: "seed-e-in-tool", source: "seed-in1", target: "seed-tool1" },
  { id: "seed-e-in-ag", source: "seed-in1", target: "seed-ag1" },
  { id: "seed-e-tool-br", source: "seed-tool1", target: "seed-br1" },
  { id: "seed-e-ag-br", source: "seed-ag1", target: "seed-br1" },
  {
    id: "seed-e-br-out1",
    source: "seed-br1",
    sourceHandle: "approve",
    target: "seed-out1",
    label: "approve",
  },
  {
    id: "seed-e-br-out2",
    source: "seed-br1",
    sourceHandle: "escalate",
    target: "seed-out2",
    label: "escalate",
  },
];

export default function BuilderRoute({ params }: Route.ComponentProps) {
  const hydrate = useCanvas((s) => s.hydrate);
  const currentToolId = useCanvas((s) => s.toolId);

  useEffect(() => {
    // Seed the store on first visit (or when switching tools). Week-1 D: this
    // will be replaced by Yjs+IndexedDB hydration.
    if (currentToolId !== params.id) {
      hydrate(params.id, demoNodes, demoEdges);
    }
  }, [params.id, currentToolId, hydrate]);

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
        <Palette />
        <main className="relative flex-1">
          <NodeCanvas />
        </main>
        <Inspector />
      </div>
    </div>
  );
}
