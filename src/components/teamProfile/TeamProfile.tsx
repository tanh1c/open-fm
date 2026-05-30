import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TeamProfileProps } from "./TeamProfile.types";
import TeamProfileAdvancedStatsCard from "./TeamProfileAdvancedStatsCard";
import TeamProfileClubDetailsCard from "./TeamProfileClubDetailsCard";
import TeamProfileHeroCard from "./TeamProfileHeroCard";
import TeamProfileHistoryCard from "./TeamProfileHistoryCard";
import TeamProfileLeagueStandingCard from "./TeamProfileLeagueStandingCard";
import TeamProfileRecentMatchesCard from "./TeamProfileRecentMatchesCard";
import TeamProfileRosterCard from "./TeamProfileRosterCard";
import TeamProfileSummaryCard from "./TeamProfileSummaryCard";
import { useTeamProfileStats } from "./useTeamProfileStats";
import { buildTeamProfileViewModel } from "./TeamProfile.viewModel";

export default function TeamProfile({
  team,
  gameState,
  isOwnTeam,
  onClose,
  onSelectPlayer,
}: TeamProfileProps) {
  const { t, i18n } = useTranslation();
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

      <div className="flex flex-col gap-4 xl:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
          <TeamProfileClubDetailsCard team={team} t={t} />
          <TeamProfileSummaryCard
            team={team}
            isOwnTeam={isOwnTeam}
            viewModel={viewModel}
            weeklySuffix={weeklySuffix}
            t={t}
          />
          <TeamProfileLeagueStandingCard standings={viewModel.standings} t={t} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <TeamProfileRosterCard
            roster={viewModel.roster}
            isOwnTeam={isOwnTeam}
            locale={i18n.language}
            t={t}
            onSelectPlayer={onSelectPlayer}
          />
          <TeamProfileRecentMatchesCard matches={recentMatches} t={t} />
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">
          {teamStatsOverview && (
            <TeamProfileAdvancedStatsCard overview={teamStatsOverview} t={t} />
          )}
          <TeamProfileHistoryCard history={team.history} t={t} />
        </aside>
      </div>
    </div>
  );
}