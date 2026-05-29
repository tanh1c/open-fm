import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { MatchSnapshot, EnginePlayerData } from "./types";
import { getPlayerName } from "./helpers";
import { Badge } from "../ui";
import { AlertTriangle, Check, RefreshCw, UserMinus, UserPlus, X } from "lucide-react";
import ContextMenu from "../ContextMenu";
import {
  buildPitchRows,
  getPitchSlotWidth,
  translatePositionAbbreviation,
} from "../squad/SquadTab.helpers";

export function SubPanel({
  snapshot,
  side,
  onSubstitute,
  onClose,
}: {
  snapshot: MatchSnapshot;
  side: "Home" | "Away";
  onSubstitute: (offId: string, onId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedOff, setSelectedOff] = useState<string | null>(null);
  const [selectedBench, setSelectedBench] = useState<string | null>(null);
  const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
  const bench = side === "Home" ? snapshot.home_bench : snapshot.away_bench;
  const subsMade =
    side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;
  const subbedOnIds = new Set(
    snapshot.substitutions
      .filter((s) => s.side === side)
      .map((s) => s.player_on_id),
  );
  const subbedOffIds = new Set(
    snapshot.substitutions
      .filter((s) => s.side === side)
      .map((s) => s.player_off_id),
  );
  const availableBench = bench.filter(
    (p) => !subbedOffIds.has(p.id) && !subbedOnIds.has(p.id),
  );
  const selectedPlayer = selectedOff
    ? team.players.find((p) => p.id === selectedOff) ?? null
    : null;
  const comparedPlayer = selectedBench
    ? availableBench.find((p) => p.id === selectedBench) ?? null
    : null;

  const condColor = (c: number) =>
    c >= 70 ? "bg-primary-500" : c >= 40 ? "bg-yellow-500" : "bg-red-500";
  const condText = (c: number) =>
    c >= 70 ? "text-primary-400" : c >= 40 ? "text-yellow-400" : "text-red-400";

  const handleClearSelection = () => {
    setSelectedOff(null);
    setSelectedBench(null);
  };

  const handleSelectOffPlayer = (playerId: string) => {
    setSelectedOff((currentSelectedOff) => {
      if (currentSelectedOff === playerId) {
        setSelectedBench(null);
        return null;
      }

      setSelectedBench(null);
      return playerId;
    });
  };

  const handleSelectBenchPlayer = (playerId: string) => {
    if (!selectedOff) {
      return;
    }

    setSelectedBench((currentSelectedBench) => {
      return currentSelectedBench === playerId ? null : playerId;
    });
  };

  const handleConfirmSubstitution = () => {
    if (!selectedOff || !selectedBench) {
      return;
    }

    onSubstitute(selectedOff, selectedBench);
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

  const CompareBar = ({
    label,
    valA,
    valB,
  }: {
    label: string;
    valA: number;
    valB: number;
  }) => {
    const diff = valB - valA;
    return (
      <div className="flex items-center gap-2 text-xs py-0.5">
        <span className="w-8 text-right text-app-text-muted font-heading">
          {label}
        </span>
        <span className="w-6 text-right tabular-nums text-red-400">{valA}</span>
        <div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden flex">
          <div className="h-full bg-red-500/60" style={{ width: `${valA}%` }} />
        </div>
        <div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden flex justify-end">
          <div
            className="h-full bg-green-500/60"
            style={{ width: `${valB}%` }}
          />
        </div>
        <span className="w-6 tabular-nums text-green-400">{valB}</span>
        <span
          className={`w-7 text-right tabular-nums font-heading font-bold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-app-text-muted"}`}
        >
          {diff > 0 ? "+" : ""}
          {diff}
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
        onClick={(e) => e.stopPropagation()}
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
                {team.name} · {team.formation} · {t("match.subsUsed", { used: subsMade, max: snapshot.max_subs })}
              </p>
            </div>
            <Badge
              variant={subsMade >= snapshot.max_subs ? "danger" : "primary"}
              size="sm"
            >
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
              <p className="text-sm font-heading font-bold uppercase tracking-wider text-yellow-400">
                {t("match.allSubsUsed")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] overflow-hidden">
            <div className="flex min-h-0 flex-col border-r border-app-border">
              <div className="border-b border-app-border bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-red-400">
                  {selectedOff
                    ? t("match.takingOff", { name: selectedPlayer?.name })
                    : t("match.selectPlayerOff")}
                </p>
              </div>

              <FormationPitch
                players={team.players.filter((p) => !snapshot.sent_off.includes(p.id))}
                formation={team.formation}
                selectedOff={selectedOff}
                onSelect={handleSelectOffPlayer}
                t={t}
              />

              <div className="min-h-0 flex-1 overflow-auto px-4 py-3 custom-scrollbar">
                <PlayerTable
                  players={team.players
                    .filter((p) => !snapshot.sent_off.includes(p.id))
                    .sort((a, b) => positionOrder(a.position) - positionOrder(b.position) || a.name.localeCompare(b.name))}
                  selectedId={selectedOff}
                  subbedOnIds={subbedOnIds}
                  condColor={condColor}
                  condText={condText}
                  onSelect={handleSelectOffPlayer}
                  onKeyDown={handleInteractiveRowKeyDown}
                  mode="off"
                  selectedPlayer={selectedPlayer}
                  t={t}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="border-b border-app-border bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-green-400">
                  {selectedOff
                    ? t("match.selectReplacement")
                    : t("match.benchPlayers")}
                </p>
              </div>

              {selectedPlayer && comparedPlayer ? (
                <div className="mx-4 mt-3 rounded-xl border border-app-border bg-app-bg/80 p-3 shadow-inner shadow-black/20">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserMinus className="h-3 w-3 text-red-400" />
                      <span className="max-w-[120px] truncate text-[10px] font-heading font-bold text-red-300">
                        {selectedPlayer.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-heading uppercase text-app-text-muted">
                      {t("common.vs")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-[120px] truncate text-[10px] font-heading font-bold text-green-300">
                        {comparedPlayer.name}
                      </span>
                      <UserPlus className="h-3 w-3 text-green-400" />
                    </div>
                  </div>
                  <CompareBar label="PAC" valA={selectedPlayer.pace} valB={comparedPlayer.pace} />
                  <CompareBar label="PAS" valA={selectedPlayer.passing} valB={comparedPlayer.passing} />
                  <CompareBar label="SHO" valA={selectedPlayer.shooting} valB={comparedPlayer.shooting} />
                  <CompareBar label="DRI" valA={selectedPlayer.dribbling} valB={comparedPlayer.dribbling} />
                  <CompareBar label="DEF" valA={selectedPlayer.defending} valB={comparedPlayer.defending} />
                  <CompareBar label="TAC" valA={selectedPlayer.tackling} valB={comparedPlayer.tackling} />
                  <CompareBar label="FIT" valA={Math.round(selectedPlayer.condition)} valB={Math.round(comparedPlayer.condition)} />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="rounded-lg border border-app-border px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSubstitution}
                      className="flex items-center gap-2 rounded-lg bg-app-green px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-app-bg transition-colors hover:bg-app-green/90"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("match.confirmSubstitution")}
                    </button>
                  </div>
                </div>
              ) : selectedPlayer ? (
                <div className="mx-4 mt-3 rounded-xl border border-app-border bg-app-bg/70 p-4 text-center">
                  <p className="text-xs font-heading uppercase tracking-wider text-app-text-muted">
                    {t("match.selectBenchToCompare")}
                  </p>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-auto px-4 py-3 custom-scrollbar">
                {availableBench.length === 0 ? (
                  <div className="flex h-20 items-center justify-center text-xs text-app-text-muted">
                    {t("match.noBenchAvailable")}
                  </div>
                ) : (
                  <PlayerTable
                    players={availableBench}
                    selectedId={selectedBench}
                    subbedOnIds={new Set<string>()}
                    condColor={condColor}
                    condText={condText}
                    onSelect={handleSelectBenchPlayer}
                    onKeyDown={handleInteractiveRowKeyDown}
                    mode="bench"
                    selectedPlayer={selectedPlayer}
                    t={t}
                  />
                )}
              </div>

              {snapshot.substitutions.filter((s) => s.side === side).length > 0 && (
                <div className="border-t border-app-border px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-heading uppercase tracking-widest text-app-text-muted">
                    {t("match.history")}
                  </p>
                  {snapshot.substitutions
                    .filter((s) => s.side === side)
                    .map((sub, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                        <span className="w-5 text-right font-heading tabular-nums text-app-text-muted">
                          {sub.minute}'
                        </span>
                        <span className="text-green-400">▲</span>
                        <span className="truncate text-app-text">
                          {getPlayerName(snapshot, sub.player_on_id)}
                        </span>
                        <span className="text-red-400">▼</span>
                        <span className="truncate text-app-text-muted">
                          {getPlayerName(snapshot, sub.player_off_id)}
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

function FormationPitch({
  players,
  formation,
  selectedOff,
  onSelect,
  t,
}: {
  players: EnginePlayerData[];
  formation: string;
  selectedOff: string | null;
  onSelect: (playerId: string) => void;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const rows = buildPitchRows(formation);
  const usedPlayerIds = new Set<string>();

  return (
    <div className="mx-4 mt-4 rounded-xl border border-emerald-900/50 bg-[#1a2e25] p-3 shadow-inner shadow-black/30">
      <div className="relative flex aspect-[3/4] max-h-[360px] min-h-[300px] w-full overflow-hidden rounded-xl border-2 border-emerald-900/50 bg-[#1a2e25] shadow-inner">
        <SquadPitchLines />
        {rows.flatMap((row) => {
          const rowPlayers = row.positions.map((slotPosition) => {
            const exactPlayer = players.find(
              (player) => !usedPlayerIds.has(player.id) && player.position === canonicalEnginePosition(slotPosition),
            );
            const fallbackPlayer = players.find((player) => !usedPlayerIds.has(player.id));
            const player = exactPlayer ?? fallbackPlayer ?? null;
            if (player) usedPlayerIds.add(player.id);
            return { player, slotPosition };
          });

          return rowPlayers.map(({ player, slotPosition }, index) => {
            const slotCount = rowPlayers.length;
            const isSelected = player ? selectedOff === player.id : false;
            const x = horizontalPitchPosition(index, slotCount);
            const width = getPitchSlotWidth(slotCount);
            const label = translatePositionAbbreviation(t, slotPosition);

            return (
              <button
                key={`${row.label}-${index}-${player?.id ?? slotPosition}`}
                type="button"
                onClick={() => player ? onSelect(player.id) : undefined}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center transition-all hover:scale-110 ${isSelected ? "scale-110" : ""}`}
                style={{ left: `${x}%`, top: row.y, width }}
              >
                <div className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-lg ring-1 ring-white/10 ${isSelected ? "bg-red-500 text-white" : slotPosition === "Goalkeeper" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}`}>
                  {player ? player.ovr : ""}
                </div>
                <div className="w-[120%] bg-transparent px-1 py-0.5 text-center pointer-events-none">
                  <span className="block w-full truncate text-[8px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {player?.name ?? label}
                  </span>
                  <span className="mt-[1px] block whitespace-nowrap text-[7.5px] font-medium leading-none text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {roleCode(slotPosition)}
                  </span>
                </div>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}

function SquadPitchLines() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-emerald-900/50" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-900/50" />
      <div className="absolute left-1/2 top-0 flex h-16 w-32 -translate-x-1/2 justify-center border-2 border-t-0 border-emerald-900/50">
        <div className="h-6 w-12 border-2 border-t-0 border-emerald-900/50" />
      </div>
      <div className="absolute bottom-0 left-1/2 flex h-16 w-32 -translate-x-1/2 items-end justify-center border-2 border-b-0 border-emerald-900/50">
        <div className="h-6 w-12 border-2 border-b-0 border-emerald-900/50" />
      </div>
    </div>
  );
}

function horizontalPitchPosition(index: number, count: number): number {
  if (count <= 1) return 50;
  const width = count >= 5 ? 82 : count === 4 ? 76 : count === 3 ? 62 : 44;
  const start = 50 - width / 2;
  return start + (width / (count - 1)) * index;
}

function canonicalEnginePosition(slotPosition: string): string {
  if (slotPosition === "Goalkeeper") return "Goalkeeper";
  if (["LeftBack", "CenterBack", "RightBack", "LeftWingBack", "RightWingBack"].includes(slotPosition)) return "Defender";
  if (["Striker", "LeftWinger", "RightWinger"].includes(slotPosition)) return "Forward";
  return "Midfielder";
}

function roleCode(position: string): string {
  if (position === "Goalkeeper") return "SK · De";
  if (["LeftBack", "CenterBack", "RightBack", "LeftWingBack", "RightWingBack"].includes(position)) return "BPD · De";
  if (["Striker", "LeftWinger", "RightWinger"].includes(position)) return "AF · At";
  return "DLP · Su";
}

function PlayerTable({
  players,
  selectedId,
  subbedOnIds,
  condColor,
  condText,
  onSelect,
  onKeyDown,
  mode,
  selectedPlayer,
  t,
}: {
  players: EnginePlayerData[];
  selectedId: string | null;
  subbedOnIds: Set<string>;
  condColor: (condition: number) => string;
  condText: (condition: number) => string;
  onSelect: (playerId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, action: () => void) => void;
  mode: "off" | "bench";
  selectedPlayer: EnginePlayerData | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-app-border text-[10px] font-heading uppercase tracking-widest text-app-text-muted">
          <th className="py-2 pr-2">{t("match.player")}</th>
          <th className="py-2 w-12 text-center">{t("common.position")}</th>
          <th className="py-2 w-12 text-center">{t("common.ovr")}</th>
          <th className="py-2 w-24">{t("match.fitness")}</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => {
          const isSelected = selectedId === player.id;
          const isSubOn = subbedOnIds.has(player.id);
          const posMatch = mode === "bench" && selectedPlayer ? player.position === selectedPlayer.position : true;
          const row = (
            <tr
              key={player.id}
              data-testid={mode === "off" ? `sub-panel-off-${player.id}` : `sub-panel-bench-${player.id}`}
              onClick={() => onSelect(player.id)}
              onKeyDown={(event) => onKeyDown(event, () => onSelect(player.id))}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-disabled={mode === "bench" && !selectedPlayer}
              className={`cursor-pointer text-sm transition-colors ${
                isSelected
                  ? mode === "off"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-green-500/15 text-green-300 ring-1 ring-green-500/30"
                  : mode === "bench" && !selectedPlayer
                    ? "opacity-60"
                    : "hover:bg-white/5"
              }`}
            >
              <td className="py-2 pr-2">
                <div className="flex items-center gap-1.5">
                  {isSelected && mode === "off" ? <UserMinus className="h-3.5 w-3.5 shrink-0 text-red-400" /> : null}
                  {mode === "bench" && selectedPlayer ? <UserPlus className="h-3.5 w-3.5 shrink-0 text-green-400/70" /> : null}
                  {isSubOn ? <span className="text-[10px] text-green-400">▲</span> : null}
                  <span className="truncate font-medium text-app-text">{player.name}</span>
                </div>
              </td>
              <td className="py-2 w-12 text-center">
                <span className={`text-xs font-heading ${!posMatch ? "text-yellow-400" : "text-app-text-muted"}`}>
                  {translatePositionAbbreviation(t, player.position)}
                  {!posMatch ? " !" : ""}
                </span>
              </td>
              <td className="py-2 w-12 text-center font-heading font-bold text-app-text-muted">{player.ovr}</td>
              <td className="py-2 w-24">
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
              items={
                mode === "off"
                  ? [
                    {
                      label: isSelected ? t("common.cancel") : t("match.selectToTakeOff"),
                      icon: <UserMinus className="w-4 h-4" />,
                      onClick: () => onSelect(player.id),
                    },
                  ]
                  : selectedPlayer
                    ? [
                      {
                        label: isSelected ? t("match.clearReplacementSelection") : t("match.selectReplacementMenu"),
                        icon: <UserPlus className="w-4 h-4" />,
                        onClick: () => onSelect(player.id),
                      },
                    ]
                    : [
                      {
                        label: t("match.selectPlayerToTakeOffFirst"),
                        icon: <UserPlus className="w-4 h-4" />,
                        onClick: () => { },
                        disabled: true,
                      },
                    ]
              }
            >
              {row}
            </ContextMenu>
          );
        })}
      </tbody>
    </table>
  );
}

function positionOrder(position: string): number {
  const order: Record<string, number> = {
    Goalkeeper: 1,
    Defender: 2,
    Midfielder: 3,
    Forward: 4,
  };
  return order[position] || 99;
}
