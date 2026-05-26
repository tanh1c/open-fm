import type {
  PlayerData,
  ScoutingAssignment,
  TeamData,
} from "../../store/gameStore";
import { getTeamName } from "../../lib/helpers";
import { normalisePosition } from "../squad/SquadTab.helpers";

interface FilterScoutablePlayersParams {
  players: PlayerData[];
  teams: TeamData[];
  myTeamId: string;
  posFilter: string;
  searchQuery: string;
}

export function filterScoutablePlayers({
  players,
  teams,
  myTeamId,
  posFilter,
  searchQuery,
}: FilterScoutablePlayersParams): PlayerData[] {
  const query = searchQuery.trim().toLowerCase();
  const hasQuery = query.length > 0;
  const teamNameById = hasQuery
    ? new Map(teams.map((team) => [team.id, getTeamName(teams, team.id).toLowerCase()]))
    : null;
  const result: PlayerData[] = [];

  for (const player of players) {
    if (player.team_id === myTeamId) continue;
    if (posFilter !== "All" && normalisePosition(player.natural_position || player.position) !== posFilter) continue;
    if (
      hasQuery &&
      !player.full_name.toLowerCase().includes(query) &&
      !player.nationality.toLowerCase().includes(query) &&
      !(player.team_id && teamNameById?.get(player.team_id)?.includes(query))
    ) {
      continue;
    }

    result.push(player);
  }

  return result;
}

export function paginateScoutablePlayers(
  players: PlayerData[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(players.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  return {
    totalPages,
    safePage,
    players: players.slice(safePage * pageSize, (safePage + 1) * pageSize),
  };
}

export function buildAlreadyScoutingIds(assignments: ScoutingAssignment[]) {
  return new Set(assignments.map((assignment) => assignment.player_id));
}