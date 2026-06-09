import { calcAge, getPlayerOvr, getPlayerOvrForPosition } from "../../lib/helpers";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import type { CustomTacticSlotData, PlayerData } from "../../store/gameStore";
import {
  buildPitchRows,
  buildStartingXIIds,
  isPlayerExactForSlot,
  getPreferredPositions,
  isPlayerOutOfPosition,
  normalisePosition,
  positionCode,
  type SquadSection,
} from "../squad/SquadTab.helpers";

export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "3-5-2",
  "4-5-1",
  "4-2-3-1",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
];

export const PLAY_STYLE_DESCRIPTION_FALLBACKS: Record<string, string> = {
  Balanced:
    "Keeps your team measured in and out of possession, with a steady shape and fewer extremes.",
  Attacking:
    "Pushes more bodies forward, creates extra support around the box, and asks your team to take more initiative.",
  Defensive:
    "Makes your team protect space first, stay compact, and reduce the risk of getting exposed behind the ball.",
  Possession:
    "Encourages your team to circulate the ball patiently, control the tempo, and look for cleaner openings.",
  Counter:
    "Invites your team to break forward quickly after regaining the ball, attacking space before the opponent resets.",
  HighPress:
    "Asks your team to close down earlier, win the ball higher up the pitch, and keep opponents under pressure.",
};

export type GridTacticSlotRole = "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD";

export interface GridTacticSlotDefinition {
  id: string;
  label: string;
  role: GridTacticSlotRole;
  x: number;
  y: number;
}

export interface GridTacticAssignment {
  slotId: string;
  playerId: string | null;
  tacticalRole?: string | null;
  duty?: string | null;
}

export const TACTICAL_DUTIES = ["Defend", "Support", "Attack"] as const;

export const TACTICAL_ROLE_OPTIONS: Record<GridTacticSlotRole, string[]> = {
  GK: ["GK", "SK"],
  DEF: ["FB", "WB", "CD", "BPD"],
  DM: ["BWM", "DLP", "DM"],
  MID: ["BWM", "DLP", "BBM", "AP"],
  AM: ["AP", "AM", "IW"],
  FWD: ["AF", "PF", "IF", "IW", "W"],
};

export const TACTICAL_ROLE_NAMES: Record<string, string> = {
  GK: "Goalkeeper",
  SK: "Sweeper Keeper",
  FB: "Full Back",
  WB: "Wing Back",
  CD: "Central Defender",
  BPD: "Ball Playing Defender",
  BWM: "Ball Winning Midfielder",
  DLP: "Deep Lying Playmaker",
  DM: "Defensive Midfielder",
  BBM: "Box to Box Midfielder",
  AP: "Advanced Playmaker",
  AM: "Attacking Midfielder",
  IW: "Inverted Winger",
  AF: "Advanced Forward",
  PF: "Pressing Forward",
  IF: "Inside Forward",
  W: "Winger",
};

export function getTacticalRoleName(role: string): string {
  return TACTICAL_ROLE_NAMES[role] ?? role;
}

export function getTacticalRoleOptionLabel(role: string): string {
  const fullName = TACTICAL_ROLE_NAMES[role];
  return fullName ? `${role} (${fullName})` : role;
}

export const GRID_TACTIC_SLOTS: GridTacticSlotDefinition[] = [
  { id: "gk", label: "GK", role: "GK", x: 50, y: 91 },
  { id: "lb", label: "LB", role: "DEF", x: 18, y: 72 },
  { id: "lcb", label: "LCB", role: "DEF", x: 34, y: 72 },
  { id: "cb", label: "CB", role: "DEF", x: 50, y: 74 },
  { id: "rcb", label: "RCB", role: "DEF", x: 66, y: 72 },
  { id: "rb", label: "RB", role: "DEF", x: 82, y: 72 },
  { id: "ldm", label: "LDM", role: "DM", x: 32, y: 58 },
  { id: "dm", label: "DM", role: "DM", x: 50, y: 59 },
  { id: "rdm", label: "RDM", role: "DM", x: 68, y: 58 },
  { id: "lm", label: "LM", role: "MID", x: 17, y: 47 },
  { id: "lcm", label: "LCM", role: "MID", x: 35, y: 45 },
  { id: "cm", label: "CM", role: "MID", x: 50, y: 45 },
  { id: "rcm", label: "RCM", role: "MID", x: 65, y: 45 },
  { id: "rm", label: "RM", role: "MID", x: 83, y: 47 },
  { id: "lw", label: "LW", role: "FWD", x: 18, y: 28 },
  { id: "lam", label: "LAM", role: "AM", x: 36, y: 31 },
  { id: "am", label: "AM", role: "AM", x: 50, y: 30 },
  { id: "ram", label: "RAM", role: "AM", x: 64, y: 31 },
  { id: "rw", label: "RW", role: "FWD", x: 82, y: 28 },
  { id: "ls", label: "LS", role: "FWD", x: 38, y: 17 },
  { id: "st", label: "ST", role: "FWD", x: 50, y: 15 },
  { id: "rs", label: "RS", role: "FWD", x: 62, y: 17 },
];

