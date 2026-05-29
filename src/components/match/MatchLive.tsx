import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { GameStateData, TeamData } from "../../store/gameStore";
import { EngineTeamData, MatchSnapshot, MatchEvent, MinuteResult, SimSpeed, SPEED_MS } from "./types";
import { getEventDisplay, getEventTypeLabel, getPlayerName, phaseLabel } from "./helpers";
import { useSettingsStore } from "../../store/settingsStore";
import TeamLogo from "../common/TeamLogo";
import { EventFeed, MatchStats, Lineups } from "./MatchPanels";
import MatchScreenLayout, { MatchPageAction } from "./MatchScreenLayout";
import { SubPanel } from "./SubPanel";
import {
  Play, Pause, FastForward, SkipForward,
  Users, BarChart3, MessageSquare, RefreshCw,
  ChevronRight, Zap, Shield, Crosshair,
  Target, Flag
} from "lucide-react";

type ActivePanel = "events" | "stats" | "lineups";

interface MatchLiveProps {
  snapshot: MatchSnapshot;
  gameState: GameStateData;
  userSide: "Home" | "Away" | null;
  isSpectator: boolean;
  importantEvents: MatchEvent[];
  onBackToDashboard: () => void;
  onSnapshotUpdate: (snap: MatchSnapshot) => void;
  onImportantEvent: (evt: MatchEvent) => void;
  onHalfTime: () => void;
  onFullTime: () => void;
}

function LiveTeamBlock({
  team,
  teamData,
  teamColor,
  align,
}: {
  team: EngineTeamData;
  teamData: TeamData | undefined;
  teamColor: string;
  align: "left" | "right";
}) {
  const isRight = align === "right";

  return (
    <div className={`flex min-w-0 items-center gap-3 ${isRight ? "justify-end text-right" : ""}`}>
      {isRight && <LiveTeamBadge team={team} teamData={teamData} teamColor={teamColor} />}
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-black uppercase tracking-wide text-app-text">
          {team.name}
        </p>
        <p className="text-xs font-semibold text-app-text-muted">{team.formation}</p>
      </div>
      {!isRight && <LiveTeamBadge team={team} teamData={teamData} teamColor={teamColor} />}
    </div>
  );
}

function LiveTeamBadge({
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
      className="h-12 w-12 rounded-xl border border-app-border bg-white/95 p-1.5 shadow-lg shadow-black/25"
    />
  ) : (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 font-heading text-xs font-black text-app-text"
      style={{ backgroundColor: `${teamColor}30`, borderColor: teamColor }}
    >
      {team.name.substring(0, 3).toUpperCase()}
    </div>
  );
}

