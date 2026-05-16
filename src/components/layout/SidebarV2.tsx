import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  ChevronLeft,
  CloudRain,
  Settings,
  Shield,
} from "lucide-react";

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
  brand?: ReactNode;
  onBrandClick?: () => void;
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
  brand,
  onBrandClick,
  pinned,
  footer,
}: SidebarV2Props) {
  return (
    <aside className="w-64 bg-[#151b23] flex flex-col h-full border-r border-app-border shrink-0">
      <button
        type="button"
        data-testid="sidebar-brand"
        onClick={onBrandClick}
        className="h-16 flex items-center px-6 gap-3 shrink-0 text-left hover:text-app-green transition-colors"
      >
        <div className="w-8 h-8 bg-app-green/20 rounded-lg flex items-center justify-center text-app-green">
          <Shield className="w-5 h-5" />
        </div>
        <span className="font-bold text-xl tracking-tight text-app-text">
          {brand ?? "OpenManager"}
        </span>
      </button>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 custom-scrollbar">
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
                flex items-center justify-between w-full px-3 py-2.5 rounded-lg
                text-sm font-medium transition-colors text-left group
                [&>svg]:w-5 [&>svg]:h-5 [&>svg]:flex-shrink-0
                ${
                  isActive
                    ? "bg-app-green/10 text-app-green"
                    : "text-app-text-muted hover:text-app-text hover:bg-white/5"
                }
                ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              <span className="flex items-center gap-3 min-w-0">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {isActive && <span data-testid="sidebar-active-dot" className="w-1.5 h-1.5 rounded-full bg-app-green" />}
                {item.badge && item.badge > 0 ? (
                  <span className="text-[10px] font-bold bg-app-red text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 px-5">
        {pinned ?? (
          <>
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Next Match</h3>
              <span className="text-[10px] text-app-text-muted">--</span>
            </div>
            <div className="bg-app-bg rounded-lg p-3 border border-app-border">
              <div className="flex items-center justify-between mb-3 border-b border-app-border/50 pb-2">
                <Shield className="w-7 h-7 text-emerald-500" />
                <span className="text-xs font-bold text-app-text-muted">VS</span>
                <Shield className="w-7 h-7 text-amber-500" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-app-text-muted">
                <span className="truncate max-w-[80px]">No fixture</span>
                <div className="flex items-center gap-1">
                  <CloudRain className="w-3 h-3" />
                  <span>--°C</span>
                </div>
              </div>
            </div>
          </>
        )}
        <button className="w-full mt-3 flex items-center justify-between px-3 py-2 text-xs font-medium border border-app-border rounded-lg hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2 text-app-text-muted">
             <ArrowRightLeft className="w-3.5 h-3.5" />
             <span>Quick Actions</span>
          </div>
          <ChevronLeft className="w-3.5 h-3.5 rotate-180 text-app-text-muted" />
        </button>
      </div>

      <div className="h-14 border-t border-app-border flex items-center justify-between px-4 shrink-0 text-app-text-muted">
        {footer ?? (
          <>
            <button type="button" className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <Settings className="w-4 h-4" />
            </button>
            <button type="button" className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
