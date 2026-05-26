import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore, GameStateData, PlayerData } from "../store/gameStore";
import { TeamData } from "../store/types";
import { formatVal, getPlayerOvr } from "../lib/helpers";
import { Card, CardBody, Badge, TeamLocation, ThemeToggle, CountryFlag } from "../components/ui";
import DivisionLogo from "../components/common/DivisionLogo";
import TeamLogo from "../components/common/TeamLogo";
import { ArrowLeft, Users, Trophy, Landmark, ChevronRight, Star, Loader2 } from "lucide-react";
import { resolveBackendError } from "../utils/backendI18n";

export default function TeamSelection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { gameState, setGameState, setGameActive } = useGameStore();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!gameState) {
    navigate("/");
    return null;
  }

  const teams = gameState.teams;
  const countryGroups = useMemo(() => groupTeamsByCountryAndTier(teams), [teams]);
  const selectedCountryGroup = countryGroups.find((group) => group.country === selectedCountry) ?? null;
  const selectedTierGroup = selectedCountryGroup?.tiers.find((group) => group.tier === selectedTier) ?? null;

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

  const handleConfirm = async () => {
    if (!selectedTeamId || isConfirming) return;
    setIsConfirming(true);
    try {
      const updatedGame = await invoke<GameStateData>("select_team", { teamId: selectedTeamId });
      setGameState(updatedGame);
      const mgr = updatedGame.manager;
      setGameActive(true, `${mgr.first_name} ${mgr.last_name}`);
      navigate("/dashboard");
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
          <div>
            <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
              {t('teamSelect.title')}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedTierGroup
                ? `Choose a club from ${selectedTierGroup.leagueName}`
                : selectedCountryGroup
                  ? `Choose a division in ${selectedCountryGroup.country}`
                  : "Choose a country to narrow down the football world"}
            </p>
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
          division={selectedTierGroup?.leagueName ?? null}
          team={selectedTeam?.name ?? null}
          onCountryClick={resetToCountries}
          onDivisionClick={resetToDivisions}
        />

        {!selectedCountryGroup && (
          <section className="space-y-4">
            <SectionHeading eyebrow="Step 1" title="Choose country" subtitle="Start broad, then drill into the league pyramid." />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {countryGroups.map((countryGroup) => (
                <button key={countryGroup.country} onClick={() => setSelectedCountry(countryGroup.country)} className="text-left rounded-2xl transition hover:-translate-y-0.5">
                  <Card className="h-full overflow-hidden !bg-white dark:!bg-app-card" accent="none">
                    <CardBody className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex h-11 w-14 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-surface-700 dark:ring-surface-600">
                            <CountryFlag code={COUNTRY_FLAG_CODES[countryGroup.country] ?? countryGroup.country} locale={i18n.language} className="text-2xl" />
                          </div>
                          <div>
                            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                              {countryGroup.country}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {countryGroup.teamCount} clubs across {countryGroup.tiers.length} division{countryGroup.tiers.length === 1 ? "" : "s"}
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

        {selectedCountryGroup && !selectedTierGroup && (
          <section className="space-y-4">
            <SectionHeading eyebrow="Step 2" title="Choose division" subtitle={`Pick which level of ${selectedCountryGroup.country} football you want to manage in.`} />
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
                              Tier {tierGroup.tier}
                            </p>
                            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                              {tierGroup.leagueName}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {tierGroup.teams.length} playable clubs
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

        {selectedTierGroup && (
          <section className="space-y-4">
            <SectionHeading eyebrow="Step 3" title="Choose team" subtitle={`Select your club in ${selectedTierGroup.leagueName}.`} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {selectedTierGroup.teams.map((team) => {
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
                            <TeamLogo team={team} selected={isSelected} />
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

function SelectionSteps({
  country,
  division,
  team,
  onCountryClick,
  onDivisionClick,
}: {
  country: string | null;
  division: string | null;
  team: string | null;
  onCountryClick: () => void;
  onDivisionClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-800">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StepButton label="Country" value={country ?? "Choose country"} active={!country} complete={Boolean(country)} onClick={onCountryClick} />
        <StepButton label="Division" value={division ?? "Choose division"} active={Boolean(country && !division)} complete={Boolean(division)} onClick={country ? onDivisionClick : undefined} />
        <StepButton label="Team" value={team ?? "Choose team"} active={Boolean(division && !team)} complete={Boolean(team)} />
      </div>
    </div>
  );
}

function StepButton({ label, value, active, complete, onClick }: { label: string; value: string; active: boolean; complete: boolean; onClick?: () => void }) {
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
      <p className="text-[11px] font-heading font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-1 truncate font-heading text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">{value}</p>
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

function groupTeamsByCountryAndTier(teams: TeamData[]) {
  const countries = new Map<string, Map<number, TeamData[]>>();

  for (const team of teams) {
    const country = team.country || "Other";
    const tier = team.domestic_tier ?? 1;
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
          leagueName: LEAGUE_NAMES[country]?.[tier] ?? `Division ${tier}`,
          teams: [...tierTeams].sort((a, b) => a.name.localeCompare(b.name)),
        })),
    }));
}
