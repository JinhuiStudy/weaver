import { type ReactNode, useState } from "react";
import { cn } from "~/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultId?: string;
  variant?: "line" | "pill";
  className?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ items, defaultId, variant = "line", className, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const wrapperClass = variant === "pill" ? "pill-tabs" : "tabs";
  const itemClass = variant === "pill" ? "pt" : "t";

  return (
    <div className={className}>
      <div className={wrapperClass}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={cn(itemClass, active === it.id && "active")}
            onClick={() => {
              setActive(it.id);
              onChange?.(it.id);
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
      {items.find((it) => it.id === active)?.content ? (
        <div className="pt-4">{items.find((it) => it.id === active)?.content}</div>
      ) : null}
    </div>
  );
}
