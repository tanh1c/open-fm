import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Globe,
  MoreHorizontal,
  PenTool,
  Save,
  Search,
  Star,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { countryName } from "../../lib/countries";
import { calcAge, formatVal, getPlayerOvr, getTeamName } from "../../lib/helpers";
import type { GameStateData, MessageData, PlayerData, ScoutReportData, ScoutingAssignment, StaffData, TeamData } from "../../store/gameStore";
import { getErrorMessage, resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import ContextMenu from "../ContextMenu";
import {
  buildDividerMenuItem,
  buildMakeTransferBidMenuItem,
  buildScoutPlayerMenuItem,
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import { translatePositionAbbreviation, translatePositionLabel } from "../squad/SquadTab.helpers";
import { CountryFlag, Select } from "../ui";
import TransferBidModal from "../transfers/TransferBidModal";
import { useTransferBidFlow } from "../transfers/useTransferBidFlow";
import { cancelYouthScouting, reassignYouthScouting, sendScout, startYouthScouting } from "../../services/scoutingService";
import { calculateAvailableScouts, scoutAssignmentCount, scoutMaxSlots } from "./ScoutingTab.helpers";
import { buildAlreadyScoutingIds, filterScoutablePlayers } from "./ScoutingTab.model";
import ScoutingYouthRecruitmentCard from "./ScoutingYouthRecruitmentCard";
import TeamLogo from "../common/TeamLogo";

interface ScoutingTabProps {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

const SCOUTING_PAGE_SIZE = 20;
const POSITION_FILTERS = ["All", "GK", "DR", "DCR", "DCL", "DL", "DM", "MCR", "MCL", "AMR", "AML", "STC"];

type RecruitmentFocus = "Balanced" | "High Potential" | "Ready Soon" | "Transfer Listed" | "Loan Listed";
type ShortlistMode = "Transfer Listed" | "Loan Listed" | "High Potential" | "Recommended";
type AgeFilter = "Any" | "U21" | "U23" | "Prime 24-29" | "30+";
type NationalityFilter = "All" | "Domestic" | "Foreign";
type TransferTypeFilter = "Any" | "Transfer Listed" | "Loan Listed" | "Free Agent";
type ContractStatusFilter = "Any" | "Expiring 6 Months" | "Expiring 12 Months" | "No Contract";
type RoleProfileFilter = "Any" | "High Potential" | "Ready Now" | "Budget" | "Wonderkid";
type ScoutingOpsTab = "Trip" | "Youth";
type SearchSortKey = "player" | "age" | "nat" | "team" | "pos" | "value" | "wage" | "ca" | "pa" | "knowledge" | "interest" | "status";
type SortDirection = "asc" | "desc";
interface ScoutingPlayerMeta {
  age: number;
  overall: number;
  potential: number;
  teamName: string;
  nationality: string;
  position: string;
}
const TEMPLATE_POSITION_FILTER_MAP: Record<string, string> = {
  All: "All",
  GK: "Goalkeeper",
  DR: "Defender",
  DCR: "Defender",
  DCL: "Defender",
  DL: "Defender",
  DM: "Midfielder",
  MCR: "Midfielder",
  MCL: "Midfielder",
  AMR: "Midfielder",
  AML: "Midfielder",
  STC: "Forward",
};

export default function ScoutingTab({
  gameState,
  onGameUpdate,
  onSelectPlayer,
  onSelectTeam,
}: ScoutingTabProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState<string>("All");
  const [sending, setSending] = useState<string | null>(null);
  const [playerSearchError, setPlayerSearchError] = useState<string | null>(null);
  const [startingYouthSearch, setStartingYouthSearch] = useState(false);
  const [selectedYouthScoutId, setSelectedYouthScoutId] = useState("");
  const [youthRegion, setYouthRegion] = useState("Domestic");
  const [youthObjective, setYouthObjective] = useState("Balanced");
  const [youthTargetPosition, setYouthTargetPosition] = useState("");
  const [youthSearchError, setYouthSearchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [recruitmentFocus, setRecruitmentFocus] = useState<RecruitmentFocus>("Balanced");
  const [shortlistMode, setShortlistMode] = useState<ShortlistMode>("Recommended");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("Any");
  const [nationalityFilter, setNationalityFilter] = useState<NationalityFilter>("All");
  const [transferTypeFilter, setTransferTypeFilter] = useState<TransferTypeFilter>("Any");
  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>("Any");
  const [roleProfileFilter, setRoleProfileFilter] = useState<RoleProfileFilter>("Any");
  const [selectedReportPlayerId, setSelectedReportPlayerId] = useState<string | null>(null);
  const [searchSort, setSearchSort] = useState<{ key: SearchSortKey; direction: SortDirection }>({ key: "ca", direction: "desc" });
  const [scoutingOpsTab, setScoutingOpsTab] = useState<ScoutingOpsTab>(
    gameState.staff.some((staff) => staff.role === "Scout" && staff.team_id === (gameState.manager.team_id ?? "")) ? "Trip" : "Youth",
  );
  const [assignmentHint, setAssignmentHint] = useState(false);
  const [savedSearchNotice, setSavedSearchNotice] = useState<string | null>(null);
  const [searchReady, setSearchReady] = useState(false);
  const [secondaryPanelsReady, setSecondaryPanelsReady] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    bidTarget,
    bidAmount,
    setBidAmount,
    bidResult,
    bidLoading,
    bidFeedback,
    bidProjection,
    bidFee,
    activeBidOffer,
    myTeam,
    hasExistingOffer,
    bidSubmitDisabled,
    openBidNegotiation,
    closeBidNegotiation,
    handleMakeBid,
  } = useTransferBidFlow({ gameState, onGameUpdate });

  const myTeamId = gameState.manager.team_id ?? "";
  const teamById = useMemo(
    () => new Map(gameState.teams.map((team) => [team.id, team])),
    [gameState.teams],
  );
  const playerById = useMemo(
    () => new Map(gameState.players.map((player) => [player.id, player])),
    [gameState.players],
  );
  const playerMetaById = useMemo(
    () => buildScoutingPlayerMetaMap(gameState.players, teamById),
    [gameState.players, teamById],
  );
  const scouts = useMemo(
    () => gameState.staff.filter((staff) => staff.role === "Scout" && staff.team_id === myTeamId),
    [gameState.staff, myTeamId],
  );
  const assignments = gameState.scouting_assignments || [];
  const youthAssignments = gameState.youth_scouting_assignments || [];
  const allAssignments = useMemo(() => [...assignments, ...youthAssignments], [assignments, youthAssignments]);
  const availableScouts = useMemo(
    () => calculateAvailableScouts(scouts, allAssignments),
    [scouts, allAssignments],
  );

  useEffect(() => {
    if (selectedYouthScoutId && availableScouts.some((scout) => scout.id === selectedYouthScoutId)) return;
    setSelectedYouthScoutId(availableScouts[0]?.id ?? "");
  }, [availableScouts, selectedYouthScoutId]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!searchReady) return;
    return requestIdleTask(() => setSecondaryPanelsReady(true));
  }, [searchReady]);

  const baseScoutable = useMemo(
    () => searchReady ? filterScoutablePlayers({
      players: gameState.players,
      teams: gameState.teams,
      myTeamId,
      posFilter: TEMPLATE_POSITION_FILTER_MAP[posFilter] ?? posFilter,
      searchQuery,
    }) : [],
    [searchReady, gameState.players, gameState.teams, myTeamId, posFilter, searchQuery],
  );
  const allScoutable = useMemo(
    () => applyScoutingFilters(baseScoutable, playerMetaById, {
      ageFilter,
      nationalityFilter,
      transferTypeFilter,
      contractStatusFilter,
      roleProfileFilter,
      recruitmentFocus,
      managerNationality: gameState.manager.football_nation ?? gameState.manager.nationality,
      currentDate: gameState.clock.current_date,
    }),
    [
      baseScoutable,
      playerMetaById,
      ageFilter,
      nationalityFilter,
      transferTypeFilter,
      contractStatusFilter,
      roleProfileFilter,
      recruitmentFocus,
      gameState.manager.football_nation,
      gameState.manager.nationality,
      gameState.clock.current_date,
    ],
  );
  const listedTargets = useMemo(
    () => secondaryPanelsReady ? buildShortlistPlayers(baseScoutable, shortlistMode, myTeamId, playerMetaById) : [],
    [secondaryPanelsReady, baseScoutable, shortlistMode, myTeamId, playerMetaById],
  );
  const alreadyScoutingIds = useMemo(() => buildAlreadyScoutingIds(assignments), [assignments]);
  const totalPages = Math.max(1, Math.ceil(allScoutable.length / SCOUTING_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const scoutableWindow = useMemo(
    () => selectScoutableWindow(allScoutable, searchSort, playerMetaById, alreadyScoutingIds, (safePage + 1) * SCOUTING_PAGE_SIZE),
    [allScoutable, searchSort, playerMetaById, alreadyScoutingIds, safePage],
  );
  const scoutablePlayers = scoutableWindow.slice(safePage * SCOUTING_PAGE_SIZE, (safePage + 1) * SCOUTING_PAGE_SIZE);
  const completedScoutReports = useMemo(() => buildScoutReportMap(gameState.messages), [gameState.messages]);
  const assignmentByPlayerId = useMemo(() => buildAssignmentByPlayerId(assignments), [assignments]);
  const initialReportPlayer = scoutablePlayers[0] ?? scoutableWindow[0] ?? listedTargets[0] ?? baseScoutable[0] ?? null;
  const selectedReportPlayerKey = selectedReportPlayerId ?? initialReportPlayer?.id ?? null;

  const focusPlayerSearch = useCallback(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const handleCreateAssignmentClick = () => {
    setAssignmentHint(true);
    focusPlayerSearch();
  };

  const handleStartSearchClick = () => {
    setAssignmentHint(false);
    focusPlayerSearch();
  };

  const handleSortChange = (key: SearchSortKey) => {
    setSearchSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
    setPage(0);
  };

  const handleReportPlayerSelect = useCallback((playerId: string) => {
    setSelectedReportPlayerId((current) => current === playerId ? current : playerId);
  }, []);

  const handleSaveSearchClick = () => {
    setSavedSearchNotice(`${allScoutable.length} targets saved for this scouting view.`);
    focusPlayerSearch();
  };

  const handleFooterAction = () => {
    setAssignmentHint(false);
    focusPlayerSearch();
  };

  const handleSendScout = useCallback(async (playerId: string) => {
    if (availableScouts.length === 0) {
      setPlayerSearchError(null);
      return;
    }

    const scout = availableScouts[0];
    setPlayerSearchError(null);
    setSending(playerId);
    try {
      const updated = await sendScout(scout.id, playerId);
      setPlayerSearchError(null);
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to send scout:", err);
      setPlayerSearchError(resolveTranslatedErrorMessage(getErrorMessage(err), t));
    } finally {
      setSending(null);
    }
  }, [availableScouts, onGameUpdate, t]);

  const handleStartYouthScouting = async () => {
    if (!selectedYouthScoutId) return;
    setStartingYouthSearch(true);
    setYouthSearchError(null);
    try {
      const updated = await startYouthScouting({
        scoutId: selectedYouthScoutId,
        region: youthRegion,
        objective: youthObjective,
        targetPosition: youthTargetPosition || null,
      });
      onGameUpdate(updated);
      setSelectedYouthScoutId("");
    } catch (err) {
      console.error("Failed to start youth scouting:", err);
      setYouthSearchError(resolveTranslatedErrorMessage(err, t));
    } finally {
      setStartingYouthSearch(false);
    }
  };

  const handleCancelYouthScouting = async (assignmentId: string) => {
    setYouthSearchError(null);
    try {
      const updated = await cancelYouthScouting(assignmentId);
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to cancel youth scouting:", err);
      setYouthSearchError(resolveTranslatedErrorMessage(err, t));
    }
  };

  const handleReassignYouthScouting = async (assignmentId: string, scoutId: string) => {
    setYouthSearchError(null);
    try {
      const updated = await reassignYouthScouting(assignmentId, scoutId);
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to reassign youth scouting:", err);
      setYouthSearchError(resolveTranslatedErrorMessage(err, t));
    }
  };

  return (
    <div className="relative flex min-h-max max-w-[1700px] flex-col gap-4 mx-auto">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">SCOUTING</h1>
          <p className="text-sm text-app-text-muted">Recruitment &bull; Global Network</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HeaderButton icon={<ClipboardList className="h-4 w-4 text-app-text-muted" />} onClick={handleCreateAssignmentClick}>Create Assignment</HeaderButton>
          <HeaderSelect
            icon={<Star className="h-4 w-4 text-app-text-muted" />}
            label="Shortlist"
            value={shortlistMode}
            options={["Recommended", "Transfer Listed", "Loan Listed", "High Potential"]}
            onChange={(value) => {
              setShortlistMode(value as ShortlistMode);
              focusPlayerSearch();
            }}
          />
          <HeaderSelect
            icon={<ClipboardList className="h-4 w-4 text-app-text-muted" />}
            label="Recruitment Focus"
            value={recruitmentFocus}
            options={["Balanced", "High Potential", "Ready Soon", "Transfer Listed", "Loan Listed"]}
            onChange={(value) => {
              setRecruitmentFocus(value as RecruitmentFocus);
              setPage(0);
            }}
          />
          <button
            type="button"
            onClick={handleStartSearchClick}
            className="flex items-center gap-2 rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg transition-colors hover:bg-app-green/90"
          >
            <Search className="h-4 w-4" />
            Start Search
          </button>
        </div>
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar sm:flex xl:w-[280px]">
          <RecruitmentFocusCard scoutableCount={allScoutable.length} availableScoutCount={availableScouts.length} recruitmentFocus={recruitmentFocus} roleProfileFilter={roleProfileFilter} posFilter={posFilter} />
          <ScoutingOperationsCard
            activeTab={scoutingOpsTab}
            onTabChange={setScoutingOpsTab}
            tripContent={<NextScoutingTripCard assignments={assignments} youthAssignments={youthAssignments} scouts={scouts} players={gameState.players} teams={gameState.teams} shortlistCount={listedTargets.length} />}
            youthContent={scouts.length > 0 ? (
              <ScoutingYouthRecruitmentCard
                embedded
                youthAssignments={youthAssignments}
                scouts={scouts}
                availableScouts={availableScouts}
                isStarting={startingYouthSearch}
                selectedScoutId={selectedYouthScoutId}
                region={youthRegion}
                objective={youthObjective}
                targetPosition={youthTargetPosition}
                errorMessage={youthSearchError}
                onScoutChange={setSelectedYouthScoutId}
                onRegionChange={setYouthRegion}
                onObjectiveChange={setYouthObjective}
                onTargetPositionChange={setYouthTargetPosition}
                onStartSearch={() => void handleStartYouthScouting()}
                onCancelSearch={(assignmentId) => void handleCancelYouthScouting(assignmentId)}
                onReassignSearch={(assignmentId, scoutId) => void handleReassignYouthScouting(assignmentId, scoutId)}
              />
            ) : (
              <NoScoutsCard title={t("scouting.noScouts")} hint={t("scouting.noScoutsHint")} />
            )}
          />
          {secondaryPanelsReady ? (
            <ScoutRecommendationsCard players={gameState.players} targetPlayers={allScoutable} myTeamId={myTeamId} managerTeam={myTeam} playerMetaById={playerMetaById} />
          ) : (
            <SecondaryPanelShell title="SCOUT RECOMMENDATIONS" />
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4 h-full">
          <ScoutingTemplateCard className="flex min-h-[140px] flex-col justify-between p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-app-green">PLAYER SEARCH</h2>
                  <p className="mt-0.5 text-[11px] text-app-text-muted">Filter real transfer targets from the current game world.</p>
                </div>
                <span className="rounded-full border border-app-border bg-app-bg px-3 py-1 text-[11px] font-semibold text-app-text-muted">
                  {allScoutable.length} players
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <div className="relative sm:col-span-2 xl:col-span-3 2xl:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t("scouting.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setPage(0);
                    }}
                    className="h-full min-h-[34px] w-full rounded-lg border border-app-border bg-app-bg py-2 pl-9 pr-4 text-sm text-app-text placeholder:text-app-text-muted focus:border-app-green/50 focus:outline-none"
                  />
                </div>
                <FilterSelect label="Position" value={posFilter} options={POSITION_FILTERS} onChange={(value) => { setPosFilter(value); setPage(0); }} />
                <FilterSelect label="Age" value={ageFilter} options={["Any", "U21", "U23", "Prime 24-29", "30+"]} onChange={(value) => { setAgeFilter(value as AgeFilter); setPage(0); }} />
                <FilterSelect label="Nationality" value={nationalityFilter} options={["All", "Domestic", "Foreign"]} onChange={(value) => { setNationalityFilter(value as NationalityFilter); setPage(0); }} />
                <FilterSelect label="Transfer Type" value={transferTypeFilter} options={["Any", "Transfer Listed", "Loan Listed", "Free Agent"]} onChange={(value) => { setTransferTypeFilter(value as TransferTypeFilter); setPage(0); }} />
                <FilterSelect label="Contract Status" value={contractStatusFilter} options={["Any", "Expiring 6 Months", "Expiring 12 Months", "No Contract"]} onChange={(value) => { setContractStatusFilter(value as ContractStatusFilter); setPage(0); }} />
                <FilterSelect label="Role Profile" value={roleProfileFilter} options={["Any", "High Potential", "Ready Now", "Budget", "Wonderkid"]} onChange={(value) => { setRoleProfileFilter(value as RoleProfileFilter); setPage(0); }} />
              </div>
            </div>

            {assignmentHint ? (
              <div className="mt-4 rounded border border-app-green/30 bg-app-green/10 px-3 py-2 text-xs font-semibold text-app-green">
                Choose a player in the results and use the Scout action to create a real scouting assignment with an available scout.
              </div>
            ) : null}
            {savedSearchNotice ? (
              <div className="mt-4 rounded border border-app-border bg-app-bg px-3 py-2 text-xs font-semibold text-app-text-muted">
                {savedSearchNotice}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-end gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-app-green">PLAYER SEARCH RESULTS</h2>
                <span className="pb-0.5 text-[11px] text-app-text-muted">{allScoutable.length} players found</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleSaveSearchClick} className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs text-app-text-muted transition-colors hover:bg-white/5">
                  <Save className="h-3.5 w-3.5" /> Save Search
                </button>
                <button type="button" aria-label="Show shortlist targets" title="Show shortlist targets" onClick={() => handleFooterAction()} className="rounded border border-app-border p-1.5 transition-colors hover:bg-white/5">
                  <MoreHorizontal className="h-3.5 w-3.5 text-app-text-muted" />
                </button>
              </div>
            </div>
          </ScoutingTemplateCard>


          <ScoutingTemplateCard className="flex min-h-0 flex-1 flex-col bg-app-bg">
            {playerSearchError ? (
              <p role="alert" className="px-3 pt-3 text-xs font-bold uppercase tracking-wider text-app-red">
                {playerSearchError}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1180px] whitespace-nowrap text-left text-[11px]">
                <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted shadow-sm">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <SortableHeader label={t("scouting.player")} sortKey="player" activeSort={searchSort} onSort={handleSortChange} className="min-w-[190px] px-3 py-3" />
                    <SortableHeader label={t("scouting.age")} sortKey="age" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-center" />
                    <SortableHeader label="NAT" sortKey="nat" activeSort={searchSort} onSort={handleSortChange} className="min-w-[120px] px-3 py-3" />
                    <SortableHeader label={t("scouting.team")} sortKey="team" activeSort={searchSort} onSort={handleSortChange} className="min-w-[120px] px-3 py-3" />
                    <SortableHeader label={t("scouting.pos")} sortKey="pos" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3" />
                    <SortableHeader label={t("scouting.value")} sortKey="value" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-right" />
                    <SortableHeader label="WAGE" sortKey="wage" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-right" />
                    <SortableHeader label="CA" sortKey="ca" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-center" />
                    <SortableHeader label="PA" sortKey="pa" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-center" />
                    <th className="px-3 py-3 text-center">REC</th>
                    <SortableHeader label="KNOWLEDGE" sortKey="knowledge" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-center" />
                    <SortableHeader label="INTEREST" sortKey="interest" activeSort={searchSort} onSort={handleSortChange} className="px-3 py-3 text-center" />
                    <SortableHeader label="STATUS" sortKey="status" activeSort={searchSort} onSort={handleSortChange} className="px-4 py-3 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30 text-app-text">
                  {scoutablePlayers.map((player, index) => (
                    <ScoutingPlayerRow
                      key={player.id}
                      index={safePage * SCOUTING_PAGE_SIZE + index + 1}
                      player={player}
                      meta={getPlayerMeta(playerMetaById, player)}
                      teamById={teamById}
                      locale={i18n.language}
                      isActive={player.id === selectedReportPlayerKey}
                      isScouting={alreadyScoutingIds.has(player.id)}
                      sendingPlayerId={sending}
                      availableScoutCount={availableScouts.length}
                      onBidPlayer={openBidNegotiation}
                      onSelectReportPlayer={handleReportPlayerSelect}
                      onSelectPlayer={onSelectPlayer}
                      onSelectTeam={onSelectTeam}
                      onSendScout={handleSendScout}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
              {scoutablePlayers.length === 0 ? (
                <p className="py-4 text-center text-sm text-app-text-muted">{t("scouting.noPlayersFound")}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t border-app-border/50 p-2.5 text-[11px] text-app-text-muted">
              <span>{allScoutable.length} players</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="px-2 py-1 transition-colors hover:text-white disabled:opacity-30">&lt;</button>
                <span className="flex h-6 min-w-6 items-center justify-center rounded bg-app-green px-2 font-bold text-app-bg">{safePage + 1}</span>
                <span className="px-1">/</span>
                <span className="px-1 font-mono text-app-text-muted">{totalPages}</span>
                <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} className="px-2 py-1 transition-colors hover:text-white disabled:opacity-30">&gt;</button>
              </div>
            </div>
          </ScoutingTemplateCard>
        </section>

        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[420px]">
          <ScoutingReportSidebar
            selectedPlayerId={selectedReportPlayerId}
            fallbackPlayerId={initialReportPlayer?.id ?? null}
            playerById={playerById}
            playerMetaById={playerMetaById}
            scoutReports={completedScoutReports}
            assignmentByPlayerId={assignmentByPlayerId}
            locale={i18n.language}
            t={t}
          />
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-4">
        <ActiveAssignmentsCard assignments={assignments} scouts={scouts} players={gameState.players} teams={gameState.teams} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} onFooterClick={() => handleFooterAction()} t={t} />
        <ScoutNetworkCard scouts={scouts} assignments={assignments} onFooterClick={() => handleFooterAction()} t={t} />
        {secondaryPanelsReady ? <MarketInsightsCard players={baseScoutable} teamById={teamById} playerMetaById={playerMetaById} /> : <SecondaryPanelShell title="MARKET INSIGHTS" compact />}
        {secondaryPanelsReady ? <ShortlistedPlayersCard players={listedTargets} teamById={teamById} playerMetaById={playerMetaById} mode={shortlistMode} onFooterClick={() => handleFooterAction()} onSelectPlayer={onSelectPlayer} /> : <SecondaryPanelShell title="SHORTLISTED PLAYERS" />}
      </div>

      {bidTarget && (
        <TransferBidModal
          bidTarget={bidTarget}
          teams={gameState.teams}
          bidAmount={bidAmount}
          onBidAmountChange={setBidAmount}
          myTeam={myTeam}
          bidFee={bidFee}
          bidProjection={bidProjection}
          bidFeedback={bidFeedback}
          activeBidOffer={activeBidOffer}
          hasExistingOffer={hasExistingOffer}
          bidResult={bidResult}
          bidLoading={bidLoading}
          bidSubmitDisabled={bidSubmitDisabled}
          onSubmit={handleMakeBid}
          onClose={closeBidNegotiation}
        />
      )}
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

function ScoutingTemplateCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-app-border bg-app-card ${className}`}>{children}</div>;
}

function HeaderButton({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5">{icon}{children}</button>;
}

function HeaderSelect({ icon, label, value, options, onChange }: { icon: ReactNode; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const minWidth = label === "Recruitment Focus" ? "min-w-[300px]" : "min-w-[220px]";

  return (
    <div className={`flex ${minWidth} items-center rounded-lg border border-app-border bg-app-card transition-colors hover:bg-white/5`}>
      <span className="flex shrink-0 items-center gap-2 border-r border-app-border/50 px-3 py-2 text-sm font-medium text-app-text">{icon}{label}</span>
      <Select
        fullWidth
        selectSize="sm"
        variant="subtle"
        value={value}
        aria-label={label}
        wrapperClassName="flex-1"
        className="border-0 bg-transparent"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate text-[10px] font-heading uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <Select
        fullWidth
        selectSize="sm"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </div>
  );
}

function SortableHeader({ label, sortKey, activeSort, onSort, className = "" }: { label: string; sortKey: SearchSortKey; activeSort: { key: SearchSortKey; direction: SortDirection }; onSort: (key: SearchSortKey) => void; className?: string }) {
  const isActive = activeSort.key === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-app-green ${isActive ? "text-app-green" : ""}`}
      >
        <span>{label}</span>
        <span className="text-[8px] leading-none">{isActive ? (activeSort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function StarRating({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div className="flex justify-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={index < Math.round(clamped) ? "h-3 w-3 fill-amber-500 text-amber-500" : "h-3 w-3 fill-app-border text-app-border"} />
      ))}
    </div>
  );
}

const ScoutingPlayerRow = memo(function ScoutingPlayerRow({
  index,
  player,
  meta,
  teamById,
  locale,
  isActive,
  isScouting,
  sendingPlayerId,
  availableScoutCount,
  onBidPlayer,
  onSelectReportPlayer,
  onSelectPlayer,
  onSelectTeam,
  onSendScout,
  t,
}: {
  index: number;
  player: PlayerData;
  meta: ScoutingPlayerMeta;
  teamById: Map<string, TeamData>;
  locale: string;
  isActive: boolean;
  isScouting: boolean;
  sendingPlayerId: string | null;
  availableScoutCount: number;
  onBidPlayer?: (player: PlayerData) => void;
  onSelectReportPlayer: (id: string) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
  onSendScout: (playerId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const team = player.team_id ? teamById.get(player.team_id) ?? null : null;
  const teamName = meta.teamName || team?.name || (player.team_id ? t("common.team") : t("common.freeAgent"));
  const status = getPlayerScoutStatus(meta.overall, isScouting);
  const scoutState = isScouting ? "already-assigned" : sendingPlayerId === player.id ? "busy" : availableScoutCount === 0 ? "unavailable" : "ready";
  const contextItems = [
    ...(onSelectPlayer ? [buildViewProfileMenuItem(t, () => onSelectPlayer(player.id))] : []),
    ...(player.team_id && onSelectTeam ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))] : []),
    buildDividerMenuItem(),
    ...(player.team_id && onBidPlayer ? [buildMakeTransferBidMenuItem(t, () => onBidPlayer(player))] : []),
    buildScoutPlayerMenuItem(t, scoutState, () => onSendScout(player.id)),
  ];

  const row = (
    <tr className={`group cursor-pointer transition-colors hover:bg-white/5 ${isActive ? "bg-app-green/10" : ""}`} onClick={() => onSelectReportPlayer(player.id)} onDoubleClick={() => onSelectPlayer?.(player.id)}>
      <td className="px-4 py-3 text-app-text-muted">{index}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-bg">
            <UserPlus className="h-3 w-3 text-app-text-muted/50" />
          </div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelectPlayer?.(player.id); }} className="text-left text-sm font-semibold text-app-text transition-colors group-hover:text-app-green">
            {player.full_name}
          </button>
        </div>
      </td>
      <td className="px-3 py-3 text-center text-app-text">{meta.age}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <CountryFlag code={player.nationality} locale={locale} className="text-sm leading-none" />
          <span className="max-w-[100px] truncate text-[10px] font-bold text-app-text-muted">{countryName(player.nationality, locale)}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {team ? <TeamLogo team={team} size="sm" /> : <div className="h-4 w-4 shrink-0 rounded-full border border-white/20 bg-blue-600" />}
          <button type="button" onClick={(event) => { event.stopPropagation(); player.team_id && onSelectTeam?.(player.team_id); }} className="max-w-[110px] truncate text-xs text-app-text-muted hover:text-app-green">{teamName}</button>
        </div>
      </td>
      <td className="px-3 py-3 text-app-text-muted">{translatePositionAbbreviation(t, player.natural_position || player.position)}</td>
      <td className="px-3 py-3 text-right font-medium">{formatVal(player.market_value)}</td>
      <td className="px-3 py-3 text-right text-app-text-muted">{formatVal(player.wage)} p/w</td>
      <td className="px-3 py-3"><StarRating rating={meta.overall / 20} /></td>
      <td className="px-3 py-3"><StarRating rating={Math.min(5, meta.potential / 18)} /></td>
      <td className="px-3 py-3"><StarRating rating={Math.min(5, meta.overall / 19)} /></td>
      <td className="px-3 py-3 text-center font-mono text-[10px]">
        <div className="flex items-center justify-center gap-1 text-app-green">
          <div className="h-3 w-3 animate-spin-slow rounded-full border-2 border-app-green border-r-transparent" />
          {isScouting ? "100%" : `${Math.min(99, Math.max(55, meta.overall + 15))}%`}
        </div>
      </td>
      <td className="px-3 py-3 text-center"><span className={status.interestClass}>{status.interest} <ArrowUpRight className="h-3 w-3" /></span></td>
      <td className="px-4 py-3 text-center">
        {isScouting ? (
          <span className="rounded border border-app-green/20 bg-app-green/10 px-2 py-0.5 text-[10px] font-bold text-app-green">{t("scouting.scoutingInProgress")}</span>
        ) : availableScoutCount === 0 ? (
          <span className="rounded border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">Watched</span>
        ) : (
          <button type="button" aria-label={t("scouting.scoutBtn")} disabled={sendingPlayerId === player.id} onClick={(event) => { event.stopPropagation(); onSendScout(player.id); }} className={status.statusClass}>
            {sendingPlayerId === player.id ? "..." : status.label}
          </button>
        )}
      </td>
    </tr>
  );

  return <ContextMenu items={contextItems}>{row}</ContextMenu>;
});

function getPlayerScoutStatus(overall: number, isScouting: boolean) {
  if (overall >= 72) {
    return {
      interest: "Very High",
      interestClass: "inline-flex items-center justify-center gap-1 text-[10px] font-bold text-app-green",
      label: isScouting ? "Shortlisted" : "High Priority",
      statusClass: "rounded border border-red-500/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50",
    };
  }

  if (overall >= 60) {
    return {
      interest: "High",
      interestClass: "inline-flex items-center justify-center gap-1 text-[10px] font-bold text-app-green",
      label: isScouting ? "Shortlisted" : "Scout",
      statusClass: "rounded border border-app-green/20 bg-app-green/10 px-2 py-0.5 text-[10px] font-bold text-app-green transition-colors hover:bg-app-green/20 disabled:opacity-50",
    };
  }

  return {
    interest: "Medium",
    interestClass: "inline-flex items-center justify-center gap-1 text-[10px] font-bold text-amber-500",
    label: "Watched",
    statusClass: "rounded border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 transition-colors hover:bg-indigo-400/20 disabled:opacity-50",
  };
}

function RecruitmentFocusCard({ scoutableCount, availableScoutCount, recruitmentFocus, roleProfileFilter, posFilter }: { scoutableCount: number; availableScoutCount: number; recruitmentFocus: RecruitmentFocus; roleProfileFilter: RoleProfileFilter; posFilter: string }) {
  const ageRange = recruitmentFocus === "Ready Soon" ? "24 - 29" : recruitmentFocus === "High Potential" ? "16 - 23" : "Any";
  const tacticalFit = posFilter === "All" ? roleProfileFilter : posFilter;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle title="RECRUITMENT FOCUS" action={recruitmentFocus} />
      <ScoutingTemplateCard className="flex flex-col text-xs">
        <div className="flex flex-col gap-3 p-4">
          <InfoRow label="Active Focus" value={recruitmentFocus} />
          <InfoRow label="Preferred Age Range" value={ageRange} />
          <InfoRow label="Role Profile" value={roleProfileFilter} />
          <InfoRow label="Tactical Fit" value={tacticalFit} />
          <div className="h-1 overflow-hidden rounded-full bg-app-bg"><div className="h-full bg-app-green" style={{ width: `${Math.min(100, Math.max(10, scoutableCount * 8))}%` }} /></div>
          <InfoRow label="Matching Players" value={String(scoutableCount)} />
          <InfoRow label="Available Scouts" value={String(availableScoutCount)} />
        </div>
      </ScoutingTemplateCard>
    </div>
  );
}

function ScoutingOperationsCard({ activeTab, onTabChange, tripContent, youthContent }: { activeTab: ScoutingOpsTab; onTabChange: (tab: ScoutingOpsTab) => void; tripContent: ReactNode; youthContent: ReactNode }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SCOUTING OPS</h3>
      <ScoutingTemplateCard className="flex flex-col overflow-visible">
        <div className="grid grid-cols-2 border-b border-app-border/50 bg-app-bg/40 p-1">
          {(["Trip", "Youth"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={activeTab === tab
                ? "rounded-md bg-app-green px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-app-bg"
                : "rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-app-text-muted transition-colors hover:bg-white/5 hover:text-white"}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === "Trip" ? tripContent : youthContent}
      </ScoutingTemplateCard>
    </div>
  );
}

function NextScoutingTripCard({ assignments, youthAssignments, scouts, players, teams, shortlistCount }: { assignments: ScoutingAssignment[]; youthAssignments: Array<{ scout_id: string; days_remaining: number; region?: string; objective?: string; target_position?: string | null }>; scouts: StaffData[]; players: PlayerData[]; teams: TeamData[]; shortlistCount: number }) {
  const youthAssignment = youthAssignments[0];
  const seniorAssignment = assignments[0];
  const assignment = youthAssignment ?? seniorAssignment;
  const scout = assignment ? scouts.find((candidate) => candidate.id === assignment.scout_id) : null;
  const player = seniorAssignment ? players.find((candidate) => candidate.id === seniorAssignment.player_id) : null;
  const team = player?.team_id ? getTeamName(teams, player.team_id) : null;
  const title = youthAssignment
    ? `${youthAssignment.region ?? "Domestic"} youth search`
    : player
      ? `${player.match_name} report`
      : "No active trip";
  const detail = youthAssignment
    ? `${youthAssignment.objective ?? "Balanced"}${youthAssignment.target_position ? ` • ${youthAssignment.target_position}` : ""}`
    : team ?? "Start a youth search or send a scout";

  return (
    <div className="flex gap-3 p-3">
      <div className="flex h-6 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-app-border bg-app-bg opacity-80">
        {scout ? <CountryFlag code={scout.nationality} className="text-base" /> : <Globe className="h-4 w-4 text-app-text-muted" />}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-app-text">{title}</span>
        <span className="mt-0.5 truncate text-[11px] text-app-text-muted">{scout ? `${scout.first_name} ${scout.last_name}` : "No scout assigned"} <span className="text-app-text/60">({assignment?.days_remaining ?? 0} days)</span></span>
        <span className="truncate text-[11px] text-app-text-muted">{detail} &bull; {shortlistCount} targets</span>
      </div>
    </div>
  );
}

function ScoutRecommendationsCard({ players, targetPlayers, myTeamId, managerTeam, playerMetaById }: { players: PlayerData[]; targetPlayers: PlayerData[]; myTeamId: string; managerTeam: TeamData | null; playerMetaById: Map<string, ScoutingPlayerMeta> }) {
  const myPlayers = players.filter((player) => player.team_id === myTeamId);
  const lowDepthPositions = ["Goalkeeper", "Defender", "Midfielder", "Forward"].filter((position) => myPlayers.filter((player) => player.position === position || player.natural_position === position).length < 2).length;
  const highPriority = targetPlayers.filter((player) => {
    const meta = getPlayerMeta(playerMetaById, player);
    return meta.potential >= 75 || meta.overall >= 70;
  }).length;
  const affordable = targetPlayers.filter((player) => !managerTeam || player.market_value <= managerTeam.transfer_budget).length;
  const medianValue = medianMarketValue(targetPlayers);
  const hiddenGems = targetPlayers.filter((player) => {
    const meta = getPlayerMeta(playerMetaById, player);
    return meta.age <= 23 && meta.potential >= 70 && player.market_value <= medianValue;
  }).length;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SCOUT RECOMMENDATIONS</h3>
      <ScoutingTemplateCard className="flex flex-col text-[11px]">
        <div className="flex flex-col gap-0.5 p-2">
          <RecommendationRow icon={<AlertCircle className="h-3.5 w-3.5 text-app-red" />} label="Low Squad Depth" value={`${lowDepthPositions} positions`} tone="text-app-red" />
          <RecommendationRow icon={<Star className="h-3.5 w-3.5 fill-amber-500/20 text-amber-500" />} label="High Priority Targets" value={`${highPriority} players`} tone="text-amber-500" />
          <RecommendationRow icon={<ClipboardList className="h-3.5 w-3.5 text-app-green" />} label="Affordable Signings" value={`${affordable} players`} tone="text-app-green" />
          <RecommendationRow icon={<Search className="h-3.5 w-3.5 text-indigo-400" />} label="Hidden Gems" value={`${hiddenGems} players`} tone="text-indigo-400" />
        </div>
      </ScoutingTemplateCard>
    </div>
  );
}

const ScoutingReportSidebar = memo(function ScoutingReportSidebar({ selectedPlayerId, fallbackPlayerId, playerById, playerMetaById, scoutReports, assignmentByPlayerId, locale, t }: { selectedPlayerId: string | null; fallbackPlayerId: string | null; playerById: Map<string, PlayerData>; playerMetaById: Map<string, ScoutingPlayerMeta>; scoutReports: Map<string, ScoutReportData>; assignmentByPlayerId: Map<string, ScoutingAssignment>; locale: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  const playerId = selectedPlayerId ?? fallbackPlayerId;
  const player = playerId ? playerById.get(playerId) ?? null : null;
  const meta = player ? getPlayerMeta(playerMetaById, player) : null;

  return (
    <PlayerReportCard
      player={player}
      meta={meta}
      scoutReport={player ? scoutReports.get(player.id) ?? null : null}
      activeAssignment={player ? assignmentByPlayerId.get(player.id) ?? null : null}
      locale={locale}
      t={t}
    />
  );
});

const PlayerReportCard = memo(function PlayerReportCard({ player, meta, scoutReport, activeAssignment, locale, t }: { player: PlayerData | null; meta: ScoutingPlayerMeta | null; scoutReport: ScoutReportData | null; activeAssignment: ScoutingAssignment | null; locale: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  if (!player || !meta) {
    return <ScoutingTemplateCard className="p-4 text-sm text-app-text-muted">No player report available</ScoutingTemplateCard>;
  }

  const reportName = scoutReport?.player_name ?? player.match_name;
  const nationality = scoutReport?.nationality ?? meta.nationality;
  const position = scoutReport?.position ?? meta.position;
  const team = scoutReport?.team_name ?? (meta.teamName || t("common.freeAgent"));
  const age = scoutReport?.dob ? calcAge(scoutReport.dob) : meta.age;

  if (activeAssignment) {
    return (
      <ScoutingTemplateCard className="flex flex-col p-4">
        <div className="flex items-start justify-between">
          <span className="mb-4 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER REPORT</span>
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">In Progress</div>
        </div>
        <LockedReportHeader reportName={reportName} nationality={nationality} position={position} team={team} age={age} locale={locale} t={t} />
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-bold text-amber-400">{t("scouting.scoutingInProgress")}</p>
          <p className="mt-1 text-amber-100/80">{t("scouting.daysLeft", { days: activeAssignment.days_remaining })}. Full report will unlock when the scout returns.</p>
        </div>
      </ScoutingTemplateCard>
    );
  }

  if (!scoutReport) {
    return (
      <ScoutingTemplateCard className="flex flex-col p-4">
        <div className="flex items-start justify-between">
          <span className="mb-4 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER REPORT</span>
          <div className="rounded border border-app-border bg-app-bg px-2 py-0.5 text-xs font-bold text-app-text-muted">Locked</div>
        </div>
        <LockedReportHeader reportName={reportName} nationality={nationality} position={position} team={team} age={age} locale={locale} t={t} />
        <div className="mt-4 rounded-lg border border-app-border bg-app-bg/60 p-3 text-xs text-app-text-muted">
          Send a scout to unlock the backend scout report. Detailed attributes, rating, potential, and verdict stay hidden until a report message is generated.
        </div>
      </ScoutingTemplateCard>
    );
  }

  const reportGrade = getScoutReportGrade(scoutReport);
  const reportSummary = getScoutReportSummary(scoutReport);
  const attributeItems = buildScoutReportAttributeItems(scoutReport);

  return (
    <ScoutingTemplateCard className="flex flex-col p-4">
      <div className="flex items-start justify-between">
        <span className="mb-4 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER REPORT</span>
        <div className="rounded border border-app-green/30 bg-app-green/10 px-2 py-0.5 text-xs font-bold text-app-green">{reportGrade} Report</div>
      </div>
      <div className="flex gap-4">
        <div className="flex w-24 shrink-0 flex-col gap-2">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-app-border bg-app-bg">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900 to-[#1e293b]" />
            <UserPlus className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/30" />
            <div className="absolute left-1 top-1 text-[40px] font-bold leading-none text-white/20">{translatePositionAbbreviation(t, position)}</div>
          </div>
          <StarRating rating={(scoutReport.avg_rating ?? 0) / 20} />
          <span className="text-center text-[10px] leading-tight text-app-text-muted">{reportSummary}</span>
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-xl font-bold leading-none text-app-text">{reportName}</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-app-text-muted">
            <CountryFlag code={nationality} locale={locale} className="text-sm leading-none" />
            <span>{countryName(nationality, locale)}</span>
          </div>
          <span className="mt-1 text-xs text-app-text-muted">{team}</span>
          <span className="mt-1 text-xs text-app-text-muted opacity-80">{translatePositionLabel(t, position)}</span>
          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2">
            <ReportStat label="Age" value={String(age)} />
            <ReportStat label="Scout Rating" value={scoutReport.rating_key} />
            <ReportStat label="Potential" value={scoutReport.potential_key} />
            <ReportStat label="Confidence" value={scoutReport.confidence_key} />
            <ReportStat label="Overall" value={formatOptionalReportValue(scoutReport.avg_rating)} />
            <ReportStat label="Condition" value={formatOptionalReportValue(scoutReport.condition)} />
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-app-border/50 pt-4">
        <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SCOUTED ATTRIBUTES</span>
        <div className="flex gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <ScoutReportAttrList title="REPORT" items={attributeItems.slice(0, 3)} />
            <ScoutReportAttrList title="PROFILE" items={attributeItems.slice(3)} />
          </div>
          <DeferredScoutReportRadar report={scoutReport} />
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t border-app-border/50 pt-4">
        <div className="flex flex-1 flex-col gap-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SCOUT REPORT SUMMARY</span>
          <ReportProCon type="pro" text={`Current rating: ${scoutReport.rating_key}.`} />
          <ReportProCon type="pro" text={`Potential: ${scoutReport.potential_key}.`} />
          <ReportProCon type="pro" text={`Report confidence: ${scoutReport.confidence_key}.`} />
          <div className="mt-2 flex items-center justify-between border-t border-app-border/30 pt-2">
            <span className="text-xs font-bold">Overall Rating</span>
            <StarRating rating={(scoutReport.avg_rating ?? 0) / 20} />
          </div>
        </div>
        <div className="flex w-[160px] shrink-0 flex-col gap-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">BACKEND REPORT</span>
          <MiniInfo label="Pace" value={formatOptionalReportValue(scoutReport.pace)} tone={getReportValueTone(scoutReport.pace)} />
          <MiniInfo label="Shooting" value={formatOptionalReportValue(scoutReport.shooting)} tone={getReportValueTone(scoutReport.shooting)} />
          <MiniInfo label="Passing" value={formatOptionalReportValue(scoutReport.passing)} tone={getReportValueTone(scoutReport.passing)} />
          <MiniInfo label="Dribbling" value={formatOptionalReportValue(scoutReport.dribbling)} tone={getReportValueTone(scoutReport.dribbling)} />
          <MiniInfo label="Defending" value={formatOptionalReportValue(scoutReport.defending)} tone={getReportValueTone(scoutReport.defending)} />
          <MiniInfo label="Physical" value={formatOptionalReportValue(scoutReport.physical)} tone={getReportValueTone(scoutReport.physical)} />
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t border-app-border/50 pt-4">
        <div className="flex w-[160px] shrink-0 flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ANALYST VERDICT</span>
          <div className="mt-1 flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-app-green bg-app-green/10 text-lg font-bold text-app-green">
              {formatOptionalReportValue(scoutReport.avg_rating)}
              <TrendingUp className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-app-bg text-app-green" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold leading-tight text-app-green">{reportSummary}</span>
              <span className="mt-1 text-[10px] leading-tight text-app-text-muted">Only discovered backend report fields are shown.</span>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 border-l border-app-border/50 pl-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER COMPARISON</span>
          <span className="text-[10px] text-app-text-muted">Comparison locked until the backend exposes comparable scout-report data.</span>
          <ComparisonMetric label="Current Ability" rating={(scoutReport.avg_rating ?? 0) / 20} pct={scoutReport.avg_rating ?? 0} />
          <ComparisonMetric label="Condition" rating={(scoutReport.condition ?? 0) / 20} pct={scoutReport.condition ?? 0} />
          <ComparisonMetric label="Morale" rating={(scoutReport.morale ?? 0) / 20} pct={scoutReport.morale ?? 0} />
        </div>
      </div>
    </ScoutingTemplateCard>
  );
});

function AssignmentsTable({ assignments, scouts, players, teams, onSelectPlayer, onSelectTeam, t, limit }: { assignments: ScoutingAssignment[]; scouts: StaffData[]; players: PlayerData[]; teams: TeamData[]; onSelectPlayer?: (id: string) => void; onSelectTeam?: (id: string) => void; t: (key: string, params?: Record<string, string | number>) => string; limit?: number }) {
  const visibleAssignments = limit ? assignments.slice(0, limit) : assignments;

  return (
    <>
      <table className="w-full whitespace-nowrap text-left">
        <thead>
          <tr className="border-b border-app-border/30 text-[9px] font-bold uppercase text-app-text-muted">
            <th className="px-3 py-3">PLAYER</th>
            <th className="px-3 py-3">SCOUT</th>
            <th className="px-3 py-3">TEAM</th>
            <th className="px-3 py-3 text-right">TIME REMAINING</th>
            <th className="px-3 py-3">FOCUS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border/20 text-app-text">
          {visibleAssignments.map((assignment) => {
            const player = players.find((candidate) => candidate.id === assignment.player_id);
            const scout = scouts.find((candidate) => candidate.id === assignment.scout_id);
            if (!player || !scout) return null;
            const team = player.team_id ? getTeamName(teams, player.team_id) : t("common.freeAgent");
            const row = (
              <tr key={assignment.id} className="group cursor-pointer transition-colors hover:bg-white/5" data-testid={`scouting-assignment-${assignment.id}`}>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-3 w-3.5 shrink-0 overflow-hidden rounded-[2px] border border-app-border bg-blue-500" /><button type="button" onClick={() => onSelectPlayer?.(player.id)} className="text-[10px] font-semibold hover:text-app-green">{player.full_name}</button></div></td>
                <td className="px-3 py-3 text-[10px] text-app-text-muted">{scout.first_name} {scout.last_name}</td>
                <td className="px-3 py-3"><button type="button" onClick={() => player.team_id && onSelectTeam?.(player.team_id)} className="max-w-[120px] truncate text-[10px] text-app-text-muted hover:text-app-green">{team}</button></td>
                <td className="px-3 py-3 text-right text-[10px] font-bold text-amber-500">{t("scouting.daysLeft", { days: assignment.days_remaining })}</td>
                <td className="px-3 py-3"><span className="block max-w-[80px] truncate text-[10px] text-app-text-muted" title={player.position}>{translatePositionAbbreviation(t, player.position)}</span></td>
              </tr>
            );
            const items = [
              ...(onSelectPlayer ? [buildViewProfileMenuItem(t, () => onSelectPlayer(player.id))] : []),
              ...(player.team_id && onSelectTeam ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))] : []),
            ];
            return items.length > 0 ? <ContextMenu items={items} key={assignment.id}>{row}</ContextMenu> : row;
          })}
        </tbody>
      </table>
      {assignments.length === 0 ? <p className="p-3 text-[11px] text-app-text-muted">No active scouting assignments</p> : null}
    </>
  );
}

function ActiveAssignmentsCard({ assignments, scouts, players, teams, onSelectPlayer, onSelectTeam, onFooterClick, t }: { assignments: ScoutingAssignment[]; scouts: StaffData[]; players: PlayerData[]; teams: TeamData[]; onSelectPlayer?: (id: string) => void; onSelectTeam?: (id: string) => void; onFooterClick: () => void; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <BottomSection title="ACTIVE ASSIGNMENTS" footer="View All Assignments" onFooterClick={onFooterClick}>
      <AssignmentsTable assignments={assignments} scouts={scouts} players={players} teams={teams} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} t={t} limit={5} />
    </BottomSection>
  );
}

function ScoutNetworkCard({ scouts, assignments, onFooterClick, t }: { scouts: StaffData[]; assignments: ScoutingAssignment[]; onFooterClick: () => void; t: (key: string) => string }) {
  return (
    <BottomSection title="SCOUT NETWORK" footer="Manage Network" onFooterClick={onFooterClick}>
      <div className="flex flex-col gap-3">
        {scouts.slice(0, 5).map((scout) => {
          const count = scoutAssignmentCount(assignments, scout.id);
          const max = scoutMaxSlots(scout.attributes.judging_ability);
          return <NetworkRow key={scout.id} name={`${scout.first_name} ${scout.last_name}`} role={t("scouting.scouts")} region={scout.nationality} pct={scout.attributes.judging_ability} slots={`${count}/${max}`} />;
        })}
        {scouts.length === 0 ? <p className="text-[11px] text-app-text-muted">No scout network</p> : null}
      </div>
    </BottomSection>
  );
}

function MarketInsightsCard({ players, teamById, playerMetaById }: { players: PlayerData[]; teamById: Map<string, TeamData>; playerMetaById: Map<string, ScoutingPlayerMeta> }) {
  const markets = useMemo(() => buildMarketRows(players, teamById), [players, teamById]);
  const ageBands = useMemo(() => buildAgeBands(players, playerMetaById), [players, playerMetaById]);

  return (
    <BottomSection title="MARKET INSIGHTS" compact>
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[9px] font-bold uppercase text-app-text-muted">Top Target Markets</span>
          <span className="text-[9px] text-app-text-muted opacity-80">Current scoutable pool</span>
          <div className="mt-2 flex flex-col gap-1.5">
            {markets.map((market) => <LeagueBar key={market.name} name={market.name} val={formatVal(market.value)} pct={market.pct} />)}
          </div>
        </div>
        <div className="w-[120px] shrink-0 border-l border-app-border/50 pl-3">
          <span className="text-[9px] font-bold uppercase text-app-text-muted">Target Pool</span>
          <span className="block text-[9px] text-app-text-muted opacity-80">Market by age</span>
          <div className="mt-2 flex h-[90px] w-full items-end gap-1">
            {ageBands.map((band) => <div key={band.label} className="flex flex-1 flex-col items-center justify-end gap-1"><div className="w-full rounded-t bg-app-green" style={{ height: `${band.pct}%` }} /><span className="text-[7px] text-app-text-muted">{band.label}</span></div>)}
          </div>
        </div>
      </div>
    </BottomSection>
  );
}

function ShortlistedPlayersCard({ players, teamById, playerMetaById, mode, onFooterClick, onSelectPlayer }: { players: PlayerData[]; teamById: Map<string, TeamData>; playerMetaById: Map<string, ScoutingPlayerMeta>; mode: ShortlistMode; onFooterClick: () => void; onSelectPlayer?: (id: string) => void }) {
  return (
    <BottomSection title="SHORTLISTED PLAYERS" footer="View All Shortlists" onFooterClick={onFooterClick}>
      <span className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-app-text-muted">Source: {mode}</span>
      <div className="flex h-full gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {players.length > 0 ? players.map((player) => <ShortlistCard key={player.id} player={player} meta={getPlayerMeta(playerMetaById, player)} team={player.team_id ? teamById.get(player.team_id) : undefined} onSelectPlayer={onSelectPlayer} />) : <span className="py-6 text-xs text-app-text-muted">No matching listed targets.</span>}
      </div>
    </BottomSection>
  );
}

function BottomSection({ title, children, footer, onFooterClick, compact = false }: { title: string; children: ReactNode; footer?: string; onFooterClick?: () => void; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      <ScoutingTemplateCard className={`flex flex-1 flex-col ${compact ? "p-3 pb-2" : "p-3"} text-[11px]`}>
        {children}
        {footer ? (
          <button type="button" aria-label={footer} onClick={onFooterClick} className="group mt-auto flex items-center justify-center gap-1.5 border-t border-app-border/50 pt-2 text-[10px] text-app-text-muted transition-colors hover:bg-white/5 hover:text-white">
            <ChevronRight className="h-3.5 w-3.5 transition-colors group-hover:text-white" />
            {footer}
          </button>
        ) : null}
      </ScoutingTemplateCard>
    </div>
  );
}

function SecondaryPanelShell({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <BottomSection title={title} compact={compact}>
      <div className="min-h-20 text-[11px] text-app-text-muted" />
    </BottomSection>
  );
}

function NoScoutsCard({ title, hint }: { title: string; hint: string }) {
  return (
    <ScoutingTemplateCard className="p-6 text-center">
      <Globe className="mx-auto h-9 w-9 text-app-text-muted" />
      <p className="mt-3 text-sm font-semibold text-app-text">{title}</p>
      <p className="mt-1 text-xs text-app-text-muted">{hint}</p>
    </ScoutingTemplateCard>
  );
}

function SectionTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      <button type="button" className="flex items-center gap-1 text-[10px] text-app-text-muted transition-colors hover:text-white"><PenTool className="h-3 w-3" /> {action}</button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-app-text-muted"><span>{label}</span><span className="font-medium text-app-text">{value}</span></div>;
}

function RecommendationRow({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between rounded p-2 transition-colors hover:bg-white/5"><div className="flex items-center gap-2">{icon}<span className="text-app-text-muted">{label}</span></div><span className={`font-bold ${tone}`}>{value}</span></div>;
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col"><span className="text-[9px] text-app-text-muted">{label}</span><span className="text-xs">{value}</span></div>;
}

function LockedReportHeader({ reportName, nationality, position, team, age, locale, t }: { reportName: string; nationality: string; position: string; team: string; age: number; locale: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div className="flex gap-4">
      <div className="flex w-24 shrink-0 flex-col gap-2">
        <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-app-border bg-app-bg opacity-75">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-[#1e293b]" />
          <UserPlus className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/20" />
          <div className="absolute left-1 top-1 text-[40px] font-bold leading-none text-white/10">{translatePositionAbbreviation(t, position)}</div>
        </div>
        <span className="rounded border border-app-border bg-app-bg px-2 py-1 text-center text-[10px] font-bold text-app-text-muted">Report locked</span>
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-xl font-bold leading-none text-app-text">{reportName}</span>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-app-text-muted">
          <CountryFlag code={nationality} locale={locale} className="text-sm leading-none" />
          <span>{countryName(nationality, locale)}</span>
        </div>
        <span className="mt-1 text-xs text-app-text-muted">{team}</span>
        <span className="mt-1 text-xs text-app-text-muted opacity-80">{translatePositionLabel(t, position)}</span>
        <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2">
          <ReportStat label="Age" value={String(age)} />
          <ReportStat label="Scout Rating" value="Unknown" />
          <ReportStat label="Potential" value="Unknown" />
          <ReportStat label="Confidence" value="Unknown" />
        </div>
      </div>
    </div>
  );
}

function ScoutReportAttrList({ title, items }: { title: string; items: Array<[string, number | null]> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold uppercase text-app-text-muted">{title}</span>
      {items.map(([name, value]) => <div key={name} className="flex items-center justify-between text-[10px]"><span className="capitalize text-app-text-muted">{name}</span><span className={getReportValueTone(value)}>{formatOptionalReportValue(value)}</span></div>)}
    </div>
  );
}

function DeferredScoutReportRadar({ report }: { report: ScoutReportData }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return requestIdleTask(() => setReady(true));
  }, [report]);

  if (!ready) return <div className="h-[100px] w-[100px] shrink-0 rounded border border-app-border/50" />;

  return <ScoutReportRadar report={report} />;
}

function ScoutReportRadar({ report }: { report: ScoutReportData }) {
  const radarStats = buildScoutReportAttributeItems(report).map(([subject, value]) => ({ subject: subject.slice(0, 3).toUpperCase(), A: value ?? 0 }));

  return (
    <div className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded border border-app-border/50">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarStats}>
          <PolarGrid stroke="#232d3b" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 7 }} />
          <Radar name="Report" dataKey="A" stroke="#2dd4bf" strokeWidth={1} fill="#2dd4bf" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniInfo({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex justify-between text-[10px]"><span className="text-app-text-muted">{label}</span><span className={`font-medium ${tone}`}>{value}</span></div>;
}

function ComparisonMetric({ label, rating, pct }: { label: string; rating: number; pct: number }) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <span className="text-[9px] text-app-text-muted">{label}</span>
      <div className="flex gap-1">
        <StarRating rating={rating} />
        <div className="ml-1 flex h-1.5 w-16 self-center overflow-hidden rounded bg-app-bg"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

function ReportProCon({ type, text }: { type: "pro" | "con"; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className={type === "pro" ? "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-app-green/20 text-app-green" : "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-red-500/20 text-red-500"}>
        {type === "pro" ? <ChevronRight className="h-2.5 w-2.5" /> : <div className="h-0.5 w-1.5 rounded-full bg-red-500" />}
      </div>
      <span className="text-[10px] leading-tight text-app-text-muted">{text}</span>
    </div>
  );
}

function NetworkRow({ name, role, region, pct, slots }: { name: string; role: string; region: string; pct: number; slots: string }) {
  return (
    <div className="group flex cursor-pointer items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-bg"><UserPlus className="h-3 w-3 text-app-text-muted/50" /></div>
        <div className="flex flex-col"><span className="text-[10px] font-bold transition-colors group-hover:text-app-green">{name}</span><span className="text-[9px] text-app-text-muted">{role} &bull; {region} &bull; {slots}</span></div>
      </div>
      <div className="flex items-center gap-2"><div className="h-1 w-12 overflow-hidden rounded-full bg-app-bg"><div className="h-full bg-app-green" style={{ width: `${pct}%` }} /></div><span className="font-mono text-[10px] text-app-green">{pct}</span></div>
    </div>
  );
}

function LeagueBar({ name, val, pct }: { name: string; val: string; pct: number }) {
  return <div className="flex items-center gap-2"><span className="w-20 shrink-0 truncate text-app-text-muted">{name}</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-app-bg"><div className="h-full bg-app-green" style={{ width: `${pct}%` }} /></div><span className="shrink-0 font-medium text-white">{val}</span></div>;
}

function buildScoutReportMap(messages: MessageData[]): Map<string, ScoutReportData> {
  const reports = new Map<string, ScoutReportData>();
  messages.forEach((message) => {
    const report = message.context.scout_report;
    if (report) {
      reports.set(report.player_id, report);
    }
  });
  return reports;
}

function buildAssignmentByPlayerId(assignments: ScoutingAssignment[]): Map<string, ScoutingAssignment> {
  return new Map(assignments.map((assignment) => [assignment.player_id, assignment]));
}

function buildScoutReportAttributeItems(report: ScoutReportData): Array<[string, number | null]> {
  return [
    ["Pace", report.pace],
    ["Shooting", report.shooting],
    ["Passing", report.passing],
    ["Dribbling", report.dribbling],
    ["Defending", report.defending],
    ["Physical", report.physical],
  ];
}

function formatOptionalReportValue(value: number | null): string {
  return value === null ? "Unknown" : String(value);
}

function getReportValueTone(value: number | null): string {
  if (value === null) return "font-bold text-app-text-muted";
  if (value >= 70) return "font-bold text-app-green";
  if (value >= 50) return "font-bold text-amber-500";
  return "font-bold text-app-text-muted";
}

function getScoutReportGrade(report: ScoutReportData): string {
  const value = report.avg_rating ?? 0;
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "D";
}

function getScoutReportSummary(report: ScoutReportData): string {
  return `${report.rating_key} rating with ${report.potential_key} potential.`;
}

function buildScoutingPlayerMetaMap(players: PlayerData[], teamById: Map<string, TeamData>): Map<string, ScoutingPlayerMeta> {
  return new Map(players.map((player) => {
    const overall = getPlayerOvr(player);
    return [player.id, {
      age: calcAge(player.date_of_birth),
      overall,
      potential: player.potential ?? overall,
      teamName: player.team_id ? teamById.get(player.team_id)?.name ?? "" : "",
      nationality: player.football_nation ?? player.nationality,
      position: player.natural_position || player.position,
    }];
  }));
}

function getPlayerMeta(playerMetaById: Map<string, ScoutingPlayerMeta>, player: PlayerData): ScoutingPlayerMeta {
  const meta = playerMetaById.get(player.id);
  if (meta) return meta;

  const overall = getPlayerOvr(player);
  return {
    age: calcAge(player.date_of_birth),
    overall,
    potential: player.potential ?? overall,
    teamName: "",
    nationality: player.football_nation ?? player.nationality,
    position: player.natural_position || player.position,
  };
}

function selectScoutableWindow(players: PlayerData[], sort: { key: SearchSortKey; direction: SortDirection }, playerMetaById: Map<string, ScoutingPlayerMeta>, assignedIds: Set<string>, limit: number): PlayerData[] {
  if (limit >= players.length) {
    return [...players].sort((left, right) => compareScoutablePlayers(left, right, sort, playerMetaById, assignedIds));
  }

  const selected: PlayerData[] = [];
  for (const player of players) {
    insertSortedScoutable(selected, player, sort, playerMetaById, assignedIds, limit);
  }
  return selected;
}

function insertSortedScoutable(selected: PlayerData[], player: PlayerData, sort: { key: SearchSortKey; direction: SortDirection }, playerMetaById: Map<string, ScoutingPlayerMeta>, assignedIds: Set<string>, limit: number): void {
  let low = 0;
  let high = selected.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareScoutablePlayers(player, selected[mid], sort, playerMetaById, assignedIds) < 0) high = mid;
    else low = mid + 1;
  }

  if (low >= limit) return;
  selected.splice(low, 0, player);
  if (selected.length > limit) selected.pop();
}

