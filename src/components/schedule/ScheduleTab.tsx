import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Globe2,
  LayoutGrid,
  List,
  TableProperties,
  Trophy,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { FixtureData, GameStateData, getCompetitionDisplayName } from "../../store/gameStore";
import { TeamData } from "../../store/types";
import { getCompetitionForTeam } from "../../store/types";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { getCompetitionTag } from "../../lib/competitionTag";
import { getCompetitionLogoUrl } from "../../lib/divisionLogos";
import { resolveSeasonContext } from "../../lib/seasonContext";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import TeamLogo from "../common/TeamLogo";
import { CountryFlag } from "../ui/CountryFlag";
import MonthCalendar, { type CalendarEvent } from "../common/MonthCalendar";
import MatchDetailModal from "../match/MatchDetailModal";
import FixtureInfoModal from "./FixtureInfoModal";

interface ScheduleTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
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

function FixtureTeamLine({ team, name }: { team?: TeamData; name: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-bold text-app-text">
      {team ? <TeamLogo team={team} size="sm" /> : null}
      <span>{name}</span>
    </div>
  );
}

type CompetitionOption = NonNullable<GameStateData["competitions"]>[number] | NonNullable<GameStateData["league"]>;

type CompetitionRegion = {
  key: string;
  label: string;
  competitions: CompetitionOption[];
  leagueCount: number;
  cupCount: number;
  continentalCount: number;
};

function competitionKindOf(competition: CompetitionOption): string {
  return "kind" in competition ? competition.kind : "DomesticLeague";
}

function competitionCountryOf(competition: CompetitionOption): string {
  if ("country" in competition && competition.country) {
    return competition.country;
  }
  return competitionKindOf(competition) === "ContinentalLeague" ? "Europe" : "World";
}

function competitionTierLabel(competition: CompetitionOption): string {
  if ("tier" in competition && typeof competition.tier === "number") {
    return `T${competition.tier}`;
  }
  const kind = competitionKindOf(competition);
  if (kind === "DomesticCup") return "Cup";
  if (kind === "ContinentalLeague") return "Europe";
  return "League";
}

function CompetitionLogo({ competition, className = "h-6 w-6" }: { competition: CompetitionOption; className?: string }) {
  const logoUrl = getCompetitionLogoUrl({
    name: "name" in competition ? competition.name : getCompetitionDisplayName(competition),
    country: competitionCountryOf(competition),
    kind: competitionKindOf(competition),
  });

  return logoUrl ? (
    <span className={cx("flex shrink-0 items-center justify-center rounded bg-white p-1 shadow-sm ring-1 ring-gray-200", className)}>
      <img src={logoUrl} alt="" aria-hidden="true" className="h-full w-full object-contain" />
    </span>
  ) : (
    <span className={cx("flex shrink-0 items-center justify-center rounded border border-app-border bg-app-bg text-app-text-muted", className)}>
      <Trophy className="h-3.5 w-3.5" />
    </span>
  );
}

const COMPETITION_COUNTRY_CODES: Record<string, string> = {
  Belgium: "BE",
  England: "ENG",
  France: "FR",
  Germany: "DE",
  Italy: "IT",
  Netherlands: "NL",
  Portugal: "PT",
  Spain: "ES",
};

const CHAMPIONS_LEAGUE_LOGO = "/images/logo/tournaments/tournaments_uefa-champions-league--no-text-white.football-logos.cc.svg";

function RegionFlag({ region }: { region: CompetitionRegion }) {
  if (region.key === "continental") {
    return <img src={CHAMPIONS_LEAGUE_LOGO} alt={region.label} className="h-5 w-5 object-contain" />;
  }

  const code = COMPETITION_COUNTRY_CODES[region.label];
  return code ? <CountryFlag code={code} className="text-lg" title={region.label} /> : <Globe2 className="h-4 w-4" />;
}

