import { ChevronRight, Goal } from "lucide-react";

import { Card, CardBody, CardHeader } from "../ui";

interface HomeTrainingOverviewCardProps {
  focus: string;
  intensity: string;
  scheduleLabel: string;
  onNavigate?: (tab: string) => void;
}

const TRAINING_ROWS = [
  { label: "Attacking", color: "bg-red-500", base: 80 },
  { label: "Defending", color: "bg-emerald-500", base: 65 },
  { label: "Fitness", color: "bg-violet-500", base: 95 },
  { label: "Tactics", color: "bg-blue-500", base: 75 },
  { label: "Goalkeeping", color: "bg-amber-500", base: 60 },
];

export default function HomeTrainingOverviewCard({
  focus,
  intensity,
  scheduleLabel,
  onNavigate,
}: HomeTrainingOverviewCardProps) {
  const boost = getIntensityBoost(intensity);

  return (
    <Card className="flex flex-col">
      <CardHeader
        action={
          <div className="text-[10px] text-app-text-muted flex items-center gap-1 cursor-pointer">
            <span>{scheduleLabel}</span>
            <ChevronRight className="w-3 h-3 rotate-90" />
          </div>
        }
      >
        TRAINING OVERVIEW
      </CardHeader>
      <CardBody className="p-4 pt-2 flex flex-col gap-3">
        {TRAINING_ROWS.map((row) => {
          const focused = focus.toLowerCase().includes(row.label.toLowerCase());
          const value = Math.min(100, Math.max(25, row.base + boost + (focused ? 10 : 0)));
          return (
            <TrainingRow
              key={row.label}
              label={row.label}
              value={value}
              color={row.color}
              stars={Math.max(1, Math.round(value / 20))}
            />
          );
        })}
      </CardBody>
      <button
        type="button"
        onClick={() => onNavigate?.("Training")}
        className="h-8 border-t border-app-border/50 flex items-center justify-center gap-2 text-[10px] font-semibold text-app-green hover:bg-app-green/5 transition-colors mt-auto"
      >
        <span>Training Calendar</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </Card>
  );
}

function TrainingRow({ label, value, color, stars }: { label: string; value: number; color: string; stars: number }) {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-2 w-20">
        <Goal className="w-3.5 h-3.5 text-app-text-muted" />
        <span className="text-app-text-muted">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden">
        <div
          className={`${color} h-full rounded-full shadow-[0_0_6px_rgba(0,0,0,0.5)]`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            viewBox="0 0 24 24"
            fill={star <= stars ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            className={`w-2.5 h-2.5 ${star <= stars ? "text-app-text" : "text-app-border"}`}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>
    </div>
  );
}

function getIntensityBoost(intensity: string): number {
  const normalized = intensity.toLowerCase();
  if (normalized.includes("high") || normalized.includes("intense")) return 8;
  if (normalized.includes("light") || normalized.includes("low")) return -12;
  return 0;
}
