import { useState } from "react";
import type { PlayerSeasonStats } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";
import type { PlayerAdvancedStatsSummary } from "./PlayerProfile.helpers";

interface PlayerProfileStatsCardProps {
  stats: PlayerSeasonStats;
  advancedStats: PlayerAdvancedStatsSummary;
  t: (key: string) => string;
}

type StatsTab = "season" | "advanced";

function resolveLabel(t: (key: string) => string, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function formatRate(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

function formatPercentage(value: number | null): string {
  if (value === null) return "-";
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export default function PlayerProfileStatsCard({
  stats,
  advancedStats,
  t,
}: PlayerProfileStatsCardProps) {
  const [activeTab, setActiveTab] = useState<StatsTab>("season");
  const tabs: { id: StatsTab; label: string }[] = [
    { id: "season", label: t("playerProfile.seasonStats") },
    { id: "advanced", label: t("playerProfile.advancedStats") },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <span>{t("playerProfile.statistics")}</span>
          <div className="flex rounded-lg border border-app-border bg-app-bg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab.id
                    ? "bg-app-green text-black"
                    : "text-app-text-muted hover:text-app-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {activeTab === "season" ? (
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
            <StatBox label={t("playerProfile.apps")} value={stats.appearances} />
            <StatBox label={t("playerProfile.goals")} value={stats.goals} />
            <StatBox label={t("playerProfile.assists")} value={stats.assists} />
            <StatBox label={t("playerProfile.mins")} value={stats.minutes_played} />
            <StatBox label={t("playerProfile.cleanSheets")} value={stats.clean_sheets} />
            <StatBox label={t("playerProfile.yellows")} value={stats.yellow_cards} />
            <StatBox label={t("playerProfile.reds")} value={stats.red_cards} />
            <StatBox
              label={t("playerProfile.avgRating")}
              value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "-"}
            />
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.shots", "Shots")}
              value={String(advancedStats.metrics.shots.total)}
              meta={`${resolveLabel(t, "playerProfile.per90", "Per 90")} ${formatRate(advancedStats.metrics.shots.per90)}`}
            />
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.shotsOnTarget", "Shots On Target")}
              value={String(advancedStats.metrics.shotsOnTarget.total)}
              meta={`${resolveLabel(t, "playerProfile.per90", "Per 90")} ${formatRate(advancedStats.metrics.shotsOnTarget.per90)}`}
            />
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.passes", "Passes")}
              value={`${advancedStats.metrics.passes.completed} / ${advancedStats.metrics.passes.attempted}`}
              meta={`${resolveLabel(t, "playerProfile.passAccuracy", "Pass Accuracy")} ${formatPercentage(advancedStats.metrics.passes.accuracy)}`}
            />
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.tacklesWon", "Tackles Won")}
              value={String(advancedStats.metrics.tacklesWon.total)}
              meta={`${resolveLabel(t, "playerProfile.per90", "Per 90")} ${formatRate(advancedStats.metrics.tacklesWon.per90)}`}
            />
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.interceptions", "Interceptions")}
              value={String(advancedStats.metrics.interceptions.total)}
              meta={`${resolveLabel(t, "playerProfile.per90", "Per 90")} ${formatRate(advancedStats.metrics.interceptions.per90)}`}
            />
            <AdvancedStatBox
              label={resolveLabel(t, "playerProfile.foulsCommitted", "Fouls Committed")}
              value={String(advancedStats.metrics.foulsCommitted.total)}
              meta={`${resolveLabel(t, "playerProfile.per90", "Per 90")} ${formatRate(advancedStats.metrics.foulsCommitted.per90)}`}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-app-bg p-2 text-center">
      <p className="truncate font-heading text-base font-bold tabular-nums text-app-text">
        {value}
      </p>
      <p className="truncate font-heading text-[10px] uppercase tracking-wider text-app-text-muted">
        {label}
      </p>
    </div>
  );
}

function AdvancedStatBox({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-app-bg px-3 py-2">
      <p className="truncate font-heading text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
        {label}
      </p>
      <p className="truncate font-heading text-base font-bold tabular-nums text-app-text">
        {value}
      </p>
      <p className="truncate text-[10px] uppercase tracking-wider text-app-text-muted">
        {meta}
      </p>
    </div>
  );
}
