import {
  BookOpen,
  Command,
  Download,
  ExternalLink,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Kbd } from "~/components/ui";

interface Row {
  label: string;
  hint: ReactNode;
  desc?: string;
}

const SHORTCUTS: Row[] = [
  {
    label: "Command palette",
    hint: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
    desc: "노드 추가 · jump · Compose AI 등 모든 명령 검색",
  },
  {
    label: "Compose with AI",
    hint: (
      <span className="flex gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span className="text-text-tertiary">→</span>
        <span>compose</span>
      </span>
    ),
    desc: "자연어 → /api/compose → diff를 canvas에 적용",
  },
  {
    label: "Save / Export JSON",
    hint: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>S</Kbd>
      </>
    ),
    desc: "현재 canvas를 Graph JSON으로 다운로드",
  },
  {
    label: "Undo",
    hint: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>Z</Kbd>
      </>
    ),
    desc: "최근 의미있는 편집 한 단계 되돌리기",
  },
  {
    label: "Redo",
    hint: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>Z</Kbd>
      </>
    ),
  },
  {
    label: "노드 삭제",
    hint: (
      <span className="flex gap-1">
        <Kbd>Delete</Kbd>
        <span className="text-text-tertiary">또는</span>
        <Kbd>⌫</Kbd>
      </span>
    ),
    desc: "선택 노드 + 연결 엣지 cascade 제거",
  },
  {
    label: "닫기 · 취소",
    hint: <Kbd>Esc</Kbd>,
    desc: "모달 · 팔레트 닫기",
  },
  {
    label: "Compose 바로 제출",
    hint: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>⏎</Kbd>
      </>
    ),
    desc: "프롬프트 textarea에서 제출 트리거",
  },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop-to-dismiss; ESC handled by the window listener above.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh] backdrop-blur-sm"
      role="dialog"
      aria-label="Help"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[620px] max-w-[92vw] overflow-hidden rounded-[12px] border border-border-strong bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <BookOpen className="lu" />
          <span className="text-sm font-semibold tracking-tight">Weaver · 도움말</span>
          <span className="ml-auto font-mono text-[10px] text-text-tertiary">
            v0 draft — 키보드 · 기능 · 참고 링크
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="btn btn-ghost btn-icon"
          >
            <X className="lu" />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_1fr] gap-0">
          <section className="border-r border-border p-4">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              Shortcuts
            </h3>
            <ul className="space-y-2.5">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-start gap-3 text-xs">
                  <span className="min-w-[130px] text-text-primary">{s.label}</span>
                  <span className="flex flex-wrap items-center gap-1">{s.hint}</span>
                  {s.desc ? (
                    <span className="ml-auto max-w-[220px] text-right text-text-tertiary">
                      {s.desc}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="p-4">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              Actions
            </h3>
            <ul className="space-y-2 text-xs">
              <ActionRow
                icon={<Sparkles className="lu" />}
                title="Compose with AI"
                desc="헤더 'Compose' 버튼 또는 팔레트 명령 — 현재 canvas + 프롬프트 → diff"
              />
              <ActionRow
                icon={<Download className="lu" />}
                title="Import JSON"
                desc="이전에 Save한 *.weaver.json 을 불러와 canvas 교체"
              />
              <ActionRow
                icon={<Save className="lu" />}
                title="Save"
                desc="@weaver/core Graph 스키마에 맞춘 JSON 다운로드"
              />
              <ActionRow
                icon={<Undo2 className="lu" />}
                title="Undo · Redo"
                desc="history 스택 최대 50단계. 드래그는 드랍 시점에 1회 기록"
              />
              <ActionRow
                icon={<Trash2 className="lu" />}
                title="노드 삭제"
                desc="인스펙터 '노드 삭제' 버튼 또는 Delete/Backspace. 엣지 cascade"
              />
              <ActionRow
                icon={<Command className="lu" />}
                title="Jump to node"
                desc="팔레트에서 라벨로 검색 → 즉시 선택 · 인스펙터 포커스"
              />
            </ul>

            <h3 className="mt-5 mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
              Links
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a
                  href="/design"
                  className="inline-flex items-center gap-1 text-weaver-cyan hover:underline"
                >
                  Design System <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="/tools/demo/runs/01HXY"
                  className="inline-flex items-center gap-1 text-weaver-cyan hover:underline"
                >
                  Trace viewer (placeholder) <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/JinhuiStudy/weaver"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-weaver-cyan hover:underline"
                >
                  Repository <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[10px] text-text-tertiary">
          <span>도움말은 언제든 ? 또는 Help 버튼으로</span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>닫기
          </span>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-text-primary">{title}</div>
        <div className="mt-0.5 text-text-tertiary leading-relaxed">{desc}</div>
      </div>
    </li>
  );
}
