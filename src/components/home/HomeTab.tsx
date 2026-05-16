import type { GameStateData } from "../../store/gameStore";
import { Card, CardHeader, CardBody } from "../ui";
import { formatDateShort } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import { resolveSeasonContext } from "../../lib/seasonContext";
import NextMatchDisplay from "../NextMatchDisplay";
import {
  resolveNewsArticle,
} from "../../utils/backendI18n";
import {
  getHomeRosterOverview,
  getLeagueDigestArticles,
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
import HomeRecentResultsCard from "./HomeRecentResultsCard";
import HomeSquadOverviewCard from "./HomeSquadOverviewCard";
import { FormChartCard } from "./FormChartCard";
import { GoalsAnalysisCard } from "./GoalsAnalysisCard";
import {
  SquadOverviewTable,
  type SquadOverviewTab,
} from "./SquadOverviewTable";
import { TacticsFormationCard } from "./TacticsFormationCard";
import {
  Flame,
  Scale,
  Feather,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const {
    avgCondition,
    avgOvr,
    exhaustedCount,
  } = getHomeRosterOverview(roster);
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
  const leagueDigestArticles =
    getLeagueDigestArticles(gameState).map(resolveNewsArticle);

  // FM25 cards data adapters
  const formBreakdown = buildFormBreakdown(myTeam?.form ?? []);
  const goalSegments = buildGoalSegments(gameState, myTeam?.id ?? null);
  const squadOverviewRows = buildSquadOverviewRows(roster);
  const tacticsSlots = buildTacticsSlots(myTeam ?? null, roster);
  const [squadTab, setSquadTab] = useState<SquadOverviewTab>("overview");

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div data-testid="home-template-layout" className="flex flex-col xl:flex-row gap-4 min-h-full">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {myTeam ? (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card accent="primary" className="col-span-1 min-h-[360px] flex flex-col h-full">
                <CardHeader>{t("home.nextMatch")}</CardHeader>
                <CardBody className="p-0 flex flex-1">
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
                  footer={
                    <button
                      type="button"
                      onClick={() => onNavigate?.("Squad")}
                      className="h-10 border-t border-app-border/50 flex items-center justify-end pr-4 gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors w-full"
                    >
                      <span>View Full Squad</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  }
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
    </div>
  );
}
