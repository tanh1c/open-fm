import { Card, CardBody, CardHeader } from "../ui";

import type { TeamProfileTranslate, TeamStatsOverview } from "./TeamProfile.types";

interface TeamProfileAdvancedStatsCardProps {
  overview: TeamStatsOverview;
  t: TeamProfileTranslate;
}

function resolveLabel(
  t: TeamProfileTranslate,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toFixed(1);
}

function formatPercentage(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-app-bg px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate">
        {label}
      </p>
      <p className="font-heading font-bold text-base text-app-text tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

function MetricRow({
  label,
  primaryValue,
  secondaryLabel,
  secondaryValue,
}: {
  label: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 items-center rounded-lg bg-app-bg px-3 py-2.5">
      <div className="min-w-0">
        <p className="font-heading font-bold text-[11px] uppercase tracking-wider text-app-text-muted truncate">
          {label}
        </p>
        <p className="font-heading font-bold text-base text-app-text tabular-nums truncate">
          {primaryValue}
        </p>
      </div>

      <div className="min-w-0 text-right">
        <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate">
          {secondaryLabel}
        </p>
        <p className="font-heading font-bold text-sm text-app-text tabular-nums truncate">
          {secondaryValue}
        </p>
      </div>
    </div>
  );
}

export default function TeamProfileAdvancedStatsCard({
  overview,
  t,
}: TeamProfileAdvancedStatsCardProps) {
  const labels = {
    title: t("teamProfile.advancedStats"),
    matchesPlayed: resolveLabel(t, "teamProfile.matchesPlayed", "Matches"),
    goalsFor: resolveLabel(t, "common.gf", "GF"),
    possession: resolveLabel(t, "teamProfile.possession", "Possession"),
    goalDifference: resolveLabel(
      t,
      "teamProfile.goalDifference",
      "Goal Difference",
    ),
    shots: resolveLabel(t, "teamProfile.shots", "Shots"),
    shotsOnTarget: resolveLabel(
      t,
      "teamProfile.shotsOnTarget",
      "Shots On Target",
    ),
    passes: resolveLabel(t, "teamProfile.passes", "Passes"),
    tacklesWon: resolveLabel(t, "teamProfile.tacklesWon", "Tackles Won"),
    interceptions: resolveLabel(
      t,
      "teamProfile.interceptions",
      "Interceptions",
    ),
    foulsCommitted: resolveLabel(
      t,
      "teamProfile.foulsCommitted",
      "Fouls Committed",
    ),
    perMatch: resolveLabel(t, "teamProfile.perMatch", "Per Match"),
    passAccuracy: resolveLabel(
      t,
      "teamProfile.passAccuracy",
      "Pass Accuracy",
    ),
  };

  return (
    <Card>
      <CardHeader>{labels.title}</CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <SummaryStat label={labels.matchesPlayed} value={String(overview.matchesPlayed)} />
          <SummaryStat label={labels.goalsFor} value={String(overview.goalsFor)} />
          <SummaryStat
            label={labels.possession}
            value={formatPercentage(overview.possessionAverage)}
          />
          <SummaryStat
            label={labels.goalDifference}
            value={String(overview.goalDifference)}
          />
        </div>

        <div className="space-y-3">
          <MetricRow
            label={labels.shots}
            primaryValue={String(overview.metrics.shots.total)}
            secondaryLabel={labels.perMatch}
            secondaryValue={formatRate(overview.metrics.shots.perMatch)}
          />
          <MetricRow
            label={labels.shotsOnTarget}
            primaryValue={String(overview.metrics.shotsOnTarget.total)}
            secondaryLabel={labels.perMatch}
            secondaryValue={formatRate(overview.metrics.shotsOnTarget.perMatch)}
          />
          <MetricRow
            label={labels.passes}
            primaryValue={`${overview.metrics.passes.completed} / ${overview.metrics.passes.attempted}`}
            secondaryLabel={labels.passAccuracy}
            secondaryValue={formatPercentage(overview.metrics.passes.accuracy)}
          />
          <MetricRow
            label={labels.tacklesWon}
            primaryValue={String(overview.metrics.tacklesWon.total)}
            secondaryLabel={labels.perMatch}
            secondaryValue={formatRate(overview.metrics.tacklesWon.perMatch)}
          />
          <MetricRow
            label={labels.interceptions}
            primaryValue={String(overview.metrics.interceptions.total)}
            secondaryLabel={labels.perMatch}
            secondaryValue={formatRate(overview.metrics.interceptions.perMatch)}
          />
          <MetricRow
            label={labels.foulsCommitted}
            primaryValue={String(overview.metrics.foulsCommitted.total)}
            secondaryLabel={labels.perMatch}
            secondaryValue={formatRate(overview.metrics.foulsCommitted.perMatch)}
          />
        </div>
      </CardBody>
    </Card>
  );
}
