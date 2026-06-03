import { findNextFixture, formatDateShort, formatMatchDate, getTeamName } from "../../lib/helpers";
import type { BoardObjective, FixtureData, GameStateData, MessageData, NewsArticle, PlayerData, TeamData } from "../../store/gameStore";
import type { HomeRecentResult, HomeRosterOverview, OnboardingCompletionState } from "../home/HomeTab.helpers";
import type { GoalSegment } from "../home/HomeTab.cards";
import type { TemplateDashboardProps } from "./TemplateDashboard";
import type { TemplateTransferActivityItem } from "./widgets/TemplateTransferActivity";

const TRAINING_BASE_ROWS = [
  { label: "Attacking", color: "bg-red-500", base: 80 },
  { label: "Defending", color: "bg-emerald-500", base: 65 },
  { label: "Fitness", color: "bg-violet-500", base: 95 },
  { label: "Tactics", color: "bg-blue-500", base: 75 },
  { label: "Goalkeeping", color: "bg-amber-500", base: 60 },
];

const GOAL_LABELS: Record<GoalSegment["kind"], { name: string; color: string }> = {
  open_play: { name: "Open Play", color: "#3b82f6" },
  set_piece: { name: "Set Pieces", color: "#8b5cf6" },
  counter: { name: "Counter Attacks", color: "#f59e0b" },
  penalty: { name: "Penalties", color: "#ec4899" },
};

interface BuildTemplateBriefingParams {
  boardObjectives: BoardObjective[];
  latestMessages: MessageData[];
  latestNews: NewsArticle[];
  onboardingState: OnboardingCompletionState;
  onboardingSteps: Array<{ done: boolean; label: string; tab: string }>;
  rosterOverview: HomeRosterOverview;
  season: {
    phase: string;
    seasonStartLabel: string | null;
    transferWindowSummary: string;
    transferWindowStatus: string;
  };
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
}

interface BuildTemplateClubBriefingParams {
  recentResults: HomeRecentResult[];
  teams: TeamData[];
  onNavigate?: (tab: string) => void;
}

export function buildTemplateBriefingItems({
  boardObjectives,
  latestMessages,
  latestNews,
  onboardingState,
  onboardingSteps,
  rosterOverview,
  season,
  onNavigate,
}: BuildTemplateBriefingParams): TemplateDashboardProps["briefingItems"] {
  const completedObjectives = boardObjectives.filter((objective) => objective.met).length;
  const unreadMessages = latestMessages.filter((message) => !message.read).length;
  const nextOnboardingStep = onboardingSteps.find((step) => !step.done);
  const inboxMessage = latestMessages[0];
  const newsArticle = latestNews[0];

  const items: TemplateDashboardProps["briefingItems"] = [
    {
      id: "season-window",
      title: "Season / Window",
      value: season.phase,
      detail: season.seasonStartLabel ? `Opener ${season.seasonStartLabel}` : season.transferWindowSummary,
      meta: season.transferWindowSummary,
      tone: season.transferWindowStatus === "DeadlineDay" ? "danger" : season.transferWindowStatus === "Open" ? "success" : "primary",
      icon: "season",
    },
    {
      id: "board-objectives",
      title: "Board Objective",
      value: `${completedObjectives}/${boardObjectives.length}`,
      detail: boardObjectives[0]?.description ?? "No active board objectives",
      meta: boardObjectives.length > 0 ? "Board confidence" : undefined,
      tone: completedObjectives === boardObjectives.length && boardObjectives.length > 0 ? "success" : "primary",
      icon: "objective",
      onClick: () => onNavigate?.("Manager"),
    },
    {
      id: "inbox-news",
      title: unreadMessages > 0 ? "Inbox" : "News",
      value: unreadMessages > 0 ? `${unreadMessages} unread` : newsArticle ? "Latest" : "Quiet",
      detail: inboxMessage?.subject ?? newsArticle?.headline ?? "No recent updates",
      meta: inboxMessage?.sender ?? newsArticle?.source,
      tone: unreadMessages > 0 ? "warning" : "neutral",
      icon: unreadMessages > 0 ? "inbox" : "news",
      onClick: () => inboxMessage ? onNavigate?.("Inbox", { messageId: inboxMessage.id }) : onNavigate?.("News"),
    },
    {
      id: "squad-alerts",
      title: "Squad Alerts",
      value: `${rosterOverview.unavailablePlayers.length} out`,
      detail: "Squad availability",
      meta: `Avg CON ${rosterOverview.avgCondition}`,
      tone: rosterOverview.unavailablePlayers.length > 0 || rosterOverview.exhaustedCount > 0 ? "danger" : "success",
      icon: "squad",
      stats: [
        { id: "unavailable", label: "Unavailable", value: rosterOverview.unavailablePlayers.length, icon: "user-x", tone: rosterOverview.unavailablePlayers.length > 0 ? "danger" : "success" },
        { id: "exhausted", label: "Exhausted", value: rosterOverview.exhaustedCount, icon: "battery", tone: rosterOverview.exhaustedCount > 0 ? "warning" : "success" },
        { id: "in-form", label: "In form", value: rosterOverview.hotPlayers.length, icon: "trend", tone: "success" },
        { id: "low-morale", label: "Low morale", value: rosterOverview.coldPlayers.length, icon: "morale", tone: rosterOverview.coldPlayers.length > 0 ? "danger" : "neutral" },
      ],
      onClick: () => onNavigate?.("Squad"),
    },
  ];

  if (onboardingState.showOnboarding && nextOnboardingStep) {
    items.splice(1, 0, {
      id: "onboarding",
      title: "Getting Started",
      value: `${onboardingState.completedSteps}/${onboardingSteps.length}`,
      detail: nextOnboardingStep.label,
      meta: "Next step",
      tone: "warning",
      icon: "onboarding",
      onClick: () => onNavigate?.(nextOnboardingStep.tab),
    });
  }

  return items.slice(0, 4);
}

