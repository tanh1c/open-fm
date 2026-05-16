import { ChevronRight } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";

export interface TemplateGoalSegment {
  name: string;
  value: number;
  color: string;
}

interface TemplateGoalsAnalysisProps {
  data: TemplateGoalSegment[];
  onViewFullAnalysis?: () => void;
}

export function TemplateGoalsAnalysis({ data, onViewFullAnalysis }: TemplateGoalsAnalysisProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = total || 1;

  return (
    <TemplateCard className="flex flex-col h-full">
      <TemplateCardHeader title="GOALS ANALYSIS" />
      <div className="flex-1 p-4 flex items-center justify-between min-h-[140px]">
        <div className="w-28 h-28 relative flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="36" fill="transparent" stroke="#232d3b" strokeWidth="14" />
            {buildArcs(data, safeTotal).map((arc) => (
              <circle
                key={arc.name}
                cx="50"
                cy="50"
                r="36"
                fill="transparent"
                stroke={arc.color}
                strokeWidth="14"
                strokeDasharray={`${arc.length} ${arc.gap}`}
                strokeDashoffset={arc.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{total}</span>
            <span className="text-[8px] text-app-text-muted mt-0.5 leading-tight">Total Goals</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 pl-4">
          {data.map((item) => (
            <div key={item.name} className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-app-text-muted">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <span className="text-app-text">{item.value}</span>
                <span className="text-app-text-muted">({Math.round((item.value / safeTotal) * 100)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={onViewFullAnalysis} className="h-10 border-t border-app-border/50 flex items-center justify-center gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>View Full Analysis</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </TemplateCard>
  );
}

function buildArcs(data: TemplateGoalSegment[], total: number) {
  const circumference = 2 * Math.PI * 36;
  let offset = 0;
  return data.map((item) => {
    const length = (item.value / total) * circumference;
    const arc = {
      name: item.name,
      color: item.color,
      length,
      gap: circumference - length,
      offset: -offset,
    };
    offset += length;
    return arc;
  });
}
