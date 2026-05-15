import type { ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Vertical icon-rail navigation. The label is exposed via aria-label and a
 * native title tooltip. Active item gets a primary tint background and a
 * left border accent (FM25 trademark).
 */
export function Sidebar({ items, activeId, onSelect }: SidebarProps) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            title={item.label}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={`
              w-10 h-10 rounded-md flex items-center justify-center
              transition-colors
              [&>svg]:w-5 [&>svg]:h-5
              ${
                isActive
                  ? "bg-primary-500/15 text-primary-300 border border-primary-500/40"
                  : "text-surface-200 hover:text-white hover:bg-surface-700"
              }
              ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            {item.icon}
          </button>
        );
      })}
    </>
  );
}
