import type { DragEvent, JSX } from "react";
import { useState } from "react";
import { ChevronDown, Grid, LayoutGrid, ShieldAlert, Target, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPlayerOvr } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import {
  getSlotFitTone,
  isPlayerOutOfPosition,
  translatePositionAbbreviation,
  type DragState,
  type SlotFitTone,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import {
  FORMATIONS,
  GRID_TACTIC_SLOTS,
  mapGridSlotToPosition,
  TACTICAL_ROLE_OPTIONS,
  type GridTacticAssignment,
} from "./TacticsTab.helpers";

interface TacticsPitchProps {
  benchPlayers: PlayerData[];
  dragState: DragState | null;
  formation: string;
  formationLabel?: string;
  mentalityLabel: string;
  teamShapeLabel: string;
  gridAssignments?: GridTacticAssignment[];
  playersById?: Map<string, PlayerData>;
  comparePlayerId: string | null;
  hoveredSlot: string | null;
  onClearSelection: () => void;
  onFormationChange: (formation: string) => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null,
  ) => void;
  onDragEnd: () => void;
  onLineupPlayerClick: (playerId: string, section: SquadSection) => void;
  onSlotDragOver: (event: DragEvent<HTMLElement>, slotId: string) => void;
  onSlotDragLeave: (slotId: string) => void;
  onSlotDrop: (event: DragEvent<HTMLElement>, slotId: string) => void;
  outOfPositionCount: number;
  selectedPlayer: PlayerData | null;
  selectedPlayerId: string | null;
}

function getPitchPlayerButtonClassName(options: {
  dragState: DragState | null;
  comparePlayerId: string | null;
  hoveredSlot: string | null;
  player: PlayerData;
  selectedPlayerId: string | null;
  slotId: string;
  wrongPos: boolean;
}): string {
  const { dragState, comparePlayerId, hoveredSlot, player, selectedPlayerId, slotId, wrongPos } = options;
  const isComparing = player.id === comparePlayerId;
  const isHovered = hoveredSlot === slotId;
  const isSelected = player.id === selectedPlayerId;
  let className = "group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center border-0 bg-transparent p-0 text-center transition-all active:cursor-grabbing";

  if (dragState?.playerId === player.id) {
    className = `${className} opacity-70`;
  }

  if (isSelected) {
    return `${className} scale-105`;
  }

  if (isComparing || isHovered) {
    return `${className} scale-105`;
  }

  if (wrongPos) {
    return `${className} saturate-150`;
  }

  return className;
}

function getBenchPlayerButtonClassName(options: {
  dragState: DragState | null;
  comparePlayerId: string | null;
  player: PlayerData;
  selectedPlayerId: string | null;
}): string {
  const { dragState, comparePlayerId, player, selectedPlayerId } = options;
  const isActive = dragState?.playerId === player.id || comparePlayerId === player.id || selectedPlayerId === player.id;

  return `flex min-w-[56px] shrink-0 cursor-grab flex-1 flex-col items-center overflow-hidden rounded-lg border bg-[#1a202a] transition-colors active:cursor-grabbing ${
    isActive ? "border-app-green/50 ring-1 ring-app-green/30" : "border-app-border hover:border-[#3b4c66]"
  }`;
}

function getPlayerDisplayNumber(player: PlayerData, index: number): number {
  const raw = Number((player as PlayerData & { squad_number?: number | string; shirt_number?: number | string }).squad_number ?? (player as PlayerData & { shirt_number?: number | string }).shirt_number);
  return Number.isFinite(raw) && raw > 0 ? raw : index + 1;
}

function getRoleTone(wrongPos: boolean): string {
  return wrongPos ? "text-app-red" : "text-emerald-400";
}

// Duty arrow badge shown on the pitch node: Attack points up, Defend down,
// Support is a horizontal bar — mirrors FM-style duty indicators.
function getDutyBadge(duty: string): { symbol: string; className: string; title: string } {
  switch (duty) {
    case "Attack":
      return {
        symbol: "▲",
        className: "bg-red-500 text-white",
        title: "Attack duty",
      };
    case "Defend":
      return {
        symbol: "▼",
        className: "bg-sky-500 text-white",
        title: "Defend duty",
      };
    default:
      return {
        symbol: "▬",
        className: "bg-amber-500 text-black",
        title: "Support duty",
      };
  }
}

// Colour hint for how well the dragged player suits a slot's position.
function fitRingClassName(tone: SlotFitTone): string {
  switch (tone) {
    case "good":
      return "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]";
    case "ok":
      return "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]";
    default:
      return "ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]";
  }
}

function fitEmptySlotClassName(tone: SlotFitTone): string {
  switch (tone) {
    case "good":
      return "border-emerald-400 bg-emerald-400/15 text-emerald-300";
    case "ok":
      return "border-amber-400 bg-amber-400/15 text-amber-300";
    default:
      return "border-red-500 bg-red-500/15 text-red-300";
  }
}

