import { useEffect, useState } from "react";

import { fetchTeamProfileStats } from "./TeamProfile.gateway";
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

export function useTeamProfileStats(teamId: string): TeamProfileStatsState {
  const [teamStatsOverview, setTeamStatsOverview] =
    useState<TeamStatsOverview | null>(null);
  const [recentMatches, setRecentMatches] = useState<TeamRecentMatchEntry[]>([]);
  const [rosterStatsByPlayerId, setRosterStatsByPlayerId] =
    useState<TeamRosterStatsByPlayerId>({});

  useEffect(() => {
    let cancelled = false;

    const loadTeamProfileStats = async(): Promise<void> => {
      try {
        const result = await fetchTeamProfileStats(teamId);

        if (cancelled) {
          return;
        }

        setTeamStatsOverview(result.teamStatsOverview);
        setRecentMatches(result.recentMatches);
        setRosterStatsByPlayerId(result.rosterStatsByPlayerId);
      } catch {
        if (cancelled) {
          return;
        }

        setTeamStatsOverview(null);
        setRecentMatches([]);
        setRosterStatsByPlayerId({});
      }
    };

    void loadTeamProfileStats();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return {
    teamStatsOverview,
    recentMatches,
    rosterStatsByPlayerId,
  };
}
