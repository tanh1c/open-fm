import { TemplateCard, TemplateCardHeader } from "../Card";

interface TemplateTeamFormProps {
  results: Array<"W" | "D" | "L">;
  totals: { won: number; drawn: number; lost: number };
  pointsPerGame: number;
}

export function TemplateTeamForm({ results, totals, pointsPerGame }: TemplateTeamFormProps) {
  const points = buildPoints(results);
  const max = 20;
  const h = 60;
  const w = 180;
  const dx = w / Math.max(1, points.length - 1);
  const getPath = (pts: number[]) => pts.map((p, i) => {
    const x = i * dx;
    const y = h - (p / max) * h;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <TemplateCard className="flex flex-col h-full">
      <TemplateCardHeader title="TEAM FORM" />
      <div className="p-4 flex-1 flex flex-col justify-between min-h-0">
        <div className="flex justify-between h-full min-h-[100px] gap-4">
          <div className="flex flex-col justify-between text-[9px] text-app-text-muted py-1 flex-shrink-0">
            <span>W</span>
            <span>D</span>
            <span>L</span>
          </div>
          <div className="flex-1 relative mt-2.5">
            <div className="absolute inset-0 border-b border-app-border/50" />
            <div className="absolute inset-0 border-b border-app-border/50 translate-y-1/2" />
            <div className="absolute inset-x-0 bottom-0 border-b border-app-border/50" />
            <svg className="w-full h-[60px] overflow-visible absolute top-0 left-0" preserveAspectRatio="none">
              <path d={getPath(points)} fill="none" stroke="var(--color-primary-500)" strokeWidth="2" />
              {points.map((p, i) => {
                const x = `${(i / Math.max(1, points.length - 1)) * 100}%`;
                const y = h - (p / max) * h;
                return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--color-app-card)" stroke="var(--color-primary-500)" strokeWidth="2" />;
              })}
            </svg>
            <div className="absolute top-[70px] inset-x-0 flex justify-between px-2 text-[9px] text-app-text-muted">
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
            </div>
          </div>

          <div className="flex flex-col justify-between h-[60px] text-xs flex-shrink-0 mt-1">
            <div className="flex gap-3 justify-between"><span className="text-app-green">Won</span><span className="font-bold text-white">{totals.won}</span></div>
            <div className="flex gap-3 justify-between"><span className="text-gray-400">Drawn</span><span className="font-bold text-white">{totals.drawn}</span></div>
            <div className="flex gap-3 justify-between"><span className="text-app-red">Lost</span><span className="font-bold text-white">{totals.lost}</span></div>
          </div>
        </div>

        <div className="flex justify-between items-end mt-4 pt-4 border-t border-app-border/50">
          <span className="text-[10px] text-app-text-muted">Form (Last 20)</span>
          <span className="text-sm font-bold">{pointsPerGame.toFixed(2)} PPG</span>
        </div>
      </div>
    </TemplateCard>
  );
}

function buildPoints(results: Array<"W" | "D" | "L">): number[] {
  const recent = results.slice(-7);
  if (recent.length === 0) return [0, 0, 0, 0, 0, 0, 0];
  return recent.map((result, index) => {
    const base = result === "W" ? 16 : result === "D" ? 10 : 4;
    return Math.min(20, base + index);
  });
}
