import { findNextFixture, formatDateShort, formatMatchDate, getTeamName } from "../../lib/helpers";
import type { FixtureData, GameStateData, NewsArticle, PlayerData, TeamData } from "../../store/gameStore";
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
      return {
        id: fixture.id,
        date: formatDateShort(fixture.date, lang),
        opponent: getTeamName(gameState.teams, opponentId),
        isHome,
        type: fixture.competition,
        color: shieldColor(index),
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

export function buildTemplateTransferActivity(news: NewsArticle[], teams: TeamData[], lang: string): TemplateTransferActivityItem[] {
  return news.slice(0, 3).map((article) => ({
    id: article.id,
    name: article.headline,
    pos: `${formatDateShort(article.date, lang)} • ${article.source}`,
    from: teams.find((team) => article.team_ids.includes(team.id))?.short_name ?? "News",
    fee: article.match_score ? `${article.match_score.home_goals}-${article.match_score.away_goals}` : "INFO",
  }));
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