export const PRESET_GRID_SLOT_IDS: Record<string, string[]> = {
  "4-4-2": ["gk", "lb", "lcb", "rcb", "rb", "lm", "lcm", "rcm", "rm", "ls", "rs"],
  "4-3-3": ["gk", "lb", "lcb", "rcb", "rb", "lcm", "cm", "rcm", "lw", "st", "rw"],
  "3-5-2": ["gk", "lcb", "cb", "rcb", "lm", "ldm", "cm", "rdm", "rm", "ls", "rs"],
  "4-5-1": ["gk", "lb", "lcb", "rcb", "rb", "lm", "ldm", "cm", "rdm", "rm", "st"],
  "4-2-3-1": ["gk", "lb", "lcb", "rcb", "rb", "ldm", "rdm", "lam", "am", "ram", "st"],
  "3-4-3": ["gk", "lcb", "cb", "rcb", "lm", "lcm", "rcm", "rm", "lw", "st", "rw"],
  "5-3-2": ["gk", "lb", "lcb", "cb", "rcb", "rb", "lcm", "cm", "rcm", "ls", "rs"],
  "4-1-4-1": ["gk", "lb", "lcb", "rcb", "rb", "dm", "lm", "lcm", "rcm", "rm", "st"],
};

const GRID_SLOT_POSITION_MAP: Record<string, string> = {
  gk: "Goalkeeper",
  lb: "LeftBack",
  lcb: "CenterBack",
  cb: "CenterBack",
  rcb: "CenterBack",
  rb: "RightBack",
  ldm: "DefensiveMidfielder",
  dm: "DefensiveMidfielder",
  rdm: "DefensiveMidfielder",
  lm: "LeftMidfielder",
  lcm: "CentralMidfielder",
  cm: "CentralMidfielder",
  rcm: "CentralMidfielder",
  rm: "RightMidfielder",
  lw: "LeftWinger",
  lam: "AttackingMidfielder",
  am: "AttackingMidfielder",
  ram: "AttackingMidfielder",
  rw: "RightWinger",
  ls: "Striker",
  st: "Striker",
  rs: "Striker",
};

export function mapGridSlotToPosition(slotId: string): string {
  const slot = GRID_TACTIC_SLOTS.find((candidate) => candidate.id === slotId);

  if (!slot) return "Midfielder";
  return GRID_SLOT_POSITION_MAP[slot.id] ?? "Midfielder";
}

export function deriveFormationFromGridAssignments(assignments: GridTacticAssignment[]): string {
  const assignedSlotIds = new Set(
    assignments.filter((assignment) => assignment.playerId).map((assignment) => assignment.slotId),
  );
  let defenders = 0;
  let midfielders = 0;
  let forwards = 0;

  for (const slot of GRID_TACTIC_SLOTS) {
    if (!assignedSlotIds.has(slot.id) || slot.role === "GK") continue;
    if (slot.role === "DEF") defenders += 1;
    else if (slot.role === "FWD") forwards += 1;
    else midfielders += 1;
  }

  return `${defenders}-${midfielders}-${forwards}`;
}

export function buildEmptyGridAssignments(): GridTacticAssignment[] {
  return GRID_TACTIC_SLOTS.map((slot) => ({ slotId: slot.id, playerId: null }));
}

export function buildGridAssignmentsFromFormation(
  formation: string,
  startingXiIds: string[],
): GridTacticAssignment[] {
  const assignments = buildEmptyGridAssignments();
  const presetSlotIds = PRESET_GRID_SLOT_IDS[formation] ?? PRESET_GRID_SLOT_IDS["4-4-2"];

  presetSlotIds.forEach((slotId, index) => {
    const assignment = assignments.find((candidate) => candidate.slotId === slotId);
    if (assignment) assignment.playerId = startingXiIds[index] ?? null;
  });

  return assignments;
}

