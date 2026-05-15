import type { ReactNode } from "react";

export interface SidebarV2Item {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface SidebarV2Props {
  items: SidebarV2Item[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Optional pinned content rendered below the nav list (e.g. Next Match card). */
  pinned?: ReactNode;
  /** Optional footer (Quick Actions button). */
  footer?: ReactNode;
}

/**
 * FM25-style sidebar: 208px column with labelled icon nav items, optional
 * pinned card slot (Next Match preview), and a footer slot (Quick Actions).
 */
export function SidebarV2({
  items,
  activeId,
  onSelect,
  pinned,
  footer,
}: SidebarV2Props) {
  return (
    <aside className="w-52 bg-surface-900 border-r border-surface-700/60 flex flex-col h-full flex-shrink-0">
      <nav className="flex-1 overflow-y-auto py-2 flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-md
                font-heading uppercase tracking-wider text-xs font-semibold
                transition-colors text-left
                [&>svg]:w-4 [&>svg]:h-4 [&>svg]:flex-shrink-0
                ${
                  isActive
                    ? "bg-primary-500/15 text-primary-300 border-l-2 border-primary-500 -ml-px"
                    : "text-surface-200 hover:text-white hover:bg-surface-800"
                }
                ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              {item.icon}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="text-[10px] font-stat bg-danger-500 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {pinned && (
        <div className="border-t border-surface-700/60 p-3 flex-shrink-0">
          {pinned}
        </div>
      )}

      {footer && (
        <div className="border-t border-surface-700/60 p-2 flex-shrink-0">
          {footer}
        </div>
      )}
    </aside>
  );
}
