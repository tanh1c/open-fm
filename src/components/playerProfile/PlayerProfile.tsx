import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatExactMoney, getContractRiskLevel, getPlayerOvr } from "../../lib/helpers";
import { PlayerData, GameStateData, type CareerEntry, type PlayerSeasonStats } from "../../store/gameStore";
import { useSettingsStore } from "../../store/settingsStore";
import { ArrowLeft, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveBackendText } from "../../utils/backendI18n";
import { resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import {
  clearContractExitIntent,
  previewContractTermination,
  setContractExitIntent,
  terminateContractNow,
  type ContractTerminationPreviewData,
} from "../../services/contractService";
import DashboardModalFrame from "../dashboard/DashboardModalFrame";
import { Button } from "../ui";
import {
  buildPlayerAdvancedStats,
  getPlayerAge,
  getPlayerTeamName,
  seasonTotalsToPlayerStats,
  type PlayerAdvancedStatsSummary,
  type PlayerCompetitionStatsSummary,
  type PlayerTransferHistorySummary,
} from "./PlayerProfile.helpers";
import { buildPlayerAttributeGroups } from "./PlayerProfile.attributes";
import PlayerProfileAttributesCard from "./PlayerProfileAttributesCard";
import PlayerProfileAttributeEditor from "./PlayerProfileAttributeEditor";
import PlayerProfileCareerHistoryCard from "./PlayerProfileCareerHistoryCard";
import PlayerProfileContractCard from "./PlayerProfileContractCard";
import PlayerProfileHeroCard from "./PlayerProfileHeroCard";
import PlayerProfileInjuryBanner from "./PlayerProfileInjuryBanner";
import PlayerProfileRecentMatchesCard, {
  type PlayerRecentMatchEntry,
} from "./PlayerProfileRecentMatchesCard";
import PlayerProfileRenewalModal from "./PlayerProfileRenewalModal";
import {
  type DelegatedRenewalCaseData,
  type DelegatedRenewalResponseData,
  type NegotiationFeedbackData,
  getRenewalStatusClassName,
  getRenewalStatusMessage,
  type RenewalProjectionData,
  type RenewalResponseData,
  type RenewalStatus,
  shouldDisableRenewalSubmit,
} from "./PlayerProfile.renewal";
import {
  getScoutAvailability,
  type PlayerProfileScoutStatus,
} from "./PlayerProfile.scouting";
import { editPlayer, type PlayerEdits } from "../../services/attributeService";

interface PlayerProfileProps {
  player: PlayerData;
  gameState: GameStateData;
  isOwnClub: boolean;
  startWithRenewalModal?: boolean;
  startWithTerminationModal?: boolean;
  onClose: () => void;
  onSelectTeam?: (id: string) => void;
  onGameUpdate?: (g: GameStateData) => void;
}

function areAdvancedStatsEqual(
  left: PlayerAdvancedStatsSummary,
  right: PlayerAdvancedStatsSummary,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

type PlayerProfileTab = "attributes" | "statistics" | "career" | "contract" | "achievements";

function translateWithFallback(
  t: (key: string, options?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(key, { defaultValue: fallback });
  return translated === key ? fallback : translated;
}

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

export default function PlayerProfile({
  player,
  gameState,
  isOwnClub,
  startWithRenewalModal = false,
  startWithTerminationModal = false,
  onClose,
  onSelectTeam,
  onGameUpdate,
}: PlayerProfileProps) {
  const { t, i18n } = useTranslation();
  const godMode = useSettingsStore((s) => s.settings.god_mode);
  const weeklySuffix = t("finances.perWeekSuffix", "/wk");
  const primaryPosition = player.natural_position || player.position;
  const footednessLabel = t(
    `common.footedness.${player.footedness || "Right"}`,
  );
  const weakFootValue = player.weak_foot ?? 2;

  if (!player) {
    return null;
  }

  const [scoutStatus, setScoutStatus] = useState<PlayerProfileScoutStatus>(
    "idle",
  );
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalWage, setRenewalWage] = useState("");
  const [renewalLength, setRenewalLength] = useState("2");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalStatus, setRenewalStatus] = useState<RenewalStatus>("idle");
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [renewalSuggestedWage, setRenewalSuggestedWage] = useState<
    number | null
  >(null);
  const [renewalSuggestedYears, setRenewalSuggestedYears] = useState<
    number | null
  >(null);
  const [renewalSessionStatus, setRenewalSessionStatus] =
    useState<RenewalResponseData["session_status"]>("idle");
  const [renewalIsTerminal, setRenewalIsTerminal] = useState(false);
  const [renewalCooledOff, setRenewalCooledOff] = useState(false);
  const [renewalFeedback, setRenewalFeedback] =
    useState<NegotiationFeedbackData | null>(null);
  const [renewalProjection, setRenewalProjection] =
    useState<RenewalProjectionData["projection"] | null>(null);
  const [contractActionSubmitting, setContractActionSubmitting] = useState(false);
  const [contractActionError, setContractActionError] = useState<string | null>(null);
  const [terminationPreview, setTerminationPreview] =
    useState<ContractTerminationPreviewData | null>(null);
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [advancedStatsOverride, setAdvancedStatsOverride] =
    useState<PlayerAdvancedStatsSummary | null>(null);
  const [seasonStatsOverride, setSeasonStatsOverride] =
    useState<PlayerSeasonStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<PlayerRecentMatchEntry[]>([]);
  const [hasConsumedInitialRenewalIntent, setHasConsumedInitialRenewalIntent] =
    useState(false);
  const [hasConsumedInitialTerminationIntent, setHasConsumedInitialTerminationIntent] =
    useState(false);
  const [godModeSubmitting, setGodModeSubmitting] = useState(false);
  const [godModeError, setGodModeError] = useState<string | null>(null);
  const [showGodModeEditor, setShowGodModeEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<PlayerProfileTab>("attributes");
  const canEditPlayer = godMode && Boolean(onGameUpdate);
  const ovr = getPlayerOvr(player);
  const age = getPlayerAge(player.date_of_birth);
  const teamName = getPlayerTeamName(
    gameState.teams,
    player.team_id,
    {
      freeAgent: t("common.freeAgent"),
      unknown: t("common.unknown"),
    },
  );
  const contractRiskLevel = getContractRiskLevel(
    player.contract_end,
    gameState.clock.current_date,
  );
  const contractRiskLabel =
    contractRiskLevel === "critical"
      ? t("finances.contractRiskCritical")
      : contractRiskLevel === "warning"
        ? t("finances.contractRiskWarning")
        : t("finances.contractRiskStable");
  const renewalOfferedWage = Number(renewalWage);
  const renewalOfferedYears = Number(renewalLength);
  const isRenewalWageValid =
    Number.isFinite(renewalOfferedWage) && renewalOfferedWage > 0;
  const isRenewalLengthValid =
    Number.isInteger(renewalOfferedYears) && renewalOfferedYears > 0;
  const renewalViolatesSoftCap =
    isRenewalWageValid &&
    renewalProjection !== null &&
    !renewalProjection.policy_allows;
  const renewalSubmitDisabled = shouldDisableRenewalSubmit({
    renewalSubmitting,
    renewalIsTerminal,
    isRenewalWageValid,
    isRenewalLengthValid,
    renewalViolatesSoftCap,
  });
  const renewalStatusMessage = getRenewalStatusMessage(
    {
      renewalSessionStatus,
      renewalStatus,
      renewalSuggestedWage,
      renewalSuggestedYears,
      renewalError,
    },
    t,
  );
  const renewalStatusClassName = getRenewalStatusClassName(renewalStatus);
  const scoutAvailability = getScoutAvailability({
    staff: gameState.staff,
    scoutingAssignments: gameState.scouting_assignments || [],
    youthScoutingAssignments: gameState.youth_scouting_assignments || [],
    managerTeamId: gameState.manager.team_id,
    playerId: player.id,
    scoutStatus,
  });
  const attrGroups = buildPlayerAttributeGroups(player, t);
  const fallbackAdvancedStats = buildPlayerAdvancedStats(player, gameState.players);
  const advancedStats = advancedStatsOverride ?? fallbackAdvancedStats;
  const displayStats = seasonStatsOverride ?? player.stats;
  const hasLetExpireIntent =
    player.morale_core?.renewal_state?.exit_intent?.kind === "let_expire";
  const currentTeam = gameState.teams.find((team) => team.id === player.team_id) ?? null;
  const profileTabs: { id: PlayerProfileTab; label: string }[] = [
    { id: "attributes", label: translateWithFallback(t, "playerProfile.tabs.attributes", "Attributes") },
    { id: "statistics", label: translateWithFallback(t, "playerProfile.tabs.statistics", "Statistics") },
    { id: "career", label: translateWithFallback(t, "playerProfile.tabs.career", "Career") },
    { id: "contract", label: translateWithFallback(t, "playerProfile.tabs.contract", "Contract & Transfers") },
    { id: "achievements", label: translateWithFallback(t, "playerProfile.tabs.achievements", "Achievements") },
  ];

  function openRenewalModal(): void {
    setRenewalWage(String(player.wage));
    setRenewalLength("2");
    setRenewalSubmitting(false);
    setRenewalStatus("idle");
    setRenewalError(null);
    setRenewalSuggestedWage(null);
    setRenewalSuggestedYears(null);
    setRenewalSessionStatus("idle");
    setRenewalIsTerminal(false);
    setRenewalCooledOff(false);
    setRenewalFeedback(null);
    setRenewalProjection(null);
    setShowRenewalModal(true);
  }

  function closeRenewalModal(): void {
    if (renewalSubmitting) {
      return;
    }

    setShowRenewalModal(false);
  }

  useEffect(() => {
    setHasConsumedInitialRenewalIntent(false);
    setHasConsumedInitialTerminationIntent(false);
  }, [player.id, startWithRenewalModal, startWithTerminationModal]);

  useEffect(() => {
    if (
      !isOwnClub ||
      !startWithRenewalModal ||
      showRenewalModal ||
      hasConsumedInitialRenewalIntent
    ) {
      return;
    }

    setHasConsumedInitialRenewalIntent(true);
    openRenewalModal();
  }, [
    hasConsumedInitialRenewalIntent,
    isOwnClub,
    showRenewalModal,
    startWithRenewalModal,
  ]);

  useEffect(() => {
    if (
      !isOwnClub ||
      !startWithTerminationModal ||
      showTerminationModal ||
      hasConsumedInitialTerminationIntent
    ) {
      return;
    }

    setHasConsumedInitialTerminationIntent(true);
    void openTerminationModal();
  }, [
    hasConsumedInitialTerminationIntent,
    isOwnClub,
    showTerminationModal,
    startWithTerminationModal,
  ]);

  useEffect(() => {
    if (!showRenewalModal || !isRenewalWageValid) {
      setRenewalProjection(null);
      return;
    }

    let cancelled = false;

    const loadProjection = async (): Promise<void> => {
      try {
        const result = await invoke<RenewalProjectionData>(
          "preview_renewal_financial_impact",
          {
            playerId: player.id,
            weeklyWage: renewalOfferedWage,
          },
        );

        if (!cancelled) {
          setRenewalProjection(result.projection ?? null);
        }
      } catch {
        if (!cancelled) {
          setRenewalProjection(null);
        }
      }
    };

    loadProjection();

    return () => {
      cancelled = true;
    };
  }, [isRenewalWageValid, player.id, renewalOfferedWage, showRenewalModal]);

  useEffect(() => {
    let cancelled = false;

    setAdvancedStatsOverride((current) => (current === null ? current : null));
    setSeasonStatsOverride((current) => (current === null ? current : null));

    const loadAdvancedStats = async (): Promise<void> => {
      try {
        const result = await invoke<PlayerAdvancedStatsSummary>(
          "get_player_stats_overview",
          {
            playerId: player.id,
          },
        );

        if (cancelled) {
          return;
        }

        if (result.seasonTotals) {
          setSeasonStatsOverride(seasonTotalsToPlayerStats(result.seasonTotals));
        }

        if (!areAdvancedStatsEqual(result, fallbackAdvancedStats)) {
          setAdvancedStatsOverride(result);
        }
      } catch {
        if (!cancelled) {
          setAdvancedStatsOverride((current) => (current === null ? current : null));
          setSeasonStatsOverride((current) => (current === null ? current : null));
        }
      }
    };

    void loadAdvancedStats();

    return () => {
      cancelled = true;
    };
  }, [
    player.id,
    player.stats.minutes_played,
    player.stats.shots,
    player.stats.shots_on_target,
    player.stats.passes_completed,
    player.stats.passes_attempted,
    player.stats.tackles_won,
    player.stats.interceptions,
    player.stats.fouls_committed,
  ]);

  useEffect(() => {
    if (player.stats.appearances <= 0) {
      setRecentMatches([]);
      return;
    }

    let cancelled = false;

    const loadRecentMatches = async (): Promise<void> => {
      try {
        const result = await invoke<PlayerRecentMatchEntry[]>(
          "get_player_match_history",
          {
            playerId: player.id,
            limit: 5,
          },
        );

        if (!cancelled) {
          setRecentMatches((current) => {
            if (
              current.length === result.length &&
              current.every(
                (entry, index) => entry.fixture_id === result[index]?.fixture_id,
              )
            ) {
              return current;
            }

            return result;
          });
        }
      } catch {
        if (!cancelled) {
          setRecentMatches((current) =>
            current.length === 0 ? current : [],
          );
        }
      }
    };

    void loadRecentMatches();

    return () => {
      cancelled = true;
    };
  }, [player.id, player.stats.appearances]);

  async function handleRenewalSubmit(): Promise<void> {
    if (renewalSubmitDisabled) {
      return;
    }

    setRenewalSubmitting(true);
    setRenewalStatus("idle");
    setRenewalError(null);
    setRenewalCooledOff(false);

    try {
      const result = await invoke<RenewalResponseData>("propose_renewal", {
        playerId: player.id,
        weeklyWage: renewalOfferedWage,
        contractYears: renewalOfferedYears,
      });

      onGameUpdate?.(result.game);
      setRenewalStatus(result.outcome);
      setRenewalSuggestedWage(result.suggested_wage);
      setRenewalSuggestedYears(result.suggested_years);
      setRenewalSessionStatus(result.session_status);
      setRenewalIsTerminal(result.is_terminal);
      setRenewalCooledOff(result.cooled_off ?? false);
      setRenewalFeedback(result.feedback ?? null);

      if (result.session_status === "blocked") {
        setRenewalStatus("blocked");
      }

      if (result.outcome === "counter_offer") {
        if (result.suggested_wage !== null) {
          setRenewalWage(String(result.suggested_wage));
        }

        if (result.suggested_years !== null) {
          setRenewalLength(String(result.suggested_years));
        }
      }
    } catch (error) {
      setRenewalStatus("error");
      setRenewalError(String(error));
      setRenewalCooledOff(false);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  async function handleDelegateRenewal(): Promise<void> {
    if (renewalSubmitting) {
      return;
    }

    setRenewalSubmitting(true);
    setRenewalError(null);
    setRenewalCooledOff(false);

    try {
      const result = await invoke<DelegatedRenewalResponseData>(
        "delegate_renewals",
        {
          playerIds: [player.id],
          maxWageIncreasePct: 35,
          maxContractYears: 3,
        },
      );

      onGameUpdate?.(result.game);
      const delegatedCase: DelegatedRenewalCaseData | undefined =
        result.report.cases.find(
          (renewalCase) => renewalCase.player_id === player.id,
        );

      if (!delegatedCase) {
        setRenewalStatus("error");
        setRenewalError(t("playerProfile.renewalDelegateMissingReport"));
        return;
      }

      if (delegatedCase.status === "successful") {
        setRenewalStatus("accepted");
        setRenewalSessionStatus("agreed");
        setRenewalIsTerminal(true);
        setRenewalSuggestedWage(null);
        setRenewalSuggestedYears(null);
        setRenewalCooledOff(false);
        setRenewalFeedback(null);
        return;
      }

      if (delegatedCase.status === "stalled") {
        setRenewalStatus("rejected");
        setRenewalSessionStatus("stalled");
        setRenewalIsTerminal(false);
        setRenewalCooledOff(false);
        setRenewalFeedback(null);
        setRenewalError(
          resolveBackendText(
            delegatedCase.note_key,
            delegatedCase.note,
            delegatedCase.note_params,
          ),
        );
        return;
      }

      setRenewalStatus("blocked");
      setRenewalSessionStatus("blocked");
      setRenewalIsTerminal(true);
      setRenewalCooledOff(false);
      setRenewalFeedback(null);
      setRenewalError(
        resolveBackendText(
          delegatedCase.note_key,
          delegatedCase.note,
          delegatedCase.note_params,
        ),
      );
    } catch (error) {
      setRenewalStatus("error");
      setRenewalError(String(error));
      setRenewalCooledOff(false);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  async function handleMarkLetExpire(): Promise<void> {
    if (contractActionSubmitting) {
      return;
    }

    setContractActionSubmitting(true);
    setContractActionError(null);

    try {
      const result = await setContractExitIntent(
        player.id,
        "manager_profile_action",
      );
      onGameUpdate?.(result.game);
    } catch (error) {
      setContractActionError(String(error));
    } finally {
      setContractActionSubmitting(false);
    }
  }

  async function handleClearLetExpire(): Promise<void> {
    if (contractActionSubmitting) {
      return;
    }

    setContractActionSubmitting(true);
    setContractActionError(null);

    try {
      const result = await clearContractExitIntent(player.id);
      onGameUpdate?.(result.game);
    } catch (error) {
      setContractActionError(String(error));
    } finally {
      setContractActionSubmitting(false);
    }
  }

  async function openTerminationModal(): Promise<void> {
    if (contractActionSubmitting) {
      return;
    }

    setContractActionSubmitting(true);
    setContractActionError(null);
    setTerminationPreview(null);
    setShowTerminationModal(true);

    try {
      const result = await previewContractTermination(player.id);
      setTerminationPreview(result.preview);
    } catch (error) {
      setContractActionError(String(error));
    } finally {
      setContractActionSubmitting(false);
    }
  }

  async function handleTerminateContract(): Promise<void> {
    if (contractActionSubmitting || !terminationPreview) {
      return;
    }

    setContractActionSubmitting(true);
    setContractActionError(null);

    try {
      const result = await terminateContractNow(player.id);
      onGameUpdate?.(result.game);
      setShowTerminationModal(false);
      setTerminationPreview(null);
    } catch (error) {
      setContractActionError(String(error));
    } finally {
      setContractActionSubmitting(false);
    }
  }

  async function handleGodModeEdit(edits: PlayerEdits): Promise<void> {
    if (godModeSubmitting) {
      return;
    }

    setGodModeSubmitting(true);
    setGodModeError(null);

    try {
      const result = await editPlayer(player.id, edits);
      onGameUpdate?.(result.game);
      setShowGodModeEditor(false);
    } catch (error) {
      setGodModeError(resolveTranslatedErrorMessage(error, t));
    } finally {
      setGodModeSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-max max-w-[1600px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-app-text">{player.full_name.toUpperCase()}</h1>
          <p className="text-xs text-app-text-muted">
            {t(`common.posAbbr.${primaryPosition}`, { defaultValue: primaryPosition })} &bull; {teamName} &bull; OVR {ovr}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEditPlayer ? (
            <button
              type="button"
              onClick={() => {
                setGodModeError(null);
                setShowGodModeEditor(true);
              }}
              className="flex items-center gap-2 rounded-lg border border-app-green/40 bg-app-green/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/20"
            >
              <Pencil className="h-4 w-4" />
              {t("playerProfile.editPlayer", { defaultValue: "Edit Player" })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </button>
        </div>
      </div>

      <PlayerProfileHeroCard
        player={player}
        ovr={ovr}
        primaryPosition={primaryPosition}
        age={age}
        teamName={teamName}
        team={currentTeam}
        footednessLabel={footednessLabel}
        weakFootValue={weakFootValue}
        weeklySuffix={weeklySuffix}
        language={i18n.language}
        currentDate={gameState.clock.current_date}
        contractRiskLevel={contractRiskLevel}
        contractRiskLabel={contractRiskLabel}
        hasLetExpireIntent={hasLetExpireIntent}
        actionSubmitting={contractActionSubmitting}
        isOwnClub={isOwnClub}
        scoutAvailability={scoutAvailability}
        scoutStatus={scoutStatus}
        scoutError={scoutError}
        onScout={() => {
          const availableScout = scoutAvailability.availableScout;
          if (!availableScout || !onGameUpdate) {
            return;
          }

          void (async () => {
            setScoutStatus("sending");
            setScoutError(null);

            try {
              const updated = await invoke<GameStateData>("send_scout", {
                scoutId: availableScout.id,
                playerId: player.id,
              });
              onGameUpdate(updated);
              setScoutStatus("sent");
            } catch (err) {
              setScoutError(resolveTranslatedErrorMessage(err, t));
              setScoutStatus("error");
            }
          })();
        }}
        onOpenRenewal={openRenewalModal}
        onMarkLetExpire={() => void handleMarkLetExpire()}
        onClearLetExpire={() => void handleClearLetExpire()}
        onOpenTermination={() => void openTerminationModal()}
        onSelectTeam={onSelectTeam}
        t={t}
      />

      {/* Injury banner */}
      {player.injury ? (
        <PlayerProfileInjuryBanner injury={player.injury} t={t} />
      ) : null}

      {contractActionError ? (
        <div className="rounded-lg border border-app-red/40 bg-app-red/10 px-4 py-3 text-sm text-app-red">
          {contractActionError}
        </div>
      ) : null}

      <div className="rounded-xl border border-app-border bg-app-card/80 p-1 shadow-sm">
        <div className="flex gap-1 overflow-x-auto custom-scrollbar">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-lg px-4 py-2 font-heading text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? "bg-app-green text-black shadow-[0_0_18px_rgba(34,197,94,0.18)]"
                  : "text-app-text-muted hover:bg-white/5 hover:text-app-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "attributes" ? (
        <PlayerProfileAttributesCard
          attrGroups={attrGroups}
          isOwnClub={isOwnClub}
          godMode={godMode}
          title={t("playerProfile.attributes")}
          averageLabel={t("common.average")}
          hiddenTitle={t("playerProfile.attributesHidden")}
          hiddenBody={t("playerProfile.scoutToView")}
        />
      ) : null}

      {activeTab === "statistics" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <PlayerProfileStatisticsTable stats={displayStats} advancedStats={advancedStats} t={t} />
          <PlayerProfileRecentMatchesCard matches={recentMatches} t={t} />
        </div>
      ) : null}

      {activeTab === "career" ? (
        <PlayerProfileCareerHistoryCard career={player.career} t={t} />
      ) : null}

      {activeTab === "contract" ? (
        <PlayerProfileContractCard
          dateOfBirth={player.date_of_birth}
          contractEnd={player.contract_end}
          currentDate={gameState.clock.current_date}
          condition={player.condition}
          morale={player.morale}
          marketValue={player.market_value}
          wage={player.wage}
          weeklySuffix={weeklySuffix}
          language={i18n.language}
          contractRiskLevel={contractRiskLevel}
          contractRiskLabel={contractRiskLabel}
          isOwnClub={isOwnClub}
          hasLetExpireIntent={hasLetExpireIntent}
          actionSubmitting={contractActionSubmitting}
          onOpenRenewal={openRenewalModal}
          onMarkLetExpire={() => void handleMarkLetExpire()}
          onClearLetExpire={() => void handleClearLetExpire()}
          onOpenTermination={() => void openTerminationModal()}
          t={t}
        />
      ) : null}

      {activeTab === "achievements" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <PlayerTransferHistoryTable transfers={advancedStats.transferHistory ?? []} t={t} />
          <PlayerProfileCareerHistoryTable career={player.career} t={t} />
        </div>
      ) : null}

      <PlayerProfileRenewalModal
        show={showRenewalModal}
        playerName={player.full_name}
        t={t}
        weeklySuffix={weeklySuffix}
        renewalWage={renewalWage}
        renewalLength={renewalLength}
        renewalIsTerminal={renewalIsTerminal}
        isRenewalWageValid={isRenewalWageValid}
        renewalViolatesSoftCap={renewalViolatesSoftCap}
        renewalProjection={renewalProjection}
        renewalStatusMessage={renewalStatusMessage}
        renewalStatusClassName={renewalStatusClassName}
        renewalCooledOff={renewalCooledOff}
        renewalFeedback={renewalFeedback}
        renewalSubmitting={renewalSubmitting}
        renewalSubmitDisabled={renewalSubmitDisabled}
        onWageChange={setRenewalWage}
        onLengthChange={setRenewalLength}
        onClose={closeRenewalModal}
        onDelegate={() => void handleDelegateRenewal()}
        onSubmit={() => void handleRenewalSubmit()}
      />

      {showGodModeEditor && canEditPlayer ? (
        <PlayerProfileAttributeEditor
          player={player}
          teams={gameState.teams}
          submitting={godModeSubmitting}
          error={godModeError}
          onSubmit={(edits) => void handleGodModeEdit(edits)}
          onClose={() => {
            if (godModeSubmitting) {
              return;
            }
            setShowGodModeEditor(false);
          }}
          t={t}
        />
      ) : null}

      {showTerminationModal ? (
        <DashboardModalFrame maxWidthClassName="max-w-lg">
          <div className="space-y-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("playerProfile.terminateContractTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {t("playerProfile.terminateContractBody", {
                  name: player.full_name,
                })}
              </p>
            </div>

            {terminationPreview ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-surface-600 dark:bg-surface-700/60">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("playerProfile.terminationSeverance")}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatExactMoney(terminationPreview.severance_cost)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("playerProfile.projectedHealthyPlayers")}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {terminationPreview.squad_safety.healthy_players}/11
                  </span>
                </div>
                {!terminationPreview.squad_safety.can_field_matchday_squad ? (
                  <p className="mt-3 text-red-600 dark:text-red-300">
                    {t("playerProfile.terminationUnsafe")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("common.loading")}
              </p>
            )}

            {contractActionError ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {contractActionError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowTerminationModal(false);
                  setTerminationPreview(null);
                }}
                disabled={contractActionSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                disabled={
                  contractActionSubmitting ||
                  !terminationPreview?.squad_safety.can_field_matchday_squad
                }
                onClick={() => void handleTerminateContract()}
              >
                {t("playerProfile.confirmTerminateContract")}
              </Button>
            </div>
          </div>
        </DashboardModalFrame>
      ) : null}
    </div>
  );
}

function PlayerProfileStatisticsTable({
  stats,
  advancedStats,
  t,
}: {
  stats: PlayerSeasonStats;
  advancedStats: PlayerAdvancedStatsSummary;
  t: TranslateFn;
}) {
  const competitionRows = advancedStats.competitionStats?.length
    ? advancedStats.competitionStats
    : [{
        competition: translateWithFallback(t, "playerProfile.allCompetitions", "All Competitions"),
        teamId: "",
        teamName: "",
        totals: {
          appearances: stats.appearances,
          goals: stats.goals,
          assists: stats.assists,
          cleanSheets: stats.clean_sheets,
          yellowCards: stats.yellow_cards,
          redCards: stats.red_cards,
          avgRating: stats.avg_rating,
          minutesPlayed: stats.minutes_played,
          shots: stats.shots ?? 0,
          shotsOnTarget: stats.shots_on_target ?? 0,
          passesCompleted: stats.passes_completed ?? 0,
          passesAttempted: stats.passes_attempted ?? 0,
          tacklesWon: stats.tackles_won ?? 0,
          interceptions: stats.interceptions ?? 0,
          foulsCommitted: stats.fouls_committed ?? 0,
        },
      }];
  const totalRow: PlayerCompetitionStatsSummary = {
    competition: "Competitive Total",
    teamId: "",
    teamName: "",
    totals: {
      appearances: stats.appearances,
      goals: stats.goals,
      assists: stats.assists,
      cleanSheets: stats.clean_sheets,
      yellowCards: stats.yellow_cards,
      redCards: stats.red_cards,
      avgRating: stats.avg_rating,
      minutesPlayed: stats.minutes_played,
      shots: advancedStats.metrics.shots.total,
      shotsOnTarget: advancedStats.metrics.shotsOnTarget.total,
      passesCompleted: advancedStats.metrics.passes.completed,
      passesAttempted: advancedStats.metrics.passes.attempted,
      tacklesWon: advancedStats.metrics.tacklesWon.total,
      interceptions: advancedStats.metrics.interceptions.total,
      foulsCommitted: advancedStats.metrics.foulsCommitted.total,
    },
  };

  return (
    <CompetitionStatTable
      title={translateWithFallback(t, "playerProfile.tabs.statistics", "Statistics")}
      rows={[...competitionRows, totalRow]}
      t={t}
    />
  );
}

function CompetitionStatTable({
  title,
  rows,
  t,
}: {
  title: string;
  rows: PlayerCompetitionStatsSummary[];
  t: TranslateFn;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
      <div className="border-b border-app-border px-4 py-3">
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-app-text">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-app-bg/80 text-[10px] uppercase tracking-wider text-app-text-muted">
            <tr>
              <th className="px-4 py-3 font-heading font-bold">Competition</th>
              <th className="px-4 py-3 font-heading font-bold">Club</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.apps")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.goals")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.assists")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.mins")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.cleanSheets")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.yellows")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.reds")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">{t("playerProfile.avgRating")}</th>
              <th className="px-4 py-3 text-right font-heading font-bold">Shots</th>
              <th className="px-4 py-3 text-right font-heading font-bold">SOT</th>
              <th className="px-4 py-3 text-right font-heading font-bold">Passes</th>
              <th className="px-4 py-3 text-right font-heading font-bold">Tackles</th>
              <th className="px-4 py-3 text-right font-heading font-bold">Ints</th>
              <th className="px-4 py-3 text-right font-heading font-bold">Fouls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {rows.map((row, index) => {
              const isTotal = index === rows.length - 1;
              return (
                <tr key={`${row.competition}-${row.teamId}-${index}`} className={isTotal ? "bg-app-green/10 font-bold" : "hover:bg-white/[0.03]"}>
                  <td className="px-4 py-3 font-heading text-xs font-bold uppercase tracking-wider text-app-text">
                    {row.competition}
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{row.teamName || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.appearances}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.goals}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.assists}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.minutesPlayed}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.cleanSheets}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.yellowCards}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.redCards}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.avgRating > 0 ? row.totals.avgRating.toFixed(1) : "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.shots}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.shotsOnTarget}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.passesCompleted}/{row.totals.passesAttempted}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.tacklesWon}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.interceptions}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{row.totals.foulsCommitted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerTransferHistoryTable({
  transfers,
  t,
}: {
  transfers: PlayerTransferHistorySummary[];
  t: TranslateFn;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
      <div className="border-b border-app-border px-4 py-3">
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-app-text">
          {translateWithFallback(t, "playerProfile.transferHistory", "Transfer History")}
        </h3>
      </div>
      {transfers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-app-bg/80 text-[10px] uppercase tracking-wider text-app-text-muted">
              <tr>
                <th className="px-4 py-3 font-heading font-bold">Date</th>
                <th className="px-4 py-3 font-heading font-bold">Out</th>
                <th className="px-4 py-3 font-heading font-bold">In</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {transfers.map((transfer, index) => (
                <tr key={`${transfer.date}-${transfer.fromTeamId}-${transfer.toTeamId}-${index}`} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-heading text-xs font-bold tabular-nums text-app-text-muted">{transfer.date}</td>
                  <td className="px-4 py-3 font-semibold text-app-text">{transfer.fromTeamName}</td>
                  <td className="px-4 py-3 font-semibold text-app-text">{transfer.toTeamName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{formatExactMoney(transfer.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-app-text-muted">
          {translateWithFallback(t, "playerProfile.noTransferHistory", "No transfer history yet")}
        </p>
      )}
    </div>
  );
}

function PlayerProfileCareerHistoryTable({
  career,
  t,
}: {
  career: CareerEntry[];
  t: TranslateFn;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
      <div className="border-b border-app-border px-4 py-3">
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-app-text">
          {t("playerProfile.careerHistory")}
        </h3>
      </div>
      {career.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-app-bg/80 text-[10px] uppercase tracking-wider text-app-text-muted">
              <tr>
                <th className="px-4 py-3 font-heading font-bold">Season</th>
                <th className="px-4 py-3 font-heading font-bold">Team</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Apps</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Goals</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Assists</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Clean Sheets</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Yellows</th>
                <th className="px-4 py-3 text-right font-heading font-bold">Reds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {career.map((entry, index) => (
                <tr key={`${entry.season}-${entry.team_name}-${index}`} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-heading text-xs font-bold tabular-nums text-app-text-muted">
                    {entry.season}/{entry.season + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-app-text">
                    {entry.team_name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.appearances}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.goals}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.assists}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.clean_sheets ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.yellow_cards ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-app-text">{entry.red_cards ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-app-text-muted">
          {t("playerProfile.noCareer")}
        </p>
      )}
    </div>
  );
}