export function buildGridAssignmentsFromSavedSlots(
  savedSlots: CustomTacticSlotData[] | undefined,
  fallbackAssignments: GridTacticAssignment[],
  availablePlayerIds: Set<string>,
): GridTacticAssignment[] {
  if (!savedSlots?.length) return fallbackAssignments;

  const usedPlayerIds = new Set<string>();
  return GRID_TACTIC_SLOTS.map((slot) => {
    const savedSlot = savedSlots.find((candidate) => candidate.slot_id === slot.id);
    const playerId = savedSlot?.player_id ?? null;
    if (!playerId || !availablePlayerIds.has(playerId) || usedPlayerIds.has(playerId)) {
      return { slotId: slot.id, playerId: null };
    }

    usedPlayerIds.add(playerId);
    return {
      slotId: slot.id,
      playerId,
      tacticalRole: savedSlot?.tactical_role ?? null,
      duty: savedSlot?.duty ?? null,
    };
  });
}

export function movePlayerInGridAssignments(
  assignments: GridTacticAssignment[],
  playerId: string,
  targetSlotId: string,
): GridTacticAssignment[] {
  const movedAssignment = assignments.find((assignment) => assignment.playerId === playerId);
  const targetAssignment = assignments.find((assignment) => assignment.slotId === targetSlotId);

  return assignments.map((assignment) => {
    if (assignment.playerId === playerId) {
      return {
        ...assignment,
        playerId: targetAssignment?.playerId ?? null,
        tacticalRole: targetAssignment?.tacticalRole ?? null,
        duty: targetAssignment?.duty ?? null,
      };
    }

    if (assignment.slotId === targetSlotId) {
      return {
        ...assignment,
        playerId,
        tacticalRole: movedAssignment?.tacticalRole ?? null,
        duty: movedAssignment?.duty ?? null,
      };
    }

    return assignment;
  });
}

export function swapPlayersInGridAssignments(
  assignments: GridTacticAssignment[],
  selectedPlayerId: string,
  comparePlayerId: string,
): GridTacticAssignment[] {
  return assignments.map((assignment) => {
    if (assignment.playerId === selectedPlayerId) {
      return { ...assignment, playerId: comparePlayerId };
    }

    if (assignment.playerId === comparePlayerId) {
      return { ...assignment, playerId: selectedPlayerId };
    }

    return assignment;
  });
}

export function getStartingXiIdsFromGridAssignments(assignments: GridTacticAssignment[]): string[] {
  return assignments
    .filter((assignment) => assignment.playerId)
    .map((assignment) => assignment.playerId as string)
    .slice(0, 11);
}

export function getGridAssignmentSignature(assignments: GridTacticAssignment[]): string {
  return GRID_TACTIC_SLOTS.map((slot) => {
    const playerId = assignments.find((assignment) => assignment.slotId === slot.id)?.playerId ?? "";
    return `${slot.id}:${playerId}`;
  }).join("|");
}

// Signature including tactical role + duty, so optimistic role/duty edits are
// only cleared once the backend round-trip actually persists them.
export function getGridAssignmentDetailSignature(assignments: GridTacticAssignment[]): string {
  return GRID_TACTIC_SLOTS.map((slot) => {
    const assignment = assignments.find((candidate) => candidate.slotId === slot.id);
    return `${slot.id}:${assignment?.playerId ?? ""}:${assignment?.tacticalRole ?? ""}:${assignment?.duty ?? ""}`;
  }).join("|");
}

export function toBackendGridSlots(assignments: GridTacticAssignment[]): Array<{
  slot_id: string;
  player_id: string | null;
  role: GridTacticSlotRole;
  x: number;
  y: number;
  tactical_role: string | null;
  duty: string | null;
}> {
  return GRID_TACTIC_SLOTS.map((slot) => {
    const assignment = assignments.find((candidate) => candidate.slotId === slot.id);

    return {
      slot_id: slot.id,
      player_id: assignment?.playerId ?? null,
      role: slot.role,
      x: slot.x,
      y: slot.y,
      tactical_role: assignment?.tacticalRole ?? null,
      duty: assignment?.duty ?? null,
    };
  });
}

