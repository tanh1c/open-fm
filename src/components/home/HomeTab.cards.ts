import { calcAge } from "../../lib/valueFormatting";
import {
  buildPitchRows,
  buildStartingXIIds,
  getPitchRowWidth,
  positionCode,
} from "../squad/SquadTab.helpers";
import type {
  GameStateData,
  PlayerData,
  TeamData,
} from "../../store/gameStore";
import type { PlayerSlot } from "./TacticsFormationCard";
import type { SquadOverviewPlayer } from "./SquadOverviewTable";

// ---------------------------------------------------------------------------
// Form breakdown
// ---------------------------------------------------------------------------

export interface FormBreakdown {
  results: Array<"W" | "D" | "L">;
  totals: { won: number; drawn: number; lost: number };
  pointsPerGame: number;
}

export function buildFormBreakdown(form: ReadonlyArray<string>): FormBreakdown {
  const results = form
    .map((code) => code.toUpperCase())
    .filter((code): code is "W" | "D" | "L" => code === "W" || code === "D" || code === "L");

  const totals = results.reduce(
    (acc, r) => {
      if (r === "W") acc.won += 1;
      else if (r === "D") acc.drawn += 1;
      else acc.lost += 1;
      return acc;
    },
    { won: 0, drawn: 0, lost: 0 },
  );

  const points = totals.won * 3 + totals.drawn;
  const pointsPerGame = results.length === 0 ? 0 : points / results.length;

  return { results, totals, pointsPerGame };
}

// ---------------------------------------------------------------------------
// Goals breakdown for the donut card
// ---------------------------------------------------------------------------

export type GoalSegmentKind = "open_play" | "set_piece" | "counter" | "penalty";

export interface GoalSegment {
  kind: GoalSegmentKind;
  count: number;
}

export function buildGoalSegments(
  gameState: GameStateData,
  teamId: string | null | undefined,
): GoalSegment[] {
  const counts: Record<GoalSegmentKind, number> = {
    open_play: 0,
    set_piece: 0,
    counter: 0,
    penalty: 0,
  };

  if (!teamId || !gameState.league) {
    return toSegments(counts);
  }

  for (const fixture of gameState.league.fixtures) {
    if (
      fixture.status !== "Completed" ||
      !fixture.result?.report ||
      (fixture.home_team_id !== teamId && fixture.away_team_id !== teamId)
    ) {
      continue;
    }

    const isHome = fixture.home_team_id === teamId;
    const teamSide: "Home" | "Away" = isHome ? "Home" : "Away";

    for (const event of fixture.result.report.events) {
      if (event.side !== teamSide) continue;

      if (event.event_type === "PenaltyGoal") {
        counts.penalty += 1;
      } else if (event.event_type === "Goal") {
        counts.open_play += 1;
      }
    }
  }

  return toSegments(counts);
}

function toSegments(counts: Record<GoalSegmentKind, number>): GoalSegment[] {
  return [
    { kind: "open_play", count: counts.open_play },
    { kind: "set_piece", count: counts.set_piece },
    { kind: "counter", count: counts.counter },
    { kind: "penalty", count: counts.penalty },
  ];
}

// ---------------------------------------------------------------------------
// Squad overview rows
// ---------------------------------------------------------------------------

export function buildSquadOverviewRows(
  roster: ReadonlyArray<PlayerData>,
  limit = 12,
): SquadOverviewPlayer[] {
  return roster.slice(0, limit).map((p, idx) => ({
    id: p.id,
    position: positionCode(p.natural_position || p.position),
    number: idx + 1,
    matchName: p.match_name,
    fullName: p.full_name,
    age: calcAge(p.date_of_birth),
    nationality: p.nationality,
    condition: Math.round(p.condition),
    morale: Math.round(p.morale),
    appearances: p.stats.appearances,
    goals: p.stats.goals,
    assists: p.stats.assists,
    avgRating: p.stats.avg_rating,
    ovr: p.ovr ?? 0,
    potential: p.potential ?? null,
    wage: p.wage,
    marketValue: p.market_value,
    contractEnd: p.contract_end,
    injury: p.injury?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Tactics formation slots
// ---------------------------------------------------------------------------

const ROLE_FOR_POSITION: Record<string, string> = {
  Goalkeeper: "GK",
  LeftBack: "FB - Su",
  RightBack: "FB - Su",
  CenterBack: "CB - De",
  LeftWingBack: "WB - At",
  RightWingBack: "WB - At",
  DefensiveMidfielder: "DM - Su",
  CentralMidfielder: "CM - Su",
  AttackingMidfielder: "AM - At",
  LeftMidfielder: "WM - Su",
  RightMidfielder: "WM - Su",
  LeftWinger: "W - At",
  RightWinger: "W - At",
  Striker: "AF - At",
};

export function buildTacticsSlots(
  myTeam: TeamData | null,
  roster: ReadonlyArray<PlayerData>,
): PlayerSlot[] {
  if (!myTeam) return [];

  const formation = myTeam.formation || "4-4-2";
  const rows = buildPitchRows(formation);
  const playerById = new Map(roster.map((p) => [p.id, p]));
  const xiIds = buildStartingXIIds([...roster], myTeam.starting_xi_ids ?? [], formation);

  const slots: PlayerSlot[] = [];
  let slotIndex = 0;

  for (const row of rows) {
    const y = parseFloat(row.y);
    const rowWidth = parseFloat(getPitchRowWidth(row.positions.length));
    const leftEdge = 50 - rowWidth / 2;
    const xStep = row.positions.length > 1 ? rowWidth / (row.positions.length - 1) : 0;

    row.positions.forEach((position, columnIndex) => {
      const player = playerById.get(xiIds[slotIndex]);
      const x = row.positions.length === 1 ? 50 : leftEdge + xStep * columnIndex;

      if (player) {
        slots.push({
          id: player.id,
          name: player.match_name,
          number: slotIndex + 1,
          role: ROLE_FOR_POSITION[position] || positionCode(position),
          x,
          y,
        });
      }

      slotIndex += 1;
    });
  }

  return slots;
}
