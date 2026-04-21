import {
  Download,
  Play,
  Plus,
  Redo2,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type NodeKind, useCanvas } from "~/stores/canvas";

export interface CommandContext {
  onSave: () => void;
  onImport: () => void;
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  /** Keywords concatenated for free-text search. */
  keywords: string[];
  run: (ctx: CommandContext) => void;
}

const NODE_ICON_BY_KIND: Record<NodeKind, string> = {
  input: "var(--node-input)",
  agent: "var(--node-agent)",
  tool: "var(--node-tool)",
  branch: "var(--node-branch)",
  output: "var(--node-output)",
};

function addNodeCommand(kind: NodeKind): Command {
  const label = kind[0]!.toUpperCase() + kind.slice(1);
  return {
    id: `add:${kind}`,
    label: `Add ${label} node`,
    hint: "팔레트 드래그 대신 빠르게 노드 추가",
    icon: (
      <span
        aria-hidden
        className="h-3 w-3 rounded-[3px]"
        style={{
          background: NODE_ICON_BY_KIND[kind],
          boxShadow: `0 0 6px ${NODE_ICON_BY_KIND[kind]}`,
        }}
      />
    ),
    keywords: ["add", "node", kind, label.toLowerCase(), "create"],
    run: () => {
      // Store picks a non-overlapping spot when `position` is omitted.
      useCanvas.getState().addNode(kind);
    },
  };
}

export function CommandPalette({
  open,
  onClose,
  ctx,
}: {
  open: boolean;
  onClose: () => void;
  ctx: CommandContext;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const undo = useCanvas((s) => s.undo);
  const redo = useCanvas((s) => s.redo);
  const canUndo = useCanvas((s) => s.history.length > 0);
  const canRedo = useCanvas((s) => s.future.length > 0);
  const nodes = useCanvas((s) => s.nodes);
  const setSelection = useCanvas((s) => s.setSelection);
  const removeNode = useCanvas((s) => s.removeNode);
  const selectedId = useCanvas((s) => s.selectedId);

  // Reset query + selection every time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const allCommands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      addNodeCommand("input"),
      addNodeCommand("tool"),
      addNodeCommand("agent"),
      addNodeCommand("branch"),
      addNodeCommand("output"),
      {
        id: "save",
        label: "Save · Export to JSON",
        hint: "⌘S",
        icon: <Save className="lu" />,
        keywords: ["save", "export", "json", "download"],
        run: (c) => c.onSave(),
      },
      {
        id: "import",
        label: "Import JSON…",
        icon: <Download className="lu" />,
        keywords: ["import", "upload", "open", "load", "json"],
        run: (c) => c.onImport(),
      },
      {
        id: "undo",
        label: "Undo",
        hint: "⌘Z",
        icon: <Undo2 className="lu" />,
        keywords: ["undo", "back", "revert"],
        run: () => undo(),
      },
      {
        id: "redo",
        label: "Redo",
        hint: "⌘⇧Z",
        icon: <Redo2 className="lu" />,
        keywords: ["redo", "forward"],
        run: () => redo(),
      },
      {
        id: "run",
        label: "Run agent (placeholder)",
        hint: "⌘⏎",
        icon: <Play className="lu" />,
        keywords: ["run", "execute", "play"],
        run: () => {
          /* wired in Week 4 runtime */
        },
      },
    ];

    if (selectedId) {
      cmds.push({
        id: "delete-selected",
        label: "Delete selected node",
        icon: <Trash2 className="lu" />,
        keywords: ["delete", "remove", "selected"],
        run: () => removeNode(selectedId),
      });
    }

    // Jump-to commands per existing node — searchable by label.
    for (const n of nodes) {
      const label = typeof n.data.label === "string" ? n.data.label : n.id;
      cmds.push({
        id: `jump:${n.id}`,
        label: `Jump to "${label}"`,
        hint: n.type,
        icon: <SlidersHorizontal className="lu" />,
        keywords: ["jump", "select", "goto", label, n.type ?? ""],
        run: () => setSelection(n.id),
      });
    }

    return cmds;
  }, [undo, redo, removeNode, setSelection, nodes, selectedId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCommands;
    // Tokenize so "add an agent node" matches a command whose keywords
    // collectively cover {add, agent, node} — "an" is ignored as a
    // stop-like filler by virtue of not appearing as any keyword.
    const tokens = q.split(/\s+/).filter(Boolean);
    return allCommands.filter((c) => {
      const hay = [c.label.toLowerCase(), ...c.keywords].join(" ");
      return tokens.every((t) => hay.includes(t));
    });
  }, [allCommands, query]);

  // Keep active index inside bounds when the filter narrows the list.
  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(Math.max(0, matches.length - 1));
  }, [matches, activeIndex]);

  if (!open) return null;

  const runAt = (i: number) => {
    const cmd = matches[i];
    if (!cmd) return;
    cmd.run(ctx);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      // biome-ignore lint/a11y/noStaticElementInteractions: backdrop captures click-outside to dismiss; keyboard dismissal is handled via window-level Escape in the input's onKeyDown.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {/* No onMouseDown needed — outer div's `target === currentTarget`
          check already ensures clicks bubbling from here don't dismiss. */}
      <div className="w-[520px] max-w-[90vw] overflow-hidden rounded-[12px] border border-border-strong bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="lu" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="명령 검색 · 노드 이름으로 jump…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(matches.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(activeIndex);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            className="w-full bg-transparent font-mono text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
          <span className="kbd">ESC</span>
        </div>

        <ul className="max-h-[40vh] overflow-y-auto py-1">
          {matches.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-text-tertiary">일치하는 명령 없음</li>
          ) : (
            matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => runAt(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs ${
                    i === activeIndex ? "bg-surface-3 text-text-primary" : "text-text-secondary"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="flex flex-1 items-center gap-2">
                    <span>{c.label}</span>
                    {c.hint ? (
                      <span className="ml-auto font-mono text-[10px] text-text-tertiary">
                        {c.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 font-mono text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Weaver command palette
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="kbd">↑↓</span>navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">↵</span>run
            </span>
          </span>
        </div>
      </div>
      <span className="sr-only">
        {canUndo ? "undo available" : ""}
        {canRedo ? "redo available" : ""}
        <Plus className="hidden" />
      </span>
    </div>
  );
}