export function getGridAssignmentIssues(assignments: GridTacticAssignment[]): string[] {
  const assignedSlots = assignments.filter((assignment) => assignment.playerId);
  const playerIds = assignedSlots.map((assignment) => assignment.playerId as string);
  const issues: string[] = [];

  if (assignedSlots.length !== 11) {
    issues.push("tactics.validation.requiresEleven");
  }

  const duplicatePlayerIds = playerIds.filter(
    (playerId, index) => playerIds.indexOf(playerId) !== index,
  );
  if (duplicatePlayerIds.length > 0) {
    issues.push("tactics.validation.noDuplicates");
  }

  const goalkeeperAssignments = assignedSlots.filter((assignment) => {
    const slot = GRID_TACTIC_SLOTS.find((candidate) => candidate.id === assignment.slotId);
    return slot?.role === "GK";
  });
  if (goalkeeperAssignments.length !== 1) {
    issues.push("tactics.validation.requiresGoalkeeper");
  }

  if (assignedSlots.length - goalkeeperAssignments.length > 10) {
    issues.push("tactics.validation.maxOutfielders");
  }

  return issues;
}

export type SortDirection = "asc" | "desc";
export type SortKey = "pos" | "name" | "age" | "condition" | "morale" | "ovr";

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 1,
  Defender: 2,
  Midfielder: 3,
  Forward: 4,
};

interface TacticsPlayerSortContext {
  section: SquadSection;
  sortDir: SortDirection;
  sortKey: SortKey;
  xiActivePosition: Map<string, string>;
}

interface TacticsPlayerFilterContext {
  playerSearch: string;
  positionFilter: string;
  section: SquadSection;
  xiActivePosition: Map<string, string>;
}

interface ResolveStartingXiIdsOptions {
  availablePlayers: PlayerData[];
  formation: string;
  pendingStartingXiIds: string[] | null;
  playersById: Map<string, PlayerData>;
  savedStartingXiIds: string[];
}

function comparePlayersForSlot(
  leftPlayer: PlayerData,
  rightPlayer: PlayerData,
  slotPosition: string,
): number {
  return (
    Number(isPlayerOutOfPosition(leftPlayer, slotPosition)) -
    Number(isPlayerOutOfPosition(rightPlayer, slotPosition)) ||
    Number(!isPlayerExactForSlot(leftPlayer, slotPosition)) -
    Number(!isPlayerExactForSlot(rightPlayer, slotPosition)) ||
    getPlayerOvrForPosition(rightPlayer, slotPosition) - getPlayerOvrForPosition(leftPlayer, slotPosition) ||
    rightPlayer.condition - leftPlayer.condition ||
    leftPlayer.full_name.localeCompare(rightPlayer.full_name)
  );
}

export function buildTacticsRoster(
  players: PlayerData[],
  teamId: string,
): PlayerData[] {
  return players
    .filter(
      (player) => player.team_id === teamId && isSeniorSquadPlayer(player),
    )
    .sort((leftPlayer, rightPlayer) => {
      return (
        (POSITION_ORDER[normalisePosition(leftPlayer.position)] ?? 99) -
        (POSITION_ORDER[normalisePosition(rightPlayer.position)] ?? 99) ||
        getPlayerOvr(rightPlayer) - getPlayerOvr(leftPlayer)
      );
    });
}

export function resolveStartingXiIds({
  availablePlayers,
  formation,
  pendingStartingXiIds,
  playersById,
  savedStartingXiIds,
}: ResolveStartingXiIdsOptions): string[] {
  const baseIds = buildStartingXIIds(
    availablePlayers,
    savedStartingXiIds,
    formation,
  );
  const slotPositions = buildPitchRows(formation).flatMap((row) => row.positions);

  if (!pendingStartingXiIds || pendingStartingXiIds.length === 0) {
    return baseIds;
  }

  const validPendingIds = pendingStartingXiIds.filter((id) => playersById.has(id));
  const usedPlayerIds = new Set(validPendingIds);
  const fillPlayerIds: string[] = [];

  while (validPendingIds.length + fillPlayerIds.length < 11) {
    const slotPosition = slotPositions[validPendingIds.length + fillPlayerIds.length];
    const bestPlayer = availablePlayers
      .filter((player) => !usedPlayerIds.has(player.id))
      .sort((leftPlayer, rightPlayer) => comparePlayersForSlot(leftPlayer, rightPlayer, slotPosition))[0];

    if (!bestPlayer) break;
    fillPlayerIds.push(bestPlayer.id);
    usedPlayerIds.add(bestPlayer.id);
  }

  return [...validPendingIds, ...fillPlayerIds].slice(0, 11);
}

