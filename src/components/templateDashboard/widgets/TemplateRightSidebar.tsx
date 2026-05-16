import { ChevronRight, Goal, MoreHorizontal, Shield } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";
import { cn } from "../templateUtils";
import type { TemplateBriefingRow, TemplateClubBriefingSection } from "./TemplateClubBriefing";

export interface TemplateLeagueTableRow {
  pos: number;
  name: string;
  p: number;
  gd: string;
  pts: number;
  active?: boolean;
  color: string;
}

export interface TemplateFixtureRow {
  id: string;
  date: string;
  opponent: string;
  isHome: boolean;
  type: string;
  color: string;
}

export interface TemplateTrainingRow {
  label: string;
  value: number;
  color: string;
  stars: number;
}

interface TemplateRightSidebarProps {
  leagueRows: TemplateLeagueTableRow[];
  squadStatus: {
    injured: number;
    matchFit: number;
    tired: number;
    internationalDuty: number;
    moraleLabel: string;
  };
  fixtures: TemplateFixtureRow[];
  trainingRows: TemplateTrainingRow[];
  trainingScheduleLabel: string;
  clubBriefingSections: TemplateClubBriefingSection[];
  onViewTable?: () => void;
  onViewSchedule?: () => void;
  onViewTraining?: () => void;
}

export function TemplateRightSidebar({
  leagueRows,
  squadStatus,
  fixtures,
  trainingRows,
  trainingScheduleLabel,
  clubBriefingSections,
  onViewTable,
  onViewSchedule,
  onViewTraining,
}: TemplateRightSidebarProps) {
  return (
    <>
      <LeagueTableWidget rows={leagueRows} onViewTable={onViewTable} />
      <SquadStatusWidget status={squadStatus} />
      <SidebarClubBriefing sections={clubBriefingSections} />
      <UpcomingFixturesWidget fixtures={fixtures} onViewSchedule={onViewSchedule} />
      <TrainingOverviewWidget rows={trainingRows} scheduleLabel={trainingScheduleLabel} onViewTraining={onViewTraining} />
    </>
  );
}

function LeagueTableWidget({ rows, onViewTable }: { rows: TemplateLeagueTableRow[]; onViewTable?: () => void }) {
  return (
    <TemplateCard className="flex flex-col">
      <TemplateCardHeader title="LEAGUE TABLE" action={<MoreHorizontal className="w-4 h-4 text-app-text-muted" />} />
      <div className="p-4 pt-2">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead>
            <tr className="text-app-text-muted border-b border-app-border/50">
              <th className="font-semibold py-2 w-8">POS</th>
              <th className="font-semibold py-2">TEAM</th>
              <th className="font-semibold py-2 text-right">P</th>
              <th className="font-semibold py-2 text-right">GD</th>
              <th className="font-semibold py-2 text-right">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team) => (
              <tr key={team.pos} className={cn("border-b border-app-border/30 last:border-0", team.active ? "bg-app-green/10" : "")}>
                <td className="py-2 text-app-text-muted">{team.pos}</td>
                <td className="py-2 flex items-center gap-2">
                  <Shield className={cn("w-3.5 h-3.5", team.color)} />
                  <span className={cn("font-medium", team.active ? "text-app-green" : "text-app-text")}>{team.name}</span>
                </td>
                <td className="py-2 text-right text-app-text-muted">{team.p}</td>
                <td className="py-2 text-right text-app-text-muted">{team.gd}</td>
                <td className={cn("py-2 text-right font-semibold", team.active ? "text-app-green" : "text-app-text")}>{team.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onViewTable} className="h-8 border-t border-app-border/50 flex items-center justify-center gap-2 text-[10px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>View Full Table</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </TemplateCard>
  );
}

function SquadStatusWidget({ status }: { status: TemplateRightSidebarProps["squadStatus"] }) {
  return (
    <TemplateCard className="flex flex-col">
      <TemplateCardHeader title="SQUAD STATUS" action={<MoreHorizontal className="w-4 h-4 text-app-text-muted" />} />
      <div className="p-4 py-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <StatusRow color="bg-red-500" label="Injured" count={status.injured} />
          <StatusRow color="bg-app-green" label="Match Fit" count={status.matchFit} />
          <StatusRow color="bg-amber-500" label="Tired" count={status.tired} />
          <StatusRow color="bg-blue-500" label="On International Duty" count={status.internationalDuty} />
        </div>
        <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex items-center justify-center shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-app-border)" strokeWidth="8" />
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-primary-500)" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="60" className="drop-shadow-[0_0_8px_rgba(124,92,255,0.45)]" />
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-warn-500)" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="210" />
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-danger-500)" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="230" />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className="text-[9px] sm:text-[10px] text-app-text-muted leading-tight">Overall<br />Morale</span>
            <span className="text-[10px] sm:text-xs font-bold text-app-green leading-tight">{status.moraleLabel}</span>
            <span className="text-[9px] mt-0.5">☺</span>
          </div>
        </div>
      </div>
    </TemplateCard>
  );
}

function StatusRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-start justify-between text-[11px] gap-2">
      <div className="flex items-start gap-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1", color)} />
        <span className="text-app-text-muted leading-tight">{label}</span>
      </div>
      <span className="font-semibold text-app-text shrink-0">{count}</span>
    </div>
  );
}

function SidebarClubBriefing({ sections }: { sections: TemplateClubBriefingSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div data-testid="template-club-briefing" className="flex flex-col gap-4">
      {sections.map((section) => (
        <TemplateCard key={section.id} className="flex flex-col">
          <TemplateCardHeader
            title={section.title}
            action={
              <button type="button" onClick={section.onAction} className="inline-flex items-center gap-1 text-[10px] font-semibold text-app-green hover:text-primary-400 transition-colors">
                <span>{section.actionLabel}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="p-4 pt-3 flex flex-col gap-2">
            {section.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-app-border/70 flex items-center justify-center px-3 py-4 text-xs text-app-text-muted text-center">
                {section.emptyLabel}
              </div>
            ) : (
              section.rows.slice(0, 3).map((row) => <SidebarBriefingRow key={row.id} row={row} />)
            )}
          </div>
        </TemplateCard>
      ))}
    </div>
  );
}

function SidebarBriefingRow({ row }: { row: TemplateBriefingRow }) {
  return (
    <div className="rounded-lg bg-app-bg/60 border border-app-border/50 px-3 py-2 flex items-center gap-3 min-w-0">
      <div className={cn("w-2 h-2 rounded-full shrink-0", briefingDotClass(row.tone ?? "neutral"))} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-app-text truncate">{row.title}</div>
        <div className="mt-0.5 text-[10px] text-app-text-muted truncate">{row.detail}</div>
      </div>
      {row.meta && <div className="text-[10px] font-bold uppercase tracking-wider text-app-green shrink-0">{row.meta}</div>}
    </div>
  );
}

function briefingDotClass(tone: NonNullable<TemplateBriefingRow["tone"]>): string {
  if (tone === "primary") return "bg-primary-500";
  if (tone === "success") return "bg-success-500";
  if (tone === "warning") return "bg-warn-500";
  if (tone === "danger") return "bg-danger-500";
  return "bg-app-border";
}

function UpcomingFixturesWidget({ fixtures, onViewSchedule }: { fixtures: TemplateFixtureRow[]; onViewSchedule?: () => void }) {
  return (
    <TemplateCard className="flex flex-col">
      <TemplateCardHeader title="UPCOMING FIXTURES" />
      <div className="p-4 pt-2">
        {fixtures.map((match) => (
          <div key={match.id} className="flex items-center gap-3 py-2 border-b border-app-border/30 last:border-0">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-app-text-muted">{match.date}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-app-border mt-0.5" />
            </div>
            <div className="flex flex-1 items-center gap-2 text-[11px]">
              <Shield className={cn("w-3.5 h-3.5", match.color)} />
              <span className="text-app-text font-medium">{match.opponent} {match.isHome ? "(H)" : "(A)"}</span>
            </div>
            <span className="text-[10px] text-app-text-muted">{match.type}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={onViewSchedule} className="h-8 border-t border-app-border/50 flex items-center justify-center gap-2 text-[10px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>View Full Schedule</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </TemplateCard>
  );
}

function TrainingOverviewWidget({ rows, scheduleLabel, onViewTraining }: { rows: TemplateTrainingRow[]; scheduleLabel: string; onViewTraining?: () => void }) {
  return (
    <TemplateCard className="flex flex-col">
      <TemplateCardHeader
        title="TRAINING OVERVIEW"
        action={
          <div className="text-[10px] text-app-text-muted flex items-center gap-1 cursor-pointer">
            <span>{scheduleLabel}</span>
            <ChevronRight className="w-3 h-3 rotate-90" />
          </div>
        }
      />
      <div className="p-4 pt-2 flex flex-col gap-3">
        {rows.map((row) => <TrainingRow key={row.label} {...row} />)}
      </div>
      <button type="button" onClick={onViewTraining} className="h-8 border-t border-app-border/50 flex items-center justify-center gap-2 text-[10px] font-semibold text-app-green hover:bg-app-green/5 transition-colors mt-auto">
        <span>Training Calendar</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </TemplateCard>
  );
}

function TrainingRow({ label, value, color, stars }: TemplateTrainingRow) {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-2 w-20">
        <Goal className="w-3.5 h-3.5 text-app-text-muted" />
        <span className="text-app-text-muted">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full shadow-[0_0_6px_rgba(0,0,0,0.5)]", color)} style={{ width: `${value}%` }} />
      </div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} viewBox="0 0 24 24" fill={star <= stars ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={cn("w-2.5 h-2.5", star <= stars ? "text-app-text" : "text-app-border")}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>
    </div>
  );
}
