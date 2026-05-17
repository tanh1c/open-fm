import type { ReactNode } from "react";
import { ArrowRightLeft, ChevronLeft, CloudRain, Settings, Shield } from "lucide-react";
import { cn } from "./templateUtils";

export interface TemplateSidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface TemplateSidebarProps {
  items: TemplateSidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onBrandClick?: () => void;
  nextMatch?: {
    dateLabel: string;
    homeName: string;
    awayName: string;
    weatherLabel?: string;
  } | null;
  onQuickActions?: () => void;
  onSettings?: () => void;
}

export function TemplateSidebar({
  items,
  activeId,
  onSelect,
  onBrandClick,
  nextMatch,
  onQuickActions,
  onSettings,
}: TemplateSidebarProps) {
  return (
    <aside data-testid="template-sidebar" className="w-64 bg-[#151b23] flex flex-col h-full border-r border-app-border shrink-0">
      <button
        type="button"
        onClick={onBrandClick}
        className="h-16 flex items-center px-6 gap-3 shrink-0 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-green/25 bg-app-green/10 shadow-[0_0_14px_rgba(45,212,191,0.18)]">
          <img
            src="/football-svgrepo-com.svg"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 object-contain"
          />
        </span>
        <span className="font-heading text-[28px] font-black tracking-[-0.055em] leading-none">
          <span className="text-app-text">Open</span><span className="text-app-green">FM</span>
        </span>
      </button>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 custom-scrollbar">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative group",
                isActive
                  ? "bg-app-green/10 text-app-green"
                  : "text-app-text-muted hover:bg-white/5 hover:text-app-text",
                item.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {isActive && <div data-testid="template-sidebar-active-dot" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-app-green rounded-r-full" />}
              <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-app-red text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 px-5">
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Next Match</h3>
          <span className="text-[10px] text-app-text-muted">{nextMatch?.dateLabel ?? "--"}</span>
        </div>
        <div className="bg-app-bg rounded-lg p-3 border border-app-border">
          <div className="flex items-center justify-between mb-3 border-b border-app-border/50 pb-2">
            <Shield className="w-7 h-7 text-primary-500" />
            <span className="text-xs font-bold text-app-text-muted">VS</span>
            <Shield className="w-7 h-7 text-amber-500" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-app-text-muted">
            <span className="truncate max-w-[80px]">{nextMatch ? `${nextMatch.homeName} v ${nextMatch.awayName}` : "No fixture"}</span>
            <div className="flex items-center gap-1">
              <CloudRain className="w-3 h-3" />
              <span>{nextMatch?.weatherLabel ?? "--°C"}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onQuickActions}
          className="w-full mt-3 flex items-center justify-between px-3 py-2 text-xs font-medium border border-app-border rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 text-app-text-muted">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Quick Actions</span>
          </div>
          <ChevronLeft className="w-3.5 h-3.5 rotate-180 text-app-text-muted" />
        </button>
      </div>

      <div className="h-14 border-t border-app-border flex items-center justify-between px-4 shrink-0 text-app-text-muted">
        <button type="button" onClick={onSettings} className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <Settings className="w-4 h-4" />
        </button>
        <button type="button" className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
