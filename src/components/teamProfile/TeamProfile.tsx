import { ArrowLeft, Crosshair, DollarSign, Shield, Trophy, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatVal, formatWeeklyAmount } from "../../lib/helpers";
import MatchDetailModal from "../match/MatchDetailModal";
import { Card } from "../ui";
import { InfoRow, StatBox } from "./TeamProfile.primitives";
import type {
  LeagueStanding,
  TeamProfileProps,
  TeamProfileTranslate,
  TeamProfileViewModel,
  TeamStatsOverview,
} from "./TeamProfile.types";
import TeamProfileHeroCard from "./TeamProfileHeroCard";
import TeamProfileRecentMatchesCard from "./TeamProfileRecentMatchesCard";
import TeamProfileRosterCard from "./TeamProfileRosterCard";
import { useTeamProfileStats } from "./useTeamProfileStats";
import { buildTeamProfileViewModel } from "./TeamProfile.viewModel";

type TeamProfileTab = "overview" | "squad" | "matches";

const TABS: Array<{ id: TeamProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "squad", label: "Squad" },
  { id: "matches", label: "Recent Matches" },
];

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

function OverviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border-b border-app-border/60 pb-5 last:border-0 last:pb-0">
      <h2 className="mb-3 font-heading text-xs font-bold uppercase tracking-[0.18em] text-app-text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TeamStatsOverviewPanel({
  overview,
  t,
}: {
  overview: TeamStatsOverview | null;
  t: TeamProfileTranslate;
}) {
  if (!overview) {
    return (
      <p className="rounded-xl bg-app-bg px-4 py-6 text-center text-sm text-app-text-muted">
        {resolveLabel(t, "teamProfile.noStats", "No team stats yet")}
      </p>
    );
  }

  const labels = {
    matchesPlayed: resolveLabel(t, "teamProfile.matchesPlayed", "Matches"),
    goalsFor: resolveLabel(t, "common.gf", "GF"),
    goalsAgainst: resolveLabel(t, "common.ga", "GA"),
    possession: resolveLabel(t, "teamProfile.possession", "Possession"),
    goalDifference: resolveLabel(t, "teamProfile.goalDifference", "Goal Difference"),
    shots: resolveLabel(t, "teamProfile.shots", "Shots"),
    shotsOnTarget: resolveLabel(t, "teamProfile.shotsOnTarget", "Shots On Target"),
    passes: resolveLabel(t, "teamProfile.passes", "Passes"),
    tacklesWon: resolveLabel(t, "teamProfile.tacklesWon", "Tackles Won"),
    interceptions: resolveLabel(t, "teamProfile.interceptions", "Interceptions"),
    foulsCommitted: resolveLabel(t, "teamProfile.foulsCommitted", "Fouls Committed"),
    perMatch: resolveLabel(t, "teamProfile.perMatch", "Per Match"),
    passAccuracy: resolveLabel(t, "teamProfile.passAccuracy", "Pass Accuracy"),
  };

  const rows = [
    {
      label: labels.shots,
      total: String(overview.metrics.shots.total),
      detail: `${labels.perMatch}: ${formatRate(overview.metrics.shots.perMatch)}`,
    },
    {
      label: labels.shotsOnTarget,
      total: String(overview.metrics.shotsOnTarget.total),
      detail: `${labels.perMatch}: ${formatRate(overview.metrics.shotsOnTarget.perMatch)}`,
    },
    {
      label: labels.passes,
      total: `${overview.metrics.passes.completed} / ${overview.metrics.passes.attempted}`,
      detail: `${labels.passAccuracy}: ${formatPercentage(overview.metrics.passes.accuracy)}`,
    },
    {
      label: labels.tacklesWon,
      total: String(overview.metrics.tacklesWon.total),
      detail: `${labels.perMatch}: ${formatRate(overview.metrics.tacklesWon.perMatch)}`,
    },
    {
      label: labels.interceptions,
      total: String(overview.metrics.interceptions.total),
      detail: `${labels.perMatch}: ${formatRate(overview.metrics.interceptions.perMatch)}`,
    },
    {
      label: labels.foulsCommitted,
      total: String(overview.metrics.foulsCommitted.total),
      detail: `${labels.perMatch}: ${formatRate(overview.metrics.foulsCommitted.perMatch)}`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatBox label={labels.matchesPlayed} value={overview.matchesPlayed} />
        <StatBox label={labels.goalsFor} value={overview.goalsFor} />
        <StatBox label={labels.goalsAgainst} value={overview.goalsAgainst} />
        <StatBox label={labels.goalDifference} value={overview.goalDifference} />
        <div className="min-w-0 rounded-lg bg-app-bg p-2.5">
          <p className="truncate font-heading text-base font-bold tabular-nums text-app-text">
            {formatPercentage(overview.possessionAverage)}
          </p>
          <p className="truncate font-heading text-[10px] uppercase tracking-wider text-app-text-muted">
            {labels.possession}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-app-text-muted">
            <tr className="border-b border-app-border/60">
              <th className="py-2 pr-4 font-heading font-bold">Metric</th>
              <th className="py-2 pr-4 font-heading font-bold">Total</th>
              <th className="py-2 pr-4 font-heading font-bold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/40">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 pr-4 font-semibold text-app-text">{row.label}</td>
                <td className="py-2.5 pr-4 tabular-nums text-app-text">{row.total}</td>
                <td className="py-2.5 pr-4 text-app-text-muted">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeagueStandingPanel({
  standings,
  t,
}: {
  standings: LeagueStanding | null;
  t: TeamProfileTranslate;
}) {
  if (!standings) {
    return (
      <p className="rounded-xl bg-app-bg px-4 py-6 text-center text-sm text-app-text-muted">
        {resolveLabel(t, "teamProfile.noLeagueStanding", "No league standing yet")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2 text-center md:grid-cols-8">
      <StatBox label={t("common.played")} value={standings.played} />
      <StatBox label={t("common.won")} value={standings.won} />
      <StatBox label={t("common.drawn")} value={standings.drawn} />
      <StatBox label={t("common.lost")} value={standings.lost} />
      <StatBox label={t("common.gf")} value={standings.goals_for} />
      <StatBox label={t("common.ga")} value={standings.goals_against} />
      <StatBox label={t("common.gd")} value={standings.goals_for - standings.goals_against} />
      <StatBox label={t("common.pts")} value={standings.points} highlight />
    </div>
  );
}

function TeamProfileOverviewTab({
  team,
  isOwnTeam,
  viewModel,
  weeklySuffix,
  teamStatsOverview,
  t,
}: Pick<TeamProfileProps, "team" | "isOwnTeam"> & {
  viewModel: TeamProfileViewModel;
  weeklySuffix: string;
  teamStatsOverview: TeamStatsOverview | null;
  t: TeamProfileTranslate;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-5 p-4 md:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <OverviewSection title={t("teamProfile.squadOverview")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatBox label={t("teamProfile.squadSize")} value={viewModel.roster.length} />
                <StatBox label={t("teams.avgOvr")} value={viewModel.avgOvr} highlight />
                <div className="min-w-0 rounded-lg bg-app-bg p-2.5">
                  <p className="truncate font-heading text-base font-bold tabular-nums text-app-text">
                    {formatVal(viewModel.totalValue)}
                  </p>
                  <p className="truncate font-heading text-[10px] uppercase tracking-wider text-app-text-muted">
                    {t("finances.squadValue")}
                  </p>
                </div>
              </div>
            </OverviewSection>

            <OverviewSection title={t("teamProfile.clubInfo")}>
              <div className="grid gap-x-8 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <InfoRow icon={<Shield className="h-4 w-4" />} label={t("teamProfile.stadium")} value={team.stadium_name} />
                <InfoRow icon={<Users className="h-4 w-4" />} label={t("teamProfile.capacity")} value={team.stadium_capacity.toLocaleString()} />
                <InfoRow icon={<Crosshair className="h-4 w-4" />} label={t("tactics.formation")} value={team.formation} />
                <InfoRow icon={<Trophy className="h-4 w-4" />} label={t("tactics.playStyle")} value={team.play_style} />
                {isOwnTeam ? (
                  <>
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label={t("teamProfile.balance")} value={formatVal(team.finance)} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label={t("finances.wageBudget")} value={formatWeeklyAmount(formatVal(team.wage_budget), weeklySuffix)} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label={t("finances.transferBudget")} value={formatVal(team.transfer_budget)} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label={t("teamProfile.totalWages")} value={formatWeeklyAmount(formatVal(viewModel.totalWages), weeklySuffix)} />
                  </>
                ) : null}
              </div>
            </OverviewSection>
          </div>

          <div className="space-y-5">
            <OverviewSection title={t("teamProfile.leagueStanding")}>
              <LeagueStandingPanel standings={viewModel.standings} t={t} />
            </OverviewSection>

            <OverviewSection title={t("teamProfile.advancedStats")}>
              <TeamStatsOverviewPanel overview={teamStatsOverview} t={t} />
            </OverviewSection>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TeamProfile({
  team,
  gameState,
  isOwnTeam,
  onClose,
  onSelectPlayer,
}: TeamProfileProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TeamProfileTab>("overview");
  const [selectedMatchFixtureId, setSelectedMatchFixtureId] = useState<string | null>(null);
  const weeklySuffix = t("finances.perWeekSuffix", "/wk");
  const viewModel = buildTeamProfileViewModel(team, gameState);
  const { teamStatsOverview, recentMatches } = useTeamProfileStats(team.id);

  return (
    <div className="mx-auto flex min-h-max max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">{team.name.toUpperCase()}</h1>
          <p className="text-sm text-app-text-muted">
            {team.city} &bull; {t("teams.est")} {team.founded_year}
            {viewModel.leaguePos > 0 ? ` • #${viewModel.leaguePos}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex w-fit items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
      </div>

      <TeamProfileHeroCard
        team={team}
        viewModel={viewModel}
        locale={i18n.language}
        t={t}
      />

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-app-border bg-app-card p-1 shadow-sm">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-[0.18em] transition-colors ${isActive
                ? "bg-app-green text-white shadow-sm"
                : "text-app-text-muted hover:bg-white/5 hover:text-app-text"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <TeamProfileOverviewTab
          team={team}
          isOwnTeam={isOwnTeam}
          viewModel={viewModel}
          weeklySuffix={weeklySuffix}
          teamStatsOverview={teamStatsOverview}
          t={t}
        />
      ) : null}

      {activeTab === "squad" ? (
        <TeamProfileRosterCard
          roster={viewModel.roster}
          locale={i18n.language}
          t={t}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}

      {activeTab === "matches" ? (
        <TeamProfileRecentMatchesCard
          matches={recentMatches}
          t={t}
          onSelectMatch={setSelectedMatchFixtureId}
        />
      ) : null}

      <MatchDetailModal
        fixtureId={selectedMatchFixtureId}
        onClose={() => setSelectedMatchFixtureId(null)}
      />
    </div>
  );
}
