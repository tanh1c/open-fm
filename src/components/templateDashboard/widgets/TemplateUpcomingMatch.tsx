import { ChevronRight, CloudRain, MoreHorizontal, Shield } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";

interface TemplateUpcomingMatchProps {
  competitionLabel: string;
  fixtureLabel: string;
  dateLabel: string;
  timeLabel?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeSideLabel: string;
  awaySideLabel: string;
  homeForm: string[];
  awayForm: string[];
  weatherLabel?: string;
  onPreview?: () => void;
}

export function TemplateUpcomingMatch({
  competitionLabel,
  fixtureLabel,
  dateLabel,
  timeLabel = "15:00",
  homeTeamName,
  awayTeamName,
  homeSideLabel,
  awaySideLabel,
  homeForm,
  awayForm,
  weatherLabel = "22°C",
  onPreview,
}: TemplateUpcomingMatchProps) {
  return (
    <TemplateCard className="flex flex-col h-full">
      <TemplateCardHeader title="Upcoming Match" action={<MoreHorizontal className="w-4 h-4 text-app-text-muted" />} />
      <div data-testid="template-upcoming-match" className="flex-1 p-5 flex flex-col items-center">
        <div className="text-xs text-app-text-muted mb-1 text-center">{competitionLabel}</div>
        <div className="text-[10px] text-app-text-muted mb-6 text-center">{fixtureLabel}</div>

        <div className="flex items-center justify-between w-full mb-6 relative gap-2">
          <div className="flex flex-col items-center gap-2 z-10 shrink min-w-0">
            <div className="w-14 h-14 bg-app-bg border border-app-border rounded-xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-emerald-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wide truncate max-w-[80px] text-app-text">{homeTeamName}</span>
            <span className="text-[10px] text-app-text-muted">{homeSideLabel}</span>
          </div>

          <div className="flex flex-col items-center flex-1 shrink">
            <span className="text-2xl font-bold text-app-text mb-1 tracking-widest">VS</span>
            <span className="text-[10px] text-app-text-muted mb-0.5 whitespace-nowrap">{dateLabel}</span>
            <span className="text-xs font-bold text-app-text">{timeLabel}</span>
          </div>

          <div className="flex flex-col items-center gap-2 z-10 shrink min-w-0">
            <div className="w-14 h-14 bg-app-bg border border-app-border rounded-xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wide truncate max-w-[80px] text-app-text">{awayTeamName}</span>
            <span className="text-[10px] text-app-text-muted">{awaySideLabel}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full mt-auto">
          <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-app-border" />
            <span>{fixtureLabel}</span>
            <CloudRain className="w-3.5 h-3.5 ml-1" />
            <span>{weatherLabel}</span>
          </div>

          <div className="flex justify-between items-center w-full">
            <FormDots results={homeForm} />
            <FormDots results={awayForm} />
          </div>
        </div>
      </div>
      <button type="button" onClick={onPreview} className="h-10 border-t border-app-border/50 flex items-center justify-center gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>Match Preview</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </TemplateCard>
  );
}

function FormDots({ results }: { results: string[] }) {
  const visibleResults = results.slice(-5);

  return (
    <div className="flex items-center gap-1">
      {visibleResults.map((result, index) => (
        <div
          key={`${result}-${index}`}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
            result === "W"
              ? "bg-app-green/20 text-app-green"
              : result === "L"
                ? "bg-app-red/20 text-app-red"
                : "bg-gray-500/20 text-gray-400"
          }`}
        >
          {result}
        </div>
      ))}
    </div>
  );
}
