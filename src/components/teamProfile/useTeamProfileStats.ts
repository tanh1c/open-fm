import { useEffect, useState } from "react";

import type { PlayerData } from "../../store/gameStore";
import {
  fetchPlayerSeasonStats,
  fetchTeamRecentMatches,
  fetchTeamStatsOverview,
} from "./TeamProfile.gateway";
import type {
  TeamRecentMatchEntry,
  TeamRosterStatsByPlayerId,
  TeamStatsOverview,
} from "./TeamProfile.types";

interface TeamProfileStatsState {
  teamStatsOverview: TeamStatsOverview | null;
  recentMatches: TeamRecentMatchEntry[];
  rosterStatsByPlayerId: TeamRosterStatsByPlayerId;
}

export function useTeamProfileStats(teamId: string, roster: PlayerData[]): TeamProfileStatsState {
  const rosterStatsKey = roster.map((player) => player.id).join("|");
  const [teamStatsOverview, setTeamStatsOverview] =
    useState<TeamStatsOverview | null>(null);
  const [recentMatches, setRecentMatches] = useState<TeamRecentMatchEntry[]>([]);
  const [rosterStatsByPlayerId, setRosterStatsByPlayerId] =
    useState<TeamRosterStatsByPlayerId>({});

  useEffect(() => {
    let cancelled = false;

    const loadTeamProfileStats = async (): Promise<void> => {
      const [overviewResult, historyResult, rosterStatsResult] = await Promise.allSettled([
        fetchTeamStatsOverview(teamId),
        fetchTeamRecentMatches(teamId),
        Promise.all(
          roster.map(async (player) => {
            const stats = await fetchPlayerSeasonStats(player.id);
            return [player.id, stats] as const;
          }),
        ),
      ]);

      if (cancelled) {
        return;
      }

      setTeamStatsOverview(
        overviewResult.status === "fulfilled" ? overviewResult.value : null,
      );
      setRecentMatches(
        historyResult.status === "fulfilled" ? historyResult.value : [],
      );
      const rosterStatsById: TeamRosterStatsByPlayerId =
        rosterStatsResult.status === "fulfilled"
          ? rosterStatsResult.value.reduce<TeamRosterStatsByPlayerId>((statsById, [playerId, stats]) => {
            if (stats) {
              statsById[playerId] = stats;
            }
            return statsById;
          }, {})
          : {};
      setRosterStatsByPlayerId(rosterStatsById);
    };

    void loadTeamProfileStats();

    return () => {
      cancelled = true;
    };
  }, [teamId, rosterStatsKey]);

  return {
    teamStatsOverview,
    recentMatches,
    rosterStatsByPlayerId,
  };
}
