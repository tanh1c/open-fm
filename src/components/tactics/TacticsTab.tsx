import type { DragEvent, JSX, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
} from "../../store/gameStore";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Goal,
  Grid,
  Info,
  LayoutGrid,
  Save,
  Settings2,
  ShieldAlert,
  Target,
} from "lucide-react";
import {
  applyLineupDrop,
  applyLineupSwap,
  buildActivePositionMap,
  buildPitchRows,
  buildPitchSlotRows,
  type DragState,
  type PitchSlotRow,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import TacticsFilters from "./TacticsFilters";
import {
  buildTacticsRoster,
  countOutOfPositionPlayers,
  filterAndSortTacticsPlayers,
  getSelectedAndComparePlayers,
  resolveStartingXiIds,
  type SortKey,
} from "./TacticsTab.helpers";
import TacticsPitch from "./TacticsPitch";
import TacticsPlayerFocusPanel from "./TacticsPlayerFocusPanel";
import TacticsPlayerTable from "./TacticsPlayerTable";
import TacticsRolesPanel from "./TacticsRolesPanel";
import TacticsSetupPanel from "./TacticsSetupPanel";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface TacticsTabProps {
  gameState: GameStateData;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onGameUpdate: (g: GameStateData) => void;
}

interface TemplateCardProps {
  children: ReactNode;
  className?: string;
}

function TemplateCard({ children, className }: TemplateCardProps): JSX.Element {
  return (
    <div className={cx("rounded-xl border border-app-border bg-app-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

function HeaderButton({ children, icon, primary = false }: { children: ReactNode; icon: ReactNode; primary?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      className={cx(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors",
        primary
          ? "bg-app-green font-bold text-app-bg hover:bg-app-green/90"
          : "border border-app-border bg-app-card font-medium hover:bg-white/5",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function PresetRow({ name, desc, active = false, onClick }: { name: string; desc: string; active?: boolean; onClick?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-app-green/30 bg-app-green/10 text-app-green"
          : "border-app-border bg-app-card text-app-text hover:bg-white/5",
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cx("flex h-8 w-8 items-center justify-center rounded-full", active ? "bg-app-green/20" : "border border-app-border bg-app-bg")}>
          <LayoutGrid className={cx("h-4 w-4", active ? "text-app-green" : "text-app-text-muted")} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{name}</span>
          <span className={cx("text-[10px]", active ? "text-app-green/80" : "text-app-text-muted")}>{desc}</span>
        </div>
      </div>
      {active ? <CheckCircle2 className="h-4 w-4" /> : null}
    </button>
  );
}

function SetPieceBadge({ icon, title, desc, className }: { icon: ReactNode; title: string; desc: string; className?: string }): JSX.Element {
  return (
    <div className={cx("flex cursor-pointer flex-col gap-2 rounded-lg border border-app-border/80 bg-[#141b24] p-2.5 transition-colors hover:bg-white/5", className)}>
      <div className="flex items-center gap-2 text-app-text-muted">
        {icon}
        <span className="text-xs font-semibold text-app-text">{title}</span>
      </div>
      <span className="text-[10px] text-app-text-muted">{desc}</span>
    </div>
  );
}

function OpponentTrait({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }): JSX.Element {
  return (
    <div className="flex gap-3">
      <div className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", color)}>
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold leading-tight text-app-text">{title}</span>
        <span className="mt-0.5 truncate text-[10px] text-app-text-muted">{desc}</span>
      </div>
    </div>
  );
}

function PhaseCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <TemplateCard className="flex flex-col p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-app-text-muted" />
      </div>
      {children}
      <button type="button" className="group flex w-fit items-center gap-1 text-[10px] text-app-text-muted transition-colors hover:text-white">
        <ChevronRight className="h-3 w-3 transition-colors group-hover:text-white" />
        Change
      </button>
    </TemplateCard>
  );
}

function PhaseItem({ text }: { text: string }): JSX.Element {
  return <div className="truncate pr-2 text-[11px] text-app-text-muted">{text}</div>;
}

function InstructionQuickStat({ icon, title, val }: { icon: ReactNode; title: string; val: string }): JSX.Element {
  return (
    <div className="flex cursor-pointer flex-col items-center justify-center gap-1 p-3 text-center transition-colors hover:bg-white/5">
      <div className="flex items-center gap-1.5 text-app-text-muted">
        {icon}
        <span className="text-[10px] font-semibold">{title}</span>
      </div>
      <span className="max-w-[80px] text-[10px] font-medium leading-tight text-white">{val}</span>
    </div>
  );
}

function AnalStat({ label, val, pct }: { label: string; val: string; pct: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-app-text-muted">{label}</span>
        <span className="text-white">{val}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-app-bg">
        <div className="h-full rounded-full bg-app-green shadow-[0_0_6px_rgba(45,212,191,0.5)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RoleDots({ value }: { value: number }): JSX.Element {
  const color = value > 1 ? "bg-emerald-500" : value === 1 ? "bg-amber-500" : "bg-[#232d3b]";
  return (
    <div className="flex justify-center gap-0.5">
      {[0, 1, 2].map((dot) => (
        <div key={dot} className={cx("h-1.5 w-1.5 rounded-full shadow-sm", dot < value ? color : "bg-[#232d3b]")} />
      ))}
    </div>
  );
}

export default function TacticsTab({
  gameState,
  onSelectPlayer,
  onGameUpdate,
}: TacticsTabProps): JSX.Element {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("pos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [pendingStartingXiIds, setPendingStartingXiIds] = useState<
    string[] | null
  >(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerSection, setSelectedPlayerSection] =
    useState<SquadSection | null>(null);
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
  const [comparePlayerSection, setComparePlayerSection] =
    useState<SquadSection | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const hoveredSlotRef = useRef<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  if (!myTeam) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const roster = buildTacticsRoster(gameState.players, myTeam.id);

  const formation = myTeam.formation || "4-4-2";
  const activePlayStyle = myTeam.play_style || "Balanced";
  const savedStartingXiKey = (myTeam.starting_xi_ids || []).join(",");
  const playersById = useMemo(
    () => new Map(roster.map((player) => [player.id, player])),
    [roster],
  );
  const available = roster.filter((player) => !player.injury);
  const pitchRows = useMemo(() => buildPitchRows(formation), [formation]);

  const startingXiIds = useMemo(
    () =>
      resolveStartingXiIds({
        availablePlayers: available,
        formation,
        pendingStartingXiIds,
        playersById,
        savedStartingXiIds: myTeam.starting_xi_ids || [],
      }),
    [
      available.map((player) => player.id).join(","),
      formation,
      (myTeam.starting_xi_ids || []).join(","),
      (pendingStartingXiIds || []).join(","),
      roster.map((player) => player.id).join(","),
    ],
  );

  const startingXI = useMemo(
    () =>
      startingXiIds
        .map((id) => playersById.get(id))
        .filter((player): player is PlayerData => player != null),
    [playersById, startingXiIds],
  );

  useEffect(() => {
    if (!pendingStartingXiIds) return;
    if (savedStartingXiKey === pendingStartingXiIds.join(",")) {
      setPendingStartingXiIds(null);
    }
  }, [pendingStartingXiIds, savedStartingXiKey]);

  const pitchSlotRows = useMemo<PitchSlotRow[]>(
    () => buildPitchSlotRows(pitchRows, startingXiIds, playersById),
    [pitchRows, playersById, startingXiIds],
  );

  const xiIds = new Set(startingXiIds);
  const bench = roster.filter((player) => !xiIds.has(player.id));
  const xiActivePosition = useMemo(
    () => buildActivePositionMap(pitchSlotRows),
    [pitchSlotRows],
  );

  const { comparePlayer, selectedPlayer } = getSelectedAndComparePlayers(
    comparePlayerId,
    playersById,
    selectedPlayerId,
  );

  const canConfirmSwap = useMemo(() => {
    if (
      !selectedPlayerId ||
      !selectedPlayerSection ||
      !comparePlayerId ||
      !comparePlayerSection
    ) {
      return false;
    }

    const nextXiIds = applyLineupSwap(
      startingXiIds,
      { id: selectedPlayerId, from: selectedPlayerSection },
      comparePlayerId,
      comparePlayerSection,
    );

    return !!nextXiIds && nextXiIds.join(",") !== startingXiIds.join(",");
  }, [
    comparePlayerId,
    comparePlayerSection,
    selectedPlayerId,
    selectedPlayerSection,
    startingXiIds,
  ]);

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(key === "ovr" ? "desc" : "asc");
  }

  const filteredStartingXI = useMemo(
    () =>
      filterAndSortTacticsPlayers(
        startingXI,
        {
          playerSearch,
          positionFilter,
          section: "xi",
          xiActivePosition,
        },
        {
          section: "xi",
          sortDir,
          sortKey,
          xiActivePosition,
        },
      ),
    [
      startingXI,
      playerSearch,
      positionFilter,
      sortKey,
      sortDir,
      xiActivePosition,
    ],
  );
  const filteredBench = useMemo(
    () =>
      filterAndSortTacticsPlayers(
        bench,
        {
          playerSearch,
          positionFilter,
          section: "bench",
          xiActivePosition,
        },
        {
          section: "bench",
          sortDir,
          sortKey,
          xiActivePosition,
        },
      ),
    [bench, playerSearch, positionFilter, sortKey, sortDir, xiActivePosition],
  );

  const outOfPositionCount = countOutOfPositionPlayers(
    startingXI,
    xiActivePosition,
  );

  async function persistStartingXI(playerIds: string[]): Promise<void> {
    setPendingStartingXiIds(playerIds);
    try {
      const updated = await invoke<GameStateData>("set_starting_xi", {
        playerIds,
      });
      onGameUpdate(updated);
    } catch (error) {
      setPendingStartingXiIds(null);
      console.error("Failed to set starting XI:", error);
    }
  }

  async function handleFormationChange(nextFormation: string): Promise<void> {
    try {
      const updated = await invoke<GameStateData>("set_formation", {
        formation: nextFormation,
      });
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set formation:", error);
    }
  }

  async function handlePlayStyleChange(playStyle: string): Promise<void> {
    try {
      const updated = await invoke<GameStateData>("set_play_style", {
        playStyle,
      });
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set play style:", error);
    }
  }

  function clearLineupSelection(): void {
    setSelectedPlayerId(null);
    setSelectedPlayerSection(null);
    setComparePlayerId(null);
    setComparePlayerSection(null);
  }

  function setHoveredSlotValue(slotIndex: number | null): void {
    if (hoveredSlotRef.current === slotIndex) {
      return;
    }

    hoveredSlotRef.current = slotIndex;
    setHoveredSlot(slotIndex);
  }

  function resetDragState(): void {
    dragStateRef.current = null;
    setDragState(null);
    setHoveredSlotValue(null);
  }

  function applyLightweightDragPreview(event: DragEvent<HTMLElement>): void {
    if (!dragPreviewRef.current) {
      return;
    }

    if (typeof event.dataTransfer.setDragImage !== "function") {
      return;
    }

    event.dataTransfer.setDragImage(dragPreviewRef.current, 16, 16);
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null = null,
  ): void {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", playerId);
    applyLightweightDragPreview(event);
    const nextDragState = { playerId, from, slotIndex };
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function handleSlotDragOver(
    event: DragEvent<HTMLElement>,
    slotIndex: number,
  ): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setHoveredSlotValue(slotIndex);
  }

  function handleSlotDragLeave(slotIndex: number): void {
    if (hoveredSlotRef.current !== slotIndex) {
      return;
    }

    setHoveredSlotValue(null);
  }

  async function handleSlotDrop(
    event: DragEvent<HTMLElement>,
    slotIndex: number,
  ): Promise<void> {
    event.preventDefault();
    const draggedPlayerId = event.dataTransfer.getData("text/plain");
    const currentDragState = dragStateRef.current ?? dragState;
    const resolvedDragState =
      currentDragState ??
      (draggedPlayerId
        ? {
            playerId: draggedPlayerId,
            from: xiIds.has(draggedPlayerId) ? "xi" : "bench",
            slotIndex: xiIds.has(draggedPlayerId)
              ? startingXiIds.indexOf(draggedPlayerId)
              : null,
          }
        : null);

    if (!resolvedDragState) return;

    const nextXiIds = applyLineupDrop(
      startingXiIds,
      resolvedDragState,
      slotIndex,
    );
    if (nextXiIds.join(",") === startingXiIds.join(",")) {
      resetDragState();
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
    resetDragState();
  }

  async function handleLineupPlayerClick(
    playerId: string,
    section: SquadSection,
  ): Promise<void> {
    if (!selectedPlayerId || !selectedPlayerSection) {
      setSelectedPlayerId(playerId);
      setSelectedPlayerSection(section);
      return;
    }

    if (selectedPlayerId === playerId && selectedPlayerSection === section) {
      if (comparePlayerId && comparePlayerSection) {
        setSelectedPlayerId(comparePlayerId);
        setSelectedPlayerSection(comparePlayerSection);
        setComparePlayerId(null);
        setComparePlayerSection(null);
        return;
      }

      clearLineupSelection();
      return;
    }

    if (comparePlayerId === playerId && comparePlayerSection === section) {
      setComparePlayerId(null);
      setComparePlayerSection(null);
      return;
    }

    setComparePlayerId(playerId);
    setComparePlayerSection(section);
  }

  async function handleConfirmSwap(): Promise<void> {
    if (
      !selectedPlayerId ||
      !selectedPlayerSection ||
      !comparePlayerId ||
      !comparePlayerSection
    ) {
      return;
    }

    const nextXiIds = applyLineupSwap(
      startingXiIds,
      { id: selectedPlayerId, from: selectedPlayerSection },
      comparePlayerId,
      comparePlayerSection,
    );

    if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
      return;
    }

    await persistStartingXI(nextXiIds);
    clearLineupSelection();
  }

  function handleClearFilters(): void {
    setPlayerSearch("");
    setPositionFilter("All");
  }

  return (
    <div data-testid="tactics-template-layout" className="mx-auto flex min-h-max max-w-[1600px] flex-col gap-4">
      <div
        ref={dragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-surface-900/90 shadow-lg"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-bg">
            <LayoutGrid className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-app-text">TACTICS</h1>
            <p className="text-sm text-app-text-muted">
              {myTeam.name} &bull; {t("tactics.playStyles." + activePlayStyle, activePlayStyle)} &bull; Match Preparation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HeaderButton icon={<Save className="h-4 w-4 text-app-text-muted" />}>Save Tactic</HeaderButton>
          <div className="flex overflow-hidden rounded-lg border border-app-border bg-app-card transition-colors">
            <button type="button" className="flex items-center gap-2 border-r border-app-border/50 px-3 py-2 text-sm font-medium hover:bg-white/5">
              <Download className="h-4 w-4 text-app-text-muted" />
              Load Preset
            </button>
            <button type="button" className="px-2 py-2 hover:bg-white/5">
              <ChevronDown className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>
          <HeaderButton icon={<Settings2 className="h-4 w-4 text-app-text-muted" />}>Match Plan</HeaderButton>
          <HeaderButton primary icon={<Check className="h-4 w-4" />}>Apply Changes</HeaderButton>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-8 border-b border-app-border/50 px-2">
        <button type="button" className="-mb-[2px] border-b-2 border-app-green pb-3 font-semibold text-app-green">Overview</button>
        <button type="button" className="-mb-[2px] pb-3 font-medium text-app-text-muted transition-colors hover:text-white">Player Roles</button>
        <button type="button" className="-mb-[2px] pb-3 font-medium text-app-text-muted transition-colors hover:text-white">Team Instructions</button>
        <button type="button" className="-mb-[2px] pb-3 font-medium text-app-text-muted transition-colors hover:text-white">Set Pieces</button>
        <button type="button" className="-mb-[2px] pb-3 font-medium text-app-text-muted transition-colors hover:text-white">Analysis</button>
      </div>

      <div className="mt-2 flex flex-col gap-4 xl:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[280px]">
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TACTICAL PRESETS</h3>
            <PresetRow name="Gegenpress" desc={formation} active />
            <PresetRow name="Control Possession" desc="4-3-3 DM Wide" onClick={() => void handleFormationChange("4-3-3")} />
            <PresetRow name="Vertical Tiki-Taka" desc="4-3-1-2 Narrow" onClick={() => void handleFormationChange("4-3-3")} />
            <PresetRow name="Wing Play" desc="4-2-3-1 Wide" onClick={() => void handleFormationChange("4-2-3-1")} />
            <PresetRow name="Direct Counter Attack" desc="4-4-2" onClick={() => void handleFormationChange("4-4-2")} />
            <button type="button" className="mt-1 flex w-full items-center justify-between rounded-lg border border-app-border px-3 py-2 text-[11px] text-app-text-muted transition-colors hover:bg-white/5">
              Manage Presets
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SET PIECE QUICK ACCESS</h3>
            <div className="grid grid-cols-2 gap-2">
              <SetPieceBadge icon={<Target className="h-4 w-4" />} title="Corners" desc="Attack / Defend" />
              <SetPieceBadge icon={<Grid className="h-4 w-4" />} title="Free Kicks" desc="Attack / Defend" />
              <SetPieceBadge icon={<ArrowRightLeft className="h-4 w-4" />} title="Throw-ins" desc="Left / Right" className="col-span-2" />
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <h3 className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
              OPPONENT FOCUS
              <span className="font-medium normal-case text-app-text">League Match</span>
            </h3>
            <TemplateCard className="flex flex-col">
              <div className="flex flex-col gap-3 p-3">
                <OpponentTrait icon="★" color="bg-yellow-500/20 text-yellow-500" title="Weak against crosses" desc="Target their full-backs" />
                <OpponentTrait icon="⚡" color="bg-yellow-500/20 text-yellow-500" title="Struggles vs. fast transitions" desc="Look to play quickly forward" />
                <OpponentTrait icon="!" color="bg-red-500/20 text-red-500" title="Vulnerable from set pieces" desc="Create chances from dead balls" />
              </div>
              <button type="button" className="group flex h-8 items-center justify-between border-t border-app-border/50 px-3 text-[10px] text-app-text-muted transition-colors hover:bg-white/5">
                View Scouting Report
                <ChevronRight className="h-3.5 w-3.5 group-hover:text-white" />
              </button>
            </TemplateCard>
          </div>

          <TacticsSetupPanel
            activePlayStyle={activePlayStyle}
            formation={formation}
            onFormationChange={(nextFormation) => {
              void handleFormationChange(nextFormation);
            }}
            onPlayStyleChange={(playStyle) => {
              void handlePlayStyleChange(playStyle);
            }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <TacticsPitch
            benchPlayers={bench}
            dragState={dragState}
            formation={formation}
            comparePlayerId={comparePlayerId}
            hoveredSlot={hoveredSlot}
            onClearSelection={clearLineupSelection}
            onDragEnd={resetDragState}
            onDragStart={handleDragStart}
            onLineupPlayerClick={(playerId, section) => {
              void handleLineupPlayerClick(playerId, section);
            }}
            onSlotDragLeave={handleSlotDragLeave}
            onSlotDragOver={handleSlotDragOver}
            onSlotDrop={(event, slotIndex) => {
              void handleSlotDrop(event, slotIndex);
            }}
            outOfPositionCount={outOfPositionCount}
            pitchSlotRows={pitchSlotRows}
            selectedPlayer={selectedPlayer}
            selectedPlayerId={selectedPlayerId}
          />

          <TemplateCard className="flex min-h-[200px] flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-app-border p-3">
              <h3 className="mb-0 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ROLE SUITABILITY</h3>
              <button type="button" className="group flex cursor-pointer items-center gap-1 text-[10px] text-app-text-muted transition-colors hover:text-white">
                View All Roles
                <ChevronRight className="h-3 w-3 group-hover:text-white" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-x-auto p-1">
              <table className="w-full min-w-[500px] whitespace-nowrap text-left text-[11px]">
                <thead>
                  <tr className="border-b border-app-border/30 text-app-text-muted">
                    <th className="px-3 py-2.5 font-semibold">PLAYER</th>
                    <th className="py-2.5 font-semibold">BEST ROLE</th>
                    <th className="w-12 py-2.5 text-center font-semibold">ST</th>
                    <th className="w-12 py-2.5 text-center font-semibold">AM</th>
                    <th className="w-12 py-2.5 text-center font-semibold">M</th>
                    <th className="w-12 py-2.5 text-center font-semibold">DM</th>
                    <th className="w-12 py-2.5 text-center font-semibold">D</th>
                    <th className="w-12 py-2.5 pr-3 text-center font-semibold">WB</th>
                  </tr>
                </thead>
                <tbody className="text-app-text">
                  {startingXI.slice(0, 6).map((player) => {
                    const activePosition = xiActivePosition.get(player.id) ?? player.position;
                    return (
                      <tr key={player.id} className="group border-b border-app-border/20 transition-colors last:border-0 hover:bg-white/5">
                        <td className="flex items-center gap-1.5 px-3 py-2.5">
                          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-app-border/50 bg-white/5">
                            <Target className="h-2 w-2 text-app-text-muted group-hover:text-white" />
                          </div>
                          <span className="text-app-text">{player.match_name}</span>
                        </td>
                        <td className="py-2.5 text-[10px] text-app-text-muted">{activePosition}</td>
                        <td className="py-2.5 text-center"><RoleDots value={activePosition.includes("Striker") ? 3 : 0} /></td>
                        <td className="py-2.5 text-center"><RoleDots value={activePosition.includes("Midfielder") ? 2 : 0} /></td>
                        <td className="py-2.5 text-center"><RoleDots value={activePosition.includes("Midfielder") ? 3 : 1} /></td>
                        <td className="py-2.5 text-center"><RoleDots value={activePosition.includes("Defensive") ? 3 : 0} /></td>
                        <td className="py-2.5 text-center"><RoleDots value={activePosition.includes("Defender") ? 3 : 0} /></td>
                        <td className="py-2.5 pr-3 text-center"><RoleDots value={activePosition.includes("Back") ? 3 : 0} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TemplateCard>

          <TacticsFilters
            onClear={handleClearFilters}
            onPlayerSearchChange={setPlayerSearch}
            onPositionFilterChange={setPositionFilter}
            playerSearch={playerSearch}
            positionFilter={positionFilter}
          />
          <TacticsPlayerTable
            emptyMessage={t("squad.noLineupMatches")}
            highlightedPlayerId={selectedPlayerId}
            onSelectPlayer={onSelectPlayer}
            players={filteredStartingXI}
            section="xi"
            sortDir={sortDir}
            sortKey={sortKey}
            title={t("preMatch.startingXI")}
            toggleSort={toggleSort}
            totalCount={startingXI.length}
            xiActivePosition={xiActivePosition}
          />
          <TacticsPlayerTable
            emptyMessage={t("squad.noBenchMatches")}
            highlightedPlayerId={selectedPlayerId}
            onSelectPlayer={onSelectPlayer}
            players={filteredBench}
            section="bench"
            sortDir={sortDir}
            sortKey={sortKey}
            title={t("preMatch.substitutes")}
            toggleSort={toggleSort}
            totalCount={bench.length}
            xiActivePosition={xiActivePosition}
          />
        </div>

        <div data-testid="tactics-template-sidebar" className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
              <span>TACTICAL FAMILIARITY</span>
              <Info className="h-3.5 w-3.5 cursor-pointer text-app-text-muted transition-colors hover:text-white" />
            </div>
            <div className="flex items-center justify-between gap-3 text-app-green">
              <span className="text-xs font-semibold">High</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full border border-app-border bg-app-card">
                <div className="h-full w-[85%] rounded-full bg-app-green shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
              </div>
            </div>
          </div>

          <PhaseCard title="IN POSSESSION" icon={<Goal className="h-4 w-4" />}>
            <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
              <PhaseItem text="Shorter Passing" />
              <PhaseItem text="Overlap Left" />
              <PhaseItem text="Higher Tempo" />
              <PhaseItem text="Overlap Right" />
              <PhaseItem text="Fairly Wide" />
              <PhaseItem text="Work Ball Into Box" />
            </div>
          </PhaseCard>

          <PhaseCard title="IN TRANSITION" icon={<ArrowRightLeft className="h-4 w-4" />}>
            <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
              <PhaseItem text="Counter-Press" />
              <PhaseItem text="Distribute To" />
              <PhaseItem text="Counter" />
              <PhaseItem text="Center-Backs" />
            </div>
          </PhaseCard>

          <PhaseCard title="OUT OF POSSESSION" icon={<ShieldAlert className="h-4 w-4" />}>
            <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
              <PhaseItem text="Higher Defensive Line" />
              <PhaseItem text="Prevent Short GK" />
              <PhaseItem text="Higher Line of Engagement" />
              <PhaseItem text="Trigger Press More Often" />
              <PhaseItem text="Trap Inside" />
            </div>
          </PhaseCard>

          <TemplateCard className="flex flex-col">
            <div className="flex items-center justify-between border-b border-app-border/50 p-3">
              <div className="flex flex-col">
                <span className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TEAM INSTRUCTIONS</span>
                <span className="text-[10px] text-app-text-muted">12 Active Instructions</span>
              </div>
              <ChevronRight className="h-4 w-4 text-app-text-muted" />
            </div>
            <div className="grid grid-cols-3 divide-x divide-app-border/50 bg-white/[0.01]">
              <InstructionQuickStat icon={<Target className="h-3.5 w-3.5" />} title="Focus Play" val="Down Both Flanks" />
              <InstructionQuickStat icon={<ArrowRightLeft className="h-3.5 w-3.5" />} title="Defensive Width" val="Standard" />
              <InstructionQuickStat icon={<Activity className="h-3.5 w-3.5" />} title="Tempo" val="Higher" />
            </div>
          </TemplateCard>

          <TemplateCard className="flex flex-col p-4 pb-2">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TACTICAL ANALYSIS</span>
              <Settings2 className="h-3.5 w-3.5 cursor-pointer text-app-text-muted transition-colors hover:text-white" />
            </div>
            <div className="flex flex-col gap-3">
              <AnalStat label="Attack Balance" val="Right" pct={75} />
              <AnalStat label="Pressing Intensity" val="High" pct={80} />
              <AnalStat label="Width" val="Fairly Wide" pct={65} />
              <AnalStat label="Directness" val="Balanced" pct={50} />
              <AnalStat label="Defensive Compactness" val="Compact" pct={85} />
            </div>
            <div className="mt-4 flex min-h-[110px] flex-1 items-end gap-2 px-1">
              {[85, 75, 90, 60, 80].map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t bg-app-green/25" style={{ height: `${value}px` }}>
                    <div className="h-full w-full rounded-t bg-app-green/70" />
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-app-green" />
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-app-border/50 pt-2 text-[10px] text-app-text-muted">
              <div className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-white">
                <AlertTriangle className="h-3 w-3 text-app-text-muted" />
                <span>Training Focus: <span className="text-indigo-400">Chance Creation</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                Tactical Familiarity: <span className="font-semibold text-app-green">High</span> <div className="h-1.5 w-1.5 rounded-full bg-app-green" />
              </div>
            </div>
          </TemplateCard>

          <TacticsPlayerFocusPanel
            canConfirmSwap={canConfirmSwap}
            onConfirmSwap={() => {
              void handleConfirmSwap();
            }}
            selectedPlayer={selectedPlayer}
            comparePlayer={comparePlayer}
          />
          <TacticsRolesPanel
            allSquad={roster}
            matchRoles={myTeam.match_roles}
            onGameUpdate={onGameUpdate}
            startingPlayers={startingXI}
          />
        </div>
      </div>
    </div>
  );
}