function compareScoutablePlayers(left: PlayerData, right: PlayerData, sort: { key: SearchSortKey; direction: SortDirection }, playerMetaById: Map<string, ScoutingPlayerMeta>, assignedIds: Set<string>): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  const leftValue = getSearchSortValue(left, sort.key, playerMetaById, assignedIds);
  const rightValue = getSearchSortValue(right, sort.key, playerMetaById, assignedIds);
  const result = typeof leftValue === "number" && typeof rightValue === "number"
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));
  return result * direction;
}

function getSearchSortValue(player: PlayerData, key: SearchSortKey, playerMetaById: Map<string, ScoutingPlayerMeta>, assignedIds: Set<string>): string | number {
  const meta = getPlayerMeta(playerMetaById, player);
  if (key === "player") return player.full_name;
  if (key === "age") return meta.age;
  if (key === "nat") return meta.nationality;
  if (key === "team") return meta.teamName;
  if (key === "pos") return meta.position;
  if (key === "value") return player.market_value;
  if (key === "wage") return player.wage;
  if (key === "ca") return meta.overall;
  if (key === "pa") return meta.potential;
  if (key === "knowledge") return assignedIds.has(player.id) ? 100 : Math.min(99, Math.max(55, meta.overall + 15));
  if (key === "interest") return meta.overall;
  if (key === "status") return assignedIds.has(player.id) ? 2 : meta.overall >= 72 ? 1 : 0;
  return "";
}

