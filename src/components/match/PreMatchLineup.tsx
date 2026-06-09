import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomTacticSlotData, PlayerData } from "../../store/gameStore";
import { getPlayerOvr, getPlayerOvrForPosition } from "../../lib/helpers";
import type { MatchSnapshot, EnginePlayerData } from "./types";
import { ChevronDown, Grid, LayoutGrid, ShieldAlert, Target, Wand2 } from "lucide-react";
import ContextMenu from "../ContextMenu";
import {
  getSlotFitTone,
  isPlayerOutOfPosition,
  translatePositionAbbreviation,
  type SlotFitTone,
} from "../squad/SquadTab.helpers";
import {
  buildGridAssignmentsFromFormation,
  buildGridAssignmentsFromSavedSlots,
  deriveFormationFromGridAssignments,
  getGridAssignmentIssues,
  GRID_TACTIC_SLOTS,
  mapGridSlotToPosition,
  movePlayerInGridAssignments,
  PRESET_GRID_SLOT_IDS,
  TACTICAL_ROLE_OPTIONS,
  type GridTacticAssignment,
} from "../tactics/TacticsTab.helpers";

export const POSITION_KEY_STATS: Record<string, { label: string; key: string }[]> = {
  Goalkeeper: [
    { label: "HAN", key: "handling" },
    { label: "REF", key: "reflexes" },
    { label: "AER", key: "aerial" },
  ],
  Defender: [
    { label: "DEF", key: "defending" },
    { label: "TAC", key: "tackling" },
    { label: "STR", key: "strength" },
  ],
  Midfielder: [
    { label: "PAS", key: "passing" },
    { label: "VIS", key: "vision" },
    { label: "STA", key: "stamina" },
  ],
  Forward: [
    { label: "SHO", key: "shooting" },
    { label: "PAC", key: "pace" },
    { label: "DRI", key: "dribbling" },
  ],
};

export function condColor(c: number): string {
  if (c >= 75) return "text-primary-400";
  if (c >= 50) return "text-amber-400";
  return "text-red-400";
}

export function statColor(v: number): string {
  if (v >= 75) return "text-primary-500 dark:text-primary-400 font-bold";
  if (v >= 60) return "text-gray-700 dark:text-gray-200";
  return "text-gray-500 dark:text-gray-400";
}

export function starterOvrColor(ovr: number): string {
  if (ovr >= 70) return "text-primary-600 dark:text-primary-400";
  if (ovr >= 50) return "text-gray-700 dark:text-gray-300";
  return "text-red-600 dark:text-red-400";
}

export function getStatVal(p: EnginePlayerData, key: string): number {
  return (p as unknown as Record<string, number>)[key] ?? 0;
}

const BENCH_POSITION_ORDER: Record<string, number> = {
  Forward: 0,
  Midfielder: 1,
  Defender: 2,
  Goalkeeper: 3,
};

export function sortBenchByPosition(bench: EnginePlayerData[]): EnginePlayerData[] {
  return [...bench].sort((left, right) => {
    const leftOrder = BENCH_POSITION_ORDER[left.position] ?? 99;
    const rightOrder = BENCH_POSITION_ORDER[right.position] ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return right.ovr - left.ovr;
  });
}

function normalizeHexColor(color: string): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.slice(1).split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : "#334155";
}

export function starterBadgeStyle(color: string): { backgroundColor: string; color: string; borderColor: string; borderWidth: number; borderStyle: "solid" } {
  const hex = normalizeHexColor(color);
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  if (luminance > 0.92) {
    return {
      backgroundColor: "#f8fafc",
      color: "#334155",
      borderColor: "#cbd5e1",
      borderWidth: 1,
      borderStyle: "solid",
    };
  }
  return {
    backgroundColor: `${hex}30`,
    color: hex,
    borderColor: `${hex}55`,
    borderWidth: 1,
    borderStyle: "solid",
  };
}