function buildCompetitionRegions(competitions: CompetitionOption[]): CompetitionRegion[] {
  const byRegion = new Map<string, CompetitionRegion>();

  competitions.forEach((competition) => {
    const country = competitionCountryOf(competition);
    const key = country === "Europe" ? "continental" : country;
    const kind = competitionKindOf(competition);
    const existing = byRegion.get(key) ?? {
      key,
      label: country,
      competitions: [],
      leagueCount: 0,
      cupCount: 0,
      continentalCount: 0,
    };

    existing.competitions.push(competition);
    if (kind === "DomesticCup") existing.cupCount += 1;
    else if (kind === "ContinentalLeague") existing.continentalCount += 1;
    else existing.leagueCount += 1;
    byRegion.set(key, existing);
  });

  return Array.from(byRegion.values())
    .map((region) => ({
      ...region,
      competitions: [...region.competitions].sort((a, b) => {
        const aKind = competitionKindOf(a);
        const bKind = competitionKindOf(b);
        const aTier = "tier" in a && typeof a.tier === "number" ? a.tier : 99;
        const bTier = "tier" in b && typeof b.tier === "number" ? b.tier : 99;
        return (
          Number(aKind === "DomesticCup") - Number(bKind === "DomesticCup") ||
          Number(aKind === "ContinentalLeague") - Number(bKind === "ContinentalLeague") ||
          aTier - bTier ||
          getCompetitionDisplayName(a).localeCompare(getCompetitionDisplayName(b))
        );
      }),
    }))
    .sort((a, b) => {
      if (a.key === "continental") return -1;
      if (b.key === "continental") return 1;
      return a.label.localeCompare(b.label);
    });
}

function fixtureIncludesTeam(fixture: FixtureData, teamId?: string | null): boolean {
  return !!teamId && (fixture.home_team_id === teamId || fixture.away_team_id === teamId);
}

