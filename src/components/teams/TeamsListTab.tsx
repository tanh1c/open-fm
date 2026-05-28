import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { GameStateData, TeamData } from "../../store/gameStore";
import TeamLogo from "../common/TeamLogo";
import { Building2, Crown, Shield, Trophy, Users } from "lucide-react";
import { formatVal, getPlayerOvr } from "../../lib/helpers";
import { useTranslation } from "react-i18next";
import { TeamLocation } from "../ui";

interface TeamsListTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

type TeamRowData = {
  team: TeamData;
  rosterSize: number;
  avgOvr: number;
  totalValue: number;
  leaguePos: number;
  standing: NonNullable<GameStateData["league"]>["standings"][number] | undefined;
};

type SortKey = "position" | "team" | "location" | "squad" | "ovr" | "rep" | "value" | "points" | "identity";

const TEAMS_PAGE_SIZE = 30;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h4>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function StatRow({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className={cx("font-bold", tone)}>{value}</span>
    </div>
  );
}

function HeaderChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
      <span className="text-app-green">{icon}</span>
      {label}: <span className="font-bold text-app-text">{value}</span>
    </div>
  );
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export default function TeamsListTab({ gameState, onSelectTeam }: TeamsListTabProps) {
  const { t, i18n } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [secondaryPanelsReady, setSecondaryPanelsReady] = useState(false);

  const handleSort = (key: SortKey) => {
    setPage(0);
    if (sortKey === key) {
      setSortAsc((current) => !current);
      return;
    }

    setSortKey(key);
    setSortAsc(key === "team" || key === "location" || key === "identity");
  };

  const allStandings = useMemo(
    () => gameState.league?.standings
      ? [...gameState.league.standings].sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) || b.goals_for - a.goals_for)
      : [],
    [gameState.league?.standings],
  );

  const standingsByTeamId = useMemo(() => {
    const map = new Map<string, { standing: TeamRowData["standing"]; leaguePos: number }>();
    allStandings.forEach((standing, index) => {
      map.set(standing.team_id, { standing, leaguePos: index + 1 });
    });
    return map;
  }, [allStandings]);

  const rosterStatsByTeamId = useMemo(() => {
    const map = new Map<string, { rosterSize: number; ovrTotal: number; totalValue: number }>();

    for (const player of gameState.players) {
      if (!player.team_id) continue;
      const current = map.get(player.team_id) ?? { rosterSize: 0, ovrTotal: 0, totalValue: 0 };
      current.rosterSize += 1;
      current.ovrTotal += getPlayerOvr(player);
      current.totalValue += player.market_value;
      map.set(player.team_id, current);
    }

    return map;
  }, [gameState.players]);

  const teamsData = useMemo<TeamRowData[]>(() => gameState.teams.map((team) => {
    const rosterStats = rosterStatsByTeamId.get(team.id);
    const standingStats = standingsByTeamId.get(team.id);
    const rosterSize = rosterStats?.rosterSize ?? 0;
    const avgOvr = rosterStats && rosterSize > 0 ? Math.round(rosterStats.ovrTotal / rosterSize) : 0;

    return {
      team,
      rosterSize,
      avgOvr,
      totalValue: rosterStats?.totalValue ?? 0,
      leaguePos: standingStats?.leaguePos ?? 0,
      standing: standingStats?.standing,
    };
  }), [gameState.teams, rosterStatsByTeamId, standingsByTeamId]);

  const sortedTeamsData = useMemo(() => [...teamsData].sort((a, b) => {
    const fallback = () => {
      if (a.leaguePos > 0 && b.leaguePos > 0) return a.leaguePos - b.leaguePos;
      if (a.leaguePos > 0) return -1;
      if (b.leaguePos > 0) return 1;
      return b.avgOvr - a.avgOvr || b.totalValue - a.totalValue || compareText(a.team.name, b.team.name);
    };

    let result = 0;
    switch (sortKey) {
      case "position":
        result = (a.leaguePos || Number.MAX_SAFE_INTEGER) - (b.leaguePos || Number.MAX_SAFE_INTEGER);
        break;
      case "team":
        result = compareText(a.team.name, b.team.name);
        break;
      case "location":
        result = compareText(`${a.team.country} ${a.team.city}`, `${b.team.country} ${b.team.city}`);
        break;
      case "squad":
        result = a.rosterSize - b.rosterSize;
        break;
      case "ovr":
        result = a.avgOvr - b.avgOvr;
        break;
      case "rep":
        result = a.team.reputation - b.team.reputation;
        break;
      case "value":
        result = a.totalValue - b.totalValue;
        break;
      case "points":
        result = (a.standing?.points ?? -1) - (b.standing?.points ?? -1);
        break;
      case "identity":
        result = compareText(`${a.team.formation} ${a.team.play_style}`, `${b.team.formation} ${b.team.play_style}`);
        break;
    }

    if (result === 0) return fallback();
    return sortAsc ? result : -result;
  }), [sortAsc, sortKey, teamsData]);

  const totalPages = Math.max(1, Math.ceil(sortedTeamsData.length / TEAMS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleTeamsData = sortedTeamsData.slice(safePage * TEAMS_PAGE_SIZE, (safePage + 1) * TEAMS_PAGE_SIZE);
  const pageStart = sortedTeamsData.length > 0 ? safePage * TEAMS_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(sortedTeamsData.length, (safePage + 1) * TEAMS_PAGE_SIZE);

  const userTeam = teamsData.find((entry) => entry.team.id === userTeamId) ?? null;
  const leagueLeader = teamsData.find((entry) => entry.leaguePos === 1) ?? teamsData[0] ?? null;
  const mostValuable = [...teamsData].sort((a, b) => b.totalValue - a.totalValue)[0] ?? null;
  const strongest = [...teamsData].sort((a, b) => b.avgOvr - a.avgOvr)[0] ?? null;
  const totalSquadValue = teamsData.reduce((sum, entry) => sum + entry.totalValue, 0);
  const averageSquadValue = teamsData.length > 0 ? totalSquadValue / teamsData.length : 0;
  const standingsCount = teamsData.filter((entry) => entry.standing).length;
  const leagueLabel = gameState.league?.name ?? t("common.league", "League");

  useEffect(() => {
    return requestIdleTask(() => setSecondaryPanelsReady(true));
  }, []);

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">TEAMS</h1>
          <p className="text-sm text-app-text-muted">
            {leagueLabel} &bull; {teamsData.length} clubs &bull; {userTeam?.team.name ?? t("common.noTeam")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderChip icon={<Building2 className="h-4 w-4" />} label="Clubs" value={String(teamsData.length)} />
          <HeaderChip icon={<Trophy className="h-4 w-4" />} label="Leader" value={leagueLeader?.leaguePos ? `#${leagueLeader.leaguePos}` : "—"} />
          <HeaderChip icon={<Users className="h-4 w-4" />} label="Avg value" value={formatVal(averageSquadValue)} />
          <div className="flex items-center gap-2 rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            <Shield className="h-4 w-4" />
            Managed Club
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar sm:flex xl:w-[280px]">
          <div>
            <SectionTitle title="LEAGUE SUMMARY" action={leagueLabel} />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="Clubs" value={String(teamsData.length)} tone="text-app-green" />
              <StatRow label="Total squad value" value={formatVal(totalSquadValue)} />
              <StatRow label="Average value" value={formatVal(averageSquadValue)} />
              <StatRow label="Top avg OVR" value={strongest ? String(strongest.avgOvr) : "—"} tone="text-app-green" />
            </TemplateCard>
          </div>

          {secondaryPanelsReady && userTeam ? (
            <YourClubCard
              entry={userTeam}
              locale={i18n.language}
              labels={{
                squad: t("teams.squad"),
                avgOvr: t("teams.avgOvr"),
                value: t("common.value"),
                pts: t("common.pts"),
              }}
            />
          ) : (
            <SecondaryPanelShell title="YOUR CLUB" />
          )}

          {secondaryPanelsReady ? (
            <ClubIdentityCard mostValuable={mostValuable} strongest={strongest} leagueLeader={leagueLeader} />
          ) : (
            <SecondaryPanelShell title="CLUB IDENTITY" />
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 h-full">
          <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app-bg">
            <div className="flex items-center justify-between border-b border-app-border/50 bg-app-card px-4 py-3">
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-green">CLUB DIRECTORY</h2>
                <p className="mt-1 text-xs text-app-text-muted">Click a club to open its team profile.</p>
              </div>
              <span className="rounded bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">{teamsData.length} Teams</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
              <table className="w-full min-w-[980px] text-left text-[11px] whitespace-nowrap">
                <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card">
                  <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                    <SortHeader label="#" sortKey="position" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" className="w-12" />
                    <SortHeader label={t("common.team")} sortKey="team" current={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortHeader label="Location" sortKey="location" current={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortHeader label={t("teams.squad")} sortKey="squad" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <SortHeader label={t("teams.avgOvr")} sortKey="ovr" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <SortHeader label={t("teams.rep")} sortKey="rep" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <SortHeader label={t("common.value")} sortKey="value" current={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                    <SortHeader label={t("common.pts")} sortKey="points" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <SortHeader label="Identity" sortKey="identity" current={sortKey} asc={sortAsc} onClick={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30 text-app-text">
                  {visibleTeamsData.map((entry) => (
                    <TeamDirectoryRow
                      key={entry.team.id}
                      entry={entry}
                      isUser={entry.team.id === userTeamId}
                      locale={i18n.language}
                      estLabel={t("teams.est")}
                      yourTeamLabel={t("teams.yourTeam")}
                      onSelectTeam={onSelectTeam}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-app-border/50 bg-app-card px-4 py-3 text-xs text-app-text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {pageStart}-{pageEnd} of {sortedTeamsData.length} clubs
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={safePage === 0}
                  className="rounded border border-app-border px-3 py-1.5 font-semibold text-app-text transition-colors hover:border-app-green hover:text-app-green disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="rounded bg-app-bg px-3 py-1.5 font-bold text-app-green">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="rounded border border-app-border px-3 py-1.5 font-semibold text-app-text transition-colors hover:border-app-green hover:text-app-green disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </TemplateCard>
        </section>

        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[360px]">
          {secondaryPanelsReady ? (
            <>
              <FeaturedTeam title="LEAGUE LEADER" action={leagueLeader?.leaguePos ? `#${leagueLeader.leaguePos}` : "Top"} entry={leagueLeader} locale={i18n.language} onSelectTeam={onSelectTeam} />
              <FeaturedTeam title="MOST VALUABLE" action={mostValuable ? formatVal(mostValuable.totalValue) : "Market"} entry={mostValuable} locale={i18n.language} onSelectTeam={onSelectTeam} />
              <FeaturedTeam title="STRONGEST SQUAD" action={strongest ? `${strongest.avgOvr} OVR` : "Rating"} entry={strongest} locale={i18n.language} onSelectTeam={onSelectTeam} />
              <TableHintCard visibleClubCount={visibleTeamsData.length} totalClubCount={teamsData.length} standingsCount={standingsCount} />
            </>
          ) : (
            <>
              <SecondaryPanelShell title="LEAGUE LEADER" />
              <SecondaryPanelShell title="MOST VALUABLE" />
              <SecondaryPanelShell title="STRONGEST SQUAD" />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function requestIdleTask(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 500 });
    return () => window.cancelIdleCallback(id);
  }

  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
}

function SecondaryPanelShell({ title }: { title: string }) {
  return (
    <div>
      <SectionTitle title={title} action="Loading" />
      <TemplateCard className="h-24 animate-pulse bg-app-bg/70">
        <span className="sr-only">Loading {title}</span>
      </TemplateCard>
    </div>
  );
}

const TeamDirectoryRow = memo(function TeamDirectoryRow({
  entry,
  isUser,
  locale,
  estLabel,
  yourTeamLabel,
  onSelectTeam,
}: {
  entry: TeamRowData;
  isUser: boolean;
  locale: string;
  estLabel: string;
  yourTeamLabel: string;
  onSelectTeam: (id: string) => void;
}) {
  const { team, rosterSize, avgOvr, totalValue, leaguePos, standing } = entry;
  const goalDifference = standing ? standing.goals_for - standing.goals_against : 0;

  return (
    <tr onClick={() => onSelectTeam(team.id)} className={cx("cursor-pointer transition-colors hover:bg-white/5", isUser && "bg-app-green/10 ring-1 ring-inset ring-app-green/30")}>
      <td className="px-4 py-3 text-center font-heading text-sm font-bold text-app-text-muted">{leaguePos > 0 ? leaguePos : "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TeamLogo team={team} size="sm" />
          <div className="min-w-0">
            <h3 className={cx("truncate text-sm font-bold", isUser ? "text-app-green" : "text-app-text")}>{team.name}</h3>
            <p className="text-[10px] text-app-text-muted">{estLabel} {team.founded_year}</p>
            {isUser ? <span className="mt-1 inline-flex rounded bg-app-green/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-app-green">{yourTeamLabel}</span> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <TeamLocation city={team.city} countryCode={team.country} locale={locale} className="text-xs text-app-text-muted" iconClassName="h-3 w-3" flagClassName="text-xs leading-none" />
      </td>
      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{rosterSize}</td>
      <td className="px-4 py-3 text-center font-heading text-sm font-bold tabular-nums text-app-green">{avgOvr}</td>
      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{team.reputation}</td>
      <td className="px-4 py-3 text-right font-semibold text-app-text-muted">{formatVal(totalValue)}</td>
      <td className="px-4 py-3 text-center">
        {standing ? (
          <div>
            <p className="font-heading text-sm font-bold text-app-text">{standing.points}</p>
            <p className={cx("text-[10px]", goalDifference > 0 ? "text-app-green" : goalDifference < 0 ? "text-red-400" : "text-app-text-muted")}>{goalDifference > 0 ? `+${goalDifference}` : goalDifference} GD</p>
          </div>
        ) : <span className="text-app-text-muted">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 text-[10px] text-app-text-muted">
          <span>{team.formation}</span>
          <span className="truncate text-app-text">{team.play_style}</span>
        </div>
      </td>
    </tr>
  );
});

function YourClubCard({ entry, locale, labels }: { entry: TeamRowData; locale: string; labels: { squad: string; avgOvr: string; value: string; pts: string } }) {
  return (
    <div>
      <SectionTitle title="YOUR CLUB" action={entry.leaguePos > 0 ? `#${entry.leaguePos}` : "Club"} />
      <TemplateCard className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <TeamLogo team={entry.team} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-app-text">Managed Club</p>
            <TeamLocation city={entry.team.city} countryCode={entry.team.country} locale={locale} className="text-xs text-app-text-muted" iconClassName="h-3 w-3" flagClassName="text-xs leading-none" />
          </div>
        </div>
        <div className="border-t border-app-border/50 pt-3">
          <StatRow label={labels.squad} value={String(entry.rosterSize)} />
          <StatRow label={labels.avgOvr} value={String(entry.avgOvr)} tone="text-app-green" />
          <StatRow label={labels.value} value={formatVal(entry.totalValue)} />
          <StatRow label={labels.pts} value={String(entry.standing?.points ?? "—")} tone="text-app-green" />
        </div>
      </TemplateCard>
    </div>
  );
}

function ClubIdentityCard({ mostValuable, strongest, leagueLeader }: { mostValuable: TeamRowData | null; strongest: TeamRowData | null; leagueLeader: TeamRowData | null }) {
  return (
    <div>
      <SectionTitle title="CLUB IDENTITY" action="Styles" />
      <TemplateCard className="flex flex-col gap-3 p-4">
        <StatRow label="Most valuable" value={mostValuable ? formatVal(mostValuable.totalValue) : "—"} tone="text-app-green" />
        <StatRow label="Strongest" value={strongest ? String(strongest.avgOvr) : "—"} tone="text-app-green" />
        <StatRow label="Leader" value={leagueLeader?.leaguePos ? `#${leagueLeader.leaguePos}` : "—"} />
      </TemplateCard>
    </div>
  );
}

function TableHintCard({ visibleClubCount, totalClubCount, standingsCount }: { visibleClubCount: number; totalClubCount: number; standingsCount: number }) {
  return (
    <div>
      <SectionTitle title="TABLE HINT" action="Profiles" />
      <TemplateCard className="flex flex-col gap-3 p-4 text-xs text-app-text-muted">
        <p>Open any club row to inspect its roster, fixtures, profile, and squad details.</p>
        <StatRow label="Rendered clubs" value={`${visibleClubCount}/${totalClubCount}`} tone="text-app-green" />
        <StatRow label="With standings" value={String(standingsCount)} />
      </TemplateCard>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  asc,
  onClick,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const active = current === sortKey;
  const alignClass = align === "right" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "justify-start text-left";

  return (
    <th className={cx("px-4 py-3", align === "right" && "text-right", align === "center" && "text-center", className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cx("inline-flex items-center gap-1 transition-colors hover:text-app-green", alignClass, active && "text-app-green")}
      >
        <span>{label}</span>
        <span className={cx("text-[8px]", active ? "opacity-100" : "opacity-30")}>{active ? (asc ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function FeaturedTeam({
  title,
  action,
  entry,
  locale,
  onSelectTeam,
}: {
  title: string;
  action: string;
  entry: TeamRowData | null;
  locale: string;
  onSelectTeam: (id: string) => void;
}) {
  return (
    <div>
      <SectionTitle title={title} action={action} />
      <TemplateCard className="p-4">
        {entry ? (
          <button type="button" onClick={() => onSelectTeam(entry.team.id)} className="w-full text-left">
            <div className="flex items-center gap-3">
              <TeamLogo team={entry.team} className="h-12 w-12 rounded-xl border border-app-border" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-app-text">#{entry.leaguePos > 0 ? entry.leaguePos : "—"}</p>
                <TeamLocation city={entry.team.city} countryCode={entry.team.country} locale={locale} className="text-xs text-app-text-muted" iconClassName="h-3 w-3" flagClassName="text-xs leading-none" />
              </div>
              <Crown className="h-4 w-4 text-app-green" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-app-border/50 pt-3 text-center">
              <MiniStat label="OVR" value={String(entry.avgOvr)} />
              <MiniStat label="Squad" value={String(entry.rosterSize)} />
              <MiniStat label="Pts" value={String(entry.standing?.points ?? "—")} />
            </div>
            <p className="mt-3 truncate text-[10px] text-app-text-muted">{entry.team.formation} &bull; {entry.team.play_style}</p>
          </button>
        ) : <p className="text-xs text-app-text-muted">No club data available.</p>}
      </TemplateCard>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-bg px-2 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">{label}</p>
      <p className="mt-1 font-heading text-sm font-bold text-app-green">{value}</p>
    </div>
  );
}