export function parseFormationNeeds(formation: string): Record<string, number> {
  const parts = formation.split("-").map(Number).filter((n) => !Number.isNaN(n));
  if (parts.length === 3) {
    return { Goalkeeper: 1, Defender: parts[0], Midfielder: parts[1], Forward: parts[2] };
  }
  if (parts.length === 4) {
    return { Goalkeeper: 1, Defender: parts[0], Midfielder: parts[1] + parts[2], Forward: parts[3] };
  }
  return { Goalkeeper: 1, Defender: 4, Midfielder: 4, Forward: 2 };
}

interface PreMatchLineupProps {
  userTeam: MatchSnapshot["home_team"];
  userBench: EnginePlayerData[];
  oppTeam: MatchSnapshot["home_team"];
  userColor: string;
  homeTeamColor: string;
  awayTeamColor: string;
  userSide: "Home" | "Away";
  formationNeeds: Record<string, number>;
  customSlots?: CustomTacticSlotData[];
  squadPlayers?: PlayerData[];
  selectedStarterId: string | null;
  isAutoSelecting: boolean;
  onSelectStarter: (id: string | null) => void;
  onSwap: (benchPlayerId: string, starterPlayerId?: string) => void;
  onAutoSelect: (assignments: GridTacticAssignment[]) => void;
  onAssignmentsChange?: (assignments: GridTacticAssignment[]) => void;
}

export function resolveStarterSlotIds(formation: string, customSlots: CustomTacticSlotData[] | undefined): string[] {
  const occupiedCustomSlotIds = (customSlots ?? [])
    .filter((slot) => slot.player_id)
    .map((slot) => slot.slot_id)
    .filter((slotId) => GRID_TACTIC_SLOTS.some((candidate) => candidate.id === slotId));

  if (occupiedCustomSlotIds.length === 11) {
    return GRID_TACTIC_SLOTS.filter((slot) => occupiedCustomSlotIds.includes(slot.id)).map((slot) => slot.id);
  }

  return PRESET_GRID_SLOT_IDS[formation] ?? PRESET_GRID_SLOT_IDS["4-4-2"];
}

export function buildSlotPlayerMap(starterSlotIds: string[], starterPlayerIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  starterSlotIds.forEach((slotId, index) => {
    const playerId = starterPlayerIds[index];
    if (playerId) map[slotId] = playerId;
  });
  return map;
}

function buildMatchGridAssignments(
  formation: string,
  customSlots: CustomTacticSlotData[] | undefined,
  starterIds: string[],
  availablePlayerIds: Set<string>,
): GridTacticAssignment[] {
  const fallback = buildGridAssignmentsFromFormation(formation, starterIds);
  const saved = buildGridAssignmentsFromSavedSlots(customSlots, fallback, availablePlayerIds);
  const assignedIds = new Set(saved.map((assignment) => assignment.playerId).filter((id): id is string => id != null));
  const missingStarters = starterIds.filter((id) => !assignedIds.has(id));
  if (missingStarters.length === 0) return saved;

  let missingIndex = 0;
  return saved.map((assignment) => {
    if (assignment.playerId) return assignment;
    const playerId = missingStarters[missingIndex++];
    return playerId ? { ...assignment, playerId } : assignment;
  });
}

