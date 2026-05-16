import { useMemo, useState, type ReactNode } from "react";
import type {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
} from "../../store/gameStore";
import { Button, CountryFlag } from "../ui";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  MoreHorizontal,
  Repeat,
  RotateCcw,
  Settings,
  Shield,
  Star,
  TimerOff,
  Trash2,
  UserCog,
  Wand2,
} from "lucide-react";
import {
  calcAge,
  formatExactMoney,
  formatWeeklyAmount,
  formatVal,
  getContractRiskLevel,
  getContractYearsRemaining,
  getPlayerOvr,
} from "../../lib/helpers";
import { canDelegateToYouthAcademy, isSeniorSquadPlayer } from "../../lib/playerSquad";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import ContextMenu from "../ContextMenu";
import {
  clearContractExitIntent,
  setContractExitIntent,
} from "../../services/contractService";
import { setPlayerSquadRole } from "../../services/squadService";
import {
  toggleLoanList,
  toggleTransferList,
} from "../../services/transfersService";
import {
  buildActivePositionMap,
  buildPitchRows,
  buildPitchSlotRows,
  buildStartingXIIds,
  CORE_POSITIONS,
  getPreferredPositions,
  isPlayerOutOfPosition,
  normalisePosition,
  translatePositionAbbreviation,
} from "./SquadTab.helpers";
import {
  buildDelegateToYouthAcademyMenuItem,
  buildDividerMenuItem,
  buildToggleLoanListMenuItem,
  buildToggleTransferListMenuItem,
  buildViewProfileMenuItem,
} from "../playerActions/playerContextMenuItems";

interface SquadRosterViewProps {
  gameState: GameStateData;
  managerId: string;
  onGameUpdate?: (g: GameStateData) => void;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
}

type FilterScope = "all" | "xi" | "bench" | "outOfPosition" | "injured";
type SortKey = "pos" | "name" | "age" | "condition" | "morale" | "ovr";

