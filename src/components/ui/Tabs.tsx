import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * FM25-style tab bar: thin underline marker, uppercase Rajdhani labels,
 * primary color on the active tab. Used inside AppShell under the topbar
 * and inline within page bodies.
 */
export function Tabs({ items, activeId, onChange, className = "" }: TabsProps) {
  return (
    <div
      role="tablist"
      className={`flex gap-0 border-b border-surface-700/60 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`
              px-4 py-2.5 -mb-px
              font-heading uppercase tracking-wider text-xs font-semibold
              border-b-2 transition-colors
              ${
                isActive
                  ? "text-white border-primary-500"
                  : "text-surface-200 hover:text-white border-transparent"
              }
              ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
