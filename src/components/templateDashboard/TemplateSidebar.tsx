import { useState, type ReactNode } from "react";
import { ChevronLeft, Settings } from "lucide-react";
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
  onSettings?: () => void;
}

export function TemplateSidebar({
  items,
  activeId,
  onSelect,
  onBrandClick,
  onSettings,
}: TemplateSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      data-testid="template-sidebar"
      className={cn(
        "bg-[#151b23] flex flex-col h-full border-r border-app-border shrink-0 transition-[width] duration-200",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={onBrandClick}
        className={cn(
          "h-16 flex items-center gap-3 shrink-0 text-left",
          isCollapsed ? "justify-center px-3" : "px-6",
        )}
      >
        <img
          src="/football-svgrepo-com.svg"
          alt=""
          aria-hidden="true"
          className="h-12 w-12 shrink-0 object-contain"
        />
        {!isCollapsed && (
          <span className="font-heading text-[32px] font-black tracking-[-0.055em] leading-none">
            <span className="text-app-text">Open</span><span className="text-app-green">FM</span>
          </span>
        )}
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
              {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="bg-app-red text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>


      <div className="h-14 border-t border-app-border flex items-center justify-between px-4 shrink-0 text-app-text-muted">
        <button type="button" onClick={onSettings} className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <Settings className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsCollapsed((current) => !current)}
          className="p-2 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
