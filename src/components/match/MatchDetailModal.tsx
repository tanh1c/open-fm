import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { MatchDetailData, MatchDetailPlayerStatsData, MatchDetailTeamStatsData } from "../../store/types";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl">
        <div className="border-b border-app-border bg-app-bg/80 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-muted">Match Detail</p>
              {detail ? (
                <>
                  <h2 className="mt-2 font-heading text-2xl font-bold text-app-text">
                    {detail.homeTeamName} {detail.homeGoals} - {detail.awayGoals} {detail.awayTeamName}
                  </h2>
                  <p className="mt-1 text-sm text-app-muted">
                    {detail.competition} · Matchday {detail.matchday} · {formatDate(detail.date)}
                    {detail.resolution ? ` · ${formatResolution(detail.resolution)}` : ""}
                    {detail.homePenalties != null && detail.awayPenalties != null
                      ? ` · Pens ${detail.homePenalties}-${detail.awayPenalties}`
                      : ""}
                  </p>
                </>
              ) : (
                <h2 className="mt-2 font-heading text-2xl font-bold text-app-text">Loading match...</h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-app-border px-3 py-2 text-sm font-semibold text-app-muted transition hover:border-app-green hover:text-app-text"
            >
              Close
            </button>
          </div>
        </div>

        <div className="border-b border-app-border px-6 pt-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "border-app-border bg-app-bg text-app-text"
                    : "border-transparent text-app-muted hover:text-app-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loading ? <EmptyState text="Loading match details..." /> : null}
          {!loading && error ? <EmptyState text={error} /> : null}
          {!loading && !error && !detail ? <EmptyState text="No match detail is available for this fixture." /> : null}
          {!loading && !error && detail ? (
            <>
              {activeTab === "timeline" ? <Timeline detail={detail} /> : null}
              {activeTab === "teamStats" ? <TeamStatsTable home={detail.homeStats} away={detail.awayStats} /> : null}
              {activeTab === "playerStats" ? (
                <div className="space-y-6">
                  <PlayerStatsTable title={detail.homeTeamName} players={playerGroups.home} />
                  <PlayerStatsTable title={detail.awayTeamName} players={playerGroups.away} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Timeline({ detail }: { detail: MatchDetailData }) {
  if (detail.events.length === 0) {
    return <EmptyState text="No main events were recorded for this match." />;
  }

  return (
    <div className="space-y-3">
      {detail.events.map((event, index) => (
        <div key={`${event.minute}-${event.eventType}-${event.playerId ?? index}`} className="flex items-center gap-4 rounded-xl border border-app-border bg-app-bg px-4 py-3">
          <span className="w-12 rounded-lg bg-app-surface px-2 py-1 text-center font-heading text-sm font-bold text-app-green">{event.minute}'</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-app-text">{formatEventType(event.eventType)}</p>
            <p className="text-sm text-app-muted">
              {event.side} · {event.playerName ?? "Unknown player"}
              {event.secondaryPlayerName ? ` (${event.secondaryPlayerName})` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamStatsTable({ home, away }: { home: MatchDetailTeamStatsData | null; away: MatchDetailTeamStatsData | null }) {
  if (!home || !away) {
    return <EmptyState text="No team stats were recorded for this match." />;
  }

  const rows = [
    ["Possession", `${home.possessionPct}%`, `${away.possessionPct}%`],
    ["Shots", home.shots, away.shots],
    ["Shots on Target", home.shotsOnTarget, away.shotsOnTarget],
    ["Passes", formatPasses(home), formatPasses(away)],
    ["Tackles Won", home.tacklesWon ?? "—", away.tacklesWon ?? "—"],
    ["Interceptions", home.interceptions ?? "—", away.interceptions ?? "—"],
    ["Fouls", home.fouls, away.fouls],
    ["Corners", home.corners ?? "—", away.corners ?? "—"],
    ["Yellow Cards", home.yellowCards, away.yellowCards],
    ["Red Cards", home.redCards, away.redCards],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-app-border">
      <table className="w-full text-sm">
        <thead className="bg-app-bg text-xs uppercase tracking-wide text-app-muted">
          <tr>
            <th className="px-4 py-3 text-left">{home.teamName}</th>
            <th className="px-4 py-3 text-center">Stat</th>
            <th className="px-4 py-3 text-right">{away.teamName}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {rows.map(([label, homeValue, awayValue]) => (
            <tr key={label} className="bg-app-surface">
              <td className="px-4 py-3 font-semibold text-app-text">{homeValue}</td>
              <td className="px-4 py-3 text-center text-app-muted">{label}</td>
              <td className="px-4 py-3 text-right font-semibold text-app-text">{awayValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsTable({ title, players }: { title: string; players: MatchDetailPlayerStatsData[] }) {
  if (players.length === 0) {
    return <EmptyState text={`No player stats were recorded for ${title}.`} />;
  }

  return (
    <section>
      <h3 className="mb-3 font-heading text-lg font-bold text-app-text">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-app-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-app-bg text-xs uppercase tracking-wide text-app-muted">
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
          <tbody className="divide-y divide-app-border">
            {players.map((player) => (
              <tr key={player.playerId} className="bg-app-surface hover:bg-white/[0.03]">
                <td className="px-3 py-3 font-semibold text-app-text">{player.playerName}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.minutesPlayed}</td>
                <td className="px-3 py-3 text-right text-app-text">{player.goals}</td>
                <td className="px-3 py-3 text-right text-app-text">{player.assists}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.shots}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.shotsOnTarget}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.passesCompleted}/{player.passesAttempted}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.tacklesWon}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.interceptions}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.foulsCommitted}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.yellowCards}</td>
                <td className="px-3 py-3 text-right text-app-muted">{player.redCards}</td>
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
  return <div className="rounded-xl border border-dashed border-app-border bg-app-bg px-4 py-8 text-center text-sm text-app-muted">{text}</div>;
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
