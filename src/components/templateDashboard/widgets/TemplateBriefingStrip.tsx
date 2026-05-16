import { AlertTriangle, BatteryLow, CalendarClock, CheckCircle2, Frown, Inbox, Lightbulb, Newspaper, TrendingUp, UserX, Users } from "lucide-react";
import { TemplateCard } from "../Card";
import { cn } from "../templateUtils";

export interface TemplateBriefingStat {
  id: string;
  label: string;
  value: string | number;
  icon: "user-x" | "battery" | "trend" | "morale";
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}

export interface TemplateBriefingItem {
  id: string;
  title: string;
  value: string;
  detail: string;
  meta?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  icon: "season" | "objective" | "inbox" | "news" | "squad" | "onboarding";
  stats?: TemplateBriefingStat[];
  onClick?: () => void;
}

interface TemplateBriefingStripProps {
  items: TemplateBriefingItem[];
}

export function TemplateBriefingStrip({ items }: TemplateBriefingStripProps) {
  if (items.length === 0) return null;

  return (
    <div data-testid="template-briefing-strip" className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = iconFor(item.icon);
        return (
          <TemplateCard key={item.id} className="min-h-[112px]">
            <button
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={cn(
                "h-full w-full p-4 text-left flex flex-col gap-3",
                item.onClick && "hover:bg-white/5 transition-colors",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{item.title}</div>
                  <div className="mt-1 text-lg font-heading font-bold text-app-text truncate">{item.value}</div>
                </div>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", toneClass(item.tone ?? "neutral"))}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              {item.stats ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {item.stats.map((stat) => {
                    const StatIcon = statIconFor(stat.icon);
                    return (
                      <div key={stat.id} title={stat.label} className={cn("rounded-lg border px-2 py-1.5 flex items-center justify-center gap-1", toneClass(stat.tone ?? "neutral"))}>
                        <StatIcon className="w-3 h-3 shrink-0" />
                        <span className="text-[11px] font-bold leading-none">{stat.value}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-xs text-app-text-muted truncate">{item.detail}</p>
                  {item.meta && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-app-green truncate">{item.meta}</p>}
                </div>
              )}
            </button>
          </TemplateCard>
        );
      })}
    </div>
  );
}

function iconFor(icon: TemplateBriefingItem["icon"]) {
  if (icon === "season") return CalendarClock;
  if (icon === "objective") return CheckCircle2;
  if (icon === "inbox") return Inbox;
  if (icon === "news") return Newspaper;
  if (icon === "squad") return Users;
  if (icon === "onboarding") return Lightbulb;
  return AlertTriangle;
}

function statIconFor(icon: TemplateBriefingStat["icon"]) {
  if (icon === "user-x") return UserX;
  if (icon === "battery") return BatteryLow;
  if (icon === "trend") return TrendingUp;
  return Frown;
}

function toneClass(tone: NonNullable<TemplateBriefingItem["tone"]>): string {
  if (tone === "primary") return "bg-primary-500/15 text-primary-400 border border-primary-500/30";
  if (tone === "success") return "bg-success-500/15 text-success-500 border border-success-500/30";
  if (tone === "warning") return "bg-warn-500/15 text-warn-500 border border-warn-500/30";
  if (tone === "danger") return "bg-danger-500/15 text-danger-500 border border-danger-500/30";
  return "bg-app-bg text-app-text-muted border border-app-border";
}