function ScheduleCompetitionSelector({
  regions,
  selectedCompetition,
  onSelectCompetition,
}: {
  regions: CompetitionRegion[];
  selectedCompetition: CompetitionOption;
  onSelectCompetition: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedRegion = regions.find((region) =>
    region.competitions.some((competition) => competition.id === selectedCompetition.id),
  );
  const [expandedRegionKey, setExpandedRegionKey] = useState<string | null>(selectedRegion?.key ?? regions[0]?.key ?? null);

  useEffect(() => {
    if (selectedRegion?.key) {
      setExpandedRegionKey(selectedRegion.key);
    }
  }, [selectedRegion?.key]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-[320px] items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-left text-sm font-bold text-app-text outline-none transition-colors hover:bg-white/5 focus:border-app-green"
        aria-haspopup="dialog"
      >
        <CompetitionLogo competition={selectedCompetition} className="h-5 w-5" />
        <span className="min-w-0 flex-1 truncate">{getCompetitionDisplayName(selectedCompetition)}</span>
        <Globe2 className="h-4 w-4 shrink-0 text-app-green" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-bg shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-app-border/50 bg-app-card px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-green/30 bg-app-green/10 text-app-green">
                  <Globe2 className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-app-green">Competition selector</span>
                  <span className="block truncate text-xs text-app-text-muted">
                    {selectedRegion ? `${selectedRegion.label} · ${selectedRegion.competitions.length} competitions` : `${regions.length} regions`}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-app-border bg-app-bg p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                aria-label="Close competition selector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 overflow-y-auto p-3 custom-scrollbar lg:grid-cols-2 xl:grid-cols-3">
              {regions.map((region) => {
                const regionActive = region.competitions.some((competition) => competition.id === selectedCompetition.id);
                const expanded = expandedRegionKey === region.key;
                return (
                  <div
                    key={region.key}
                    className={cx(
                      "overflow-hidden rounded-lg border bg-app-card transition-colors",
                      regionActive ? "border-app-green/60" : "border-app-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRegionKey(expanded ? null : region.key)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-9 items-center justify-center rounded border border-app-border bg-app-bg">
                          <RegionFlag region={region} />
                        </span>
                        <span className="min-w-0">
                          <span className={cx("block truncate text-xs font-bold uppercase tracking-wide", regionActive ? "text-app-green" : "text-app-text")}>{region.label}</span>
                          <span className="block text-[10px] text-app-text-muted">
                            {region.competitions.length} comps · {region.leagueCount} lg · {region.cupCount} cup
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                        {expanded ? "−" : "+"}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="border-t border-app-border/40 bg-app-bg/60 p-2">
                        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
                          {region.competitions.map((competition) => {
                            const active = competition.id === selectedCompetition.id;
                            const teamCount = "team_ids" in competition && Array.isArray(competition.team_ids)
                              ? competition.team_ids.length
                              : competition.standings.length;
                            return (
                              <button
                                key={competition.id}
                                type="button"
                                onClick={() => {
                                  onSelectCompetition(competition.id);
                                  setOpen(false);
                                }}
                                className={cx(
                                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                                  active
                                    ? "bg-app-green/10 text-app-green ring-1 ring-inset ring-app-green/35"
                                    : "text-app-text-muted hover:bg-white/5 hover:text-app-text",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <CompetitionLogo competition={competition} className="h-5 w-5" />
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold">{getCompetitionDisplayName(competition)}</span>
                                    <span className="block text-[10px] text-app-text-muted">
                                      S{competition.season} · {teamCount} teams
                                    </span>
                                  </span>
                                </span>
                                <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                  {competitionTierLabel(competition)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function ScheduleTab({
  gameState,
  onSelectTeam,
}: ScheduleTabProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"fixtures" | "standings">("fixtures");
  const [activeFixtureGroupIndex, setActiveFixtureGroupIndex] = useState(0);
  // Default the fixtures view to the user's own club so they can see their past
  // results and upcoming matches at a glance, rather than the whole league's
  // matchday 1. Falls back to the full competition view when unemployed.
  const [fixtureScope, setFixtureScope] = useState<"team" | "all">(
    gameState.manager.team_id ? "team" : "all",
  );
  // My Club fixtures can be shown as a flat list or a month calendar grid.
  const [fixtureLayout, setFixtureLayout] = useState<"list" | "calendar">("list");
  const [selectedMatchFixtureId, setSelectedMatchFixtureId] = useState<string | null>(null);
  const [infoFixture, setInfoFixture] = useState<FixtureData | null>(null);
  const competitionOptions = gameState.competitions?.length
    ? gameState.competitions
    : gameState.league
      ? [gameState.league]
      : [];
  // Default to the competition the user's club plays in, not the first one in
  // the list (which is roughly alphabetical / generation order).
  const defaultCompetitionId =
    getCompetitionForTeam(gameState, gameState.manager.team_id)?.id ??
    competitionOptions[0]?.id ??
    "";
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(
    defaultCompetitionId,
  );
  const selectedCompetition =
    competitionOptions.find((competition) => competition.id === selectedCompetitionId) ??
    competitionOptions[0] ??
    null;
  const userTeamId = gameState.manager.team_id;
  const teamById = useMemo(
    () => new Map(gameState.teams.map((team) => [team.id, team])),
    [gameState.teams],
  );
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const canShowStandings = selectedCompetition?.standings.length > 0;
  const competitionLabel = selectedCompetition ? getCompetitionDisplayName(selectedCompetition) : "";
  const competitionRegions = useMemo(() => buildCompetitionRegions(competitionOptions), [competitionOptions]);

  useEffect(() => {
    if (competitionOptions.length === 0) {
      if (selectedCompetitionId) {
        setSelectedCompetitionId("");
      }
      return;
    }

    if (!competitionOptions.some((competition) => competition.id === selectedCompetitionId)) {
      setSelectedCompetitionId(defaultCompetitionId);
    }
  }, [competitionOptions, selectedCompetitionId, defaultCompetitionId]);

  useEffect(() => {
    setActiveFixtureGroupIndex(0);
  }, [selectedCompetitionId]);

  useEffect(() => {
    if (!canShowStandings && view === "standings") {
      setView("fixtures");
    }
  }, [canShowStandings, view]);

  const getFixtureGroupKey = (fixture: FixtureData): string => {
    if (fixture.competition === "League" || fixture.competition === "DomesticLeague") {
      return `league-${fixture.matchday}`;
    }

    return `${fixture.competition}-${fixture.date}`;
  };

  const getFixtureGroupLabel = (fixture: FixtureData): string => {
    if (fixture.competition === "League" || fixture.competition === "DomesticLeague") {
      return `${t("schedule.matchday", { number: fixture.matchday })} — ${formatMatchDate(fixture.date)}`;
    }

    if (fixture.competition === "ContinentalLeague") {
      return `Champions League — ${formatMatchDate(fixture.date)}`;
    }

    if (fixture.competition === "DomesticCup") {
      const cupName =
        (fixture.competition_id &&
          gameState.competitions?.find((competition) => competition.id === fixture.competition_id)?.name) ||
        selectedCompetition.name;
      return `${cupName} round ${fixture.matchday} — ${formatMatchDate(fixture.date)}`;
    }

    if (fixture.competition === "PreseasonTournament") {
      return `${t("season.preseasonTournament")} — ${formatMatchDate(fixture.date)}`;
    }

    return `${t("season.friendly")} — ${formatMatchDate(fixture.date)}`;
  };

  const buildTeamMenuItem = (
    label: string,
    teamId: string,
  ): ContextMenuItem => ({
    label,
    onClick: () => onSelectTeam(teamId),
  });

  if (!selectedCompetition) {
    return (
      <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
        <TemplateCard className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-bg text-app-text-muted">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">SCHEDULE</h1>
          <p className="text-sm text-app-text-muted">{t("schedule.noLeague")}</p>
        </TemplateCard>
      </div>
    );
  }

  const matchdays = new Map<string, FixtureData[]>();
  selectedCompetition.fixtures.forEach((fixture) => {
    const key = getFixtureGroupKey(fixture);
    const list = matchdays.get(key) || [];
    list.push(fixture);
    matchdays.set(key, list);
  });
  const sortedMatchdays = Array.from(matchdays.entries()).sort((a, b) => {
    const leftFixture = a[1][0];
    const rightFixture = b[1][0];
    return (
      leftFixture.date.localeCompare(rightFixture.date) ||
      leftFixture.matchday - rightFixture.matchday
    );
  });

  const activeFixtureGroupSafeIndex = Math.min(
    activeFixtureGroupIndex,
    Math.max(sortedMatchdays.length - 1, 0),
  );
  const activeFixtureGroup = sortedMatchdays[activeFixtureGroupSafeIndex] ?? null;
  const activeFixtureGroupFixtures = activeFixtureGroup?.[1] ?? [];
  const activeFixtureGroupLabel = activeFixtureGroupFixtures[0]
    ? getFixtureGroupLabel(activeFixtureGroupFixtures[0])
    : t("schedule.fixtures");

  const standings = [...selectedCompetition.standings].sort(
    (a, b) =>
      b.points - a.points ||
      b.goals_for - b.goals_against - (a.goals_for - a.goals_against) ||
      b.goals_for - a.goals_for,
  );

  const userTeamName = userTeamId ? getTeamName(gameState.teams, userTeamId) : t("common.team");
  // Aggregate the user's fixtures from every source — all competitions plus the
  // standalone league — so the "My Club" view also surfaces friendlies, cups and
  // continental matches that don't live in the currently selected competition.
  // (Preseason friendlies are appended to game.league, not game.competitions.)
  const userFixtures = useMemo(() => {
    if (!userTeamId) return [] as FixtureData[];
    const sources: FixtureData[][] = [];
    (gameState.competitions ?? []).forEach((competition) => sources.push(competition.fixtures));
    if (gameState.league) sources.push(gameState.league.fixtures);

    const seen = new Set<string>();
    const collected: FixtureData[] = [];
    for (const fixtures of sources) {
      for (const fixture of fixtures) {
        if (seen.has(fixture.id)) continue;
        if (!fixtureIncludesTeam(fixture, userTeamId)) continue;
        seen.add(fixture.id);
        collected.push(fixture);
      }
    }
    return collected.sort(
      (left, right) => left.date.localeCompare(right.date) || left.matchday - right.matchday,
    );
  }, [gameState.competitions, gameState.league, userTeamId]);
  const nextUserFixture = userFixtures.find((fixture) => fixture.status !== "Completed") ?? null;
  const recentUserFixtures = [...userFixtures]
    .filter((fixture) => fixture.status === "Completed")
    .sort((left, right) => right.date.localeCompare(left.date) || right.matchday - left.matchday)
    .slice(0, 5);
  const completedFixtureCount = selectedCompetition.fixtures.filter((fixture) => fixture.status === "Completed").length;
  const upcomingFixtureCount = selectedCompetition.fixtures.length - completedFixtureCount;
  const currentDate = formatMatchDate(gameState.clock.current_date.slice(0, 10));
  const todayIso = gameState.clock.current_date.slice(0, 10);

  // Calendar events for the My Club grid: each user fixture becomes a marker on
  // its day, green for upcoming and muted for completed (with the score shown).
  const userCalendarEvents: CalendarEvent[] = useMemo(
    () =>
      userFixtures.map((fixture) => {
        const opponentId =
          fixture.home_team_id === userTeamId ? fixture.away_team_id : fixture.home_team_id;
        const opponent = getTeamName(gameState.teams, opponentId);
        const completed = fixture.status === "Completed";
        const tag = getCompetitionTag(t, fixture.competition);
        return {
          date: fixture.date,
          tone: completed ? "bg-app-text-muted" : tag.dotTone,
          competitionCode: tag.code,
          competitionTone: tag.tone,
          label:
            completed && fixture.result
              ? `${fixture.result.home_goals}-${fixture.result.away_goals}`
              : `vs ${opponent.slice(0, 3).toUpperCase()}`,
          title: `${tag.label}: ${getTeamName(gameState.teams, fixture.home_team_id)} vs ${getTeamName(gameState.teams, fixture.away_team_id)}`,
        };
      }),
    [userFixtures, userTeamId, gameState.teams, t],
  );

  // Distinct competition tags present in the user's fixtures, for the calendar
  // legend so colour codes are explained (League / Cup / Friendly / ...).
  const calendarLegend = useMemo(() => {
    const seen = new Set<string>();
    const tags: ReturnType<typeof getCompetitionTag>[] = [];
    for (const fixture of userFixtures) {
      const tag = getCompetitionTag(t, fixture.competition);
      if (seen.has(tag.code)) continue;
      seen.add(tag.code);
      tags.push(tag);
    }
    return tags;
  }, [userFixtures, t]);

  const renderFixtureRow = (fixture: FixtureData) => {
    const homeTeam = teamById.get(fixture.home_team_id);
    const awayTeam = teamById.get(fixture.away_team_id);
    const homeName = homeTeam?.name ?? getTeamName(gameState.teams, fixture.home_team_id);
    const awayName = awayTeam?.name ?? getTeamName(gameState.teams, fixture.away_team_id);
    const isUserMatch = fixtureIncludesTeam(fixture, userTeamId);
    const completed = fixture.status === "Completed";
    const contextItems = [
      ...(completed
        ? [
          {
            label: t("match.viewDetails", { defaultValue: "View match details" }),
            onClick: () => setSelectedMatchFixtureId(fixture.id),
          },
        ]
        : []),
      buildTeamMenuItem(
        `${t("common.viewTeam")}: ${homeName}`,
        fixture.home_team_id,
      ),
      buildTeamMenuItem(
        `${t("common.viewTeam")}: ${awayName}`,
        fixture.away_team_id,
      ),
    ];

    return (
      <ContextMenu items={contextItems} key={fixture.id}>
        <div
          className={cx(
            "flex items-center rounded-lg border border-app-border/50 bg-app-bg px-4 py-3 transition-colors hover:bg-white/5",
            isUserMatch && "border-app-green/40 bg-app-green/10",
          )}
          data-testid={`schedule-fixture-${fixture.id}`}
        >
          <span
            onClick={() => onSelectTeam(fixture.home_team_id)}
            className={cx(
              "flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2 truncate text-right text-sm font-semibold hover:underline",
              fixture.home_team_id === userTeamId ? "text-app-green" : "text-app-text",
            )}
          >
            <span className="truncate">{homeName}</span>
            {homeTeam ? <TeamLogo team={homeTeam} size="sm" /> : null}
          </span>
          <div className="mx-3 flex w-24 shrink-0 justify-center text-center">
            {completed && fixture.result ? (
              <button
                type="button"
                onClick={() => setSelectedMatchFixtureId(fixture.id)}
                className="rounded-lg border border-app-border bg-app-bg px-3 py-1 font-heading text-base font-bold text-app-text transition hover:border-app-green hover:text-app-green"
              >
                {fixture.result.home_goals} - {fixture.result.away_goals}
              </button>
            ) : (
              <span className="rounded border border-app-border bg-app-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                vs
              </span>
            )}
          </div>
          <span
            onClick={() => onSelectTeam(fixture.away_team_id)}
            className={cx(
              "flex min-w-0 flex-1 cursor-pointer items-center gap-2 truncate text-left text-sm font-semibold hover:underline",
              fixture.away_team_id === userTeamId ? "text-app-green" : "text-app-text",
            )}
          >
            {awayTeam ? <TeamLogo team={awayTeam} size="sm" /> : null}
            <span className="truncate">{awayName}</span>
          </span>
        </div>
      </ContextMenu>
    );
  };

  const renderResultSummary = (fixture: FixtureData): string => {
    const homeName = getTeamName(gameState.teams, fixture.home_team_id);
    const awayName = getTeamName(gameState.teams, fixture.away_team_id);
    if (fixture.result) {
      return `${homeName} ${fixture.result.home_goals}-${fixture.result.away_goals} ${awayName}`;
    }
    return `${homeName} vs ${awayName}`;
  };

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">SCHEDULE</h1>
          <p className="text-sm text-app-text-muted">
            {competitionLabel} &bull; {t("schedule.season", { number: selectedCompetition.season })} &bull; {view === "fixtures" ? t("schedule.fixtures") : t("schedule.standings")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {competitionOptions.length > 1 ? (
            <ScheduleCompetitionSelector
              regions={competitionRegions}
              selectedCompetition={selectedCompetition}
              onSelectCompetition={setSelectedCompetitionId}
            />
          ) : null}
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            <CircleDot className="h-4 w-4 text-app-green" />
            {t(`season.phases.${seasonContext.phase}`)}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            <CalendarIcon className="h-4 w-4 text-app-green" />
            {currentDate}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            <Trophy className="h-4 w-4" />
            {"team_ids" in selectedCompetition && Array.isArray(selectedCompetition.team_ids) ? selectedCompetition.team_ids.length : selectedCompetition.standings.length} Teams
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2">
        {([
          { id: "fixtures", label: t("schedule.fixtures"), icon: <CalendarIcon className="h-4 w-4" /> },
          ...(canShowStandings ? [{ id: "standings", label: t("schedule.standings"), icon: <TableProperties className="h-4 w-4" /> } as const] : []),
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cx(
              "-mb-[2px] flex items-center gap-1.5 pb-3 text-sm whitespace-nowrap transition-colors",
              view === tab.id ? "border-b-2 border-app-green font-semibold text-app-green" : "font-medium text-app-text-muted hover:text-white",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 h-full overflow-hidden pr-1">
          {view === "fixtures" ? (
            <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-app-border/50 bg-app-bg px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                    {t("schedule.fixtures")}
                  </h4>
                  <p className="mt-1 text-sm font-bold text-app-text">
                    {fixtureScope === "team" ? userTeamName : activeFixtureGroupLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fixtureScope === "team" ? (
                    <div className="mr-1 flex items-center rounded-lg border border-app-border bg-app-card p-0.5">
                      <button
                        type="button"
                        onClick={() => setFixtureLayout("list")}
                        className={cx(
                          "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                          fixtureLayout === "list" ? "bg-app-green text-app-bg" : "text-app-text-muted hover:text-app-text",
                        )}
                        aria-label={t("schedule.listView", { defaultValue: "List" })}
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFixtureLayout("calendar")}
                        className={cx(
                          "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                          fixtureLayout === "calendar" ? "bg-app-green text-app-bg" : "text-app-text-muted hover:text-app-text",
                        )}
                        aria-label={t("schedule.calendarView", { defaultValue: "Calendar" })}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {userTeamId ? (
                    <div className="mr-1 flex items-center rounded-lg border border-app-border bg-app-card p-0.5">
                      <button
                        type="button"
                        onClick={() => setFixtureScope("team")}
                        className={cx(
                          "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                          fixtureScope === "team" ? "bg-app-green text-app-bg" : "text-app-text-muted hover:text-app-text",
                        )}
                      >
                        {t("schedule.myClub", { defaultValue: "My Club" })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFixtureScope("all")}
                        className={cx(
                          "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                          fixtureScope === "all" ? "bg-app-green text-app-bg" : "text-app-text-muted hover:text-app-text",
                        )}
                      >
                        {t("schedule.allMatches", { defaultValue: "All" })}
                      </button>
                    </div>
                  ) : null}
                  {fixtureScope === "all" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveFixtureGroupIndex((current) => Math.max(current - 1, 0))}
                        disabled={activeFixtureGroupSafeIndex === 0}
                        className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Previous fixture date"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-20 text-center text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                        {sortedMatchdays.length > 0 ? `${activeFixtureGroupSafeIndex + 1} / ${sortedMatchdays.length}` : "0 / 0"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveFixtureGroupIndex((current) => Math.min(current + 1, Math.max(sortedMatchdays.length - 1, 0)))}
                        disabled={activeFixtureGroupSafeIndex >= sortedMatchdays.length - 1}
                        className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Next fixture date"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                  <span className="rounded bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
                    {(fixtureScope === "team" ? userFixtures.length : activeFixtureGroupFixtures.length)} Matches
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                {fixtureScope === "team" ? (
                  userFixtures.length > 0 ? (
                    fixtureLayout === "calendar" ? (
                      <div className="flex flex-col gap-3">
                        <MonthCalendar
                          value={null}
                          events={userCalendarEvents}
                          today={todayIso}
                          initialMonth={nextUserFixture?.date ?? todayIso}
                          onSelect={(date) => {
                            const fixture = userFixtures.find((f) => f.date.slice(0, 10) === date);
                            if (!fixture) return;
                            if (fixture.status === "Completed" && fixture.result) {
                              setSelectedMatchFixtureId(fixture.id);
                            } else {
                              setInfoFixture(fixture);
                            }
                          }}
                        />
                        {calendarLegend.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-app-border/50 pt-3">
                            {calendarLegend.map((tag) => (
                              <span key={tag.code} className="flex items-center gap-1.5">
                                <span
                                  className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${tag.tone}`}
                                >
                                  {tag.code}
                                </span>
                                <span className="text-[11px] text-app-text-muted">{tag.label}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {userFixtures.map((fixture) => (
                          <div key={fixture.id} className="flex flex-col gap-1">
                            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                              {getFixtureGroupLabel(fixture)}
                            </span>
                            {renderFixtureRow(fixture)}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="p-4 text-center text-xs text-app-text-muted">
                      {t("schedule.noTeamFixtures", { defaultValue: "No fixtures for your club in this competition." })}
                    </p>
                  )
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeFixtureGroupFixtures.map(renderFixtureRow)}
                  </div>
                )}
              </div>
            </TemplateCard>
          ) : isPreseason ? (
            <TemplateCard className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <Trophy className="h-9 w-9 text-app-text-muted" />
              <p className="text-sm font-bold text-app-text">{t("season.standingsLocked")}</p>
              <p className="text-xs text-app-text-muted">
                {seasonContext.season_start
                  ? t("season.startsOn", { date: formatMatchDate(seasonContext.season_start) })
                  : t("season.noOpener")}
              </p>
            </TemplateCard>
          ) : (
            <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-app-border/50 bg-app-bg px-4 py-3">
                <Trophy className="h-4 w-4 text-app-green" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                  {selectedCompetition.name} — {t("schedule.season", { number: selectedCompetition.season })}
                </h3>
              </div>
              <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
                <table className="w-full min-w-[720px] text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-app-bg">
                    <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                      <th className="px-4 py-3 w-8">#</th>
                      <th className="px-4 py-3">{t("common.team")}</th>
                      <th className="px-4 py-3 text-center">{t("common.played")}</th>
                      <th className="px-4 py-3 text-center">{t("common.won")}</th>
                      <th className="px-4 py-3 text-center">{t("common.drawn")}</th>
                      <th className="px-4 py-3 text-center">{t("common.lost")}</th>
                      <th className="px-4 py-3 text-center">{t("common.gf")}</th>
                      <th className="px-4 py-3 text-center">{t("common.ga")}</th>
                      <th className="px-4 py-3 text-center">{t("common.gd")}</th>
                      <th className="px-4 py-3 text-center">{t("common.pts")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/30 text-app-text">
                    {standings.map((entry, idx) => {
                      const isUser = entry.team_id === userTeamId;
                      const standingTeam = teamById.get(entry.team_id);
                      const gd = entry.goals_for - entry.goals_against;
                      const contextItems = [
                        buildTeamMenuItem(t("common.viewTeam"), entry.team_id),
                      ];

                      return (
                        <ContextMenu items={contextItems} key={entry.team_id}>
                          <tr
                            className={cx("transition-colors hover:bg-white/5", isUser && "bg-app-green/10")}
                            data-testid={`schedule-standings-row-${entry.team_id}`}
                          >
                            <td className="px-4 py-3 font-heading text-sm font-bold text-app-text-muted">{idx + 1}</td>
                            <td
                              onClick={() => onSelectTeam(entry.team_id)}
                              className={cx("cursor-pointer px-4 py-3 text-sm font-semibold hover:underline", isUser ? "text-app-green" : "text-app-text")}
                            >
                              <span className="flex items-center gap-2">
                                {standingTeam ? <TeamLogo team={standingTeam} size="sm" /> : null}
                                <span>{standingTeam?.name ?? getTeamName(gameState.teams, entry.team_id)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.played}</td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.won}</td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.drawn}</td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.lost}</td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.goals_for}</td>
                            <td className="px-4 py-3 text-center text-sm tabular-nums text-app-text-muted">{entry.goals_against}</td>
                            <td className={cx("px-4 py-3 text-center text-sm font-semibold tabular-nums", gd > 0 ? "text-app-green" : gd < 0 ? "text-red-400" : "text-app-text-muted")}>
                              {gd > 0 ? `+${gd}` : gd}
                            </td>
                            <td className="px-4 py-3 text-center font-heading text-sm font-bold tabular-nums text-app-text">{entry.points}</td>
                          </tr>
                        </ContextMenu>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TemplateCard>
          )}
        </section>

        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[360px]">
          <div>
            <SectionTitle title="NEXT FIXTURE" action={nextUserFixture ? formatMatchDate(nextUserFixture.date) : "None"} />
            <TemplateCard className="p-4">
              {nextUserFixture ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs text-app-text-muted">
                    <Clock className="h-4 w-4 text-app-green" />
                    {getFixtureGroupLabel(nextUserFixture)}
                  </div>
                  <div className="rounded-lg border border-app-border bg-app-bg p-3 text-center">
                    <FixtureTeamLine team={teamById.get(nextUserFixture.home_team_id)} name={getTeamName(gameState.teams, nextUserFixture.home_team_id)} />
                    <p className="my-1 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">vs</p>
                    <FixtureTeamLine team={teamById.get(nextUserFixture.away_team_id)} name={getTeamName(gameState.teams, nextUserFixture.away_team_id)} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-app-text-muted">No upcoming fixture found.</p>
              )}
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="RECENT RESULTS" action={`${recentUserFixtures.length} Shown`} />
            <TemplateCard className="overflow-hidden">
              {recentUserFixtures.length > 0 ? (
                <div className="divide-y divide-app-border/30">
                  {recentUserFixtures.map((fixture) => (
                    <button
                      key={fixture.id}
                      type="button"
                      onClick={() => setSelectedMatchFixtureId(fixture.id)}
                      className="block w-full px-4 py-3 text-left text-xs transition-colors hover:bg-white/5"
                    >
                      <p className="font-semibold text-app-text">{renderResultSummary(fixture)}</p>
                      <p className="mt-1 text-[10px] text-app-text-muted">{getFixtureGroupLabel(fixture)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-xs text-app-text-muted">No completed fixtures yet.</p>
              )}
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="MATCH STATUS" action="Legend" />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="Completed" value={String(completedFixtureCount)} tone="text-app-green" />
              <StatRow label="Upcoming" value={String(upcomingFixtureCount)} tone="text-blue-300" />
              <div className="border-t border-app-border/50 pt-3 text-xs leading-relaxed text-app-text-muted">
                Right-click a fixture or standings row for quick team actions.
              </div>
            </TemplateCard>
          </div>
        </aside>
      </div>

      <MatchDetailModal
        fixtureId={selectedMatchFixtureId}
        onClose={() => setSelectedMatchFixtureId(null)}
      />

      <FixtureInfoModal
        fixture={infoFixture}
        gameState={gameState}
        onClose={() => setInfoFixture(null)}
        onViewTeam={onSelectTeam}
      />
    </div>
  );
}