function LiveEventCard({
  event,
  snapshot,
  homeTeamData,
  awayTeamData,
  homeTeamColor,
  awayTeamColor,
}: {
  event: MatchEvent;
  snapshot: MatchSnapshot;
  homeTeamData: TeamData | undefined;
  awayTeamData: TeamData | undefined;
  homeTeamColor: string;
  awayTeamColor: string;
}) {
  const { t } = useTranslation();
  const display = getEventDisplay(event);
  const isHome = event.side === "Home";
  const team = isHome ? snapshot.home_team : snapshot.away_team;
  const teamData = isHome ? homeTeamData : awayTeamData;
  const teamColor = isHome ? homeTeamColor : awayTeamColor;
  const playerName = getPlayerName(snapshot, event.player_id);
  const secondaryName = getPlayerName(snapshot, event.secondary_player_id);
  const eventLabel = getEventTypeLabel(event.event_type, t).toUpperCase();
  const isGoal = event.event_type === "Goal" || event.event_type === "PenaltyGoal";

  return (
    <div className={`relative overflow-hidden rounded-xl border px-3 py-3 shadow-lg shadow-black/10 ${isGoal ? "border-app-green/40 bg-app-green/10" : "border-app-border/70 bg-app-bg/75"}`}>
      <div className="pointer-events-none absolute -right-4 -top-4 opacity-10 blur-[1px]">
        {teamData ? (
          <TeamLogo team={teamData} className="h-20 w-20 rounded-2xl bg-white/90 p-2" />
        ) : (
          <div className="h-20 w-20 rounded-2xl" style={{ backgroundColor: teamColor }} />
        )}
      </div>
      <div className="relative flex items-start gap-3">
        <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-app-border bg-app-card py-1.5">
          <span className="font-heading text-sm font-black tabular-nums text-app-text">{event.minute}'</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-app-text-muted">MIN</span>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-card">
          <span className={display.color}>{display.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isGoal ? "bg-app-green text-app-bg" : "bg-white/10 text-app-text"}`}>
              {eventLabel}
            </span>
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
              {team.name}
            </span>
          </div>
          <p className="truncate font-heading text-sm font-bold text-app-text">
            {playerName || team.name}
          </p>
          {secondaryName ? (
            <p className="truncate text-[11px] text-app-text-muted">
              {event.event_type === "Substitution"
                ? t("match.subFor", { name: secondaryName })
                : t("match.assist", { name: secondaryName })}
            </p>
          ) : null}
        </div>
        <LiveTeamBadge team={team} teamData={teamData} teamColor={teamColor} />
      </div>
    </div>
  );
}

function MatchMomentumPanel({
  snapshot,
  events,
  homeTeamColor,
  awayTeamColor,
}: {
  snapshot: MatchSnapshot;
  events: MatchEvent[];
  homeTeamColor: string;
  awayTeamColor: string;
}) {
  const recentEvents = events.filter((event) => event.minute >= Math.max(0, snapshot.current_minute - 15));
  const homeThreat = calculateThreatScore(recentEvents, "Home", snapshot.home_possession_pct);
  const awayThreat = calculateThreatScore(recentEvents, "Away", snapshot.away_possession_pct);
  const totalThreat = Math.max(1, homeThreat + awayThreat);
  const homeMomentum = Math.round((homeThreat / totalThreat) * 100);
  const awayMomentum = 100 - homeMomentum;
  const leader = homeMomentum === awayMomentum
    ? "Balanced"
    : homeMomentum > awayMomentum
      ? snapshot.home_team.name
      : snapshot.away_team.name;
  const homeShots = countThreatEvents(events, "Home");
  const awayShots = countThreatEvents(events, "Away");

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-app-border bg-app-card p-4">
      <div className="mb-4 min-w-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">Match Momentum</h3>
        <p className="mt-1 text-xs text-app-text-muted">Pressure over the last 15 minutes</p>
      </div>

      <div className="mb-4 rounded-lg border border-app-border bg-app-bg/70 p-3">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-app-text-muted">Current edge</p>
        <p className="truncate font-heading text-sm font-black text-app-text">{leader}</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex min-w-0 justify-between gap-2 text-[11px] font-heading font-bold uppercase tracking-wider">
            <span className="min-w-0 truncate text-app-text">{snapshot.home_team.name}</span>
            <span className="shrink-0 text-app-text-muted">{homeMomentum}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-app-bg">
            <div className="h-full transition-all duration-500" style={{ width: `${homeMomentum}%`, backgroundColor: homeTeamColor }} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex min-w-0 justify-between gap-2 text-[11px] font-heading font-bold uppercase tracking-wider">
            <span className="min-w-0 truncate text-app-text">{snapshot.away_team.name}</span>
            <span className="shrink-0 text-app-text-muted">{awayMomentum}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-app-bg">
            <div className="h-full transition-all duration-500" style={{ width: `${awayMomentum}%`, backgroundColor: awayTeamColor }} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <MomentumMetric label="Possession" homeValue={`${snapshot.home_possession_pct.toFixed(0)}%`} awayValue={`${snapshot.away_possession_pct.toFixed(0)}%`} />
          <MomentumMetric label="Threat actions" homeValue={String(homeShots)} awayValue={String(awayShots)} />
          <MomentumMetric label="Ball zone" homeValue={snapshot.possession === "Home" ? formatZone(snapshot.ball_zone) : "—"} awayValue={snapshot.possession === "Away" ? formatZone(snapshot.ball_zone) : "—"} />
          <MomentumMetric label="Initiative" homeValue={homeMomentum >= awayMomentum ? "Yes" : "—"} awayValue={awayMomentum > homeMomentum ? "Yes" : "—"} />
        </div>
      </div>
    </div>
  );
}

function MomentumMetric({ label, homeValue, awayValue }: { label: string; homeValue: string; awayValue: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-bg/70 p-2.5">
      <p className="mb-1.5 truncate text-[9px] font-bold uppercase tracking-wider text-app-text-muted">{label}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)] items-center gap-2 font-heading text-xs font-bold text-app-text">
        <span className="min-w-0 truncate">{homeValue}</span>
        <span className="text-center text-app-text-muted">/</span>
        <span className="min-w-0 truncate text-right">{awayValue}</span>
      </div>
    </div>
  );
}

function formatZone(zone: string): string {
  return zone
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function calculateThreatScore(events: MatchEvent[], side: "Home" | "Away", possessionPct: number): number {
  return events.reduce((score, event) => {
    if (event.side !== side) return score;
    if (event.event_type === "Goal" || event.event_type === "PenaltyGoal") return score + 6;
    if (event.event_type.includes("Shot") || event.event_type === "PenaltyMiss") return score + 3;
    if (event.event_type === "Corner" || event.event_type === "FreeKick") return score + 2;
    if (event.event_type === "YellowCard" || event.event_type === "RedCard" || event.event_type === "SecondYellow") return score - 1;
    return score + 1;
  }, Math.max(5, possessionPct / 10));
}

function countThreatEvents(events: MatchEvent[], side: "Home" | "Away"): number {
  return events.filter((event) => (
    event.side === side &&
    (event.event_type.includes("Shot") || event.event_type.includes("Goal") || event.event_type === "PenaltyMiss")
  )).length;
}

export default function MatchLive({
  snapshot, gameState, userSide, isSpectator,
  importantEvents, onBackToDashboard, onSnapshotUpdate, onImportantEvent,
  onHalfTime, onFullTime,
}: MatchLiveProps) {
  const { t } = useTranslation();
  const { settings } = useSettingsStore();
  const initialSpeed: SimSpeed = (settings.match_speed === "slow" || settings.match_speed === "fast") ? settings.match_speed : "normal";
  const [speed, setSpeed] = useState<SimSpeed>(initialSpeed);
  const [activePanel, setActivePanel] = useState<ActivePanel>("events");
  const [isRunning, setIsRunning] = useState(true);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventFeedRef = useRef<HTMLDivElement>(null);
  // Track phases we've already signaled to avoid double-firing
  const signaledRef = useRef<Set<string>>(new Set());

  const homeTeamData = gameState.teams.find(t => t.id === snapshot.home_team.id);
  const awayTeamData = gameState.teams.find(t => t.id === snapshot.away_team.id);
  const homeTeamColor = homeTeamData?.colors?.primary || "#10b981";
  const awayTeamColor = awayTeamData?.colors?.primary || "#6366f1";

  const isFinished = snapshot.phase === "Finished";

  // Step the match forward one minute
  const stepMatch = useCallback(async () => {
    try {
      const results = await invoke<MinuteResult[]>("step_live_match", { minutes: 1 });
      if (results.length > 0) {
        const lastResult = results[results.length - 1];

        // Collect important events
        for (const r of results) {
          for (const evt of r.events) {
            const display = getEventDisplay(evt);
            if (display.important) {
              onImportantEvent(evt);
            }
          }
        }

        // Fetch full snapshot
        const snap = await invoke<MatchSnapshot>("get_match_snapshot");
        onSnapshotUpdate(snap);

        // Check for phase transitions that should pause
        const phase = lastResult.phase;
        if (phase === "HalfTime" && !signaledRef.current.has("HalfTime")) {
          signaledRef.current.add("HalfTime");
          setIsRunning(false);
          setSpeed("paused");
          // Small delay so the last event renders before transitioning
          setTimeout(() => onHalfTime(), 600);
          return;
        }

        if (phase === "ExtraTimeHalfTime" && !signaledRef.current.has("ExtraTimeHalfTime")) {
          signaledRef.current.add("ExtraTimeHalfTime");
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onHalfTime(), 600);
          return;
        }

        if (lastResult.is_finished && !signaledRef.current.has("Finished")) {
          signaledRef.current.add("Finished");
          setIsRunning(false);
          setSpeed("paused");
          setTimeout(() => onFullTime(), 600);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to step match:", err);
      setIsRunning(false);
    }
  }, [onSnapshotUpdate, onImportantEvent, onHalfTime, onFullTime]);

  // Auto-step timer
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isRunning && speed !== "paused" && !isFinished && !showSubPanel) {
      timerRef.current = setTimeout(async () => {
        await stepMatch();
      }, SPEED_MS[speed]);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, speed, snapshot.current_minute, snapshot.phase, stepMatch, isFinished, showSubPanel]);

  // Auto-scroll event feed
  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [importantEvents.length]);

  // Apply substitution
  const handleSubstitution = async (playerOffId: string, playerOnId: string) => {
    if (!userSide || isSpectator) return;
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { Substitute: { side: userSide, player_off_id: playerOffId, player_on_id: playerOnId } }
      });
      onSnapshotUpdate(snap);
      setShowSubPanel(false);
    } catch (err) {
      console.error("Substitution failed:", err);
    }
  };

  const handleFormationChange = async (formation: string) => {
    if (!userSide || isSpectator) return;
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { ChangeFormation: { side: userSide, formation } }
      });
      onSnapshotUpdate(snap);
    } catch (err) {
      console.error("Formation change failed:", err);
    }
  };

  const handlePlayStyleChange = async (playStyle: string) => {
    if (!userSide || isSpectator) return;
    try {
      const snap = await invoke<MatchSnapshot>("apply_match_command", {
        command: { ChangePlayStyle: { side: userSide, play_style: playStyle } }
      });
      onSnapshotUpdate(snap);
    } catch (err) {
      console.error("Play style change failed:", err);
    }
  };

  return (
    <MatchScreenLayout
      contentClassName="min-h-0"
      pageTitle="MATCH LIVE"
      pageSubtitle={`${phaseLabel(snapshot.phase, t)} · ${snapshot.current_minute}'`}
      pageActions={
        <>
          <MatchPageAction onClick={onBackToDashboard}>{t("common.back")}</MatchPageAction>
          <span className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-text-muted">
            {isRunning ? t('match.live') : t('match.paused')}
          </span>
        </>
      }
    >
      <div className="grid h-[800px] min-h-0 gap-4 xl:h-[750px] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="hidden min-h-0 flex-col gap-4 xl:flex">
          <div className="rounded-xl border border-app-border bg-app-card p-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{t('match.matchStats')}</h3>
            <div className="space-y-2 text-xs text-app-text-muted">
              <div className="flex justify-between"><span>{t('match.possession')}</span><span className="font-bold text-app-text">{snapshot.home_possession_pct.toFixed(0)}% - {snapshot.away_possession_pct.toFixed(0)}%</span></div>
              <div className="flex justify-between"><span>{t('match.phase')}</span><span className="font-bold text-app-text">{phaseLabel(snapshot.phase, t)}</span></div>
              <div className="flex justify-between"><span>{t('match.minute')}</span><span className="font-bold text-app-text">{snapshot.current_minute}'</span></div>
            </div>
          </div>
          <MatchMomentumPanel
            snapshot={snapshot}
            events={importantEvents}
            homeTeamColor={homeTeamColor}
            awayTeamColor={awayTeamColor}
          />
        </aside>

        <section className="min-h-0 overflow-hidden rounded-xl border border-app-border bg-app-card">
          <div className="border-b border-app-border bg-app-bg/80 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] items-center gap-4">
              <LiveTeamBlock team={snapshot.home_team} teamData={homeTeamData} teamColor={homeTeamColor} align="right" />
              <div className="flex items-center justify-center gap-3">
                <span className="font-heading text-5xl font-black tabular-nums text-app-text">{snapshot.home_score}</span>
                <div className="flex flex-col items-center rounded-xl border border-app-border bg-app-card px-4 py-2">
                  <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-app-green">{phaseLabel(snapshot.phase, t)}</span>
                  <span className="font-heading text-2xl font-black tabular-nums text-app-text-muted">{snapshot.current_minute}'</span>
                </div>
                <span className="font-heading text-5xl font-black tabular-nums text-app-text">{snapshot.away_score}</span>
              </div>
              <LiveTeamBlock team={snapshot.away_team} teamData={awayTeamData} teamColor={awayTeamColor} align="left" />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="w-12 text-right font-heading font-bold text-app-green">{snapshot.home_possession_pct.toFixed(0)}%</span>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-app-card">
                <div className="h-full transition-all duration-500" style={{ width: `${snapshot.home_possession_pct}%`, backgroundColor: homeTeamColor }} />
                <div className="h-full transition-all duration-500" style={{ width: `${snapshot.away_possession_pct}%`, backgroundColor: awayTeamColor }} />
              </div>
              <span className="w-12 font-heading font-bold text-indigo-300">{snapshot.away_possession_pct.toFixed(0)}%</span>
            </div>
          </div>

          <div className="flex h-[calc(100%-128px)] min-h-0 flex-col">
            <div className="flex border-b border-app-border bg-app-card">
              {([
                { id: "events" as ActivePanel, label: t('match.events'), icon: <MessageSquare className="w-4 h-4" /> },
                { id: "stats" as ActivePanel, label: t('match.stats'), icon: <BarChart3 className="w-4 h-4" /> },
                { id: "lineups" as ActivePanel, label: t('match.lineups'), icon: <Users className="w-4 h-4" /> },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActivePanel(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-5 py-3 font-heading text-xs font-bold uppercase tracking-wider transition-colors ${activePanel === tab.id
                      ? "border-app-green bg-app-green/10 text-app-green"
                      : "border-transparent text-app-text-muted hover:bg-app-bg hover:text-app-text"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              {activePanel === "events" && <EventFeed events={importantEvents} snapshot={snapshot} feedRef={eventFeedRef} />}
              {activePanel === "stats" && <MatchStats snapshot={snapshot} />}
              {activePanel === "lineups" && <Lineups snapshot={snapshot} />}
            </div>
          </div>
        </section>

        <aside className="min-h-0 overflow-auto rounded-xl border border-app-border bg-app-card custom-scrollbar">
          <div className="border-b border-app-border p-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{t('match.simSpeed')}</h3>
            <div className="flex gap-1">
              {([
                { id: "paused" as SimSpeed, icon: <Pause className="w-4 h-4" />, label: t('match.pause') },
                { id: "slow" as SimSpeed, icon: <Play className="w-4 h-4" />, label: t('match.slow') },
                { id: "normal" as SimSpeed, icon: <Play className="w-4 h-4" />, label: t('match.normal') },
                { id: "fast" as SimSpeed, icon: <FastForward className="w-4 h-4" />, label: t('match.fast') },
                { id: "instant" as SimSpeed, icon: <SkipForward className="w-4 h-4" />, label: t('match.max') },
              ]).map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSpeed(s.id); setIsRunning(s.id !== "paused"); }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 font-heading text-xs uppercase tracking-wider transition-all ${speed === s.id ? "bg-app-green/15 text-app-green ring-1 ring-app-green/40" : "text-app-text-muted hover:bg-app-bg hover:text-app-text"
                    }`}
                >
                  {s.icon}
                  <span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>
            {speed === "paused" && (
              <button
                onClick={stepMatch}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-app-border bg-app-bg py-2 font-heading text-sm uppercase tracking-wider text-app-text-muted transition-colors hover:border-app-green/40 hover:text-app-text"
              >
                <ChevronRight className="w-4 h-4" />
                {t('match.step1Min')}
              </button>
            )}
          </div>

          {/* User Controls */}
          {!isSpectator && userSide && (
            <div className="flex flex-col gap-2 border-b border-app-border p-4">
              <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{t('match.teamControls')}</h3>
              <button
                onClick={() => setShowSubPanel(!showSubPanel)}
                className="flex items-center gap-2 rounded-lg border border-app-border bg-app-bg px-3 py-2 font-heading text-sm uppercase tracking-wider text-app-text-muted transition-colors hover:border-app-green/40 hover:text-app-text"
              >
                <RefreshCw className="w-4 h-4" />
                {t('match.subs')} ({userSide === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made}/{snapshot.max_subs})
              </button>
              <div>
                <p className="mb-1 font-heading text-[10px] uppercase tracking-widest text-app-text-muted">{t('match.formation')}</p>
                <div className="flex flex-wrap gap-1">
                  {["4-4-2", "4-3-3", "3-5-2", "4-5-1", "4-2-3-1", "3-4-3"].map(f => {
                    const cur = userSide === "Home" ? snapshot.home_team.formation : snapshot.away_team.formation;
                    return (
                      <button key={f} onClick={() => handleFormationChange(f)}
                        className={`rounded border px-2 py-1 font-heading text-xs transition-colors ${cur === f ? "border-app-green/50 bg-app-green/15 text-app-green" : "border-app-border bg-app-bg text-app-text-muted hover:border-app-green/40 hover:text-app-text"}`}
                      >{f}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1 font-heading text-[10px] uppercase tracking-widest text-app-text-muted">{t('match.playStyle')}</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: "Balanced", icon: <Target className="w-3 h-3" /> },
                    { id: "Attacking", icon: <Zap className="w-3 h-3" /> },
                    { id: "Defensive", icon: <Shield className="w-3 h-3" /> },
                    { id: "Possession", icon: <RefreshCw className="w-3 h-3" /> },
                    { id: "Counter", icon: <Crosshair className="w-3 h-3" /> },
                    { id: "HighPress", icon: <Flag className="w-3 h-3" /> },
                  ].map(s => {
                    const cur = userSide === "Home" ? snapshot.home_team.play_style : snapshot.away_team.play_style;
                    return (
                      <button key={s.id} onClick={() => handlePlayStyleChange(s.id)}
                        className={`flex items-center gap-1 rounded border px-2 py-1 font-heading text-xs transition-colors ${cur === s.id ? "border-app-green/50 bg-app-green/15 text-app-green" : "border-app-border bg-app-bg text-app-text-muted hover:border-app-green/40 hover:text-app-text"}`}
                      >{s.icon}{t(`common.playStyles.${s.id}`, s.id)}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{t('match.keyEvents')}</h3>
            <div className="flex flex-col gap-1.5">
              {importantEvents
                .filter(e => ["Goal", "PenaltyGoal", "YellowCard", "RedCard", "SecondYellow", "Substitution", "PenaltyMiss", "Injury"].includes(e.event_type))
                .slice(-12).reverse()
                .map((evt, i) => (
                  <LiveEventCard
                    key={`${evt.minute}-${evt.event_type}-rail-${i}`}
                    event={evt}
                    snapshot={snapshot}
                    homeTeamData={homeTeamData}
                    awayTeamData={awayTeamData}
                    homeTeamColor={homeTeamColor}
                    awayTeamColor={awayTeamColor}
                  />
                ))}
              {importantEvents.length === 0 && <p className="text-xs text-app-text-muted">{t('match.noEventsYet')}</p>}
            </div>
          </div>
        </aside>
      </div>

      {/* Substitution Modal */}
      {showSubPanel && userSide && (
        <SubPanel snapshot={snapshot} side={userSide} onSubstitute={handleSubstitution} onClose={() => setShowSubPanel(false)} />
      )}
    </MatchScreenLayout>
  );
}