export default function TacticsPitch({
  benchPlayers,
  dragState,
  formation,
  formationLabel = formation,
  mentalityLabel,
  teamShapeLabel,
  gridAssignments,
  playersById,
  comparePlayerId,
  hoveredSlot,
  onClearSelection,
  onFormationChange,
  onDragEnd,
  onDragStart,
  onLineupPlayerClick,
  onSlotDragLeave,
  onSlotDragOver,
  onSlotDrop,
  outOfPositionCount,
  selectedPlayer,
  selectedPlayerId,
}: TacticsPitchProps): JSX.Element {
  const { t } = useTranslation();
  const [showFormationPopover, setShowFormationPopover] = useState(false);
  // The player currently being dragged (from the pitch or the bench), used to
  // colour every slot by how well that player fits the position.
  const draggedPlayer = dragState?.playerId
    ? playersById?.get(dragState.playerId) ?? null
    : null;
  const assignedGridSlots = gridAssignments && playersById
    ? GRID_TACTIC_SLOTS.map((slot, index) => {
        const assignment = gridAssignments.find((candidate) => candidate.slotId === slot.id);
        const player = assignment?.playerId ? playersById.get(assignment.playerId) ?? null : null;
        const tacticalRole = assignment?.tacticalRole ?? TACTICAL_ROLE_OPTIONS[slot.role][0] ?? null;
        const duty = assignment?.duty ?? "Support";
        return {
          index,
          label: slot.label,
          duty,
          player,
          position: mapGridSlotToPosition(slot.id),
          slotId: slot.id,
          tacticalRole,
          x: slot.x,
          y: slot.y,
        };
      })
    : [];

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-xl border border-app-border bg-app-card">
      <div className="flex items-center justify-between border-b border-app-border/50 bg-white/[0.01] p-3">
        <div className="relative">
          <button
            type="button"
            data-testid="tactics-formation-dropdown"
            onClick={() => setShowFormationPopover((current) => !current)}
            className="flex items-center gap-2 rounded border border-app-border bg-app-bg px-3 py-1.5 text-[11px] font-bold uppercase text-app-text transition-colors hover:border-app-border/80 hover:bg-white/5"
          >
            <span>{formationLabel.toUpperCase()}</span>
            <ChevronDown className="h-3.5 w-3.5 text-app-text-muted" />
          </button>
          {showFormationPopover ? (
            <div className="absolute left-0 top-full z-30 mt-2 w-44 rounded-lg border border-app-border bg-app-card p-2 shadow-xl">
              {FORMATIONS.map((nextFormation) => (
                <button
                  key={nextFormation}
                  type="button"
                  data-testid={`tactics-formation-option-${nextFormation}`}
                  onClick={() => {
                    setShowFormationPopover(false);
                    onFormationChange(nextFormation);
                  }}
                  className={`w-full rounded px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${formation === nextFormation ? "bg-app-green/10 text-app-green" : "text-app-text-muted hover:bg-white/5 hover:text-white"}`}
                >
                  {nextFormation.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">MENTALITY</span>
            <div className="group flex items-center gap-1.5 transition-colors hover:text-white" title="Mentality is derived from the current play style and affects match-engine risk, tempo, and pressure.">
              <Target className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
              <span className="text-xs font-semibold">{mentalityLabel}</span>
              <ChevronDown className="h-3 w-3 text-app-text-muted" />
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">TEAM SHAPE</span>
            <div className="group flex items-center gap-1.5 transition-colors hover:text-white" title="Team Shape shows the active formation or custom shape currently represented by the pitch slots.">
              <LayoutGrid className="h-3.5 w-3.5 text-app-text-muted group-hover:text-white" />
              <span className="text-xs font-semibold">{teamShapeLabel}</span>
            </div>
          </div>
          {selectedPlayer ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[10px] font-bold uppercase tracking-wider text-app-green hover:text-primary-400"
            >
              {t("common.clear")}
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
            <linearGradient id="tacticsPitchGrass" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#244c38" />
              <stop offset="50%" stopColor="#1c3a2c" />
              <stop offset="100%" stopColor="#173025" />
            </linearGradient>
            <pattern id="tacticsPitchStripes" width="68" height="13.125" patternUnits="userSpaceOnUse">
              <rect width="68" height="6.5625" fill="rgba(255,255,255,0.035)" />
              <rect y="6.5625" width="68" height="6.5625" fill="rgba(0,0,0,0.035)" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#tacticsPitchGrass)" />
          <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#tacticsPitchStripes)" />
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

        {assignedGridSlots.map((slot) => {
          const player = slot.player;
          const wrongPos = player ? isPlayerOutOfPosition(player, slot.position) : false;
          // While dragging, rate this slot for the dragged player (skip the
          // node being dragged itself).
          const fitTone =
            draggedPlayer && draggedPlayer.id !== player?.id
              ? getSlotFitTone(draggedPlayer, slot.position)
              : null;

          return (
            <div
              key={slot.slotId}
              data-testid={`grid-slot-${slot.slotId}`}
              className="absolute h-[54px] w-[68px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onDragOver={(event) => onSlotDragOver(event, slot.slotId)}
              onDragLeave={() => onSlotDragLeave(slot.slotId)}
              onDrop={(event) => onSlotDrop(event, slot.slotId)}
            >
              {player ? (
                <button
                  type="button"
                  draggable
                  data-testid={`pitch-player-${player.id}`}
                  onClick={() => onLineupPlayerClick(player.id, "xi")}
                  onDragStart={(event) => onDragStart(event, player.id, "xi", slot.index)}
                  onDragEnd={onDragEnd}
                  className={getPitchPlayerButtonClassName({
                    dragState,
                    comparePlayerId,
                    hoveredSlot,
                    player,
                    selectedPlayerId,
                    slotId: slot.slotId,
                    wrongPos,
                  })}
                  style={{ left: "50%", top: "50%" }}
                >
                  <div className={`relative mb-1 flex h-8 w-8 items-center justify-center rounded-lg border-b-2 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110 ${wrongPos ? "border-amber-700 bg-gradient-to-b from-amber-400 to-amber-600" : "border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600"} ${fitTone ? fitRingClassName(fitTone) : ""}`}>
                    {getPlayerOvr(player)}
                    {(() => {
                      const dutyBadge = getDutyBadge(slot.duty);
                      return (
                        <span
                          title={dutyBadge.title}
                          className={`absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold leading-none shadow ${dutyBadge.className}`}
                        >
                          {dutyBadge.symbol}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="z-10 flex w-full flex-col items-center px-1 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                    <span className="w-full truncate whitespace-nowrap text-[9px] font-bold text-white">{player.match_name}</span>
                    <span className={`text-[8px] font-medium leading-tight ${getRoleTone(wrongPos)}`}>
                      {slot.label}{slot.tacticalRole ? ` (${slot.tacticalRole})` : ""} · {player.condition}%
                    </span>
                  </div>
                </button>
              ) : (
                <div className={`flex h-full w-full items-center justify-center rounded-lg border border-dashed text-center text-[9px] font-bold transition-colors ${fitTone ? fitEmptySlotClassName(fitTone) : hoveredSlot === slot.slotId ? "border-app-green bg-app-green/10 text-app-green" : "border-emerald-800/50 bg-black/10 text-white/50"}`}>
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
        <div className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
          {outOfPositionCount} {t("squad.outOfPosition")}
        </div>
        <button type="button" className="flex items-center gap-2 rounded border border-app-border bg-app-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5">
          <Zap className="h-3.5 w-3.5" />
          Quick Pick
        </button>
      </div>

      <div className="border-t border-app-border/50 p-3 pb-2">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {benchPlayers.slice(0, 7).map((player, index) => (
            <button
              key={player.id}
              type="button"
              draggable={!player.injury}
              data-testid={`pitch-bench-player-${player.id}`}
              onClick={() => onLineupPlayerClick(player.id, "bench")}
              onDragStart={(event) => {
                if (!player.injury) {
                  onDragStart(event, player.id, "bench", null);
                }
              }}
              onDragEnd={onDragEnd}
              className={getBenchPlayerButtonClassName({ dragState, comparePlayerId, player, selectedPlayerId })}
            >
              <div className="relative flex w-full justify-center pb-1 pt-2">
                <div className="absolute bottom-0 h-8 w-full bg-gradient-to-t from-red-500/20 to-transparent" />
                <div className="z-10 flex h-8 w-8 items-center justify-center rounded border border-red-500/50 bg-red-900/30 text-sm font-bold shadow-sm">
                  <span className="text-white drop-shadow-md">{getPlayerDisplayNumber(player, index + 12)}</span>
                </div>
              </div>
              <div className="z-10 flex w-full flex-col items-center px-1 pb-1">
                <span className="w-full truncate text-center text-[9px] font-bold">{player.match_name}</span>
                <span className="w-full truncate text-center text-[8px] text-app-text-muted">
                  {translatePositionAbbreviation(t, player.natural_position || player.position)}
                </span>
              </div>
              <div className="flex w-full justify-center border-t border-app-border/50 bg-black/20">
                <span className="py-0.5 font-mono text-[9px] font-bold text-app-text-muted">{getPlayerOvr(player)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="text-[9px] text-app-text-muted">
          <b>{Math.min(benchPlayers.length, 7)} / {benchPlayers.length}</b> {t("preMatch.substitutes")}
        </div>
      </div>
    </div>
  );
}
