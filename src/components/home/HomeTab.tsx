import type { GameStateData } from "../../store/gameStore";
import { Card, CardHeader, CardBody, Badge } from "../ui";
import { formatDateShort } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import { resolveSeasonContext } from "../../lib/seasonContext";
import NextMatchDisplay from "../NextMatchDisplay";
import {
  resolveBoardObjective,
  resolveMessage,
  resolveNewsArticle,
} from "../../utils/backendI18n";
import {
  getHomeRosterOverview,
  getLeagueDigestArticles,
  getNextOpponentWidgetData,
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
import HomeLeagueDigestCard from "./HomeLeagueDigestCard";
import HomeLeaguePositionCard from "./HomeLeaguePositionCard";
import HomeLatestNewsCard from "./HomeLatestNewsCard";
import HomeNextOpponentCard from "./HomeNextOpponentCard";
import HomePlayerMomentumCard from "./HomePlayerMomentumCard";
import HomeRecentResultsCard from "./HomeRecentResultsCard";
import HomeRecentMessagesCard from "./HomeRecentMessagesCard";
import HomeSquadOverviewCard from "./HomeSquadOverviewCard";
import HomeSeasonStatusCard from "./HomeSeasonStatusCard";
import HomeUnavailablePlayersCard from "./HomeUnavailablePlayersCard";
import { FormChartCard } from "./FormChartCard";
import { GoalsAnalysisCard } from "./GoalsAnalysisCard";
import {
  SquadOverviewTable,
  type SquadOverviewTab,
} from "./SquadOverviewTable";
import { TacticsFormationCard } from "./TacticsFormationCard";
import {
  Dumbbell,
  Mail,
  Flame,
  Scale,
  Feather,
  CheckCircle2,
  Circle,
  Users,
  Crosshair,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import HomeOnboardingChecklistCard from "./HomeOnboardingChecklistCard";
import JobOpportunitiesCard from "./JobOpportunitiesCard";

interface HomeTabProps {
  gameState: GameStateData;
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
  onGameUpdate?: (state: GameStateData) => void;
  visitedOnboardingTabs: ReadonlySet<string>;
}

const SCHEDULE_ICONS: Record<string, { icon: React.ReactNode; color: string }> =
{
  Intense: { icon: <Flame className="w-3.5 h-3.5" />, color: "text-red-500" },
  Balanced: {
    icon: <Scale className="w-3.5 h-3.5" />,
    color: "text-primary-500",
  },
  Light: {
    icon: <Feather className="w-3.5 h-3.5" />,
    color: "text-blue-500",
  },
};

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
  const {
    avgCondition,
    avgOvr,
    coldPlayers,
    exhaustedCount,
    hotPlayers,
    unavailablePlayers,
  } = getHomeRosterOverview(roster);
  const resolveInjuryName = (injuryName: string): string => {
    if (injuryName.includes(".")) {
      return t(injuryName, { defaultValue: injuryName });
    }

    return t(`common.injuries.${injuryName}`, { defaultValue: injuryName });
  };

  // Current date / season context
  const lang = i18n.language;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const seasonStartLabel = seasonContext.season_start
    ? formatDateShort(seasonContext.season_start, lang)
    : null;
  const transferWindow = seasonContext.transfer_window;
  const transferWindowVariant =
    transferWindow.status === "DeadlineDay"
      ? "danger"
      : transferWindow.status === "Open"
        ? "success"
        : "neutral";
  const transferWindowSummary =
    transferWindow.status === "DeadlineDay"
      ? t("season.windowClosesToday")
      : transferWindow.status === "Open" &&
        transferWindow.days_remaining !== null
        ? t("season.windowClosesInDays", {
          count: transferWindow.days_remaining,
        })
        : transferWindow.status === "Closed" &&
          transferWindow.days_until_opens !== null
          ? t("season.windowOpensInDays", {
            count: transferWindow.days_until_opens,
          })
          : t("season.windowClosed");

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

  const recentResults = getRecentResultsForTeam(gameState, myTeam?.id ?? null);

  // Training schedule
  const schedule = myTeam?.training_schedule || "Balanced";
  const schedIcons = SCHEDULE_ICONS[schedule] || SCHEDULE_ICONS.Balanced;
  const schedLabel = t(`common.trainingSchedules.${schedule}`, schedule);
  const focus = myTeam?.training_focus || "Physical";

  // Latest news
  const latestNews = (gameState.news || [])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(resolveNewsArticle);
  const recentMessages = (gameState.messages || [])
    .slice(0, 4)
    .map(resolveMessage);
  const nextOpponent = getNextOpponentWidgetData(gameState);
  const leagueDigestArticles =
    getLeagueDigestArticles(gameState).map(resolveNewsArticle);
  const boardObjectives = (gameState.board_objectives || []).map(
    resolveBoardObjective,
  );
  const onboardingState = getOnboardingCompletionState(
    gameState,
    visitedOnboardingTabs,
  );

  // FM25 cards data adapters
  const formBreakdown = buildFormBreakdown(myTeam?.form ?? []);
  const goalSegments = buildGoalSegments(gameState, myTeam?.id ?? null);
  const squadOverviewRows = buildSquadOverviewRows(roster);
  const tacticsSlots = buildTacticsSlots(myTeam ?? null, roster);
  const [squadTab, setSquadTab] = useState<SquadOverviewTab>("overview");

  const onboardingSteps = [
    {
      id: "squad",
      done: onboardingState.hasVisitedSquadPage,
      label: t("onboarding.reviewSquad"),
      description: t("onboarding.reviewSquadDesc"),
      tab: "Squad",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "staff",
      done: onboardingState.hasVisitedStaffPage,
      label: t("onboarding.hireStaff"),
      description: t("onboarding.hireStaffDesc"),
      tab: "Staff",
      icon: <UserCog className="w-4 h-4" />,
    },
    {
      id: "tactics",
      done: onboardingState.hasVisitedTacticsPage,
      label: t("onboarding.setTactics"),
      description: t("onboarding.setTacticsDesc"),
      tab: "Tactics",
      icon: <Crosshair className="w-4 h-4" />,
    },
    {
      id: "training",
      done: onboardingState.hasVisitedTrainingPage,
      label: t("onboarding.configTraining"),
      description: t("onboarding.configTrainingDesc"),
      tab: "Training",
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: "inbox",
      done: onboardingState.hasReadInbox,
      label: t("onboarding.readMessages"),
      description: t("onboarding.readMessagesDesc"),
      tab: "Inbox",
      icon: <Mail className="w-4 h-4" />,
    },
  ];
  const completedSteps = onboardingState.completedSteps;

  return (
    <div data-testid="home-template-layout" className="flex flex-col xl:flex-row gap-4 min-h-full">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {myTeam && isPreseason && (
          <HomeSeasonStatusCard
            phase={seasonContext.phase}
            seasonStartLabel={seasonStartLabel}
            daysUntilSeasonStart={seasonContext.days_until_season_start}
            transferWindowStatus={transferWindow.status}
            transferWindowVariant={transferWindowVariant}
            transferWindowSummary={transferWindowSummary}
            transferWindowOpensOn={transferWindow.opens_on}
            transferWindowClosesOn={transferWindow.closes_on}
            lang={lang}
          />
        )}

        {myTeam && onboardingState.showOnboarding &&
          completedSteps < onboardingSteps.length && (
            <HomeOnboardingChecklistCard
              completedSteps={completedSteps}
              totalSteps={onboardingSteps.length}
              steps={onboardingSteps}
              onNavigate={onNavigate}
            />
          )}

        {myTeam ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card accent="primary" className="col-span-1 min-h-[360px]">
                <CardHeader>{t("home.nextMatch")}</CardHeader>
                <CardBody>
                  <NextMatchDisplay gameState={gameState} />
                </CardBody>
              </Card>

              {tacticsSlots.length > 0 && (
                <TacticsFormationCard
                  className="col-span-1 lg:col-span-2 min-h-[360px]"
                  formation={myTeam.formation || "4-4-2"}
                  tacticalStyle={myTeam.play_style || "Balanced"}
                  players={tacticsSlots}
                  instructions={{
                    teamInstructions: ["Higher Tempo", "Pass Into Space"],
                    inPossession: "Patient Build",
                    inTransition: "Counter-Press",
                    outOfPossession: "Mid Block",
                  }}
                />
              )}
            </div>

            {squadOverviewRows.length > 0 && (
              <div className="min-h-[280px]">
                <SquadOverviewTable
                  players={squadOverviewRows}
                  activeTab={squadTab}
                  onTabChange={setSquadTab}
                  onPlayerClick={() => onNavigate?.("Squad")}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormChartCard
                results={formBreakdown.results}
                totals={formBreakdown.totals}
                pointsPerGame={formBreakdown.pointsPerGame}
              />
              <GoalsAnalysisCard segments={goalSegments} />
              <HomeLatestNewsCard
                articles={latestNews}
                teams={gameState.teams}
                lang={lang}
                onNavigate={onNavigate}
              />
            </div>

            <HomeNextOpponentCard
              nextOpponent={nextOpponent}
              lang={lang}
              onNavigate={onNavigate}
            />

            {boardObjectives.length > 0 && (
              <Card>
                <CardHeader>{t("home.boardObjectives")}</CardHeader>
                <CardBody>
                  <div className="flex flex-col gap-2.5">
                    {boardObjectives.map((obj) => (
                      <div key={obj.id} className="flex items-center gap-3">
                        {obj.met ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 dark:text-surface-600 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${obj.met ? "text-green-600 dark:text-green-400 line-through" : "text-gray-700 dark:text-gray-300"}`}
                        >
                          {obj.description}
                        </span>
                        <Badge
                          variant={obj.met ? "success" : "neutral"}
                          size="sm"
                          className="ml-auto"
                        >
                          {obj.met ? t("home.met") : t("home.inProgress")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-surface-700">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {t("home.objectivesMet", {
                        done: boardObjectives.filter((o) => o.met).length,
                        total: boardObjectives.length,
                        pct: gameState.manager.satisfaction,
                      })}
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}

            <HomeUnavailablePlayersCard
              players={unavailablePlayers}
              resolveInjuryName={resolveInjuryName}
              onNavigate={onNavigate}
            />

            {roster.length > 0 && (hotPlayers.length > 0 || coldPlayers.length > 0) && (
              <HomePlayerMomentumCard
                hotPlayers={hotPlayers}
                coldPlayers={coldPlayers}
                onNavigate={onNavigate}
              />
            )}
          </>
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

        <HomeRecentMessagesCard
          messages={recentMessages}
          lang={lang}
          onNavigate={onNavigate}
        />
      </div>

      {myTeam && (
        <aside data-testid="home-right-sidebar" className="w-full xl:w-[320px] shrink-0 flex flex-col gap-4">
          <HomeLeaguePositionCard
            isPreseason={isPreseason}
            phase={seasonContext.phase}
            seasonStartLabel={seasonStartLabel}
            myStanding={myStanding}
            myStandingData={myStandingData}
            teamForm={myTeam?.form ?? []}
            onNavigate={onNavigate}
          />

          <HomeSquadOverviewCard
            avgCondition={avgCondition}
            avgOvr={avgOvr}
            exhaustedCount={exhaustedCount}
            scheduleIcon={schedIcons.icon}
            scheduleColorClass={schedIcons.color}
            scheduleLabel={schedLabel}
            focus={focus}
            onNavigate={onNavigate}
          />

          <HomeRecentResultsCard
            recentResults={recentResults}
            teams={gameState.teams}
            onNavigate={onNavigate}
          />

          <HomeLeagueDigestCard
            articles={leagueDigestArticles}
            lang={lang}
            onNavigate={onNavigate}
          />
        </aside>
      )}
    </div>
  );
}
