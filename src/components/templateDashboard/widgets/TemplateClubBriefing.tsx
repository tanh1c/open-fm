import { ChevronRight } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";
import { cn } from "../templateUtils";

export interface TemplateBriefingRow {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}

export interface TemplateClubBriefingSection {
  id: string;
  title: string;
  emptyLabel: string;
  rows: TemplateBriefingRow[];
  actionLabel: string;
  onAction?: () => void;
}

interface TemplateClubBriefingProps {
  sections: TemplateClubBriefingSection[];
}

export function TemplateClubBriefing({ sections }: TemplateClubBriefingProps) {
  if (sections.length === 0) return null;

  return (
    <TemplateCard data-testid="template-club-briefing" className="flex flex-col">
      <TemplateCardHeader title="CLUB BRIEFING" />
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-x lg:divide-y-0 divide-app-border/50">
        {sections.map((section) => (
          <div key={section.id} className="min-w-0 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{section.title}</h3>
              <button type="button" onClick={section.onAction} className="inline-flex items-center gap-1 text-[10px] font-semibold text-app-green hover:text-primary-400 transition-colors">
                <span>{section.actionLabel}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2 min-h-[92px]">
              {section.rows.length === 0 ? (
                <div className="h-full rounded-lg border border-dashed border-app-border/70 flex items-center justify-center px-3 py-4 text-xs text-app-text-muted text-center">
                  {section.emptyLabel}
                </div>
              ) : (
                section.rows.slice(0, 3).map((row) => <BriefingRow key={row.id} row={row} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </TemplateCard>
  );
}

function BriefingRow({ row }: { row: TemplateBriefingRow }) {
  return (
    <div className="rounded-lg bg-app-bg/60 border border-app-border/50 px-3 py-2 flex items-center gap-3 min-w-0">
      <div className={cn("w-2 h-2 rounded-full shrink-0", dotClass(row.tone ?? "neutral"))} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-app-text truncate">{row.title}</div>
        <div className="mt-0.5 text-[10px] text-app-text-muted truncate">{row.detail}</div>
      </div>
      {row.meta && <div className="text-[10px] font-bold uppercase tracking-wider text-app-green shrink-0">{row.meta}</div>}
    </div>
  );
}

function dotClass(tone: NonNullable<TemplateBriefingRow["tone"]>): string {
  if (tone === "primary") return "bg-primary-500";
  if (tone === "success") return "bg-success-500";
  if (tone === "warning") return "bg-warn-500";
  if (tone === "danger") return "bg-danger-500";
  return "bg-app-border";
}
