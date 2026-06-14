import { useState, useEffect, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GameStateData, FixtureData, getCompetitionDisplayName } from "../../store/gameStore";
import type {
  SeasonHonours,
  GameRecords,
  RetiredPlayer,
  CompetitionLeaderboards,
  LeaderboardEntry,
  GlobalPlayerLeaderboardQuery,
  GlobalPlayerLeaderboards,
  RatingLeaderboardEntry,
} from "../../store/types";
import { getCompetitionForTeam } from "../../store/types";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import TeamLogo from "../common/TeamLogo";
import {
  Trophy,
  Calendar,
  Globe2,
  TableProperties,
  Award,
  Star,
  Shield,
  Users,
  Zap,
  Crown,
  History,
  GitBranch,
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  getTeamName,
  formatMatchDate,
} from "../../lib/helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { getCompetitionLogoUrl } from "../../lib/divisionLogos";
import { formatExactMoney } from "../../lib/valueFormatting";
import { useTranslation } from "react-i18next";
import MatchDetailModal from "../match/MatchDetailModal";
import { CountryFlag } from "../ui/CountryFlag";
import {
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)} {...props}>{children}</div>;
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
      <span className={cx("font-bold tabular-nums", tone)}>{value}</span>
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
const WORLDCUP_LOGO_SRC = "/images/wc26/WC2026.svg";

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

function knockoutResolutionText(fixture: FixtureData, teamById: Map<string, GameStateData["teams"][number]>, teams: GameStateData["teams"], t: (key: string, options?: Record<string, unknown>) => string): string | null {
  const result = fixture.result;
  if (!result?.winner_team_id || result.resolution !== "AfterPenalties") {
    return null;
  }

  const winner = teamById.get(result.winner_team_id)?.name ?? getTeamName(teams, result.winner_team_id);
  const homePenalties = result.home_penalties;
  const awayPenalties = result.away_penalties;
  const penalties = typeof homePenalties === "number" && typeof awayPenalties === "number"
    ? `${homePenalties}-${awayPenalties}`
    : "";

  return t("tournaments.wonOnPenalties", {
    defaultValue: penalties ? `${winner} won ${penalties} on penalties` : `${winner} won on penalties`,
    team: winner,
    score: penalties,
  });
}

interface AwardEntry {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  value: number;
}
interface SeasonAwards {
  golden_boot: AwardEntry[];
  assist_king: AwardEntry[];
  player_of_year: AwardEntry[];
  clean_sheet_king: AwardEntry[];
  most_appearances: AwardEntry[];
  young_player: AwardEntry[];
}

type TournamentView = "overview" | "global" | "fixtures" | "standings" | "bracket" | "awards" | "leaderboards" | "history" | "records" | "halloffame";
type CompetitionOption = NonNullable<GameStateData["competitions"]>[number] | NonNullable<GameStateData["league"]>;
type StandingEntry = NonNullable<GameStateData["league"]>["standings"][number];
type TopScorerEntry = { player: GameStateData["players"][number] | undefined; goals: number };

type WorldCupGroup = {
  label: string;
  standings: StandingEntry[];
  teamIds: Set<string>;
};

const WORLD_CUP_GROUP_SIZE = 4;
const WORLD_CUP_GROUP_COUNT = 12;

function goalDifference(entry: StandingEntry): number {
  return entry.goals_for - entry.goals_against;
}

function sortStandingEntries(entries: StandingEntry[]): StandingEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.points - a.points ||
      goalDifference(b) - goalDifference(a) ||
      b.goals_for - a.goals_for,
  );
}

function worldCupGroupLabel(index: number): string {
  return `Group ${String.fromCharCode(65 + index)}`;
}

function buildWorldCupGroups(standings: StandingEntry[]): WorldCupGroup[] {
  return Array.from({ length: WORLD_CUP_GROUP_COUNT }, (_, index) => {
    const groupStandings = sortStandingEntries(
      standings.slice(index * WORLD_CUP_GROUP_SIZE, (index + 1) * WORLD_CUP_GROUP_SIZE),
    );
    return {
      label: worldCupGroupLabel(index),
      standings: groupStandings,
      teamIds: new Set(groupStandings.map((entry) => entry.team_id)),
    };
  }).filter((group) => group.standings.length > 0);
}

function bestWorldCupThirds(groups: WorldCupGroup[]): StandingEntry[] {
  return sortStandingEntries(
    groups.map((group) => group.standings[2]).filter((entry): entry is StandingEntry => !!entry),
  );
}

type CompetitionRegion = {
  key: string;
  label: string;
  competitions: CompetitionOption[];
  leagueCount: number;
  cupCount: number;
  continentalCount: number;
};

interface TournamentsTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
  onSelectPlayer?: (id: string) => void;
}