function applyScoutingFilters(players: PlayerData[], playerMetaById: Map<string, ScoutingPlayerMeta>, options: { ageFilter: AgeFilter; nationalityFilter: NationalityFilter; transferTypeFilter: TransferTypeFilter; contractStatusFilter: ContractStatusFilter; roleProfileFilter: RoleProfileFilter; recruitmentFocus: RecruitmentFocus; managerNationality: string; currentDate: string }): PlayerData[] {
  return players.filter((player) => {
    const meta = getPlayerMeta(playerMetaById, player);
    if (!matchesAgeFilter(meta, options.ageFilter)) return false;
    if (options.nationalityFilter === "Domestic" && meta.nationality !== options.managerNationality) return false;
    if (options.nationalityFilter === "Foreign" && meta.nationality === options.managerNationality) return false;
    if (options.transferTypeFilter === "Transfer Listed" && !player.transfer_listed) return false;
    if (options.transferTypeFilter === "Loan Listed" && !player.loan_listed) return false;
    if (options.transferTypeFilter === "Free Agent" && player.team_id) return false;
    if (!matchesContractFilter(player, options.contractStatusFilter, options.currentDate)) return false;
    if (!matchesRoleProfile(player, meta, options.roleProfileFilter)) return false;
    if (options.recruitmentFocus === "High Potential" && !matchesRoleProfile(player, meta, "High Potential")) return false;
    if (options.recruitmentFocus === "Ready Soon" && !matchesRoleProfile(player, meta, "Ready Now")) return false;
    if (options.recruitmentFocus === "Transfer Listed" && !player.transfer_listed) return false;
    if (options.recruitmentFocus === "Loan Listed" && !player.loan_listed) return false;
    return true;
  });
}