function enginePlayerToPlayerData(enginePlayer: EnginePlayerData, fallback?: PlayerData): PlayerData {
  if (fallback) {
    return {
      ...fallback,
      match_name: fallback.match_name || enginePlayer.name,
      full_name: fallback.full_name || enginePlayer.name,
      position: fallback.position || enginePlayer.position,
      natural_position: fallback.natural_position || fallback.position || enginePlayer.position,
      condition: enginePlayer.condition,
      ovr: enginePlayer.ovr,
      attributes: {
        ...fallback.attributes,
        pace: enginePlayer.pace,
        stamina: enginePlayer.stamina,
        strength: enginePlayer.strength,
        agility: enginePlayer.agility,
        passing: enginePlayer.passing,
        shooting: enginePlayer.shooting,
        tackling: enginePlayer.tackling,
        dribbling: enginePlayer.dribbling,
        defending: enginePlayer.defending,
        positioning: enginePlayer.positioning,
        vision: enginePlayer.vision,
        decisions: enginePlayer.decisions,
        composure: enginePlayer.composure,
        aggression: enginePlayer.aggression,
        teamwork: enginePlayer.teamwork,
        leadership: enginePlayer.leadership,
        handling: enginePlayer.handling,
        reflexes: enginePlayer.reflexes,
        aerial: enginePlayer.aerial,
      },
    };
  }

  return {
    id: enginePlayer.id,
    match_name: enginePlayer.name,
    full_name: enginePlayer.name,
    date_of_birth: "2000-01-01",
    nationality: "Unknown",
    position: enginePlayer.position,
    natural_position: enginePlayer.position,
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: enginePlayer.pace,
      stamina: enginePlayer.stamina,
      strength: enginePlayer.strength,
      agility: enginePlayer.agility,
      passing: enginePlayer.passing,
      shooting: enginePlayer.shooting,
      tackling: enginePlayer.tackling,
      dribbling: enginePlayer.dribbling,
      defending: enginePlayer.defending,
      positioning: enginePlayer.positioning,
      vision: enginePlayer.vision,
      decisions: enginePlayer.decisions,
      composure: enginePlayer.composure,
      aggression: enginePlayer.aggression,
      teamwork: enginePlayer.teamwork,
      leadership: enginePlayer.leadership,
      handling: enginePlayer.handling,
      reflexes: enginePlayer.reflexes,
      aerial: enginePlayer.aerial,
    },
    condition: enginePlayer.condition,
    morale: 50,
    injury: null,
    team_id: null,
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: { appearances: 0, goals: 0, assists: 0, clean_sheets: 0, yellow_cards: 0, red_cards: 0, avg_rating: 0, minutes_played: 0 },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: enginePlayer.traits,
    ovr: enginePlayer.ovr,
  };
}

function getPitchPlayerButtonClassName(options: {
  draggedPlayerId: string | null;
  hoveredSlotId: string | null;
  isSelected: boolean;
  player: PlayerData;
  slotId: string;
  wrongPosition: boolean;
}): string {
  const { draggedPlayerId, hoveredSlotId, isSelected, player, slotId, wrongPosition } = options;
  let className = "pointer-events-auto group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center border-0 bg-transparent p-0 text-center transition-all active:cursor-grabbing";
  if (draggedPlayerId === player.id) className = `${className} opacity-70`;
  if (isSelected || hoveredSlotId === slotId) return `${className} scale-105`;
  if (wrongPosition) return `${className} saturate-150`;
  return className;
}

function getRoleTone(wrongPosition: boolean): string {
  return wrongPosition ? "text-app-red" : "text-emerald-400";
}

function getDutyBadge(duty: string): { symbol: string; className: string; title: string } {
  switch (duty) {
    case "Attack":
      return { symbol: "▲", className: "bg-red-500 text-white", title: "Attack duty" };
    case "Defend":
      return { symbol: "▼", className: "bg-sky-500 text-white", title: "Defend duty" };
    default:
      return { symbol: "▬", className: "bg-amber-500 text-black", title: "Support duty" };
  }
}

function fitRingClassName(tone: SlotFitTone): string {
  if (tone === "good") return "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]";
  if (tone === "ok") return "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]";
  return "ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]";
}

function fitEmptySlotClassName(tone: SlotFitTone): string {
  if (tone === "good") return "border-emerald-400 bg-emerald-400/15 text-emerald-300";
  if (tone === "ok") return "border-amber-400 bg-amber-400/15 text-amber-300";
  return "border-red-500 bg-red-500/15 text-red-300";
}

function getBenchButtonClassName(options: {
  draggedBenchPlayerId: string | null;
  playerId: string;
  selectedStarterId: string | null;
}): string {
  const { draggedBenchPlayerId, playerId, selectedStarterId } = options;
  const isActive = draggedBenchPlayerId === playerId || selectedStarterId === playerId;
  return `flex min-w-[56px] shrink-0 cursor-grab flex-1 flex-col items-center overflow-hidden rounded-lg border bg-[#1a202a] transition-colors active:cursor-grabbing ${isActive ? "border-app-green/50 ring-1 ring-app-green/30" : "border-app-border hover:border-[#3b4c66]"}`;
}

