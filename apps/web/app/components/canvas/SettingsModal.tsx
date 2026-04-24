import { Eye, EyeOff, Globe, Loader2, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input } from "~/components/ui";

export type AgentMetadata = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  visibility: string;
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentMetadata | null;
  onSaved: (next: AgentMetadata) => void;
}

const CATEGORIES = [
  "productivity",
  "news",
  "research",
  "coding",
  "creative",
  "fun",
  "etc",
] as const;

const VIS_COPY: Record<string, { icon: typeof Globe; label: string; hint: string }> = {
  public: { icon: Globe, label: "public", hint: "@handle/slug URL 로 누구나 열람 가능" },
  unlisted: { icon: EyeOff, label: "unlisted", hint: "URL 을 아는 사람만 열람. 목록·검색엔 없음" },
  private: { icon: Eye, label: "private", hint: "나만 열람. fork 불가" },
};

export function SettingsModal({ open, onClose, agent, onSaved }: SettingsModalProps) {
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [category, setCategory] = useState<string>(agent?.category ?? "");
  const [visibility, setVisibility] = useState<string>(agent?.visibility ?? "public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-hydrate local form state each time the modal opens or the upstream
  // agent changes — otherwise stale values leak across edit sessions.
  useEffect(() => {
    if (!open) return;
    setName(agent?.name ?? "");
    setDescription(agent?.description ?? "");
    setCategory(agent?.category ?? "");
    setVisibility(agent?.visibility ?? "public");
    setError(null);
  }, [open, agent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !agent) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          category: category.trim() || null,
          visibility,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`저장 실패 (${res.status}): ${txt}`);
      }
      const updated = (await res.json()) as AgentMetadata;
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh] backdrop-blur-sm"
      role="dialog"
      aria-label="Agent settings"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-[12px] border border-border-strong bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        onSubmit={onSubmit}
        data-testid="settings-modal"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Settings className="lu" />
          <span className="text-sm font-semibold tracking-tight">Agent 설정</span>
          <span className="ml-auto font-mono text-[10px] text-text-tertiary">
            @{agent.slug} — 메타데이터 편집
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="btn btn-ghost btn-icon"
          >
            <X className="lu" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label
              htmlFor="agent-name"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Name
            </label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="예: HN Summary"
              data-testid="settings-name"
              size="lg"
            />
            <div className="mt-1 font-mono text-[10px] text-text-tertiary">
              URL slug `{agent.slug}` 은 변경되지 않습니다.
            </div>
          </div>

          <div>
            <label
              htmlFor="agent-description"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Description
            </label>
            <textarea
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="agent 한 줄 설명 — 공개 페이지 카드에 표시됨"
              className="inp h-auto min-h-[72px] w-full resize-y"
              data-testid="settings-description"
            />
            <div className="mt-1 font-mono text-[10px] text-text-tertiary">
              {description.length} / 400
            </div>
          </div>

          <div>
            <label
              htmlFor="agent-category"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Category
            </label>
            <select
              id="agent-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="inp"
              data-testid="settings-category"
            >
              <option value="">(none)</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              Visibility
            </span>
            <div className="space-y-1.5">
              {(["public", "unlisted", "private"] as const).map((v) => {
                const Icon = VIS_COPY[v].icon;
                const active = visibility === v;
                return (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-2 transition ${
                      active
                        ? "border-weaver-indigo bg-weaver-indigo/5"
                        : "border-border hover:border-border-strong"
                    }`}
                    data-testid={`settings-visibility-${v}`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={v}
                      checked={active}
                      onChange={() => setVisibility(v)}
                      className="mt-1"
                    />
                    <Icon className="lu mt-0.5 text-text-secondary" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{VIS_COPY[v].label}</div>
                      <div className="mt-0.5 text-xs text-text-tertiary">{VIS_COPY[v].hint}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {error ? (
            <div
              className="rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="font-mono text-[10px] text-text-tertiary">
            저장 즉시 반영 · 실행 중인 run 에는 영향 없음
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              leftIcon={saving ? <Loader2 className="lu animate-spin" /> : undefined}
              data-testid="settings-save"
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
