import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore, GameStateData, PlayerData } from "../store/gameStore";
import { TeamData } from "../store/types";
import { formatVal, getPlayerOvr, positionBadgeVariant } from "../lib/helpers";
import { getTeamLogoUrl } from "../lib/teamLogos";
import { positionCode, translatePositionAbbreviation } from "../components/squad/SquadTab.helpers";
import { Card, CardBody, Badge, TeamLocation, ThemeToggle, CountryFlag } from "../components/ui";
import DivisionLogo from "../components/common/DivisionLogo";
import TeamLogo from "../components/common/TeamLogo";
import { ArrowLeft, Users, Trophy, Landmark, ChevronRight, Star, Loader2, Search, ArrowUpDown, X } from "lucide-react";
import { resolveBackendError } from "../utils/backendI18n";

type WorldCupCallupCandidate = {
  id: string;
  full_name: string;
  match_name: string;
  position: string;
  alternate_positions: string[];
  ovr: number;
  age: number;
  club: string;
  nationality: string;
};

type CallupSortKey = "selected" | "name" | "position" | "ovr" | "age" | "nationality" | "club";

const CALLUP_SQUAD_SIZE = 26;
const CALLUP_MIN_GOALKEEPERS = 3;
const CALLUP_PAGE_SIZE = 50;
const WORLDCUP_LOGO_SRC = "/images/wc26/WC2026.svg";
const WORLDCUP_LOGOS: Record<string, string> = {
  AFC: "/images/wc26/AFC.svg",
  CAF: "/images/wc26/CAF.svg",
  CONCACAF: "/images/wc26/CONCACAF.svg",
  CONMEBOL: "/images/wc26/CONMEBOL.svg",
  OFC: "/images/wc26/OFC.svg",
  UEFA: "/images/wc26/UEFA.svg",
  WC2026: WORLDCUP_LOGO_SRC,
};

