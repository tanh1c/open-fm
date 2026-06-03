import type { GameStateData } from "../../store/gameStore";
import { formatDateShort } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import { resolveSeasonContext } from "../../lib/seasonContext";
import {
  getHomeRosterOverview,
  getOnboardingCompletionState,
  getRecentResultsForTeam,
} from "./HomeTab.helpers";
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
  buildTemplateBriefingItems,
  buildTemplateClubBriefingSections,
  buildTemplateGoalSegments,
  buildTemplateLeagueRows,
  buildTemplateSquadStatus,
  buildTemplateTrainingRows,
  buildTemplateTransferActivity,
  buildTemplateUpcomingFixtures,
  buildTemplateUpcomingMatch,
} from "../templateDashboard/templateDashboardAdapters";
import { useTranslation } from "react-i18next";
import { resolveBoardObjective, resolveMessage, resolveNewsArticle } from "../../utils/backendI18n";
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
  visitedOnboardingTabs,
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

  const transferWindow = seasonContext.transfer_window;
  const transferWindowSummary =
    transferWindow.status === "DeadlineDay"
      ? t("season.windowClosesToday")
      : transferWindow.status === "Open" && transferWindow.days_remaining !== null
        ? t("season.windowClosesInDays", { count: transferWindow.days_remaining })
        : transferWindow.status === "Closed" && transferWindow.days_until_opens !== null
          ? t("season.windowOpensInDays", { count: transferWindow.days_until_opens })
          : t("season.windowClosed");

  // Training schedule
  const schedule = myTeam?.training_schedule || "Balanced";
  const schedLabel = t(`common.trainingSchedules.${schedule}`, schedule);

  const rosterOverview = getHomeRosterOverview(roster);
  const recentResults = getRecentResultsForTeam(gameState, myTeam?.id ?? null);
  const latestNews = [...(gameState.news || [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(resolveNewsArticle);
  const latestMessages = [...(gameState.messages || [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
    .map(resolveMessage);
  const boardObjectives = (gameState.board_objectives || []).map(resolveBoardObjective);
  const onboardingState = getOnboardingCompletionState(gameState, visitedOnboardingTabs);
  const onboardingSteps = [
    { done: onboardingState.hasVisitedSquadPage, label: t("onboarding.reviewSquad"), tab: "Squad" },
    { done: onboardingState.hasVisitedStaffPage, label: t("onboarding.hireStaff"), tab: "Staff" },
    { done: onboardingState.hasVisitedTacticsPage, label: t("onboarding.setTactics"), tab: "Tactics" },
    { done: onboardingState.hasVisitedTrainingPage, label: t("onboarding.configTraining"), tab: "Training" },
    { done: onboardingState.hasReadInbox, label: t("onboarding.readMessages"), tab: "Inbox" },
  ];

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
              briefingItems={buildTemplateBriefingItems({
                boardObjectives,
                latestMessages,
                latestNews,
                onboardingState,
                onboardingSteps,
                rosterOverview,
                season: {
                  phase: t(`season.phases.${seasonContext.phase}`, seasonContext.phase),
                  seasonStartLabel,
                  transferWindowSummary,
                  transferWindowStatus: transferWindow.status,
                },
                onNavigate,
              })}
              clubBriefingSections={buildTemplateClubBriefingSections({
                recentResults,
                teams: gameState.teams,
                onNavigate: (tab) => onNavigate?.(tab),
              })}
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
              onNavigate={(tab, context) => onNavigate?.(tab, context)}
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
