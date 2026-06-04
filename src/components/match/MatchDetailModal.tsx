import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  ArrowDownUp,
  CircleDot,
  Footprints,
  ShieldAlert,
  Square,
  Trophy,
  X,
} from "lucide-react";

import { getTeamLogoUrl } from "../../lib/teamLogos";
import type { MatchDetailData, MatchDetailEventData, MatchDetailPlayerStatsData, MatchDetailTeamStatsData } from "../../store/types";

interface MatchDetailModalProps {
  fixtureId: string | null;
  onClose: () => void;
}

type MatchDetailTab = "timeline" | "teamStats" | "playerStats";

const tabs: Array<{ id: MatchDetailTab; label: string }> = [
  { id: "timeline", label: "Timeline" },
  { id: "teamStats", label: "Team Stats" },
  { id: "playerStats", label: "Player Stats" },
];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function MatchDetailModal({ fixtureId, onClose }: MatchDetailModalProps) {
  const [detail, setDetail] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchDetailTab>("timeline");

  useEffect(() => {
    if (!fixtureId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setActiveTab("timeline");

    invoke<MatchDetailData | null>("get_match_detail", { fixtureId })
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load match details.");
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const playerGroups = useMemo(() => {
    const home = detail?.playerStats.filter((player) => player.side === "Home") ?? [];
    const away = detail?.playerStats.filter((player) => player.side === "Away") ?? [];
    return { home, away };
  }, [detail]);

  if (!fixtureId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-bg shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-app-border bg-app-card px-4 py-3">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.24em] text-app-green">Match Centre</p>
            <p className="mt-1 truncate text-xs text-app-text-muted">
              {detail ? `${detail.competition} · Matchday ${detail.matchday} · ${formatDate(detail.date)}` : "Loading saved match report"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-bg text-app-text-muted transition hover:border-app-green hover:text-app-text"
            aria-label="Close match detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar">
          {loading ? <EmptyState text="Loading match details..." /> : null}
          {!loading && error ? <EmptyState text={error} /> : null}
          {!loading && !error && !detail ? <EmptyState text="No match detail is available for this fixture." /> : null}
          {!loading && !error && detail ? (
            <>
              <Scoreboard detail={detail} />

              <div className="border-b border-app-border bg-app-card px-4 pt-3">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cx(
                        "rounded-t-xl border border-b-0 px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition",
                        activeTab === tab.id
                          ? "border-app-border bg-app-bg text-app-green"
                          : "border-transparent text-app-text-muted hover:text-app-text",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <main className="mx-auto w-full max-w-5xl p-4">
                {activeTab === "timeline" ? <Timeline detail={detail} /> : null}
                {activeTab === "teamStats" ? <TeamStatsPanel home={detail.homeStats} away={detail.awayStats} /> : null}
                {activeTab === "playerStats" ? (
                  <div className="space-y-4">
                    <PlayerStatsTable title={detail.homeTeamName} players={playerGroups.home} tone="home" />
                    <PlayerStatsTable title={detail.awayTeamName} players={playerGroups.away} tone="away" />
                  </div>
                ) : null}
              </main>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Scoreboard({ detail }: { detail: MatchDetailData }) {
  const homeGoals = detail.events.filter((event) => ["Goal", "PenaltyGoal"].includes(event.eventType) && event.side === "Home");
  const awayGoals = detail.events.filter((event) => ["Goal", "PenaltyGoal"].includes(event.eventType) && event.side === "Away");

  return (
    <header className="border-b border-app-border bg-app-card px-4 py-6 shadow-lg shadow-black/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-app-green/10 px-4 py-1.5">
          <Trophy className="h-4 w-4 text-app-green" />
          <span className="font-heading text-xs font-bold uppercase tracking-widest text-app-green">Full Time</span>
          {detail.resolution ? <span className="text-xs font-semibold text-app-text-muted">· {formatResolution(detail.resolution)}</span> : null}
        </div>

        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-8">
          <TeamScoreBlock name={detail.homeTeamName} side="home" />
          <div className="flex items-center gap-3 md:gap-5">
            <span className="font-heading text-5xl font-black tabular-nums text-app-text md:text-7xl">{detail.homeGoals}</span>
            <div className="text-center">
              <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-app-green">FT</p>
              <p className="font-heading text-lg font-bold text-app-text-muted">-</p>
              {detail.homePenalties != null && detail.awayPenalties != null ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                  Pens {detail.homePenalties}-{detail.awayPenalties}
                </p>
              ) : null}
            </div>
            <span className="font-heading text-5xl font-black tabular-nums text-app-text md:text-7xl">{detail.awayGoals}</span>
          </div>
          <TeamScoreBlock name={detail.awayTeamName} side="away" />
        </div>

        {(homeGoals.length > 0 || awayGoals.length > 0) ? (
          <div className="grid w-full grid-cols-2 gap-6 border-t border-app-border/50 pt-4 text-xs md:gap-10">
            <ScoreboardScorers events={homeGoals} align="right" />
            <ScoreboardScorers events={awayGoals} align="left" />
          </div>
        ) : null}
      </div>
    </header>
  );
}

function ScoreboardScorers({ events, align }: { events: MatchDetailEventData[]; align: "left" | "right" }) {
  if (events.length === 0) {
    return <div />;
  }

  return (
    <div className={cx("flex flex-col gap-1.5", align === "right" ? "items-end text-right" : "items-start text-left")}>
      {events.map((goal, index) => (
        <div key={`${goal.minute}-${goal.playerId ?? index}`} className="max-w-full text-app-text-muted">
          <span className="font-medium text-app-text">{goal.playerName ?? "Unknown player"}</span>
          <span className="ml-1 font-heading font-bold tabular-nums">{goal.minute}'{goal.eventType === "PenaltyGoal" ? " (P)" : ""}</span>
          {goal.secondaryPlayerName ? (
            <span className="ml-2 inline-flex items-center gap-1 text-app-text-muted">
              <Footprints className="h-3.5 w-3.5 text-indigo-300" />
              {goal.secondaryPlayerName}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TeamScoreBlock({ name, side }: { name: string; side: "home" | "away" }) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", side === "home" ? "justify-end text-right" : "justify-start text-left")}>
      {side === "away" ? <TeamLogoBadge name={name} tone="away" /> : null}
      <p className="min-w-0 truncate font-heading text-base font-bold text-app-text md:text-xl">{name}</p>
      {side === "home" ? <TeamLogoBadge name={name} tone="home" /> : null}
    </div>
  );
}

function TeamLogoBadge({ name, tone }: { name: string; tone: "home" | "away" }) {
  const shortName = name.substring(0, 3).toUpperCase();
  const logoUrl = getTeamLogoUrl({ name, country: "", domestic_tier: undefined });

  return (
    <div
      className={cx(
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-white/95 p-2 shadow-lg md:h-20 md:w-20",
        tone === "home" ? "border-app-green/60" : "border-indigo-400/60",
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <span className={cx("font-heading text-sm font-black text-surface-900", logoUrl && "hidden")}>{shortName}</span>
    </div>
  );
}

function Timeline({ detail }: { detail: MatchDetailData }) {
  const playerOfTheMatch = [...detail.playerStats].sort((left, right) => right.rating - left.rating)[0] ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-app-border bg-app-card p-4 shadow-lg shadow-black/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-widest text-app-text-muted">Timeline</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-app-green">{detail.events.length} events</span>
        </div>
        {detail.events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-app-border bg-app-bg px-4 py-8 text-center text-sm text-app-text-muted">
            No main events were recorded for this match.
          </p>
        ) : (
          <div className="relative space-y-2 before:absolute before:left-[2.15rem] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-app-border">
            {detail.events.map((event, index) => (
              <EventRow
                key={`${event.minute}-${event.eventType}-${event.playerId ?? index}`}
                event={event}
                homeTeamName={detail.homeTeamName}
                awayTeamName={detail.awayTeamName}
              />
            ))}
          </div>
        )}
      </section>

      <PlayerOfTheMatchCard player={playerOfTheMatch} />
    </div>
  );
}

function EventRow({
  event,
  homeTeamName,
  awayTeamName,
  compact = false,
}: {
  event: MatchDetailEventData;
  homeTeamName: string;
  awayTeamName: string;
  compact?: boolean;
}) {
  const display = getEventDisplay(event.eventType);
  const isHome = event.side === "Home";
  const teamName = isHome ? homeTeamName : awayTeamName;

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2.5 transition hover:bg-white/[0.03]">
      <span className="w-8 shrink-0 text-right font-heading text-sm font-bold tabular-nums text-app-text-muted">{event.minute}'</span>
      <span className={cx("z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-app-card", display.ring)}>
        {display.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx("font-heading text-[10px] font-bold uppercase tracking-wider", isHome ? "text-app-green" : "text-indigo-300")}>{teamName}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">{formatEventType(event.eventType)}</span>
        </div>
        <p className={cx("truncate font-semibold text-app-text", compact ? "text-xs" : "text-sm")}>
          {event.playerName ?? "Unknown player"}
          {event.secondaryPlayerName ? (
            <span className="font-normal text-app-text-muted"> · Assist: {event.secondaryPlayerName}</span>
          ) : null}
        </p>
      </div>
      <span className={cx("rounded-md px-2 py-1 font-heading text-[10px] font-bold uppercase tracking-wider", isHome ? "bg-app-green/10 text-app-green" : "bg-indigo-500/10 text-indigo-300")}>
        {isHome ? "Home" : "Away"}
      </span>
    </div>
  );
}

function TeamStatsPanel({ home, away }: { home: MatchDetailTeamStatsData | null; away: MatchDetailTeamStatsData | null }) {
  if (!home || !away) {
    return <EmptyState text="No team stats were recorded for this match." />;
  }

  const rows = [
    { label: "Possession", home: `${home.possessionPct}%`, away: `${away.possessionPct}%`, homePct: home.possessionPct },
    { label: "Shots", home: home.shots, away: away.shots },
    { label: "Shots on Target", home: home.shotsOnTarget, away: away.shotsOnTarget },
    { label: "Passes", home: formatPasses(home), away: formatPasses(away) },
    { label: "Tackles Won", home: home.tacklesWon ?? "—", away: away.tacklesWon ?? "—" },
    { label: "Interceptions", home: home.interceptions ?? "—", away: away.interceptions ?? "—" },
    { label: "Fouls", home: home.fouls, away: away.fouls },
    { label: "Corners", home: home.corners ?? "—", away: away.corners ?? "—" },
    { label: "Yellow Cards", home: home.yellowCards, away: away.yellowCards },
    { label: "Red Cards", home: home.redCards, away: away.redCards },
  ];

  return (
    <section className="rounded-xl border border-app-border bg-app-card p-4 shadow-lg shadow-black/10">
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="truncate font-heading text-sm font-bold text-app-green">{home.teamName}</p>
        <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-app-text-muted">Match Stats</p>
        <p className="truncate text-right font-heading text-sm font-bold text-indigo-300">{away.teamName}</p>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <StatBar key={row.label} label={row.label} home={row.home} away={row.away} homePct={row.homePct} />
        ))}
      </div>
    </section>
  );
}

function StatBar({ label, home, away, homePct }: { label: string; home: string | number; away: string | number; homePct?: number }) {
  const homeNumber = typeof home === "number" ? home : Number.parseFloat(home);
  const awayNumber = typeof away === "number" ? away : Number.parseFloat(away);
  const total = Number.isFinite(homeNumber) && Number.isFinite(awayNumber) ? homeNumber + awayNumber : 0;
  const pct = homePct ?? (total > 0 ? (homeNumber / total) * 100 : 50);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="w-16 font-heading font-bold tabular-nums text-app-green">{home}</span>
        <span className="text-center font-heading text-[10px] font-bold uppercase tracking-wider text-app-text-muted">{label}</span>
        <span className="w-16 text-right font-heading font-bold tabular-nums text-indigo-300">{away}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-app-border/60">
        <div className="h-full bg-app-green transition-all" style={{ width: `${Math.max(5, Math.min(95, pct))}%` }} />
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.max(5, Math.min(95, 100 - pct))}%` }} />
      </div>
    </div>
  );
}

function PlayerOfTheMatchCard({ player }: { player: MatchDetailPlayerStatsData | null }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-card p-4 shadow-lg shadow-black/10">
      <h3 className="mb-3 font-heading text-[10px] font-bold uppercase tracking-widest text-app-text-muted">Player of the Match</h3>
      {player ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-app-green/35 bg-app-green/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-app-text">{player.playerName}</p>
            <p className="mt-1 text-xs text-app-text-muted">{player.teamName} · {player.minutesPlayed} min</p>
          </div>
          <span className="rounded-lg bg-app-green px-3 py-2 font-heading text-lg font-black tabular-nums text-app-bg">
            {player.rating.toFixed(1)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-app-text-muted">No player ratings recorded.</p>
      )}
    </section>
  );
}

function PlayerStatsTable({ title, players, tone }: { title: string; players: MatchDetailPlayerStatsData[]; tone: "home" | "away" }) {
  if (players.length === 0) {
    return <EmptyState text={`No player stats were recorded for ${title}.`} />;
  }

  return (
    <section className="rounded-xl border border-app-border bg-app-card shadow-lg shadow-black/10">
      <div className="border-b border-app-border px-4 py-3">
        <h3 className={cx("font-heading text-sm font-bold", tone === "home" ? "text-app-green" : "text-indigo-300")}>{title}</h3>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-app-bg text-[10px] uppercase tracking-wide text-app-text-muted">
            <tr>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-3 py-3 text-right">Min</th>
              <th className="px-3 py-3 text-right">G</th>
              <th className="px-3 py-3 text-right">A</th>
              <th className="px-3 py-3 text-right">Sh</th>
              <th className="px-3 py-3 text-right">SOT</th>
              <th className="px-3 py-3 text-right">Pass</th>
              <th className="px-3 py-3 text-right">Tkl</th>
              <th className="px-3 py-3 text-right">Int</th>
              <th className="px-3 py-3 text-right">Fouls</th>
              <th className="px-3 py-3 text-right">YC</th>
              <th className="px-3 py-3 text-right">RC</th>
              <th className="px-3 py-3 text-right">Rat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/50">
            {players.map((player) => (
              <tr key={player.playerId} className="bg-app-card hover:bg-white/[0.03]">
                <td className="px-3 py-3 font-semibold text-app-text">{player.playerName}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.minutesPlayed}</td>
                <td className="px-3 py-3 text-right text-app-text">{player.goals}</td>
                <td className="px-3 py-3 text-right text-app-text">{player.assists}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.shots}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.shotsOnTarget}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.passesCompleted}/{player.passesAttempted}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.tacklesWon}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.interceptions}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.foulsCommitted}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.yellowCards}</td>
                <td className="px-3 py-3 text-right text-app-text-muted">{player.redCards}</td>
                <td className="px-3 py-3 text-right font-heading font-bold text-app-green">{player.rating.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="m-4 rounded-xl border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-sm text-app-text-muted">{text}</div>;
}

function getEventDisplay(eventType: string) {
  switch (eventType) {
    case "Goal":
    case "PenaltyGoal":
      return {
        icon: <CircleDot className="h-5 w-5 text-app-green" />,
        ring: "border-app-green/50 text-app-green",
      };
    case "YellowCard":
      return {
        icon: <span className="block h-5 w-3.5 rounded-[2px] bg-yellow-400 shadow-sm" />,
        ring: "border-yellow-400/50",
      };
    case "RedCard":
    case "SecondYellow":
      return {
        icon: <span className="block h-5 w-3.5 rounded-[2px] bg-red-500 shadow-sm" />,
        ring: "border-red-500/50",
      };
    case "Substitution":
      return {
        icon: <ArrowDownUp className="h-5 w-5 text-sky-300" />,
        ring: "border-sky-400/50",
      };
    case "PenaltyMiss":
      return {
        icon: <ShieldAlert className="h-5 w-5 text-red-400" />,
        ring: "border-red-400/50",
      };
    case "Injury":
      return {
        icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
        ring: "border-amber-400/50",
      };
    default:
      return {
        icon: <Square className="h-4 w-4 text-app-text-muted" />,
        ring: "border-app-border",
      };
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function formatResolution(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatEventType(value: string) {
  return value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatPasses(stats: MatchDetailTeamStatsData) {
  if (stats.passesCompleted == null || stats.passesAttempted == null) {
    return "—";
  }
  return `${stats.passesCompleted}/${stats.passesAttempted}`;
}