export function getSectionPlayerPosition(
  player: PlayerData,
  section: SquadSection,
  xiActivePosition: Map<string, string>,
): string {
  if (section === "xi") {
    return xiActivePosition.get(player.id) ?? player.position;
  }

  return player.natural_position || player.position;
}

export function sortTacticsPlayers(
  players: PlayerData[],
  context: TacticsPlayerSortContext,
): PlayerData[] {
  const { section, sortDir, sortKey, xiActivePosition } = context;
  const sortedPlayers = [...players].sort((leftPlayer, rightPlayer) => {
    const leftPosition = getSectionPlayerPosition(leftPlayer, section, xiActivePosition);
    const rightPosition = getSectionPlayerPosition(rightPlayer, section, xiActivePosition);
    const leftOvr = section === "xi" ? getPlayerOvrForPosition(leftPlayer, leftPosition) : getPlayerOvr(leftPlayer);
    const rightOvr = section === "xi" ? getPlayerOvrForPosition(rightPlayer, rightPosition) : getPlayerOvr(rightPlayer);

    switch (sortKey) {
      case "pos":
        return (
          (POSITION_ORDER[normalisePosition(leftPosition)] ?? 99) -
          (POSITION_ORDER[normalisePosition(rightPosition)] ?? 99) ||
          rightOvr - leftOvr
        );
      case "name":
        return leftPlayer.full_name.localeCompare(rightPlayer.full_name);
      case "age":
        return calcAge(leftPlayer.date_of_birth) - calcAge(rightPlayer.date_of_birth);
      case "condition":
        return leftPlayer.condition - rightPlayer.condition;
      case "morale":
        return leftPlayer.morale - rightPlayer.morale;
      case "ovr":
        return leftOvr - rightOvr;
      default:
        return 0;
    }
  });

  if (sortDir === "desc") {
    return sortedPlayers.reverse();
  }

  return sortedPlayers;
}

export function matchesTacticsPlayerFilters(
  player: PlayerData,
  context: TacticsPlayerFilterContext,
): boolean {
  const { playerSearch, positionFilter, section, xiActivePosition } = context;
  const currentPosition = normalisePosition(
    getSectionPlayerPosition(player, section, xiActivePosition),
  );
  const preferredPositions = getPreferredPositions(player);
  const normalizedSearch = playerSearch.trim().toLowerCase();

  if (normalizedSearch) {
    const searchableText = [
      player.full_name,
      player.match_name,
      currentPosition,
      ...preferredPositions,
      ...preferredPositions.map(positionCode),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(normalizedSearch)) {
      return false;
    }
  }

  if (
    positionFilter !== "All" &&
    currentPosition !== positionFilter &&
    !preferredPositions.includes(positionFilter)
  ) {
    return false;
  }

  return true;
}

export function filterAndSortTacticsPlayers(
  players: PlayerData[],
  filterContext: TacticsPlayerFilterContext,
  sortContext: TacticsPlayerSortContext,
): PlayerData[] {
  return sortTacticsPlayers(
    players.filter((player) => matchesTacticsPlayerFilters(player, filterContext)),
    sortContext,
  );
}

export function countOutOfPositionPlayers(
  startingPlayers: PlayerData[],
  xiActivePosition: Map<string, string>,
): number {
  return startingPlayers.filter((player) => {
    const currentPosition = xiActivePosition.get(player.id) ?? player.position;

    return isPlayerOutOfPosition(player, currentPosition);
  }).length;
}

export function getSelectedAndComparePlayers(
  comparePlayerId: string | null,
  playersById: Map<string, PlayerData>,
  selectedPlayerId: string | null,
): {
  comparePlayer: PlayerData | null;
  selectedPlayer: PlayerData | null;
} {
  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId) ?? null
    : null;

  const comparePlayer =
    selectedPlayerId && comparePlayerId && selectedPlayerId !== comparePlayerId
      ? playersById.get(comparePlayerId) ?? null
      : null;

  return {
    comparePlayer,
    selectedPlayer,
  };
}

export function getOverallRatingClassName(overallRating: number): string {
  if (overallRating >= 75) {
    return "text-success-500 dark:text-success-400";
  }

  if (overallRating >= 55) {
    return "text-accent-600 dark:text-accent-400";
  }

  return "text-gray-500 dark:text-gray-400";
}
