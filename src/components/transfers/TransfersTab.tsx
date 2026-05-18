import { useState, type ReactNode } from "react";
import {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
  TransferOfferData,
} from "../../store/gameStore";
import { Badge, Card, CountryFlag } from "../ui";
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
  counterOffer,
  respondToOffer,
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
  deriveTransferCollections,
  filterTransferPlayers,
  getCurrentTransferList,
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
  const [counterTarget, setCounterTarget] = useState<CounterTarget | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterLoading, setCounterLoading] = useState(false);
  const [counterError, setCounterError] = useState<string | null>(null);
  const [counterResult, setCounterResult] = useState<TransferNegotiationResponseData["decision"] | "error" | null>(null);
  const [counterFeedback, setCounterFeedback] = useState<NegotiationFeedbackPanelData | null>(null);
  const [scoutingPlayerId, setScoutingPlayerId] = useState<string | null>(null);
  const [scoutError, setScoutError] = useState<string | null>(null);

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
  const { myTransferList, myLoanList, marketPlayers, loanPlayers, playersWithOffers } = transferCollections;
  const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
  const currentList = getCurrentTransferList(view, transferCollections);
  const filteredList = filterTransferPlayers(currentList, search, posFilter);
  const weeklyWageBudget = myTeam ? annualAmountToWeeklyCommitment(myTeam.wage_budget) : 0;
  const panelPlayer = bidTarget ?? counterTarget?.player ?? playersWithOffers[0] ?? filteredList[0] ?? marketPlayers[0] ?? gameState.players[0] ?? null;
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
    { m: "Pool", v: filteredList.length },
  ];
  const visualTabs: VisualTab[] = [
    { id: "Overview", label: "Overview", view: "my_list" },
    { id: "Transfer Targets", label: "Transfer Targets", view: "market", ariaLabel: t("transfers.transferMarket") },
    { id: "Negotiations", label: "Negotiations", view: "offers", ariaLabel: t("transfers.offers") },
    { id: "Incoming", label: "Incoming", view: "offers" },
    { id: "Outgoing", label: "Outgoing", view: "my_list" },
    { id: "Loans", label: "Loans", view: "loans" },
    { id: "Shortlists", label: "Shortlists", view: "my_list" },
  ];

  const switchTab = (tab: VisualTab) => {
    setVisualTab(tab.id);
    setView(tab.view);
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
      contextItems.push({ label: t("transfers.bid"), icon: <Gavel className="w-4 h-4" />, onClick: () => openBidNegotiation(player) });
    }

    const status = statusForPlayer(player, view);
    const interest = interestForPlayer(player, userTeamId);
    const primaryOffer = player.transfer_offers[0] ?? null;
    const row = (
      <tr className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onSelectPlayer(player.id)}>
        <td className="py-2.5 px-3 text-app-text-muted text-[10px] w-6">{index + 1}</td>
        <td className="py-2.5 pl-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full overflow-hidden border border-app-border bg-app-bg shrink-0 flex items-center justify-center">
              <User className="w-2.5 h-2.5 text-app-text-muted/50" />
            </div>
            <span className="font-bold group-hover:text-app-green transition-colors">{player.full_name}</span>
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
            <button type="button" onClick={(event) => { event.stopPropagation(); openBidNegotiation(player); }} className="px-2 py-1 rounded text-[9px] font-bold border inline-flex items-center gap-1 text-app-bg bg-app-green border-app-green"><Gavel className="w-2.5 h-2.5" />{t("transfers.bid")}</button>
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
          <div className="flex items-center bg-app-card border border-app-border rounded-lg overflow-hidden transition-colors">
            <button type="button" onClick={() => { setVisualTab("Shortlists"); setView("my_list"); }} className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-white/5 border-r border-app-border/50">
              <Star className="w-4 h-4 text-app-text-muted" />
              Shortlist
            </button>
            <button type="button" className="px-2 py-2 hover:bg-white/5" aria-label="Shortlist menu"><ChevronDown className="w-4 h-4 text-app-text-muted" /></button>
          </div>
          <div className="flex items-center bg-app-green hover:bg-app-green/90 text-app-bg rounded-lg overflow-hidden transition-colors">
            <button type="button" onClick={() => { setVisualTab("Negotiations"); setView("offers"); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold border-r border-black/10">
              <CheckCircle2 className="w-4 h-4" />
              Finalize Deal
            </button>
            <button type="button" className="px-2 py-2 hover:bg-black/10" aria-label="Finalize menu"><ChevronDown className="w-4 h-4" /></button>
          </div>
          <button type="button" className="p-2 bg-app-card border border-app-border rounded-lg hover:bg-white/5 transition-colors" aria-label="Transfer actions"><MoreHorizontal className="w-4 h-4 text-app-text-muted" /></button>
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
          <Card className="flex flex-col p-4 w-full h-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold text-app-green tracking-widest uppercase">TRANSFER TARGETS</h2>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider">{t("common.nResults", { count: filteredList.length })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full">
              <button type="button" onClick={() => setPosFilter(null)} className={cn("px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1", !posFilter ? "bg-app-green/20 border-app-green/50 text-app-green" : "bg-app-bg border-app-border text-app-text-muted hover:text-white")}>
                <Target className="w-3.5 h-3.5" /> All Targets
              </button>
              {positions.map((position) => <FilterBadge key={position} active={posFilter === position} onClick={() => setPosFilter(posFilter === position ? null : position)}>{translatePositionAbbreviation(t, position)}</FilterBadge>)}
              <FilterDropdown value={posFilter ?? "Any Position"} />
              <FilterDropdown value={view === "market" ? "Transfer Market" : view === "loans" ? "Loan Market" : view === "offers" ? "Offers" : "Shortlists"} />
              <div className="relative ml-auto flex-1 max-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                <input type="text" placeholder="Search targets..." value={search} onChange={(event) => setSearch(event.target.value)} className="bg-app-bg border border-app-border rounded-lg pl-8 pr-3 py-1.5 text-[11px] focus:outline-none focus:border-app-green/50 placeholder:text-app-text-muted w-full text-app-text" />
              </div>
              <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs text-app-text-muted hover:text-white transition-colors">
                <Filter className="w-3.5 h-3.5" /> Filters
              </button>
            </div>
          </Card>

          <Card className="flex flex-col flex-1 min-h-0 bg-app-bg border-app-border">
            <div className="overflow-x-auto min-h-0 flex-1 custom-scrollbar">
              <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1000px]">
                <thead className="sticky top-0 bg-app-card z-10 shadow-sm border-b border-app-border/50">
                  <tr className="text-app-text-muted uppercase tracking-wider text-[9px] font-bold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 pl-1">PLAYER</th>
                    <th className="py-2.5 px-2">AGE</th>
                    <th className="py-2.5">NAT</th>
                    <th className="py-2.5">CLUB</th>
                    <th className="py-2.5">POSITION</th>
                    <th className="py-2.5 text-right px-2">VALUE</th>
                    <th className="py-2.5 text-right px-2">WAGE</th>
                    <th className="py-2.5 text-center">INTEREST</th>
                    <th className="py-2.5 text-center">SCOUT RATING</th>
                    <th className="py-2.5 text-center pr-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-app-text divide-y divide-app-border/30">
                  {filteredList.length > 0 ? filteredList.map(renderPlayerContextRow) : (
                    <tr><td colSpan={11} className="py-12 text-center text-app-text-muted">{view === "market" ? t("transfers.noTransferMarket") : view === "loans" ? t("transfers.noLoanMarket") : view === "offers" ? t("transfers.noOffers") : t("transfers.noPlayersListed")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-2.5 border-t border-app-border/50 flex items-center justify-between text-[11px] text-app-text-muted">
              <span>{filteredList.length} targets</span>
              <div className="flex items-center gap-1">
                <button type="button" className="px-2 py-1 hover:text-white transition-colors">&lt;</button>
                <button type="button" className="w-6 h-6 rounded bg-app-green text-app-bg font-bold flex items-center justify-center">1</button>
                <button type="button" className="w-6 h-6 rounded hover:bg-white/5 transition-colors flex items-center justify-center">2</button>
                <button type="button" className="w-6 h-6 rounded hover:bg-white/5 transition-colors flex items-center justify-center">3</button>
                <button type="button" className="px-2 py-1 hover:text-white transition-colors">&gt;</button>
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
          onMakeOffer={() => panelPlayer && panelPlayer.team_id !== userTeamId ? openBidNegotiation(panelPlayer) : setView("market")}
          onNegotiate={() => panelPlayer && panelOffer ? openCounterNegotiation(panelPlayer, panelOffer) : setView("offers")}
          onWalkAway={() => setVisualTab("Overview")}
          onSelectPlayer={() => panelPlayer && onSelectPlayer(panelPlayer.id)}
          onSelectTeam={() => panelPlayer?.team_id && onSelectTeam(panelPlayer.team_id)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 pb-4">
        <BottomTransferCard title="INCOMING TRANSFERS" players={playersWithOffers} teams={gameState.teams} empty="No incoming offers" />
        <BottomTransferCard title="OUTGOING TRANSFERS" players={myTransferList} teams={gameState.teams} empty="No outgoing transfers" />
        <LoanWatchCard players={[...myLoanList, ...loanPlayers].slice(0, 4)} teams={gameState.teams} />
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">MARKET INSIGHTS</h3>
          <Card className="flex flex-col p-3 text-[11px] h-full flex-1 justify-between">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-1"><span className="text-[9px] font-bold text-app-text-muted uppercase">MARKET ACTIVITY</span></div>
              <div className="h-[70px] w-full -ml-3 mt-1">
                <ResponsiveContainer width="100%" height="100%">
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
        <ShortlistCardGroup players={myTransferList.slice(0, 5)} />
      </div>

      {bidTarget && (
        <TransferBidModal
          bidTarget={bidTarget}
          teams={gameState.teams}
          bidAmount={bidAmount}
          onBidAmountChange={setBidAmount}
          myTeam={myTeam ?? null}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">{title}</h3>{children}</div>;
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

function FilterDropdown({ value }: { value: string }) {
  return <div className="px-3 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs flex items-center gap-1.5 hover:border-app-green/50 cursor-pointer"><span>{value}</span><ChevronDown className="w-3 h-3 text-app-text-muted" /></div>;
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
  onMakeOffer: () => void;
  onNegotiate: () => void;
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
  const offerFee = offer?.fee ?? Math.round(player.market_value * 0.9);
  const projectedBudget = bidProjection?.projection?.transfer_budget_after;
  const financeFit = projectedBudget !== undefined && projectedBudget < 0 ? 35 : 82;
  const competition = offer ? 90 : player.transfer_offers.length > 0 ? 70 : 38;
  const statusLabel = offer ? offer.status : player.team_id === userTeamId ? "Listed Player" : "Available";
  const footedness = player.footedness ? `${player.footedness}${player.weak_foot ? ` / WF ${player.weak_foot}` : ""}` : "Not tracked";
  const negotiationContext = offer ? `R${offer.negotiation_round} negotiation` : player.transfer_listed ? "Transfer listed" : player.loan_listed ? "Loan listed" : "Open market";
  const nextMeetingLabel = offer ? new Date(offer.date).toLocaleDateString(locale) : "Not booked";

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

            <div className="flex flex-col flex-1 min-w-0">
              <button type="button" onClick={onSelectPlayer} className="flex items-center gap-2 text-left group/player min-w-0">
                <span className="text-xl font-bold text-white leading-none">{ovr}</span>
                <span className="text-lg font-bold text-app-text leading-none truncate group-hover/player:text-app-green transition-colors">{player.match_name}</span>
              </button>
              <span className="text-xs text-app-text-muted mt-1 opacity-80">{player.natural_position || player.position}</span>
              <div className="flex gap-3 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <CountryFlag code={player.nationality} locale={locale} className="text-sm leading-none" />
                  <span className="text-[11px] text-app-text-muted">{countryName(player.nationality, locale)}</span>
                </div>
                <button type="button" onClick={onSelectTeam} disabled={!player.team_id} className="flex items-center gap-1.5 min-w-0 disabled:cursor-default group/team">
                  <div className="w-4 h-4 rounded-full bg-blue-800 border border-white/20 shrink-0" />
                  <span className="text-[11px] text-app-text-muted truncate group-hover/team:text-app-green transition-colors">{getTeamName(teams, player.team_id)}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 items-end text-xs w-28 shrink-0 text-app-text-muted">
              <PanelDetail label="Age" value={String(age)} />
              <PanelDetail label="Overall" value={String(ovr)} />
              <PanelDetail label="Preferred Foot" value={footedness} />
              <PanelDetail label="Contract Expires" value={player.contract_end ?? "--"} wrap />
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

        <div className="p-4 flex gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-1">OFFER PARAMETERS</span>
            <ParameterRow label="Transfer Fee" val={formatVal(offerFee)} pct={60} />
            <ParameterRow label="Current Wage" val={wage} pct={75} />
            <ParameterRow label="Offer Wage" val={requestedWage} pct={offer ? 70 : 45} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-app-text-muted">Offer Round</span>
              <button type="button" onClick={onNegotiate} className="flex items-center justify-between px-2 py-1 bg-app-bg border border-app-border rounded text-[11px] w-[110px] hover:border-app-green/50 transition-colors">
                <span>{offer ? `R${offer.negotiation_round}` : "No offer"}</span>
                <ChevronRight className="w-3 h-3 text-app-text-muted" />
              </button>
            </div>
            <ParameterRow label="Last Manager Fee" val={offer?.last_manager_fee ? formatVal(offer.last_manager_fee) : "--"} pct={offer?.last_manager_fee ? 55 : 10} />

            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mt-4 mb-2">DEAL BREAKDOWN</span>
            <div className="flex flex-col gap-2 flex-1">
              <BreakdownStat label="Budget Fit" val={`${financeFit}%`} valColor={financeFit >= 60 ? "text-app-green" : "text-red-500"} pct={financeFit} barColor={financeFit >= 60 ? "bg-app-green" : "bg-red-500"} />
              <BreakdownStat label="Overall" val={`${ovr}/99`} valColor="text-app-green" pct={Math.min(100, ovr)} barColor="bg-app-green" />
              <BreakdownStat label="Morale" val={`${player.morale}%`} valColor={player.morale >= 50 ? "text-app-green" : "text-amber-500"} pct={player.morale} barColor={player.morale >= 50 ? "bg-app-green" : "bg-amber-500"} />
              <BreakdownStat label="Offer Activity" val={offer ? "Active offer" : "Open market"} valColor={offer ? "text-red-500" : "text-app-green"} pct={competition} barColor={offer ? "bg-red-500" : "bg-app-green"} />
              <div className="mt-2 pt-2 border-t border-app-border/30 flex justify-between items-center text-[11px]">
                <span className="text-white">Visual Interest</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-app-bg rounded overflow-hidden"><div className="h-full bg-app-green" style={{ width: `${interest}%` }} /></div>
                  <span className="font-bold text-app-green">{interest}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[120px] flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase mb-1 text-center border-b border-app-border/50 pb-2">SUBMIT BID</span>
            <button type="button" onClick={onMakeOffer} aria-label="Submit panel bid" className="w-full bg-app-green hover:bg-app-green/90 text-app-bg font-bold py-2 rounded text-[11px] mt-3 transition-colors shadow-[0_0_10px_rgba(45,212,191,0.2)]">Submit Bid</button>
            <button type="button" onClick={onNegotiate} className="w-full bg-app-card hover:bg-white/5 border border-app-border text-white font-medium py-2 rounded text-[11px] mt-2 transition-colors">Negotiate Terms</button>
            <button type="button" onClick={onWalkAway} className="w-full bg-[#1e1515] border border-red-900/50 hover:bg-red-900/30 text-red-400 font-medium py-2 rounded text-[11px] mt-2 transition-colors">Walk Away</button>

            <div className="mt-auto pt-4 border-t border-app-border/50 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-app-text-muted tracking-widest uppercase mb-1">FINANCIAL IMPACT <span className="text-[8px] tracking-normal opacity-70 normal-case block">(This Season)</span></span>
              <FinancialImpactRow label="Transfer Cost" value={formatVal(offerFee)} />
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

function PanelDetail({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return <div className={cn("flex justify-between w-full gap-2", wrap && "items-start")}><span>{label}</span><span className={cn("text-white text-right", wrap ? "leading-tight max-w-[70px]" : "whitespace-nowrap")}>{value}</span></div>;
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

function ParameterRow({ label, val, pct }: { label: string; val: string; pct: number }) {
  return <div className="flex flex-col gap-1 text-[11px]"><div className="flex justify-between text-app-text-muted"><span>{label}</span></div><div className="flex items-center gap-2"><div className="flex-1 h-3 bg-app-bg border border-app-border rounded cursor-pointer relative"><div className="h-full bg-app-green/50 w-2 absolute" style={{ left: `${Math.min(100, Math.max(0, pct))}%` }} /></div><div className="w-[110px] flex items-center justify-between px-2 bg-app-bg border border-app-border rounded cursor-pointer h-5 text-white font-medium hover:border-app-green/50"><Minus className="w-3 h-3 text-app-text-muted" /> {val} <Plus className="w-3 h-3 text-app-text-muted" /></div></div></div>;
}

function BreakdownStat({ label, val, valColor, pct, barColor }: { label: string; val: string; valColor: string; pct: number; barColor: string }) {
  return <div className="flex justify-between items-center text-[10px]"><div className="w-[110px] text-app-text-muted truncate shrink-0">{label}</div><div className="flex-1 h-1 bg-app-bg mx-2 rounded overflow-hidden"><div className={cn("h-full", barColor)} style={{ width: `${pct}%` }} /></div><div className={cn("w-[70px] text-right font-medium truncate shrink-0", valColor)}>{val}</div></div>;
}

function BottomTransferCard({ title, players, teams, empty }: { title: string; players: PlayerData[]; teams: GameStateData["teams"]; empty: string }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">{title}</h3><Card className="flex flex-col p-3 text-[11px] h-full flex-1 min-h-[140px]"><table className="w-full text-left whitespace-nowrap mb-2"><thead><tr className="text-app-text-muted uppercase text-[9px] font-bold border-b border-app-border/30"><th className="py-2.5 px-1">PLAYER</th><th className="py-2.5">CLUB</th><th className="py-2.5 px-2">VALUE</th><th className="py-2.5 px-1 text-right">STATUS</th></tr></thead><tbody className="divide-y divide-app-border/20 text-app-text">{players.slice(0, 4).map((player) => <TransferRow key={player.id} player={player.match_name} club={getTeamName(teams, player.team_id)} fee={formatVal(player.market_value)} status={player.transfer_offers[0]?.status ?? (player.transfer_listed ? "Listed" : "Watched")} />)}</tbody></table>{players.length === 0 ? <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">{empty}</div> : null}</Card></div>;
}

function TransferRow({ player, club, fee, status }: { player: string; club: string; fee: string; status: string }) {
  return <tr className="hover:bg-white/5 transition-colors group"><td className="py-2.5 px-1 truncate max-w-[80px]"><span className="font-bold group-hover:text-app-green transition-colors truncate">{player}</span></td><td className="py-2.5 max-w-[70px]"><div className="flex items-center gap-1.5 truncate"><div className="w-3 h-3 rounded-full shrink-0 border border-white/20 bg-app-card" /><span className="text-app-text-muted truncate">{club}</span></div></td><td className="py-2.5 px-2 font-medium">{fee}</td><td className="py-2.5 px-1 text-right"><span className="px-1 py-0.5 rounded text-[8px] font-bold border inline-flex text-app-green bg-app-green/10 border-app-green/20">{status}</span></td></tr>;
}

function LoanWatchCard({ players, teams }: { players: PlayerData[]; teams: GameStateData["teams"] }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">LOAN WATCH</h3><Card className="flex flex-col p-3 text-[11px] h-full flex-1"><table className="w-full text-left whitespace-nowrap mb-2"><thead><tr className="text-app-text-muted uppercase text-[9px] font-bold border-b border-app-border/30"><th className="py-1 px-1">PLAYER</th><th className="py-1">CLUB</th><th className="py-1 px-1 text-center">OVR</th><th className="py-1 px-1">STATUS</th></tr></thead><tbody className="divide-y divide-app-border/10 text-app-text">{players.slice(0, 4).map((player) => <tr key={player.id} className="hover:bg-white/5 transition-colors"><td className="py-1 px-1"><span className="text-[10px] font-bold truncate">{player.match_name}</span></td><td className="py-1 text-app-text-muted text-[10px] truncate">{getTeamName(teams, player.team_id)}</td><td className="py-1 text-center font-bold text-[10px] text-app-green">{getPlayerOvr(player)}</td><td className="py-1 text-[9px] text-app-text-muted text-right">{player.loan_listed ? "Listed" : "Available"}</td></tr>)}</tbody></table>{players.length === 0 ? <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">No loan players</div> : null}</Card></div>;
}

function HottestBar({ pos, val, pct }: { pos: string; val: string; pct: number }) {
  return <div className="flex items-center gap-2 text-[9px]"><span className="text-app-text-muted w-24 truncate shrink-0">{pos}</span><div className="flex-1 h-1.5 bg-app-bg rounded-full overflow-hidden"><div className="h-full bg-app-green" style={{ width: `${pct}%` }} /></div><span className="text-white font-medium shrink-0">{val}</span></div>;
}

function ShortlistCardGroup({ players }: { players: PlayerData[] }) {
  return <div className="flex flex-col gap-2"><h3 className="text-[10px] font-bold text-app-text-muted tracking-widest uppercase">SHORTLISTED PLAYERS</h3><Card className="flex flex-col flex-1 p-3"><div className="flex gap-2 h-full justify-between pb-2 overflow-x-auto custom-scrollbar">{players.length > 0 ? players.map((player) => <ShortlistCard key={player.id} player={player} />) : <div className="flex flex-1 items-center justify-center text-app-text-muted text-[10px]">No shortlisted players</div>}</div></Card></div>;
}

function ShortlistCard({ player }: { player: PlayerData }) {
  return <div className="flex flex-col items-center justify-between gap-1 p-2 rounded-lg border border-app-border bg-app-bg/50 hover:border-app-green/50 cursor-pointer transition-colors group w-[100px] shrink-0 h-full"><div className="w-8 h-8 rounded-full overflow-hidden border border-app-border bg-app-bg relative flex shrink-0 justify-center items-center mt-1"><User className="w-4 h-4 text-app-text-muted/50" /></div><div className="flex flex-col items-center w-full"><span className="text-[10px] font-bold truncate w-full text-center group-hover:text-app-green transition-colors leading-tight">{player.match_name}</span><div className="flex items-center gap-1 mt-0.5 text-center justify-center"><span className="text-[8px] text-app-text-muted">{calcAge(player.date_of_birth)}</span><span className="text-[8px] text-app-text-muted px-1 rounded bg-white/5">{player.natural_position || player.position}</span></div></div><StarRating rating={ratingForPlayer(player)} /><div className="px-1.5 py-0.5 rounded border border-app-border bg-app-bg text-[9px] font-bold text-white">{formatVal(player.market_value)}</div></div>;
}