export function buildTemplateClubBriefingSections({
  recentResults,
  teams,
  onNavigate,
}: BuildTemplateClubBriefingParams): TemplateDashboardProps["clubBriefingSections"] {
  const resultRows = recentResults.slice(-3).map((result) => ({
    id: result.fixture.id,
    title: `${getTeamName(teams, result.opponentId)} ${result.isHome ? "(H)" : "(A)"}`,
    detail: `${result.myGoals}-${result.opponentGoals} • ${result.fixture.competition}`,
    meta: result.resultCode,
    tone: result.resultCode === "W" ? "success" as const : result.resultCode === "L" ? "danger" as const : "warning" as const,
  }));

  return [
    {
      id: "recent-results",
      title: "Recent Results",
      emptyLabel: "No completed matches yet",
      rows: resultRows,
      actionLabel: "Schedule",
      onAction: () => onNavigate?.("Schedule"),
    },
  ];
}

export function buildTemplateUpcomingMatch(gameState: GameStateData, lang: string): TemplateDashboardProps["upcomingMatch"] {
  const teamId = gameState.manager.team_id;
  const league = gameState.league;
  const fixture = teamId && league ? findNextFixture(league.fixtures, teamId) : undefined;

  if (!fixture) {
    const teamName = teamId ? getTeamName(gameState.teams, teamId) : "OpenManager";
    return {
      competitionLabel: "League Match",
      fixtureLabel: "No upcoming fixture",
      dateLabel: "--",
      homeTeamName: teamName,
      awayTeamName: "TBD",
      homeTeam: gameState.teams.find((team) => team.id === teamId),
      homeSideLabel: "Home",
      awaySideLabel: "Away",
      homeForm: [],
      awayForm: [],
    };
  }

  const homeTeam = gameState.teams.find((team) => team.id === fixture.home_team_id);
  const awayTeam = gameState.teams.find((team) => team.id === fixture.away_team_id);

  return {
    competitionLabel: fixture.competition === "League" ? "League Match" : fixture.competition,
    fixtureLabel: `Matchday ${fixture.matchday}`,
    dateLabel: formatMatchDate(fixture.date, lang),
    homeTeamName: homeTeam?.short_name || homeTeam?.name || "Home",
    awayTeamName: awayTeam?.short_name || awayTeam?.name || "Away",
    homeTeam,
    awayTeam,
    homeSideLabel: fixture.home_team_id === teamId ? "Home" : "Away",
    awaySideLabel: fixture.away_team_id === teamId ? "Home" : "Away",
    homeForm: homeTeam?.form ?? [],
    awayForm: awayTeam?.form ?? [],
  };
}

export function buildTemplateLeagueRows(gameState: GameStateData): TemplateDashboardProps["rightSidebar"]["leagueRows"] {
  const activeTeamId = gameState.manager.team_id;
  const standings = gameState.league?.standings ?? [];
  const sorted = [...standings].sort((a, b) => {
    const gdA = a.goals_for - a.goals_against;
    const gdB = b.goals_for - b.goals_against;
    return b.points - a.points || gdB - gdA || b.goals_for - a.goals_for;
  });

  return sorted.slice(0, 6).map((standing, index) => {
    const team = gameState.teams.find((candidate) => candidate.id === standing.team_id);
    const goalDifference = standing.goals_for - standing.goals_against;
    return {
      pos: index + 1,
      name: team?.short_name || team?.name || standing.team_id,
      p: standing.played,
      gd: goalDifference > 0 ? `+${goalDifference}` : `${goalDifference}`,
      pts: standing.points,
      active: standing.team_id === activeTeamId,
      color: shieldColor(index),
      team,
    };
  });
}

