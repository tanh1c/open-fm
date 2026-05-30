import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomTacticSlotData } from "../../store/gameStore";
import { MatchSnapshot, EnginePlayerData } from "./types";
import { ChevronDown, Grid, LayoutGrid, ShieldAlert, Target, Wand2 } from "lucide-react";
import ContextMenu from "../ContextMenu";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import {
  GRID_TACTIC_SLOTS,
  mapGridSlotToPosition,
  PRESET_GRID_SLOT_IDS,
} from "../tactics/TacticsTab.helpers";

export const POSITION_KEY_STATS: Record<
  string,
  { label: string; key: string }[]
> = {
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

function hexToRgb(color: string): { red: number; green: number; blue: number } | null {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  const hex = normalized.slice(1);

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function normalizeHexColor(color: string): string | null {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;

  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const expanded = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex;

  return `#${expanded.toLowerCase()}`;
}

function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return false;
  }

  const brightness = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return brightness >= 205;
}

export function starterBadgeStyle(userColor: string): Record<string, string | number> {
  const normalizedHex = normalizeHexColor(userColor);

  if (!normalizedHex || isLightColor(normalizedHex)) {
    return {
      backgroundColor: "#f8fafc",
      color: "#334155",
      borderColor: "#cbd5e1",
      borderWidth: 1,
      borderStyle: "solid",
    };
  }

  return {
    backgroundColor: `${normalizedHex}30`,
    color: normalizedHex,
    borderColor: `${normalizedHex}55`,
    borderWidth: 1,
    borderStyle: "solid",
  };
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

export function parseFormationNeeds(formation: string): Record<string, number> {
  const parts = formation
    .split("-")
    .map(Number)
    .filter((n) => !isNaN(n));
  if (parts.length === 3)
    return {
      Goalkeeper: 1,
      Defender: parts[0],
      Midfielder: parts[1],
      Forward: parts[2],
    };
  if (parts.length === 4)
    return {
      Goalkeeper: 1,
      Defender: parts[0],
      Midfielder: parts[1] + parts[2],
      Forward: parts[3],
    };
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
  selectedStarterId: string | null;
  isAutoSelecting: boolean;
  onSelectStarter: (id: string | null) => void;
  onSwap: (benchPlayerId: string, starterPlayerId?: string) => void;
  onAutoSelect: () => void;
}

// Resolve which canonical grid slots are occupied for the starting XI. Prefer
// the team's custom tactic shape (the same slot layout the user arranged in
// /tactics, e.g. a hand-built 4-1-5) so the match pitch matches Tactics and the
// dashboard. Falls back to the formation preset when no custom shape exists.
export function resolveStarterSlotIds(
  formation: string,
  customSlots: CustomTacticSlotData[] | undefined,
): string[] {
  const occupiedCustomSlotIds = (customSlots ?? [])
    .filter((slot) => slot.player_id)
    .map((slot) => slot.slot_id)
    .filter((slotId) => GRID_TACTIC_SLOTS.some((candidate) => candidate.id === slotId));

  if (occupiedCustomSlotIds.length === 11) {
    // Keep canonical grid order so it lines up with the backend, which builds
    // the match starting XI by iterating custom_tactic_slots in this order.
    return GRID_TACTIC_SLOTS.filter((slot) => occupiedCustomSlotIds.includes(slot.id)).map(
      (slot) => slot.id,
    );
  }

  return PRESET_GRID_SLOT_IDS[formation] ?? PRESET_GRID_SLOT_IDS["4-4-2"];
}

// Build the initial slotId -> playerId mapping for the pitch from the resolved
// starter slot ids and the current starting XI order. Backend builds the XI by
// iterating the same canonical slot order, so players[i] lines up with slot i.
export function buildSlotPlayerMap(
  starterSlotIds: string[],
  starterPlayerIds: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  starterSlotIds.forEach((slotId, index) => {
    const playerId = starterPlayerIds[index];
    if (playerId) {
      map[slotId] = playerId;
    }
  });
  return map;
}

function getPitchPlayerButtonClassName(options: {
  draggedPlayerId: string | null;
  hoveredSlotId: string | null;
  isSelected: boolean;
  player: EnginePlayerData;
  slotId: string;
  wrongPosition: boolean;
}): string {
  const { draggedPlayerId, hoveredSlotId, isSelected, player, slotId, wrongPosition } = options;
  let className = "pointer-events-auto group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center border-0 bg-transparent p-0 text-center transition-all active:cursor-grabbing";

  if (draggedPlayerId === player.id) {
    className = `${className} opacity-70`;
  }

  if (isSelected || hoveredSlotId === slotId) {
    return `${className} scale-105`;
  }

  if (wrongPosition) {
    return `${className} saturate-150`;
  }

  return className;
}

function getRoleTone(wrongPosition: boolean): string {
  return wrongPosition ? "text-app-red" : "text-emerald-400";
}

function getBenchButtonClassName(options: {
  draggedBenchPlayerId: string | null;
  playerId: string;
  selectedStarterId: string | null;
}): string {
  const { draggedBenchPlayerId, playerId, selectedStarterId } = options;
  const isActive = draggedBenchPlayerId === playerId || selectedStarterId === playerId;

  return `flex min-w-[56px] shrink-0 cursor-grab flex-1 flex-col items-center overflow-hidden rounded-lg border bg-[#1a202a] transition-colors active:cursor-grabbing ${
    isActive ? "border-app-green/50 ring-1 ring-app-green/30" : "border-app-border hover:border-[#3b4c66]"
  }`;
}

function getPlayerDisplayNumber(player: EnginePlayerData, index: number): number {
  const raw = Number((player as EnginePlayerData & { squad_number?: number | string; shirt_number?: number | string }).squad_number ?? (player as EnginePlayerData & { shirt_number?: number | string }).shirt_number);
  return Number.isFinite(raw) && raw > 0 ? raw : index + 1;
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
  selectedStarterId,
  isAutoSelecting,
  onSelectStarter,
  onSwap,
  onAutoSelect,
}: PreMatchLineupProps) {
  const { t } = useTranslation();
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [draggedBenchPlayerId, setDraggedBenchPlayerId] = useState<string | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const starterIdsKey = userTeam.players.map((player) => player.id).join(",");
  const starterSlotIds = resolveStarterSlotIds(userTeam.formation, customSlots);
  const starterSlotIdsKey = starterSlotIds.join(",");

  // Local pitch layout: slotId -> playerId. Starters can be freely repositioned
  // by dragging between slots (this stays local and is NOT persisted — only the
  // bench<->XI PreMatchSwap goes to the backend). The shape the user saves lives
  // in /tactics; here it is just a matchday arrangement.
  const [slotPlayerMap, setSlotPlayerMap] = useState<Record<string, string>>(() =>
    buildSlotPlayerMap(starterSlotIds, userTeam.players.map((player) => player.id)),
  );

  // Reconcile the local layout whenever the starting XI or shape changes (after
  // a swap or formation change). Keep starters that are still in the XI in their
  // current slots, fill freed slots with incoming players, and re-seed entirely
  // if the layout drifts out of sync with the actual starting XI.
  useEffect(() => {
    const starterIds = userTeam.players.map((player) => player.id);
    setSlotPlayerMap((previous) => {
      const starterSet = new Set(starterIds);
      const keptEntries = Object.entries(previous).filter(
        ([slotId, playerId]) => starterSlotIds.includes(slotId) && starterSet.has(playerId),
      );
      const kept: Record<string, string> = Object.fromEntries(keptEntries);
      const placedPlayers = new Set(Object.values(kept));
      const newcomers = starterIds.filter((id) => !placedPlayers.has(id));
      const freeSlots = starterSlotIds.filter((slotId) => !(slotId in kept));

      let newcomerIndex = 0;
      for (const slotId of freeSlots) {
        const playerId = newcomers[newcomerIndex];
        if (!playerId) break;
        kept[slotId] = playerId;
        newcomerIndex += 1;
      }

      const placedCount = Object.keys(kept).length;
      if (placedCount !== starterIds.length) {
        return buildSlotPlayerMap(starterSlotIds, starterIds);
      }
      return kept;
    });
  }, [starterIdsKey, starterSlotIdsKey]);

  const playersById = new Map(userTeam.players.map((player) => [player.id, player]));
  // Render the full canonical grid like /tactics: every slot is shown, occupied
  // ones carry a player node and the rest are dashed empty placeholders.
  const pitchSlots = GRID_TACTIC_SLOTS.map((slot, index) => {
    const playerId = slotPlayerMap[slot.id] ?? null;
    const player = playerId ? playersById.get(playerId) ?? null : null;
    return {
      index,
      player,
      position: mapGridSlotToPosition(slot.id),
      slotId: slot.id,
      label: slot.label,
      x: slot.x,
      y: slot.y,
    };
  });
  const outOfPositionCount = pitchSlots.filter((slot) => slot.player && slot.player.position !== slot.position).length;
  const opponentColor = userSide === "Home" ? awayTeamColor : homeTeamColor;
  const sortedBench = sortBenchByPosition(userBench);

  const applyLightweightDragPreview = (event: DragEvent<HTMLElement>) => {
    if (!dragPreviewRef.current) return;
    if (typeof event.dataTransfer.setDragImage !== "function") return;
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

  const handleSlotDrop = (event: DragEvent<HTMLElement>, targetSlotId: string) => {
    event.preventDefault();
    const benchPlayerId = draggedBenchPlayerId;
    const movedStarterId = draggedPlayerId;
    const targetPlayerId = slotPlayerMap[targetSlotId] ?? null;
    setHoveredSlotId(null);
    setDraggedPlayerId(null);
    setDraggedBenchPlayerId(null);

    // Bench player dropped onto an occupied slot -> persisted PreMatchSwap.
    if (benchPlayerId) {
      if (targetPlayerId && benchPlayerId !== targetPlayerId) {
        onSelectStarter(targetPlayerId);
        onSwap(benchPlayerId, targetPlayerId);
      }
      return;
    }

    // Starter dragged between slots -> local-only reposition (not persisted).
    // The matchday arrangement lives only on this screen; saved shapes are set
    // in /tactics. Move into an empty slot, or swap places with the occupant.
    if (movedStarterId) {
      setSlotPlayerMap((previous) => {
        const sourceSlotId = Object.keys(previous).find(
          (slotId) => previous[slotId] === movedStarterId,
        );
        if (!sourceSlotId || sourceSlotId === targetSlotId) return previous;

        const next = { ...previous };
        if (targetPlayerId) {
          next[sourceSlotId] = targetPlayerId;
        } else {
          delete next[sourceSlotId];
        }
        next[targetSlotId] = movedStarterId;
        return next;
      });
    }
  };

  const clearDragState = () => {
    setDraggedPlayerId(null);
    setDraggedBenchPlayerId(null);
    setHoveredSlotId(null);
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
      <div
        ref={dragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-surface-900/90 shadow-lg"
      />
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-app-border bg-app-card">
        <div className="flex items-center justify-between border-b border-app-border/50 bg-white/[0.01] p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded border border-app-border bg-app-bg px-3 py-1.5 text-[11px] font-bold uppercase text-app-text transition-colors hover:border-app-border/80 hover:bg-white/5"
            >
              <span>{userTeam.formation.toUpperCase()}</span>
              <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" />
            </button>
            <div>
              <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-app-text-muted">
                {t("match.startingXI")}
              </h3>
              <p className="mt-1 text-[10px] text-app-text-muted">
                {selectedStarterId
                  ? t("match.swapPrompt")
                  : `${t("match.nPlayers", { count: userTeam.players.length })} · ${oppTeam.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                {t("match.formationFit")}
              </span>
              <div className="group flex items-center gap-1.5 transition-colors hover:text-white">
                <Target className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
                <span className="text-xs font-semibold">{userTeam.play_style}</span>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">TEAM SHAPE</span>
              <div className="group flex items-center gap-1.5 transition-colors hover:text-white">
                <LayoutGrid className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
                <span className="text-xs font-semibold">{userTeam.formation}</span>
              </div>
            </div>
            {selectedStarterId ? (
              <button
                type="button"
                onClick={() => onSelectStarter(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-app-green hover:text-primary-400"
              >
                {t("match.cancel")}
              </button>
            ) : null}
            <button type="button" className="rounded border border-transparent p-1.5 text-app-green transition-colors hover:border-app-green/20 hover:bg-app-green/10">
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 justify-center overflow-hidden border-b border-emerald-900/40 bg-[#1c2723] p-1 lg:p-2">
          <svg
            aria-hidden="true"
            className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded-xl sm:inset-2 sm:h-[calc(100%-1rem)] sm:w-[calc(100%-1rem)]"
            viewBox="0 0 68 105"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="prematchPitchGrass" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#244c38" />
                <stop offset="50%" stopColor="#1c3a2c" />
                <stop offset="100%" stopColor="#173025" />
              </linearGradient>
              <pattern id="prematchPitchStripes" width="68" height="13.125" patternUnits="userSpaceOnUse">
                <rect width="68" height="6.5625" fill="rgba(255,255,255,0.035)" />
                <rect y="6.5625" width="68" height="6.5625" fill="rgba(0,0,0,0.035)" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#prematchPitchGrass)" />
            <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#prematchPitchStripes)" />
            <g fill="none" stroke="rgba(6,95,70,0.76)" strokeWidth="0.75">
              <rect x="1.5" y="1.5" width="65" height="102" rx="1" />
              <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
              <circle cx="34" cy="52.5" r="9.15" />
              <circle cx="34" cy="52.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" />

              <rect x="13.84" y="1.5" width="40.32" height="16.5" />
              <rect x="24.84" y="1.5" width="18.32" height="5.5" />
              <circle cx="34" cy="12.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" />
              <path d="M26.8 18 A9.15 9.15 0 0 0 41.2 18" />
              <rect x="29.84" y="0.2" width="8.32" height="1.3" />

              <rect x="13.84" y="87" width="40.32" height="16.5" />
              <rect x="24.84" y="98" width="18.32" height="5.5" />
              <circle cx="34" cy="92.5" r="0.55" fill="rgba(6,95,70,0.76)" stroke="none" />
              <path d="M26.8 87 A9.15 9.15 0 0 1 41.2 87" />
              <rect x="29.84" y="103.5" width="8.32" height="1.3" />
            </g>
          </svg>

          {pitchSlots.map((slot) => {
            const player = slot.player;
            const isSelected = selectedStarterId === player?.id;
            const wrongPosition = player ? player.position !== slot.position : false;

            return (
              <div
                key={slot.slotId}
                data-testid={`pre-match-slot-${slot.slotId}`}
                className="pointer-events-none absolute h-[54px] w-[68px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onDragOver={(event) => handleSlotDragOver(event, slot.slotId)}
                onDragLeave={() => setHoveredSlotId(null)}
                onDrop={(event) => handleSlotDrop(event, slot.slotId)}
              >
                {player ? (
                  <ContextMenu
                    items={[
                      {
                        label: isSelected ? t("match.cancel") : t("match.selectForSwap"),
                        onClick: () => onSelectStarter(isSelected ? null : player.id),
                      },
                    ]}
                  >
                    <button
                      type="button"
                      draggable
                      data-testid={`pre-match-starter-${player.id}`}
                      onClick={() => onSelectStarter(isSelected ? null : player.id)}
                      onDragStart={(event) => handlePlayerDragStart(event, player.id, false)}
                      onDragEnd={clearDragState}
                      onDragOver={(event) => handleSlotDragOver(event, slot.slotId)}
                      onDragLeave={() => setHoveredSlotId(null)}
                      onDrop={(event) => handleSlotDrop(event, slot.slotId)}
                      className={getPitchPlayerButtonClassName({
                        draggedPlayerId,
                        hoveredSlotId,
                        isSelected,
                        player,
                        slotId: slot.slotId,
                        wrongPosition,
                      })}
                      style={{ left: "50%", top: "50%" }}
                    >
                      <div
                        className={`mb-1 flex h-8 w-8 items-center justify-center rounded-lg border-b-2 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110 ${wrongPosition ? "border-amber-700 bg-gradient-to-b from-amber-400 to-amber-600" : "border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600"}`}
                      >
                        {player.ovr}
                      </div>
                      <div className="z-10 flex w-full flex-col items-center px-1 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                        <span className="w-full truncate whitespace-nowrap text-[9px] font-bold text-white">{player.name}</span>
                        <span className={`text-[8px] font-medium leading-tight ${getRoleTone(wrongPosition)}`}>
                          {slot.label} · {Math.round(player.condition)}%
                        </span>
                      </div>
                    </button>
                  </ContextMenu>
                ) : (
                  <div
                    className={`pointer-events-auto flex h-full w-full items-center justify-center rounded-lg border border-dashed text-center text-[9px] font-bold ${hoveredSlotId === slot.slotId ? "border-app-green bg-app-green/10 text-app-green" : "border-emerald-800/50 bg-black/10 text-white/50"}`}
                    onDragOver={(event) => handleSlotDragOver(event, slot.slotId)}
                    onDragLeave={() => setHoveredSlotId(null)}
                    onDrop={(event) => handleSlotDrop(event, slot.slotId)}
                  >
                    {slot.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-black/20 p-3">
          <button type="button" className="flex items-center gap-2 rounded border border-app-border bg-app-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Analysis
          </button>
          <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
            {(["Goalkeeper", "Defender", "Midfielder", "Forward"] as const).map((pos) => {
              const needed = formationNeeds[pos] || 0;
              const actual = userTeam.players.filter((player) => player.position === pos).length;
              const ok = actual === needed;
              return (
                <span key={pos} className={ok ? "text-app-text-muted" : "text-amber-400"}>
                  {translatePositionAbbreviation(t, pos)} {actual}/{needed}
                </span>
              );
            })}
            <span>{outOfPositionCount} {t("squad.outOfPosition")}</span>
          </div>
          <button
            type="button"
            onClick={onAutoSelect}
            disabled={isAutoSelecting}
            className="flex items-center gap-2 rounded border border-app-border bg-app-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {isAutoSelecting ? t("match.selecting") : t("match.autoSelectXI")}
          </button>
        </div>

        <div className="border-t border-app-border/50 p-3 pb-2">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
            <span>{t("match.substitutes")}</span>
            <span className="flex items-center gap-2">
              <span>{t("match.opponent")}</span>
              <span>{oppTeam.name}</span>
              <span>{oppTeam.formation} · {t(`tactics.playStyles.${oppTeam.play_style}`, oppTeam.play_style)}</span>
            </span>
          </div>
          {userBench.length === 0 ? (
            <p className="text-xs text-app-text-muted">{t("match.noBenchAvailable2")}</p>
          ) : (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {sortedBench.map((player, index) => {
                const benchButton = (
                  <button
                    key={player.id}
                    type="button"
                    draggable
                    data-testid={`pre-match-bench-${player.id}`}
                    onClick={() => {
                      if (selectedStarterId) onSwap(player.id);
                    }}
                    onDragStart={(event) => handlePlayerDragStart(event, player.id, true)}
                    onDragEnd={clearDragState}
                    className={getBenchButtonClassName({ draggedBenchPlayerId: draggedPlayerId, playerId: player.id, selectedStarterId })}
                  >
                    <div className="relative flex w-full justify-center pb-1 pt-2">
                      <div className="absolute bottom-0 h-8 w-full bg-gradient-to-t from-red-500/20 to-transparent" />
                      <div className="z-10 flex h-8 w-8 items-center justify-center rounded border border-red-500/50 bg-red-900/30 text-sm font-bold shadow-sm">
                        <span className="text-white drop-shadow-md">{getPlayerDisplayNumber(player, index + 12)}</span>
                      </div>
                    </div>
                    <div className="z-10 flex w-full flex-col items-center px-1 pb-1">
                      <span className="w-full truncate text-center text-[9px] font-bold">{player.name}</span>
                      <span className="w-full truncate text-center text-[8px] text-app-text-muted">
                        {translatePositionAbbreviation(t, player.position)} · {Math.round(player.condition)}%
                      </span>
                    </div>
                    <div className="flex w-full justify-center border-t border-app-border/50 bg-black/20">
                      <span className="py-0.5 font-mono text-[9px] font-bold text-app-text-muted">{player.ovr}</span>
                    </div>
                  </button>
                );

                if (!selectedStarterId) return benchButton;

                return (
                  <ContextMenu
                    key={player.id}
                    items={[
                      {
                        label: t("match.swapWithSelectedStarter"),
                        onClick: () => onSwap(player.id),
                      },
                    ]}
                  >
                    {benchButton}
                  </ContextMenu>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between text-[9px] text-app-text-muted">
            <span><b>{userBench.length}</b> {t("preMatch.substitutes")}</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: userColor }} />
              {userTeam.name}
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: opponentColor }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
