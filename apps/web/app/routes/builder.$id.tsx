import { ULID_RE } from "@weaver/core";
import type { Edge } from "@xyflow/react";
import {
  ArrowLeft,
  Check,
  HelpCircle,
  Loader2,
  Play,
  Redo2,
  Save,
  Settings,
  Sparkles,
  Undo2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import { CommandPalette } from "~/components/canvas/CommandPalette";
import { HelpModal } from "~/components/canvas/HelpModal";
import { Inspector } from "~/components/canvas/Inspector";
import { NodeCanvas } from "~/components/canvas/NodeCanvas";
import { Palette } from "~/components/canvas/Palette";
import { type AgentMetadata, SettingsModal } from "~/components/canvas/SettingsModal";
import { Badge, Button, Kbd } from "~/components/ui";
import { downloadCanvasAsGraphJson } from "~/lib/exportGraph";
import { loadCanvasFromFile } from "~/lib/importGraph";
import { createRun } from "~/lib/runs";
import { callRuntime, isDev, loadSessionServer } from "~/lib/session.server";
import { useCanvasPersistence } from "~/lib/useCanvasPersistence";
import { type CanvasNode, useCanvas } from "~/stores/canvas";
import type { Route } from "./+types/builder.$id";

type SavedAgentDefinition = {
  tool_id?: string;
  nodes?: unknown[];
  edges?: unknown[];
};

type SavedAgent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  category: string | null;
  current_version_id: string | null;
  fork_of_agent_id: string | null;
  created_at: number;
  updated_at: number;
  definition: SavedAgentDefinition | null;
};

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Weaver · ${params.id} · builder` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await loadSessionServer(request, env);
  if (!session) throw redirect("/login");

  // If the URL segment looks like a ULID, try to hydrate from the runtime's
  // saved agent record. Free-form ids (e.g. "demo", "new") and 404s drop
  // through to the demo seed — the builder still works as a sandbox.
  let savedAgent: SavedAgent | null = null;
  if (ULID_RE.test(params.id)) {
    const res = await callRuntime(env, `/api/agents/${params.id}`, request);
    if (res.ok) {
      try {
        savedAgent = (await res.json()) as SavedAgent;
      } catch {
        savedAgent = null;
      }
    } else if (isDev(env)) {
      // Dev Playwright runs without a live runtime, so /api/agents/:id returns
      // 502. Mint a mock agent so UIs that only render for saved agents
      // (e.g. the Settings modal) can still be exercised in tests. Production
      // keeps `savedAgent = null` because isDev() is gated on localhost.
      savedAgent = {
        id: params.id,
        slug: "dev-agent",
        name: "Dev Agent",
        description: "로컬 dev 빌더의 mock agent — 실제 runtime 이 없을 때 씁니다.",
        visibility: "public",
        category: "productivity",
        current_version_id: null,
        fork_of_agent_id: null,
        created_at: 0,
        updated_at: 0,
        definition: null,
      };
    }
  }
  return { session, savedAgent };
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
  const { savedAgent: initialAgent } = useLoaderData<typeof loader>();
  // Mirror the server-loaded agent in local state so a SettingsModal save can
  // flip `savedAgent.visibility` (etc.) without a full route refresh.
  const [savedAgent, setSavedAgent] = useState(initialAgent);
  useEffect(() => {
    setSavedAgent(initialAgent);
  }, [initialAgent]);

  // Hydrate from the server's saved definition when present — fall back to
  // the demo seed so a fresh tool id (e.g. `/builder/demo`) still has nodes.
  // The canvas hook also falls back to its IndexedDB snapshot, which wins
  // over both to preserve unsaved local edits across reloads.
  // JSON round-tripped nodes lose their richer `CanvasNode.data.body` React
  // typing — cast back to the canvas type now that we know the shape.
  const seedNodes: CanvasNode[] =
    (savedAgent?.definition?.nodes as CanvasNode[] | undefined) ?? demoNodes;
  const seedEdges: Edge[] = (savedAgent?.definition?.edges as Edge[] | undefined) ?? demoEdges;

  const status = useCanvasPersistence({
    toolId: params.id,
    seedNodes,
    seedEdges,
  });

  // Zustand selectors — re-render only when these specific slices change.
  const undo = useCanvas((s) => s.undo);
  const redo = useCanvas((s) => s.redo);
  const historyLength = useCanvas((s) => s.history.length);
  const futureLength = useCanvas((s) => s.future.length);

  const onSave = useCallback(() => {
    const state = useCanvas.getState();
    downloadCanvasAsGraphJson({
      toolId: params.id,
      nodes: state.nodes,
      edges: state.edges,
    });
  }, [params.id]);

  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const onRun = useCallback(async () => {
    setRunning(true);
    try {
      const { id: runId } = await createRun({ toolId: params.id });
      navigate(`/tools/${params.id}/runs/${runId}`);
    } catch (err) {
      console.error("run failed", err);
    } finally {
      setRunning(false);
    }
  }, [params.id, navigate]);

  const [publishing, setPublishing] = useState(false);
  const onPublish = useCallback(async () => {
    const state = useCanvas.getState();
    const definition = {
      tool_id: params.id,
      nodes: state.nodes,
      edges: state.edges,
    };

    setPublishing(true);
    try {
      let res: Response;
      if (savedAgent) {
        // Existing agent — push a new version, don't rename.
        res = await fetch(`/api/agents/${savedAgent.id}/versions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ definition }),
        });
      } else {
        // New agent — prompt for a name, create + first version.
        const name = window.prompt(
          "Agent 이름을 입력하세요 (예: HN Summary). 슬러그는 자동으로 생성됩니다.",
        );
        if (!name) return;
        res = await fetch("/api/agents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, definition }),
        });
      }

      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`save failed (${res.status}): ${msg}`);
      }
      navigate("/");
    } catch (err) {
      console.error("publish failed", err);
      window.alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPublishing(false);
    }
  }, [savedAgent, params.id, navigate]);

  // Hidden file input triggered by the Import button; separated so we can
  // reuse the hydrate logic from elsewhere (e.g. ⌘K palette).
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onImportClick = useCallback(() => fileInputRef.current?.click(), []);
  const onFilePicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const { nodes, edges, toolId } = await loadCanvasFromFile(file);
        useCanvas.getState().hydrate(toolId || params.id, nodes, edges);
      } catch (err) {
        console.error("import failed", err);
      } finally {
        // Reset so selecting the same file twice still fires change.
        e.target.value = "";
      }
    },
    [params.id],
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitialMode, setPaletteInitialMode] = useState<"commands" | "compose">("commands");
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openPalette = useCallback((mode: "commands" | "compose" = "commands") => {
    setPaletteInitialMode(mode);
    setPaletteOpen(true);
  }, []);

  // Global keyboard shortcuts. All of them skip when the focus is inside a
  // text-entry element so we don't hijack the browser's native text editing
  // (e.g. ⌘Z inside an <input>, ⌘S → native save-page dialog). ⌘K is the one
  // exception: it intentionally opens the palette even over an input so the
  // composer is always one shortcut away.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inTextField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      // "?" (Shift+/) — no modifier required, so check BEFORE the meta gate.
      if (!inTextField && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();

      if (key === "k") {
        e.preventDefault();
        openPalette("commands");
        return;
      }
      if (key === "z") {
        if (inTextField) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "s") {
        if (inTextField) return;
        e.preventDefault();
        onSave();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, onSave, openPalette]);

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      <header className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn btn-ghost btn-sm" aria-label="Back to home">
            <ArrowLeft className="lu" />
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              {savedAgent ? "agent" : "tool"}
            </span>
            <span className="text-sm font-semibold tracking-tight" data-testid="builder-title">
              {savedAgent ? savedAgent.name : params.id}
            </span>
            {savedAgent ? (
              <>
                <span className="font-mono text-[10px] text-text-tertiary">@{savedAgent.slug}</span>
                <Badge tone={savedAgent.visibility === "public" ? "ok" : "info"}>
                  {savedAgent.visibility}
                </Badge>
              </>
            ) : (
              <Badge tone="muted">v0 · draft</Badge>
            )}
            <SyncBadge status={status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={historyLength === 0}
            onClick={undo}
            aria-label="Undo (⌘Z)"
            title="Undo · ⌘Z"
            leftIcon={<Undo2 className="lu" />}
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={futureLength === 0}
            onClick={redo}
            aria-label="Redo (⌘⇧Z)"
            title="Redo · ⌘⇧Z"
            leftIcon={<Redo2 className="lu" />}
          >
            Redo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<HelpCircle className="lu" />}
            onClick={() => setHelpOpen(true)}
            title="Help · ?"
          >
            Help
            <Kbd className="ml-1">?</Kbd>
          </Button>
          {savedAgent ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Settings className="lu" />}
              onClick={() => setSettingsOpen(true)}
              title="Agent settings"
              data-testid="open-settings"
            >
              Settings
            </Button>
          ) : null}
          <span className="h-4 w-px bg-border" aria-hidden />
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Sparkles className="lu" />}
            onClick={() => openPalette("compose")}
            title="Compose with AI"
          >
            Compose
            <Kbd className="ml-1">⌘K</Kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Upload className="lu" />}
            onClick={onImportClick}
          >
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFilePicked}
          />
          <Button variant="outlined" size="sm" leftIcon={<Save className="lu" />} onClick={onSave}>
            Save
            <Kbd className="ml-1">⌘S</Kbd>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onPublish}
            loading={publishing}
            disabled={publishing}
            data-testid="save-to-workspace"
          >
            {savedAgent ? "Push new version" : "Save to workspace"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="lu" />}
            onClick={onRun}
            loading={running}
            disabled={running}
          >
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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        ctx={{ onSave, onImport: onImportClick }}
        initialMode={paletteInitialMode}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        agent={
          savedAgent
            ? {
                id: savedAgent.id,
                slug: savedAgent.slug,
                name: savedAgent.name,
                description: savedAgent.description,
                category: savedAgent.category,
                visibility: savedAgent.visibility,
              }
            : null
        }
        onSaved={(next: AgentMetadata) => {
          setSavedAgent((prev) =>
            prev
              ? {
                  ...prev,
                  name: next.name,
                  description: next.description,
                  category: next.category,
                  visibility: next.visibility,
                }
              : prev,
          );
        }}
      />
    </div>
  );
}

function SyncBadge({ status }: { status: "idle" | "loading" | "ready" }) {
  if (status === "ready") {
    return (
      <Badge tone="ok" className="flex items-center gap-1">
        <Check className="h-3 w-3" />
        saved
      </Badge>
    );
  }
  if (status === "loading") {
    return (
      <Badge tone="running" pulse>
        <Loader2 className="h-3 w-3 animate-spin" />
        syncing
      </Badge>
    );
  }
  return <Badge tone="muted">offline</Badge>;
}