export default function SquadRosterView({
  gameState,
  managerId,
  onGameUpdate,
  onSelectPlayer,
}: SquadRosterViewProps) {
  const { t } = useTranslation();
  const weeklySuffix = t("finances.perWeekSuffix");
  const myTeam = gameState.teams.find((team) => team.manager_id === managerId);
  const [playerSearch, setPlayerSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<FilterScope>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [contractActionPlayerId, setContractActionPlayerId] = useState<string | null>(null);
  const [contractActionError, setContractActionError] = useState<string | null>(null);

  if (!myTeam) {
    return <p className="text-gray-500 dark:text-gray-400">{t("common.unemployed")}</p>;
  }

  const posOrder: Record<string, number> = {
    Goalkeeper: 1,
    Defender: 2,
    Midfielder: 3,
    Forward: 4,
  };

  const roster = gameState.players
    .filter((player) => player.team_id === myTeam.id && isSeniorSquadPlayer(player))
    .sort(
      (a, b) =>
        (posOrder[normalisePosition(a.position)] || 99) -
          (posOrder[normalisePosition(b.position)] || 99) ||
        getPlayerOvr(b) - getPlayerOvr(a),
    );

  const playersById = useMemo(
    () => new Map(roster.map((player) => [player.id, player])),
    [roster],
  );

  const available = roster.filter((player) => !player.injury);
  const formation = myTeam.formation || "4-4-2";
  const startingXiIds = buildStartingXIIds(available, myTeam.starting_xi_ids || [], formation);
  const pitchSlotRows = buildPitchSlotRows(buildPitchRows(formation), startingXiIds, playersById);
  const xiActivePosition = buildActivePositionMap(pitchSlotRows);
  const xiIds = new Set(startingXiIds);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "ovr" ? "desc" : "asc");
  };

  const isOutOfPosition = (player: PlayerData): boolean => {
    const currentPos = xiActivePosition.get(player.id) || player.position;
    return xiIds.has(player.id) && isPlayerOutOfPosition(player, currentPos);
  };

  const matchesFilters = (player: PlayerData): boolean => {
    const inXI = xiIds.has(player.id);
    const currentPos = inXI
      ? normalisePosition(xiActivePosition.get(player.id) || player.position)
      : normalisePosition(player.position);
    const preferredPositions = getPreferredPositions(player);
    const search = playerSearch.trim().toLowerCase();

    if (search) {
      const searchable = [
        player.full_name,
        player.match_name,
        currentPos,
        ...preferredPositions,
        ...preferredPositions.map((position) => translatePositionAbbreviation(t, position)),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(search)) return false;
    }

    if (
      positionFilter !== "All" &&
      currentPos !== positionFilter &&
      !preferredPositions.includes(positionFilter)
    ) {
      return false;
    }

    switch (statusFilter) {
      case "xi":
        return inXI;
      case "bench":
        return !inXI;
      case "outOfPosition":
        return isOutOfPosition(player);
      case "injured":
        return Boolean(player.injury);
      default:
        return true;
    }
  };

  const filteredRoster = useMemo(() => {
    const list = roster.filter((player) => matchesFilters(player));
    const sorted = [...list].sort((a, b) => {
      const getPos = (player: PlayerData) => {
        if (xiIds.has(player.id)) {
          return normalisePosition(xiActivePosition.get(player.id) || player.position);
        }
        return normalisePosition(player.position);
      };

      switch (sortKey) {
        case "pos":
          return (posOrder[getPos(a)] || 99) - (posOrder[getPos(b)] || 99) || getPlayerOvr(b) - getPlayerOvr(a);
        case "name":
          return a.full_name.localeCompare(b.full_name);
        case "age":
          return calcAge(a.date_of_birth) - calcAge(b.date_of_birth);
        case "condition":
          return a.condition - b.condition;
        case "morale":
          return a.morale - b.morale;
        case "ovr":
          return getPlayerOvr(a) - getPlayerOvr(b);
        default:
          return 0;
      }
    });

    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [roster, sortKey, sortDir, playerSearch, positionFilter, statusFilter]);

  const selectedPlayer = playersById.get(selectedPlayerId ?? "") ?? filteredRoster[0] ?? roster[0];
  const substitutes = roster.filter((player) => !xiIds.has(player.id) && !player.injury).slice(0, 7);
  const reserves = roster.filter((player) => !xiIds.has(player.id)).slice(7, 14);
  const injuredPlayers = roster.filter((player) => player.injury);
  const outOfPositionCount = roster.filter((player) => isOutOfPosition(player)).length;
  const avgCondition = roster.length ? Math.round(roster.reduce((sum, player) => sum + player.condition, 0) / roster.length) : 0;
  const avgMorale = roster.length ? Math.round(roster.reduce((sum, player) => sum + player.morale, 0) / roster.length) : 0;
  const averageAge = roster.length ? (roster.reduce((sum, player) => sum + calcAge(player.date_of_birth), 0) / roster.length).toFixed(1) : "0.0";
  const foreignPlayers = roster.filter((player) => player.nationality !== myTeam.country).length;
  const totalWeeklyWage = roster.reduce((sum, player) => sum + player.wage, 0);
  const homeGrownPlayers = Math.max(0, roster.length - foreignPlayers);
  const hasActiveFilters = playerSearch.trim().length > 0 || positionFilter !== "All" || statusFilter !== "all";

  const updateContractExitIntent = async (playerId: string, shouldLetExpire: boolean): Promise<void> => {
    setContractActionPlayerId(playerId);
    setContractActionError(null);

    try {
      const result = shouldLetExpire
        ? await setContractExitIntent(playerId, "manager_squad_action")
        : await clearContractExitIntent(playerId);
      onGameUpdate?.(result.game);
    } catch (error) {
      setContractActionError(String(error));
    } finally {
      setContractActionPlayerId(null);
    }
  };

  const selectPlayer = (player: PlayerData) => {
    setSelectedPlayerId(player.id);
  };

  const SortHeader = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th className={`font-semibold py-2.5 text-app-text-muted ${className}`}>
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${sortKey === col ? "text-app-green" : ""}`}
      >
        <span>{label}</span>
        {sortKey === col ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" /> : null}
      </button>
    </th>
  );

  return (
    <div data-testid="squad-template-layout" className="flex flex-col gap-4 min-h-max max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">SQUAD</h1>
          <p className="text-sm text-app-text-muted">{myTeam.name} &bull; {roster.length} Players</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TemplateButton icon={<FileText className="w-4 h-4 text-app-text-muted" />}>Register Squad</TemplateButton>
          <TemplateButton icon={<UserCog className="w-4 h-4 text-app-text-muted" />}>Set Roles</TemplateButton>
          <button type="button" className="flex items-center gap-2 px-4 py-2 bg-app-green text-app-bg rounded-lg text-sm font-bold hover:bg-app-green/90 transition-colors">
            <Wand2 className="w-4 h-4" />
            Auto Pick
          </button>
          <button type="button" className="w-9 h-9 bg-app-card border border-app-border rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <MoreHorizontal className="w-4 h-4 text-app-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-8 border-b border-app-border/50 px-2 mt-2 overflow-x-auto">
        {[
          ["all", "Overview"],
          ["xi", "Selection"],
          ["bench", "Contract"],
          ["outOfPosition", "Development"],
        ].map(([scope, label]) => (
          <button
            key={scope}
            type="button"
            onClick={() => setStatusFilter(scope as FilterScope)}
            className={statusFilter === scope ? "text-app-green font-semibold border-b-2 border-app-green pb-3 -mb-[2px]" : "text-app-text-muted hover:text-white pb-3 -mb-[2px] font-medium transition-colors"}
          >
            {label}
          </button>
        ))}
      </div>

      {contractActionError ? (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {contractActionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(600px,_1fr)_340px] gap-4">
        <TemplateCard className="flex flex-col h-[600px]">
          <TemplateCardHeader title="TACTICS & FORMATION" />
          <div className="p-4 pt-0">
            <div className="flex items-center gap-2 cursor-pointer group mb-1">
              <span className="font-bold text-sm text-app-text">{formation.toUpperCase()}</span>
              <ChevronDown className="w-4 h-4 text-app-text-muted group-hover:text-white transition-colors" />
            </div>
            <div className="text-[11px] text-app-text-muted mb-4">{myTeam.play_style || "Balanced"} &bull; {myTeam.training_intensity || "Positive"}</div>

            <div className="w-full aspect-[3/4] bg-[#1a2e25] border-2 border-emerald-900/50 rounded-xl relative overflow-hidden flex shadow-inner">
              <div className="absolute inset-0">
                <div className="absolute inset-x-0 top-1/2 border-t-2 border-emerald-900/50" />
                <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-900/50" />
                <div className="absolute top-0 left-1/2 h-16 w-32 -translate-x-1/2 border-2 border-t-0 border-emerald-900/50 flex justify-center">
                  <div className="h-6 w-12 border-2 border-t-0 border-emerald-900/50" />
                </div>
                <div className="absolute bottom-0 left-1/2 h-16 w-32 -translate-x-1/2 border-2 border-b-0 border-emerald-900/50 flex justify-center items-end">
                  <div className="h-6 w-12 border-2 border-b-0 border-emerald-900/50" />
                </div>
              </div>
              {pitchSlotRows.flatMap((row) => row.slots).map((slot, index) => (
                <PlayerNode
                  key={`${slot.index}-${slot.position}`}
                  slot={slot}
                  placement={pitchPlacement(index)}
                  onSelect={selectPlayer}
                  label={translatePositionAbbreviation(t, slot.position)}
                />
              ))}
            </div>
          </div>
          <div className="mt-auto border-t border-app-border/50 p-2">
            <button type="button" className="w-full py-2.5 flex items-center justify-center gap-2 text-[11px] text-app-text-muted hover:text-white hover:bg-white/5 transition-colors rounded-lg font-medium">
              Team Instructions
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </TemplateCard>

        <TemplateCard className="flex flex-col h-[600px] overflow-hidden">
          <div className="p-3 border-b border-app-border/50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {["All", ...CORE_POSITIONS].map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => setPositionFilter(position)}
                  className={positionFilter === position ? "px-2.5 py-1.5 rounded text-[10px] font-semibold uppercase border bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "px-2.5 py-1.5 rounded text-[10px] font-semibold uppercase border bg-app-bg text-app-text-muted border-app-border hover:bg-white/5 hover:text-white"}
                >
                  {position === "All" ? "All" : translatePositionAbbreviation(t, position)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                placeholder={t("squad.filterPlayers")}
                className="w-40 rounded bg-app-bg border border-app-border px-2.5 py-1.5 text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-green/60"
              />
              <button type="button" onClick={() => setStatusFilter("all")} className="px-3 py-1.5 rounded bg-app-bg border border-app-border text-[10px] font-semibold text-app-text-muted hover:text-white">
                Quick Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayerSearch("");
                  setPositionFilter("All");
                  setStatusFilter("all");
                }}
                disabled={!hasActiveFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-app-bg border border-app-border text-[10px] font-semibold text-app-text-muted hover:text-white disabled:opacity-40"
              >
                <Settings className="w-3 h-3" />
                Show Filters
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar relative">
            <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1080px]">
              <thead className="sticky top-0 bg-app-card z-10 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-app-border/50 text-app-text-muted uppercase">
                <tr>
                  <SortHeader col="pos" label="POS" className="pl-4 w-12" />
                  <th className="font-semibold py-2.5 w-8 text-app-text-muted">#</th>
                  <SortHeader col="name" label="PLAYER" className="min-w-[150px]" />
                  <SortHeader col="age" label="AGE" className="w-10 text-center" />
                  <th className="font-semibold py-2.5 w-12 text-center text-app-text-muted">NAT</th>
                  <SortHeader col="condition" label="CON" className="w-16 text-center" />
                  <th className="font-semibold py-2.5 w-16 text-center text-app-text-muted">SHP</th>
                  <SortHeader col="morale" label="MORALE" className="w-20 text-center" />
                  <th className="font-semibold py-2.5 w-24 text-app-text-muted">WAGE</th>
                  <th className="font-semibold py-2.5 w-20 text-app-text-muted">VALUE</th>
                  <th className="font-semibold py-2.5 w-12 text-center text-app-text-muted">APPS</th>
                  <th className="font-semibold py-2.5 w-10 text-center text-app-text-muted">GLS</th>
                  <th className="font-semibold py-2.5 w-10 text-center text-app-text-muted">AST</th>
                  <th className="font-semibold py-2.5 w-14 text-center text-app-text-muted">AV RAT</th>
                  <th className="font-semibold py-2.5 w-24 pr-4 text-app-text-muted">STATUS</th>
                  <th className="font-semibold py-2.5 w-24 pr-4 text-app-text-muted">ACTIONS</th>
                  <SortHeader col="ovr" label="OVR" className="w-12 text-center pr-4" />
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((player, index) => renderPlayerRow({
                  player,
                  index,
                  t,
                  xiIds,
                  xiActivePosition,
                  onSelectPlayer,
                  selectPlayer,
                  updateContractExitIntent,
                  onGameUpdate,
                  contractActionPlayerId,
                  weeklySuffix,
                  currentDate: gameState.clock.current_date,
                  selected: selectedPlayer?.id === player.id,
                }))}
              </tbody>
            </table>
            {filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-app-text-muted font-semibold uppercase tracking-wider text-sm">{t("squad.noPlayers")}</div>
            ) : null}
          </div>
        </TemplateCard>

        <TemplateCard className="flex flex-col h-[600px] overflow-hidden p-4 relative">
          {selectedPlayer ? <PlayerProfileCard player={selectedPlayer} currentDate={gameState.clock.current_date} onRenew={() => onSelectPlayer(selectedPlayer.id, { openRenewal: true })} /> : null}
        </TemplateCard>
      </div>

      <div data-testid="squad-template-sidebar" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[240px_minmax(400px,_1fr)_minmax(200px,_1fr)_280px] gap-4 mt-2">
        <TemplateCard>
          <TemplateCardHeader title="SQUAD HIERARCHY" />
          <div className="p-4 flex flex-col gap-3">
            <HierarchyRow label="Starting XI" value={startingXiIds.length} tone="success" />
            <HierarchyRow label="Substitutes" value={substitutes.length} tone="primary" />
            <HierarchyRow label="Reserves" value={Math.max(0, roster.length - startingXiIds.length - substitutes.length)} tone="neutral" />
            <HierarchyRow label="Out of position" value={outOfPositionCount} tone={outOfPositionCount > 0 ? "warning" : "neutral"} />
          </div>
        </TemplateCard>

        <TemplateCard className="flex flex-col p-4">
          <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-4">SUBSTITUTES</h3>
          <SubBenchList players={substitutes} fallbackCount={7} onSelect={selectPlayer} />
          <div className="text-[9px] text-app-text-muted mt-auto"><b>{substitutes.length} / 7</b> Substitutes</div>
        </TemplateCard>

        <TemplateCard className="flex flex-col p-4">
          <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-4">RESERVES</h3>
          <SubBenchList players={reserves} fallbackCount={3} onSelect={selectPlayer} />
          <div className="text-[9px] text-app-text-muted mt-auto"><b>{reserves.length} / 7</b> Reserves</div>
        </TemplateCard>

        <TemplateCard className="flex flex-col p-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="flex flex-col">
              <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-3">SQUAD INFO</h3>
              <div className="flex flex-col gap-2 text-[10px]">
                <div className="flex justify-between"><span className="text-app-text-muted">Squad Size</span><span className="font-medium text-white">{roster.length}</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Average Age</span><span className="font-medium text-white">{averageAge}</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Foreign Players</span><span className="font-medium text-white">{foreignPlayers}</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Home-Grown Players</span><span className="font-medium text-white">{homeGrownPlayers}</span></div>
                <div className="flex justify-between border-t border-app-border pt-2 mt-1"><span className="text-app-text-muted">Total Wage</span><span className="font-medium text-white">{formatWeeklyAmount(formatExactMoney(totalWeeklyWage), weeklySuffix)}</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Wage Budget</span><span className="font-medium text-white">{formatWeeklyAmount(formatExactMoney(myTeam.wage_budget), weeklySuffix)}</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Avg Condition</span><span className="font-medium text-white">{avgCondition}%</span></div>
                <div className="flex justify-between"><span className="text-app-text-muted">Avg Morale</span><span className="font-medium text-white">{avgMorale}%</span></div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-2">REGISTRATION</h3>
                <div className="flex flex-col gap-1.5 text-[9px] text-app-text-muted border-b border-app-border pb-3">
                  <RegistrationRow label="Domestic (Max 25)" value={`${Math.min(roster.length, 25)} / 25`} ok={roster.length <= 25} />
                  <RegistrationRow label="UEFA Squad (Max 25)" value={`${Math.min(roster.length, 25)} / 25`} ok={roster.length <= 25} />
                  <RegistrationRow label="Home-Grown (Min 8)" value={`${homeGrownPlayers} / 8`} ok={homeGrownPlayers >= 8} />
                </div>
              </div>

              <div className="flex flex-col">
                <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-2">INJURED PLAYERS</h3>
                <div className="flex flex-col gap-1.5 text-[9px]">
                  {injuredPlayers.slice(0, 3).map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0"><div className="w-2.5 h-2.5 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[7px] font-bold font-serif shrink-0">x</div><span className="text-white truncate">{player.match_name}</span></div>
                      <span className="text-app-text-muted truncate">{player.injury?.name ?? "Injured"}</span>
                      <span className="text-app-text-muted w-10 text-right shrink-0">{player.injury?.days_remaining ?? ""}d</span>
                    </div>
                  ))}
                  {injuredPlayers.length === 0 ? <div className="text-app-text-muted">No injured players</div> : null}
                </div>
              </div>
            </div>
          </div>
        </TemplateCard>
      </div>
    </div>
  );
}

function renderPlayerRow({
  player,
  index,
  t,
  xiIds,
  xiActivePosition,
  onSelectPlayer,
  selectPlayer,
  updateContractExitIntent,
  onGameUpdate,
  contractActionPlayerId,
  weeklySuffix,
  currentDate,
  selected,
}: {
  player: PlayerData;
  index: number;
  t: TFunction;
  xiIds: Set<string>;
  xiActivePosition: Map<string, string>;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  selectPlayer: (player: PlayerData) => void;
  updateContractExitIntent: (playerId: string, shouldLetExpire: boolean) => void;
  onGameUpdate?: (g: GameStateData) => void;
  contractActionPlayerId: string | null;
  weeklySuffix: string;
  currentDate: string;
  selected: boolean;
}) {
  const inXI = xiIds.has(player.id);
  const currentPos = inXI ? xiActivePosition.get(player.id) || player.position : player.natural_position || player.position;
  const ovr = getPlayerOvr(player);
  const contractRiskLevel = getContractRiskLevel(player.contract_end, currentDate);
  const contractRiskLabel = contractRiskLevel === "critical" ? t("finances.contractRiskCritical") : contractRiskLevel === "warning" ? t("finances.contractRiskWarning") : t("finances.contractRiskStable");
  const hasLetExpireIntent = player.morale_core?.renewal_state?.exit_intent?.kind === "let_expire";
  const isContractActionSubmitting = contractActionPlayerId === player.id;
  const wrongPos = inXI && isPlayerOutOfPosition(player, currentPos);

  const contextItems = [
    buildViewProfileMenuItem(t, () => onSelectPlayer(player.id)),
    {
      label: t("common.renewContract"),
      icon: <Repeat className="w-4 h-4" />,
      disabled: !player.contract_end,
      onClick: () => onSelectPlayer(player.id, { openRenewal: true }),
    },
    hasLetExpireIntent
      ? {
          label: t("playerProfile.reopenContractTalks"),
          icon: <RotateCcw className="w-4 h-4" />,
          disabled: !player.contract_end || isContractActionSubmitting,
          onClick: () => updateContractExitIntent(player.id, false),
        }
      : {
          label: t("playerProfile.letContractExpire"),
          icon: <TimerOff className="w-4 h-4" />,
          disabled: !player.contract_end || isContractActionSubmitting,
          onClick: () => updateContractExitIntent(player.id, true),
        },
    {
      label: t("playerProfile.terminateContract"),
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      disabled: !player.contract_end,
      onClick: () => onSelectPlayer(player.id, { openTermination: true }),
    },
    buildDividerMenuItem(),
    buildToggleTransferListMenuItem(t, player.transfer_listed, async () => {
      try {
        const updated = await toggleTransferList(player.id);
        onGameUpdate?.(updated);
      } catch {
        return;
      }
    }),
    buildToggleLoanListMenuItem(t, player.loan_listed, async () => {
      try {
        const updated = await toggleLoanList(player.id);
        onGameUpdate?.(updated);
      } catch {
        return;
      }
    }),
    ...(canDelegateToYouthAcademy(player)
      ? [
          buildDelegateToYouthAcademyMenuItem(t, async () => {
            try {
              const updated = await setPlayerSquadRole(player.id, "Youth");
              onGameUpdate?.(updated);
            } catch {
              return;
            }
          }),
        ]
      : []),
  ];

  return (
    <ContextMenu items={contextItems} key={player.id}>
      <tr onClick={() => selectPlayer(player)} className={selected ? "border-b border-app-border/20 last:border-0 bg-app-green/10 hover:bg-app-green/15 transition-colors cursor-pointer" : "border-b border-app-border/20 last:border-0 hover:bg-white/5 transition-colors cursor-pointer"}>
        <td className="py-2.5 pl-4">
          <div className="flex items-center gap-1.5">
            <span className={positionChipClass(translatePositionAbbreviation(t, currentPos))}>{translatePositionAbbreviation(t, currentPos)}</span>
            {wrongPos ? <AlertTriangle className="w-3 h-3 text-warn-500" /> : null}
          </div>
        </td>
        <td className="py-2.5 text-app-text-muted">{inXI ? index + 1 : "-"}</td>
        <td className="py-2.5 font-medium text-app-text">
          <div className="flex items-center gap-2 max-w-[170px]">
            {selected ? <div className="w-1.5 h-1.5 rounded-full bg-app-green" /> : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectPlayer(player.id);
              }}
              className="truncate text-left hover:text-app-green transition-colors"
            >
              {player.full_name}
            </button>
          </div>
        </td>
        <td className="py-2.5 text-center text-app-text-muted tabular-nums">{calcAge(player.date_of_birth)}</td>
        <td className="py-2.5 text-center"><CountryFlag code={player.nationality} className="text-sm leading-none" /></td>
        <td className="py-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <CircleChart pct={player.condition} color="#2dd4bf" />
            <span className="text-app-green">{player.condition}%</span>
          </div>
        </td>
        <td className="py-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <CircleChart pct={Math.min(100, Math.max(30, player.condition + Math.round(player.morale / 10)))} color="#2dd4bf" />
            <span className="text-app-green">{Math.min(100, Math.max(30, player.condition + Math.round(player.morale / 10)))}%</span>
          </div>
        </td>
        <td className="py-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-app-green">☺</span>
            <span className="text-app-green font-medium truncate w-16">{moraleLabel(player.morale)}</span>
          </div>
        </td>
        <td className="py-2.5 text-app-text-muted whitespace-nowrap">{formatWeeklyAmount(formatExactMoney(player.wage), weeklySuffix)}</td>
        <td className="py-2.5 text-app-text-muted whitespace-nowrap">{formatVal(player.market_value)}</td>
        <td className="py-2.5 text-center text-app-text-muted">{player.stats.appearances}</td>
        <td className="py-2.5 text-center text-app-text-muted">{player.stats.goals}</td>
        <td className="py-2.5 text-center text-app-text-muted">{player.stats.assists}</td>
        <td className="py-2.5 text-center"><span className="bg-app-bg px-2.5 py-1 rounded text-app-text font-bold border border-app-border/50 bg-[#252f3d]">{player.stats.avg_rating ? player.stats.avg_rating.toFixed(2) : "-"}</span></td>
        <td className="py-2.5 pr-4 text-app-text-muted text-[10px]">{contractRiskLabel}</td>
        <td className="py-2.5 pr-4">
          {player.contract_end && contractRiskLevel !== "stable" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onSelectPlayer(player.id, { openRenewal: true });
              }}
            >
              {t("common.renewContract")}
            </Button>
          ) : <span className="text-xs text-app-text-muted">—</span>}
        </td>
        <td className="py-2.5 pr-4 text-center"><span className={ratingClass(ovr)}>{ovr}</span></td>
      </tr>
    </ContextMenu>
  );
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-app-card rounded-xl border border-app-border overflow-hidden ${className}`}>{children}</div>;
}

function TemplateCardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="h-11 px-4 border-b border-app-border/50 flex items-center justify-between">
      <h3 className="text-[11px] font-bold tracking-widest text-app-text-muted uppercase">{title}</h3>
      {action}
    </div>
  );
}

function TemplateButton({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" className="flex items-center gap-2 px-4 py-2 bg-app-card border border-app-border rounded-lg text-sm font-medium hover:bg-white/5 transition-colors text-app-text">
      {icon}
      {children}
    </button>
  );
}

function PlayerProfileCard({ player, currentDate, onRenew }: { player: PlayerData; currentDate: string; onRenew: () => void }) {
  const ovr = getPlayerOvr(player);
  const attrs = player.attributes;
  const splitName = player.full_name.split(" ");
  const firstName = splitName.slice(0, -1).join(" ") || player.match_name;
  const lastName = splitName[splitName.length - 1] ?? player.match_name;
  const stars = Math.max(1, Math.round(ovr / 20));

  return (
    <>
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-app-text-muted tracking-widest uppercase mb-1">PLAYER PROFILE</span>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 flex flex-col items-center justify-center bg-emerald-500/10">
              <span className="text-[10px] text-emerald-500 font-bold leading-none">{translateProfilePosition(player)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <StarRating stars={Math.min(5, stars)} size="w-2.5 h-2.5" />
              <span className="text-[10px] text-app-text-muted">{roleLabel(ovr)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-4xl font-bold leading-none text-app-text">{ovr}</span>
          <h2 className="text-xl font-bold leading-tight uppercase text-app-text">{firstName}<br />{lastName}</h2>
          <span className="text-[10px] text-app-text-muted">{player.natural_position || player.position}</span>
          <div className="flex gap-0.5 mt-2 mb-2 items-center">
            <StarRating stars={Math.min(5, stars)} size="w-2.5 h-2.5" />
            <CountryFlag code={player.nationality} className="ml-2 text-xs" />
          </div>
          <button type="button" onClick={onRenew} className="bg-app-green/10 text-app-green px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 w-fit">
            <Star className="w-2.5 h-2.5" />
            <span>{roleLabel(ovr)}</span>
            <ChevronRight className="w-2.5 h-2.5 ml-1" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-app-text-muted mb-3 border-b border-app-border/50 pb-3">
        <ProfileFact label="Age" value={`${calcAge(player.date_of_birth)} (${player.date_of_birth})`} />
        <ProfileFact label="Preferred Foot" value="Right" />
        <ProfileFact label="Condition" value={`${player.condition}%`} />
        <ProfileFact label="Contract" value={player.contract_end ?? "—"} />
      </div>

      <h3 className="text-[9px] font-bold text-app-text-muted tracking-widest uppercase mb-2">ATTRIBUTES</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <AttrColumn title="Technical" rows={[
          ["Passing", attrs.passing],
          ["Shooting", attrs.shooting],
          ["Dribbling", attrs.dribbling],
          ["Tackling", attrs.tackling],
          ["Defending", attrs.defending],
          ["Vision", attrs.vision],
          ["Technique", Math.round((attrs.passing + attrs.dribbling) / 2)],
        ]} />
        <AttrColumn title="Mental" rows={[
          ["Decisions", attrs.decisions],
          ["Composure", attrs.composure],
          ["Aggression", attrs.aggression],
          ["Teamwork", attrs.teamwork],
          ["Leadership", attrs.leadership],
          ["Positioning", attrs.positioning],
          ["Morale", player.morale],
        ]} />
        <AttrColumn title="Physical" rows={[
          ["Pace", attrs.pace],
          ["Stamina", attrs.stamina],
          ["Strength", attrs.strength],
          ["Agility", attrs.agility],
          ["Aerial", attrs.aerial],
          ["Reflexes", attrs.reflexes],
          ["Condition", player.condition],
        ]} />
      </div>

      <div className="flex gap-2 mt-auto min-h-0 pt-2 pb-1 border-t border-app-border/30">
        <RadarMini values={[attrs.defending, attrs.strength, attrs.pace, attrs.vision, attrs.shooting, attrs.passing, attrs.aerial, attrs.decisions]} />
        <div className="flex-1 flex flex-col justify-center gap-0.5 text-[6.5px] leading-[1.05] min-w-0 py-1.5 px-2">
          <InfoRow label="Condition" value={<span className="text-app-green font-medium">♥ {player.condition}%</span>} />
          <InfoRow label="Sharpness" value={<span className="text-app-green font-medium">▰ {Math.min(100, player.condition + 8)}%</span>} />
          <InfoRow label="Morale" value={<span className="text-app-green font-medium">☺ {moraleLabel(player.morale)}</span>} />
          <InfoRow label="Injury Risk" value={<span className="text-app-green font-medium">{player.injury ? "High" : "Low"}</span>} />
          <InfoRow label="Contract Expires" value={player.contract_end ?? "—"} />
          <InfoRow label="Years Remaining" value={getContractYearsRemaining(player.contract_end, currentDate)} />
        </div>
      </div>
    </>
  );
}

function PlayerNode({ slot, placement, onSelect, label }: { slot: { player: PlayerData | null; position: string }; placement: { x: string; y: string }; onSelect: (player: PlayerData) => void; label: string }) {
  const role = roleCode(slot.position);
  return (
    <button
      type="button"
      onClick={() => slot.player ? onSelect(slot.player) : undefined}
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 w-16"
      style={{ left: placement.x, top: placement.y }}
    >
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg ring-1 ring-white/10 mb-0.5 ${slot.position === "Goalkeeper" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}`}>
        {slot.player ? getPlayerOvr(slot.player) : ""}
      </div>
      <div className="w-[120%] bg-transparent px-1 py-0.5 text-center flex flex-col items-center pointer-events-none">
        <span className="text-[8px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{slot.player?.match_name ?? label}</span>
        <span className="text-[7.5px] text-emerald-300 whitespace-nowrap font-medium leading-none mt-[1px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{role}</span>
      </div>
    </button>
  );
}

function pitchPlacement(index: number): { x: string; y: string } {
  const placements = [
    { x: "50%", y: "90%" },
    { x: "15%", y: "75%" },
    { x: "35%", y: "75%" },
    { x: "65%", y: "75%" },
    { x: "85%", y: "75%" },
    { x: "35%", y: "55%" },
    { x: "65%", y: "55%" },
    { x: "20%", y: "35%" },
    { x: "50%", y: "35%" },
    { x: "80%", y: "35%" },
    { x: "50%", y: "15%" },
  ];
  return placements[index] ?? { x: "50%", y: "50%" };
}

function roleCode(position: string): string {
  const normalized = normalisePosition(position);
  if (normalized === "Goalkeeper") return "SK · De";
  if (normalized === "Defender") return "BPD · De";
  if (normalized === "Midfielder") return "DLP · Su";
  return "AF · At";
}

function ProfileFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between min-w-0">
      <span className="w-16 shrink-0">{label}</span>
      <span className="text-white font-medium truncate text-right">{value}</span>
    </div>
  );
}

function AttrColumn({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="flex flex-col gap-0.5 text-[9.5px] min-w-0">
      <span className="text-app-text-muted border-b border-app-border pb-1 mb-1 font-semibold uppercase">{title}</span>
      {rows.map(([label, value]) => <AttrRow key={label} label={label} value={value} />)}
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-app-green" : value >= 55 ? "bg-blue-500" : "bg-red-500";
  return (
    <div className="flex items-center justify-between gap-1 min-w-0">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-5 h-1.5 bg-app-bg overflow-hidden relative border border-app-border/50">
          <div className={`absolute inset-0 origin-left ${color}`} style={{ transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})` }} />
        </div>
        <span className={`w-5 text-right font-medium ${value >= 75 ? "text-app-green font-bold" : "text-app-text-muted"}`}>{value}</span>
      </div>
    </div>
  );
}

