import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { GameStateData, PlayerData, ScoutingAssignment, StaffData, TeamData } from "../../store/gameStore";
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
import { buildAlreadyScoutingIds, filterScoutablePlayers, paginateScoutablePlayers } from "./ScoutingTab.model";
import ScoutingYouthRecruitmentCard from "./ScoutingYouthRecruitmentCard";

interface ScoutingTabProps {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
}

const SCOUTING_PAGE_SIZE = 20;
const POSITION_FILTERS = ["All", "GK", "DR", "DCR", "DCL", "DL", "DM", "MCR", "MCL", "AMR", "AML", "STC"];
const TEMPLATE_TABS = ["Player Search", "Assignments", "Reports"] as const;
type ScoutingTabId = typeof TEMPLATE_TABS[number];

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
  const [activeScoutingTab, setActiveScoutingTab] = useState<ScoutingTabId>("Player Search");
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
  const scouts = gameState.staff.filter((staff) => staff.role === "Scout" && staff.team_id === myTeamId);
  const assignments = gameState.scouting_assignments || [];
  const youthAssignments = gameState.youth_scouting_assignments || [];
  const allAssignments = useMemo(() => [...assignments, ...youthAssignments], [assignments, youthAssignments]);
  const availableScouts = calculateAvailableScouts(scouts, allAssignments);

  useEffect(() => {
    if (selectedYouthScoutId && availableScouts.some((scout) => scout.id === selectedYouthScoutId)) return;
    setSelectedYouthScoutId(availableScouts[0]?.id ?? "");
  }, [availableScouts, selectedYouthScoutId]);

  const baseScoutable = filterScoutablePlayers({
    players: gameState.players,
    teams: gameState.teams,
    myTeamId,
    posFilter: TEMPLATE_POSITION_FILTER_MAP[posFilter] ?? posFilter,
    searchQuery,
  });
  const allScoutable = applyScoutingFilters(baseScoutable, {
    ageFilter,
    nationalityFilter,
    transferTypeFilter,
    contractStatusFilter,
    roleProfileFilter,
    recruitmentFocus,
    managerNationality: gameState.manager.football_nation ?? gameState.manager.nationality,
    currentDate: gameState.clock.current_date,
  });
  const listedTargets = buildShortlistPlayers(baseScoutable, shortlistMode, myTeamId);
  const sortedScoutable = useMemo(
    () => sortScoutablePlayers(allScoutable, searchSort, gameState.teams, assignments),
    [allScoutable, searchSort, gameState.teams, assignments],
  );
  const { totalPages, safePage, players: scoutablePlayers } = paginateScoutablePlayers(
    sortedScoutable,
    page,
    SCOUTING_PAGE_SIZE,
  );
  const alreadyScoutingIds = buildAlreadyScoutingIds(assignments);
  const selectedReportPlayer = selectedReportPlayerId
    ? gameState.players.find((player) => player.id === selectedReportPlayerId) ?? null
    : null;
  const featuredPlayer = selectedReportPlayer ?? scoutablePlayers[0] ?? sortedScoutable[0] ?? listedTargets[0] ?? baseScoutable[0] ?? null;

  const activateSection = (tab: ScoutingTabId) => {
    setActiveScoutingTab(tab);
    if (tab === "Player Search") {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  };

  const handleCreateAssignmentClick = () => {
    setAssignmentHint(true);
    activateSection("Player Search");
  };

  const handleStartSearchClick = () => {
    setAssignmentHint(false);
    activateSection("Player Search");
  };

  const handleSortChange = (key: SearchSortKey) => {
    setSearchSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
    setPage(0);
  };

  const handleReportPlayerSelect = (playerId: string) => {
    setSelectedReportPlayerId(playerId);
  };

  const handleSaveSearchClick = () => {
    setSavedSearchNotice(`${allScoutable.length} targets saved for this scouting view.`);
    activateSection("Player Search");
  };

  const handleFooterAction = (tab: ScoutingTabId) => {
    setAssignmentHint(false);
    activateSection(tab);
  };

  const handleSendScout = async (playerId: string) => {
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
  };

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
    <div className="flex min-h-max max-w-[1700px] flex-col gap-4 mx-auto">
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
              activateSection("Player Search");
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

      <div className="mt-2 flex items-center gap-6 border-b border-app-border/50 px-2">
        {TEMPLATE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-label={`${tab} tab`}
            onClick={() => activateSection(tab)}
            className={tab === activeScoutingTab
              ? "-mb-[2px] border-b-2 border-app-green pb-3 text-sm font-semibold text-app-green"
              : "-mb-[2px] pb-3 text-sm font-medium text-app-text-muted transition-colors hover:text-white"}
          >
            {tab}
          </button>
        ))}
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
          <ScoutRecommendationsCard players={gameState.players} targetPlayers={allScoutable} myTeamId={myTeamId} managerTeam={myTeam} />
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
                <button type="button" aria-label="Show shortlist targets" title="Show shortlist targets" onClick={() => handleFooterAction("Player Search")} className="rounded border border-app-border p-1.5 transition-colors hover:bg-white/5">
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
                      teams={gameState.teams}
                      locale={i18n.language}
                      isActive={player.id === featuredPlayer?.id}
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
          <PlayerReportCard player={featuredPlayer} players={gameState.players} teams={gameState.teams} scouts={scouts} managerTeam={myTeam} locale={i18n.language} t={t} />
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-4">
        <ActiveAssignmentsCard assignments={assignments} scouts={scouts} players={gameState.players} teams={gameState.teams} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} onFooterClick={() => handleFooterAction("Assignments")} t={t} />
        <ScoutNetworkCard scouts={scouts} assignments={assignments} onFooterClick={() => handleFooterAction("Reports")} t={t} />
        <MarketInsightsCard players={baseScoutable} teams={gameState.teams} />
        <ShortlistedPlayersCard players={listedTargets} teams={gameState.teams} mode={shortlistMode} onFooterClick={() => handleFooterAction("Player Search")} onSelectPlayer={onSelectPlayer} />
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