function matchesAgeFilter(meta: ScoutingPlayerMeta, filter: AgeFilter): boolean {
  if (filter === "Any") return true;
  if (filter === "U21") return meta.age <= 21;
  if (filter === "U23") return meta.age <= 23;
  if (filter === "Prime 24-29") return meta.age >= 24 && meta.age <= 29;
  if (filter === "30+") return meta.age >= 30;
  return true;
}

function matchesContractFilter(player: PlayerData, filter: ContractStatusFilter, currentDate: string): boolean {
  if (filter === "Any") return true;
  if (filter === "No Contract") return !player.contract_end || !player.team_id;
  if (!player.contract_end) return false;
  const days = Math.ceil((new Date(player.contract_end).getTime() - new Date(currentDate).getTime()) / 86_400_000);
  if (filter === "Expiring 6 Months") return days <= 183;
  if (filter === "Expiring 12 Months") return days <= 366;
  return true;
}

function matchesRoleProfile(player: PlayerData, meta: ScoutingPlayerMeta, filter: RoleProfileFilter): boolean {
  if (filter === "Any") return true;
  if (filter === "High Potential") return meta.potential >= 75;
  if (filter === "Ready Now") return meta.overall >= 68;
  if (filter === "Budget") return player.market_value <= 5_000_000 || !player.team_id;
  if (filter === "Wonderkid") return meta.age <= 21 && meta.potential >= 75;
  return true;
}

