import type { TFunction } from "i18next";

import type { GameStateData, PlayerData, TeamData } from "../../store/gameStore";

export interface TeamProfileProps {
  team: TeamData;
  gameState: GameStateData;
  isOwnTeam: boolean;
  onClose: () => void;
  onSelectPlayer?: (id: string) => void;
}

export type TeamProfileTranslate = TFunction;

export type LeagueStanding = NonNullable<GameStateData["league"]>["standings"][number];

export interface TeamProfileViewModel {
  roster: PlayerData[];
  avgOvr: number;
  totalWages: number;
  totalValue: number;
  manager: GameStateData["manager"] | null;
  leaguePos: number;
  standings: LeagueStanding | null;
}

export interface TeamStatsOverview {
  matchesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  possessionAverage: number | null;
  metrics: {
    shots: { total: number; perMatch: number | null };
    shotsOnTarget: { total: number; perMatch: number | null };
    passes: {
      completed: number;
      attempted: number;
      accuracy: number | null;
    };
    tacklesWon: { total: number; perMatch: number | null };
    interceptions: { total: number; perMatch: number | null };
    foulsCommitted: { total: number; perMatch: number | null };
  };
}

export interface TeamRecentMatchEntry {
  fixtureId: string;
  date: string;
  competition: string;
  matchday: number;
  opponentTeamId: string;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  possessionPct: number;
  shots: number;
  shotsOnTarget: number;
}
