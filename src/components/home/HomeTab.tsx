import type { GameStateData } from "../../store/gameStore";
import { formatDateShort } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import { resolveSeasonContext } from "../../lib/seasonContext";
import {
  buildFormBreakdown,
  buildGoalSegments,
  buildSquadOverviewRows,
  buildTacticsSlots,
} from "./HomeTab.cards";
import { useState } from "react";
import HomeLeaguePositionCard from "./HomeLeaguePositionCard";
import { TemplateDashboard } from "../templateDashboard/TemplateDashboard";
import {
  buildTemplateGoalSegments,
  buildTemplateLeagueRows,
  buildTemplateSquadStatus,
  buildTemplateTrainingRows,
  buildTemplateTransferActivity,
  buildTemplateUpcomingFixtures,
  buildTemplateUpcomingMatch,
} from "../templateDashboard/templateDashboardAdapters";
import { useTranslation } from "react-i18next";
import JobOpportunitiesCard from "./JobOpportunitiesCard";

interface HomeTabProps {
  gameState: GameStateData;
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
  onGameUpdate?: (state: GameStateData) => void;
  visitedOnboardingTabs: ReadonlySet<string>;
}

export default function HomeTab({
  gameState,
  onNavigate,
  onGameUpdate,
  visitedOnboardingTabs: _visitedOnboardingTabs,
}: HomeTabProps) {
  const { t, i18n } = useTranslation();
  const myTeam = gameState.teams.find(
    (tm) => tm.id === gameState.manager.team_id,
  );
  const league = gameState.league;
  const roster = myTeam
    ? gameState.players.filter(
      (p) => p.team_id === myTeam.id && isSeniorSquadPlayer(p),
    )
    : [];
  // Current date / season context
  const lang = i18n.language;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const seasonStartLabel = seasonContext.season_start
    ? formatDateShort(seasonContext.season_start, lang)
    : null;
  // League position
  const myStanding =
    !isPreseason && league && myTeam
      ? league.standings
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goals_for - b.goals_against - (a.goals_for - a.goals_against),
        )
        .findIndex((s) => s.team_id === myTeam.id) + 1
      : null;
  const myStandingData =
    !isPreseason && league && myTeam
      ? (league.standings.find((s) => s.team_id === myTeam.id) ?? null)
      : null;

  // Training schedule
  const schedule = myTeam?.training_schedule || "Balanced";
  const schedLabel = t(`common.trainingSchedules.${schedule}`, schedule);

  // FM25 cards data adapters
  const formBreakdown = buildFormBreakdown(myTeam?.form ?? []);
  const goalSegments = buildGoalSegments(gameState, myTeam?.id ?? null);
  const squadOverviewRows = buildSquadOverviewRows(roster).map((row, index) => ({
    ...row,
    number: row.number ?? index + 1,
  }));
  const tacticsSlots = buildTacticsSlots(myTeam ?? null, roster);
  const [squadTab, setSquadTab] = useState("Overview");

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div data-testid="home-template-layout" className="flex flex-col xl:flex-row gap-4 min-h-full">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {myTeam ? (
            <TemplateDashboard
              upcomingMatch={buildTemplateUpcomingMatch(gameState, lang)}
              tactics={{
                formation: myTeam.formation || "4-4-2",
                tacticalStyle: myTeam.play_style || "Balanced",
                players: tacticsSlots,
                instructions: {
                  teamInstructions: [myTeam.play_style || "Balanced", schedLabel],
                  inPossession: myTeam.training_focus || "General",
                  inTransition: myTeam.training_intensity || "Balanced",
                  outOfPossession: myTeam.formation || "4-4-2",
                },
              }}
              squad={{
                players: squadOverviewRows,
                activeTab: squadTab,
                onTabChange: setSquadTab,
              }}
              form={formBreakdown}
              goals={buildTemplateGoalSegments(goalSegments)}
              transferActivity={buildTemplateTransferActivity(gameState, myTeam.id)}
              rightSidebar={{
                leagueRows: buildTemplateLeagueRows(gameState),
                squadStatus: buildTemplateSquadStatus(roster),
                fixtures: buildTemplateUpcomingFixtures(gameState, myTeam.id, lang),
                trainingRows: buildTemplateTrainingRows(myTeam),
                trainingScheduleLabel: schedLabel,
              }}
              onNavigate={(tab) => onNavigate?.(tab)}
            />
        ) : (
          <>
            <HomeLeaguePositionCard
              isPreseason={isPreseason}
              phase={seasonContext.phase}
              seasonStartLabel={seasonStartLabel}
              myStanding={myStanding}
              myStandingData={myStandingData}
              teamForm={[]}
              onNavigate={onNavigate}
            />
            {onGameUpdate && (
              <JobOpportunitiesCard
                gameState={gameState}
                onGameUpdate={onGameUpdate}
              />
            )}
          </>
        )}

        </div>
      </div>
    </div>
  );
}
