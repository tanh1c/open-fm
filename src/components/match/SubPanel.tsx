import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CustomTacticSlotData, PlayerData, TeamData } from "../../store/gameStore";
import { getPlayerOvr, getPlayerOvrForPosition } from "../../lib/helpers";
import { MatchSnapshot, EnginePlayerData } from "./types";
import { getPlayerName } from "./helpers";
import { Badge } from "../ui";
import { AlertTriangle, Check, RefreshCw, UserMinus, UserPlus, X } from "lucide-react";
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
  GRID_TACTIC_SLOTS,
  mapGridSlotToPosition,
  TACTICAL_ROLE_OPTIONS,
  type GridTacticAssignment,
} from "../tactics/TacticsTab.helpers";

export function SubPanel({
  snapshot,
  side,
  teamData,
  squadPlayers,
  onSubstitute,
  onClose,
}: {
  snapshot: MatchSnapshot;
  side: "Home" | "Away";
  teamData?: TeamData;
  squadPlayers?: PlayerData[];
  onSubstitute: (offId: string, onId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedBench, setSelectedBench] = useState<string | null>(null);
  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  const bench = side === "Home" ? snapshot.home_bench : snapshot.away_bench;
  const subsMade = side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;
  const subbedOnIds = new Set(
    snapshot.substitutions
      .filter((substitution) => substitution.side === side)
      .map((substitution) => substitution.player_on_id),
  );
  const subbedOffIds = new Set(
    snapshot.substitutions
      .filter((substitution) => substitution.side === side)
      .map((substitution) => substitution.player_off_id),
  );
  const safeSquadPlayers = squadPlayers ?? [];
  const squadById = useMemo(() => new Map(safeSquadPlayers.map((player) => [player.id, player])), [safeSquadPlayers]);
  const livePlayers = useMemo(() => {
    return [...team.players, ...bench].map((player) => enginePlayerToPlayerData(player, squadById.get(player.id)));
  }, [bench, squadById, team.players]);
  const playersById = useMemo(() => new Map(livePlayers.map((player) => [player.id, player])), [livePlayers]);
  const availableBench = bench.filter(
    (player) => !subbedOffIds.has(player.id) && !subbedOnIds.has(player.id),
  );
  const availableBenchPlayers = availableBench.map((player) => playersById.get(player.id)).filter((player): player is PlayerData => player != null);
  const liveAssignments = useMemo(() => {
    return buildLiveGridAssignments({
      customSlots: teamData?.custom_tactic_slots,
      formation: team.formation,
      onPitchIds: team.players.filter((player) => !snapshot.sent_off.includes(player.id)).map((player) => player.id),
      availablePlayerIds: new Set(livePlayers.map((player) => player.id)),
    });
  }, [livePlayers, snapshot.sent_off, team.formation, team.players, teamData?.custom_tactic_slots]);
  const selectedAssignment = selectedSlotId
    ? liveAssignments.find((assignment) => assignment.slotId === selectedSlotId) ?? null
    : null;
  const selectedPlayer = selectedAssignment?.playerId ? playersById.get(selectedAssignment.playerId) ?? null : null;
  const comparedPlayer = selectedBench ? playersById.get(selectedBench) ?? null : null;
  const selectedSlotPosition = selectedSlotId ? mapGridSlotToPosition(selectedSlotId) : null;
  const derivedFormation = deriveFormationFromGridAssignments(liveAssignments);

  const condColor = (condition: number) =>
    condition >= 70 ? "bg-primary-500" : condition >= 40 ? "bg-yellow-500" : "bg-red-500";
  const condText = (condition: number) =>
    condition >= 70 ? "text-primary-400" : condition >= 40 ? "text-yellow-400" : "text-red-400";

  const handleClearSelection = () => {
    setSelectedSlotId(null);
    setSelectedBench(null);
  };

  const handleSelectSlot = (slotId: string) => {
    const assignment = liveAssignments.find((candidate) => candidate.slotId === slotId);
    if (!assignment?.playerId) return;

    setSelectedSlotId((currentSelectedSlotId) => {
      if (currentSelectedSlotId === slotId) {
        setSelectedBench(null);
        return null;
      }

      setSelectedBench(null);
      return slotId;
    });
  };

  const handleSelectBenchPlayer = (playerId: string) => {
    if (!selectedPlayer) return;
    setSelectedBench((currentSelectedBench) => currentSelectedBench === playerId ? null : playerId);
  };

  const handleConfirmSubstitution = () => {
    if (!selectedPlayer || !selectedBench) return;
    onSubstitute(selectedPlayer.id, selectedBench);
  };

  const handleInteractiveRowKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      event.currentTarget.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  };

  const CompareBar = ({ label, valA, valB }: { label: string; valA: number; valB: number }) => {
    const diff = valB - valA;
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs">
        <span className="w-8 text-right font-heading text-app-text-muted">{label}</span>
        <span className="w-6 text-right tabular-nums text-red-400">{valA}</span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-app-bg">
          <div className="h-full bg-red-500/60" style={{ width: `${valA}%` }} />
        </div>
        <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-app-bg">
          <div className="h-full bg-green-500/60" style={{ width: `${valB}%` }} />
        </div>
        <span className="w-6 tabular-nums text-green-400">{valB}</span>
        <span className={`w-7 text-right font-heading font-bold tabular-nums ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-app-text-muted"}`}>
          {diff > 0 ? "+" : ""}{diff}
        </span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] w-[1180px] max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border bg-app-bg/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-green/30 bg-app-green/10 text-app-green">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-black uppercase tracking-widest text-app-text">
                {t("match.substitutionsTitle")}
              </h3>
              <p className="text-xs text-app-text-muted">
                {team.name} · {derivedFormation} · {t("match.subsUsed", { used: subsMade, max: snapshot.max_subs })}
              </p>
            </div>
            <Badge variant={subsMade >= snapshot.max_subs ? "danger" : "primary"} size="sm">
              {subsMade}/{snapshot.max_subs}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {subsMade >= snapshot.max_subs ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-8">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-yellow-400">
                {t("match.allSubsUsed")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] overflow-hidden">
            <div className="flex min-h-0 flex-col border-r border-app-border">
              <div className="border-b border-app-border bg-white/[0.02] px-4 py-3">
                <p className="font-heading text-xs font-bold uppercase tracking-widest text-red-400">
                  {selectedPlayer
                    ? t("match.takingOff", { name: selectedPlayer.match_name })
                    : t("match.selectPlayerOff")}
                </p>
              </div>

              <TacticsSubPitch
                assignments={liveAssignments}
                playersById={playersById}
                selectedBenchPlayer={comparedPlayer}
                selectedSlotId={selectedSlotId}
                onSelectSlot={handleSelectSlot}
              />

              <div className="min-h-0 flex-1 overflow-auto px-4 py-3 custom-scrollbar">
                <OnPitchTable
                  assignments={liveAssignments}
                  playersById={playersById}
                  selectedSlotId={selectedSlotId}
                  subbedOnIds={subbedOnIds}
                  condColor={condColor}
                  condText={condText}
                  onSelectSlot={handleSelectSlot}
                  onKeyDown={handleInteractiveRowKeyDown}
                  t={t}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="border-b border-app-border bg-white/[0.02] px-4 py-3">
                <p className="font-heading text-xs font-bold uppercase tracking-widest text-green-400">
                  {selectedPlayer ? t("match.selectReplacement") : t("match.benchPlayers")}
                </p>
              </div>

              {selectedPlayer && comparedPlayer && selectedSlotPosition ? (
                <div className="mx-4 mt-3 rounded-xl border border-app-border bg-app-bg/80 p-3 shadow-inner shadow-black/20">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserMinus className="h-3 w-3 text-red-400" />
                      <span className="max-w-[120px] truncate text-[10px] font-heading font-bold text-red-300">
                        {selectedPlayer.match_name}
                      </span>
                    </div>
                    <span className="font-heading text-[9px] uppercase text-app-text-muted">
                      {getPlayerOvrForPosition(selectedPlayer, selectedSlotPosition)} → {getPlayerOvrForPosition(comparedPlayer, selectedSlotPosition)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-[120px] truncate text-[10px] font-heading font-bold text-green-300">
                        {comparedPlayer.match_name}
                      </span>
                      <UserPlus className="h-3 w-3 text-green-400" />
                    </div>
                  </div>
                  <CompareBar label="PAC" valA={selectedPlayer.attributes.pace} valB={comparedPlayer.attributes.pace} />
                  <CompareBar label="PAS" valA={selectedPlayer.attributes.passing} valB={comparedPlayer.attributes.passing} />
                  <CompareBar label="SHO" valA={selectedPlayer.attributes.shooting} valB={comparedPlayer.attributes.shooting} />
                  <CompareBar label="DRI" valA={selectedPlayer.attributes.dribbling} valB={comparedPlayer.attributes.dribbling} />
                  <CompareBar label="DEF" valA={selectedPlayer.attributes.defending} valB={comparedPlayer.attributes.defending} />
                  <CompareBar label="TAC" valA={selectedPlayer.attributes.tackling} valB={comparedPlayer.attributes.tackling} />
                  <CompareBar label="FIT" valA={Math.round(selectedPlayer.condition)} valB={Math.round(comparedPlayer.condition)} />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="rounded-lg border border-app-border px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSubstitution}
                      className="flex items-center gap-2 rounded-lg bg-app-green px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider text-app-bg transition-colors hover:bg-app-green/90"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("match.confirmSubstitution")}
                    </button>
                  </div>
                </div>
              ) : selectedPlayer ? (
                <div className="mx-4 mt-3 rounded-xl border border-app-border bg-app-bg/70 p-4 text-center">
                  <p className="font-heading text-xs uppercase tracking-wider text-app-text-muted">
                    {t("match.selectBenchToCompare")}
                  </p>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-auto px-4 py-3 custom-scrollbar">
                {availableBenchPlayers.length === 0 ? (
                  <div className="flex h-20 items-center justify-center text-xs text-app-text-muted">
                    {t("match.noBenchAvailable")}
                  </div>
                ) : (
                  <BenchTable
                    players={availableBenchPlayers}
                    selectedId={selectedBench}
                    selectedSlotPosition={selectedSlotPosition}
                    selectedPlayer={selectedPlayer}
                    condColor={condColor}
                    condText={condText}
                    onSelect={handleSelectBenchPlayer}
                    onKeyDown={handleInteractiveRowKeyDown}
                    t={t}
                  />
                )}
              </div>

              {snapshot.substitutions.filter((substitution) => substitution.side === side).length > 0 && (
                <div className="border-t border-app-border px-4 py-3">
                  <p className="mb-1.5 font-heading text-[10px] uppercase tracking-widest text-app-text-muted">
                    {t("match.history")}
                  </p>
                  {snapshot.substitutions
                    .filter((substitution) => substitution.side === side)
                    .map((substitution, index) => (
                      <div key={index} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                        <span className="w-5 text-right font-heading tabular-nums text-app-text-muted">
                          {substitution.minute}'
                        </span>
                        <span className="text-green-400">▲</span>
                        <span className="truncate text-app-text">
                          {getPlayerName(snapshot, substitution.player_on_id)}
                        </span>
                        <span className="text-red-400">▼</span>
                        <span className="truncate text-app-text-muted">
                          {getPlayerName(snapshot, substitution.player_off_id)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildLiveGridAssignments({
  customSlots,
  formation,
  onPitchIds,
  availablePlayerIds,
}: {
  customSlots: CustomTacticSlotData[] | undefined;
  formation: string;
  onPitchIds: string[];
  availablePlayerIds: Set<string>;
}): GridTacticAssignment[] {
  const fallback = buildGridAssignmentsFromFormation(formation, onPitchIds);
  const saved = buildGridAssignmentsFromSavedSlots(customSlots, fallback, availablePlayerIds);
  const onPitchIdSet = new Set(onPitchIds);
  const assignedIds = new Set(saved.map((assignment) => assignment.playerId).filter((id): id is string => id != null));
  const missingIds = onPitchIds.filter((id) => !assignedIds.has(id));
  let missingIndex = 0;

  return saved.map((assignment) => {
    if (assignment.playerId && onPitchIdSet.has(assignment.playerId)) return assignment;
    const playerId = missingIds[missingIndex++];
    return {
      ...assignment,
      playerId: playerId ?? null,
    };
  });
}

function TacticsSubPitch({
  assignments,
  playersById,
  selectedBenchPlayer,
  selectedSlotId,
  onSelectSlot,
}: {
  assignments: GridTacticAssignment[];
  playersById: Map<string, PlayerData>;
  selectedBenchPlayer: PlayerData | null;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  return (
    <div className="mx-4 mt-4 rounded-xl border border-emerald-900/50 bg-[#1a2e25] p-3 shadow-inner shadow-black/30">
      <div className="relative flex aspect-[3/4] max-h-[360px] min-h-[300px] w-full overflow-hidden rounded-xl border-2 border-emerald-900/50 bg-[#1a2e25] shadow-inner">
        <PitchLines />
        {GRID_TACTIC_SLOTS.map((slot) => {
          const assignment = assignments.find((candidate) => candidate.slotId === slot.id);
          const player = assignment?.playerId ? playersById.get(assignment.playerId) ?? null : null;
          const position = mapGridSlotToPosition(slot.id);
          const isSelected = selectedSlotId === slot.id;
          const wrongPosition = player ? isPlayerOutOfPosition(player, position) : false;
          const fitTone = selectedBenchPlayer ? getSlotFitTone(selectedBenchPlayer, position) : null;
          const duty = assignment?.duty ?? "Support";
          const dutyBadge = getDutyBadge(duty);
          const tacticalRole = assignment?.tacticalRole ?? TACTICAL_ROLE_OPTIONS[slot.role][0] ?? null;

          return (
            <button
              key={slot.id}
              type="button"
              data-testid={`sub-grid-slot-${slot.id}`}
              onClick={() => onSelectSlot(slot.id)}
              className={`group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-0 bg-transparent p-0 text-center transition-all hover:scale-105 ${isSelected ? "scale-110" : ""} ${player ? "cursor-pointer" : "cursor-default opacity-40"}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <div className={`relative mb-1 flex h-8 w-8 items-center justify-center rounded-lg border-b-2 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110 ${wrongPosition ? "border-amber-700 bg-gradient-to-b from-amber-400 to-amber-600" : "border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600"} ${isSelected ? "ring-2 ring-red-400" : fitTone ? fitRingClassName(fitTone) : ""}`}>
                {player ? getPlayerOvrForPosition(player, position) : ""}
                {player ? <span title={dutyBadge.title} className={`absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold leading-none shadow ${dutyBadge.className}`}>{dutyBadge.symbol}</span> : null}
              </div>
              <div className="z-10 flex w-full flex-col items-center px-1 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                <span className="w-full truncate whitespace-nowrap text-[9px] font-bold text-white">{player?.match_name ?? slot.label}</span>
                <span className={`text-[8px] font-medium leading-tight ${wrongPosition ? "text-app-red" : "text-emerald-400"}`}>{slot.label}{tacticalRole ? ` (${tacticalRole})` : ""}{player ? ` · ${Math.round(player.condition)}%` : ""}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full rounded-xl" viewBox="0 0 68 105" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="subPitchGrass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#244c38" />
          <stop offset="50%" stopColor="#1c3a2c" />
          <stop offset="100%" stopColor="#173025" />
        </linearGradient>
        <pattern id="subPitchStripes" width="68" height="13.125" patternUnits="userSpaceOnUse">
          <rect width="68" height="6.5625" fill="rgba(255,255,255,0.035)" />
          <rect y="6.5625" width="68" height="6.5625" fill="rgba(0,0,0,0.035)" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#subPitchGrass)" />
      <rect x="0" y="0" width="68" height="105" rx="1.5" fill="url(#subPitchStripes)" />
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
  );
}

function OnPitchTable({
  assignments,
  playersById,
  selectedSlotId,
  subbedOnIds,
  condColor,
  condText,
  onSelectSlot,
  onKeyDown,
  t,
}: {
  assignments: GridTacticAssignment[];
  playersById: Map<string, PlayerData>;
  selectedSlotId: string | null;
  subbedOnIds: Set<string>;
  condColor: (condition: number) => string;
  condText: (condition: number) => string;
  onSelectSlot: (slotId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const rows = assignments
    .map((assignment) => ({ assignment, slot: GRID_TACTIC_SLOTS.find((candidate) => candidate.id === assignment.slotId) }))
    .filter((row): row is { assignment: GridTacticAssignment; slot: NonNullable<typeof row.slot> } => row.slot != null && row.assignment.playerId != null)
    .map(({ assignment, slot }) => ({ assignment, slot, player: playersById.get(assignment.playerId as string) }))
    .filter((row): row is { assignment: GridTacticAssignment; slot: NonNullable<typeof row.slot>; player: PlayerData } => row.player != null);

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-app-border font-heading text-[10px] uppercase tracking-widest text-app-text-muted">
          <th className="py-2 pr-2">{t("match.player")}</th>
          <th className="w-12 py-2 text-center">{t("common.position")}</th>
          <th className="w-12 py-2 text-center">{t("common.ovr")}</th>
          <th className="w-24 py-2">{t("match.fitness")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ slot, player }) => {
          const position = mapGridSlotToPosition(slot.id);
          const isSelected = selectedSlotId === slot.id;
          const isSubOn = subbedOnIds.has(player.id);
          const wrongPosition = isPlayerOutOfPosition(player, position);
          const row = (
            <tr
              key={slot.id}
              data-testid={`sub-panel-off-${player.id}`}
              onClick={() => onSelectSlot(slot.id)}
              onKeyDown={(event) => onKeyDown(event, () => onSelectSlot(slot.id))}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              className={`cursor-pointer text-sm transition-colors ${isSelected ? "bg-red-500/10 text-red-300" : "hover:bg-white/5"}`}
            >
              <td className="py-2 pr-2">
                <div className="flex items-center gap-1.5">
                  {isSelected ? <UserMinus className="h-3.5 w-3.5 shrink-0 text-red-400" /> : null}
                  {isSubOn ? <span className="text-[10px] text-green-400">▲</span> : null}
                  <span className="truncate font-medium text-app-text">{player.match_name}</span>
                </div>
              </td>
              <td className="w-12 py-2 text-center">
                <span className={`font-heading text-xs ${wrongPosition ? "text-yellow-400" : "text-app-text-muted"}`}>
                  {translatePositionAbbreviation(t, position)}{wrongPosition ? " !" : ""}
                </span>
              </td>
              <td className="w-12 py-2 text-center font-heading font-bold text-app-text-muted">{getPlayerOvrForPosition(player, position)}</td>
              <td className="w-24 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-app-bg">
                    <div className={`h-full rounded-full ${condColor(player.condition)}`} style={{ width: `${player.condition}%` }} />
                  </div>
                  <span className={`w-7 text-right font-heading text-xs tabular-nums ${condText(player.condition)}`}>
                    {Math.round(player.condition)}
                  </span>
                </div>
              </td>
            </tr>
          );

          return (
            <ContextMenu key={slot.id} items={[{ label: isSelected ? t("common.cancel") : t("match.selectToTakeOff"), icon: <UserMinus className="h-4 w-4" />, onClick: () => onSelectSlot(slot.id) }]}>
              {row}
            </ContextMenu>
          );
        })}
      </tbody>
    </table>
  );
}

function BenchTable({
  players,
  selectedId,
  selectedSlotPosition,
  selectedPlayer,
  condColor,
  condText,
  onSelect,
  onKeyDown,
  t,
}: {
  players: PlayerData[];
  selectedId: string | null;
  selectedSlotPosition: string | null;
  selectedPlayer: PlayerData | null;
  condColor: (condition: number) => string;
  condText: (condition: number) => string;
  onSelect: (playerId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const sortedPlayers = [...players].sort((left, right) => {
    if (!selectedSlotPosition) return getPlayerOvr(right) - getPlayerOvr(left);
    return (
      fitToneRank(getSlotFitTone(right, selectedSlotPosition)) - fitToneRank(getSlotFitTone(left, selectedSlotPosition)) ||
      getPlayerOvrForPosition(right, selectedSlotPosition) - getPlayerOvrForPosition(left, selectedSlotPosition) ||
      right.condition - left.condition
    );
  });

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-app-border font-heading text-[10px] uppercase tracking-widest text-app-text-muted">
          <th className="py-2 pr-2">{t("match.player")}</th>
          <th className="w-12 py-2 text-center">{t("common.position")}</th>
          <th className="w-12 py-2 text-center">{t("common.ovr")}</th>
          <th className="w-24 py-2">{t("match.fitness")}</th>
        </tr>
      </thead>
      <tbody>
        {sortedPlayers.map((player) => {
          const isSelected = selectedId === player.id;
          const fitTone = selectedSlotPosition ? getSlotFitTone(player, selectedSlotPosition) : null;
          const displayOvr = selectedSlotPosition ? getPlayerOvrForPosition(player, selectedSlotPosition) : getPlayerOvr(player);
          const row = (
            <tr
              key={player.id}
              data-testid={`sub-panel-bench-${player.id}`}
              onClick={() => onSelect(player.id)}
              onKeyDown={(event) => onKeyDown(event, () => onSelect(player.id))}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-disabled={!selectedPlayer}
              className={`cursor-pointer text-sm transition-colors ${isSelected ? "bg-green-500/15 text-green-300 ring-1 ring-green-500/30" : !selectedPlayer ? "opacity-60" : "hover:bg-white/5"}`}
            >
              <td className="py-2 pr-2">
                <div className="flex items-center gap-1.5">
                  {selectedPlayer ? <UserPlus className="h-3.5 w-3.5 shrink-0 text-green-400/70" /> : null}
                  <span className="truncate font-medium text-app-text">{player.match_name}</span>
                </div>
              </td>
              <td className="w-12 py-2 text-center">
                <span className={`font-heading text-xs ${fitTone === "bad" ? "text-red-400" : fitTone === "ok" ? "text-yellow-400" : "text-app-text-muted"}`}>
                  {translatePositionAbbreviation(t, selectedSlotPosition ?? (player.natural_position || player.position))}{fitTone === "bad" ? " !" : ""}
                </span>
              </td>
              <td className="w-12 py-2 text-center font-heading font-bold text-app-text-muted">{displayOvr}</td>
              <td className="w-24 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-app-bg">
                    <div className={`h-full rounded-full ${condColor(player.condition)}`} style={{ width: `${player.condition}%` }} />
                  </div>
                  <span className={`w-7 text-right font-heading text-xs tabular-nums ${condText(player.condition)}`}>
                    {Math.round(player.condition)}
                  </span>
                </div>
              </td>
            </tr>
          );

          return (
            <ContextMenu
              key={player.id}
              items={selectedPlayer
                ? [{ label: isSelected ? t("match.clearReplacementSelection") : t("match.selectReplacementMenu"), icon: <UserPlus className="h-4 w-4" />, onClick: () => onSelect(player.id) }]
                : [{ label: t("match.selectPlayerToTakeOffFirst"), icon: <UserPlus className="h-4 w-4" />, onClick: () => {}, disabled: true }]}
            >
              {row}
            </ContextMenu>
          );
        })}
      </tbody>
    </table>
  );
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
      ovr: fallback.ovr ?? enginePlayer.ovr,
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

function fitRingClassName(tone: SlotFitTone): string {
  if (tone === "good") return "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]";
  if (tone === "ok") return "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]";
  return "ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]";
}

function fitToneRank(tone: SlotFitTone): number {
  if (tone === "good") return 2;
  if (tone === "ok") return 1;
  return 0;
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