function buildShortlistPlayers(players: PlayerData[], mode: ShortlistMode, myTeamId: string, playerMetaById: Map<string, ScoutingPlayerMeta>): PlayerData[] {
  const selected = selectShortlistPlayers(players, mode, myTeamId, playerMetaById);
  if (selected.length > 0) return selected;

  return selectFallbackShortlistPlayers(players, myTeamId, playerMetaById);
}

function selectShortlistPlayers(players: PlayerData[], mode: ShortlistMode, myTeamId: string, playerMetaById: Map<string, ScoutingPlayerMeta>): PlayerData[] {
  const selected: PlayerData[] = [];

  for (const player of players) {
    const meta = getPlayerMeta(playerMetaById, player);
    if (player.team_id === myTeamId) continue;
    if (mode === "Transfer Listed" && !player.transfer_listed) continue;
    if (mode === "Loan Listed" && !player.loan_listed) continue;
    if (mode === "High Potential" && meta.potential < 75) continue;
    if (mode === "Recommended" && !player.transfer_listed && !player.loan_listed) continue;
    insertShortlistPlayer(selected, player, playerMetaById, 8);
  }

  return selected;
}

function selectFallbackShortlistPlayers(players: PlayerData[], myTeamId: string, playerMetaById: Map<string, ScoutingPlayerMeta>): PlayerData[] {
  const selected: PlayerData[] = [];

  for (const player of players) {
    const meta = getPlayerMeta(playerMetaById, player);
    if (player.team_id === myTeamId) continue;
    if (meta.age > 23 && meta.potential < 70) continue;
    insertShortlistPlayer(selected, player, playerMetaById, 8);
  }

  return selected;
}

