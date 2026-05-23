import { useEffect, useState, type ReactNode } from "react";
import {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
  TeamData,
  TransferOfferData,
} from "../../store/gameStore";
import { Badge, Card, CountryFlag, Select } from "../ui";
import ContextMenu from "../ContextMenu";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Gavel,
  MoreHorizontal,
  Minus,
  PenTool,
  Plus,
  Search,
  Star,
  Target,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  calcAge,
  formatVal,
  formatWeeklyAmount,
  getPlayerOvr,
  getTeamName,
  positionBadgeVariant,
} from "../../lib/helpers";
import { annualAmountToWeeklyCommitment } from "../../lib/finance";
import { useTranslation } from "react-i18next";
import { countryName } from "../../lib/countries";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { type NegotiationFeedbackPanelData } from "../NegotiationFeedbackPanel";
import TransferBidModal from "./TransferBidModal";
import TransferCounterOfferModal from "./TransferCounterOfferModal";
import { getErrorMessage, resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import {
  approachFreeAgent,
  counterOffer,
  makeLoanOffer,
  respondToOffer,
  toggleShortlist,
  toggleLoanList,
  toggleTransferList,
  type TransferNegotiationResponseData,
} from "../../services/transfersService";
import { sendScout } from "../../services/scoutingService";
import {
  buildResumedCounterFeedback,
  getTransferOfferBadgeVariant,
  getTransferOfferStatusLabel,
  mapTransferNegotiationError,
} from "./TransfersTab.helpers";
import {
  applyTransferAdvancedFilters,
  deriveTransferCollections,
  filterTransferPlayers,
  getCurrentTransferList,
  paginateTransferPlayers,
  type TransferAdvancedFilters,
  type TransferTabView,
} from "./TransfersTab.model";
import { calculateAvailableScouts } from "../scouting/ScoutingTab.helpers";
import { buildAlreadyScoutingIds } from "../scouting/ScoutingTab.model";
import {
  buildDividerMenuItem,
  buildScoutPlayerMenuItem,
  buildToggleLoanListMenuItem,
  buildToggleTransferListMenuItem,
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import { useTransferBidFlow } from "./useTransferBidFlow";

interface TransfersTabProps {
  gameState: GameStateData;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onSelectTeam: (id: string) => void;
  onGameUpdate?: (game: GameStateData) => void;
}

type CounterTarget = {
  player: PlayerData;
  offerId: string;
  fromTeamId: string;
  fee: number;
};

type VisualTab = {
  id: string;
  label: string;
  view: TransferTabView;
  ariaLabel?: string;
};

type TransferSortKey = "index" | "player" | "age" | "nationality" | "club" | "position" | "value" | "wage" | "interest" | "rating" | "status";
type SortDirection = "asc" | "desc";

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function broadPosition(position?: string): "Goalkeeper" | "Defender" | "Midfielder" | "Forward" {
  const value = (position || "").toLowerCase();
  if (value.includes("goal") || value === "gk") return "Goalkeeper";
  if (value.includes("def") || value.includes("back") || value.includes("cb") || value.includes("wb")) return "Defender";
  if (value.includes("mid") || value.includes("wing") || value.includes("dm") || value.includes("am")) return "Midfielder";
  return "Forward";
}

function interestForPlayer(player: PlayerData, userTeamId: string | null): number {
  const base = player.team_id === userTeamId ? 25 : 42;
  const listedBoost = player.transfer_listed ? 28 : 0;
  const loanBoost = player.loan_listed ? 12 : 0;
  const moraleBoost = Math.round((player.morale ?? 50) / 10);
  return Math.min(99, base + listedBoost + loanBoost + moraleBoost);
}

function ratingForPlayer(player: PlayerData): number {
  const ovr = getPlayerOvr(player);
  if (ovr >= 78) return 5;
  if (ovr >= 70) return 4;
  if (ovr >= 62) return 3;
  if (ovr >= 54) return 2;
  return 1;
}

function statusForPlayer(player: PlayerData, view: TransferTabView): { label: string; className: string } {
  if (view === "offers" && player.transfer_offers.some((offer) => offer.status === "Pending")) {
    return { label: "Negotiating", className: "text-purple-400 bg-purple-400/10 border-purple-400/20" };
  }
  if (player.transfer_listed) {
    return { label: "Listed", className: "text-app-green bg-app-green/10 border-app-green/20" };
  }
  if (player.loan_listed) {
    return { label: "Loan Option", className: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
  }
  return { label: view === "market" ? "Watched" : "Available", className: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" };
}

export default function TransfersTab({
  gameState,
  onSelectPlayer,
  onSelectTeam,
  onGameUpdate,
}: TransfersTabProps) {
  const { t, i18n } = useTranslation();
  const weeklySuffix = t("finances.perWeekSuffix", "/wk");
  const userTeamId = gameState.manager.team_id;
  const [view, setView] = useState<TransferTabView>("my_list");
  const [visualTab, setVisualTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<TransferAdvancedFilters>({
    minAge: null,
    maxAge: null,
    maxValue: null,
    maxWeeklyWage: null,
    offerStatus: "Any",
  });
  const [openHeaderMenu, setOpenHeaderMenu] = useState<"shortlist" | "finalize" | "actions" | null>(null);
  const [sortKey, setSortKey] = useState<TransferSortKey>("index");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [counterTarget, setCounterTarget] = useState<CounterTarget | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterLoading, setCounterLoading] = useState(false);
  const [counterError, setCounterError] = useState<string | null>(null);
  const [counterResult, setCounterResult] = useState<TransferNegotiationResponseData["decision"] | "error" | null>(null);
  const [counterFeedback, setCounterFeedback] = useState<NegotiationFeedbackPanelData | null>(null);
  const [scoutingPlayerId, setScoutingPlayerId] = useState<string | null>(null);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [loanOfferPlayerId, setLoanOfferPlayerId] = useState<string | null>(null);
  const [loanTarget, setLoanTarget] = useState<PlayerData | null>(null);
  const [loanMonths, setLoanMonths] = useState("6");
  const [loanWageShare, setLoanWageShare] = useState("50");
  const [freeAgentSigningId, setFreeAgentSigningId] = useState<string | null>(null);
  const [freeAgentTarget, setFreeAgentTarget] = useState<PlayerData | null>(null);
  const [freeAgentWage, setFreeAgentWage] = useState("");
  const [freeAgentYears, setFreeAgentYears] = useState("3");
  const [selectedPanelPlayerId, setSelectedPanelPlayerId] = useState<string | null>(null);

  const openCounterNegotiation = (player: PlayerData, offer: TransferOfferData) => {
    setCounterTarget({ player, offerId: offer.id, fromTeamId: offer.from_team_id, fee: offer.fee });
    setCounterAmount(((offer.suggested_counter_fee ?? offer.fee) / 1_000_000).toFixed(offer.negotiation_round > 1 ? 2 : 1));
    setCounterError(null);
    setCounterResult(null);
    setCounterFeedback(buildResumedCounterFeedback(offer));
  };

  const handleRespondOffer = async (playerId: string, offerId: string, accept: boolean) => {
    try {
      const game = await respondToOffer(playerId, offerId, accept);
      if (onGameUpdate) onGameUpdate(game);
    } catch (err) {
      console.error("Failed to respond to offer:", err);
    }
  };

  const handleCounterOffer = async () => {
    if (!counterTarget || !counterAmount) return;

    setCounterLoading(true);
    setCounterError(null);
    setCounterResult(null);
    setCounterFeedback(null);

    try {
      const requestedFee = Math.round(parseFloat(counterAmount) * 1_000_000);
      const response = await counterOffer(counterTarget.player.id, counterTarget.offerId, requestedFee);

      if (onGameUpdate) onGameUpdate(response.game);
      setCounterResult(response.decision);
      setCounterFeedback(response.feedback);
      if (response.suggested_fee !== null) {
        setCounterAmount((response.suggested_fee / 1_000_000).toFixed(2));
      }
      if (response.decision === "accepted") {
        setTimeout(() => {
          setCounterTarget(null);
          setCounterAmount("");
          setCounterResult(null);
          setCounterFeedback(null);
        }, 1500);
      }
    } catch (err: any) {
      setCounterError(mapTransferNegotiationError(t, err?.toString() || "error"));
    } finally {
      setCounterLoading(false);
    }
  };

  const {
    bidTarget,
    bidAmount,
    setBidAmount,
    contractWage,
    setContractWage,
    contractYears,
    setContractYears,
    contractStepActive,
    contractResult,
    bidResult,
    bidLoading,
    bidFeedback,
    bidProjection,
    bidFee,
    activeBidOffer,
    myTeam,
    hasExistingOffer,
    bidSubmitDisabled,
    contractSubmitDisabled,
    openBidNegotiation,
    closeBidNegotiation,
    handleMakeBid,
    handleProposeContract,
  } = useTransferBidFlow({ gameState, onGameUpdate });

  const scouts = gameState.staff.filter((staffMember) => staffMember.role === "Scout" && staffMember.team_id === userTeamId);
  const scoutingAssignments = gameState.scouting_assignments || [];
  const allScoutingAssignments = [...scoutingAssignments, ...(gameState.youth_scouting_assignments || [])];
  const availableScouts = calculateAvailableScouts(scouts, allScoutingAssignments);
  const alreadyScoutingIds = buildAlreadyScoutingIds(scoutingAssignments);
  const activeCounterOffer = counterTarget
    ? counterTarget.player.transfer_offers.find((offer) => offer.id === counterTarget.offerId) ?? null
    : null;
  const seasonContext = resolveSeasonContext(gameState);
  const transferWindow = seasonContext.transfer_window;
  const transferWindowSummary =
    transferWindow.status === "DeadlineDay"
      ? t("season.windowClosesToday")
      : transferWindow.status === "Open" && transferWindow.days_remaining !== null
        ? t("season.windowClosesInDays", { count: transferWindow.days_remaining })
        : transferWindow.status === "Closed" && transferWindow.days_until_opens !== null
          ? t("season.windowOpensInDays", { count: transferWindow.days_until_opens })
          : t("season.windowClosed");

  const transferCollections = deriveTransferCollections(gameState, userTeamId);
  const { myTransferList, myLoanList, marketPlayers, loanPlayers, playersWithOffers, shortlistedPlayers } = transferCollections;
  const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
  const currentList = getCurrentTransferList(view, transferCollections);
  const basicFilteredList = filterTransferPlayers(currentList, search, posFilter);
  const filteredList = applyTransferAdvancedFilters(
    basicFilteredList,
    advancedFilters,
    gameState.clock.current_date,
  );
  const sortedList = [...filteredList].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortKey === "index") return 0;
    if (sortKey === "player") return direction * a.full_name.localeCompare(b.full_name, i18n.language);
    if (sortKey === "age") return direction * (calcAge(a.date_of_birth) - calcAge(b.date_of_birth));
    if (sortKey === "nationality") return direction * countryName(a.nationality, i18n.language).localeCompare(countryName(b.nationality, i18n.language), i18n.language);
    if (sortKey === "club") return direction * getTeamName(gameState.teams, a.team_id).localeCompare(getTeamName(gameState.teams, b.team_id), i18n.language);
    if (sortKey === "position") return direction * translatePositionAbbreviation(t, a.natural_position || a.position).localeCompare(translatePositionAbbreviation(t, b.natural_position || b.position), i18n.language);
    if (sortKey === "value") return direction * (a.market_value - b.market_value);
    if (sortKey === "wage") return direction * (a.wage - b.wage);
    if (sortKey === "interest") return direction * (interestForPlayer(a, userTeamId) - interestForPlayer(b, userTeamId));
    if (sortKey === "rating") return direction * (ratingForPlayer(a) - ratingForPlayer(b));
    return direction * statusForPlayer(a, view).label.localeCompare(statusForPlayer(b, view).label, i18n.language);
  });
  const paginatedTargets = paginateTransferPlayers(sortedList, page, pageSize);
  const visibleTransferTargets = paginatedTargets.items;
  const weeklyWageBudget = myTeam ? annualAmountToWeeklyCommitment(myTeam.wage_budget) : 0;
  const selectedPanelPlayer = selectedPanelPlayerId
    ? gameState.players.find((player) => player.id === selectedPanelPlayerId) ?? null
    : null;
  const panelPlayer = bidTarget ?? counterTarget?.player ?? selectedPanelPlayer ?? playersWithOffers[0] ?? filteredList[0] ?? marketPlayers[0] ?? gameState.players[0] ?? null;
  const panelOffer = panelPlayer?.transfer_offers.find((offer) => offer.status === "Pending") ?? null;
  const userTeamPlayers = gameState.players.filter((player) => player.team_id === userTeamId);
  const positionCounts = positions.map((position) => ({
    position,
    count: userTeamPlayers.filter((player) => broadPosition(player.natural_position || player.position) === position).length,
  }));
  const marketAverageValue = marketPlayers.length > 0
    ? marketPlayers.reduce((sum, player) => sum + player.market_value, 0) / marketPlayers.length
    : 0;
  const transferBudgetPercent = myTeam && myTeam.finance > 0
    ? Math.max(0, Math.min(100, Math.round((myTeam.transfer_budget / Math.max(myTeam.finance, myTeam.transfer_budget)) * 100)))
    : 0;
  const chartData = [
    { m: "List", v: myTransferList.length },
    { m: "Loan", v: myLoanList.length },
    { m: "Market", v: marketPlayers.length },
    { m: "Offers", v: playersWithOffers.length },
    { m: "Short", v: shortlistedPlayers.length },
    { m: "Pool", v: filteredList.length },
  ];
  const visualTabs: VisualTab[] = [
    { id: "Overview", label: "Overview", view: "my_list" },
    { id: "Transfer Targets", label: "Transfer Targets", view: "market", ariaLabel: t("transfers.transferMarket") },
    { id: "Negotiations", label: "Negotiations", view: "offers", ariaLabel: t("transfers.offers") },
    { id: "Incoming", label: "Incoming", view: "offers" },
    { id: "Outgoing", label: "Outgoing", view: "my_list" },
    { id: "Loans", label: "Loans", view: "loans" },
    { id: "Shortlists", label: "Shortlists", view: "shortlist" },
  ];

  useEffect(() => {
    setPage(1);
  }, [view, search, posFilter, advancedFilters]);

  const switchTab = (tab: VisualTab) => {
    setVisualTab(tab.id);
    setView(tab.view);
  };

  const toggleSort = (key: TransferSortKey) => {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDirection(key === "player" || key === "nationality" || key === "club" || key === "position" || key === "status" ? "asc" : "desc");
  };

  const openTransferView = (nextView: TransferTabView, nextTab?: string) => {
    setView(nextView);
    if (nextTab) setVisualTab(nextTab);
    setOpenHeaderMenu(null);
  };

  const clearLocalFilters = () => {
    setSearch("");
    setPosFilter(null);
    setAdvancedFilters({
      minAge: null,
      maxAge: null,
      maxValue: null,
      maxWeeklyWage: null,
      offerStatus: "Any",
    });
    setOpenHeaderMenu(null);
  };

  const setNullableNumberFilter = (
    key: keyof Omit<TransferAdvancedFilters, "offerStatus">,
    value: string,
  ) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: value ? Number(value) : null,
    }));
  };

  const handleScoutPlayer = async (playerId: string): Promise<void> => {
    if (availableScouts.length === 0) {
      setScoutError(null);
      return;
    }

    const scout = availableScouts[0];
    setScoutError(null);
    setScoutingPlayerId(playerId);

    try {
      const updated = await sendScout(scout.id, playerId);
      setScoutError(null);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to send scout:", error);
      setScoutError(resolveTranslatedErrorMessage(getErrorMessage(error), t));
    } finally {
      setScoutingPlayerId(null);
    }
  };

  const handleToggleTransferList = async (player: PlayerData) => {
    try {
      const updated = await toggleTransferList(player.id);
      onGameUpdate?.(updated);
    } catch {
      return;
    }
  };

  const handleToggleLoanList = async (player: PlayerData) => {
    try {
      const updated = await toggleLoanList(player.id);
      onGameUpdate?.(updated);
    } catch {
      return;
    }
  };

  const openLoanOfferModal = (player: PlayerData) => {
    setLoanTarget(player);
    setLoanMonths(String(player.loan_until ? 3 : 6));
    setLoanWageShare(String(player.loan_wage_share_percent ?? 50));
  };

  const handleMakeLoanOffer = async () => {
    if (!loanTarget) return;

    const months = Math.round(Number.parseFloat(loanMonths));
    const wageShare = Math.round(Number.parseFloat(loanWageShare));
    if (!Number.isFinite(months) || !Number.isFinite(wageShare) || months <= 0 || wageShare < 0 || wageShare > 100) return;

    setLoanOfferPlayerId(loanTarget.id);
    try {
      const response = await makeLoanOffer(loanTarget.id, months, wageShare);
      onGameUpdate?.(response.game);
      setLoanTarget(null);
    } catch (error) {
      console.error("Failed to make loan offer:", error);
    } finally {
      setLoanOfferPlayerId(null);
    }
  };

  const handleToggleShortlist = async (player: PlayerData) => {
    try {
      const updated = await toggleShortlist(player.id);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to toggle shortlist:", error);
    }
  };

  const openFreeAgentModal = (player: PlayerData) => {
    setFreeAgentTarget(player);
    setFreeAgentWage(String(player.wage || 1000));
    setFreeAgentYears("3");
  };

  const handleApproachFreeAgent = async () => {
    if (!freeAgentTarget) return;

    const wage = Math.round(Number.parseFloat(freeAgentWage));
    const years = Math.round(Number.parseFloat(freeAgentYears));
    if (!Number.isFinite(wage) || !Number.isFinite(years) || wage <= 0 || years <= 0) return;

    setFreeAgentSigningId(freeAgentTarget.id);
    try {
      const response = await approachFreeAgent(freeAgentTarget.id, wage, years);
      onGameUpdate?.(response.game);
      if (response.suggested_wage !== null) setFreeAgentWage(String(response.suggested_wage));
      if (response.suggested_years !== null) setFreeAgentYears(String(response.suggested_years));
      if (response.decision === "accepted") setFreeAgentTarget(null);
    } catch (error) {
      console.error("Failed to approach free agent:", error);
    } finally {
      setFreeAgentSigningId(null);
    }
  };

  const renderPlayerContextRow = (player: PlayerData, index: number) => {
    const age = calcAge(player.date_of_birth);
    const scoutState = alreadyScoutingIds.has(player.id)
      ? "already-assigned"
      : scoutingPlayerId === player.id
        ? "busy"
        : availableScouts.length === 0
          ? "unavailable"
          : "ready";
    const contextItems = [
      buildViewProfileMenuItem(t, () => onSelectPlayer(player.id)),
      ...(player.team_id ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))] : []),
    ];

    if (view === "my_list") {
      contextItems.push(buildDividerMenuItem());
      contextItems.push(buildToggleTransferListMenuItem(t, player.transfer_listed, () => handleToggleTransferList(player)));
      contextItems.push(buildToggleLoanListMenuItem(t, player.loan_listed, () => handleToggleLoanList(player)));
    }

    if (view === "market" || view === "loans") {
      contextItems.push(buildDividerMenuItem());
      contextItems.push(buildScoutPlayerMenuItem(t, scoutState, () => void handleScoutPlayer(player.id)));
      contextItems.push({ label: player.shortlisted ? t("transfers.removeShortlist", "Remove shortlist") : t("transfers.addShortlist", "Add shortlist"), icon: <Star className="w-4 h-4" />, onClick: () => void handleToggleShortlist(player) });
      contextItems.push(
        player.team_id === null
          ? { label: t("transfers.approachToSign", "Approach to sign"), icon: <UserPlus className="w-4 h-4" />, onClick: () => openFreeAgentModal(player) }
          : view === "loans"
            ? { label: t("transfers.loanOffer", "Loan offer"), icon: <CalendarDays className="w-4 h-4" />, onClick: () => openLoanOfferModal(player) }
            : { label: t("transfers.bid"), icon: <Gavel className="w-4 h-4" />, onClick: () => openBidNegotiation(player) },
      );
    }

    const status = statusForPlayer(player, view);
    const interest = interestForPlayer(player, userTeamId);
    const primaryOffer = player.transfer_offers[0] ?? null;
    const isPanelSelected = panelPlayer?.id === player.id;
    const row = (
      <tr
        className={cn(
          "hover:bg-white/5 transition-colors cursor-pointer group",
          isPanelSelected && "bg-app-green/5 ring-1 ring-inset ring-app-green/30",
        )}
        onClick={() => setSelectedPanelPlayerId(player.id)}
      >
        <td className="py-2.5 px-3 text-app-text-muted text-[10px] w-6">{index + 1}</td>
        <td className="py-2.5 pl-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full overflow-hidden border border-app-border bg-app-bg shrink-0 flex items-center justify-center">
              <User className="w-2.5 h-2.5 text-app-text-muted/50" />
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectPlayer(player.id);
              }}
              className="font-bold text-left transition-colors hover:text-app-green group-hover:text-app-green"
            >
              {player.full_name}
            </button>
          </div>
        </td>
        <td className="py-2.5 px-2 text-app-text-muted">{age}</td>
        <td className="py-2.5 text-app-text-muted">
          <div className="flex items-center gap-1">
            <CountryFlag code={player.nationality} locale={i18n.language} className="text-sm leading-none" />
            <span>{countryName(player.nationality, i18n.language)}</span>
          </div>
        </td>
        <td className="py-2.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (player.team_id) onSelectTeam(player.team_id);
            }}
            className="text-app-text-muted hover:text-app-green transition-colors"
          >
            {getTeamName(gameState.teams, player.team_id)}
          </button>
        </td>
        <td className="py-2.5 text-app-text-muted">
          <Badge variant={positionBadgeVariant(player.natural_position || player.position)} size="sm">
            {translatePositionAbbreviation(t, player.natural_position || player.position)}
          </Badge>
        </td>
        <td className="py-2.5 text-right px-2 font-medium">{formatVal(player.market_value)}</td>
        <td className="py-2.5 text-right px-2 text-app-text-muted">{formatWeeklyAmount(formatVal(annualAmountToWeeklyCommitment(player.wage)), weeklySuffix)}</td>
        <td className="py-2.5 text-center px-2">
          <div className="flex justify-center items-center gap-1">
            <svg className="w-4 h-4 transform -rotate-90">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="transparent" className="text-app-border" />
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="transparent" strokeDasharray="37.7" strokeDashoffset={37.7 * (1 - interest / 100)} className="text-app-green" strokeLinecap="round" />
            </svg>
            <span className="text-app-green font-medium">{interest}%</span>
          </div>
        </td>
        <td className="py-2.5 px-2"><div className="flex justify-center text-app-green"><StarRating rating={ratingForPlayer(player)} /></div></td>
        <td className="py-2.5 pr-3 text-right">
          {view === "offers" && primaryOffer ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Badge variant={getTransferOfferBadgeVariant(primaryOffer.status)} size="sm">
                {formatVal(primaryOffer.fee)} — {getTransferOfferStatusLabel(t, primaryOffer.status)}
              </Badge>
              {primaryOffer.status === "Pending" && player.team_id === userTeamId ? (
                <div className="flex gap-1">
                  <button type="button" onClick={(event) => { event.stopPropagation(); void handleRespondOffer(player.id, primaryOffer.id, true); }} className="p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-500" title={t("transfers.acceptOffer")}><Check className="w-3 h-3" /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void handleRespondOffer(player.id, primaryOffer.id, false); }} className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500" title={t("transfers.rejectOffer")}><X className="w-3 h-3" /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); openCounterNegotiation(player, primaryOffer); }} aria-label={t("transfers.counterOffer")} className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-heading font-bold uppercase tracking-wider"><Gavel className="w-3 h-3" /> {t("transfers.counter")}</button>
                </div>
              ) : null}
            </div>
          ) : view === "market" || view === "loans" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (player.team_id === null) {
                  openFreeAgentModal(player);
                } else if (view === "loans") {
                  openLoanOfferModal(player);
                } else {
                  openBidNegotiation(player);
                }
              }}
              disabled={loanOfferPlayerId === player.id || freeAgentSigningId === player.id}
              className="px-2 py-1 rounded text-[9px] font-bold border inline-flex items-center gap-1 text-app-bg bg-app-green border-app-green disabled:opacity-50"
            >
              {player.team_id === null ? <UserPlus className="w-2.5 h-2.5" /> : view === "loans" ? <CalendarDays className="w-2.5 h-2.5" /> : <Gavel className="w-2.5 h-2.5" />}
              {player.team_id === null ? t("transfers.sign", "Sign") : view === "loans" ? t("transfers.loan", "Loan") : t("transfers.bid")}
            </button>
          ) : (
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border inline-flex items-center gap-1 max-w-[95px] truncate", status.className)}>{status.label}</span>
          )}
        </td>
      </tr>
    );

    return <ContextMenu items={contextItems} key={player.id}>{row}</ContextMenu>;
  };

  return (
    <div className="flex flex-col gap-4 min-h-max max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-app-bg border border-app-border rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">TRANSFERS</h1>
            <p className="text-sm text-app-text-muted">Transfer Hub • Market Activity</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setVisualTab("Transfer Targets"); setView("market"); }} className="flex items-center gap-2 px-4 py-2 bg-app-card border border-app-border rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
            <PenTool className="w-4 h-4 text-app-text-muted" />
            Make Offer
          </button>
          <button type="button" onClick={() => { setVisualTab("Transfer Targets"); setView("market"); setPosFilter(null); }} className="flex items-center gap-2 px-4 py-2 bg-app-card border border-app-border rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
            <UserPlus className="w-4 h-4 text-app-text-muted" />
            Approach to Sign
          </button>
          <div className="relative flex items-center bg-app-card border border-app-border rounded-lg transition-colors">
            <button type="button" onClick={() => openTransferView("my_list", "Shortlists")} className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-white/5 border-r border-app-border/50">
              <Star className="w-4 h-4 text-app-text-muted" />
              Shortlist
            </button>
            <button type="button" onClick={() => setOpenHeaderMenu((menu) => menu === "shortlist" ? null : "shortlist")} className="px-2 py-2 hover:bg-white/5" aria-label="Shortlist menu" aria-expanded={openHeaderMenu === "shortlist"}><ChevronDown className="w-4 h-4 text-app-text-muted" /></button>
            {openHeaderMenu === "shortlist" ? (
              <HeaderMenu>
                <HeaderMenuButton label="Open listed players" onClick={() => openTransferView("my_list", "Shortlists")} />
                <HeaderMenuButton label="Clear transfer filters" onClick={clearLocalFilters} />
              </HeaderMenu>
            ) : null}
          </div>
          <div className="relative flex items-center bg-app-green hover:bg-app-green/90 text-app-bg rounded-lg transition-colors">
            <button type="button" onClick={() => openTransferView("offers", "Negotiations")} className="flex items-center gap-2 px-3 py-2 text-sm font-bold border-r border-black/10">
              <CheckCircle2 className="w-4 h-4" />
              Finalize Deal
            </button>
            <button type="button" onClick={() => setOpenHeaderMenu((menu) => menu === "finalize" ? null : "finalize")} className="px-2 py-2 hover:bg-black/10" aria-label="Finalize menu" aria-expanded={openHeaderMenu === "finalize"}><ChevronDown className="w-4 h-4" /></button>
            {openHeaderMenu === "finalize" ? (
              <HeaderMenu>
                <HeaderMenuButton label="Open active offers" onClick={() => openTransferView("offers", "Negotiations")} />
                <HeaderMenuButton label="Open transfer market" onClick={() => openTransferView("market", "Transfer Targets")} />
              </HeaderMenu>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setOpenHeaderMenu((menu) => menu === "actions" ? null : "actions")} className="p-2 bg-app-card border border-app-border rounded-lg hover:bg-white/5 transition-colors" aria-label="Transfer actions" aria-expanded={openHeaderMenu === "actions"}><MoreHorizontal className="w-4 h-4 text-app-text-muted" /></button>
            {openHeaderMenu === "actions" ? (
              <HeaderMenu alignRight>
                <HeaderMenuButton label="Open transfer market" onClick={() => openTransferView("market", "Transfer Targets")} />
                <HeaderMenuButton label="Open loan market" onClick={() => openTransferView("loans", "Loans")} />
                <HeaderMenuButton label="Open shortlist" onClick={() => openTransferView("shortlist", "Shortlists")} />
                <HeaderMenuButton label="Open offers" onClick={() => openTransferView("offers", "Negotiations")} />
                <HeaderMenuButton label="Open listed players" onClick={() => openTransferView("my_list", "Shortlists")} />
              </HeaderMenu>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-app-border/50 px-2 mt-2 overflow-x-auto custom-scrollbar">
        {visualTabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            aria-label={tab.ariaLabel}
            onClick={() => switchTab(tab)}
            className={cn(
              "pb-3 -mb-[2px] text-sm whitespace-nowrap transition-colors",
              visualTab === tab.id
                ? "text-app-green font-semibold border-b-2 border-app-green"
                : "text-app-text-muted hover:text-white font-medium",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {scoutError && (view === "market" || view === "loans") ? <p role="alert" className="text-xs font-heading font-bold uppercase tracking-wider text-red-500">{scoutError}</p> : null}

      <div className="flex flex-col xl:flex-row gap-4 mt-2 h-[800px] xl:h-[750px]">
        <div className="w-full xl:w-[280px] flex-col gap-4 shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 hidden sm:flex">
          <Section title="TRANSFER BUDGET">
            <Card className="flex flex-col text-xs p-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-app-text-muted">Transfer Budget</span>
                  <span className="text-2xl font-bold text-white leading-none mt-1">{formatVal(myTeam?.transfer_budget ?? 0)}</span>
                  <span className="text-[10px] text-app-text-muted mt-1">Balance: {formatVal(myTeam?.finance ?? 0)}</span>
                </div>
                <BudgetRing value={transferBudgetPercent} />
              </div>
              <span className="text-[9px] text-app-text-muted text-right -mt-2">Remaining</span>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-app-border/50">
                <MetricRow label="Wage Budget" value={formatWeeklyAmount(formatVal(weeklyWageBudget), weeklySuffix)} />
                <MetricRow label="Available Scouts" value={`${availableScouts.length}/${scouts.length}`} />
                <MetricRow label="Transfer Listed" value={String(myTransferList.length)} />
                <MetricRow label="Loan Listed" value={String(myLoanList.length)} />
                <MetricRow label="Board Flexibility" value={transferBudgetPercent >= 40 ? "Medium/High" : "Limited"} valueClassName={transferBudgetPercent >= 40 ? "text-app-green" : "text-amber-500"} />
              </div>
              <button type="button" onClick={() => setView("my_list")} className="w-full h-8 flex items-center justify-center gap-1.5 mt-4 bg-app-bg border border-app-border rounded-lg text-app-text-muted text-[10px] hover:text-white transition-colors group">
                Budget Overview <ChevronRight className="w-3.5 h-3.5 group-hover:text-white transition-colors" />
              </button>
            </Card>
          </Section>

          <Section title="SQUAD NEEDS">
            <Card className="flex flex-col text-[11px]">
              <div className="p-3 gap-1 flex flex-col">
                {positionCounts.map(({ position, count }) => (
                  <NeedRow key={position} pos={translatePositionAbbreviation(t, position)} posName={position} status={count < 2 ? "High Priority" : count < 4 ? "Medium" : "Covered"} statusColor={count < 2 ? "text-red-400" : count < 4 ? "text-amber-500" : "text-app-green"} />
                ))}
              </div>
              <div className="h-9 flex items-center justify-between px-3 border-t border-app-border/50 text-app-text-muted group">
                <span className="text-[10px]">Tactical Fit: <span className="text-white">{myTeam?.formation ?? "--"}</span></span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:text-white transition-colors" />
              </div>
            </Card>
          </Section>

          <Section title="MARKET CALENDAR">
            <Card className="flex flex-col text-[11px]">
              <div className="p-3 flex flex-col gap-2.5">
                <CalendarRow icon={<CheckCircle2 className="w-3.5 h-3.5 text-app-green" />} text="Transfer Window" date={t(`season.transferWindowStatus.${transferWindow.status}`)} dateColor="text-white" />
                <CalendarRow icon={<CalendarDays className="w-3.5 h-3.5 text-app-text-muted" />} text="Window Summary" date={transferWindowSummary} dateColor="text-app-text-muted" />
                <CalendarRow bgClass={transferWindow.status === "DeadlineDay" ? "bg-red-400/10 px-1.5 py-1 -mx-1.5 rounded" : undefined} icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />} text="Active Offers" textClass={transferWindow.status === "DeadlineDay" ? "text-red-500 font-medium" : undefined} date={String(playersWithOffers.length)} dateColor="text-red-500 font-medium" />
                <CalendarRow icon={<FileText className="w-3.5 h-3.5 text-app-text-muted" />} text="Transfer Targets" date={String(marketPlayers.length)} dateColor="text-app-text-muted" />
                <CalendarRow icon={<Activity className="w-3.5 h-3.5 text-app-text-muted" />} text="Loan Market" date={String(loanPlayers.length)} dateColor="text-app-text-muted" />
                <CalendarRow icon={<PenTool className="w-3.5 h-3.5 text-app-text-muted" />} text="Listed Players" date={String(myTransferList.length + myLoanList.length)} dateColor="text-app-text-muted" />
                <CalendarRow icon={<Search className="w-3.5 h-3.5 text-app-text-muted" />} text="Scouting Capacity" date={`${availableScouts.length} free`} dateColor="text-app-text-muted" />
              </div>
            </Card>
          </Section>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0 h-full">
          <Card className="relative z-30 flex flex-col overflow-visible p-4 w-full h-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold text-app-green tracking-widest uppercase">TRANSFER TARGETS</h2>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider">{t("common.nResults", { count: filteredList.length })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full">
              <button type="button" onClick={() => setPosFilter(null)} className={cn("px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1", !posFilter ? "bg-app-green/20 border-app-green/50 text-app-green" : "bg-app-bg border-app-border text-app-text-muted hover:text-white")}>
                <Target className="w-3.5 h-3.5" /> All Targets
              </button>
              {positions.map((position) => <FilterBadge key={position} active={posFilter === position} onClick={() => setPosFilter(posFilter === position ? null : position)}>{translatePositionAbbreviation(t, position)}</FilterBadge>)}
              <FilterDropdown
                label="Position"
                ariaLabel="Position filter"
                value={posFilter ?? ""}
                className="w-[150px]"
                onChange={(value) => setPosFilter(value || null)}
                options={[
                  { value: "", label: "Any Position" },
                  ...positions.map((position) => ({
                    value: position,
                    label: translatePositionAbbreviation(t, position),
                  })),
                ]}
              />
              <FilterDropdown
                label="List View"
                ariaLabel="Transfer list view"
                value={view}
                className="w-[150px]"
                onChange={(value) => {
                  setView(value as TransferTabView);
                  const selectedTab = visualTabs.find((tab) => tab.view === value);
                  if (selectedTab) setVisualTab(selectedTab.id);
                }}
                options={[
                  { value: "my_list", label: "Shortlists" },
                  { value: "market", label: "Transfer Market" },
                  { value: "loans", label: "Loan Market" },
                  { value: "offers", label: "Offers" },
                ]}
              />
              <div className="relative ml-auto flex-1 max-w-[240px] self-end">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                <input type="text" placeholder="Search targets..." value={search} onChange={(event) => setSearch(event.target.value)} className="bg-app-bg border border-app-border rounded-lg pl-8 pr-3 py-1.5 text-[11px] focus:outline-none focus:border-app-green/50 placeholder:text-app-text-muted w-full text-app-text" />
              </div>
              <button
                type="button"
                aria-expanded={advancedFiltersOpen}
                onClick={() => setAdvancedFiltersOpen((open) => !open)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs text-app-text-muted hover:text-white transition-colors"
              >
                <Filter className="w-3.5 h-3.5" /> Advanced filters
              </button>
            </div>
            {advancedFiltersOpen ? (
              <div className="mt-3 border-t border-app-border/40 pt-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                  <AdvancedFilterInput label="Minimum age" value={advancedFilters.minAge} onChange={(value) => setNullableNumberFilter("minAge", value)} />
                  <AdvancedFilterInput label="Maximum age" value={advancedFilters.maxAge} onChange={(value) => setNullableNumberFilter("maxAge", value)} />
                  <AdvancedFilterInput label="Maximum value" value={advancedFilters.maxValue} onChange={(value) => setNullableNumberFilter("maxValue", value)} />
                  <AdvancedFilterInput label="Maximum weekly wage" value={advancedFilters.maxWeeklyWage} onChange={(value) => setNullableNumberFilter("maxWeeklyWage", value)} />
                  <FilterDropdown
                    label="Offer Status"
                    ariaLabel="Offer status"
                    value={advancedFilters.offerStatus}
                    className="min-w-0"
                    onChange={(value) => setAdvancedFilters((current) => ({
                      ...current,
                      offerStatus: value as TransferAdvancedFilters["offerStatus"],
                    }))}
                    options={(["Any", "Pending", "Accepted", "Rejected", "Withdrawn"] as const).map((status) => ({ value: status, label: status }))}
                  />
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="flex flex-col flex-1 min-h-0 bg-app-bg border-app-border">
            <div className="overflow-x-auto min-h-0 flex-1 custom-scrollbar">
              <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1000px]">
                <thead className="sticky top-0 bg-app-card z-10 shadow-sm border-b border-app-border/50">
                  <tr className="text-app-text-muted uppercase tracking-wider text-[9px] font-bold">
                    <SortableHeader label="#" sortKey="index" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 px-3" />
                    <SortableHeader label="PLAYER" sortKey="player" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 pl-1" />
                    <SortableHeader label="AGE" sortKey="age" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 px-2" />
                    <SortableHeader label="NAT" sortKey="nationality" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5" />
                    <SortableHeader label="CLUB" sortKey="club" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5" />
                    <SortableHeader label="POSITION" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5" />
                    <SortableHeader label="VALUE" sortKey="value" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 px-2" align="right" />
                    <SortableHeader label="WAGE" sortKey="wage" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 px-2" align="right" />
                    <SortableHeader label="INTEREST" sortKey="interest" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5" align="center" />
                    <SortableHeader label="SCOUT RATING" sortKey="rating" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5" align="center" />
                    <SortableHeader label="STATUS" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="py-2.5 pr-3" align="center" />
                  </tr>
                </thead>
                <tbody className="text-app-text divide-y divide-app-border/30">
                  {visibleTransferTargets.length > 0 ? visibleTransferTargets.map((player, index) => renderPlayerContextRow(player, (paginatedTargets.page - 1) * pageSize + index)) : (
                    <tr><td colSpan={11} className="py-12 text-center text-app-text-muted">{view === "market" ? t("transfers.noTransferMarket") : view === "loans" ? t("transfers.noLoanMarket") : view === "shortlist" ? t("transfers.noShortlist", "No shortlisted players") : view === "offers" ? t("transfers.noOffers") : t("transfers.noPlayersListed")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-2.5 border-t border-app-border/50 flex items-center justify-between text-[11px] text-app-text-muted">
              <span>{filteredList.length} targets</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous transfer targets page"
                  disabled={paginatedTargets.page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="px-2 py-1 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-app-text-muted"
                >
                  &lt;
                </button>
                <span className="px-2 py-1 text-[10px] font-bold text-app-text" aria-live="polite">
                  Page {paginatedTargets.page} of {paginatedTargets.pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next transfer targets page"
                  disabled={paginatedTargets.page === paginatedTargets.pageCount}
                  onClick={() => setPage((current) => Math.min(paginatedTargets.pageCount, current + 1))}
                  className="px-2 py-1 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-app-text-muted"
                >
                  &gt;
                </button>
              </div>
            </div>
          </Card>
        </div>

        <NegotiationPanel
          player={panelPlayer}
          teams={gameState.teams}
          userTeamId={userTeamId}
          offer={panelOffer}
          bidProjection={bidProjection}
          weeklySuffix={weeklySuffix}
          locale={i18n.language}
          onMakeOffer={(fee) => {
            if (panelPlayer && panelPlayer.team_id !== userTeamId) {
              openBidNegotiation(panelPlayer);
              setBidAmount((fee / 1_000_000).toFixed(1));
            } else {
              setView("market");
            }
          }}
          onNegotiate={(fee) => {
            if (panelPlayer && panelOffer) {
              openCounterNegotiation(panelPlayer, panelOffer);
              setCounterAmount((fee / 1_000_000).toFixed(2));
            } else {
              setView("offers");
            }
          }}
          onWalkAway={() => setVisualTab("Overview")}
          onSelectPlayer={() => panelPlayer && onSelectPlayer(panelPlayer.id)}
          onSelectTeam={() => panelPlayer?.team_id && onSelectTeam(panelPlayer.team_id)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 pb-4">
        <BottomTransferCard title="INCOMING TRANSFERS" players={playersWithOffers} teams={gameState.teams} empty="No incoming offers" onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <BottomTransferCard title="OUTGOING TRANSFERS" players={myTransferList} teams={gameState.teams} empty="No outgoing transfers" onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <LoanWatchCard players={[...myLoanList, ...loanPlayers].slice(0, 4)} teams={gameState.teams} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">MARKET INSIGHTS</h3>
          <Card className="flex flex-col p-3 text-[11px] h-full flex-1 justify-between">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-1"><span className="text-[9px] font-bold text-app-text-muted uppercase">MARKET ACTIVITY</span></div>
              <div className="h-[70px] w-full -ml-3 mt-1">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 70 }}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="transferMarketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} /><stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 6 }} interval="preserveStartEnd" />
                    <YAxis hide domain={[0, "dataMax"]} />
                    <Area type="monotone" dataKey="v" stroke="#2dd4bf" strokeWidth={1.5} fillOpacity={1} fill="url(#transferMarketArea)" dot={{ r: 2, fill: "#2dd4bf", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-2 w-full pt-2 border-t border-app-border/30">
              <span className="text-[9px] font-bold text-app-text-muted uppercase mb-1">HOTTEST POSITIONS</span>
              {positionCounts.map(({ position, count }) => <HottestBar key={position} pos={position} val={`${count} owned`} pct={Math.min(100, count * 20)} />)}
              <HottestBar pos="Average Market Value" val={formatVal(marketAverageValue)} pct={marketAverageValue > 0 ? 70 : 5} />
            </div>
          </Card>
        </div>
        <ShortlistCardGroup players={myTransferList.slice(0, 5)} onSelectPlayer={onSelectPlayer} />
      </div>

      {loanTarget && (
        <SimpleTransferFormModal
          title={t("transfers.loanOffer", "Loan offer")}
          player={loanTarget}
          teams={gameState.teams}
          primaryLabel={t("transfers.submitLoan", "Submit loan")}
          loading={loanOfferPlayerId === loanTarget.id}
          fields={[
            { label: t("transfers.loanMonths", "Loan months"), value: loanMonths, onChange: setLoanMonths, min: 1, max: 24 },
            { label: t("transfers.wageShare", "Wage share %"), value: loanWageShare, onChange: setLoanWageShare, min: 0, max: 100 },
          ]}
          onSubmit={() => void handleMakeLoanOffer()}
          onClose={() => setLoanTarget(null)}
        />
      )}
      {freeAgentTarget && (
        <SimpleTransferFormModal
          title={t("transfers.approachToSign", "Approach to sign")}
          player={freeAgentTarget}
          teams={gameState.teams}
          primaryLabel={t("transfers.submitContract", "Submit contract")}
          loading={freeAgentSigningId === freeAgentTarget.id}
          fields={[
            { label: t("transfers.weeklyWage", "Weekly wage"), value: freeAgentWage, onChange: setFreeAgentWage, min: 1 },
            { label: t("transfers.contractYears", "Years"), value: freeAgentYears, onChange: setFreeAgentYears, min: 1, max: 5 },
          ]}
          onSubmit={() => void handleApproachFreeAgent()}
          onClose={() => setFreeAgentTarget(null)}
        />
      )}

      {bidTarget && (
        <TransferBidModal
          bidTarget={bidTarget}
          teams={gameState.teams}
          bidAmount={bidAmount}
          onBidAmountChange={setBidAmount}
          contractWage={contractWage}
          onContractWageChange={setContractWage}
          contractYears={contractYears}
          onContractYearsChange={setContractYears}
          contractStepActive={contractStepActive}
          contractResult={contractResult}
          myTeam={myTeam ?? null}
          bidFee={bidFee}
          bidProjection={bidProjection}
          bidFeedback={bidFeedback}
          activeBidOffer={activeBidOffer}
          hasExistingOffer={hasExistingOffer}
          bidResult={bidResult}
          bidLoading={bidLoading}
          bidSubmitDisabled={bidSubmitDisabled}
          contractSubmitDisabled={contractSubmitDisabled}
          onSubmit={handleMakeBid}
          onSubmitContract={handleProposeContract}
          onClose={closeBidNegotiation}
        />
      )}
      {counterTarget && (
        <TransferCounterOfferModal
          counterTarget={counterTarget}
          teams={gameState.teams}
          counterAmount={counterAmount}
          onCounterAmountChange={setCounterAmount}
          counterFeedback={counterFeedback}
          activeCounterOffer={activeCounterOffer}
          counterResult={counterResult}
          counterError={counterError}
          counterLoading={counterLoading}
          onSubmit={handleCounterOffer}
          onClose={() => {
            setCounterTarget(null);
            setCounterAmount("");
            setCounterError(null);
            setCounterResult(null);
            setCounterFeedback(null);
          }}
        />
      )}
    </div>
  );
}

function SimpleTransferFormModal({
  title,
  player,
  teams,
  fields,
  primaryLabel,
  loading,
  onSubmit,
  onClose,
}: {
  title: string;
  player: PlayerData;
  teams: TeamData[];
  fields: Array<{ label: string; value: string; onChange: (value: string) => void; min?: number; max?: number }>;
  primaryLabel: string;
  loading: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-app-border bg-app-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="mb-3 text-sm font-heading font-bold uppercase tracking-wider text-app-text-muted">{title}</h3>
        <div className="mb-4 rounded-lg border border-app-border/60 bg-app-bg/50 p-3">
          <p className="text-sm font-bold text-app-text">{player.full_name}</p>
          <p className="text-xs text-app-text-muted">{getTeamName(teams, player.team_id)} • {formatVal(player.market_value)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((field) => (
            <label key={field.label} className="text-[11px] font-semibold text-app-text-muted">
              {field.label}
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text focus:outline-none focus:border-app-green/50"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={loading} onClick={onSubmit} className="flex-1 rounded-lg bg-app-green px-3 py-2 text-sm font-bold uppercase tracking-wider text-app-bg disabled:opacity-50">
            {loading ? "..." : primaryLabel}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-app-border px-3 py-2 text-sm font-bold uppercase tracking-wider text-app-text-muted hover:bg-white/5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">{title}</h3>{children}</div>;
}

function HeaderMenu({ children, alignRight }: { children: ReactNode; alignRight?: boolean }) {
  return (
    <div className={cn("absolute top-full z-30 mt-2 min-w-40 rounded-lg border border-app-border bg-app-card p-1 shadow-xl", alignRight ? "right-0" : "left-0")}>
      {children}
    </div>
  );
}

function HeaderMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="block w-full rounded px-3 py-2 text-left text-xs font-medium text-app-text hover:bg-white/5 hover:text-app-green transition-colors">{label}</button>;
}

function BudgetRing({ value }: { value: number }) {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-app-bg" />
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125.6" strokeDashoffset={125.6 * (1 - value / 100)} className="text-app-green" strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center"><span className="text-[11px] font-bold text-white leading-none">{value}%</span></div>
    </div>
  );
}

function MetricRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return <div className="flex justify-between"><span className="text-app-text-muted">{label}</span><span className={cn("font-medium", valueClassName)}>{value}</span></div>;
}

function NeedRow({ pos, posName, status, statusColor }: { pos: string; posName: string; status: string; statusColor: string }) {
  return <div className="flex items-center justify-between text-[10px]"><div className="flex items-center gap-1.5"><span className="font-bold w-8">{pos}</span><span className="text-app-text-muted">{posName}</span></div><span className={cn("font-medium", statusColor)}>{status}</span></div>;
}

function CalendarRow({ icon, text, date, dateColor, bgClass, textClass }: { icon: ReactNode; text: string; date: string; dateColor: string; bgClass?: string; textClass?: string }) {
  return <div className={cn("flex items-center justify-between text-[10px]", bgClass)}><div className="flex items-center gap-2">{icon}<span className={cn("text-app-text-muted", textClass)}>{text}</span></div><span className={dateColor}>{date}</span></div>;
}

function FilterBadge({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("px-3 py-1 bg-app-bg border text-app-text-muted hover:text-white rounded text-xs font-semibold transition-colors", active ? "border-app-green text-app-green" : "border-app-border")}>{children}</button>;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: TransferSortKey;
  activeKey: TransferSortKey;
  direction: SortDirection;
  onSort: (key: TransferSortKey) => void;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const active = activeKey === sortKey;

  return (
    <th className={cn(className, align === "center" && "text-center", align === "right" && "text-right")} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-app-green",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          active ? "text-app-green" : "text-app-text-muted",
        )}
      >
        <span>{label}</span>
        <span className={cn("text-[8px] leading-none", active ? "opacity-100" : "opacity-40")}>{active ? (direction === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function FilterDropdown({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  className = "min-w-[150px]",
}: {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Select
        fullWidth
        selectSize="sm"
        value={value}
        aria-label={ariaLabel}
        title={label}
        wrapperClassName="z-40"
        className="h-[32px] text-[11px]"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </div>
  );
}

function AdvancedFilterInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: string) => void }) {
  return (
    <input
      aria-label={label}
      title={label}
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="h-[32px] min-w-0 rounded-lg border border-app-border bg-app-bg px-2 text-[11px] font-medium text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-green/50"
      placeholder={label}
    />
  );
}

function StarRating({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn("w-2.5 h-2.5", star <= rating ? "fill-amber-500 text-amber-500" : "fill-app-bg text-app-border")} />)}</div>;
}

function NegotiationPanel({
  player,
  teams,
  userTeamId,
  offer,
  bidProjection,
  weeklySuffix,
  locale,
  onMakeOffer,
  onNegotiate,
  onWalkAway,
  onSelectPlayer,
  onSelectTeam,
}: {
  player: PlayerData | null;
  teams: GameStateData["teams"];
  userTeamId: string | null;
  offer: TransferOfferData | null;
  bidProjection: any;
  weeklySuffix: string;
  locale: string;
  onMakeOffer: (fee: number) => void;
  onNegotiate: (fee: number) => void;
  onWalkAway: () => void;
  onSelectPlayer: () => void;
  onSelectTeam: () => void;
}) {
  if (!player) {
    return <div className="w-full xl:w-[420px] flex-col gap-4 shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 hidden lg:flex"><Card className="flex flex-1 items-center justify-center text-app-text-muted">No transfer target selected</Card></div>;
  }

  const age = calcAge(player.date_of_birth);
  const ovr = getPlayerOvr(player);
  const interest = interestForPlayer(player, userTeamId);
  const wage = formatWeeklyAmount(formatVal(annualAmountToWeeklyCommitment(player.wage)), weeklySuffix);
  const requestedWage = offer ? formatWeeklyAmount(formatVal(annualAmountToWeeklyCommitment(offer.wage_offered)), weeklySuffix) : wage;
  const offerFeeBase = offer?.fee ?? Math.round(player.market_value * 0.9);
  const projectedBudget = bidProjection?.projection?.transfer_budget_after;
  const financeFit = projectedBudget !== undefined && projectedBudget < 0 ? 35 : 82;
  const competition = offer ? 90 : player.transfer_offers.length > 0 ? 70 : 38;
  const statusLabel = offer ? offer.status : player.team_id === userTeamId ? "Listed Player" : "Available";
  const footedness = player.footedness ? `${player.footedness}${player.weak_foot ? ` / WF ${player.weak_foot}` : ""}` : "Not tracked";
  const negotiationContext = offer ? `R${offer.negotiation_round} negotiation` : player.transfer_listed ? "Transfer listed" : player.loan_listed ? "Loan listed" : "Open market";
  const nextMeetingLabel = offer ? new Date(offer.date).toLocaleDateString(locale) : "Not booked";
  const [parameterLevels, setParameterLevels] = useState({
    fee: 60,
    currentWage: 75,
    offerWage: offer ? 70 : 45,
    lastManagerFee: offer?.last_manager_fee ? 55 : 10,
  });
  const selectedOfferFee = Math.round(offerFeeBase * (parameterLevels.fee / 100));
  const updateParameterLevel = (key: keyof typeof parameterLevels, nextValue: number) => {
    setParameterLevels((current) => ({
      ...current,
      [key]: Math.min(100, Math.max(0, nextValue)),
    }));
  };

  return (
    <div className="w-full xl:w-[420px] flex-col gap-4 shrink-0 h-full min-h-0 pr-1 hidden lg:flex">
      <Card className="flex flex-col flex-1 min-h-0 p-0 overflow-hidden">
        <div className="p-4 border-b border-app-border/50 bg-[#161c24]">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-4">NEGOTIATION PANEL</span>
            <div className="flex items-center gap-1 px-2 py-0.5 border border-app-green/30 bg-app-green/10 text-app-green rounded text-xs font-bold">
              <Star className="w-3 h-3 fill-app-green text-app-green" /> Top Target
            </div>
          </div>

          <div className="flex gap-4">
            <button type="button" onClick={onSelectPlayer} className="w-16 h-16 rounded-lg bg-center bg-cover bg-app-bg border border-app-border overflow-hidden relative shrink-0 hover:border-app-green/50 transition-colors" aria-label="Open player profile">
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900 to-[#1e293b]" />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-10 bg-white/20 rounded-full" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-6 bg-blue-500/50 rounded-t-[2rem]" />
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(130px,0.8fr)] gap-x-4 gap-y-2">
              <div className="min-w-0">
                <button type="button" onClick={onSelectPlayer} className="flex max-w-full items-center gap-2 text-left group/player min-w-0">
                  <span className="text-xl font-bold text-white leading-none shrink-0">{ovr}</span>
                  <span className="text-lg font-bold text-app-text leading-none truncate group-hover/player:text-app-green transition-colors">{player.match_name}</span>
                </button>
                <span className="block text-xs text-app-text-muted mt-1 opacity-80 truncate">{player.natural_position || player.position}</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <CountryFlag code={player.nationality} locale={locale} className="text-sm leading-none shrink-0" />
                    <span className="truncate text-[11px] text-app-text-muted">{countryName(player.nationality, locale)}</span>
                  </div>
                  <button type="button" onClick={onSelectTeam} disabled={!player.team_id} className="flex items-center gap-1.5 min-w-0 disabled:cursor-default group/team">
                    <div className="w-4 h-4 rounded-full bg-blue-800 border border-white/20 shrink-0" />
                    <span className="text-[11px] text-app-text-muted truncate group-hover/team:text-app-green transition-colors">{getTeamName(teams, player.team_id)}</span>
                  </button>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-app-text-muted">
                <PanelDetail label="Age" value={String(age)} />
                <PanelDetail label="Overall" value={String(ovr)} />
                <PanelDetail label="Preferred Foot" value={footedness} wide />
                <PanelDetail label="Contract" value={player.contract_end ?? "--"} wide />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-app-border/30 text-center">
            <PanelStat label="Market Value" value={formatVal(player.market_value)} />
            <PanelStat label="Current Wage" value={wage} />
            <PanelStat label="Offer Wage" value={requestedWage} bordered />
            <div className="flex flex-col pl-2 text-left min-w-0">
              <span className="text-[9px] text-app-text-muted uppercase truncate">Negotiation</span>
              <span className="text-xs font-bold mt-1 truncate">{negotiationContext}</span>
              <div className="mt-2 pt-2 border-t border-app-border/30">
                <span className="block text-[8px] text-app-text-muted uppercase tracking-tighter truncate">Visual Interest</span>
                <div className="flex items-center gap-1 mt-0.5 text-app-green">
                  <div className="w-3 h-3 rounded-full border-2 border-app-green border-r-transparent opacity-80 shrink-0" />
                  <span className="text-xs font-bold">{interest}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 text-left">
            <StatusCell label="CURRENT STATUS" value={statusLabel} tone={offer ? "text-purple-400" : "text-app-green"} icon={<div className={cn("w-1.5 h-1.5 rounded-full", offer ? "bg-purple-400" : "bg-app-green")} />} />
            <StatusCell label="INTEREST" value={interest >= 70 ? "Very High" : interest >= 45 ? "Medium" : "Low"} tone="text-app-green" icon={<CheckCircle2 className="w-3 h-3" />} />
            <StatusCell label="OFFER DATE" value={nextMeetingLabel} tone="text-white" icon={<Clock className="w-3 h-3 text-app-text-muted" />} />
            <StatusCell label="OFFER STATE" value={offer ? "Active offer" : "No offer"} tone="text-white" icon={<CalendarDays className="w-3 h-3 text-app-text-muted" />} />
          </div>
        </div>

        <div data-testid="negotiation-panel-scroll-body" className="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar xl:flex-row">
          <div className="min-w-0 flex-1 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-1">OFFER PARAMETERS</span>
            <ParameterRow label="Transfer Fee" val={formatVal(selectedOfferFee)} pct={parameterLevels.fee} onChange={(value) => updateParameterLevel("fee", value)} />
            <ParameterRow label="Current Wage" val={wage} pct={parameterLevels.currentWage} onChange={(value) => updateParameterLevel("currentWage", value)} />
            <ParameterRow label="Offer Wage" val={requestedWage} pct={parameterLevels.offerWage} onChange={(value) => updateParameterLevel("offerWage", value)} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-app-text-muted">Offer Round</span>
              <button type="button" onClick={() => onNegotiate(selectedOfferFee)} className="flex items-center justify-between px-2 py-1 bg-app-bg border border-app-border rounded text-[11px] w-[110px] hover:border-app-green/50 transition-colors">
                <span>{offer ? `R${offer.negotiation_round}` : "No offer"}</span>
                <ChevronRight className="w-3 h-3 text-app-text-muted" />
              </button>
            </div>
            <ParameterRow label="Last Manager Fee" val={offer?.last_manager_fee ? formatVal(offer.last_manager_fee) : "--"} pct={parameterLevels.lastManagerFee} onChange={(value) => updateParameterLevel("lastManagerFee", value)} />

            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mt-4 mb-2">DEAL BREAKDOWN</span>
            <div className="flex flex-col gap-2 flex-1">
              <BreakdownStat label="Budget Fit" val={`${financeFit}%`} valColor={financeFit >= 60 ? "text-app-green" : "text-red-500"} pct={financeFit} barColor={financeFit >= 60 ? "bg-app-green" : "bg-red-500"} />
              <BreakdownStat label="Overall" val={`${ovr}/99`} valColor="text-app-green" pct={Math.min(100, ovr)} barColor="bg-app-green" />
              <BreakdownStat label="Morale" val={`${player.morale}%`} valColor={player.morale >= 50 ? "text-app-green" : "text-amber-500"} pct={player.morale} barColor={player.morale >= 50 ? "bg-app-green" : "bg-amber-500"} />
              <BreakdownStat label="Offer Activity" val={offer ? "Active offer" : "Open market"} valColor={offer ? "text-red-500" : "text-app-green"} pct={competition} barColor={offer ? "bg-red-500" : "bg-app-green"} />
              <div className="mt-2 pt-2 pb-1 border-t border-app-border/30 flex justify-between items-center text-[11px]">
                <span className="text-white">Visual Interest</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-app-bg rounded overflow-hidden"><div className="h-full bg-app-green" style={{ width: `${interest}%` }} /></div>
                  <span className="font-bold text-app-green">{interest}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0 flex flex-col shrink-0 xl:w-[120px]">
            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-1 text-center border-b border-app-border/50 pb-2">SUBMIT BID</span>
            <button type="button" onClick={() => onMakeOffer(selectedOfferFee)} aria-label="Submit panel bid" className="w-full bg-app-green hover:bg-app-green/90 text-app-bg font-bold py-2 rounded text-[11px] mt-3 transition-colors shadow-[0_0_10px_rgba(45,212,191,0.2)]">Submit Bid</button>
            <button type="button" onClick={() => onNegotiate(selectedOfferFee)} className="w-full bg-app-card hover:bg-white/5 border border-app-border text-white font-medium py-2 rounded text-[11px] mt-2 transition-colors">Negotiate Terms</button>
            <button type="button" onClick={onWalkAway} className="w-full bg-[#1e1515] border border-red-900/50 hover:bg-red-900/30 text-red-400 font-medium py-2 rounded text-[11px] mt-2 transition-colors">Walk Away</button>

            <div className="mt-auto pt-4 border-t border-app-border/50 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-app-text-muted tracking-widest uppercase mb-1">FINANCIAL IMPACT <span className="text-[8px] tracking-normal opacity-70 normal-case block">(This Season)</span></span>
              <FinancialImpactRow label="Transfer Cost" value={formatVal(selectedOfferFee)} />
              <FinancialImpactRow label="Offer Wage (p/w)" value={requestedWage} />
              <FinancialImpactRow label="Wage Budget Usage" value={bidProjection?.projection ? `${bidProjection.projection.projected_wage_budget_usage_pct}%` : "Preview"} />
              <div className="flex justify-between text-[10px] pt-1 border-t border-app-border/30"><span className="text-app-text">Balance After Fee</span><span>{bidProjection?.projection ? formatVal(bidProjection.projection.finance_after) : "Preview"}</span></div>
              <div className="flex justify-between text-[10px] mt-1 text-app-red font-bold"><span className="text-app-text-muted text-current">Budget Impact</span><span>{projectedBudget !== undefined ? formatVal(projectedBudget) : "Preview"}</span></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PanelDetail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={cn("min-w-0", wide && "col-span-2")}><span className="block text-[8px] uppercase tracking-wide text-app-text-muted">{label}</span><span className="block text-[11px] font-semibold leading-tight text-white break-words">{value}</span></div>;
}

function PanelStat({ label, value, bordered }: { label: string; value: string; bordered?: boolean }) {
  return <div className={cn("flex flex-col", bordered && "border-r border-app-border/30")}><span className="text-[9px] text-app-text-muted uppercase">{label}</span><span className="text-xs font-bold mt-1">{value}</span></div>;
}

function StatusCell({ label, value, tone, icon }: { label: string; value: string; tone: string; icon?: ReactNode }) {
  return <div className="flex flex-col gap-1 min-w-0"><span className="text-[8px] text-app-text-muted uppercase truncate">{label}</span><span className={cn("text-[10px] font-bold flex items-center gap-1 min-w-0", tone)}>{icon}<span className="truncate">{value}</span></span></div>;
}

function FinancialImpactRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-[10px]"><span className="text-app-text-muted">{label}</span><span>{value}</span></div>;
}

function ParameterRow({ label, val, pct, onChange }: { label: string; val: string; pct: number; onChange: (value: number) => void }) {
  const safePct = Math.min(100, Math.max(0, pct));

  return (
    <div className="flex flex-col gap-1 text-[11px] min-w-0">
      <div className="flex justify-between gap-2 text-app-text-muted">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-[10px] text-app-text-muted/70">{safePct}%</span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(94px,112px)] items-center gap-2">
        <div className="relative h-3 min-w-0 rounded border border-app-border bg-app-bg overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-app-green/25" style={{ width: `${safePct}%` }} />
          <div className="absolute top-1/2 h-full w-2 -translate-y-1/2 rounded-sm bg-app-green/70 shadow-[0_0_8px_rgba(45,212,191,0.35)]" style={{ left: `calc(${safePct}% - 4px)` }} />
          <input
            type="range"
            min={0}
            max={100}
            value={safePct}
            aria-label={`${label} parameter`}
            onChange={(event) => onChange(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-1 rounded border border-app-border bg-app-bg px-1.5 h-5 text-white font-medium hover:border-app-green/50">
          <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(safePct - 5)} className="shrink-0 rounded p-0.5 text-app-text-muted hover:bg-white/10 hover:text-white transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-[10px]">{val}</span>
          <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(safePct + 5)} className="shrink-0 rounded p-0.5 text-app-text-muted hover:bg-white/10 hover:text-white transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BreakdownStat({ label, val, valColor, pct, barColor }: { label: string; val: string; valColor: string; pct: number; barColor: string }) {
  return <div className="flex justify-between items-center text-[10px]"><div className="w-[110px] text-app-text-muted truncate shrink-0">{label}</div><div className="flex-1 h-1 bg-app-bg mx-2 rounded overflow-hidden"><div className={cn("h-full", barColor)} style={{ width: `${pct}%` }} /></div><div className={cn("w-[70px] text-right font-medium truncate shrink-0", valColor)}>{val}</div></div>;
}

function BottomTransferCard({ title, players, teams, empty, onSelectPlayer, onSelectTeam }: { title: string; players: PlayerData[]; teams: GameStateData["teams"]; empty: string; onSelectPlayer: (id: string) => void; onSelectTeam: (id: string) => void }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">{title}</h3><Card className="flex flex-col p-3 text-[11px] h-full flex-1 min-h-[140px]"><table className="w-full text-left whitespace-nowrap mb-2"><thead><tr className="text-app-text-muted uppercase text-[9px] font-bold border-b border-app-border/30"><th className="py-2.5 px-1">PLAYER</th><th className="py-2.5">CLUB</th><th className="py-2.5 px-2">VALUE</th><th className="py-2.5 px-1 text-right">STATUS</th></tr></thead><tbody className="divide-y divide-app-border/20 text-app-text">{players.slice(0, 4).map((player) => <TransferRow key={player.id} player={player} club={getTeamName(teams, player.team_id)} fee={formatVal(player.market_value)} status={player.transfer_offers[0]?.status ?? (player.transfer_listed ? "Listed" : "Watched")} onSelectPlayer={onSelectPlayer} onSelectTeam={onSelectTeam} />)}</tbody></table>{players.length === 0 ? <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">{empty}</div> : null}</Card></div>;
}

function TransferRow({ player, club, fee, status, onSelectPlayer, onSelectTeam }: { player: PlayerData; club: string; fee: string; status: string; onSelectPlayer: (id: string) => void; onSelectTeam: (id: string) => void }) {
  return <tr className="hover:bg-white/5 transition-colors group"><td className="py-2.5 px-1 truncate max-w-[80px]"><button type="button" onClick={() => onSelectPlayer(player.id)} className="font-bold group-hover:text-app-green transition-colors truncate text-left">{player.match_name}</button></td><td className="py-2.5 max-w-[70px]"><button type="button" disabled={!player.team_id} onClick={() => player.team_id && onSelectTeam(player.team_id)} className="flex items-center gap-1.5 truncate disabled:cursor-default group/team"><div className="w-3 h-3 rounded-full shrink-0 border border-white/20 bg-app-card" /><span className="text-app-text-muted truncate group-hover/team:text-app-green transition-colors">{club}</span></button></td><td className="py-2.5 px-2 font-medium">{fee}</td><td className="py-2.5 px-1 text-right"><span className="px-1 py-0.5 rounded text-[8px] font-bold border inline-flex text-app-green bg-app-green/10 border-app-green/20">{status}</span></td></tr>;
}

function LoanWatchCard({ players, teams, onSelectPlayer, onSelectTeam }: { players: PlayerData[]; teams: GameStateData["teams"]; onSelectPlayer: (id: string) => void; onSelectTeam: (id: string) => void }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">LOAN WATCH</h3><Card className="flex flex-col p-3 text-[11px] h-full flex-1"><table className="w-full text-left whitespace-nowrap mb-2"><thead><tr className="text-app-text-muted uppercase text-[9px] font-bold border-b border-app-border/30"><th className="py-1 px-1">PLAYER</th><th className="py-1">CLUB</th><th className="py-1 px-1 text-center">OVR</th><th className="py-1 px-1">STATUS</th></tr></thead><tbody className="divide-y divide-app-border/10 text-app-text">{players.slice(0, 4).map((player) => <tr key={player.id} className="hover:bg-white/5 transition-colors"><td className="py-1 px-1"><button type="button" onClick={() => onSelectPlayer(player.id)} className="text-[10px] font-bold truncate hover:text-app-green transition-colors">{player.match_name}</button></td><td className="py-1 text-app-text-muted text-[10px] truncate"><button type="button" disabled={!player.team_id} onClick={() => player.team_id && onSelectTeam(player.team_id)} className="hover:text-app-green transition-colors disabled:hover:text-app-text-muted">{getTeamName(teams, player.team_id)}</button></td><td className="py-1 text-center font-bold text-[10px] text-app-green">{getPlayerOvr(player)}</td><td className="py-1 text-[9px] text-app-text-muted text-right">{player.loan_listed ? "Listed" : "Available"}</td></tr>)}</tbody></table>{players.length === 0 ? <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">No loan players</div> : null}</Card></div>;
}

function HottestBar({ pos, val, pct }: { pos: string; val: string; pct: number }) {
  return <div className="flex items-center gap-2 text-[9px]"><span className="text-app-text-muted w-24 truncate shrink-0">{pos}</span><div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden"><div className="h-full bg-app-green" style={{ width: `${pct}%` }} /></div><span className="text-white font-medium shrink-0">{val}</span></div>;
}

function ShortlistCardGroup({ players, onSelectPlayer }: { players: PlayerData[]; onSelectPlayer: (id: string) => void }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">SHORTLISTED PLAYERS</h3><Card className="flex flex-col flex-1 p-3"><div className="flex gap-2 h-full justify-between pb-2 overflow-x-auto custom-scrollbar">{players.length > 0 ? players.map((player) => <ShortlistCard key={player.id} player={player} onSelectPlayer={onSelectPlayer} />) : <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">No shortlisted players</div>}</div></Card></div>;
}

function ShortlistCard({ player, onSelectPlayer }: { player: PlayerData; onSelectPlayer: (id: string) => void }) {
  return <button type="button" aria-label={`Open shortlisted player ${player.full_name}`} onClick={() => onSelectPlayer(player.id)} className="flex flex-col items-center justify-between gap-1 p-2 rounded-lg border border-app-border bg-app-bg/50 hover:border-app-green/50 cursor-pointer transition-colors group w-[100px] shrink-0 h-full"><div className="w-8 h-8 rounded-full overflow-hidden border border-app-border bg-app-bg relative flex shrink-0 justify-center items-center mt-1"><User className="w-4 h-4 text-app-text-muted/50" /></div><div className="flex flex-col items-center w-full"><span className="text-[10px] font-bold truncate w-full text-center group-hover:text-app-green transition-colors leading-tight">{player.match_name}</span><div className="flex items-center gap-1 mt-0.5 text-center justify-center"><span className="text-[8px] text-app-text-muted">{calcAge(player.date_of_birth)}</span><span className="text-[8px] text-app-text-muted px-1 rounded bg-white/5">{player.natural_position || player.position}</span></div></div><StarRating rating={ratingForPlayer(player)} /><div className="px-1.5 py-0.5 rounded border border-app-border bg-app-bg text-[9px] font-bold text-white">{formatVal(player.market_value)}</div></button>;
}