export function buildTemplateSquadStatus(roster: PlayerData[]): TemplateDashboardProps["rightSidebar"]["squadStatus"] {
  const injured = roster.filter((player) => player.injury).length;
  const tired = roster.filter((player) => player.condition < 60 && !player.injury).length;
  const matchFit = roster.filter((player) => player.condition >= 60 && !player.injury).length;
  const avgMorale = roster.length === 0 ? 0 : roster.reduce((sum, player) => sum + player.morale, 0) / roster.length;

  return {
    injured,
    matchFit,
    tired,
    internationalDuty: 0,
    moraleLabel: avgMorale >= 80 ? "Very Good" : avgMorale >= 60 ? "Good" : avgMorale >= 40 ? "Okay" : "Poor",
  };
}

export function buildTemplateUpcomingFixtures(gameState: GameStateData, teamId: string, lang: string): TemplateDashboardProps["rightSidebar"]["fixtures"] {
  return (gameState.league?.fixtures ?? [])
    .filter((fixture) => fixture.status === "Scheduled" && (fixture.home_team_id === teamId || fixture.away_team_id === teamId))
    .slice(0, 5)
    .map((fixture, index) => {
      const isHome = fixture.home_team_id === teamId;
      const opponentId = isHome ? fixture.away_team_id : fixture.home_team_id;
      const opponentTeam = gameState.teams.find((team) => team.id === opponentId);
      return {
        id: fixture.id,
        date: formatDateShort(fixture.date, lang),
        opponent: opponentTeam?.short_name || opponentTeam?.name || opponentId,
        isHome,
        type: fixture.competition,
        color: shieldColor(index),
        team: opponentTeam,
      };
    });
}

export function buildTemplateTrainingRows(team: TeamData): TemplateDashboardProps["rightSidebar"]["trainingRows"] {
  const focus = team.training_focus || "Physical";
  const boost = getIntensityBoost(team.training_intensity || "Balanced");

  return TRAINING_BASE_ROWS.map((row) => {
    const focused = focus.toLowerCase().includes(row.label.toLowerCase());
    const value = Math.min(100, Math.max(25, row.base + boost + (focused ? 10 : 0)));
    return {
      label: row.label,
      value,
      color: row.color,
      stars: Math.max(1, Math.round(value / 20)),
    };
  });
}

export function buildTemplateGoalSegments(segments: GoalSegment[]): TemplateDashboardProps["goals"] {
  return segments.map((segment) => ({
    name: GOAL_LABELS[segment.kind].name,
    value: segment.count,
    color: GOAL_LABELS[segment.kind].color,
  }));
}

export function buildTemplateTransferActivity(gameState: GameStateData, teamId: string | null): TemplateTransferActivityItem[] {
  const players = teamId
    ? gameState.players.filter((player) => player.team_id === teamId)
    : gameState.players;
  const pendingOffers = players.flatMap((player) =>
    player.transfer_offers
      .filter((offer) => offer.status === "Pending")
      .map((offer) => ({
        id: offer.id,
        name: player.match_name,
        pos: `${positionLabel(player)} • Incoming bid`,
        from: getTeamName(gameState.teams, offer.from_team_id),
        fee: formatCurrencyShort(offer.fee),
        date: offer.date,
      })),
  );
  const listedPlayers = players
    .filter((player) => player.transfer_listed || player.loan_listed)
    .map((player) => ({
      id: `listed-${player.id}`,
      name: player.match_name,
      pos: player.transfer_listed ? `${positionLabel(player)} • Transfer listed` : `${positionLabel(player)} • Loan listed`,
      from: getTeamName(gameState.teams, player.team_id ?? ""),
      fee: formatCurrencyShort(player.market_value),
      date: player.contract_end ?? "",
    }));

  return [...pendingOffers, ...listedPlayers]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3);
}

export function buildSidebarNextMatch(gameState: GameStateData, lang: string) {
  const teamId = gameState.manager.team_id;
  const fixture = teamId && gameState.league ? findNextFixture(gameState.league.fixtures, teamId) : undefined;
  if (!fixture) return null;

  return {
    dateLabel: formatDateShort(fixture.date, lang),
    homeName: getTeamName(gameState.teams, fixture.home_team_id),
    awayName: getTeamName(gameState.teams, fixture.away_team_id),
    weatherLabel: "22°C",
  };
}

function injuryLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function positionLabel(player: PlayerData): string {
  return player.natural_position || player.position;
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function shieldColor(index: number): string {
  return ["text-blue-500", "text-emerald-500", "text-red-500", "text-amber-500", "text-yellow-500", "text-blue-400"][index % 6];
}

function getIntensityBoost(intensity: string): number {
  const normalized = intensity.toLowerCase();
  if (normalized.includes("high") || normalized.includes("intense")) return 8;
  if (normalized.includes("light") || normalized.includes("low")) return -12;
  return 0;
}

export type TemplateFixtureData = FixtureData;