function insertShortlistPlayer(selected: PlayerData[], player: PlayerData, playerMetaById: Map<string, ScoutingPlayerMeta>, limit: number): void {
  const playerScore = getPlayerMeta(playerMetaById, player).potential;
  let low = 0;
  let high = selected.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    const midScore = getPlayerMeta(playerMetaById, selected[mid]).potential;
    if (playerScore > midScore) high = mid;
    else low = mid + 1;
  }

  if (low >= limit) return;
  selected.splice(low, 0, player);
  if (selected.length > limit) selected.pop();
}

function medianMarketValue(players: PlayerData[]): number {
  if (players.length === 0) return 0;
  const values = players.map((player) => player.market_value).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function buildMarketRows(players: PlayerData[], teamById: Map<string, TeamData>) {
  const totals = new Map<string, number>();
  players.forEach((player) => {
    const team = player.team_id ? teamById.get(player.team_id) : null;
    const key = team?.country ?? player.football_nation ?? player.nationality;
    totals.set(key, (totals.get(key) ?? 0) + player.market_value);
  });
  const rows = Array.from(totals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const max = rows[0]?.value || 1;
  return rows.length > 0 ? rows.map((row) => ({ ...row, pct: Math.max(5, Math.round((row.value / max) * 100)) })) : [{ name: "No market", value: 0, pct: 0 }];
}

function buildAgeBands(players: PlayerData[], playerMetaById: Map<string, ScoutingPlayerMeta>) {
  const counts = { u21: 0, u23: 0, prime: 0, veteran: 0 };
  players.forEach((player) => {
    const age = getPlayerMeta(playerMetaById, player).age;
    if (age <= 21) counts.u21 += 1;
    if (age > 21 && age <= 23) counts.u23 += 1;
    if (age >= 24 && age <= 29) counts.prime += 1;
    if (age >= 30) counts.veteran += 1;
  });
  const bands = [
    { label: "U21", count: counts.u21 },
    { label: "U23", count: counts.u23 },
    { label: "24+", count: counts.prime },
    { label: "30+", count: counts.veteran },
  ];
  const max = Math.max(1, ...bands.map((band) => band.count));
  return bands.map((band) => ({ ...band, pct: Math.max(8, Math.round((band.count / max) * 100)) }));
}

function ShortlistCard({ player, meta, team, onSelectPlayer }: { player: PlayerData; meta: ScoutingPlayerMeta; team?: TeamData; onSelectPlayer?: (id: string) => void }) {
  const clubColor = team?.colors?.primary ?? "#ef4444";

  return (
    <button
      type="button"
      onClick={() => onSelectPlayer?.(player.id)}
      className="group flex min-w-[86px] flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-app-border bg-app-bg/50 p-2 transition-colors hover:border-app-green/50"
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-bg">
        {team ? <TeamLogo team={team} size="sm" className="h-8 w-8 rounded-full" /> : <UserPlus className="h-4 w-4 text-app-text-muted/50" />}
        <div className="absolute right-0 top-0 h-2 w-2.5 rounded-[2px] border-[0.5px] border-app-border" style={{ backgroundColor: clubColor }} />
      </div>
      <div className="flex w-full flex-col items-center">
        <span className="w-full truncate text-center text-[9px] font-bold transition-colors group-hover:text-app-green">{player.match_name}</span>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="text-[8px] text-app-text-muted">{meta.age} years old</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="rounded bg-white/5 px-1 text-[8px] font-bold text-app-text-muted">{player.position.slice(0, 3).toUpperCase()}</span>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative z-0 -mr-2 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-app-card">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: clubColor }} />
        </div>
        <div className="relative z-10 rounded border border-app-border bg-app-bg px-1.5 py-0.5 text-[9px] font-bold">{formatVal(player.market_value)}</div>
      </div>
      <span className="hidden">{team?.name ?? ""}</span>
    </button>
  );
}
