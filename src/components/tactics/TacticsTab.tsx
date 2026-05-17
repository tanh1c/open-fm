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
import {
  buildTacticsRoster,
  countOutOfPositionPlayers,
  getSelectedAndComparePlayers,
  resolveStartingXiIds,
} from "./TacticsTab.helpers";
import TacticsPitch from "./TacticsPitch";
import TacticsPlayerFocusPanel from "./TacticsPlayerFocusPanel";
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

type TacticsViewTab = "overview" | "roles" | "instructions" | "setPieces" | "analysis";

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

function getTabClassName(activeTab: TacticsViewTab, tab: TacticsViewTab): string {
  return cx(
    "-mb-[2px] pb-3 font-medium transition-colors",
    activeTab === tab
      ? "border-b-2 border-app-green font-semibold text-app-green"
      : "text-app-text-muted hover:text-white",
  );
}

function HeaderButton({ children, disabled = false, icon, onClick, primary = false }: { children: ReactNode; disabled?: boolean; icon: ReactNode; onClick?: () => void; primary?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors",
        primary
          ? "bg-app-green font-bold text-app-bg hover:bg-app-green/90"
          : "border border-app-border bg-app-card font-medium hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-50 hover:bg-app-card",
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

function SetPieceBadge({ disabled = false, icon, title, desc, className }: { disabled?: boolean; icon: ReactNode; title: string; desc: string; className?: string }): JSX.Element {
  return (
    <div className={cx("flex flex-col gap-2 rounded-lg border border-app-border/80 bg-[#141b24] p-2.5 transition-colors", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/5", className)}>
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
        <span className="text-[9px] font-semibold uppercase tracking-wider text-app-text-muted">Later</span>
      </div>
      {children}
      <button type="button" disabled className="group flex w-fit cursor-not-allowed items-center gap-1 text-[10px] text-app-text-muted opacity-50">
        <ChevronRight className="h-3 w-3" />
        Engine pending
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

function getCurrentStandingPosition(gameState: GameStateData, teamId: string): number | null {
  const standings = gameState.league?.standings;
  if (!standings) return null;

  const sorted = [...standings].sort((left, right) => {
    const leftGoalDifference = left.goals_for - left.goals_against;
    const rightGoalDifference = right.goals_for - right.goals_against;
    return (
      right.points - left.points ||
      rightGoalDifference - leftGoalDifference ||
      right.goals_for - left.goals_for
    );
  });

  const index = sorted.findIndex((standing) => standing.team_id === teamId);
  return index >= 0 ? index + 1 : null;
}

function getNextFixture(gameState: GameStateData, teamId: string) {
  return gameState.league?.fixtures
    .filter(
      (fixture) =>
        fixture.status === "Scheduled" &&
        (fixture.home_team_id === teamId || fixture.away_team_id === teamId),
    )
    .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null;
}

function getLatestCompletedFixture(gameState: GameStateData, teamId: string) {
  return gameState.league?.fixtures
    .filter(
      (fixture) =>
        fixture.status === "Completed" &&
        fixture.result &&
        (fixture.home_team_id === teamId || fixture.away_team_id === teamId),
    )
    .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function getTeamName(gameState: GameStateData, teamId: string): string {
  return gameState.teams.find((team) => team.id === teamId)?.short_name ||
    gameState.teams.find((team) => team.id === teamId)?.name ||
    teamId;
}

function getPlayStyleInstructions(playStyle: string): {
  inPossession: string[];
  inTransition: string[];
  outOfPossession: string[];
} {
  const base = {
    inPossession: ["Balanced Passing", "Standard Width", "Mixed Tempo", "Work Into Space"],
    inTransition: ["Regroup", "Counter When Open", "Distribute To Best Option"],
    outOfPossession: ["Standard Line", "Balanced Press", "Protect Central Areas"],
  };

  if (playStyle === "Attacking") {
    return {
      inPossession: ["Higher Tempo", "Attack Wide Areas", "Work Ball Into Box", "More Forward Runs"],
      inTransition: ["Counter", "Quick Distribution", "Commit Runners"],
      outOfPossession: ["Higher Line", "Press More Often", "Prevent Short GK"],
    };
  }

  if (playStyle === "Defensive") {
    return {
      inPossession: ["Lower Tempo", "Retain Possession", "Safer Passing"],
      inTransition: ["Regroup", "Hold Shape", "Slow Distribution"],
      outOfPossession: ["Lower Block", "Stay Compact", "Trap Outside"],
    };
  }

  if (playStyle === "Possession") {
    return {
      inPossession: ["Shorter Passing", "Patient Build-up", "Work Ball Into Box", "Support Angles"],
      inTransition: ["Counter-Press", "Recycle Possession", "Distribute Short"],
      outOfPossession: ["Counter-Press", "Hold Shape", "Protect Central Areas"],
    };
  }

  if (playStyle === "Counter") {
    return {
      inPossession: ["Direct Passing", "Exploit Space", "Early Crosses", "Fast Transitions"],
      inTransition: ["Counter", "Quick Distribution", "Release Wide Players"],
      outOfPossession: ["Mid Block", "Stay Compact", "Invite Pressure"],
    };
  }

  if (playStyle === "HighPress") {
    return {
      inPossession: ["Higher Tempo", "Vertical Passing", "Play Into Channels"],
      inTransition: ["Counter-Press", "Immediate Pressure", "Fast Recovery Runs"],
      outOfPossession: ["Higher Line", "Trigger Press More Often", "Prevent Short GK"],
    };
  }

  return base;
}

function getTacticalProfile(playStyle: string, outOfPositionCount: number): Array<{ label: string; val: string; pct: number }> {
  const profiles: Record<string, Array<{ label: string; val: string; pct: number }>> = {
    Attacking: [
      { label: "Attack Balance", val: "Aggressive", pct: 88 },
      { label: "Pressing Intensity", val: "High", pct: 82 },
      { label: "Width", val: "Wide", pct: 74 },
      { label: "Directness", val: "Forward", pct: 78 },
      { label: "Defensive Compactness", val: "Open", pct: 48 },
    ],
    Defensive: [
      { label: "Attack Balance", val: "Cautious", pct: 42 },
      { label: "Pressing Intensity", val: "Low", pct: 38 },
      { label: "Width", val: "Narrow", pct: 45 },
      { label: "Directness", val: "Safe", pct: 40 },
      { label: "Defensive Compactness", val: "Compact", pct: 88 },
    ],
    Possession: [
      { label: "Attack Balance", val: "Patient", pct: 68 },
      { label: "Pressing Intensity", val: "Medium", pct: 62 },
      { label: "Width", val: "Balanced", pct: 58 },
      { label: "Directness", val: "Short", pct: 35 },
      { label: "Defensive Compactness", val: "Stable", pct: 70 },
    ],
    Counter: [
      { label: "Attack Balance", val: "Vertical", pct: 72 },
      { label: "Pressing Intensity", val: "Selective", pct: 55 },
      { label: "Width", val: "Wide", pct: 68 },
      { label: "Directness", val: "Direct", pct: 85 },
      { label: "Defensive Compactness", val: "Compact", pct: 78 },
    ],
    HighPress: [
      { label: "Attack Balance", val: "Front Foot", pct: 80 },
      { label: "Pressing Intensity", val: "Very High", pct: 94 },
      { label: "Width", val: "Balanced", pct: 62 },
      { label: "Directness", val: "Vertical", pct: 70 },
      { label: "Defensive Compactness", val: "High Risk", pct: 56 },
    ],
  };

  return (profiles[playStyle] ?? [
    { label: "Attack Balance", val: "Balanced", pct: 60 },
    { label: "Pressing Intensity", val: "Medium", pct: 58 },
    { label: "Width", val: "Standard", pct: 55 },
    { label: "Directness", val: "Mixed", pct: 52 },
    { label: "Defensive Compactness", val: "Stable", pct: 65 },
  ]).map((item) => ({ ...item, pct: Math.max(15, item.pct - outOfPositionCount * 4) }));
}

function getFamiliarity(startingXI: PlayerData[], outOfPositionCount: number): { label: string; pct: number } {
  const averageCondition = startingXI.length > 0
    ? startingXI.reduce((sum, player) => sum + player.condition, 0) / startingXI.length
    : 0;
  const pct = Math.max(20, Math.min(100, Math.round(averageCondition - outOfPositionCount * 8)));

  if (pct >= 80) return { label: "High", pct };
  if (pct >= 60) return { label: "Good", pct };
  if (pct >= 40) return { label: "Developing", pct };
  return { label: "Low", pct };
}

export default function TacticsTab({
  gameState,
  onGameUpdate,
}: TacticsTabProps): JSX.Element {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );
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
  const [overviewSidebarMode, setOverviewSidebarMode] =
    useState<"playStyle" | "focus">("playStyle");
  const [activeViewTab, setActiveViewTab] =
    useState<TacticsViewTab>("overview");
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

  async function handleTrainingFocusChange(focus: string): Promise<void> {
    const intensity = myTeam?.training_intensity || "Medium";

    try {
      const updated = await invoke<GameStateData>("set_training", {
        focus,
        intensity,
      });
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set training focus:", error);
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
    setOverviewSidebarMode("focus");

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

  const nextFixture = getNextFixture(gameState, myTeam.id);
  const latestCompletedFixture = getLatestCompletedFixture(gameState, myTeam.id);
  const opponentId = nextFixture
    ? nextFixture.home_team_id === myTeam.id
      ? nextFixture.away_team_id
      : nextFixture.home_team_id
    : null;
  const opponentName = opponentId ? getTeamName(gameState, opponentId) : "No fixture";
  const opponentPosition = opponentId
    ? getCurrentStandingPosition(gameState, opponentId)
    : null;
  const recentReport = latestCompletedFixture?.result?.report;
  const myRecentStats = latestCompletedFixture && recentReport
    ? latestCompletedFixture.home_team_id === myTeam.id
      ? recentReport.home_stats
      : recentReport.away_stats
    : null;
  const nextOpponentStanding = opponentPosition ? `${opponentName} (${opponentPosition})` : opponentName;
  const playStyleInstructions = getPlayStyleInstructions(activePlayStyle);
  const tacticalProfile = getTacticalProfile(activePlayStyle, outOfPositionCount);
  const familiarity = getFamiliarity(startingXI, outOfPositionCount);
  const focusPlay = activePlayStyle === "WingPlay" ? "Down Both Flanks" : activePlayStyle === "Possession" ? "Central Overloads" : activePlayStyle === "Counter" ? "Into Space" : "Mixed";
  const defensiveWidth = activePlayStyle === "Defensive" ? "Narrow" : activePlayStyle === "Attacking" ? "Wide" : "Standard";
  const tempo = activePlayStyle === "Possession" || activePlayStyle === "Defensive" ? "Lower" : activePlayStyle === "Balanced" ? "Standard" : "Higher";

  const setPieceQuickAccess = (
    <div className="flex flex-col gap-2">
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SET PIECE QUICK ACCESS</h3>
      <div className="grid grid-cols-2 gap-2">
        <SetPieceBadge icon={<Target className="h-4 w-4" />} title="Corners" desc={myTeam.match_roles?.corner_taker ? playersById.get(myTeam.match_roles.corner_taker)?.match_name ?? "Assigned" : "Assign below"} />
        <SetPieceBadge icon={<Grid className="h-4 w-4" />} title="Free Kicks" desc={myTeam.match_roles?.free_kick_taker ? playersById.get(myTeam.match_roles.free_kick_taker)?.match_name ?? "Assigned" : "Assign below"} />
        <SetPieceBadge disabled icon={<ArrowRightLeft className="h-4 w-4" />} title="Throw-ins" desc="Engine pending" className="col-span-2" />
      </div>
    </div>
  );

  const opponentFocusCard = (
    <div className="flex flex-col gap-2">
      <h3 className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
        OPPONENT FOCUS
        <span className="font-medium normal-case text-app-text">{nextOpponentStanding}</span>
      </h3>
      <TemplateCard className="flex flex-col">
        <div className="flex flex-col gap-3 p-3">
          <OpponentTrait icon="★" color="bg-yellow-500/20 text-yellow-500" title={nextFixture ? `${nextFixture.competition} matchday ${nextFixture.matchday}` : "No upcoming fixture"} desc={nextFixture ? nextFixture.date : "Advance time to generate fixtures"} />
          <OpponentTrait icon="⚡" color="bg-yellow-500/20 text-yellow-500" title={opponentPosition ? `League position ${opponentPosition}` : "Opponent table data pending"} desc={opponentId ? getTeamName(gameState, opponentId) : "No opponent selected"} />
          <OpponentTrait icon="!" color="bg-red-500/20 text-red-500" title={outOfPositionCount > 0 ? `${outOfPositionCount} lineup risks` : "Lineup shape stable"} desc={outOfPositionCount > 0 ? t("squad.outOfPosition") : formation} />
        </div>
        <button type="button" disabled className="group flex h-8 cursor-not-allowed items-center justify-between border-t border-app-border/50 px-3 text-[10px] text-app-text-muted opacity-50">
          Scouting report engine later
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </TemplateCard>
    </div>
  );

  const roleSuitabilityCard = (
    <TemplateCard className="flex min-h-[200px] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-app-border p-3">
        <h3 className="mb-0 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ROLE SUITABILITY</h3>
        <span className="text-[10px] text-app-text-muted">Starting XI roles</span>
      </div>
      <div className="border-b border-app-border/40 px-3 py-2 text-[10px] text-app-text-muted">
        Click one player to select, then another row to compare and enable swap.
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
            {startingXI.map((player) => {
              const activePosition = xiActivePosition.get(player.id) ?? player.position;
              return (
                <tr
                  key={player.id}
                  className={cx(
                    "group cursor-pointer border-b border-app-border/20 transition-colors last:border-0 hover:bg-white/5",
                    (selectedPlayerId === player.id || comparePlayerId === player.id) && "bg-app-green/10",
                  )}
                  onClick={() => {
                    void handleLineupPlayerClick(player.id, "xi");
                  }}
                >
                  <td className="flex items-center gap-1.5 px-3 py-2.5">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-app-border/50 bg-white/5">
                      <Target className="h-2 w-2 text-app-text-muted group-hover:text-white" />
                    </div>
                    <span className="text-app-text">{player.match_name}</span>
                    {selectedPlayerId === player.id ? <span className="rounded bg-app-green/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-app-green">Selected</span> : null}
                    {comparePlayerId === player.id ? <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-400">Compare</span> : null}
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
  );

  const instructionsContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,_1fr)_360px]">
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-1">
        <PhaseCard title="IN POSSESSION" icon={<Goal className="h-4 w-4" />}>
          <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
            {playStyleInstructions.inPossession.map((instruction) => (
              <PhaseItem key={instruction} text={instruction} />
            ))}
          </div>
        </PhaseCard>
        <PhaseCard title="IN TRANSITION" icon={<ArrowRightLeft className="h-4 w-4" />}>
          <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
            {playStyleInstructions.inTransition.map((instruction) => (
              <PhaseItem key={instruction} text={instruction} />
            ))}
          </div>
        </PhaseCard>
        <PhaseCard title="OUT OF POSSESSION" icon={<ShieldAlert className="h-4 w-4" />}>
          <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
            {playStyleInstructions.outOfPossession.map((instruction) => (
              <PhaseItem key={instruction} text={instruction} />
            ))}
          </div>
        </PhaseCard>
      </div>
      <TemplateCard className="flex flex-col self-start">
        <div className="flex items-center justify-between border-b border-app-border/50 p-3">
          <div className="flex flex-col">
            <span className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TEAM INSTRUCTIONS</span>
            <span className="text-[10px] text-app-text-muted">{t("tactics.playStyles." + activePlayStyle, activePlayStyle)} profile</span>
          </div>
          <ChevronRight className="h-4 w-4 text-app-text-muted" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-app-border/50 bg-white/[0.01]">
          <InstructionQuickStat icon={<Target className="h-3.5 w-3.5" />} title="Focus Play" val={focusPlay} />
          <InstructionQuickStat icon={<ArrowRightLeft className="h-3.5 w-3.5" />} title="Defensive Width" val={defensiveWidth} />
          <InstructionQuickStat icon={<Activity className="h-3.5 w-3.5" />} title="Tempo" val={tempo} />
        </div>
      </TemplateCard>
    </div>
  );

  const analysisContent = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,_1fr)_360px]">
      <TemplateCard className="flex flex-col p-4 pb-2">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TACTICAL ANALYSIS</span>
          <Settings2 className="h-3.5 w-3.5 text-app-text-muted" />
        </div>
        <div className="flex flex-col gap-3">
          {tacticalProfile.map((stat) => (
            <AnalStat key={stat.label} label={stat.label} val={stat.val} pct={stat.pct} />
          ))}
        </div>
        {myRecentStats ? (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-app-border/60 bg-black/10 p-2 text-center text-[10px] text-app-text-muted">
            <div>
              <div className="font-bold text-app-text">{myRecentStats.possession_pct}%</div>
              <div>Poss</div>
            </div>
            <div>
              <div className="font-bold text-app-text">{myRecentStats.shots_on_target}/{myRecentStats.shots}</div>
              <div>Shots</div>
            </div>
            <div>
              <div className="font-bold text-app-text">{myRecentStats.corners}</div>
              <div>Corners</div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex min-h-[110px] flex-1 items-end gap-2 px-1">
          {tacticalProfile.map((stat) => (
            <div key={stat.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-app-green/25" style={{ height: `${Math.max(20, stat.pct)}px` }}>
                <div className="h-full w-full rounded-t bg-app-green/70" />
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-app-green" />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 border-t border-app-border/50 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {tacticalProfile.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-app-border/60 bg-black/10 px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-app-green" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-app-text">{stat.label}</span>
              </div>
              <div className="mt-1 text-[10px] text-app-text-muted">
                {stat.val} · {stat.pct}% tactical weight
              </div>
            </div>
          ))}
        </div>
      </TemplateCard>
      <TemplateCard className="flex flex-col gap-4 p-4 self-start">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
            <span>TACTICAL FAMILIARITY</span>
            <Info className="h-3.5 w-3.5 text-app-text-muted" />
          </div>
          <div className="flex items-center justify-between gap-3 text-app-green">
            <span className="text-xs font-semibold">{familiarity.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full border border-app-border bg-app-card">
              <div className="h-full rounded-full bg-app-green shadow-[0_0_8px_rgba(45,212,191,0.5)]" style={{ width: `${familiarity.pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-app-border/50 pt-3 text-[10px] text-app-text-muted">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-app-text-muted" />
            <span>Training Focus: <button type="button" onClick={() => void handleTrainingFocusChange("Tactical")} className="text-indigo-400 hover:text-indigo-300">{myTeam.training_focus || "Tactical"}</button></span>
          </div>
        </div>
      </TemplateCard>
    </div>
  );

  return (
    <div data-testid="tactics-template-layout" className="mx-auto flex min-h-max max-w-[1600px] flex-col gap-4">
      <div
        ref={dragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-surface-900/90 shadow-lg"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">TACTICS</h1>
          <p className="text-sm text-app-text-muted">
            {myTeam.name} &bull; {t("tactics.playStyles." + activePlayStyle, activePlayStyle)} &bull; Match Preparation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <HeaderButton disabled icon={<Save className="h-4 w-4 text-app-text-muted" />}>Preset save later</HeaderButton>
          <div className="flex overflow-hidden rounded-lg border border-app-border bg-app-card opacity-50 transition-colors">
            <button type="button" disabled className="flex cursor-not-allowed items-center gap-2 border-r border-app-border/50 px-3 py-2 text-sm font-medium">
              <Download className="h-4 w-4 text-app-text-muted" />
              Preset load later
            </button>
            <button type="button" disabled className="cursor-not-allowed px-2 py-2">
              <ChevronDown className="h-4 w-4 text-app-text-muted" />
            </button>
          </div>
          <HeaderButton disabled icon={<Settings2 className="h-4 w-4 text-app-text-muted" />}>Match plan later</HeaderButton>
          <HeaderButton primary icon={<Check className="h-4 w-4" />}>Changes auto-save</HeaderButton>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-8 border-b border-app-border/50 px-2">
        <button type="button" onClick={() => setActiveViewTab("overview")} className={getTabClassName(activeViewTab, "overview")}>Overview</button>
        <button type="button" onClick={() => setActiveViewTab("roles")} className={getTabClassName(activeViewTab, "roles")}>Player Roles</button>
        <button type="button" onClick={() => setActiveViewTab("instructions")} className={getTabClassName(activeViewTab, "instructions")}>Team Instructions</button>
        <button type="button" onClick={() => setActiveViewTab("setPieces")} className={getTabClassName(activeViewTab, "setPieces")}>Set Pieces</button>
        <button type="button" onClick={() => setActiveViewTab("analysis")} className={getTabClassName(activeViewTab, "analysis")}>Analysis</button>
      </div>

      {activeViewTab === "overview" ? (
        <div className="mt-2 flex flex-col gap-4 xl:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[280px]">
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TACTICAL PRESETS</h3>
            <PresetRow name="Gegenpress" desc={formation} active />
            <PresetRow name="Control Possession" desc="4-3-3 DM Wide" onClick={() => void handleFormationChange("4-3-3")} />
            <PresetRow name="Vertical Tiki-Taka" desc="4-3-1-2 Narrow" onClick={() => void handleFormationChange("4-3-3")} />
            <PresetRow name="Wing Play" desc="4-2-3-1 Wide" onClick={() => void handleFormationChange("4-2-3-1")} />
            <PresetRow name="Direct Counter Attack" desc="4-4-2" onClick={() => void handleFormationChange("4-4-2")} />
            <button type="button" disabled className="mt-1 flex w-full cursor-not-allowed items-center justify-between rounded-lg border border-app-border px-3 py-2 text-[11px] text-app-text-muted opacity-50">
              Preset manager later
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {opponentFocusCard}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <TacticsPitch
            benchPlayers={bench}
            dragState={dragState}
            formation={formation}
            comparePlayerId={comparePlayerId}
            hoveredSlot={hoveredSlot}
            onClearSelection={clearLineupSelection}
            onFormationChange={(nextFormation) => {
              void handleFormationChange(nextFormation);
            }}
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
        </div>

        <div data-testid="tactics-template-sidebar" className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">
          <TemplateCard className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
              <span>TACTICAL FAMILIARITY</span>
              <Info className="h-3.5 w-3.5 text-app-text-muted" />
            </div>
            <div className="flex items-center justify-between gap-3 text-app-green">
              <span className="text-xs font-semibold">{familiarity.label}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full border border-app-border bg-app-card">
                <div className="h-full rounded-full bg-app-green shadow-[0_0_8px_rgba(45,212,191,0.5)]" style={{ width: `${familiarity.pct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-app-border/50 rounded-lg border border-app-border/50 bg-white/[0.01]">
              <InstructionQuickStat icon={<Target className="h-3.5 w-3.5" />} title="Focus" val={focusPlay} />
              <InstructionQuickStat icon={<ArrowRightLeft className="h-3.5 w-3.5" />} title="Width" val={defensiveWidth} />
              <InstructionQuickStat icon={<Activity className="h-3.5 w-3.5" />} title="Tempo" val={tempo} />
            </div>
          </TemplateCard>

          <div className="flex rounded-lg border border-app-border bg-app-card p-1">
            <button
              type="button"
              onClick={() => setOverviewSidebarMode("playStyle")}
              className={cx(
                "flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                overviewSidebarMode === "playStyle" ? "bg-app-green/15 text-app-green" : "text-app-text-muted hover:bg-white/5 hover:text-white",
              )}
            >
              Play Style
            </button>
            <button
              type="button"
              onClick={() => setOverviewSidebarMode("focus")}
              disabled={!selectedPlayer}
              className={cx(
                "flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                overviewSidebarMode === "focus" ? "bg-app-green/15 text-app-green" : "text-app-text-muted hover:bg-white/5 hover:text-white",
                !selectedPlayer && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-app-text-muted",
              )}
            >
              Player Focus
            </button>
          </div>

          {overviewSidebarMode === "focus" && selectedPlayer ? (
            <TacticsPlayerFocusPanel
              canConfirmSwap={canConfirmSwap}
              onConfirmSwap={() => {
                void handleConfirmSwap();
              }}
              selectedPlayer={selectedPlayer}
              comparePlayer={comparePlayer}
            />
          ) : (
            <TacticsSetupPanel
              activePlayStyle={activePlayStyle}
              formation={formation}
              onFormationChange={(nextFormation) => {
                void handleFormationChange(nextFormation);
              }}
              onPlayStyleChange={(playStyle) => {
                void handlePlayStyleChange(playStyle);
              }}
              showFormation={false}
            />
          )}
        </div>
      </div>
      ) : null}

      {activeViewTab === "roles" ? (
        <div className="mt-2 grid gap-4 xl:grid-cols-[minmax(0,_1fr)_360px]">
          {roleSuitabilityCard}
          <TacticsPlayerFocusPanel
            canConfirmSwap={canConfirmSwap}
            onConfirmSwap={() => {
              void handleConfirmSwap();
            }}
            selectedPlayer={selectedPlayer}
            comparePlayer={comparePlayer}
          />
        </div>
      ) : null}

      {activeViewTab === "instructions" ? (
        <div className="mt-2">
          {instructionsContent}
        </div>
      ) : null}

      {activeViewTab === "setPieces" ? (
        <div className="mt-2 grid gap-4 xl:grid-cols-[280px_minmax(0,_1fr)]">
          <div className="flex flex-col gap-4">
            {setPieceQuickAccess}
            <TemplateCard className="p-3 text-[11px] text-app-text-muted">
              Throw-ins and detailed routines are marked engine pending until backend support exists.
            </TemplateCard>
          </div>
          <TacticsRolesPanel
            allSquad={roster}
            matchRoles={myTeam.match_roles}
            onGameUpdate={onGameUpdate}
            startingPlayers={startingXI}
          />
        </div>
      ) : null}

      {activeViewTab === "analysis" ? (
        <div className="mt-2">
          {analysisContent}
        </div>
      ) : null}
    </div>
  );
}
