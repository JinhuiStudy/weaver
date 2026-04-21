import type { DragEvent } from "react";
import type { NodeKind } from "~/stores/canvas";
import { PALETTE_DRAG_MIME } from "./NodeCanvas";

interface PaletteItem {
  kind: NodeKind;
  label: string;
  color: string;
}

const ITEMS: PaletteItem[] = [
  { kind: "input", label: "Input", color: "var(--node-input)" },
  { kind: "tool", label: "Tool", color: "var(--node-tool)" },
  { kind: "agent", label: "Agent", color: "var(--node-agent)" },
  { kind: "branch", label: "Branch", color: "var(--node-branch)" },
  { kind: "output", label: "Output", color: "var(--node-output)" },
];

export function Palette() {
  const onDragStart = (e: DragEvent<HTMLElement>, kind: NodeKind) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(PALETTE_DRAG_MIME, kind);
  };

  return (
    <aside className="flex w-[72px] flex-col items-center gap-1 border-r border-border bg-surface-1 py-3">
      <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-text-tertiary">
        drag
      </div>
      {ITEMS.map((p) => (
        <button
          type="button"
          key={p.kind}
          draggable
          onDragStart={(e) => onDragStart(e, p.kind)}
          title={`${p.label} 노드 — 캔버스로 드래그`}
          className="flex w-14 cursor-grab flex-col items-center gap-1 rounded-md bg-transparent px-2 py-2 text-[10px] uppercase tracking-[0.1em] text-text-tertiary select-none hover:bg-surface-2 hover:text-text-primary active:cursor-grabbing"
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
  );
}
