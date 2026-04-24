import { Eye, EyeOff, Globe, Loader2, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input } from "~/components/ui";

/**
 * Save-as flow for NEW agents — replaces the OS-native window.prompt so the
 * creator can set name + description + category + visibility in one pass.
 * For existing agents the builder calls the `/versions` endpoint directly
 * (no dialog) because metadata is edited through SettingsModal.
 */

export interface SaveAsValues {
  name: string;
  description: string | null;
  category: string | null;
  visibility: "public" | "unlisted" | "private";
}

interface SaveAsModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SaveAsValues) => Promise<void>;
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

const VIS_COPY: Record<
  SaveAsValues["visibility"],
  { icon: typeof Globe; label: string; hint: string }
> = {
  public: { icon: Globe, label: "public", hint: "@handle/slug URL 로 누구나 열람" },
  unlisted: { icon: EyeOff, label: "unlisted", hint: "URL 을 아는 사람만 열람" },
  private: { icon: Eye, label: "private", hint: "나만 열람 · fork 불가" },
};

export function SaveAsModal({ open, onClose, onSubmit }: SaveAsModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [visibility, setVisibility] = useState<SaveAsValues["visibility"]>("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setCategory("");
    setVisibility("public");
    setError(null);
  }, [open]);

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

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Agent 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmed,
        description: description.trim() || null,
        category: category.trim() || null,
        visibility,
      });
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
      aria-label="Save agent as"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-[12px] border border-border-strong bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        onSubmit={handleSubmit}
        // We run our own validation (see handleSubmit) so the inline error
        // copy lands consistently instead of the OS native tooltip.
        noValidate
        data-testid="save-as-modal"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Save className="lu" />
          <span className="text-sm font-semibold tracking-tight">Workspace 에 저장</span>
          <span className="ml-auto font-mono text-[10px] text-text-tertiary">
            새 agent 로 저장합니다
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close save dialog"
            className="btn btn-ghost btn-icon"
          >
            <X className="lu" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label
              htmlFor="save-as-name"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Name <span className="text-rose-300">*</span>
            </label>
            <Input
              id="save-as-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="예: HN Daily Summary"
              size="lg"
              required
              data-testid="save-as-name"
            />
            <div className="mt-1 font-mono text-[10px] text-text-tertiary">
              URL slug 은 이 이름에서 자동 생성돼요 (예: hn-daily-summary).
            </div>
          </div>

          <div>
            <label
              htmlFor="save-as-description"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Description (선택)
            </label>
            <textarea
              id="save-as-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="한 줄 설명 — 공개 agent 카드에 표시됩니다."
              className="inp h-auto min-h-[72px] w-full resize-y"
              data-testid="save-as-description"
            />
            <div className="mt-1 font-mono text-[10px] text-text-tertiary">
              {description.length} / 400
            </div>
          </div>

          <div>
            <label
              htmlFor="save-as-category"
              className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary"
            >
              Category (선택)
            </label>
            <select
              id="save-as-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="inp"
              data-testid="save-as-category"
            >
              <option value="">(none)</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              Visibility
            </legend>
            <div className="space-y-1.5">
              {(Object.keys(VIS_COPY) as SaveAsValues["visibility"][]).map((v) => {
                const Icon = VIS_COPY[v].icon;
                const active = visibility === v;
                return (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-2 transition focus-within:border-weaver-indigo ${
                      active
                        ? "border-weaver-indigo bg-weaver-indigo/5"
                        : "border-border hover:border-border-strong"
                    }`}
                    data-testid={`save-as-visibility-${v}`}
                  >
                    <input
                      type="radio"
                      name="save-as-visibility"
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
          </fieldset>

          {error ? (
            <div
              role="alert"
              className="rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="font-mono text-[10px] text-text-tertiary">
            저장 후 홈의 "내 Agents" 에서 다시 열 수 있어요
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
              leftIcon={saving ? <Loader2 className="lu animate-spin" /> : <Save className="lu" />}
              data-testid="save-as-submit"
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
