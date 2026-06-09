import { invoke } from "@tauri-apps/api/core";

import { seasonTotalsToPlayerStats, type PlayerAdvancedStatsSummary } from "../playerProfile/PlayerProfile.helpers";
import type { PlayerSeasonStats } from "../../store/gameStore";
import type { TeamRecentMatchEntry, TeamStatsOverview } from "./TeamProfile.types";

export const TEAM_PROFILE_RECENT_MATCH_LIMIT = 5;

export async function fetchTeamStatsOverview(
  teamId: string,
): Promise<TeamStatsOverview | null> {
  return invoke<TeamStatsOverview | null>("get_team_stats_overview", {
    teamId,
  });
}

export async function fetchPlayerSeasonStats(
  playerId: string,
): Promise<PlayerSeasonStats | null> {
  const result = await invoke<PlayerAdvancedStatsSummary>("get_player_stats_overview", {
    playerId,
  });

  return result.seasonTotals ? seasonTotalsToPlayerStats(result.seasonTotals) : null;
}

export async function fetchTeamRecentMatches(
  teamId: string,
  limit = TEAM_PROFILE_RECENT_MATCH_LIMIT,
): Promise<TeamRecentMatchEntry[]> {
  const result = await invoke<TeamRecentMatchEntry[] | null>(
    "get_team_match_history",
    {
      teamId,
      limit,
    },
  );

  return Array.isArray(result) ? result : [];
}