export default function TeamSelection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { gameState, setGameState, setGameActive } = useGameStore();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [callupPool, setCallupPool] = useState<WorldCupCallupCandidate[] | null>(null);
  const [selectedCallupIds, setSelectedCallupIds] = useState<Set<string>>(new Set());
  const [callupFilter, setCallupFilter] = useState<CallupPositionGroup | "ALL">("ALL");
  const [callupSearch, setCallupSearch] = useState("");
  const [callupPage, setCallupPage] = useState(1);
  const [callupSortKey, setCallupSortKey] = useState<CallupSortKey>("ovr");
  const [callupSortAsc, setCallupSortAsc] = useState(false);
  const [profileCallupPlayer, setProfileCallupPlayer] = useState<WorldCupCallupCandidate | null>(null);

  if (!gameState) {
    navigate("/");
    return null;
  }

  const teams = gameState.teams;
  const isWorldCupFc26 = gameState.world_source === "worldcup2026_fc26";
  const isWorldCupMode = isWorldCupFc26 || gameState.world_source === "worldcup2026";
  const countryGroups = useMemo(() => groupTeamsByCountryAndTier(teams, isWorldCupMode), [teams, isWorldCupMode]);
  const selectedCountryGroup = countryGroups.find((group) => group.country === selectedCountry) ?? null;
  const selectedTierGroup = selectedCountryGroup?.tiers.find((group) => group.tier === selectedTier) ?? null;
  const worldCupTeams = selectedCountryGroup?.tiers.flatMap((group) => group.teams) ?? [];
  const showClubDivisions = Boolean(selectedCountryGroup && !selectedTierGroup && !isWorldCupMode);
  const showClubTeams = Boolean(selectedTierGroup && !isWorldCupMode);
  const showWorldCupTeams = Boolean(selectedCountryGroup && isWorldCupMode);
  const selectedCallupCount = selectedCallupIds.size;
  const selectedGoalkeeperCount = callupPool?.filter((player) => selectedCallupIds.has(player.id) && getCallupPositionGroup(player.position) === "GK").length ?? 0;
  const filteredCallupPool = useMemo(
    () => sortCallupCandidates(
      callupPool?.filter((player) => {
        if (callupFilter !== "ALL" && getCallupPositionGroup(player.position) !== callupFilter) return false;
        return matchesCallupSearch(player, callupSearch);
      }) ?? [],
      selectedCallupIds,
      callupSortKey,
      callupSortAsc,
    ),
    [callupFilter, callupPool, callupSearch, callupSortAsc, callupSortKey, selectedCallupIds],
  );
  const callupTotalPages = Math.max(1, Math.ceil(filteredCallupPool.length / CALLUP_PAGE_SIZE));
  const safeCallupPage = Math.min(callupPage, callupTotalPages);
  const visibleCallupPool = filteredCallupPool.slice((safeCallupPage - 1) * CALLUP_PAGE_SIZE, safeCallupPage * CALLUP_PAGE_SIZE);
  const canConfirmCallups = selectedCallupCount === CALLUP_SQUAD_SIZE && selectedGoalkeeperCount >= CALLUP_MIN_GOALKEEPERS;

  useEffect(() => {
    setCallupPage(1);
  }, [callupFilter, callupSearch, callupSortAsc, callupSortKey]);

  const getTeamPlayers = (teamId: string): PlayerData[] =>
    gameState.players.filter((p) => p.team_id === teamId);

  const getTeamAvgOvr = (teamId: string): number => {
    const players = getTeamPlayers(teamId);
    if (players.length === 0) return 0;
    const total = players.reduce((sum, player) => sum + getPlayerOvr(player), 0);
    return Math.round(total / players.length);
  };

  const getReputationLabel = (rep: number): { label: string; variant: "primary" | "accent" | "success" | "danger" | "neutral" } => {
    if (rep >= 750) return { label: t('teamSelect.repWorldClass'), variant: "accent" };
    if (rep >= 600) return { label: t('teamSelect.repStrong'), variant: "success" };
    if (rep >= 400) return { label: t('teamSelect.repAverage'), variant: "neutral" };
    return { label: t('teamSelect.repDeveloping'), variant: "danger" };
  };

  const resetToCountries = () => {
    setSelectedCountry(null);
    setSelectedTier(null);
    setSelectedTeamId(null);
  };

  const resetToDivisions = () => {
    setSelectedTier(null);
    setSelectedTeamId(null);
  };

  const completeTeamSelection = (updatedGame: GameStateData) => {
    setGameState(updatedGame);
    const mgr = updatedGame.manager;
    setGameActive(true, `${mgr.first_name} ${mgr.last_name}`);
    navigate("/dashboard");
  };

  const selectTeamWithCallups = async (teamId: string, selectedPlayerIds: string[]) => {
    const updatedGame = await invoke<GameStateData>("select_worldcup_team_with_callups", {
      teamId,
      selectedPlayerIds,
    });
    completeTeamSelection(updatedGame);
  };

  const handleConfirm = async () => {
    if (!selectedTeamId || isConfirming) return;
    setIsConfirming(true);
    try {
      if (isWorldCupFc26) {
        const pool = await invoke<WorldCupCallupCandidate[]>("get_worldcup_callup_pool", { teamId: selectedTeamId });
        const initialSelectedIds = new Set(pool.slice(0, CALLUP_SQUAD_SIZE).map((player) => player.id));
        if (pool.length <= CALLUP_SQUAD_SIZE) {
          await selectTeamWithCallups(selectedTeamId, pool.map((player) => player.id));
          return;
        }
        setCallupPool(pool);
        setSelectedCallupIds(initialSelectedIds);
        setCallupFilter("ALL");
        setCallupSearch("");
        setCallupPage(1);
        setProfileCallupPlayer(null);
        return;
      }

      const updatedGame = await invoke<GameStateData>("select_team", { teamId: selectedTeamId });
      completeTeamSelection(updatedGame);
    } catch (error) {
      console.error("Failed to select team:", error);
      alert(
        t("teamSelect.failedToSelectTeam", {
          error: resolveBackendError(error),
        }),
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCallupConfirm = async () => {
    if (!selectedTeamId || !callupPool || !canConfirmCallups || isConfirming) return;
    setIsConfirming(true);
    try {
      await selectTeamWithCallups(selectedTeamId, Array.from(selectedCallupIds));
    } catch (error) {
      console.error("Failed to confirm call-ups:", error);
      alert(
        t("teamSelect.failedToSelectTeam", {
          error: resolveBackendError(error),
        }),
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCallupSort = (sortKey: CallupSortKey) => {
    if (callupSortKey === sortKey) {
      setCallupSortAsc((current) => !current);
      return;
    }
    setCallupSortKey(sortKey);
    setCallupSortAsc(sortKey === "name" || sortKey === "position" || sortKey === "nationality" || sortKey === "club");
  };

  const toggleCallupPlayer = (playerId: string) => {
    setSelectedCallupIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else if (next.size < CALLUP_SQUAD_SIZE) {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-surface-900 transition-colors duration-300">
      <header className="bg-white dark:bg-surface-800 border-b border-gray-200 dark:border-surface-700 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {isWorldCupMode && (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200">
                <img src={WORLDCUP_LOGO_SRC} alt="World Cup 2026" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
                {isWorldCupMode ? "World Cup 2026" : t('teamSelect.title')}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isWorldCupMode
                  ? selectedCountryGroup
                    ? `Choose a national team from ${selectedCountryGroup.country}`
                    : "Choose a confederation to narrow down World Cup 2026"
                  : selectedTierGroup
                    ? `Choose a club from ${selectedTierGroup.leagueName}`
                    : selectedCountryGroup
                      ? `Choose a division in ${selectedCountryGroup.country}`
                      : "Choose a country to narrow down the football world"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {selectedTeam && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2.5 rounded-lg font-heading font-bold uppercase tracking-wider text-sm shadow-md hover:shadow-lg hover:shadow-primary-500/20 transition-all flex items-center gap-2 ${isConfirming ? "opacity-70 cursor-wait" : ""}`}
            >
              <span>{isConfirming ? t('teamSelect.confirming') : t('teamSelect.manage', { name: selectedTeam.short_name })}</span>
              {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <SelectionSteps
          country={selectedCountryGroup?.country ?? null}
          division={isWorldCupMode ? null : selectedTierGroup?.leagueName ?? null}
          team={selectedTeam?.name ?? null}
          countryLabel={isWorldCupMode ? "Confederation" : "Country"}
          divisionLabel="Division"
          teamLabel={isWorldCupMode ? "National team" : "Team"}
          includeDivision={!isWorldCupMode}
          showWorldCupLogo={isWorldCupMode}
          onCountryClick={resetToCountries}
          onDivisionClick={resetToDivisions}
        />

        {!selectedCountryGroup && (
          <section className="space-y-4">
            <SectionHeading
              eyebrow="Step 1"
              title={isWorldCupMode ? "Choose confederation" : "Choose country"}
              subtitle={isWorldCupMode ? "Start with a World Cup region, then pick your national team." : "Start broad, then drill into the league pyramid."}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {countryGroups.map((countryGroup) => (
                <button key={countryGroup.country} onClick={() => setSelectedCountry(countryGroup.country)} className="text-left rounded-2xl transition hover:-translate-y-0.5">
                  <Card className="h-full overflow-hidden !bg-white dark:!bg-app-card" accent="none">
                    <CardBody className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          {isWorldCupMode ? (
                            <WorldCupLogoMark name={countryGroup.country} className="h-14 w-20 rounded-xl" />
                          ) : (
                            <div className="flex h-11 w-14 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-surface-700 dark:ring-surface-600">
                              <CountryFlag code={COUNTRY_FLAG_CODES[countryGroup.country] ?? countryGroup.country} locale={i18n.language} className="text-2xl" />
                            </div>
                          )}
                          <div>
                            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                              {countryGroup.country}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {isWorldCupMode
                                ? `${countryGroup.teamCount} national teams`
                                : `${countryGroup.teamCount} clubs across ${countryGroup.tiers.length} division${countryGroup.tiers.length === 1 ? "" : "s"}`}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {countryGroup.tiers.map((tier) => (
                          <Badge key={tier.tier} variant="neutral" size="sm">
                            {tier.leagueName}
                          </Badge>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedCountryGroup && showClubDivisions && (
          <section className="space-y-4">
            <SectionHeading
              eyebrow="Step 2"
              title={isWorldCupMode ? "Choose group" : "Choose division"}
              subtitle={isWorldCupMode ? `Pick from ${selectedCountryGroup.country} World Cup teams.` : `Pick which level of ${selectedCountryGroup.country} football you want to manage in.`}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {selectedCountryGroup.tiers.map((tierGroup) => (
                <button key={tierGroup.tier} onClick={() => setSelectedTier(tierGroup.tier)} className="text-left rounded-2xl transition hover:-translate-y-0.5">
                  <Card className="h-full !bg-white dark:!bg-app-card" accent="none">
                    <CardBody className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <DivisionLogo country={selectedCountryGroup.country} leagueName={tierGroup.leagueName} />
                          <div>
                            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400">
                              {isWorldCupMode ? "World Cup" : `Tier ${tierGroup.tier}`}
                            </p>
                            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                              {tierGroup.leagueName}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {isWorldCupMode ? `${tierGroup.teams.length} national teams` : `${tierGroup.teams.length} playable clubs`}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </CardBody>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        )}

        {callupPool && selectedTeam ? (
          <>
            <CallupSelectionPanel
              team={selectedTeam}
              pool={visibleCallupPool}
            allPool={callupPool}
            filteredCount={filteredCallupPool.length}
            page={safeCallupPage}
            totalPages={callupTotalPages}
            filter={callupFilter}
            search={callupSearch}
            selectedIds={selectedCallupIds}
            selectedCount={selectedCallupCount}
            goalkeeperCount={selectedGoalkeeperCount}
            sortKey={callupSortKey}
            sortAsc={callupSortAsc}
            locale={i18n.language}
            canConfirm={canConfirmCallups}
            isConfirming={isConfirming}
            onSearchChange={setCallupSearch}
            onPageChange={setCallupPage}
            onFilterChange={setCallupFilter}
            onSort={handleCallupSort}
            onTogglePlayer={toggleCallupPlayer}
            onSelectPlayer={setProfileCallupPlayer}
            onBack={() => {
              setCallupPool(null);
              setCallupSearch("");
              setCallupPage(1);
              setProfileCallupPlayer(null);
            }}
            onConfirm={handleCallupConfirm}
          />
            {profileCallupPlayer && (
              <CallupPlayerDetailModal
                player={profileCallupPlayer}
                locale={i18n.language}
                onClose={() => setProfileCallupPlayer(null)}
              />
            )}
          </>
        ) : (showClubTeams || showWorldCupTeams) && (
          <section className="space-y-4">
            <SectionHeading
              eyebrow={isWorldCupMode ? "Step 2" : "Step 3"}
              title={isWorldCupMode ? "Choose national team" : "Choose team"}
              subtitle={isWorldCupMode ? `Select your ${selectedCountryGroup?.country} country for World Cup 2026.` : `Select your club in ${selectedTierGroup?.leagueName}.`}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(isWorldCupMode ? worldCupTeams : selectedTierGroup?.teams ?? []).map((team) => {
                const isSelected = selectedTeamId === team.id;
                const avgOvr = getTeamAvgOvr(team.id);
                const repInfo = getReputationLabel(team.reputation);
                const playerCount = getTeamPlayers(team.id).length;

                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`text-left transition-all duration-200 rounded-xl ${isSelected
                      ? "ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-surface-900 scale-[1.02]"
                      : "hover:scale-[1.01]"
                      }`}
                  >
                    <Card accent={isSelected ? "primary" : "none"} className="h-full !bg-white dark:!bg-app-card">
                      <div className={`p-4 rounded-t-xl ${isSelected
                        ? "bg-gradient-to-r from-primary-600 to-primary-700"
                        : "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-surface-700 dark:to-surface-800"
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isWorldCupMode ? (
                              <NationalTeamFlagLogo team={team} selected={isSelected} locale={i18n.language} />
                            ) : (
                              <TeamLogo team={team} selected={isSelected} />
                            )}
                            <div>
                              <h3 className={`font-heading font-bold uppercase tracking-wide text-sm ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                                {team.name}
                              </h3>
                              <TeamLocation
                                city={team.city}
                                countryCode={team.country}
                                locale={i18n.language}
                                className={`mt-0.5 text-xs ${isSelected ? "text-gray-300" : "text-gray-500 dark:text-gray-300"}`}
                                iconClassName="w-3 h-3"
                                flagClassName="text-xs leading-none"
                              />
                            </div>
                          </div>
                          {isSelected && <Star className="w-5 h-5 text-accent-400 fill-current" />}
                        </div>
                      </div>

                      <CardBody className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <StatItem icon={<Trophy className="w-3.5 h-3.5" />} label={t('teamSelect.reputation')} value={<Badge variant={repInfo.variant} size="sm">{repInfo.label}</Badge>} />
                          <StatItem icon={<Users className="w-3.5 h-3.5" />} label={t('teamSelect.squad')} value={<span className="font-heading font-bold text-gray-800 dark:text-gray-200">{playerCount}</span>} />
                          <StatItem icon={<Landmark className="w-3.5 h-3.5" />} label={t('teamSelect.finances')} value={<span className="font-heading font-bold text-gray-800 dark:text-gray-200">{formatVal(team.finance)}</span>} />
                          <StatItem
                            icon={<Star className="w-3.5 h-3.5" />}
                            label={t('teamSelect.avgOvr')}
                            value={
                              <span className={`font-heading font-bold text-lg ${avgOvr >= 70 ? "text-primary-500" : avgOvr >= 55 ? "text-accent-600 dark:text-accent-400" : "text-gray-500"}`}>
                                {avgOvr}
                              </span>
                            }
                          />
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-surface-600">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {t('teamSelect.seats', { name: team.stadium_name, capacity: team.stadium_capacity.toLocaleString() })}
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

type CallupPositionGroup = "GK" | "DEF" | "MID" | "FWD";

function CallupSelectionPanel({
  team,
  pool,
  allPool,
  filteredCount,
  page,
  totalPages,
  filter,
  search,
  selectedIds,
  selectedCount,
  goalkeeperCount,
  sortKey,
  sortAsc,
  locale,
  canConfirm,
  isConfirming,
  onSearchChange,
  onPageChange,
  onFilterChange,
  onSort,
  onTogglePlayer,
  onSelectPlayer,
  onBack,
  onConfirm,
}: {
  team: TeamData;
  pool: WorldCupCallupCandidate[];
  allPool: WorldCupCallupCandidate[];
  filteredCount: number;
  page: number;
  totalPages: number;
  filter: CallupPositionGroup | "ALL";
  search: string;
  selectedIds: Set<string>;
  selectedCount: number;
  goalkeeperCount: number;
  sortKey: CallupSortKey;
  sortAsc: boolean;
  locale: string;
  canConfirm: boolean;
  isConfirming: boolean;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onFilterChange: (filter: CallupPositionGroup | "ALL") => void;
  onSort: (sortKey: CallupSortKey) => void;
  onTogglePlayer: (playerId: string) => void;
  onSelectPlayer: (player: WorldCupCallupCandidate) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const groupCounts = getCallupGroupCounts(allPool, selectedIds);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary-200 bg-white p-5 shadow-sm dark:border-primary-700/60 dark:bg-surface-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-200">
            <CountryFlag code={team.country} locale={locale} className="text-3xl leading-none" />
          </div>
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.24em] text-primary-600 dark:text-primary-400">World Cup call-up</p>
            <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">Select {team.name}'s 26-player squad</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pick exactly 26 players with at least 3 goalkeepers before starting the tournament.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={selectedCount === CALLUP_SQUAD_SIZE ? "success" : "primary"} size="md">
            {selectedCount} / {CALLUP_SQUAD_SIZE} selected
          </Badge>
          <Badge variant={goalkeeperCount >= CALLUP_MIN_GOALKEEPERS ? "success" : "danger"} size="md">
            {goalkeeperCount} GK
          </Badge>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-heading font-bold uppercase tracking-wide text-gray-600 transition hover:border-primary-400 hover:text-primary-600 dark:border-surface-600 dark:text-gray-300"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isConfirming}
            className={`rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2 text-sm font-heading font-bold uppercase tracking-wide text-white shadow-md transition hover:from-primary-600 hover:to-primary-700 ${!canConfirm || isConfirming ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {isConfirming ? "Starting..." : "Confirm squad"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="!bg-white dark:!bg-app-card" accent="none">
          <CardBody className="p-4">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400">Position guide</p>
            <div className="mt-4 space-y-2">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => onFilterChange(group)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${filter === group ? "border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-500/10 dark:text-primary-200" : "border-gray-200 text-gray-600 hover:border-primary-300 dark:border-surface-600 dark:text-gray-300"}`}
                >
                  <span className="font-heading font-bold uppercase tracking-wide">{group === "ALL" ? "All" : group}</span>
                  <Badge variant="neutral" size="sm">
                    {group === "ALL" ? selectedCount : groupCounts[group].selected} / {group === "ALL" ? allPool.length : groupCounts[group].total}
                  </Badge>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-surface-900 dark:text-gray-400">
              Recommended balance: 3 GK, 8 DEF, 8 MID, 7 FWD. Only the goalkeeper minimum is strict.
            </div>
          </CardBody>
        </Card>

        <Card className="!bg-white dark:!bg-app-card" accent="none">
          <CardBody className="p-0">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-surface-700 md:flex-row md:items-center md:justify-between">
              <label className="relative block w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search name, club, nation or position..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 focus:bg-white dark:border-surface-600 dark:bg-surface-900 dark:text-gray-100 dark:focus:border-primary-500"
                />
              </label>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <p className="text-sm text-gray-500 dark:text-gray-400">Showing {pool.length} of {filteredCount} candidates.</p>
                <Badge variant="neutral" size="sm">{sortKey.toUpperCase()} {sortAsc ? "ASC" : "DESC"}</Badge>
              </div>
            </div>
            <div className="max-h-[620px] overflow-auto custom-scrollbar">
              <table className="w-full min-w-[980px] table-fixed whitespace-nowrap text-left text-[11px]">
                <CallupColGroup />
                <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted shadow-sm">
                  <tr>
                    <CallupSortHeader label="Pick" sortKey="selected" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                    <CallupSortHeader label="Player" sortKey="name" current={sortKey} asc={sortAsc} onClick={onSort} />
                    <CallupSortHeader label="Pos" sortKey="position" current={sortKey} asc={sortAsc} onClick={onSort} />
                    <CallupSortHeader label="OVR" sortKey="ovr" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                    <CallupSortHeader label="Age" sortKey="age" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                    <CallupSortHeader label="Nat" sortKey="nationality" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                    <CallupSortHeader label="Club" sortKey="club" current={sortKey} asc={sortAsc} onClick={onSort} />
                    <th className="px-3 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30 text-app-text">
                  {pool.map((player) => {
                    const selected = selectedIds.has(player.id);
                    const disabled = !selected && selectedCount >= CALLUP_SQUAD_SIZE;

                    return (
                      <tr key={player.id} className={`transition-colors ${selected ? "bg-primary-50/70 dark:bg-primary-500/10" : "bg-white hover:bg-gray-50 dark:bg-app-card dark:hover:bg-white/5"}`}>
                        <td className="px-3 py-2.5 text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => onTogglePlayer(player.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Select ${player.full_name}`}
                            />
                          </label>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectPlayer(player)}
                            className="block min-w-0 text-left"
                          >
                            <span className="block truncate font-heading font-bold uppercase tracking-wide text-gray-900 transition hover:text-primary-600 dark:text-gray-100 dark:hover:text-primary-300">{player.match_name || player.full_name}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <CallupPositionCell player={player} />
                        </td>
                        <td className="px-3 py-2.5 text-center font-heading text-base font-bold text-primary-600 dark:text-primary-300">{player.ovr}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-gray-600 dark:text-gray-300">{player.age}</td>
                        <td className="px-3 py-2.5 text-center" title={player.nationality}>
                          <CountryFlag code={player.nationality} locale={locale} className="text-lg leading-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <CallupClubCell club={player.club} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {selected ? <Badge variant="success" size="sm">Selected</Badge> : disabled ? <Badge variant="neutral" size="sm">Squad full</Badge> : <span className="text-[10px] text-app-text-muted">Available</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-100 p-4 text-xs text-gray-500 dark:border-surface-700 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredCount === 0 ? 0 : (page - 1) * CALLUP_PAGE_SIZE + 1}-{Math.min(page * CALLUP_PAGE_SIZE, filteredCount)} of {filteredCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-heading font-bold uppercase tracking-wide text-gray-600 transition hover:border-primary-400 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-surface-600 dark:text-gray-300"
                >
                  Prev
                </button>
                <span className="font-heading font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-heading font-bold uppercase tracking-wide text-gray-600 transition hover:border-primary-400 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-surface-600 dark:text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function CallupClubCell({ club }: { club: string }) {
  const clubName = club || "Free agent";
  const logoUrl = club ? getTeamLogoUrl({ name: club, country: "", domestic_tier: undefined }) : null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {logoUrl && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-app-border bg-white/95 p-0.5">
          <img src={logoUrl} alt={`${clubName} logo`} className="h-full w-full object-contain" loading="lazy" />
        </span>
      )}
      <span className="block truncate text-gray-600 dark:text-gray-300">{clubName}</span>
    </div>
  );
}

function CallupPositionCell({ player }: { player: WorldCupCallupCandidate }) {
  const primary = translatePositionAbbreviation((_, options) => options?.defaultValue ?? "", player.position);
  const alternates = [...new Set((player.alternate_positions || []).map(positionCode).filter((code) => code && code !== primary))];

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Badge variant={positionBadgeVariant(player.position)} size="sm">{primary}</Badge>
      {alternates.length > 0 && (
        <span className="truncate text-[10px] font-bold text-app-text-muted">({alternates.join(", ")})</span>
      )}
    </div>
  );
}

function CallupPlayerDetailModal({ player, locale, onClose }: { player: WorldCupCallupCandidate; locale: string; onClose: () => void }) {
  const primary = translatePositionAbbreviation((_, options) => options?.defaultValue ?? "", player.position);
  const alternates = [...new Set((player.alternate_positions || []).map(positionCode).filter((code) => code && code !== primary))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-surface-700">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-200">
              <CountryFlag code={player.nationality} locale={locale} className="text-3xl leading-none" />
            </div>
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.24em] text-primary-600 dark:text-primary-400">Player detail</p>
              <h3 className="font-heading text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{player.match_name || player.full_name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{player.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-surface-700 dark:hover:text-gray-100"
            aria-label="Close player detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <CallupProfileStat label="OVR" value={player.ovr} highlight />
          <CallupProfileStat label="Age" value={player.age} />
          <CallupProfileStat label="Position" value={alternates.length > 0 ? `${primary} (${alternates.join(", ")})` : primary} />
          <CallupProfileStat label="Nation" value={<CountryFlag code={player.nationality} locale={locale} className="text-xl leading-none" />} />
        </div>
        <div className="border-t border-gray-100 p-5 dark:border-surface-700">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400">Club</p>
          <p className="mt-1 font-heading text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{player.club || "Free agent"}</p>
        </div>
      </div>
    </div>
  );
}

function CallupProfileStat({ label, value, highlight = false }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-surface-700 dark:bg-surface-900">
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <div className={`mt-1 font-heading text-xl font-bold uppercase tracking-wide ${highlight ? "text-primary-600 dark:text-primary-300" : "text-gray-900 dark:text-gray-100"}`}>{value}</div>
    </div>
  );
}

function WorldCupLogoMark({ name, className }: { name: string; className: string }) {
  const src = WORLDCUP_LOGOS[name] ?? WORLDCUP_LOGO_SRC;

  return (
    <div className={`flex shrink-0 items-center justify-center bg-white p-1.5 shadow-sm ring-1 ring-gray-200 ${className}`}>
      <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function NationalTeamFlagLogo({ team, selected, locale }: { team: TeamData; selected: boolean; locale: string }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl p-1.5 shadow-sm ring-1 ${
        selected
          ? "bg-white/95 ring-white/40"
          : "bg-white ring-gray-200 dark:bg-surface-700 dark:ring-surface-600"
      }`}
    >
      <CountryFlag code={team.country} locale={locale} className="text-3xl leading-none" />
    </div>
  );
}

function CallupColGroup() {
  return (
    <colgroup>
      <col className="w-[72px]" />
      <col className="w-[250px]" />
      <col className="w-[150px]" />
      <col className="w-[72px]" />
      <col className="w-[72px]" />
      <col className="w-[72px]" />
      <col className="w-[220px]" />
      <col className="w-[120px]" />
    </colgroup>
  );
}

function CallupSortHeader({
  label,
  sortKey,
  current,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: CallupSortKey;
  current: CallupSortKey;
  asc: boolean;
  onClick: (sortKey: CallupSortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = current === sortKey;

  return (
    <th className={`${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} px-3 py-3`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-primary-500 ${
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
        } ${isActive ? "text-primary-500" : "text-app-text-muted"}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}

function matchesCallupSearch(player: WorldCupCallupCandidate, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [
    player.full_name,
    player.match_name,
    player.nationality,
    player.club,
    positionCode(player.position),
    ...player.alternate_positions.map(positionCode),
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function sortCallupCandidates(
  players: WorldCupCallupCandidate[],
  selectedIds: Set<string>,
  sortKey: CallupSortKey,
  sortAsc: boolean,
) {
  const sorted = [...players].sort((left, right) => {
    let cmp = 0;
    switch (sortKey) {
      case "selected":
        cmp = Number(selectedIds.has(left.id)) - Number(selectedIds.has(right.id));
        break;
      case "name":
        cmp = (left.match_name || left.full_name).localeCompare(right.match_name || right.full_name);
        break;
      case "position":
        cmp = compareCallupPosition(left.position, right.position);
        break;
      case "ovr":
        cmp = left.ovr - right.ovr;
        break;
      case "age":
        cmp = left.age - right.age;
        break;
      case "nationality":
        cmp = left.nationality.localeCompare(right.nationality);
        break;
      case "club":
        cmp = (left.club || "Free agent").localeCompare(right.club || "Free agent");
        break;
    }

    return sortAsc ? cmp : -cmp;
  });

  return sorted;
}

function compareCallupPosition(left: string, right: string) {
  const groupOrder: Record<CallupPositionGroup, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
  const groupCmp = groupOrder[getCallupPositionGroup(left)] - groupOrder[getCallupPositionGroup(right)];
  return groupCmp || left.localeCompare(right);
}

function SelectionSteps({
  country,
  division,
  team,
  countryLabel,
  divisionLabel,
  teamLabel,
  includeDivision,
  showWorldCupLogo,
  onCountryClick,
  onDivisionClick,
}: {
  country: string | null;
  division: string | null;
  team: string | null;
  countryLabel: string;
  divisionLabel: string;
  teamLabel: string;
  includeDivision: boolean;
  showWorldCupLogo: boolean;
  onCountryClick: () => void;
  onDivisionClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-800">
      <div className={`grid grid-cols-1 gap-3 ${includeDivision ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <StepButton
          label={countryLabel}
          value={country ?? `Choose ${countryLabel.toLowerCase()}`}
          active={!country}
          complete={Boolean(country)}
          icon={showWorldCupLogo ? <WorldCupLogoMark name={country ?? "WC2026"} className="h-10 w-12 rounded-lg" /> : null}
          onClick={onCountryClick}
        />
        {includeDivision && (
          <StepButton label={divisionLabel} value={division ?? `Choose ${divisionLabel.toLowerCase()}`} active={Boolean(country && !division)} complete={Boolean(division)} onClick={country ? onDivisionClick : undefined} />
        )}
        <StepButton label={teamLabel} value={team ?? `Choose ${teamLabel.toLowerCase()}`} active={Boolean(country && (!includeDivision || division) && !team)} complete={Boolean(team)} />
      </div>
    </div>
  );
}

function StepButton({ label, value, active, complete, icon, onClick }: { label: string; value: string; active: boolean; complete: boolean; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border p-3 text-left transition ${active
        ? "border-primary-400 bg-primary-50 dark:border-primary-500/70 dark:bg-primary-500/10"
        : complete
          ? "border-primary-200 bg-white dark:border-primary-700/50 dark:bg-surface-700"
          : "border-gray-200 bg-gray-50 dark:border-surface-700 dark:bg-surface-900"
        } ${onClick ? "hover:border-primary-400" : "cursor-default"}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-[11px] font-heading font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
          <p className="mt-1 truncate font-heading text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </button>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-heading font-bold uppercase tracking-[0.24em] text-primary-600 dark:text-primary-400">{eyebrow}</p>
      <h2 className="mt-1 font-heading text-3xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
        {icon} {label}
      </span>
      {value}
    </div>
  );
}

function getCallupPositionGroup(position: string): CallupPositionGroup {
  const normalized = String(position).toLowerCase();
  if (normalized.includes("goalkeeper")) return "GK";
  if (normalized.includes("back") || normalized.includes("defender")) return "DEF";
  if (normalized.includes("winger") || normalized.includes("forward") || normalized.includes("striker")) return "FWD";
  return "MID";
}

function getCallupGroupCounts(players: WorldCupCallupCandidate[], selectedIds: Set<string>) {
  const counts: Record<CallupPositionGroup, { total: number; selected: number }> = {
    GK: { total: 0, selected: 0 },
    DEF: { total: 0, selected: 0 },
    MID: { total: 0, selected: 0 },
    FWD: { total: 0, selected: 0 },
  };

  for (const player of players) {
    const group = getCallupPositionGroup(player.position);
    counts[group].total += 1;
    if (selectedIds.has(player.id)) {
      counts[group].selected += 1;
    }
  }

  return counts;
}

const COUNTRY_FLAG_CODES: Record<string, string> = {
  England: "ENG",
  France: "FR",
  Germany: "DE",
  Italy: "IT",
  Spain: "ES",
  Portugal: "PT",
  Netherlands: "NL",
  Belgium: "BE",
};

const LEAGUE_NAMES: Record<string, Record<number, string>> = {
  England: { 1: "Premier League", 2: "EFL Championship" },
  France: { 1: "Ligue 1", 2: "Ligue 2" },
  Germany: { 1: "Bundesliga", 2: "2. Bundesliga" },
  Italy: { 1: "Serie A", 2: "Serie B" },
  Spain: { 1: "LaLiga", 2: "Segunda División" },
  Portugal: { 1: "Primeira Liga" },
  Netherlands: { 1: "Eredivisie" },
  Belgium: { 1: "Belgian Pro League" },
};

const WORLDCUP_CONFEDERATIONS: Record<string, string> = {
  AU: "AFC",
  IR: "AFC",
  IQ: "AFC",
  JP: "AFC",
  JO: "AFC",
  KR: "AFC",
  SA: "AFC",
  QA: "AFC",
  UZ: "AFC",
  DZ: "CAF",
  CI: "CAF",
  CV: "CAF",
  CD: "CAF",
  EG: "CAF",
  GH: "CAF",
  MA: "CAF",
  ZA: "CAF",
  SN: "CAF",
  TN: "CAF",
  CA: "CONCACAF",
  US: "CONCACAF",
  MX: "CONCACAF",
  CW: "CONCACAF",
  HT: "CONCACAF",
  PA: "CONCACAF",
  AR: "CONMEBOL",
  BR: "CONMEBOL",
  CO: "CONMEBOL",
  EC: "CONMEBOL",
  PY: "CONMEBOL",
  UY: "CONMEBOL",
  AT: "UEFA",
  BE: "UEFA",
  BA: "UEFA",
  HR: "UEFA",
  CZ: "UEFA",
  ENG: "UEFA",
  FR: "UEFA",
  DE: "UEFA",
  NL: "UEFA",
  NO: "UEFA",
  PT: "UEFA",
  SCO: "UEFA",
  ES: "UEFA",
  SE: "UEFA",
  CH: "UEFA",
  TR: "UEFA",
  NZ: "OFC",
};

function getWorldCupConfederation(countryCode: string) {
  return WORLDCUP_CONFEDERATIONS[countryCode] ?? "World Cup";
}

function groupTeamsByCountryAndTier(teams: TeamData[], isWorldCupMode = false) {
  const countries = new Map<string, Map<number, TeamData[]>>();

  for (const team of teams) {
    const country = isWorldCupMode ? getWorldCupConfederation(team.country) : team.country || "Other";
    const tier = isWorldCupMode ? 1 : team.domestic_tier ?? 1;
    const countryMap = countries.get(country) ?? new Map<number, TeamData[]>();
    const tierTeams = countryMap.get(tier) ?? [];
    tierTeams.push(team);
    countryMap.set(tier, tierTeams);
    countries.set(country, countryMap);
  }

  return Array.from(countries.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, tiers]) => ({
      country,
      teamCount: Array.from(tiers.values()).reduce((sum, tierTeams) => sum + tierTeams.length, 0),
      tiers: Array.from(tiers.entries())
        .sort(([a], [b]) => a - b)
        .map(([tier, tierTeams]) => ({
          tier,
          leagueName: isWorldCupMode ? "World Cup 2026" : LEAGUE_NAMES[country]?.[tier] ?? `Division ${tier}`,
          teams: [...tierTeams].sort((a, b) => a.name.localeCompare(b.name)),
        })),
    }));
}