function ScoutingPlayerRow({
  index,
  player,
  teams,
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
  teams: TeamData[];
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
  const team = player.team_id ? getTeamName(teams, player.team_id) : t("common.freeAgent");
  const overall = getPlayerOvr(player);
  const status = getPlayerScoutStatus(overall, isScouting);
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
      <td className="px-3 py-3 text-center text-app-text">{calcAge(player.date_of_birth)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <CountryFlag code={player.nationality} locale={locale} className="text-sm leading-none" />
          <span className="max-w-[100px] truncate text-[10px] font-bold text-app-text-muted">{countryName(player.nationality, locale)}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 shrink-0 rounded-full border border-white/20 bg-blue-600" />
          <button type="button" onClick={(event) => { event.stopPropagation(); player.team_id && onSelectTeam?.(player.team_id); }} className="max-w-[110px] truncate text-xs text-app-text-muted hover:text-app-green">{team}</button>
        </div>
      </td>
      <td className="px-3 py-3 text-app-text-muted">{translatePositionAbbreviation(t, player.natural_position || player.position)}</td>
      <td className="px-3 py-3 text-right font-medium">{formatVal(player.market_value)}</td>
      <td className="px-3 py-3 text-right text-app-text-muted">{formatVal(player.wage)} p/w</td>
      <td className="px-3 py-3"><StarRating rating={overall / 20} /></td>
      <td className="px-3 py-3"><StarRating rating={Math.min(5, overall / 18)} /></td>
      <td className="px-3 py-3"><StarRating rating={Math.min(5, overall / 19)} /></td>
      <td className="px-3 py-3 text-center font-mono text-[10px]">
        <div className="flex items-center justify-center gap-1 text-app-green">
          <div className="h-3 w-3 animate-spin-slow rounded-full border-2 border-app-green border-r-transparent" />
          {isScouting ? "100%" : `${Math.min(99, Math.max(55, overall + 15))}%`}
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
}

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

function ScoutRecommendationsCard({ players, targetPlayers, myTeamId, managerTeam }: { players: PlayerData[]; targetPlayers: PlayerData[]; myTeamId: string; managerTeam: TeamData | null }) {
  const myPlayers = players.filter((player) => player.team_id === myTeamId);
  const lowDepthPositions = ["Goalkeeper", "Defender", "Midfielder", "Forward"].filter((position) => myPlayers.filter((player) => player.position === position || player.natural_position === position).length < 2).length;
  const highPriority = targetPlayers.filter((player) => (player.potential ?? getPlayerOvr(player)) >= 75 || getPlayerOvr(player) >= 70).length;
  const affordable = targetPlayers.filter((player) => !managerTeam || player.market_value <= managerTeam.transfer_budget).length;
  const hiddenGems = targetPlayers.filter((player) => calcAge(player.date_of_birth) <= 23 && (player.potential ?? getPlayerOvr(player)) >= 70 && player.market_value <= medianMarketValue(targetPlayers)).length;

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

function PlayerReportCard({ player, players, teams, scouts, managerTeam, locale, t }: { player: PlayerData | null; players: PlayerData[]; teams: TeamData[]; scouts: StaffData[]; managerTeam: TeamData | null; locale: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  if (!player) {
    return <ScoutingTemplateCard className="p-4 text-sm text-app-text-muted">No player report available</ScoutingTemplateCard>;
  }

  const overall = getPlayerOvr(player);
  const team = player.team_id ? getTeamName(teams, player.team_id) : t("common.freeAgent");
  const report = buildPlayerReport(player, players, scouts, managerTeam);

  return (
    <ScoutingTemplateCard className="flex flex-col p-4">
      <div className="flex items-start justify-between">
        <span className="mb-4 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER REPORT</span>
        <div className="rounded border border-app-green/30 bg-app-green/10 px-2 py-0.5 text-xs font-bold text-app-green">{report.grade} Target</div>
      </div>
      <div className="flex gap-4">
        <div className="flex w-24 shrink-0 flex-col gap-2">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-app-border bg-app-bg">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900 to-[#1e293b]" />
            <UserPlus className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/30" />
            <div className="absolute left-1 top-1 text-[40px] font-bold leading-none text-white/20">{translatePositionAbbreviation(t, player.position)}</div>
          </div>
          <StarRating rating={overall / 20} />
          <span className="text-center text-[10px] leading-tight text-app-text-muted">{report.summary}</span>
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-xl font-bold leading-none text-app-text">{player.match_name}</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-app-text-muted">
            <CountryFlag code={player.nationality} locale={locale} className="text-sm leading-none" />
            <span>{countryName(player.nationality, locale)}</span>
          </div>
          <span className="mt-1 text-xs text-app-text-muted">{team}</span>
          <span className="mt-1 text-xs text-app-text-muted opacity-80">{translatePositionLabel(t, player.natural_position || player.position)}</span>
          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2">
            <ReportStat label="Age" value={String(calcAge(player.date_of_birth))} />
            <ReportStat label="Estimated Value" value={formatVal(player.market_value)} />
            <ReportStat label="Wage" value={`${formatVal(player.wage)} p/w`} />
            <ReportStat label="Overall" value={String(overall)} />
            <ReportStat label="Contract Expires" value={player.contract_end ?? "-"} />
            <ReportStat label="Preferred Foot" value={report.preferredFoot} />
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-app-border/50 pt-4">
        <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ATTRIBUTE SNAPSHOT</span>
        <div className="flex gap-2">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <AttrList title="TECHNICAL" items={["passing", "shooting", "dribbling", "tackling", "vision", "positioning"].map((key) => [key, player.attributes[key as keyof typeof player.attributes]])} />
            <AttrList title="MENTAL" items={["aggression", "composure", "decisions", "teamwork", "leadership", "aerial"].map((key) => [key, player.attributes[key as keyof typeof player.attributes]])} />
            <AttrList title="PHYSICAL" items={["pace", "stamina", "strength", "agility", "reflexes"].map((key) => [key, player.attributes[key as keyof typeof player.attributes]])} />
          </div>
          <AttributeRadar player={player} />
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t border-app-border/50 pt-4">
        <div className="flex flex-1 flex-col gap-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">SCOUT REPORT SUMMARY</span>
          {report.pros.map((text) => <ReportProCon key={text} type="pro" text={text} />)}
          {report.cons.map((text) => <ReportProCon key={text} type="con" text={text} />)}
          <div className="mt-2 flex items-center justify-between border-t border-app-border/30 pt-2">
            <span className="text-xs font-bold">Overall Rating</span>
            <StarRating rating={overall / 20} />
          </div>
        </div>
        <div className="flex w-[160px] shrink-0 flex-col gap-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-text-muted">TRANSFER FEASIBILITY</span>
          <FeasibilityRow label="Likelihood of Signing" value={`${report.signingLikelihood}%`} bar={report.signingLikelihood} />
          <MiniInfo label="Agent Demands" value={report.agentDemands} tone={report.agentTone} />
          <MiniInfo label="Expected Fee" value={formatVal(report.expectedFee)} tone="text-white" />
          <MiniInfo label="Competition" value={report.competition} tone={report.competitionTone} />
          <MiniInfo label="Financial Fit" value={report.financialFit} tone={report.financialFitTone} />
          <div className="mt-1 flex justify-between border-t border-app-border/30 pt-1 text-[10px]"><span className="font-bold text-app-text-muted">Transfer Priority</span><span className="font-bold text-app-green">{report.priority}</span></div>
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t border-app-border/50 pt-4">
        <div className="flex w-[160px] shrink-0 flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ANALYST VERDICT</span>
          <div className="mt-1 flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-app-green bg-app-green/10 text-lg font-bold text-app-green">
              {overall}
              <TrendingUp className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-app-bg text-app-green" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold leading-tight text-app-green">{report.verdict}</span>
              <span className="mt-1 text-[10px] leading-tight text-app-text-muted">{report.summary}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-app-border bg-white/5"><Globe className="h-3 w-3 text-app-text-muted" /></div>
            <div className="flex flex-col text-[9px]"><span className="text-app-text-muted">{report.analystName}</span><span className="text-app-text-muted/60">Scout Analyst</span></div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 border-l border-app-border/50 pl-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">PLAYER COMPARISON</span>
          <span className="text-[10px] text-app-text-muted">Compared with: <span className="text-white">{report.comparisonName}</span></span>
          <ComparisonMetric label="Current Ability" rating={overall / 20} pct={Math.min(100, overall)} />
          <ComparisonMetric label="Potential Ability" rating={Math.min(5, (player.potential ?? overall) / 20)} pct={Math.min(100, player.potential ?? overall)} />
          <ComparisonMetric label="Consistency" rating={Math.min(5, player.attributes.decisions / 20)} pct={Math.min(100, player.attributes.decisions)} />
          <ComparisonMetric label="Big Match Ability" rating={Math.min(5, player.attributes.composure / 20)} pct={Math.min(100, player.attributes.composure)} />
        </div>
      </div>
    </ScoutingTemplateCard>
  );
}

function ActiveAssignmentsCard({ assignments, scouts, players, onSelectPlayer, onSelectTeam, onFooterClick, t }: { assignments: ScoutingAssignment[]; scouts: StaffData[]; players: PlayerData[]; teams: TeamData[]; onSelectPlayer?: (id: string) => void; onSelectTeam?: (id: string) => void; onFooterClick: () => void; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <BottomSection title="ACTIVE ASSIGNMENTS" footer="View All Assignments" onFooterClick={onFooterClick}>
      <table className="w-full whitespace-nowrap text-left">
        <thead>
          <tr className="border-b border-app-border/30 text-[9px] font-bold uppercase text-app-text-muted">
            <th className="px-2 py-2.5">REGION</th>
            <th className="py-2.5">SCOUT</th>
            <th className="py-2.5 text-right">TIME REMAINING</th>
            <th className="px-2 py-2.5">FOCUS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border/20 text-app-text">
          {assignments.slice(0, 5).map((assignment) => {
            const player = players.find((candidate) => candidate.id === assignment.player_id);
            const scout = scouts.find((candidate) => candidate.id === assignment.scout_id);
            if (!player || !scout) return null;
            const row = (
              <tr key={assignment.id} className="group cursor-pointer transition-colors hover:bg-white/5" data-testid={`scouting-assignment-${assignment.id}`}>
                <td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="h-3 w-3.5 shrink-0 overflow-hidden rounded-[2px] border border-app-border bg-blue-500" /><button type="button" onClick={() => onSelectPlayer?.(player.id)} className="text-[10px] font-semibold hover:text-app-green">{player.full_name}</button></div></td>
                <td className="py-2.5 text-[10px] text-app-text-muted">{scout.first_name} {scout.last_name}</td>
                <td className="py-2.5 text-right text-[10px] font-bold text-amber-500">{t("scouting.daysLeft", { days: assignment.days_remaining })}</td>
                <td className="px-2 py-2.5"><span className="block max-w-[60px] truncate text-[10px] text-app-text-muted" title={player.position}>{translatePositionAbbreviation(t, player.position)}</span></td>
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
      {assignments.length === 0 ? <p className="p-2 text-[11px] text-app-text-muted">No active scouting assignments</p> : null}
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

function MarketInsightsCard({ players, teams }: { players: PlayerData[]; teams: TeamData[] }) {
  const markets = buildMarketRows(players, teams);
  const ageBands = buildAgeBands(players);

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

function ShortlistedPlayersCard({ players, teams, mode, onFooterClick, onSelectPlayer }: { players: PlayerData[]; teams: TeamData[]; mode: ShortlistMode; onFooterClick: () => void; onSelectPlayer?: (id: string) => void }) {
  return (
    <BottomSection title="SHORTLISTED PLAYERS" footer="View All Shortlists" onFooterClick={onFooterClick}>
      <span className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-app-text-muted">Source: {mode}</span>
      <div className="flex h-full gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {players.length > 0 ? players.map((player) => <ShortlistCard key={player.id} player={player} teams={teams} onSelectPlayer={onSelectPlayer} />) : <span className="py-6 text-xs text-app-text-muted">No matching listed targets.</span>}
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

function AttributeRadar({ player }: { player: PlayerData }) {
  const radarStats = [
    { subject: "DEF", A: avgAttrs(player, ["defending", "tackling", "positioning"]) },
    { subject: "PHY", A: avgAttrs(player, ["stamina", "strength", "agility"]) },
    { subject: "SPD", A: avgAttrs(player, ["pace", "agility"]) },
    { subject: "VIS", A: avgAttrs(player, ["vision", "decisions", "passing"]) },
    { subject: "ATK", A: avgAttrs(player, ["shooting", "dribbling", "composure"]) },
    { subject: "TEC", A: avgAttrs(player, ["passing", "dribbling", "vision"]) },
    { subject: "AIR", A: player.attributes.aerial },
    { subject: "MEN", A: avgAttrs(player, ["decisions", "teamwork", "leadership", "composure"]) },
  ];

  return (
    <div className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded border border-app-border/50">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarStats}>
          <PolarGrid stroke="#232d3b" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 7 }} />
          <Radar name="Player" dataKey="A" stroke="#2dd4bf" strokeWidth={1} fill="#2dd4bf" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function avgAttrs(player: PlayerData, keys: Array<keyof PlayerData["attributes"]>): number {
  return Math.round(keys.reduce((sum, key) => sum + player.attributes[key], 0) / keys.length);
}

function MiniInfo({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex justify-between text-[10px]"><span className="text-app-text-muted">{label}</span><span className={`font-medium ${tone}`}>{value}</span></div>;
}

function FeasibilityRow({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[9px] text-app-text-muted"><span>{label}</span><span>{value}</span></div>
      <div className="h-1 overflow-hidden rounded-full bg-app-bg"><div className="h-full bg-emerald-500" style={{ width: `${bar}%` }} /></div>
    </div>
  );
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

function AttrList({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold uppercase text-app-text-muted">{title}</span>
      {items.map(([name, value]) => <div key={name} className="flex items-center justify-between text-[10px]"><span className="capitalize text-app-text-muted">{name}</span><span className={value >= 70 ? "font-bold text-app-green" : value >= 50 ? "font-bold text-amber-500" : "font-bold text-app-text-muted"}>{value}</span></div>)}
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

function sortScoutablePlayers(players: PlayerData[], sort: { key: SearchSortKey; direction: SortDirection }, teams: TeamData[], assignments: ScoutingAssignment[]): PlayerData[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  const assignedIds = buildAlreadyScoutingIds(assignments);

  return [...players].sort((left, right) => {
    const leftValue = getSearchSortValue(left, sort.key, teams, assignedIds);
    const rightValue = getSearchSortValue(right, sort.key, teams, assignedIds);
    const result = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return result * direction;
  });
}

function getSearchSortValue(player: PlayerData, key: SearchSortKey, teams: TeamData[], assignedIds: Set<string>): string | number {
  const overall = getPlayerOvr(player);
  if (key === "player") return player.full_name;
  if (key === "age") return calcAge(player.date_of_birth);
  if (key === "nat") return player.football_nation ?? player.nationality;
  if (key === "team") return player.team_id ? getTeamName(teams, player.team_id) : "";
  if (key === "pos") return player.natural_position || player.position;
  if (key === "value") return player.market_value;
  if (key === "wage") return player.wage;
  if (key === "ca") return overall;
  if (key === "pa") return player.potential ?? overall;
  if (key === "knowledge") return assignedIds.has(player.id) ? 100 : Math.min(99, Math.max(55, overall + 15));
  if (key === "interest") return overall;
  if (key === "status") return assignedIds.has(player.id) ? 2 : overall >= 72 ? 1 : 0;
  return "";
}

function applyScoutingFilters(players: PlayerData[], options: { ageFilter: AgeFilter; nationalityFilter: NationalityFilter; transferTypeFilter: TransferTypeFilter; contractStatusFilter: ContractStatusFilter; roleProfileFilter: RoleProfileFilter; recruitmentFocus: RecruitmentFocus; managerNationality: string; currentDate: string }): PlayerData[] {
  return players.filter((player) => {
    const age = calcAge(player.date_of_birth);
    if (options.ageFilter === "U21" && age > 21) return false;
    if (options.ageFilter === "U23" && age > 23) return false;
    if (options.ageFilter === "Prime 24-29" && (age < 24 || age > 29)) return false;
    if (options.ageFilter === "30+" && age < 30) return false;
    const nationality = player.football_nation ?? player.nationality;
    if (options.nationalityFilter === "Domestic" && nationality !== options.managerNationality) return false;
    if (options.nationalityFilter === "Foreign" && nationality === options.managerNationality) return false;
    if (options.transferTypeFilter === "Transfer Listed" && !player.transfer_listed) return false;
    if (options.transferTypeFilter === "Loan Listed" && !player.loan_listed) return false;
    if (options.transferTypeFilter === "Free Agent" && player.team_id) return false;
    if (!matchesContractFilter(player, options.contractStatusFilter, options.currentDate)) return false;
    if (!matchesRoleProfile(player, options.roleProfileFilter)) return false;
    if (options.recruitmentFocus === "High Potential" && !matchesRoleProfile(player, "High Potential")) return false;
    if (options.recruitmentFocus === "Ready Soon" && !matchesRoleProfile(player, "Ready Now")) return false;
    if (options.recruitmentFocus === "Transfer Listed" && !player.transfer_listed) return false;
    if (options.recruitmentFocus === "Loan Listed" && !player.loan_listed) return false;
    return true;
  });
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

function matchesRoleProfile(player: PlayerData, filter: RoleProfileFilter): boolean {
  if (filter === "Any") return true;
  const age = calcAge(player.date_of_birth);
  const overall = getPlayerOvr(player);
  const potential = player.potential ?? overall;
  if (filter === "High Potential") return potential >= 75;
  if (filter === "Ready Now") return overall >= 68;
  if (filter === "Budget") return player.market_value <= 5_000_000 || !player.team_id;
  if (filter === "Wonderkid") return age <= 21 && potential >= 75;
  return true;
}

function buildShortlistPlayers(players: PlayerData[], mode: ShortlistMode, myTeamId: string): PlayerData[] {
  const external = players.filter((player) => player.team_id !== myTeamId);
  const selected = mode === "Transfer Listed"
    ? external.filter((player) => player.transfer_listed)
    : mode === "Loan Listed"
      ? external.filter((player) => player.loan_listed)
      : mode === "High Potential"
        ? external.filter((player) => (player.potential ?? getPlayerOvr(player)) >= 75)
        : external.filter((player) => player.transfer_listed || player.loan_listed);
  const fallback = selected.length > 0 ? selected : external.filter((player) => calcAge(player.date_of_birth) <= 23 || (player.potential ?? getPlayerOvr(player)) >= 70);
  return fallback.sort((a, b) => (b.potential ?? getPlayerOvr(b)) - (a.potential ?? getPlayerOvr(a))).slice(0, 8);
}

function medianMarketValue(players: PlayerData[]): number {
  if (players.length === 0) return 0;
  const values = players.map((player) => player.market_value).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function buildPlayerReport(player: PlayerData, players: PlayerData[], scouts: StaffData[], managerTeam: TeamData | null) {
  const overall = getPlayerOvr(player);
  const potential = player.potential ?? overall;
  const grade = potential >= 85 ? "A+" : potential >= 78 ? "A" : potential >= 70 ? "B+" : overall >= 65 ? "B" : "C";
  const expectedFee = !player.team_id ? 0 : player.transfer_listed ? Math.round(player.market_value * 0.9) : player.market_value;
  const budget = managerTeam?.transfer_budget ?? 0;
  const signingLikelihood = !player.team_id ? 90 : player.transfer_listed ? 75 : budget >= expectedFee ? 60 : 30;
  const agentDemands = player.wage > 80_000 ? "High" : player.wage > 30_000 ? "Medium" : "Low";
  const competitionCount = player.transfer_offers.filter((offer) => offer.status === "Pending").length;
  const financialFit = expectedFee === 0 || !managerTeam || expectedFee <= managerTeam.transfer_budget ? "Good" : expectedFee <= managerTeam.transfer_budget * 1.25 ? "Tight" : "Poor";
  const topAttrs = Object.entries(player.attributes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => `${capitalise(name)} is a standout attribute.`);
  const lowAttrs = Object.entries(player.attributes).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([name]) => `${capitalise(name)} may need development.`);
  const analyst = scouts.slice().sort((a, b) => b.attributes.judging_ability - a.attributes.judging_ability)[0];
  const comparison = players
    .filter((candidate) => candidate.id !== player.id && candidate.position === player.position)
    .sort((a, b) => Math.abs(getPlayerOvr(a) - overall) - Math.abs(getPlayerOvr(b) - overall))[0];

  return {
    grade,
    summary: potential > overall + 8 ? "Strong upside based on current ability and potential." : "Profile is close to current first-team level.",
    preferredFoot: `${player.footedness ?? "Unknown"}${player.weak_foot ? ` / WF ${player.weak_foot}` : ""}`,
    signingLikelihood,
    agentDemands,
    agentTone: agentDemands === "High" ? "text-app-red" : agentDemands === "Medium" ? "text-amber-500" : "text-app-green",
    expectedFee,
    competition: competitionCount > 1 ? "High" : competitionCount === 1 ? "Medium" : "Low",
    competitionTone: competitionCount > 1 ? "text-app-red" : competitionCount === 1 ? "text-amber-500" : "text-app-green",
    financialFit,
    financialFitTone: financialFit === "Good" ? "text-app-green" : financialFit === "Tight" ? "text-amber-500" : "text-app-red",
    priority: grade.startsWith("A") && financialFit !== "Poor" ? "High" : financialFit === "Poor" ? "Low" : "Medium",
    verdict: `${grade} target with ${signingLikelihood}% signing likelihood.`,
    analystName: analyst ? `${analyst.first_name} ${analyst.last_name}` : "Scouting Department",
    comparisonName: comparison?.match_name ?? "No close match",
    pros: topAttrs,
    cons: lowAttrs,
  };
}

function buildMarketRows(players: PlayerData[], teams: TeamData[]) {
  const totals = new Map<string, number>();
  players.forEach((player) => {
    const team = teams.find((candidate) => candidate.id === player.team_id);
    const key = team?.country ?? player.football_nation ?? player.nationality;
    totals.set(key, (totals.get(key) ?? 0) + player.market_value);
  });
  const rows = Array.from(totals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const max = rows[0]?.value || 1;
  return rows.length > 0 ? rows.map((row) => ({ ...row, pct: Math.max(5, Math.round((row.value / max) * 100)) })) : [{ name: "No market", value: 0, pct: 0 }];
}

function buildAgeBands(players: PlayerData[]) {
  const bands = [
    { label: "U21", count: players.filter((player) => calcAge(player.date_of_birth) <= 21).length },
    { label: "U23", count: players.filter((player) => calcAge(player.date_of_birth) > 21 && calcAge(player.date_of_birth) <= 23).length },
    { label: "24+", count: players.filter((player) => calcAge(player.date_of_birth) >= 24 && calcAge(player.date_of_birth) <= 29).length },
    { label: "30+", count: players.filter((player) => calcAge(player.date_of_birth) >= 30).length },
  ];
  const max = Math.max(1, ...bands.map((band) => band.count));
  return bands.map((band) => ({ ...band, pct: Math.max(8, Math.round((band.count / max) * 100)) }));
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function ShortlistCard({ player, teams, onSelectPlayer }: { player: PlayerData; teams: TeamData[]; onSelectPlayer?: (id: string) => void }) {
  const team = teams.find((candidate) => candidate.id === player.team_id);
  const clubColor = team?.colors?.primary ?? "#ef4444";

  return (
    <button
      type="button"
      onClick={() => onSelectPlayer?.(player.id)}
      className="group flex min-w-[86px] flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-app-border bg-app-bg/50 p-2 transition-colors hover:border-app-green/50"
    >
      <div className="relative flex h-8 w-8 shrink-0 items-end justify-center overflow-hidden rounded-full border border-app-border bg-app-bg pb-0.5">
        <UserPlus className="h-4 w-4 text-app-text-muted/50" />
        <div className="absolute right-0 top-0 h-2 w-2.5 rounded-[2px] border-[0.5px] border-app-border" style={{ backgroundColor: clubColor }} />
      </div>
      <div className="flex w-full flex-col items-center">
        <span className="w-full truncate text-center text-[9px] font-bold transition-colors group-hover:text-app-green">{player.match_name}</span>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="text-[8px] text-app-text-muted">{calcAge(player.date_of_birth)} years old</span>
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
      <span className="hidden">{team ? getTeamName(teams, team.id) : ""}</span>
    </button>
  );
}
