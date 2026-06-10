import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { FixtureData, GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import { getFixtureDisplayLabel } from "../../lib/helpers";
import { EnginePlayerData, EngineTeamData, MatchSnapshot, FORMATIONS, PLAY_STYLES } from "./types";
import PreMatchLineup, { parseFormationNeeds } from "./PreMatchLineup";
import {
  buildGridAssignmentsFromFormation,
  buildGridAssignmentsFromSavedSlots,
  deriveFormationFromGridAssignments,
  GRID_TACTIC_SLOTS,
  mapGridSlotToPosition,
  PRESET_GRID_SLOT_IDS,
  toBackendGridSlots,
  type GridTacticAssignment,
} from "../tactics/TacticsTab.helpers";
import { getPlayerOvrForPosition } from "../../lib/playerOvr";
import { getSlotFitTone } from "../squad/SquadTab.helpers";
import TeamLogo from "../common/TeamLogo";
import MatchScreenLayout, { MatchPageAction } from "./MatchScreenLayout";
import SetPieceSelector from "./SetPieceSelector";
import {
  Shield,
  Zap,
  Target,
  RefreshCw,
  Crosshair,
  Flag,
  Crown,
  Footprints,
  CornerDownRight,
  CircleDot,
  Wand2,
} from "lucide-react";

interface PreMatchSetupProps {
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  currentFixture?: FixtureData | null;
  userSide: "Home" | "Away";
  onBackToDashboard: () => void;
  onStart: () => void;
  onUpdateSnapshot: (snap: MatchSnapshot) => void;
}

const PLAY_STYLE_ICONS: Record<string, React.ReactNode> = {
  Balanced: <Target className="w-4 h-4" />,
  Attacking: <Zap className="w-4 h-4" />,
  Defensive: <Shield className="w-4 h-4" />,
  Possession: <RefreshCw className="w-4 h-4" />,
  Counter: <Crosshair className="w-4 h-4" />,
  HighPress: <Flag className="w-4 h-4" />,
};

function findTeamData(gameState: GameStateData, teamId: string) {
  return gameState.teams.find((team) => team.id === teamId);
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

function PrematchTeamHeader({
  label,
  team,
  teamData,
  teamColor,
  align,
  playStyle,
}: {
  label: string;
  team: EngineTeamData;
  teamData: TeamData | undefined;
  teamColor: string;
  align: "left" | "right";
  playStyle: string;
}) {
  const isRight = align === "right";

  return (
    <div className={`flex min-w-0 items-center gap-4 ${isRight ? "justify-end text-right" : ""}`}>
      {!isRight && (
        <TeamBadge team={team} teamData={teamData} teamColor={teamColor} />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-app-green">
          {label}
        </p>
        <p className="truncate font-heading text-xl font-black tracking-tight text-app-text">
          {team.name}
        </p>
        <p className="truncate text-xs font-semibold text-app-text-muted">
          {team.formation} · {playStyle}
        </p>
      </div>
      {isRight && (
        <TeamBadge team={team} teamData={teamData} teamColor={teamColor} />
      )}
    </div>
  );
}

function TeamBadge({
  team,
  teamData,
  teamColor,
}: {
  team: EngineTeamData;
  teamData: TeamData | undefined;
  teamColor: string;
}) {
  return teamData ? (
    <TeamLogo
      team={teamData}
      className="h-16 w-16 rounded-2xl border border-app-border bg-white/95 p-2 shadow-lg shadow-black/25"
    />
  ) : (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 font-heading text-lg font-black text-app-text shadow-lg shadow-black/20"
      style={{ backgroundColor: `${teamColor}30`, borderColor: teamColor }}
    >
      {team.name.substring(0, 3).toUpperCase()}
    </div>
  );
}

export default function PreMatchSetup({
  snapshot,
  gameState,
  currentFixture,
  userSide,
  onBackToDashboard,
  onStart,
  onUpdateSnapshot,
}: PreMatchSetupProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"lineup" | "setpieces">("lineup");
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(
    null,
  );
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);

  const userTeam =
    userSide === "Home" ? snapshot.home_team : snapshot.away_team;
  const oppTeam = userSide === "Home" ? snapshot.away_team : snapshot.home_team;
  const userSetPieces =
    userSide === "Home" ? snapshot.home_set_pieces : snapshot.away_set_pieces;

  const homeTeamData = findTeamData(gameState, snapshot.home_team.id);
  const awayTeamData = findTeamData(gameState, snapshot.away_team.id);
  const userTeamData = userSide === "Home" ? homeTeamData : awayTeamData;
  const homeTeamColor = homeTeamData?.colors?.primary || "#10b981";
  const awayTeamColor = awayTeamData?.colors?.primary || "#6366f1";
  const userColor = userSide === "Home" ? homeTeamColor : awayTeamColor;
  const fixtureLabel = currentFixture
    ? getFixtureDisplayLabel(t, currentFixture)
    : t("match.matchDay");

  // All squad players for this team
  const allSquadPlayers = gameState.players.filter(
    (p) => p.team_id === userTeam.id,
  );
  // Use snapshot bench data (updated after swaps)
  const userBench =
    userSide === "Home" ? snapshot.home_bench || [] : snapshot.away_bench || [];
  const matchFormation = useMemo(() => {
    const pool = [...userTeam.players, ...userBench];
    const availablePlayerIds = new Set(pool.map((player) => player.id));
    const fallbackAssignments = buildGridAssignmentsFromFormation(
      userTeam.formation,
      userTeam.players.map((player) => player.id),
    );
    const assignments = buildGridAssignmentsFromSavedSlots(
      userTeamData?.custom_tactic_slots,
      fallbackAssignments,
      availablePlayerIds,
    );

    return deriveFormationFromGridAssignments(assignments);
  }, [userBench, userTeam.formation, userTeam.players, userTeamData?.custom_tactic_slots]);

  console.info("[PreMatchSetup] render", {
    activeTab,
    allSquadCount: allSquadPlayers.length,
    awayTeam: snapshot.away_team.name,
    benchCount: userBench.length,
    homeTeam: snapshot.home_team.name,
    phase: snapshot.phase,
    playStyle: userTeam.play_style,
    selectedStarterId,
    setPieces: userSetPieces,
    startingPlayerCount: userTeam.players.length,
    userSide,
    userTeam: userTeam.name,
  });

  const handleFormationChange = async (formation: string) => {
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { ChangeFormation: { side: userSide, formation } },
      });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Formation change failed:", err);
    }
  };

  const handlePlayStyleChange = async (playStyle: string) => {
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { ChangePlayStyle: { side: userSide, play_style: playStyle } },
      });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Play style change failed:", err);
    }
  };

  const handleSwap = async (benchPlayerId: string, starterPlayerId = selectedStarterId) => {
    if (!starterPlayerId) return;
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: {
          PreMatchSwap: {
            side: userSide,
            player_off_id: starterPlayerId,
            player_on_id: benchPlayerId,
          },
        },
      });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Pre-match swap failed:", err);
    }
    setSelectedStarterId(null);
  };

  const handleSetPieceTaker = async (role: string, playerId: string) => {
    const commandMap: Record<string, string> = {
      penalty: "SetPenaltyTaker",
      freekick: "SetFreeKickTaker",
      corner: "SetCornerTaker",
      captain: "SetCaptain",
    };
    const cmdKey = commandMap[role];
    if (!cmdKey) return;
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { [cmdKey]: { side: userSide, player_id: playerId } },
      });
      onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Set piece taker change failed:", err);
    }
  };

  const formationNeeds = parseFormationNeeds(matchFormation);

  const handleAssignmentsChange = async (assignments: GridTacticAssignment[]) => {
    try {
      await invoke<GameStateData>("set_tactic_slots", {
        slots: toBackendGridSlots(assignments),
      });

      const nextFormation = deriveFormationFromGridAssignments(assignments);
      if (nextFormation !== userTeam.formation) {
        const snap = await invoke<MatchSnapshot>("apply_match_command", {
          command: { ChangeFormation: { side: userSide, formation: nextFormation } },
        });
        onUpdateSnapshot(snap);
      }
    } catch (err) {
      console.error("Failed to persist matchday tactic slots:", err);
    }
  };

  const buildCurrentAssignments = () => {
    const pool = [...userTeam.players, ...userBench];
    const availablePlayerIds = new Set(pool.map((player) => player.id));
    const fallbackAssignments = buildGridAssignmentsFromFormation(
      matchFormation,
      userTeam.players.map((player) => player.id),
    );
    return buildGridAssignmentsFromSavedSlots(
      userTeamData?.custom_tactic_slots,
      fallbackAssignments,
      availablePlayerIds,
    );
  };

  const handleAutoSelect = async (currentAssignments: GridTacticAssignment[]) => {
    setIsAutoSelecting(true);
    try {
      const squadById = new Map(allSquadPlayers.map((player) => [player.id, player]));
      const enginePool = [...userTeam.players, ...userBench];
      const pool = enginePool.map((player) => enginePlayerToPlayerData(player, squadById.get(player.id)));
      const availablePlayerIds = new Set(pool.map((player) => player.id));
      const baseAssignments = buildGridAssignmentsFromFormation(
        matchFormation,
        userTeam.players.map((player) => player.id),
      );
      const savedAssignments = buildGridAssignmentsFromSavedSlots(
        userTeamData?.custom_tactic_slots,
        baseAssignments,
        availablePlayerIds,
      );
      const slotAssignments = GRID_TACTIC_SLOTS.map((slot) => {
        const existing = currentAssignments.find((assignment) => assignment.slotId === slot.id)
          ?? savedAssignments.find((assignment) => assignment.slotId === slot.id)
          ?? { slotId: slot.id, playerId: null };
        return { ...existing };
      });

      const activeSlotIds = PRESET_GRID_SLOT_IDS[matchFormation] ?? PRESET_GRID_SLOT_IDS["4-4-2"];
      const takenIds = new Set<string>();
      const nextAssignments = GRID_TACTIC_SLOTS.map((slot) => {
        const slotState = slotAssignments.find((assignment) => assignment.slotId === slot.id);
        if (!activeSlotIds.includes(slot.id)) {
          return {
            slotId: slot.id,
            playerId: null,
            tacticalRole: slotState?.tacticalRole ?? null,
            duty: slotState?.duty ?? null,
          } satisfies GridTacticAssignment;
        }

        const slotPosition = mapGridSlotToPosition(slot.id);
        const candidates = pool
          .filter((player) => !takenIds.has(player.id))
          .map((player) => {
            const fitTone = getSlotFitTone(player, slotPosition);
            return {
              player,
              score:
                (fitTone === "good" ? 400 : fitTone === "ok" ? 150 : 0) +
                getPlayerOvrForPosition(player, slotPosition) * 8 +
                Math.round(player.condition),
            };
          })
          .sort((left, right) => right.score - left.score || left.player.match_name.localeCompare(right.player.match_name));
        const best = candidates[0]?.player ?? null;
        if (best) takenIds.add(best.id);
        return {
          slotId: slot.id,
          playerId: best?.id ?? null,
          tacticalRole: slotState?.tacticalRole ?? null,
          duty: slotState?.duty ?? null,
        } satisfies GridTacticAssignment;
      });

      const nextStarterIds = nextAssignments
        .filter((assignment) => assignment.playerId)
        .map((assignment) => assignment.playerId as string)
        .slice(0, 11);
      const currentStarterIds = userTeam.players.map((player) => player.id);
      const toAdd = nextStarterIds.filter((id) => !currentStarterIds.includes(id));
      const toRemove = currentStarterIds.filter((id) => !nextStarterIds.includes(id));
      const swaps: Array<{ offId: string; onId: string }> = [];
      toAdd.forEach((onId, index) => {
        const offId = toRemove[index];
        if (offId) swaps.push({ offId, onId });
      });

      let snap: MatchSnapshot | null = null;
      for (const swap of swaps) {
        snap = await invoke<MatchSnapshot>("apply_match_command", {
          command: {
            PreMatchSwap: {
              side: userSide,
              player_off_id: swap.offId,
              player_on_id: swap.onId,
            },
          },
        });
      }

      await handleAssignmentsChange(nextAssignments);
      if (snap) onUpdateSnapshot(snap);
    } catch (err) {
      console.error("Auto-select failed:", err);
    } finally {
      setIsAutoSelecting(false);
      setSelectedStarterId(null);
    }
  };

  return (
    <MatchScreenLayout
      contentClassName="min-h-0"
      pageTitle="MATCHDAY"
      pageSubtitle={`${fixtureLabel} · ${t("match.matchDay")}`}
      pageActions={
        <>
          <MatchPageAction onClick={onBackToDashboard}>{t("common.back")}</MatchPageAction>
          <MatchPageAction onClick={onStart} variant="primary">
            {t("match.startMatch")}
          </MatchPageAction>
        </>
      }
    >
      <div className="grid h-[980px] min-h-0 gap-4 xl:h-[940px] xl:grid-cols-[240px_minmax(760px,1fr)_320px] 2xl:h-[980px] 2xl:grid-cols-[260px_minmax(880px,1fr)_340px]">
        <aside className="hidden min-h-0 flex-col gap-4 xl:flex">
          <div className="rounded-xl border border-app-border bg-app-card p-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
              {fixtureLabel}
            </h3>
            <div className="space-y-3">
              <PrematchTeamHeader
                label={t("match.home")}
                team={snapshot.home_team}
                teamData={homeTeamData}
                teamColor={homeTeamColor}
                align="left"
                playStyle={t(`tactics.playStyles.${snapshot.home_team.play_style}`, snapshot.home_team.play_style)}
              />
              <PrematchTeamHeader
                label={t("match.away")}
                team={snapshot.away_team}
                teamData={awayTeamData}
                teamColor={awayTeamColor}
                align="left"
                playStyle={t(`tactics.playStyles.${snapshot.away_team.play_style}`, snapshot.away_team.play_style)}
              />
            </div>
          </div>
          <div className="rounded-xl border border-app-border bg-app-card p-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
              {t("match.matchDay")}
            </h3>
            <div className="space-y-2 text-xs text-app-text-muted">
              <div className="flex justify-between gap-3"><span>{t("match.formation")}</span><span className="font-bold text-app-text">{matchFormation}</span></div>
              <div className="flex justify-between gap-3"><span>{t("match.playStyle")}</span><span className="font-bold text-app-text">{t(`common.playStyles.${userTeam.play_style}`)}</span></div>
              <div className="flex justify-between gap-3"><span>{t("match.subs")}</span><span className="font-bold text-app-text">{userBench.length}</span></div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-app-border bg-app-card p-4">
          <div className="mb-4 rounded-2xl border border-app-green/25 bg-app-bg/80 p-4 shadow-inner shadow-black/20">
            <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)]">
              <PrematchTeamHeader
                label={t("match.home")}
                team={snapshot.home_team}
                teamData={homeTeamData}
                teamColor={homeTeamColor}
                align="left"
                playStyle={t(`tactics.playStyles.${snapshot.home_team.play_style}`, snapshot.home_team.play_style)}
              />
              <div className="text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-app-green">
                  {fixtureLabel}
                </p>
                <p className="font-heading text-4xl font-black tracking-wider text-app-text">VS</p>
              </div>
              <PrematchTeamHeader
                label={t("match.away")}
                team={snapshot.away_team}
                teamData={awayTeamData}
                teamColor={awayTeamColor}
                align="right"
                playStyle={t(`tactics.playStyles.${snapshot.away_team.play_style}`, snapshot.away_team.play_style)}
              />
            </div>
          </div>

          <div className="mb-4 flex gap-1 rounded-lg border border-app-border bg-app-bg p-1">
            <button
              onClick={() => setActiveTab("lineup")}
              className={`rounded-md px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === "lineup"
                  ? "bg-app-green text-white shadow-sm"
                  : "text-app-text-muted hover:bg-white/5 hover:text-app-text"
                }`}
            >
              {t("match.startingLineup")}
            </button>
            <button
              onClick={() => setActiveTab("setpieces")}
              className={`rounded-md px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === "setpieces"
                  ? "bg-app-green text-white shadow-sm"
                  : "text-app-text-muted hover:bg-white/5 hover:text-app-text"
                }`}
            >
              {t("match.setPiecesCaptain")}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">

        {/* Lineup Tab */}
        {activeTab === "lineup" && (
          <PreMatchLineup
            userTeam={{ ...userTeam, formation: matchFormation }}
            userBench={userBench}
            oppTeam={oppTeam}
            userColor={userColor}
            homeTeamColor={homeTeamColor}
            awayTeamColor={awayTeamColor}
            userSide={userSide}
            formationNeeds={formationNeeds}
            customSlots={userTeamData?.custom_tactic_slots}
            squadPlayers={allSquadPlayers}
            selectedStarterId={selectedStarterId}
            isAutoSelecting={isAutoSelecting}
            onSelectStarter={setSelectedStarterId}
            onSwap={handleSwap}
            onAutoSelect={handleAutoSelect}
            onAssignmentsChange={handleAssignmentsChange}
          />
        )}

        {/* Set Pieces Tab */}
        {activeTab === "setpieces" && (
          <div className="rounded-xl border border-app-border bg-app-card p-4 shadow-lg shadow-black/10">
            <button
              onClick={async () => {
                try {
                  const ids = userTeam.players.map((p) => p.id);
                  const result = await invoke<{
                    captain: string | null;
                    penalty_taker: string | null;
                    free_kick_taker: string | null;
                    corner_taker: string | null;
                  }>("auto_select_set_pieces", { playerIds: ids });
                  if (result.captain)
                    await handleSetPieceTaker("captain", result.captain);
                  if (result.penalty_taker)
                    await handleSetPieceTaker(
                      "penalty",
                      result.penalty_taker,
                    );
                  if (result.free_kick_taker)
                    await handleSetPieceTaker(
                      "freekick",
                      result.free_kick_taker,
                    );
                  if (result.corner_taker)
                    await handleSetPieceTaker("corner", result.corner_taker);
                } catch (err) {
                  console.error("Auto-select set pieces failed:", err);
                }
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-app-green/30 bg-app-green/10 px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/15"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {t("match.autoSelectTakers")}
            </button>
            <SetPieceSelector
              label={t("match.captain")}
              icon={<Crown className="w-4 h-4 text-accent-400" />}
              role="captain"
              currentId={userSetPieces.captain}
              players={userTeam.players}
              allSquad={allSquadPlayers}
              onSelect={(id) => handleSetPieceTaker("captain", id)}
            />
            <SetPieceSelector
              label={t("match.penaltyTaker")}
              icon={<CircleDot className="w-4 h-4 text-accent-400" />}
              role="penalty"
              currentId={userSetPieces.penalty_taker}
              players={userTeam.players}
              allSquad={allSquadPlayers}
              onSelect={(id) => handleSetPieceTaker("penalty", id)}
            />
            <SetPieceSelector
              label={t("match.freeKickTaker")}
              icon={<Footprints className="w-4 h-4 text-accent-400" />}
              role="freekick"
              currentId={userSetPieces.free_kick_taker}
              players={userTeam.players}
              allSquad={allSquadPlayers}
              onSelect={(id) => handleSetPieceTaker("freekick", id)}
            />
            <SetPieceSelector
              label={t("match.cornerTaker")}
              icon={<CornerDownRight className="w-4 h-4 text-accent-400" />}
              role="corner"
              currentId={userSetPieces.corner_taker}
              players={userTeam.players}
              allSquad={allSquadPlayers}
              onSelect={(id) => handleSetPieceTaker("corner", id)}
            />
          </div>
        )}
          </div>
        </section>

        <aside className="min-h-0 overflow-auto rounded-xl border border-app-border bg-app-card p-4 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                {t("match.formation")}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {FORMATIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFormationChange(f)}
                    className={`rounded-lg border py-2.5 font-heading text-sm font-bold transition-all ${matchFormation === f
                      ? "border-app-green/50 bg-app-green/15 text-app-green shadow-inner"
                      : "border-app-border bg-app-bg text-app-text-muted hover:border-app-green/40 hover:text-app-text"
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                {t("match.playStyle")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {PLAY_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => handlePlayStyleChange(style)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 font-heading text-sm font-bold transition-all ${userTeam.play_style === style
                      ? "border-app-green/50 bg-app-green/15 text-app-green shadow-inner"
                      : "border-app-border bg-app-bg text-app-text-muted hover:border-app-green/40 hover:text-app-text"
                      }`}
                  >
                    {PLAY_STYLE_ICONS[style]}
                    {t(`common.playStyles.${style}`)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleAutoSelect(buildCurrentAssignments())}
              disabled={isAutoSelecting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-app-green/30 bg-app-green/10 px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/15 disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {isAutoSelecting ? t("common.loading") : t("match.autoSelect")}
            </button>
          </div>
        </aside>
      </div>
    </MatchScreenLayout>
  );
}
