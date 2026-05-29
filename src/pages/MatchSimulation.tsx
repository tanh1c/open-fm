import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useGameStore, GameStateData } from "../store/gameStore";
import {
  MatchSnapshot,
  MatchEvent,
  MatchDayStage,
  RoundSummary,
} from "../components/match/types";
import { resolveMatchFixture } from "../components/match/helpers";
import PreMatchSetup from "../components/match/PreMatchSetup";
import MatchLive from "../components/match/MatchLive";
import HalfTimeBreak from "../components/match/HalfTimeBreak";
import PostMatchScreen from "../components/match/PostMatchScreen";
import PressConference from "../components/match/PressConference";

// ---------------------------------------------------------------------------
// Multi-stage Match Day Orchestrator
// ---------------------------------------------------------------------------

interface MatchRouteState {
  fixtureIndex?: number;
  mode?: string;
  snapshot?: MatchSnapshot;
}

interface FinishLiveMatchResponse {
  game: GameStateData;
  round_summary?: RoundSummary | null;
}

export default function MatchSimulation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as MatchRouteState | null) ?? null;
  const matchMode = routeState?.mode || "live";
  const { gameState, setGameState } = useGameStore();
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(
    routeState?.snapshot ?? null,
  );
  const [stage, setStage] = useState<MatchDayStage>("prematch");
  const [importantEvents, setImportantEvents] = useState<MatchEvent[]>([]);
  const [userSide, setUserSide] = useState<"Home" | "Away" | null>(null);
  const [isSpectator, setIsSpectator] = useState(matchMode === "spectator");
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [hasFinalizedMatch, setHasFinalizedMatch] = useState(false);

  useEffect(() => {
    console.info("[MatchSimulation] mount", {
      fixtureIndex: routeState?.fixtureIndex,
      hasGameState: !!gameState,
      hasRouteSnapshot: !!routeState?.snapshot,
      matchMode,
    });
  }, [gameState, matchMode, routeState?.fixtureIndex, routeState?.snapshot]);

  // Determine user side from game state
  useEffect(() => {
    if (!gameState || !snapshot) return;
    const utid = gameState.manager.team_id;
    if (!utid) {
      setIsSpectator(true);
      return;
    }
    if (snapshot.home_team.id === utid) setUserSide("Home");
    else if (snapshot.away_team.id === utid) setUserSide("Away");
    else setIsSpectator(true);

    // If mode is spectator, force spectator regardless of team
    if (matchMode === "spectator") setIsSpectator(true);

    console.info("[MatchSimulation] resolveSide", {
      awayTeamId: snapshot.away_team.id,
      homeTeamId: snapshot.home_team.id,
      matchMode,
      managerTeamId: utid,
      resolvedUserSide:
        snapshot.home_team.id === utid
          ? "Home"
          : snapshot.away_team.id === utid
            ? "Away"
            : null,
    });
  }, [gameState, snapshot?.home_team.id, snapshot?.away_team.id, matchMode]);

  useEffect(() => {
    console.info("[MatchSimulation] stage", {
      hasSnapshot: !!snapshot,
      isSpectator,
      stage,
      userSide,
    });
  }, [isSpectator, snapshot, stage, userSide]);

  // Fetch initial snapshot
  useEffect(() => {
    let isCancelled = false;

    const fetchSnapshot = async () => {
      console.info("[MatchSimulation] fetchSnapshot:start", {
        fixtureIndex: routeState?.fixtureIndex,
        hasRouteSnapshot: !!routeState?.snapshot,
        matchMode,
      });
      try {
        const snap = await invoke<MatchSnapshot | null>("get_match_snapshot");
        if (!snap) throw new Error("No active match snapshot");
        console.info("[MatchSimulation] fetchSnapshot:success", {
          awayPlayers: snap.away_team.players.length,
          awayTeam: snap.away_team.name,
          homePlayers: snap.home_team.players.length,
          homeTeam: snap.home_team.name,
          phase: snap.phase,
        });
        if (!isCancelled) {
          setSnapshot(snap);
        }
        return;
      } catch (snapshotError) {
        console.warn("[MatchSimulation] fetchSnapshot:failed", snapshotError);
        if (typeof routeState?.fixtureIndex !== "number") {
          console.error("Failed to get match snapshot:", snapshotError);
          navigate("/dashboard");
          return;
        }

        try {
          console.info("[MatchSimulation] restoreLiveMatch:start", {
            fixtureIndex: routeState.fixtureIndex,
            matchMode,
          });
          const restoredSnapshot = await invoke<MatchSnapshot>(
            "start_live_match",
            {
              allowsExtraTime: false,
              fixtureIndex: routeState.fixtureIndex,
              mode: matchMode,
            },
          );

          console.info("[MatchSimulation] restoreLiveMatch:success", {
            awayPlayers: restoredSnapshot.away_team.players.length,
            awayTeam: restoredSnapshot.away_team.name,
            homePlayers: restoredSnapshot.home_team.players.length,
            homeTeam: restoredSnapshot.home_team.name,
            phase: restoredSnapshot.phase,
          });

          if (!isCancelled) {
            setSnapshot(restoredSnapshot);
          }
        } catch (restoreError) {
          console.error("Failed to restore live match session:", restoreError);
          navigate("/dashboard");
        }
      }
    };

    fetchSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [matchMode, navigate, routeState?.fixtureIndex]);

  // Skip pre-match for spectators
  useEffect(() => {
    if (isSpectator && stage === "prematch") {
      setStage("first_half");
    }
  }, [isSpectator, stage]);

  // Callbacks for stage transitions
  const handleStartMatch = useCallback(() => {
    console.info("[MatchSimulation] handleStartMatch");
    setStage("first_half");
  }, []);

  const handleHalfTime = useCallback(() => {
    console.info("[MatchSimulation] handleHalfTime");
    setStage("halftime");
  }, []);

  const handleResumeFromHalfTime = useCallback(() => {
    console.info("[MatchSimulation] handleResumeFromHalfTime");
    setStage("second_half");
  }, []);

  const finalizeMatch = useCallback(async (): Promise<boolean> => {
    if (hasFinalizedMatch) {
      return true;
    }

    try {
      console.info("[MatchSimulation] finalizeMatch:start");
      const response =
        await invoke<FinishLiveMatchResponse>("finish_live_match");
      console.info("[MatchSimulation] finalizeMatch:success", {
        hasRoundSummary: !!response.round_summary,
        hasUpdatedGame: !!response.game,
      });
      setGameState(response.game);
      setRoundSummary(response.round_summary ?? null);
      setHasFinalizedMatch(true);
      return true;
    } catch (err) {
      console.error("Failed to finish match:", err);
      return false;
    }
  }, [hasFinalizedMatch, setGameState]);

  const handleFullTime = useCallback(() => {
    console.info("[MatchSimulation] handleFullTime");
    void (async () => {
      const finalized = await finalizeMatch();
      if (finalized) {
        setStage("postmatch");
      }
    })();
  }, [finalizeMatch]);

  const handlePressConference = useCallback(() => {
    console.info("[MatchSimulation] handlePressConference");
    setStage("press");
  }, []);

  const handleFinishMatch = useCallback(async () => {
    console.info("[MatchSimulation] handleFinishMatch:start");
    const finalized = await finalizeMatch();
    if (finalized) {
      navigate("/dashboard");
    }
  }, [finalizeMatch, navigate]);

  const handleBackToDashboard = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const handleSnapshotUpdate = useCallback((snap: MatchSnapshot) => {
    console.info("[MatchSimulation] handleSnapshotUpdate", {
      awayPlayers: snap.away_team.players.length,
      currentMinute: snap.current_minute,
      homePlayers: snap.home_team.players.length,
      phase: snap.phase,
    });
    setSnapshot(snap);
  }, []);

  const handleImportantEvent = useCallback((evt: MatchEvent) => {
    console.info("[MatchSimulation] handleImportantEvent", {
      eventType: evt.event_type,
      minute: evt.minute,
      side: evt.side,
    });
    setImportantEvents((prev) => [...prev, evt]);
  }, []);

  // Loading state
  if (!snapshot || !gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-app-text">
        <div className="rounded-2xl border border-app-border bg-app-card px-8 py-7 text-center shadow-xl shadow-black/20">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-app-green border-t-transparent" />
          <span className="mt-4 block font-heading text-sm font-bold uppercase tracking-[0.22em] text-app-text-muted">
            {t("dashboard.loading")}
          </span>
        </div>
      </div>
    );
  }

  const currentFixture = resolveMatchFixture(
    gameState,
    snapshot,
    routeState?.fixtureIndex,
  );

  // Render the current stage
  switch (stage) {
    case "prematch":
      return (
        <PreMatchSetup
          snapshot={snapshot}
          gameState={gameState}
          currentFixture={currentFixture}
          userSide={userSide || "Home"}
          onBackToDashboard={handleBackToDashboard}
          onStart={handleStartMatch}
          onUpdateSnapshot={handleSnapshotUpdate}
        />
      );

    case "first_half":
    case "second_half":
      return (
        <MatchLive
          key={stage}
          snapshot={snapshot}
          gameState={gameState}
          userSide={userSide}
          isSpectator={isSpectator}
          importantEvents={importantEvents}
          onBackToDashboard={handleBackToDashboard}
          onSnapshotUpdate={handleSnapshotUpdate}
          onImportantEvent={handleImportantEvent}
          onHalfTime={handleHalfTime}
          onFullTime={handleFullTime}
        />
      );

    case "halftime":
      return (
        <HalfTimeBreak
          snapshot={snapshot}
          gameState={gameState}
          userSide={userSide || "Home"}
          isSpectator={isSpectator}
          importantEvents={importantEvents}
          onBackToDashboard={handleBackToDashboard}
          onResume={handleResumeFromHalfTime}
          onUpdateSnapshot={handleSnapshotUpdate}
        />
      );

    case "postmatch":
      return (
        <PostMatchScreen
          snapshot={snapshot}
          gameState={gameState}
          currentFixture={currentFixture}
          userSide={userSide}
          isSpectator={isSpectator}
          importantEvents={importantEvents}
          roundSummary={roundSummary}
          onBackToDashboard={handleBackToDashboard}
          onPressConference={handlePressConference}
          onFinish={handleFinishMatch}
        />
      );

    case "press":
      return (
        <PressConference
          snapshot={snapshot}
          gameState={gameState}
          userSide={userSide || "Home"}
          onFinish={handleFinishMatch}
          onGameUpdate={setGameState}
        />
      );

    default:
      return null;
  }
}
