import { AlertTriangle, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardBody, CardHeader } from "../ui";

interface HomeSquadOverviewCardProps {
  avgCondition: number;
  avgOvr: number;
  exhaustedCount: number;
  scheduleIcon: React.ReactNode;
  scheduleColorClass: string;
  scheduleLabel: string;
  focus: string;
  onNavigate?: (tab: string) => void;
}

export default function HomeSquadOverviewCard({
  avgCondition,
  avgOvr,
  exhaustedCount,
  scheduleIcon,
  scheduleColorClass,
  scheduleLabel,
  focus,
  onNavigate,
}: HomeSquadOverviewCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        action={
          <button
            onClick={() => onNavigate?.("Training")}
            className="text-app-green text-xs font-heading font-bold uppercase tracking-wider hover:text-app-text transition-colors"
          >
            {t("dashboard.training")}
          </button>
        }
      >
        {t("home.squadOverview")}
      </CardHeader>
      <CardBody>
        <div
          data-testid="squad-overview-metrics"
          className="p-4 py-6 flex items-start justify-between gap-4 bg-app-bg/50 border border-app-border/50 rounded-xl"
        >
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            <StatusRow color="bg-app-green" label={t("home.avgCondition")} value={`${avgCondition}%`} />
            <StatusRow color="bg-blue-500" label={t("home.avgOvr")} value={String(avgOvr)} />
            <StatusRow color="bg-amber-500" label={t("home.scheduleLabel")} value={scheduleLabel} icon={scheduleIcon} valueClass={scheduleColorClass} />
            {exhaustedCount > 0 && (
              <StatusRow color="bg-app-red" label={t("home.exhaustedPlayers", { count: exhaustedCount })} value={String(exhaustedCount)} icon={<AlertTriangle className="w-3.5 h-3.5" />} valueClass="text-app-red" />
            )}
            <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
              <Dumbbell className="w-3.5 h-3.5" />
              <span>{t(`common.trainingFocuses.${focus}`, focus)}</span>
            </div>
          </div>
          <ConditionDonut value={avgCondition} />
        </div>
      </CardBody>
    </Card>
  );
}

function StatusRow({
  color,
  label,
  value,
  icon,
  valueClass = "text-app-text",
}: {
  color: string;
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between text-[11px] gap-2">
      <div className="flex items-start gap-2 min-w-0">
        <div className={`${color} w-2 h-2 rounded-full shrink-0 mt-1`} />
        <span className="text-app-text-muted leading-tight truncate">{label}</span>
      </div>
      <span className={`font-semibold shrink-0 flex items-center gap-1 ${valueClass}`}>
        {icon}
        {value}
      </span>
    </div>
  );
}

function ConditionDonut({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);

  return (
    <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex items-center justify-center shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="transparent" stroke="var(--color-app-border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="transparent"
          stroke="var(--color-app-green)"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="text-[9px] sm:text-[10px] text-app-text-muted leading-tight">Condition</span>
        <span className="text-[10px] sm:text-xs font-bold text-app-green leading-tight">{clamped}%</span>
      </div>
    </div>
  );
}