export default function TournamentsTab({
  gameState,
  onSelectTeam,
  onSelectPlayer,
}: TournamentsTabProps) {
  const { t } = useTranslation();
  const teamById = useMemo(
    () => new Map(gameState.teams.map((team) => [team.id, team])),
    [gameState.teams],
  );
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
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const [view, setView] = useState<TournamentView>("overview");
  const [selectedMatchFixtureId, setSelectedMatchFixtureId] = useState<string | null>(null);
  const [awardsByCompetition, setAwardsByCompetition] = useState<Record<string, SeasonAwards>>({});
  const [awardsLoadState, setAwardsLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [awardsRetryCount, setAwardsRetryCount] = useState(0);
  const awards = selectedCompetition
    ? awardsByCompetition[selectedCompetition.id] ?? null
    : null;
  const [leaderboardsByCompetition, setLeaderboardsByCompetition] = useState<
    Record<string, CompetitionLeaderboards>
  >({});
  const [leaderboardsLoadState, setLeaderboardsLoadState] = useState<"idle" | "loading" | "error">("idle");
  const selectedLeaderboards = selectedCompetition
    ? leaderboardsByCompetition[selectedCompetition.id] ?? null
    : null;
  const defaultGlobalSeason = selectedCompetition?.season ?? gameState.league?.season ?? null;
  const [globalFilters, setGlobalFilters] = useState<GlobalPlayerLeaderboardQuery>({
    season: defaultGlobalSeason,
    country: null,
    competition_type: null,
    position: null,
    limit: 50,
  });
  const [globalLeaderboards, setGlobalLeaderboards] = useState<GlobalPlayerLeaderboards | null>(null);
  const [globalLeaderboardsLoadState, setGlobalLeaderboardsLoadState] = useState<"idle" | "loading" | "error">("idle");

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
    if (view !== "awards" || !selectedCompetition || awards) {
      return;
    }

    const competitionId = selectedCompetition.id;
    let cancelled = false;
    setAwardsLoadState("loading");

    invoke<SeasonAwards>("get_competition_awards", { competitionId })
      .then((nextAwards) => {
        if (cancelled) {
          return;
        }

        setAwardsByCompetition((current) => ({
          ...current,
          [competitionId]: nextAwards,
        }));
        setAwardsLoadState("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setAwardsLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [view, awards, selectedCompetition, awardsRetryCount]);

  useEffect(() => {
    if (view !== "leaderboards" || !selectedCompetition || selectedLeaderboards) {
      return;
    }

    const competitionId = selectedCompetition.id;
    let cancelled = false;
    setLeaderboardsLoadState("loading");

    invoke<CompetitionLeaderboards>("get_competition_leaderboards", { competitionId })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setLeaderboardsByCompetition((current) => ({
          ...current,
          [competitionId]: next,
        }));
        setLeaderboardsLoadState("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setLeaderboardsLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [view, selectedCompetition, selectedLeaderboards]);

  useEffect(() => {
    if (view !== "global") {
      return;
    }

    let cancelled = false;
    setGlobalLeaderboardsLoadState("loading");

    invoke<GlobalPlayerLeaderboards>("get_global_player_leaderboards", { query: globalFilters })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setGlobalLeaderboards(next);
        setGlobalLeaderboardsLoadState("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setGlobalLeaderboardsLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [view, globalFilters]);

  if (!selectedCompetition) {
    return (
      <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
        <TemplateCard className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-bg text-app-text-muted">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">TOURNAMENTS</h1>
          <p className="text-sm text-app-text-muted">{t("tournaments.noActive")}</p>
        </TemplateCard>
      </div>
    );
  }

  const hasStandings = selectedCompetition.standings.length > 0;
  const competitionLabel = getCompetitionDisplayName(selectedCompetition);
  const competitionTeamCount =
    "team_ids" in selectedCompetition && Array.isArray(selectedCompetition.team_ids)
      ? selectedCompetition.team_ids.length
      : selectedCompetition.standings.length;
  const competitionRegions = useMemo(() => buildCompetitionRegions(competitionOptions), [competitionOptions]);
  const seasonOptions = Array.from(
    new Set(
      [
        ...competitionOptions.map((competition) => competition.season),
        gameState.league?.season,
      ].filter((season): season is number => typeof season === "number"),
    ),
  ).sort((a, b) => b - a);
  const countryOptions = Array.from(
    new Set(
      [
        ...gameState.teams.map((team) => team.country).filter(Boolean),
        ...competitionOptions
          .map((competition) => ("country" in competition ? competition.country : null))
          .filter((country): country is string => !!country),
      ],
    ),
  ).sort((a, b) => a.localeCompare(b));
  const standings = sortStandingEntries(selectedCompetition.standings);

  const stageDisplayLabel = (stage: string): string => {
    const fallbacks: Record<string, string> = {
      playoff: "Playoff",
      r32: "Round of 32",
      r16: "Round of 16",
      qf: "Quarter-finals",
      sf: "Semi-finals",
      final: "Final",
    };
    const fb = fallbacks[stage] ?? (stage.startsWith("round_") ? `Round of ${stage.slice(6)}` : stage);
    return t(`tournaments.stages.${stage}`, { defaultValue: fb });
  };

  const getFixtureRoundLabel = (fixture: FixtureData): string => {
    // Knockout fixtures carry a stage; prefer the human round name + leg.
    if (fixture.stage) {
      const base = stageDisplayLabel(fixture.stage);
      if (fixture.leg) {
        return `${base} · ${t("tournaments.bracketLeg", { defaultValue: "Leg", count: fixture.leg })} ${fixture.leg}`;
      }
      return base;
    }
    if ("kind" in selectedCompetition && selectedCompetition.kind === "DomesticCup") {
      return `${selectedCompetition.name} round ${fixture.matchday}`;
    }

    return t("schedule.matchday", { number: fixture.matchday });
  };

  const competitionKind =
    "kind" in selectedCompetition ? selectedCompetition.kind : "DomesticLeague";
  const isCupCompetition = competitionKind === "DomesticCup";
  const isContinentalCompetition = competitionKind === "ContinentalLeague";
  const isWorldCupCompetition = competitionKind === "WorldCup";
  const worldCupGroups = isWorldCupCompetition
    ? buildWorldCupGroups(selectedCompetition.standings)
    : [];
  const worldCupBestThirds = isWorldCupCompetition ? bestWorldCupThirds(worldCupGroups) : [];
  // A bracket view is meaningful when the competition has knockout-stage
  // fixtures (cup rounds, World Cup, or the Champions League knockout phase).
  const hasKnockoutStages = selectedCompetition.fixtures.some(
    (fixture) => fixture.stage != null,
  );
  const showBracketTab = isCupCompetition || isWorldCupCompetition || (isContinentalCompetition && hasKnockoutStages);

  // Show every real fixture of the SELECTED competition (league rounds, cup
  // ties, or continental matches) — not just domestic-league games. Only filter
  // out friendlies/preseason, which never belong to a tracked competition.
  const competitiveFixtures = selectedCompetition.fixtures.filter(
    (fixture) =>
      fixture.competition !== "Friendly" &&
      fixture.competition !== "PreseasonTournament",
  );
  const matchdays = new Map<number, FixtureData[]>();
  competitiveFixtures.forEach((fixture) => {
    const list = matchdays.get(fixture.matchday) || [];
    list.push(fixture);
    matchdays.set(fixture.matchday, list);
  });
  const sortedMatchdays = Array.from(matchdays.entries()).sort((a, b) => a[0] - b[0]);
  const completedMatchdays = sortedMatchdays.filter(([, fixtures]) =>
    fixtures.every((fixture) => fixture.status === "Completed"),
  ).length;
  const totalMatchdays = sortedMatchdays.length;
  const completedMatches = competitiveFixtures.filter((fixture) => fixture.status === "Completed").length;
  const totalGoals = competitiveFixtures
    .filter((fixture) => fixture.result)
    .reduce((sum, fixture) => sum + (fixture.result!.home_goals + fixture.result!.away_goals), 0);

  const topScorers = (() => {
    const goals: Record<string, number> = {};
    competitiveFixtures.forEach((fixture) => {
      if (fixture.result) {
        fixture.result.home_scorers.forEach((scorer) => {
          goals[scorer.player_id] = (goals[scorer.player_id] || 0) + 1;
        });
        fixture.result.away_scorers.forEach((scorer) => {
          goals[scorer.player_id] = (goals[scorer.player_id] || 0) + 1;
        });
      }
    });
    return Object.entries(goals)
      .map(([playerId, goals]) => ({
        player: gameState.players.find((player) => player.id === playerId),
        goals,
      }))
      .filter((entry) => entry.player)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);
  })();

  // Most recent completed round (highest matchday that has any played fixture),
  // with its results — replaces the old "latest rounds" count list.
  const latestResultsRound = (() => {
    const completedRounds = sortedMatchdays.filter(([, fixtures]) =>
      fixtures.some((fixture) => fixture.status === "Completed" && fixture.result),
    );
    return completedRounds.length > 0 ? completedRounds[completedRounds.length - 1] : null;
  })();
  const latestResults = (latestResultsRound?.[1] ?? []).filter(
    (fixture) => fixture.status === "Completed" && fixture.result,
  );

  const buildFixtureMenuItems = (fixture: FixtureData) => [
    ...(fixture.status === "Completed"
      ? [
        {
          label: t("match.viewDetails", { defaultValue: "View match details" }),
          onClick: () => setSelectedMatchFixtureId(fixture.id),
        },
      ]
      : []),
    {
      ...buildViewTeamMenuItem(t, () => onSelectTeam(fixture.home_team_id)),
      label: `${t("common.viewTeam")}: ${getTeamName(gameState.teams, fixture.home_team_id)}`,
    },
    {
      ...buildViewTeamMenuItem(t, () => onSelectTeam(fixture.away_team_id)),
      label: `${t("common.viewTeam")}: ${getTeamName(gameState.teams, fixture.away_team_id)}`,
    },
  ];

  const buildStandingMenuItems = (teamId: string) => [
    buildViewTeamMenuItem(t, () => onSelectTeam(teamId)),
  ];

  const buildPlayerMenuItems = (playerId: string, teamId?: string | null) => {
    const items = [];

    if (typeof onSelectPlayer === "function") {
      items.push(buildViewProfileMenuItem(t, () => onSelectPlayer(playerId)));
    }

    if (teamId) {
      items.push(buildViewTeamMenuItem(t, () => onSelectTeam(teamId)));
    }

    return items;
  };

  const leaderStanding = standings[0] ?? null;
  const userStandingIndex = standings.findIndex((entry) => entry.team_id === userTeamId);
  const userStanding = userStandingIndex >= 0 ? standings[userStandingIndex] : null;
  const activeViewTitle = view === "overview"
    ? t("tournaments.overview")
    : view === "global"
      ? t("tournaments.globalLeaderboardsTab", { defaultValue: "Global Leaderboard" })
      : view === "standings"
        ? t("schedule.standings")
        : view === "bracket"
          ? t("tournaments.bracketTab", { defaultValue: "Bracket" })
          : view === "awards"
            ? t("tournaments.awardsTab")
            : view === "leaderboards"
              ? t("tournaments.leaderboardsTab", { defaultValue: "Leaderboards" })
              : view === "history"
                ? t("tournaments.historyTab", { defaultValue: "History" })
                : view === "records"
                  ? t("tournaments.recordsTab", { defaultValue: "Records" })
                  : view === "halloffame"
                    ? t("tournaments.hallOfFameTab", { defaultValue: "Hall of Fame" })
                    : t("schedule.fixtures");

  const renderStandingsState = (compact = false) => {
    if (!hasStandings) {
      return (
        <EmptyPanel
          icon={<Trophy className="h-8 w-8" />}
          title="Knockout competition"
          description="Use the fixtures tab to follow each cup round."
          compact={compact}
        />
      );
    }

    if (isPreseason) {
      return (
        <EmptyPanel
          icon={<Trophy className="h-8 w-8" />}
          title={t("season.standingsLocked")}
          description={t("season.tournamentsPreseasonHint")}
          compact={compact}
        />
      );
    }

    return null;
  };

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      {isPreseason ? (
        <TemplateCard className="border-app-green/30 bg-app-green/10 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
                {t(`season.phases.${seasonContext.phase}`)}
              </span>
              <span className="text-sm font-bold text-app-text">
                {seasonContext.season_start
                  ? t("season.startsOn", { date: formatMatchDate(seasonContext.season_start) })
                  : t("season.noOpener")}
              </span>
            </div>
            <p className="text-xs text-app-text-muted">{t("season.tournamentsPreseasonHint")}</p>
          </div>
        </TemplateCard>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {!isWorldCupCompetition ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-card p-2 shadow-inner shadow-black/20">
              <CompetitionLogo competition={selectedCompetition} className="h-8 w-8" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-app-text">TOURNAMENTS</h1>
            <p className="flex min-w-0 items-center gap-2 text-sm text-app-text-muted">
              <span className="truncate">{competitionLabel}</span>
              <span>&bull;</span>
              <span>{t("schedule.season", { number: selectedCompetition.season })}</span>
              <span>&bull;</span>
              <span>{t("tournaments.nTeams", { count: competitionTeamCount })}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderChip icon={<Trophy className="h-4 w-4" />} label={t("tournaments.progress")} value={`${completedMatchdays}/${totalMatchdays}`} />
          <HeaderChip icon={<Calendar className="h-4 w-4" />} label={t("tournaments.matches")} value={String(completedMatches)} />
          <HeaderChip icon={<Zap className="h-4 w-4" />} label={t("tournaments.goals")} value={String(totalGoals)} />
        </div>
      </div>

      {competitionOptions.length > 1 ? (
        <CompetitionWorldSelector
          regions={competitionRegions}
          selectedCompetitionId={selectedCompetition.id}
          onSelectCompetition={setSelectedCompetitionId}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2">
        {(["overview", "global", "standings", "bracket", "fixtures", "awards", "leaderboards", "history", "records", "halloffame"] as const)
          .filter((nextView) => nextView !== "bracket" || showBracketTab)
          .map((nextView) => (
          <button
            key={nextView}
            type="button"
            onClick={() => setView(nextView)}
            className={cx(
              "flex items-center gap-1.5 border-b-2 px-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors",
              view === nextView
                ? "border-app-green text-app-green"
                : "border-transparent text-app-text-muted hover:text-app-text",
            )}
          >
            {nextView === "overview" ? <Trophy className="h-4 w-4" /> : nextView === "global" ? <Users className="h-4 w-4" /> : nextView === "standings" ? <TableProperties className="h-4 w-4" /> : nextView === "bracket" ? <GitBranch className="h-4 w-4" /> : nextView === "awards" ? <Award className="h-4 w-4" /> : nextView === "leaderboards" ? <ListOrdered className="h-4 w-4" /> : nextView === "history" ? <History className="h-4 w-4" /> : nextView === "records" ? <Star className="h-4 w-4" /> : nextView === "halloffame" ? <History className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            {nextView === "overview" ? t("tournaments.overview") : nextView === "global" ? t("tournaments.globalLeaderboardsTab", { defaultValue: "Global" }) : nextView === "standings" ? t("schedule.standings") : nextView === "bracket" ? t("tournaments.bracketTab", { defaultValue: "Bracket" }) : nextView === "awards" ? t("tournaments.awardsTab") : nextView === "leaderboards" ? t("tournaments.leaderboardsTab", { defaultValue: "Leaderboards" }) : nextView === "history" ? t("tournaments.historyTab", { defaultValue: "History" }) : nextView === "records" ? t("tournaments.recordsTab", { defaultValue: "Records" }) : nextView === "halloffame" ? t("tournaments.hallOfFameTab", { defaultValue: "Hall of Fame" }) : t("schedule.fixtures")}
          </button>
        ))}
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 h-full">
          <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app-bg">
            <div className="flex items-center justify-between gap-3 border-b border-app-border/50 bg-app-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-app-border bg-white p-1.5 shadow-sm">
                  {isWorldCupCompetition ? (
                    <img src={WORLDCUP_LOGO_SRC} alt="" aria-hidden="true" className="h-full w-full object-contain" />
                  ) : (
                    <CompetitionLogo competition={selectedCompetition} className="h-7 w-7" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-green">{activeViewTitle}</h2>
                  <p className="mt-1 truncate text-xs text-app-text-muted">{competitionLabel}</p>
                </div>
              </div>
              <span className="shrink-0 rounded bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
                {t("schedule.season", { number: selectedCompetition.season })}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
              {view === "overview" ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                  {isWorldCupCompetition ? (
                    <WorldCupOverviewCard
                      groups={worldCupGroups}
                      teamById={teamById}
                      teams={gameState.teams}
                      userTeamId={userTeamId}
                      onSelectTeam={onSelectTeam}
                      buildStandingMenuItems={buildStandingMenuItems}
                    />
                  ) : (
                    <TemplateCard className="overflow-hidden xl:col-span-3">
                      <PanelHeader title={t("tournaments.leagueTable")} action={hasStandings ? `${standings.length} clubs` : "Cup"} />
                      {renderStandingsState(true) ?? (
                        <StandingsTable
                          standings={standings.slice(0, 8)}
                          teamById={teamById}
                          teams={gameState.teams}
                          userTeamId={userTeamId}
                          onSelectTeam={onSelectTeam}
                          buildStandingMenuItems={buildStandingMenuItems}
                          compact
                          testIdPrefix="tournaments-overview-standing"
                        />
                      )}
                    </TemplateCard>
                  )}
                  <TemplateCard className="overflow-hidden xl:col-span-2">
                    <PanelHeader
                      title={t("tournaments.latestResults", { defaultValue: "Latest results" })}
                      action={latestResultsRound ? getFixtureRoundLabel(latestResultsRound[1][0]) : undefined}
                    />
                    {latestResults.length > 0 ? (
                      <div className="divide-y divide-app-border/30">
                        {latestResults.map((fixture) => {
                          const resolutionText = knockoutResolutionText(fixture, teamById, gameState.teams, t);
                          return (
                            <ContextMenu items={buildFixtureMenuItems(fixture)} key={fixture.id}>
                              <div
                                className="px-4 py-2.5 text-xs transition-colors hover:bg-white/5"
                                data-testid={`tournaments-result-${fixture.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectTeam(fixture.home_team_id)}
                                    className={cx(
                                      "min-w-0 flex-1 truncate text-right font-semibold hover:text-app-green",
                                      fixture.home_team_id === userTeamId ? "text-app-green" : "text-app-text",
                                    )}
                                  >
                                    {teamById.get(fixture.home_team_id)?.name ?? getTeamName(gameState.teams, fixture.home_team_id)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMatchFixtureId(fixture.id)}
                                    className="shrink-0 rounded bg-app-bg px-2 py-1 font-heading text-sm font-bold tabular-nums text-app-text transition hover:text-app-green"
                                  >
                                    {fixture.result!.home_goals} - {fixture.result!.away_goals}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSelectTeam(fixture.away_team_id)}
                                    className={cx(
                                      "min-w-0 flex-1 truncate text-left font-semibold hover:text-app-green",
                                      fixture.away_team_id === userTeamId ? "text-app-green" : "text-app-text",
                                    )}
                                  >
                                    {teamById.get(fixture.away_team_id)?.name ?? getTeamName(gameState.teams, fixture.away_team_id)}
                                  </button>
                                </div>
                                {resolutionText ? (
                                  <p className="mt-1 text-center text-[10px] font-semibold text-app-green">{resolutionText}</p>
                                ) : null}
                              </div>
                            </ContextMenu>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="p-4 text-center text-sm text-app-text-muted">
                        {t("tournaments.noResultsYet", { defaultValue: "No results played yet." })}
                      </p>
                    )}
                  </TemplateCard>
                </div>
              ) : null}

              {view === "standings" ? (
                isWorldCupCompetition ? (
                  <WorldCupGroupsPanel
                    groups={worldCupGroups}
                    bestThirds={worldCupBestThirds}
                    teamById={teamById}
                    teams={gameState.teams}
                    userTeamId={userTeamId}
                    onSelectTeam={onSelectTeam}
                    buildStandingMenuItems={buildStandingMenuItems}
                  />
                ) : renderStandingsState() ?? (
                  <TemplateCard className="overflow-hidden">
                    <StandingsTable
                      standings={standings}
                      teamById={teamById}
                      teams={gameState.teams}
                      userTeamId={userTeamId}
                      onSelectTeam={onSelectTeam}
                      buildStandingMenuItems={buildStandingMenuItems}
                      testIdPrefix="tournaments-standing"
                      showGoals
                    />
                  </TemplateCard>
                )
              ) : null}

              {view === "bracket" ? (
                <BracketPanel
                  fixtures={competitiveFixtures}
                  isContinental={isContinentalCompetition}
                  teamById={teamById}
                  teams={gameState.teams}
                  userTeamId={userTeamId}
                  onSelectTeam={onSelectTeam}
                />
              ) : null}

              {view === "fixtures" ? (
                isWorldCupCompetition ? (
                  <WorldCupFixturesPanel
                    groups={worldCupGroups}
                    fixtures={competitiveFixtures}
                    teamById={teamById}
                    teams={gameState.teams}
                    userTeamId={userTeamId}
                    getFixtureRoundLabel={getFixtureRoundLabel}
                    buildFixtureMenuItems={buildFixtureMenuItems}
                    onSelectTeam={onSelectTeam}
                    onSelectMatch={setSelectedMatchFixtureId}
                  />
                ) : (
                  <FixturesList
                    sortedMatchdays={sortedMatchdays}
                    teamById={teamById}
                    teams={gameState.teams}
                    userTeamId={userTeamId}
                    getFixtureRoundLabel={getFixtureRoundLabel}
                    buildFixtureMenuItems={buildFixtureMenuItems}
                    onSelectTeam={onSelectTeam}
                    onSelectMatch={setSelectedMatchFixtureId}
                  />
                )
              ) : null}

              {view === "awards" ? (
                <AwardsPanel
                  awards={awards}
                  awardsLoadState={awardsLoadState}
                  onRetry={() => setAwardsRetryCount((count) => count + 1)}
                  onSelectPlayer={onSelectPlayer}
                  onSelectTeam={onSelectTeam}
                />
              ) : null}

              {view === "global" ? (
                <GlobalLeaderboardsPanel
                  leaderboards={globalLeaderboards}
                  loadState={globalLeaderboardsLoadState}
                  filters={globalFilters}
                  seasonOptions={seasonOptions}
                  countryOptions={countryOptions}
                  onFiltersChange={(nextFilters) => {
                    setGlobalLeaderboards(null);
                    setGlobalFilters(nextFilters);
                  }}
                  onSelectPlayer={onSelectPlayer}
                  onSelectTeam={onSelectTeam}
                />
              ) : null}

              {view === "leaderboards" ? (
                <LeaderboardsPanel
                  leaderboards={selectedLeaderboards}
                  loadState={leaderboardsLoadState}
                  onSelectPlayer={onSelectPlayer}
                  onSelectTeam={onSelectTeam}
                  onViewGlobal={() => setView("global")}
                />
              ) : null}

              {view === "history" ? (
                <CompetitionHistoryPanel
                  competitionId={selectedCompetition.id}
                  honours={gameState.season_honours ?? []}
                  onSelectTeam={onSelectTeam}
                  onSelectPlayer={onSelectPlayer}
                />
              ) : null}

              {view === "records" ? (
                <RecordsPanel records={gameState.records ?? null} />
              ) : null}

              {view === "halloffame" ? (
                <HallOfFamePanel
                  retired={gameState.retired_players ?? []}
                  onSelectTeam={onSelectTeam}
                />
              ) : null}
            </div>
          </TemplateCard>
        </section>

        {!isWorldCupCompetition ? (
          <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[360px]">
            <TopScorersCard
              topScorers={topScorers}
              teams={gameState.teams}
              buildPlayerMenuItems={buildPlayerMenuItems}
              onSelectPlayer={onSelectPlayer}
              onSelectTeam={onSelectTeam}
              title={t("tournaments.topScorers")}
              emptyText={t("tournaments.noGoals")}
              withTestIds
            />
            <SnapshotCard
              leaderStanding={leaderStanding}
              userStanding={userStanding}
              userStandingIndex={userStandingIndex}
              teamById={teamById}
              teams={gameState.teams}
              completedMatches={completedMatches}
              totalGoals={totalGoals}
            />
          </aside>
        ) : null}
      </div>

      <MatchDetailModal
        fixtureId={selectedMatchFixtureId}
        onClose={() => setSelectedMatchFixtureId(null)}
      />
    </div>
  );
}

function CompetitionWorldSelector({
  regions,
  selectedCompetitionId,
  onSelectCompetition,
}: {
  regions: CompetitionRegion[];
  selectedCompetitionId: string;
  onSelectCompetition: (id: string) => void;
}) {
  const selectedRegion = regions.find((region) =>
    region.competitions.some((competition) => competition.id === selectedCompetitionId),
  );
  const selectedCompetition = selectedRegion?.competitions.find((competition) => competition.id === selectedCompetitionId) ?? null;
  const [open, setOpen] = useState(false);
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
        className="flex w-fit max-w-full items-center gap-3 rounded-xl border border-app-border bg-app-card px-4 py-2.5 text-left transition-colors hover:bg-white/5"
        aria-haspopup="dialog"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-green/30 bg-app-green/10 text-app-green">
          <Globe2 className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-app-green">World selector</span>
          <span className="block truncate text-xs text-app-text-muted">
            {selectedCompetition ? getCompetitionDisplayName(selectedCompetition) : `${regions.length} regions`}
          </span>
        </span>
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
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-app-green">World selector</span>
                  <span className="block truncate text-xs text-app-text-muted">
                    {selectedRegion ? `${selectedRegion.label} · ${selectedRegion.competitions.length} competitions` : `${regions.length} regions`}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-app-border bg-app-bg p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                aria-label="Close world selector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 overflow-y-auto p-3 custom-scrollbar lg:grid-cols-2 xl:grid-cols-3">
              {regions.map((region) => {
                const regionActive = region.competitions.some((competition) => competition.id === selectedCompetitionId);
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
                            const active = competition.id === selectedCompetitionId;
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

function PanelHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-app-border/50 bg-app-card px-4 py-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function EmptyPanel({ icon, title, description, compact = false }: { icon: ReactNode; title: string; description: string; compact?: boolean }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 p-8 text-center", compact ? "min-h-[220px]" : "min-h-[280px]") }>
      <span className="text-app-text-muted">{icon}</span>
      <p className="text-sm font-bold text-app-text">{title}</p>
      <p className="max-w-md text-xs text-app-text-muted">{description}</p>
    </div>
  );
}

function WorldCupOverviewCard({
  groups,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
  buildStandingMenuItems,
}: {
  groups: WorldCupGroup[];
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
  buildStandingMenuItems: (teamId: string) => ReturnType<typeof buildViewTeamMenuItem>[];
}) {
  const { t } = useTranslation();

  return (
    <TemplateCard className="overflow-hidden xl:col-span-3">
      <PanelHeader
        title={t("tournaments.worldCupFormatTitle", { defaultValue: "World Cup 2026 format" })}
        action={`${groups.length} groups`}
      />
      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.slice(0, 6).map((group) => (
            <WorldCupGroupCard
              key={group.label}
              group={group}
              bestThirdIds={new Set(bestWorldCupThirds(groups).slice(0, 8).map((entry) => entry.team_id))}
              teamById={teamById}
              teams={teams}
              userTeamId={userTeamId}
              onSelectTeam={onSelectTeam}
              buildStandingMenuItems={buildStandingMenuItems}
              compact
            />
          ))}
        </div>
      </div>
    </TemplateCard>
  );
}

function WorldCupGroupsPanel({
  groups,
  bestThirds,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
  buildStandingMenuItems,
}: {
  groups: WorldCupGroup[];
  bestThirds: StandingEntry[];
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
  buildStandingMenuItems: (teamId: string) => ReturnType<typeof buildViewTeamMenuItem>[];
}) {
  const { t } = useTranslation();
  const bestThirdIds = new Set(bestThirds.slice(0, 8).map((entry) => entry.team_id));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <WorldCupGroupCard
            key={group.label}
            group={group}
            bestThirdIds={bestThirdIds}
            teamById={teamById}
            teams={teams}
            userTeamId={userTeamId}
            onSelectTeam={onSelectTeam}
            buildStandingMenuItems={buildStandingMenuItems}
          />
        ))}
      </div>
      <TemplateCard className="overflow-hidden">
        <PanelHeader
          title={t("tournaments.worldCupBestThirds", { defaultValue: "Best third-place ranking" })}
          action={t("tournaments.worldCupQualified", { defaultValue: "Top 8 advance" })}
        />
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[620px] text-left text-[11px] whitespace-nowrap">
            <thead className="border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
              <tr>
                <th className="w-10 px-4 py-3">#</th>
                <th className="px-4 py-3">{t("common.team")}</th>
                <th className="px-4 py-3 text-center">{t("common.played")}</th>
                <th className="px-4 py-3 text-center">{t("common.gd")}</th>
                <th className="px-4 py-3 text-center">{t("common.pts")}</th>
                <th className="px-4 py-3 text-right">{t("common.status", { defaultValue: "Status" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30 text-app-text">
              {bestThirds.map((entry, index) => (
                <WorldCupStandingRow
                  key={entry.team_id}
                  entry={entry}
                  rank={index + 1}
                  badge={index < 8 ? t("tournaments.worldCupBestThird", { defaultValue: "Best 3rd" }) : null}
                  teamById={teamById}
                  teams={teams}
                  userTeamId={userTeamId}
                  onSelectTeam={onSelectTeam}
                  buildStandingMenuItems={buildStandingMenuItems}
                />
              ))}
            </tbody>
          </table>
        </div>
      </TemplateCard>
    </div>
  );
}

function WorldCupGroupCard({
  group,
  bestThirdIds,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
  buildStandingMenuItems,
  compact = false,
}: {
  group: WorldCupGroup;
  bestThirdIds: Set<string>;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
  buildStandingMenuItems: (teamId: string) => ReturnType<typeof buildViewTeamMenuItem>[];
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <TemplateCard className="overflow-hidden" data-testid={`worldcup-${group.label.toLowerCase().replace(/\s+/g, "-")}`}>
      <PanelHeader title={group.label} action={t("tournaments.worldCupGroups", { defaultValue: "Group" })} />
      <div className="overflow-x-auto custom-scrollbar">
        <table className={cx("w-full text-left text-[11px] whitespace-nowrap", compact ? "min-w-[360px]" : "min-w-[520px]")}>
          <thead className="border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
            <tr>
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-3 py-2">{t("common.team")}</th>
              <th className="px-3 py-2 text-center">{t("common.played")}</th>
              <th className="px-3 py-2 text-center">{t("common.gd")}</th>
              <th className="px-3 py-2 text-center">{t("common.pts")}</th>
              <th className="px-3 py-2 text-right">{t("common.status", { defaultValue: "Status" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/30 text-app-text">
            {group.standings.map((entry, index) => {
              const badge = index < 2
                ? t("tournaments.worldCupQualified", { defaultValue: "Qualified" })
                : index === 2 && bestThirdIds.has(entry.team_id)
                  ? t("tournaments.worldCupBestThird", { defaultValue: "Best 3rd" })
                  : null;
              return (
                <WorldCupStandingRow
                  key={entry.team_id}
                  entry={entry}
                  rank={index + 1}
                  badge={compact ? null : badge}
                  teamById={teamById}
                  teams={teams}
                  userTeamId={userTeamId}
                  onSelectTeam={onSelectTeam}
                  buildStandingMenuItems={buildStandingMenuItems}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </TemplateCard>
  );
}

function WorldCupStandingRow({
  entry,
  rank,
  badge,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
  buildStandingMenuItems,
}: {
  entry: StandingEntry;
  rank: number;
  badge: string | null;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
  buildStandingMenuItems: (teamId: string) => ReturnType<typeof buildViewTeamMenuItem>[];
}) {
  const team = teamById.get(entry.team_id);
  const gd = goalDifference(entry);
  const isUser = entry.team_id === userTeamId;

  return (
    <ContextMenu items={buildStandingMenuItems(entry.team_id)}>
      <tr
        onClick={() => onSelectTeam(entry.team_id)}
        className={cx("cursor-pointer transition-colors hover:bg-white/5", isUser && "bg-app-green/10 ring-1 ring-inset ring-app-green/30")}
        data-testid={`worldcup-standing-${entry.team_id}`}
      >
        <td className="px-3 py-2 font-heading text-sm font-bold text-app-text-muted">{rank}</td>
        <td className={cx("px-3 py-2 text-sm font-semibold", isUser ? "text-app-green" : "text-app-text")}>
          <span className="flex min-w-0 items-center gap-2">
            {team ? <TeamLogo team={team} size="sm" /> : null}
            <span className="truncate">{team?.name ?? getTeamName(teams, entry.team_id)}</span>
          </span>
        </td>
        <td className="px-3 py-2 text-center tabular-nums text-app-text-muted">{entry.played}</td>
        <td className={cx("px-3 py-2 text-center font-semibold tabular-nums", gd > 0 ? "text-app-green" : gd < 0 ? "text-red-400" : "text-app-text-muted")}>{gd > 0 ? `+${gd}` : gd}</td>
        <td className="px-3 py-2 text-center font-heading text-sm font-bold tabular-nums text-app-text">{entry.points}</td>
        {badge ? (
          <td className="px-3 py-2 text-right">
            <span className="rounded bg-app-green/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-app-green">{badge}</span>
          </td>
        ) : (
          <td className="px-3 py-2 text-right text-app-text-muted">—</td>
        )}
      </tr>
    </ContextMenu>
  );
}

function StandingsTable({
  standings,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
  buildStandingMenuItems,
  compact = false,
  testIdPrefix,
  showGoals = false,
}: {
  standings: StandingEntry[];
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
  buildStandingMenuItems: (teamId: string) => ReturnType<typeof buildViewTeamMenuItem>[];
  compact?: boolean;
  testIdPrefix: string;
  showGoals?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[760px] text-left text-[11px] whitespace-nowrap">
        <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card">
          <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
            <th className="w-10 px-4 py-3">#</th>
            <th className="px-4 py-3">{t("common.team")}</th>
            <th className="px-4 py-3 text-center">{t("common.played")}</th>
            <th className="px-4 py-3 text-center">{t("common.won")}</th>
            <th className="px-4 py-3 text-center">{t("common.drawn")}</th>
            <th className="px-4 py-3 text-center">{t("common.lost")}</th>
            {showGoals ? <th className="px-4 py-3 text-center">{t("common.gf")}</th> : null}
            {showGoals ? <th className="px-4 py-3 text-center">{t("common.ga")}</th> : null}
            <th className="px-4 py-3 text-center">{t("common.gd")}</th>
            <th className="px-4 py-3 text-center">{t("common.pts")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border/30 text-app-text">
          {standings.map((entry, index) => {
            const isUser = entry.team_id === userTeamId;
            const team = teamById.get(entry.team_id);
            const goalDifference = entry.goals_for - entry.goals_against;
            return (
              <ContextMenu items={buildStandingMenuItems(entry.team_id)} key={entry.team_id}>
                <tr
                  onClick={() => onSelectTeam(entry.team_id)}
                  className={cx(
                    "cursor-pointer transition-colors hover:bg-white/5",
                    isUser && "bg-app-green/10 ring-1 ring-inset ring-app-green/30",
                  )}
                  data-testid={`${testIdPrefix}-${entry.team_id}`}
                >
                  <td className="px-4 py-3 font-heading text-sm font-bold text-app-text-muted">{index + 1}</td>
                  <td className={cx("px-4 py-3 text-sm font-semibold", isUser ? "text-app-green" : "text-app-text")}>
                    <span className="flex min-w-0 items-center gap-2">
                      {team ? <TeamLogo team={team} size="sm" /> : null}
                      <span className="truncate">{team?.name ?? getTeamName(teams, entry.team_id)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.played}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.won}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.drawn}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.lost}</td>
                  {showGoals ? <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.goals_for}</td> : null}
                  {showGoals ? <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">{entry.goals_against}</td> : null}
                  <td className={cx("px-4 py-3 text-center font-semibold tabular-nums", goalDifference > 0 ? "text-app-green" : goalDifference < 0 ? "text-red-400" : "text-app-text-muted")}>
                    {goalDifference > 0 ? `+${goalDifference}` : goalDifference}
                  </td>
                  <td className="px-4 py-3 text-center font-heading text-sm font-bold tabular-nums text-app-text">{entry.points}</td>
                </tr>
              </ContextMenu>
            );
          })}
        </tbody>
      </table>
      {compact && standings.length === 0 ? <p className="p-4 text-center text-sm text-app-text-muted">No standings yet.</p> : null}
    </div>
  );
}

function FixtureRow({
  fixture,
  teamById,
  teams,
  userTeamId,
  buildFixtureMenuItems,
  onSelectTeam,
  onSelectMatch,
}: {
  fixture: FixtureData;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  buildFixtureMenuItems: (fixture: FixtureData) => ContextMenuItem[];
  onSelectTeam: (id: string) => void;
  onSelectMatch: (fixtureId: string) => void;
}) {
  const completed = fixture.status === "Completed";
  const homeTeam = teamById.get(fixture.home_team_id);
  const awayTeam = teamById.get(fixture.away_team_id);
  const isUserMatch = fixture.home_team_id === userTeamId || fixture.away_team_id === userTeamId;
  const { t } = useTranslation();
  const resolutionText = knockoutResolutionText(fixture, teamById, teams, t);

  return (
    <ContextMenu items={buildFixtureMenuItems(fixture)}>
      <div
        className={cx(
          "flex items-center px-4 py-3 transition-colors hover:bg-white/5",
          isUserMatch && "bg-app-green/10",
        )}
        data-testid={`tournaments-fixture-${fixture.id}`}
      >
        <span
          onClick={() => onSelectTeam(fixture.home_team_id)}
          className={cx(
            "flex-1 cursor-pointer text-right text-sm font-semibold hover:underline",
            fixture.home_team_id === userTeamId ? "text-app-green" : "text-app-text",
          )}
        >
          <span className="flex items-center justify-end gap-2">
            <span className="truncate">{homeTeam?.name ?? getTeamName(teams, fixture.home_team_id)}</span>
            {homeTeam ? <TeamLogo team={homeTeam} size="sm" /> : null}
          </span>
        </span>
        <div className="mx-3 w-32 text-center">
          {completed && fixture.result ? (
            <span>
              <button
                type="button"
                onClick={() => onSelectMatch(fixture.id)}
                className="block w-full font-heading text-lg font-bold text-app-text transition hover:text-app-green"
              >
                {fixture.result.home_goals} - {fixture.result.away_goals}
              </button>
              {resolutionText ? (
                <span className="mt-0.5 block text-[9px] font-semibold leading-tight text-app-green">
                  {resolutionText}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="rounded bg-app-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">vs</span>
          )}
        </div>
        <span
          onClick={() => onSelectTeam(fixture.away_team_id)}
          className={cx(
            "flex-1 cursor-pointer text-left text-sm font-semibold hover:underline",
            fixture.away_team_id === userTeamId ? "text-app-green" : "text-app-text",
          )}
        >
          <span className="flex items-center gap-2">
            {awayTeam ? <TeamLogo team={awayTeam} size="sm" /> : null}
            <span className="truncate">{awayTeam?.name ?? getTeamName(teams, fixture.away_team_id)}</span>
          </span>
        </span>
      </div>
    </ContextMenu>
  );
}

function WorldCupFixturesPanel({
  groups,
  fixtures,
  teamById,
  teams,
  userTeamId,
  getFixtureRoundLabel,
  buildFixtureMenuItems,
  onSelectTeam,
  onSelectMatch,
}: {
  groups: WorldCupGroup[];
  fixtures: FixtureData[];
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  getFixtureRoundLabel: (fixture: FixtureData) => string;
  buildFixtureMenuItems: (fixture: FixtureData) => ContextMenuItem[];
  onSelectTeam: (id: string) => void;
  onSelectMatch: (fixtureId: string) => void;
}) {
  const { t } = useTranslation();
  const knockoutFixtures = fixtures.filter((fixture) => fixture.stage);
  const sections = [
    ...groups.map((group) => ({
      key: group.label,
      label: group.label,
      fixtures: fixtures.filter((fixture) => !fixture.stage && group.teamIds.has(fixture.home_team_id) && group.teamIds.has(fixture.away_team_id)),
    })),
    ...Array.from(new Set(knockoutFixtures.map((fixture) => fixture.stage!))).map((stage) => ({
      key: stage,
      label: getFixtureRoundLabel(knockoutFixtures.find((fixture) => fixture.stage === stage)!),
      fixtures: knockoutFixtures.filter((fixture) => fixture.stage === stage),
    })),
  ].filter((section) => section.fixtures.length > 0);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>(sections[0]?.key ?? "");

  useEffect(() => {
    if (sections.length > 0 && !sections.some((section) => section.key === selectedSectionKey)) {
      setSelectedSectionKey(sections[0].key);
    }
  }, [sections, selectedSectionKey]);

  if (sections.length === 0) {
    return (
      <EmptyPanel
        icon={<Calendar className="h-8 w-8" />}
        title={t("tournaments.noFixturesTitle", { defaultValue: "No fixtures yet" })}
        description={t("tournaments.noFixturesBody", { defaultValue: "Fixtures appear once the schedule is generated." })}
      />
    );
  }

  const selectedSection = sections.find((section) => section.key === selectedSectionKey) ?? sections[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setSelectedSectionKey(section.key)}
            className={cx(
              "rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
              selectedSection.key === section.key
                ? "border-app-green bg-app-green/10 text-app-green"
                : "border-app-border bg-app-card text-app-text-muted hover:text-app-text",
            )}
          >
            {section.label}
          </button>
        ))}
      </div>
      <TemplateCard className="overflow-hidden">
        <PanelHeader
          title={selectedSection.label}
          action={`${selectedSection.fixtures.length} ${t("schedule.fixtures").toLowerCase()}`}
        />
        <div className="divide-y divide-app-border/30">
          {selectedSection.fixtures.map((fixture) => (
            <FixtureRow
              key={fixture.id}
              fixture={fixture}
              teamById={teamById}
              teams={teams}
              userTeamId={userTeamId}
              buildFixtureMenuItems={buildFixtureMenuItems}
              onSelectTeam={onSelectTeam}
              onSelectMatch={onSelectMatch}
            />
          ))}
        </div>
      </TemplateCard>
    </div>
  );
}

function FixturesList({
  sortedMatchdays,
  teamById,
  teams,
  userTeamId,
  getFixtureRoundLabel,
  buildFixtureMenuItems,
  onSelectTeam,
  onSelectMatch,
}: {
  sortedMatchdays: Array<[number, FixtureData[]]>;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  getFixtureRoundLabel: (fixture: FixtureData) => string;
  buildFixtureMenuItems: (fixture: FixtureData) => ContextMenuItem[];
  onSelectTeam: (id: string) => void;
  onSelectMatch: (fixtureId: string) => void;
}) {
  const { t } = useTranslation();

  // Default to the most recent round that has any played fixture, otherwise the
  // next round to be played, otherwise the last round in the list. Only ONE
  // round is rendered at a time — navigate with the < / > arrows — so a 30-round
  // league or a deep cup doesn't render hundreds of rows at once.
  const defaultIndex = (() => {
    if (sortedMatchdays.length === 0) return 0;
    const lastPlayed = sortedMatchdays.reduce(
      (acc, [, fixtures], index) =>
        fixtures.some((fixture) => fixture.status === "Completed") ? index : acc,
      -1,
    );
    if (lastPlayed >= 0) return lastPlayed;
    const nextUnplayed = sortedMatchdays.findIndex(([, fixtures]) =>
      fixtures.some((fixture) => fixture.status === "Scheduled"),
    );
    return nextUnplayed >= 0 ? nextUnplayed : sortedMatchdays.length - 1;
  })();

  const [roundIndex, setRoundIndex] = useState(defaultIndex);
  // Re-anchor when the competition (and therefore its round set) changes.
  useEffect(() => {
    setRoundIndex(defaultIndex);
  }, [defaultIndex, sortedMatchdays.length]);

  if (sortedMatchdays.length === 0) {
    return (
      <EmptyPanel
        icon={<Calendar className="h-8 w-8" />}
        title={t("tournaments.noFixturesTitle", { defaultValue: "No fixtures yet" })}
        description={t("tournaments.noFixturesBody", {
          defaultValue: "Fixtures appear once the schedule is generated.",
        })}
      />
    );
  }

  const clampedIndex = Math.min(Math.max(roundIndex, 0), sortedMatchdays.length - 1);
  const [, fixtures] = sortedMatchdays[clampedIndex];
  const canPrev = clampedIndex > 0;
  const canNext = clampedIndex < sortedMatchdays.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setRoundIndex(clampedIndex - 1)}
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-card transition-colors",
            canPrev ? "text-app-text hover:bg-white/5" : "cursor-not-allowed text-app-text-muted/40",
          )}
          aria-label={t("common.previous", { defaultValue: "Previous" })}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold uppercase tracking-wider text-app-text">
            {getFixtureRoundLabel(fixtures[0])}
          </p>
          <p className="text-[11px] text-app-text-muted">
            {formatMatchDate(fixtures[0].date)} · {t("tournaments.roundOfTotal", {
              defaultValue: "{{current}} / {{total}}",
              current: clampedIndex + 1,
              total: sortedMatchdays.length,
            })}
          </p>
        </div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setRoundIndex(clampedIndex + 1)}
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-card transition-colors",
            canNext ? "text-app-text hover:bg-white/5" : "cursor-not-allowed text-app-text-muted/40",
          )}
          aria-label={t("common.next", { defaultValue: "Next" })}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <TemplateCard className="overflow-hidden">
        <div className="divide-y divide-app-border/30">
          {fixtures.map((fixture) => (
            <FixtureRow
              key={fixture.id}
              fixture={fixture}
              teamById={teamById}
              teams={teams}
              userTeamId={userTeamId}
              buildFixtureMenuItems={buildFixtureMenuItems}
              onSelectTeam={onSelectTeam}
              onSelectMatch={onSelectMatch}
            />
          ))}
        </div>
      </TemplateCard>
    </div>
  );
}

function BracketPanel({
  fixtures,
  isContinental,
  teamById,
  teams,
  userTeamId,
  onSelectTeam,
}: {
  fixtures: FixtureData[];
  isContinental: boolean;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  onSelectTeam: (id: string) => void;
}) {
  const { t } = useTranslation();

  // Knockout-stage fixtures only (the league phase shows on the Standings tab).
  const knockoutFixtures = fixtures.filter((fixture) => fixture.stage != null);

  // Order stages by their place in a real bracket.
  const STAGE_ORDER: Record<string, number> = {
    playoff: 0,
    round_64: 1,
    round_32: 2,
    r32: 2,
    r16: 3,
    qf: 4,
    sf: 5,
    final: 6,
  };
  const stageOrder = (stage: string): number =>
    STAGE_ORDER[stage] ?? (stage.startsWith("round_") ? Number(stage.slice(6)) / 10000 : 99);
  const stageLabel = (stage: string): string => {
    const key = `tournaments.stages.${stage}`;
    const fallbacks: Record<string, string> = {
      playoff: "Playoff",
      r32: "Round of 32",
      r16: "Round of 16",
      qf: "Quarter-finals",
      sf: "Semi-finals",
      final: "Final",
    };
    const fb = fallbacks[stage] ?? (stage.startsWith("round_") ? `Round of ${stage.slice(6)}` : stage);
    return t(key, { defaultValue: fb });
  };

  // Group fixtures into ties. Two-legged ties share a tie_id; single-leg cup
  // ties are their own tie (keyed by fixture id).
  type Tie = {
    key: string;
    stage: string;
    homeTeamId: string; // leg-1 home (or the single match's home)
    awayTeamId: string;
    legs: FixtureData[];
  };
  const tieMap = new Map<string, Tie>();
  for (const fixture of knockoutFixtures) {
    const tieKey = fixture.tie_id ?? fixture.id;
    const existing = tieMap.get(tieKey);
    if (existing) {
      existing.legs.push(fixture);
    } else {
      tieMap.set(tieKey, {
        key: tieKey,
        stage: fixture.stage!,
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        legs: [fixture],
      });
    }
  }

  const ties = Array.from(tieMap.values());
  const stages = Array.from(new Set(ties.map((tie) => tie.stage))).sort(
    (a, b) => stageOrder(a) - stageOrder(b),
  );

  if (ties.length === 0) {
    return (
      <EmptyPanel
        icon={<GitBranch className="h-8 w-8" />}
        title={t("tournaments.bracketEmptyTitle", { defaultValue: "Knockout stage not drawn yet" })}
        description={
          isContinental
            ? t("tournaments.bracketEmptyContinental", {
                defaultValue: "The bracket is drawn once the league phase finishes.",
              })
            : t("tournaments.bracketEmptyCup", {
                defaultValue: "Later rounds appear as each round is played.",
              })
        }
      />
    );
  }

  const teamName = (id: string): string =>
    teamById.get(id)?.name ?? getTeamName(teams, id);

  // Aggregate score across legs for a tie (handles 1 or 2 legs).
  const tieAggregate = (tie: Tie): { home: number; away: number; played: boolean } => {
    let home = 0;
    let away = 0;
    let played = false;
    for (const leg of tie.legs) {
      if (!leg.result) continue;
      played = true;
      if (leg.home_team_id === tie.homeTeamId) {
        home += leg.result.home_goals;
        away += leg.result.away_goals;
      } else {
        // Second leg with reversed venue.
        home += leg.result.away_goals;
        away += leg.result.home_goals;
      }
    }
    return { home, away, played };
  };

  const tieWinner = (tie: Tie): string | null => {
    const allPlayed = tie.legs.every((leg) => leg.status === "Completed");
    if (!allPlayed) return null;
    const agg = tieAggregate(tie);
    if (agg.home > agg.away) return tie.homeTeamId;
    if (agg.away > agg.home) return tie.awayTeamId;
    return tie.legs.find((leg) => leg.result?.winner_team_id)?.result?.winner_team_id ?? null;
  };

  return (
    <div className="overflow-x-auto pb-2 custom-scrollbar">
      <div className="flex min-w-max gap-4">
        {stages.map((stage) => {
          const stageTies = ties.filter((tie) => tie.stage === stage);
          return (
            <div key={stage} className="flex min-w-[260px] flex-col gap-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                {stageLabel(stage)}
              </h4>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {stageTies.map((tie) => {
                  const agg = tieAggregate(tie);
                  const winner = tieWinner(tie);
                  const twoLegged = tie.legs.length > 1;
                  const resolutionText = tie.legs.length === 1
                    ? knockoutResolutionText(tie.legs[0], teamById, teams, t)
                    : null;
                  return (
                    <div
                      key={tie.key}
                      className="rounded-xl border border-app-border bg-app-bg p-3"
                    >
                      {[tie.homeTeamId, tie.awayTeamId].map((teamId, idx) => {
                        const score = idx === 0 ? agg.home : agg.away;
                        const isWinner = winner === teamId;
                        const isUser = teamId === userTeamId;
                        const team = teamById.get(teamId);
                        return (
                          <button
                            type="button"
                            key={teamId}
                            onClick={() => onSelectTeam(teamId)}
                            className={cx(
                              "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-white/5",
                              isWinner ? "font-bold text-app-text" : "text-app-text-muted",
                              isUser && "text-app-green",
                            )}
                          >
                            {team ? <TeamLogo team={team} size="sm" /> : null}
                            <span className="min-w-0 flex-1 truncate">{teamName(teamId)}</span>
                            {agg.played ? (
                              <span className="shrink-0 font-heading tabular-nums">{score}</span>
                            ) : null}
                          </button>
                        );
                      })}
                      <div className="mt-1 border-t border-app-border/40 pt-1 text-center text-[9px] uppercase tracking-wider text-app-text-muted">
                        {resolutionText ?? (twoLegged
                          ? t("tournaments.bracketTwoLegged", { defaultValue: "Two legs · aggregate" })
                          : t("tournaments.bracketSingleLeg", { defaultValue: "Single match" }))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwardsPanel({
  awards,
  awardsLoadState,
  onRetry,
  onSelectPlayer,
  onSelectTeam,
}: {
  awards: SeasonAwards | null;
  awardsLoadState: "idle" | "loading" | "error";
  onRetry: () => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (awards) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AwardCard icon={<Zap className="h-5 w-5 text-app-green" />} title={t("tournaments.awards.goldenBootTitle")} subtitle={t("tournaments.awards.goldenBootSubtitle")} entries={awards.golden_boot} unit={t("tournaments.awards.units.goals")} emptyText={t("tournaments.awards.noDataYet")} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <AwardCard icon={<Star className="h-5 w-5 text-purple-400" />} title={t("tournaments.awards.assistKingTitle")} subtitle={t("tournaments.awards.assistKingSubtitle")} entries={awards.assist_king} unit={t("tournaments.awards.units.assists")} emptyText={t("tournaments.awards.noDataYet")} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <AwardCard icon={<Trophy className="h-5 w-5 text-app-green" />} title={t("tournaments.awards.playerOfYearTitle")} subtitle={t("tournaments.awards.playerOfYearSubtitle")} entries={awards.player_of_year} unit={t("tournaments.awards.units.rating")} emptyText={t("tournaments.awards.noDataYet")} decimal onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <AwardCard icon={<Shield className="h-5 w-5 text-blue-400" />} title={t("tournaments.awards.goldenGloveTitle")} subtitle={t("tournaments.awards.goldenGloveSubtitle")} entries={awards.clean_sheet_king} unit={t("tournaments.awards.units.cleanSheets")} emptyText={t("tournaments.awards.noDataYet")} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <AwardCard icon={<Users className="h-5 w-5 text-app-green" />} title={t("tournaments.awards.everPresentTitle")} subtitle={t("tournaments.awards.everPresentSubtitle")} entries={awards.most_appearances} unit={t("tournaments.awards.units.apps")} emptyText={t("tournaments.awards.noDataYet")} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <AwardCard icon={<Star className="h-5 w-5 text-amber-400" />} title={t("tournaments.awards.youngPlayerTitle")} subtitle={t("tournaments.awards.youngPlayerSubtitle")} entries={awards.young_player} unit={t("tournaments.awards.units.rating")} emptyText={t("tournaments.awards.noDataYet")} decimal onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
      </div>
    );
  }

  if (awardsLoadState === "error") {
    return (
      <TemplateCard className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
        <Award className="h-10 w-10 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">{t("tournaments.awards.noDataYet")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg transition-colors hover:bg-app-green/90"
        >
          {t("common.retry")}
        </button>
      </TemplateCard>
    );
  }

  return (
    <TemplateCard className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Award className="h-10 w-10 text-app-text-muted" />
      <p className="text-sm text-app-text-muted">{t("tournaments.loadingAwards")}</p>
    </TemplateCard>
  );
}

function AwardCard({
  icon,
  title,
  subtitle,
  entries,
  unit,
  emptyText,
  decimal,
  onSelectPlayer,
  onSelectTeam,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  entries: AwardEntry[];
  unit: string;
  emptyText: string;
  decimal?: boolean;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}) {
  const { t } = useTranslation();
  const buildAwardMenuItems = (entry: AwardEntry) => {
    const items = [buildViewTeamMenuItem(t, () => onSelectTeam(entry.team_id))];

    if (typeof onSelectPlayer === "function") {
      items.unshift(buildViewProfileMenuItem(t, () => onSelectPlayer(entry.player_id)));
    }

    return items;
  };

  return (
    <TemplateCard className="overflow-hidden">
      <div className="border-b border-app-border/50 bg-app-card px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-app-text">{title}</span>
            <p className="truncate text-[10px] font-normal normal-case tracking-normal text-app-text-muted">{subtitle}</p>
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="p-4 text-center text-sm text-app-text-muted">{emptyText}</p>
      ) : (
        <div className="divide-y divide-app-border/30">
          {entries.map((entry, index) => (
            <ContextMenu items={buildAwardMenuItems(entry)} key={entry.player_id}>
              <div
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                data-testid={`tournaments-award-entry-${entry.player_id}`}
              >
                <span className={cx("w-5 text-center font-heading text-sm font-bold", index === 0 ? "text-app-green" : "text-app-text-muted")}>{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelectPlayer?.(entry.player_id)}
                    className="block w-full truncate text-left text-sm font-semibold text-app-text hover:text-app-green"
                  >
                    {entry.player_name}
                  </button>
                  <button
                    type="button"
                    onClick={() => entry.team_id && onSelectTeam(entry.team_id)}
                    className="block w-full truncate text-left text-xs text-app-text-muted hover:text-app-green"
                  >
                    {entry.team_name}
                  </button>
                </div>
                <span className={cx("font-heading font-bold tabular-nums", index === 0 ? "text-lg text-app-green" : "text-sm text-app-text-muted")}>
                  {decimal ? entry.value.toFixed(2) : entry.value}
                </span>
                <span className="w-12 text-[10px] text-app-text-muted">{unit}</span>
              </div>
            </ContextMenu>
          ))}
        </div>
      )}
    </TemplateCard>
  );
}

function TopScorersCard({
  topScorers,
  teams,
  buildPlayerMenuItems,
  onSelectPlayer,
  onSelectTeam,
  title,
  emptyText,
  withTestIds = false,
}: {
  topScorers: TopScorerEntry[];
  teams: GameStateData["teams"];
  buildPlayerMenuItems: (playerId: string, teamId?: string | null) => ReturnType<typeof buildViewTeamMenuItem>[];
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
  title: string;
  emptyText: string;
  withTestIds?: boolean;
}) {
  return (
    <div>
      <SectionTitle title={title} action="Goals" />
      <TemplateCard className="overflow-hidden">
        {topScorers.length === 0 ? (
          <p className="p-4 text-center text-sm text-app-text-muted">{emptyText}</p>
        ) : (
          <div className="divide-y divide-app-border/30">
            {topScorers.map((entry, index) => (
              <ContextMenu items={buildPlayerMenuItems(entry.player!.id, entry.player!.team_id)} key={entry.player!.id}>
                <div
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5"
                  data-testid={withTestIds ? `tournaments-top-scorer-${entry.player!.id}` : undefined}
                >
                  <span className={cx("w-5 text-center font-heading text-sm font-bold", index === 0 ? "text-app-green" : "text-app-text-muted")}>{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectPlayer?.(entry.player!.id)}
                      className="block w-full truncate text-left text-sm font-semibold text-app-text hover:text-app-green"
                    >
                      {entry.player!.full_name}
                    </button>
                    <button
                      type="button"
                      onClick={() => entry.player!.team_id && onSelectTeam(entry.player!.team_id)}
                      className="block w-full truncate text-left text-xs text-app-text-muted hover:text-app-green"
                    >
                      {getTeamName(teams, entry.player!.team_id ?? "")}
                    </button>
                  </div>
                  <span className="font-heading text-lg font-bold tabular-nums text-app-green">{entry.goals}</span>
                </div>
              </ContextMenu>
            ))}
          </div>
        )}
      </TemplateCard>
    </div>
  );
}

function SnapshotCard({
  leaderStanding,
  userStanding,
  userStandingIndex,
  teamById,
  teams,
  completedMatches,
  totalGoals,
}: {
  leaderStanding: StandingEntry | null;
  userStanding: StandingEntry | null;
  userStandingIndex: number;
  teamById: Map<string, GameStateData["teams"][number]>;
  teams: GameStateData["teams"];
  completedMatches: number;
  totalGoals: number;
}) {
  const leaderTeamName = leaderStanding ? teamById.get(leaderStanding.team_id)?.name ?? getTeamName(teams, leaderStanding.team_id) : "—";
  const userTeamName = userStanding ? teamById.get(userStanding.team_id)?.name ?? getTeamName(teams, userStanding.team_id) : "—";

  return (
    <div>
      <SectionTitle title="TABLE SNAPSHOT" action="Live" />
      <TemplateCard className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-bg p-3">
          <Crown className="h-5 w-5 text-app-green" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">Leader</p>
            <p className="truncate text-sm font-bold text-app-text">{leaderTeamName}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-app-border/50 pt-3">
          <StatRow label="Your club" value={userStanding ? `#${userStandingIndex + 1} ${userTeamName}` : "—"} tone="text-app-green" />
          <StatRow label="Completed matches" value={String(completedMatches)} />
          <StatRow label="Goals" value={String(totalGoals)} />
        </div>
      </TemplateCard>
    </div>
  );
}

function CompetitionHistoryPanel({
  competitionId,
  honours,
  onSelectTeam,
  onSelectPlayer,
}: {
  competitionId: string;
  honours: SeasonHonours[];
  onSelectTeam: (id: string) => void;
  onSelectPlayer?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const rows = honours
    .flatMap((entry) => entry.champions.map((champion) => ({ season: entry.season, champion, awards: entry.awards })))
    .filter((row) => row.champion.competition_id === competitionId)
    .sort((a, b) => b.season - a.season);

  const resolutionLabel = (label?: string | null): string | null => {
    if (label === "AfterPenalties") {
      return t("tournaments.historyAfterPenalties", { defaultValue: "won on penalties" });
    }
    if (label === "AfterExtraTime") {
      return t("tournaments.historyAfterExtraTime", { defaultValue: "won after extra time" });
    }
    return null;
  };

  if (rows.length === 0) {
    return (
      <EmptyPanel
        icon={<History className="h-8 w-8" />}
        title={t("tournaments.historyEmptyTitle", { defaultValue: "No history yet" })}
        description={t("tournaments.historyEmptyBody", {
          defaultValue: "Champions and runners-up are recorded when a season finishes.",
        })}
      />
    );
  }

  return (
    <div className="p-4">
      <TemplateCard className="overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
              <tr>
                <th className="px-4 py-3">{t("schedule.season", { number: "" }).trim() || "Season"}</th>
                <th className="px-4 py-3">{t("tournaments.champion", { defaultValue: "Champion" })}</th>
                <th className="px-4 py-3">{t("tournaments.runnerUp", { defaultValue: "Runner-up" })}</th>
                <th className="px-4 py-3">{t("tournaments.goldenBoot", { defaultValue: "Golden Boot" })}</th>
                <th className="px-4 py-3">{t("tournaments.assistKing", { defaultValue: "Assist King" })}</th>
                <th className="px-4 py-3">{t("tournaments.playerOfYear", { defaultValue: "Player of the Year" })}</th>
                <th className="px-4 py-3">{t("tournaments.goldenGlove", { defaultValue: "Golden Glove" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30 text-app-text">
              {rows.map(({ season, champion, awards }) => {
                const note = resolutionLabel(champion.resolution_label);
                const goldenBoot = awards.golden_boot[0];
                const assistKing = awards.assist_king[0];
                const playerOfYear = awards.player_of_year[0];
                const cleanSheetKing = awards.clean_sheet_king[0];
                return (
                  <tr key={`${season}-${champion.competition_id}`} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3 font-heading text-sm font-bold tabular-nums text-app-text-muted">
                      {t("schedule.season", { number: season })}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onSelectTeam(champion.team_id)} className="font-bold hover:text-app-green">
                        {champion.team_name}
                      </button>
                      {note ? <span className="mt-0.5 block text-[10px] text-app-green">{note}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      {champion.runner_up_team_id && champion.runner_up_team_name ? (
                        <button type="button" onClick={() => onSelectTeam(champion.runner_up_team_id!)} className="font-semibold hover:text-app-green">
                          {champion.runner_up_team_name}
                        </button>
                      ) : "—"}
                    </td>
                    <HistoryAwardCell entry={goldenBoot} suffix={t("tournaments.awards.units.goals", { defaultValue: "goals" })} onSelectPlayer={onSelectPlayer} />
                    <HistoryAwardCell entry={assistKing} suffix={t("tournaments.awards.units.assists", { defaultValue: "assists" })} onSelectPlayer={onSelectPlayer} />
                    <HistoryAwardCell entry={playerOfYear} suffix={t("tournaments.awards.units.rating", { defaultValue: "rating" })} decimal onSelectPlayer={onSelectPlayer} />
                    <HistoryAwardCell entry={cleanSheetKing} suffix={t("tournaments.awards.units.cleanSheets", { defaultValue: "clean sheets" })} onSelectPlayer={onSelectPlayer} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TemplateCard>
    </div>
  );
}

function HistoryAwardCell({
  entry,
  suffix,
  decimal,
  onSelectPlayer,
}: {
  entry?: AwardEntry;
  suffix: string;
  decimal?: boolean;
  onSelectPlayer?: (id: string) => void;
}) {
  if (!entry) {
    return <td className="px-4 py-3 text-app-text-muted">—</td>;
  }

  return (
    <td className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSelectPlayer?.(entry.player_id)}
        className="block max-w-[180px] truncate font-semibold hover:text-app-green"
      >
        {entry.player_name}
      </button>
      <span className="text-[10px] text-app-text-muted">
        {decimal ? entry.value.toFixed(2) : entry.value} {suffix}
      </span>
    </td>
  );
}


function RecordsPanel({ records }: { records: GameRecords | null }) {
  const { t } = useTranslation();

  const hasAny =
    records &&
    Object.values(records).some((value) => value !== null && value !== undefined);

  if (!records || !hasAny) {
    return (
      <EmptyPanel
        icon={<Star className="h-8 w-8" />}
        title={t("tournaments.recordsEmptyTitle", { defaultValue: "No records yet" })}
        description={t("tournaments.recordsEmptyBody", {
          defaultValue: "All-time records build up as seasons are completed.",
        })}
      />
    );
  }

  const playerRows: Array<{ label: string; holder?: string | null; value?: number; season?: number }> = [
    { label: t("tournaments.recMostGoalsSeason", { defaultValue: "Most goals (season)" }), holder: records.most_goals_in_season?.player_name, value: records.most_goals_in_season?.value, season: records.most_goals_in_season?.season },
    { label: t("tournaments.recMostGoalsCareer", { defaultValue: "Most goals (career)" }), holder: records.most_career_goals?.player_name, value: records.most_career_goals?.value, season: records.most_career_goals?.season },
    { label: t("tournaments.recMostAssistsSeason", { defaultValue: "Most assists (season)" }), holder: records.most_assists_in_season?.player_name, value: records.most_assists_in_season?.value, season: records.most_assists_in_season?.season },
    { label: t("tournaments.recMostAssistsCareer", { defaultValue: "Most assists (career)" }), holder: records.most_career_assists?.player_name, value: records.most_career_assists?.value, season: records.most_career_assists?.season },
    { label: t("tournaments.recMostCleanSheetsSeason", { defaultValue: "Most clean sheets (season)" }), holder: records.most_clean_sheets_in_season?.player_name, value: records.most_clean_sheets_in_season?.value, season: records.most_clean_sheets_in_season?.season },
    { label: t("tournaments.recMostCleanSheetsCareer", { defaultValue: "Most clean sheets (career)" }), holder: records.most_career_clean_sheets?.player_name, value: records.most_career_clean_sheets?.value, season: records.most_career_clean_sheets?.season },
  ];

  const teamRows: Array<{ label: string; holder?: string | null; value?: number; season?: number }> = [
    { label: t("tournaments.recHighestPoints", { defaultValue: "Highest points (season)" }), holder: records.highest_points_in_season?.team_name, value: records.highest_points_in_season?.value, season: records.highest_points_in_season?.season },
    { label: t("tournaments.recMostGoalsTeam", { defaultValue: "Most goals by a team (season)" }), holder: records.most_goals_team_in_season?.team_name, value: records.most_goals_team_in_season?.value, season: records.most_goals_team_in_season?.season },
    { label: t("tournaments.recLongestUnbeaten", { defaultValue: "Longest unbeaten run" }), holder: records.longest_unbeaten_run?.team_name, value: records.longest_unbeaten_run?.value, season: records.longest_unbeaten_run?.season },
  ];

  const transfer = records.record_transfer_fee;

  return (
    <div className="flex flex-col gap-4 p-4">
      <RecordGroup title={t("tournaments.playerRecords", { defaultValue: "Player records" })} rows={playerRows} t={t} />
      <RecordGroup title={t("tournaments.teamRecords", { defaultValue: "Team records" })} rows={teamRows} t={t} />
      <div>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
          {t("tournaments.transferRecord", { defaultValue: "Transfer record" })}
        </h4>
        <TemplateCard className="flex items-center justify-between gap-3 p-4">
          {transfer ? (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-app-text">{transfer.player_name}</span>
                <span className="block truncate text-[11px] text-app-text-muted">
                  {transfer.from_team_name} → {transfer.to_team_name}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-heading text-sm font-bold tabular-nums text-app-green">
                  {formatExactMoney(transfer.fee)}
                </span>
                <span className="block text-[10px] text-app-text-muted">
                  {t("schedule.season", { number: transfer.season })}
                </span>
              </span>
            </>
          ) : (
            <span className="text-xs text-app-text-muted">—</span>
          )}
        </TemplateCard>
      </div>
    </div>
  );
}

function RecordGroup({
  title,
  rows,
  t,
}: {
  title: string;
  rows: Array<{ label: string; holder?: string | null; value?: number; season?: number }>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h4>
      <TemplateCard className="divide-y divide-app-border/30">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-xs text-app-text-muted">{row.label}</span>
            <span className="min-w-0 text-right">
              {row.holder ? (
                <>
                  <span className="block truncate text-sm font-bold text-app-text">
                    {row.holder} <span className="text-app-green">{row.value}</span>
                  </span>
                  {row.season ? (
                    <span className="block text-[10px] text-app-text-muted">
                      {t("schedule.season", { number: row.season })}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-app-text-muted">—</span>
              )}
            </span>
          </div>
        ))}
      </TemplateCard>
    </div>
  );
}

function HallOfFamePanel({
  retired,
  onSelectTeam,
}: {
  retired: RetiredPlayer[];
  onSelectTeam?: (teamId: string) => void;
}) {
  const { t } = useTranslation();

  const notableRetired = retired.filter((player) =>
    player.total_appearances >= 50 ||
    player.total_goals >= 25 ||
    player.total_assists >= 25 ||
    (player.total_appearances > 0 && player.peak_ovr >= 82),
  );

  if (notableRetired.length === 0) {
    return (
      <EmptyPanel
        icon={<History className="h-8 w-8" />}
        title={t("tournaments.hallOfFameEmptyTitle", { defaultValue: "No retirees yet" })}
        description={t("tournaments.hallOfFameEmptyBody", {
          defaultValue: "As seasons pass, legends hang up their boots and join the Hall of Fame.",
        })}
      />
    );
  }

  const sorted = [...notableRetired].sort(
    (a, b) => b.peak_ovr - a.peak_ovr || b.retired_season - a.retired_season,
  );

  return (
    <div className="flex flex-col gap-2 p-4">
      {sorted.map((player) => (
        <TemplateCard key={player.id} className="flex items-center justify-between gap-3 p-4">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-app-text">{player.full_name}</span>
            <span className="block truncate text-[11px] text-app-text-muted">
              {player.last_team_id && onSelectTeam ? (
                <button
                  type="button"
                  onClick={() => onSelectTeam(player.last_team_id)}
                  className="hover:text-app-green"
                >
                  {player.last_team_name}
                </button>
              ) : (
                player.last_team_name
              )}
              {" · "}
              {t("tournaments.hofRetiredAt", {
                defaultValue: "Retired {{season}}, age {{age}}",
                season: player.retired_season,
                age: player.age_at_retirement,
              })}
            </span>
            <span className="mt-0.5 block text-[11px] text-app-text-muted">
              {t("tournaments.hofCareerLine", {
                defaultValue: "{{apps}} apps · {{goals}} goals · {{assists}} assists",
                apps: player.total_appearances,
                goals: player.total_goals,
                assists: player.total_assists,
              })}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-center">
            <span className="font-heading text-lg font-bold tabular-nums text-app-green">{player.peak_ovr}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-app-text-muted">
              {t("tournaments.hofPeak", { defaultValue: "Peak" })}
            </span>
          </span>
        </TemplateCard>
      ))}
    </div>
  );
}

function GlobalLeaderboardsPanel({
  leaderboards,
  loadState,
  filters,
  seasonOptions,
  countryOptions,
  onFiltersChange,
  onSelectPlayer,
  onSelectTeam,
}: {
  leaderboards: GlobalPlayerLeaderboards | null;
  loadState: "idle" | "loading" | "error";
  filters: GlobalPlayerLeaderboardQuery;
  seasonOptions: number[];
  countryOptions: string[];
  onFiltersChange: (filters: GlobalPlayerLeaderboardQuery) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}) {
  const { t } = useTranslation();
  const updateFilter = (key: keyof GlobalPlayerLeaderboardQuery, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: key === "season" ? (value ? Number(value) : null) : value || null,
    });
  };
  const hasData = !!leaderboards && (
    leaderboards.top_scorers.length > 0 ||
    leaderboards.top_assists.length > 0 ||
    leaderboards.top_clean_sheets.length > 0 ||
    leaderboards.appearances.length > 0 ||
    leaderboards.minutes.length > 0 ||
    leaderboards.yellow_cards.length > 0 ||
    leaderboards.red_cards.length > 0 ||
    leaderboards.average_ratings.length > 0
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <TemplateCard className="p-4">
        <div className="mb-3">
          <p className="text-xs font-medium text-app-text-muted">
            {t("tournaments.globalLeaderboardsScope", { defaultValue: "Season totals across all selected competitions." })}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterSelect
            label={t("schedule.season", { number: "" }).trim() || "Season"}
            value={filters.season ? String(filters.season) : ""}
            onChange={(value) => updateFilter("season", value)}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              ...seasonOptions.map((season) => ({ value: String(season), label: String(season) })),
            ]}
          />
          <FilterSelect
            label={t("common.country", { defaultValue: "Country" })}
            value={filters.country ?? ""}
            onChange={(value) => updateFilter("country", value)}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              ...countryOptions.map((country) => ({ value: country, label: country })),
            ]}
          />
          <FilterSelect
            label={t("tournaments.competitionType", { defaultValue: "Competition type" })}
            value={filters.competition_type ?? ""}
            onChange={(value) => updateFilter("competition_type", value)}
            options={[
              { value: "", label: t("tournaments.allCompetitions", { defaultValue: "All competitions" }) },
              { value: "DomesticLeague", label: t("tournaments.domesticLeague", { defaultValue: "Domestic League" }) },
              { value: "DomesticCup", label: t("tournaments.domesticCup", { defaultValue: "Domestic Cup" }) },
              { value: "ContinentalLeague", label: t("tournaments.continental", { defaultValue: "Continental" }) },
            ]}
          />
          <FilterSelect
            label={t("common.position", { defaultValue: "Position" })}
            value={filters.position ?? ""}
            onChange={(value) => updateFilter("position", value)}
            options={[
              { value: "", label: t("common.all", { defaultValue: "All" }) },
              { value: "Goalkeeper", label: t("positions.goalkeeper", { defaultValue: "Goalkeeper" }) },
              { value: "Defender", label: t("positions.defender", { defaultValue: "Defender" }) },
              { value: "Midfielder", label: t("positions.midfielder", { defaultValue: "Midfielder" }) },
              { value: "Forward", label: t("positions.forward", { defaultValue: "Forward" }) },
            ]}
          />
        </div>
      </TemplateCard>

      {loadState === "loading" && !leaderboards ? (
        <div className="flex min-h-[240px] items-center justify-center p-8 text-sm text-app-text-muted">
          {t("tournaments.leaderboardsLoading", { defaultValue: "Loading leaderboards…" })}
        </div>
      ) : null}

      {loadState === "error" ? (
        <EmptyPanel
          icon={<ListOrdered className="h-8 w-8" />}
          title={t("common.error", { defaultValue: "Error" })}
          description={t("tournaments.globalLeaderboardsError", { defaultValue: "Could not load global player leaderboards." })}
        />
      ) : null}

      {loadState !== "error" && !hasData && loadState !== "loading" ? (
        <EmptyPanel
          icon={<Users className="h-8 w-8" />}
          title={t("tournaments.globalLeaderboardsEmptyTitle", { defaultValue: "No global leaderboard data" })}
          description={t("tournaments.globalLeaderboardsEmptyBody", { defaultValue: "No detailed player match stats were found for these filters." })}
        />
      ) : null}

      {hasData && leaderboards ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LeaderboardColumn title={t("tournaments.lbTopScorers", { defaultValue: "Top Scorers" })} unit={t("tournaments.lbGoals", { defaultValue: "Goals" })} entries={leaderboards.top_scorers} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbTopAssists", { defaultValue: "Top Assists" })} unit={t("tournaments.lbAssists", { defaultValue: "Assists" })} entries={leaderboards.top_assists} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <RatingLeaderboardColumn title={t("tournaments.lbAverageRating", { defaultValue: "Average Rating" })} entries={leaderboards.average_ratings} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbTopCleanSheets", { defaultValue: "Clean Sheets" })} unit={t("tournaments.lbCleanSheets", { defaultValue: "Clean sheets" })} entries={leaderboards.top_clean_sheets} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbAppearances", { defaultValue: "Appearances" })} unit={t("tournaments.lbApps", { defaultValue: "Apps" })} entries={leaderboards.appearances} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbMinutes", { defaultValue: "Minutes" })} unit={t("tournaments.lbMins", { defaultValue: "Mins" })} entries={leaderboards.minutes} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbYellowCards", { defaultValue: "Yellow Cards" })} unit={t("tournaments.lbCards", { defaultValue: "Cards" })} entries={leaderboards.yellow_cards} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
          <LeaderboardColumn title={t("tournaments.lbRedCards", { defaultValue: "Red Cards" })} unit={t("tournaments.lbCards", { defaultValue: "Cards" })} entries={leaderboards.red_cards} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-bold text-app-text outline-none transition-colors hover:border-app-green/50 focus:border-app-green"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value} className="bg-app-bg text-app-text">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RatingLeaderboardColumn({
  title,
  entries,
  onSelectPlayer,
  onSelectTeam,
}: {
  title: string;
  entries: RatingLeaderboardEntry[];
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
        <span>{title}</span>
        <span>Rating</span>
      </h4>
      <TemplateCard className="divide-y divide-app-border/30">
        {entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-app-text-muted">—</div>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.player_id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-app-text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelectPlayer?.(entry.player_id)}
                  className="block truncate text-left text-sm font-bold text-app-text hover:text-app-green"
                >
                  {entry.player_name}
                </button>
                <button
                  type="button"
                  onClick={() => entry.team_id && onSelectTeam(entry.team_id)}
                  className="block truncate text-left text-[11px] text-app-text-muted hover:text-app-green"
                >
                  {entry.team_name} · {entry.appearances} apps
                </button>
              </span>
              <span className="shrink-0 font-heading text-sm font-bold tabular-nums text-app-green">
                {entry.value.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </TemplateCard>
    </div>
  );
}

function LeaderboardsPanel({
  leaderboards,
  loadState,
  onSelectPlayer,
  onSelectTeam,
  onViewGlobal,
}: {
  leaderboards: CompetitionLeaderboards | null;
  loadState: "idle" | "loading" | "error";
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
  onViewGlobal: () => void;
}) {
  const { t } = useTranslation();

  if (!leaderboards && loadState === "loading") {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-8 text-sm text-app-text-muted">
        {t("tournaments.leaderboardsLoading", { defaultValue: "Loading leaderboards…" })}
      </div>
    );
  }

  const hasData =
    !!leaderboards &&
    (leaderboards.top_scorers.length > 0 ||
      leaderboards.top_assists.length > 0 ||
      leaderboards.top_clean_sheets.length > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onViewGlobal}
            className="rounded-lg border border-app-green/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/10"
          >
            {t("tournaments.viewGlobalLeaderboard", { defaultValue: "View Global Leaderboard" })}
          </button>
        </div>
        <EmptyPanel
          icon={<ListOrdered className="h-8 w-8" />}
          title={t("tournaments.leaderboardsEmptyTitle", { defaultValue: "No leaderboard data yet" })}
          description={t("tournaments.leaderboardsEmptyBody", {
            defaultValue: "Detailed player leaderboards fill in when this competition has recorded player match stats.",
          })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onViewGlobal}
          className="rounded-lg border border-app-green/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/10"
        >
          {t("tournaments.viewGlobalLeaderboard", { defaultValue: "View Global Leaderboard" })}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <LeaderboardColumn
        title={t("tournaments.lbTopScorers", { defaultValue: "Top Scorers" })}
        unit={t("tournaments.lbGoals", { defaultValue: "Goals" })}
        entries={leaderboards.top_scorers}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={onSelectTeam}
      />
      <LeaderboardColumn
        title={t("tournaments.lbTopAssists", { defaultValue: "Top Assists" })}
        unit={t("tournaments.lbAssists", { defaultValue: "Assists" })}
        entries={leaderboards.top_assists}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={onSelectTeam}
      />
      <LeaderboardColumn
        title={t("tournaments.lbTopCleanSheets", { defaultValue: "Clean Sheets" })}
        unit={t("tournaments.lbCleanSheets", { defaultValue: "Clean sheets" })}
        entries={leaderboards.top_clean_sheets}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={onSelectTeam}
      />
      </div>
    </div>
  );
}

function LeaderboardColumn({
  title,
  unit,
  entries,
  onSelectPlayer,
  onSelectTeam,
}: {
  title: string;
  unit: string;
  entries: LeaderboardEntry[];
  onSelectPlayer?: (id: string) => void;
  onSelectTeam: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
        <span>{title}</span>
        <span>{unit}</span>
      </h4>
      <TemplateCard className="divide-y divide-app-border/30">
        {entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-app-text-muted">—</div>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.player_id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-app-text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelectPlayer?.(entry.player_id)}
                  className="block truncate text-left text-sm font-bold text-app-text hover:text-app-green"
                >
                  {entry.player_name}
                </button>
                <button
                  type="button"
                  onClick={() => entry.team_id && onSelectTeam(entry.team_id)}
                  className="block truncate text-left text-[11px] text-app-text-muted hover:text-app-green"
                >
                  {entry.team_name}
                </button>
              </span>
              <span className="shrink-0 font-heading text-sm font-bold tabular-nums text-app-green">
                {entry.value}
              </span>
            </div>
          ))
        )}
      </TemplateCard>
    </div>
  );
}