function getPlayerDisplayNumber(player: PlayerData, index: number): number {
  const raw = player.squad_number;
  return raw != null && raw > 0 ? raw : index + 1;
}

export default function PreMatchLineup({
  userTeam,
  userBench,
  oppTeam,
  userColor,
  homeTeamColor,
  awayTeamColor,
  userSide,
  formationNeeds,
  customSlots,
  squadPlayers,
  selectedStarterId,
  isAutoSelecting,
  onSelectStarter,
  onSwap,
  onAutoSelect,
  onAssignmentsChange,
}: PreMatchLineupProps) {
  const { t } = useTranslation();
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [draggedBenchPlayerId, setDraggedBenchPlayerId] = useState<string | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const safeSquadPlayers = squadPlayers ?? [];
  const squadById = useMemo(() => new Map(safeSquadPlayers.map((player) => [player.id, player])), [safeSquadPlayers]);
  const matchPlayers = useMemo(() => {
    return [...userTeam.players, ...userBench].map((player) => enginePlayerToPlayerData(player, squadById.get(player.id)));
  }, [squadById, userBench, userTeam.players]);
  const playersById = useMemo(() => new Map(matchPlayers.map((player) => [player.id, player])), [matchPlayers]);
  const starterIds = userTeam.players.map((player) => player.id);
  const assignmentsSeedKey = `${userTeam.formation}|${starterIds.join(",")}|${customSlots?.map((slot) => `${slot.slot_id}:${slot.player_id ?? ""}:${slot.tactical_role ?? ""}:${slot.duty ?? ""}`).join("|") ?? ""}`;

  const [gridAssignments, setGridAssignments] = useState<GridTacticAssignment[]>(() =>
    buildMatchGridAssignments(userTeam.formation, customSlots, starterIds, new Set(matchPlayers.map((player) => player.id))),
  );

  useEffect(() => {
    setGridAssignments(buildMatchGridAssignments(userTeam.formation, customSlots, starterIds, new Set(matchPlayers.map((player) => player.id))));
  }, [assignmentsSeedKey, matchPlayers]);

  const assignedGridSlots = GRID_TACTIC_SLOTS.map((slot, index) => {
    const assignment = gridAssignments.find((candidate) => candidate.slotId === slot.id);
    const player = assignment?.playerId ? playersById.get(assignment.playerId) ?? null : null;
    return {
      index,
      assignment,
      duty: assignment?.duty ?? "Support",
      label: slot.label,
      player,
      position: mapGridSlotToPosition(slot.id),
      slotId: slot.id,
      tacticalRole: assignment?.tacticalRole ?? TACTICAL_ROLE_OPTIONS[slot.role][0] ?? null,
      x: slot.x,
      y: slot.y,
    };
  });
  const assignedPlayerIds = new Set(gridAssignments.map((assignment) => assignment.playerId).filter((id): id is string => id != null));
  const benchPlayers = matchPlayers.filter((player) => !assignedPlayerIds.has(player.id));
  const gridAssignmentIssues = getGridAssignmentIssues(gridAssignments);
  const outOfPositionCount = assignedGridSlots.filter((slot) => slot.player && isPlayerOutOfPosition(slot.player, slot.position)).length;
  const opponentColor = userSide === "Home" ? awayTeamColor : homeTeamColor;
  const draggedPlayer = draggedPlayerId ? playersById.get(draggedPlayerId) ?? null : null;
  const derivedFormation = deriveFormationFromGridAssignments(gridAssignments);

  const applyAssignments = (nextAssignments: GridTacticAssignment[]) => {
    setGridAssignments(nextAssignments);
    onAssignmentsChange?.(nextAssignments);
  };

  const applyLightweightDragPreview = (event: DragEvent<HTMLElement>) => {
    if (!dragPreviewRef.current || typeof event.dataTransfer.setDragImage !== "function") return;
    event.dataTransfer.setDragImage(dragPreviewRef.current, 16, 16);
  };

  const handlePlayerDragStart = (event: DragEvent<HTMLElement>, playerId: string, fromBench: boolean) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    applyLightweightDragPreview(event);
    setDraggedPlayerId(playerId);
    setDraggedBenchPlayerId(fromBench ? playerId : null);
  };

  const handleSlotDragOver = (event: DragEvent<HTMLElement>, slotId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setHoveredSlotId(slotId);
  };

  const clearDragState = () => {
    setDraggedPlayerId(null);
    setDraggedBenchPlayerId(null);
    setHoveredSlotId(null);
  };

  const handleSlotDrop = (event: DragEvent<HTMLElement>, targetSlotId: string) => {
    event.preventDefault();
    const movedPlayerId = draggedPlayerId;
    const benchPlayerId = draggedBenchPlayerId;
    const targetAssignment = gridAssignments.find((assignment) => assignment.slotId === targetSlotId);
    const targetPlayerId = targetAssignment?.playerId ?? null;
    clearDragState();
    if (!movedPlayerId) return;

    const nextAssignments = movePlayerInGridAssignments(gridAssignments, movedPlayerId, targetSlotId);
    applyAssignments(nextAssignments);

    if (benchPlayerId && targetPlayerId && benchPlayerId !== targetPlayerId) {
      onSelectStarter(targetPlayerId);
      onSwap(benchPlayerId, targetPlayerId);
    }
  };

  useEffect(() => {
    const clearWindowDragState = () => clearDragState();
    window.addEventListener("dragend", clearWindowDragState);
    window.addEventListener("drop", clearWindowDragState);
    return () => {
      window.removeEventListener("dragend", clearWindowDragState);
      window.removeEventListener("drop", clearWindowDragState);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={dragPreviewRef} aria-hidden="true" className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-surface-900/90 shadow-lg" />
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-app-border bg-app-card">
        <div className="flex items-center justify-between border-b border-app-border/50 bg-white/[0.01] p-3">
          <div className="flex items-center gap-3">
            <button type="button" className="flex items-center gap-2 rounded border border-app-border bg-app-bg px-3 py-1.5 text-[11px] font-bold uppercase text-app-text transition-colors hover:border-app-border/80 hover:bg-white/5">
              <span>{userTeam.formation.toUpperCase()}</span>
              <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" />
            </button>
            <div>
              <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-app-text-muted">{t("match.startingXI")}</h3>
              <p className="mt-1 text-[10px] text-app-text-muted">
                {selectedStarterId ? t("match.swapPrompt") : `${t("match.nPlayers", { count: userTeam.players.length })} · ${oppTeam.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">{t("match.formationFit")}</span>
              <div className="group flex items-center gap-1.5 transition-colors hover:text-white">
                <Target className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
                <span className="text-xs font-semibold">{userTeam.play_style}</span>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">TEAM SHAPE</span>
              <div className="group flex items-center gap-1.5 transition-colors hover:text-white">
                <LayoutGrid className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
                <span className="text-xs font-semibold">{derivedFormation}</span>
              </div>
            </div>
            {selectedStarterId ? (
              <button type="button" onClick={() => onSelectStarter(null)} className="text-[10px] font-bold uppercase tracking-wider text-app-green hover:text-primary-400">
                {t("match.cancel")}
              </button>
            ) : null}
            <button type="button" className="rounded border border-transparent p-1.5 text-app-green transition-colors hover:border-app-green/20 hover:bg-app-green/10">
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 justify-center overflow-hidden border-b border-emerald-900/40 bg-[#1c2723] p-1 lg:p-2">
          <svg aria-hidden="true" className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded-xl sm:inset-2 sm:h-[calc(100%-1rem)] sm:w-[calc(100%-1rem)]" viewBox="0 0 68 105" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="prematchPitchGrass" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#244c38" /><stop offset="50%" stopColor="#1c3a2c" /><stop offset="100%" stopColor="#173025" /></linearGradient>
              <pattern id="prematchPitchStripes" width="68" height="13.125" patternUnits="userSpaceOnUse"><rect width="68" height="6.5625" fill="rgba(255,255,255,0.035)" /><rect y="6.5625" width="68" height="6.5625" fill="rgba(0,0,0,0.035)" /></pattern>
            </defs>
            <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#prematchPitchGrass)" />
            <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#prematchPitchStripes)" />
            <g fill="none" stroke="rgba(6,95,70,0.76)" strokeWidth="0.75">
              <rect x="1.5" y="1.5" width="65" height="102" rx="1" /><line x1="1.5" y1="52.5" x2="66.5" y2="52.5" /><circle cx="34" cy="52.5" r="9.15" /><circle cx="34" cy="52.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" />
              <rect x="13.84" y="1.5" width="40.32" height="16.5" /><rect x="24.84" y="1.5" width="18.32" height="5.5" /><circle cx="34" cy="12.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" /><path d="M26.8 18 A9.15 9.15 0 0 0 41.2 18" /><rect x="29.84" y="0.2" width="8.32" height="1.3" />
              <rect x="13.84" y="87" width="40.32" height="16.5" /><rect x="24.84" y="98" width="18.32" height="5.5" /><circle cx="34" cy="92.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" /><path d="M26.8 87 A9.15 9.15 0 0 1 41.2 87" /><rect x="29.84" y="103.5" width="8.32" height="1.3" />
            </g>
          </svg>

          {assignedGridSlots.map((slot) => {
            const player = slot.player;
            const isSelected = selectedStarterId === player?.id;
            const wrongPosition = player ? isPlayerOutOfPosition(player, slot.position) : false;
            const fitTone = draggedPlayer && draggedPlayer.id !== player?.id ? getSlotFitTone(draggedPlayer, slot.position) : null;
            const dutyBadge = getDutyBadge(slot.duty);

            return (
              <div key={slot.slotId} data-testid={`pre-match-slot-${slot.slotId}`} className="pointer-events-none absolute h-[54px] w-[68px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onDragOver={(event) => handleSlotDragOver(event, slot.slotId)} onDragLeave={() => setHoveredSlotId(null)} onDrop={(event) => handleSlotDrop(event, slot.slotId)}>
                {player ? (
                  <ContextMenu items={[{ label: isSelected ? t("match.cancel") : t("match.selectForSwap"), onClick: () => onSelectStarter(isSelected ? null : player.id) }]}>
                    <button type="button" draggable data-testid={`pre-match-starter-${player.id}`} onClick={() => onSelectStarter(isSelected ? null : player.id)} onDragStart={(event) => handlePlayerDragStart(event, player.id, false)} onDragEnd={clearDragState} onDragOver={(event) => handleSlotDragOver(event, slot.slotId)} onDragLeave={() => setHoveredSlotId(null)} onDrop={(event) => handleSlotDrop(event, slot.slotId)} className={getPitchPlayerButtonClassName({ draggedPlayerId, hoveredSlotId, isSelected, player, slotId: slot.slotId, wrongPosition })} style={{ left: "50%", top: "50%" }}>
                      <div className={`relative mb-1 flex h-8 w-8 items-center justify-center rounded-lg border-b-2 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110 ${wrongPosition ? "border-amber-700 bg-gradient-to-b from-amber-400 to-amber-600" : "border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600"} ${fitTone ? fitRingClassName(fitTone) : ""}`}>
                        {getPlayerOvrForPosition(player, slot.position)}
                        <span title={dutyBadge.title} className={`absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold leading-none shadow ${dutyBadge.className}`}>{dutyBadge.symbol}</span>
                      </div>
                      <div className="z-10 flex w-full flex-col items-center px-1 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                        <span className="w-full truncate whitespace-nowrap text-[9px] font-bold text-white">{player.match_name}</span>
                        <span className={`text-[8px] font-medium leading-tight ${getRoleTone(wrongPosition)}`}>{slot.label}{slot.tacticalRole ? ` (${slot.tacticalRole})` : ""} · {Math.round(player.condition)}%</span>
                      </div>
                    </button>
                  </ContextMenu>
                ) : (
                  <div className={`pointer-events-auto flex h-full w-full items-center justify-center rounded-lg border border-dashed text-center text-[9px] font-bold transition-colors ${fitTone ? fitEmptySlotClassName(fitTone) : hoveredSlotId === slot.slotId ? "border-app-green bg-app-green/10 text-app-green" : "border-emerald-800/50 bg-black/10 text-white/50"}`} onDragOver={(event) => handleSlotDragOver(event, slot.slotId)} onDragLeave={() => setHoveredSlotId(null)} onDrop={(event) => handleSlotDrop(event, slot.slotId)}>
                    {slot.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-black/20 p-3">
          <button type="button" className="flex items-center gap-2 rounded border border-app-border bg-app-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"><ShieldAlert className="h-3.5 w-3.5" />Analysis</button>
          <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
            {(["Goalkeeper", "Defender", "Midfielder", "Forward"] as const).map((pos) => {
              const needed = formationNeeds[pos] || 0;
              const actual = userTeam.players.filter((player) => player.position === pos).length;
              return <span key={pos} className={actual === needed ? "text-app-text-muted" : "text-amber-400"}>{translatePositionAbbreviation(t, pos)} {actual}/{needed}</span>;
            })}
            <span>{outOfPositionCount} {t("squad.outOfPosition")}</span>
            {gridAssignmentIssues.length > 0 ? <span className="text-amber-400">{gridAssignmentIssues.length} issues</span> : null}
          </div>
          <button type="button" onClick={() => onAutoSelect(gridAssignments)} disabled={isAutoSelecting} className="flex items-center gap-2 rounded border border-app-border bg-app-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-60"><Wand2 className="h-3.5 w-3.5" />{isAutoSelecting ? t("match.selecting") : t("match.autoSelectXI")}</button>
        </div>

        <div className="border-t border-app-border/50 p-3 pb-2">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
            <span>{t("match.substitutes")}</span>
            <span className="flex items-center gap-2"><span>{t("match.opponent")}</span><span>{oppTeam.name}</span><span>{oppTeam.formation} · {t(`tactics.playStyles.${oppTeam.play_style}`, oppTeam.play_style)}</span></span>
          </div>
          {benchPlayers.length === 0 ? (
            <p className="text-xs text-app-text-muted">{t("match.noBenchAvailable2")}</p>
          ) : (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {benchPlayers.sort((a, b) => getPlayerOvr(b) - getPlayerOvr(a)).map((player, index) => {
                const benchButton = (
                  <button key={player.id} type="button" draggable data-testid={`pre-match-bench-${player.id}`} onClick={() => { if (selectedStarterId) onSwap(player.id); }} onDragStart={(event) => handlePlayerDragStart(event, player.id, true)} onDragEnd={clearDragState} className={getBenchButtonClassName({ draggedBenchPlayerId: draggedPlayerId, playerId: player.id, selectedStarterId })}>
                    <div className="relative flex w-full justify-center pb-1 pt-2"><div className="absolute bottom-0 h-8 w-full bg-gradient-to-t from-red-500/20 to-transparent" /><div className="z-10 flex h-8 w-8 items-center justify-center rounded border border-red-500/50 bg-red-900/30 text-sm font-bold shadow-sm"><span className="text-white drop-shadow-md">{getPlayerDisplayNumber(player, index + 12)}</span></div></div>
                    <div className="z-10 flex w-full flex-col items-center px-1 pb-1"><span className="w-full truncate text-center text-[9px] font-bold">{player.match_name}</span><span className="w-full truncate text-center text-[8px] text-app-text-muted">{translatePositionAbbreviation(t, player.natural_position || player.position)} · {Math.round(player.condition)}%</span></div>
                    <div className="flex w-full justify-center border-t border-app-border/50 bg-black/20"><span className="py-0.5 font-mono text-[9px] font-bold text-app-text-muted">{getPlayerOvr(player)}</span></div>
                  </button>
                );
                if (!selectedStarterId) return benchButton;
                return <ContextMenu key={player.id} items={[{ label: t("match.swapWithSelectedStarter"), onClick: () => onSwap(player.id) }]}>{benchButton}</ContextMenu>;
              })}
            </div>
          )}
          <div className="flex items-center justify-between text-[9px] text-app-text-muted"><span><b>{benchPlayers.length}</b> {t("preMatch.substitutes")}</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: userColor }} />{userTeam.name}<span className="h-2 w-2 rounded-full" style={{ backgroundColor: opponentColor }} /></span></div>
        </div>
      </div>
    </div>
  );
}