function RadarMini({ values }: { values: number[] }) {
  const points = values.map((value, index) => {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const radius = 18 + (Math.max(0, Math.min(100, value)) / 100) * 42;
    return `${70 + Math.cos(angle) * radius},${70 + Math.sin(angle) * radius}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 140 140" className="w-[102px] h-[102px] shrink-0 overflow-visible">
      {[22, 40, 58].map((radius) => <circle key={radius} cx="70" cy="70" r={radius} fill="none" stroke="#232d3b" strokeWidth="1" />)}
      {values.map((_, index) => {
        const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
        return <line key={index} x1="70" y1="70" x2={70 + Math.cos(angle) * 60} y2={70 + Math.sin(angle) * 60} stroke="#232d3b" strokeWidth="1" />;
      })}
      <polygon points={points} fill="#8b5cf6" fillOpacity="0.35" stroke="#8b5cf6" strokeWidth="2" />
    </svg>
  );
}

function StarRating({ stars, size }: { stars: number; size: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`${size} text-amber-400 ${star <= stars ? "fill-amber-400" : "fill-amber-400/20 opacity-40"}`} />)}
    </div>
  );
}

function CircleChart({ pct, color }: { pct: number; color: string }) {
  const r = 3.5;
  const circ = 2 * Math.PI * r;
  const strokePct = ((100 - pct) * circ) / 100;
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="transform -rotate-90 shrink-0">
      <circle r={r} cx="5" cy="5" fill="transparent" stroke="#232d3b" strokeWidth="2.5" />
      <circle r={r} cx="5" cy="5" fill="transparent" stroke={color} strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={strokePct} />
    </svg>
  );
}

function moraleLabel(value: number): string {
  if (value >= 85) return "Excellent";
  if (value >= 70) return "Very Good";
  if (value >= 55) return "Good";
  if (value >= 40) return "Okay";
  return "Poor";
}

function roleLabel(ovr: number): string {
  if (ovr >= 80) return "Star Player";
  if (ovr >= 70) return "Important";
  if (ovr >= 60) return "Regular Starter";
  return "Squad Player";
}

function translateProfilePosition(player: PlayerData): string {
  const position = normalisePosition(player.natural_position || player.position);
  if (position === "Goalkeeper") return "GK";
  if (position === "Defender") return "D";
  if (position === "Midfielder") return "M";
  return "F";
}

function positionChipClass(pos: string): string {
  const base = "px-1.5 py-0.5 rounded text-[9px] font-bold inline-block min-w-[28px] text-center";
  if (pos === "GK") return `${base} bg-[#40b07b]/20 text-[#40b07b]`;
  if (pos.includes("D")) return `${base} bg-[#5b75a1]/20 text-[#8baae0]`;
  if (pos.includes("M")) return `${base} bg-[#a062b0]/20 text-[#d48de8]`;
  return `${base} bg-red-500/20 text-red-300`;
}


function SubBenchList({ players, fallbackCount, onSelect }: { players: PlayerData[]; fallbackCount: number; onSelect: (player: PlayerData) => void }) {
  const visible = players.slice(0, fallbackCount);
  if (visible.length === 0) return <div className="text-[10px] text-app-text-muted">No players</div>;

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {visible.map((player, index) => <SubBenchCard key={player.id} player={player} index={index} onSelect={onSelect} />)}
    </div>
  );
}

function SubBenchCard({ player, index, onSelect }: { player: PlayerData; index: number; onSelect: (player: PlayerData) => void }) {
  const ovr = getPlayerOvr(player);
  return (
    <button type="button" onClick={() => onSelect(player)} className="flex flex-col items-center flex-1 min-w-[62px] bg-[#1a202a] border border-app-border rounded-lg relative overflow-hidden group hover:border-[#3b4c66] transition-colors cursor-pointer">
      <div className="absolute top-1 right-1 text-[8px] text-amber-500 font-bold">↑</div>
      <div className="w-full flex justify-center pt-3 pb-2 relative">
        <div className="w-full h-8 absolute bottom-0 bg-gradient-to-t from-red-500/20 to-transparent" />
        <div className="w-10 h-10 border border-red-500 rounded bg-red-900/30 flex items-center justify-center z-10 text-xl font-bold shadow-sm">
          <span className="text-white drop-shadow-md">{index + 12}</span>
        </div>
      </div>
      <div className="flex flex-col items-center px-1 pb-2 w-full z-10">
        <span className="text-[10px] font-bold truncate w-full text-center text-app-text">{player.match_name}</span>
        <span className="text-[9px] text-app-text-muted truncate w-full text-center">{player.natural_position || player.position}</span>
      </div>
      <div className="w-full border-t border-app-border/50 p-1 flex justify-center bg-black/10">
        <span className="text-[10px] font-bold font-mono text-app-text-muted">{player.stats.avg_rating ? player.stats.avg_rating.toFixed(2) : ovr}</span>
      </div>
    </button>
  );
}

function RegistrationRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-white">{value}</span>
        {ok ? <Shield className="w-3 h-3 text-app-green fill-app-green/20" /> : <div className="w-3 h-3 flex items-center justify-center text-warn-500">-</div>}
      </div>
    </div>
  );
}

function HierarchyRow({ label, value, tone }: { label: string; value: number; tone: "success" | "primary" | "warning" | "neutral" }) {
  const color = tone === "success" ? "bg-success-500" : tone === "primary" ? "bg-primary-500" : tone === "warning" ? "bg-warn-500" : "bg-app-border";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-app-text-muted"><span className={`w-2 h-2 rounded-full ${color}`} />{label}</div>
      <span className="font-bold text-app-text">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className="font-semibold text-app-text text-right">{value}</span>
    </div>
  );
}

function ratingClass(value: number): string {
  if (value >= 80) return "text-sm font-black text-app-green";
  if (value >= 65) return "text-sm font-black text-primary-400";
  if (value >= 50) return "text-sm font-black text-warn-500";
  return "text-sm font-black text-app-text-muted";
}
