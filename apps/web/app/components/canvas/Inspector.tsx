import { labelError, uniqueLabelError } from "@weaver/core";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Input, Tabs } from "~/components/ui";
import { type CanvasNode, useCanvas } from "~/stores/canvas";

export function Inspector() {
  const selectedId = useCanvas((s) => s.selectedId);
  const nodes = useCanvas((s) => s.nodes);
  const node = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  return (
    <aside className="flex w-[360px] flex-col border-l border-border bg-surface-1">
      <Tabs
        items={[
          {
            id: "props",
            label: "PROPS",
            // Remount PropsForm per node so its local (label/body) state
            // reinitializes cleanly when selection changes.
            content: node ? <PropsForm key={node.id} node={node} /> : <EmptyInspector />,
          },
          {
            id: "trace",
            label: "TRACE",
            content: <TracePlaceholder />,
          },
        ]}
        className="flex flex-col overflow-hidden"
      />
    </aside>
  );
}

function EmptyInspector() {
  return (
    <div className="p-4 text-xs leading-relaxed text-text-secondary">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        선택된 노드 없음
      </div>
      <p>
        캔버스에서 노드를 선택하면 props가 여기에 나타납니다. 좌측 팔레트에서 노드를 드래그해
        캔버스에 추가할 수 있어요.
      </p>
    </div>
  );
}

function PropsForm({ node }: { node: CanvasNode }) {
  const updateNodeData = useCanvas((s) => s.updateNodeData);
  const removeNode = useCanvas((s) => s.removeNode);
  const allNodes = useCanvas((s) => s.nodes);

  const [label, setLabel] = useState<string>(node.data.label ?? "");
  const [body, setBody] = useState<string>(stringifyBody(node.data.body));

  // Two-layer validation from @weaver/core:
  //   1. Shape (non-empty, ≤ 40 chars) — labelError
  //   2. Uniqueness across the current canvas — uniqueLabelError
  // The shape check wins when both fail, so users see the most fundamental
  // problem first.
  const siblings = useMemo(
    () => allNodes.map((n) => ({ id: n.id, label: (n.data.label ?? "") as string })),
    [allNodes],
  );
  const currentLabelError = labelError(label) ?? uniqueLabelError(label, node.id, siblings);

  // Only call `updateNodeData` when the value actually changed. Otherwise a
  // benign blur (e.g. clicking elsewhere on the canvas) fires an identity
  // update that still counts as a history-worthy mutation, and users get
  // phantom undo steps that appear to do nothing.
  // Only call `updateNodeData` when the value actually changed. Otherwise a
  // benign blur (clicking elsewhere on the canvas) fires an identity update
  // that still counts as a history-worthy mutation, and users get phantom
  // undo steps that appear to do nothing.
  const commitLabel = () => {
    if (currentLabelError) return;
    if (label === (node.data.label ?? "")) return;
    updateNodeData(node.id, { label });
  };

  const commitBody = () => {
    if (body === stringifyBody(node.data.body)) return;
    updateNodeData(node.id, { body });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-sm"
            style={{
              background: `var(--node-${node.type})`,
              boxShadow: `0 0 6px var(--node-${node.type})`,
            }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
            {node.type}
          </span>
        </div>
        <Badge tone="muted">v1</Badge>
      </div>

      <div>
        <div className="label">Label</div>
        <Input
          value={label}
          state={currentLabelError ? "error" : "default"}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Let onBlur handle the commit so we don't invoke it twice
              // (blur() below triggers onBlur → commitLabel naturally).
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="policy_check"
        />
        <div className={`help${currentLabelError ? " err" : ""}`}>
          {currentLabelError ?? "snake_case · 40자 이하 · 캔버스 내 고유"}
        </div>
      </div>

      <div>
        <div className="label">Body</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={commitBody}
          rows={4}
          className="inp mono"
          placeholder="model: sonnet-4-6"
        />
        <div className="help">노드 미리보기에 표시되는 meta 텍스트</div>
      </div>

      {node.type === "branch" ? <BranchOutputsEditor node={node} /> : null}

      <div className="border-t border-border pt-3">
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 className="lu" />}
          onClick={() => removeNode(node.id)}
        >
          노드 삭제
        </Button>
      </div>

      <DebugPayload node={node} />
    </div>
  );
}

function BranchOutputsEditor({ node }: { node: CanvasNode }) {
  const addBranchOutput = useCanvas((s) => s.addBranchOutput);
  const removeBranchOutput = useCanvas((s) => s.removeBranchOutput);
  const outputs = node.data.outputs ?? [];
  const [draft, setDraft] = useState("");

  const remove = (id: string) => {
    removeBranchOutput(node.id, id);
  };

  const add = () => {
    const v = draft.trim();
    if (!v || outputs.includes(v)) return;
    addBranchOutput(node.id, v);
    setDraft("");
  };

  return (
    <div>
      <div className="label">Outputs · branch handles</div>
      <div className="flex flex-wrap gap-1.5">
        {outputs.map((o) => (
          <span key={o} className="chip">
            {o}
            <button
              type="button"
              className="x"
              onClick={() => remove(o)}
              aria-label={`remove output ${o}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="approve"
        />
        <Button variant="secondary" size="sm" onClick={add}>
          추가
        </Button>
      </div>
      <div className="help">각 output은 별도 엣지로 연결됩니다 (우측 handle 생성)</div>
    </div>
  );
}

function DebugPayload({ node }: { node: CanvasNode }) {
  return (
    <details className="mt-4 rounded-lg border border-border bg-surface-2">
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        debug · node payload
      </summary>
      <pre className="overflow-x-auto border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-text-secondary">
        {JSON.stringify(
          { id: node.id, type: node.type, position: node.position, data: sanitize(node.data) },
          null,
          2,
        )}
      </pre>
    </details>
  );
}

function TracePlaceholder() {
  return (
    <div className="p-4 text-xs text-text-secondary">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        최근 실행
      </div>
      <div className="empty">
        <div className="ico">—</div>
        <h4>아직 실행 기록이 없어요</h4>
        <p>Run 버튼을 누르면 trace가 여기 스트리밍됩니다.</p>
      </div>
    </div>
  );
}

function stringifyBody(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  return String(body);
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(data)) {
    if (val === null || val === undefined) continue;
    if (k === "statusPill" || k === "durationPill") continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[k] = val;
    } else if (Array.isArray(val)) {
      result[k] = val;
    } else if (typeof val === "object") {
      // skip ReactNode / complex objects
    }
  }
  return result;
}
