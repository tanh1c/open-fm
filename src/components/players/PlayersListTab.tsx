import { useEffect, useMemo, useState, type ReactNode, type SetStateAction } from "react";
import { GameStateData, PlayerData, PlayerSelectionOptions } from "../../store/gameStore";
import { getErrorMessage, resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import { Badge, Select, CountryFlag } from "../ui";
import ContextMenu from "../ContextMenu";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Maximize2,
  Search,
  ShieldCheck,
  Star,
  Target,
  User,
  Users,
  X,
} from "lucide-react";
import {
  getTeamName,
  calcAge,
  formatVal,
  getPlayerOvr,
  positionBadgeVariant,
} from "../../lib/helpers";
import { useTranslation } from "react-i18next";
import {
  normalisePosition,
  translatePositionAbbreviation,
} from "../squad/SquadTab.helpers";
import { buildAlreadyScoutingIds } from "../scouting/ScoutingTab.model";
import { calculateAvailableScouts } from "../scouting/ScoutingTab.helpers";
import { sendScout } from "../../services/scoutingService";
import {
  toggleLoanList,
  toggleTransferList,
} from "../../services/transfersService";
import {
  buildDividerMenuItem,
  buildMakeTransferBidMenuItem,
  buildScoutPlayerMenuItem,
  buildToggleLoanListMenuItem,
  buildToggleTransferListMenuItem,
  buildViewProfileMenuItem,
  buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import TransferBidModal from "../transfers/TransferBidModal";
import { useTransferBidFlow } from "../transfers/useTransferBidFlow";
import TeamLogo from "../common/TeamLogo";

interface PlayersListTabProps {
  gameState: GameStateData;
  onGameUpdate?: (game: GameStateData) => void;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onSelectTeam: (id: string) => void;
}

type SortKey = "name" | "position" | "age" | "ovr" | "value" | "team";

type SortDirection = "asc" | "desc";

const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const PAGE_SIZE = 30;

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

function HeaderChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
      <span className="text-app-green">{icon}</span>
      {label}: <span className="font-bold text-app-text">{value}</span>
    </div>
  );
}

export default function PlayersListTab({
  gameState,
  onGameUpdate,
  onSelectPlayer,
  onSelectTeam,
}: PlayersListTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language ?? "en";
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ovr");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [sendingPlayerId, setSendingPlayerId] = useState<string | null>(null);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const managerTeamId = gameState.manager.team_id ?? "";
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

  const scouts = gameState.staff.filter(
    (staffMember) => staffMember.role === "Scout" && staffMember.team_id === managerTeamId,
  );
  const scoutingAssignments = gameState.scouting_assignments || [];
  const allScoutingAssignments = [
    ...scoutingAssignments,
    ...(gameState.youth_scouting_assignments || []),
  ];
  const availableScouts = calculateAvailableScouts(scouts, allScoutingAssignments);
  const alreadyScoutingIds = buildAlreadyScoutingIds(scoutingAssignments);

  const handleScoutPlayer = async (playerId: string): Promise<void> => {
    if (availableScouts.length === 0) {
      setScoutError(null);
      return;
    }

    const scout = availableScouts[0];
    setScoutError(null);
    setSendingPlayerId(playerId);

    try {
      const updated = await sendScout(scout.id, playerId);
      setScoutError(null);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to send scout:", error);
      setScoutError(resolveTranslatedErrorMessage(getErrorMessage(error), t));
    } finally {
      setSendingPlayerId(null);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const filtered = useMemo(() => {
    const result = gameState.players.filter((player) => {
      if (search.length >= 2) {
        const q = search.toLowerCase();
        if (
          !player.full_name.toLowerCase().includes(q) &&
          !player.match_name.toLowerCase().includes(q) &&
          !player.nationality.toLowerCase().includes(q)
        ) return false;
      }
      if (posFilter && normalisePosition(player.natural_position || player.position) !== posFilter) return false;
      if (teamFilter && player.team_id !== teamFilter) return false;
      return true;
    });

    const posOrder: Record<string, number> = {
      Goalkeeper: 1,
      Defender: 2,
      Midfielder: 3,
      Forward: 4,
    };

    return result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.full_name.localeCompare(b.full_name, locale);
          break;
        case "position":
          cmp = (posOrder[normalisePosition(a.natural_position || a.position)] || 99) - (posOrder[normalisePosition(b.natural_position || b.position)] || 99);
          break;
        case "age":
          cmp = calcAge(a.date_of_birth) - calcAge(b.date_of_birth);
          break;
        case "ovr":
          cmp = getPlayerOvr(a) - getPlayerOvr(b);
          break;
        case "value":
          cmp = (a.market_value || 0) - (b.market_value || 0);
          break;
        case "team":
          cmp = getTeamName(gameState.teams, a.team_id).localeCompare(getTeamName(gameState.teams, b.team_id), locale);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [gameState.players, gameState.teams, locale, posFilter, search, sortAsc, sortKey, teamFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, posFilter, teamFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visiblePlayers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const listedCount = gameState.players.filter((player) => player.transfer_listed).length;
  const topOverallPlayers = filtered.slice(0, 5);
  const topValuePlayers = [...filtered].sort((a, b) => b.market_value - a.market_value).slice(0, 5);
  const sortDirection: SortDirection = sortAsc ? "asc" : "desc";

  const renderPlayerRow = (player: PlayerData) => {
    const ovr = getPlayerOvr(player);
    const age = calcAge(player.date_of_birth);
    const scoutState = alreadyScoutingIds.has(player.id)
      ? "already-assigned"
      : sendingPlayerId === player.id
        ? "busy"
        : availableScouts.length === 0
          ? "unavailable"
          : "ready";
    const team = player.team_id ? gameState.teams.find((candidate) => candidate.id === player.team_id) ?? null : null;
    const contextItems = [
      buildViewProfileMenuItem(t, () => onSelectPlayer(player.id)),
      ...(player.team_id ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))] : []),
    ];

    if (player.team_id === managerTeamId) {
      contextItems.push(buildDividerMenuItem());
      contextItems.push(buildToggleTransferListMenuItem(t, player.transfer_listed, async () => {
        try {
          const updated = await toggleTransferList(player.id);
          onGameUpdate?.(updated);
        } catch {
          return;
        }
      }));
      contextItems.push(buildToggleLoanListMenuItem(t, player.loan_listed, async () => {
        try {
          const updated = await toggleLoanList(player.id);
          onGameUpdate?.(updated);
        } catch {
          return;
        }
      }));
    } else {
      contextItems.push(buildDividerMenuItem());
      if (player.team_id) contextItems.push(buildMakeTransferBidMenuItem(t, () => openBidNegotiation(player)));
      contextItems.push(buildScoutPlayerMenuItem(t, scoutState, () => void handleScoutPlayer(player.id)));
    }

    return (
      <ContextMenu items={contextItems} key={player.id}>
        <tr onClick={() => onSelectPlayer(player.id)} className="group cursor-pointer transition-colors hover:bg-white/5">
          <td className="px-3 py-2.5">
            <div className="flex min-w-0 justify-start">
              <Badge variant={positionBadgeVariant(player.natural_position || player.position)} size="sm">
                {translatePositionAbbreviation(t, player.natural_position || player.position)}
              </Badge>
            </div>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-bg text-app-text-muted">
                <User className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 truncate font-bold text-app-text transition-colors group-hover:text-app-green">{player.full_name}</span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-center tabular-nums text-app-text-muted">{age}</td>
          <td className="px-3 py-2.5" title={player.nationality}>
            <CountryFlag code={player.nationality} locale={locale} className="text-lg leading-none" />
          </td>
          <td className="px-3 py-2.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (player.team_id) onSelectTeam(player.team_id);
              }}
              aria-label={getTeamName(gameState.teams, player.team_id)}
              className="flex min-w-0 items-center gap-2 text-left text-app-text-muted transition-colors hover:text-app-green"
            >
              {team ? <TeamLogo team={team} size="sm" className="h-6 w-6 rounded-md border border-app-border bg-white/95 p-0.5" aria-hidden /> : <span className="h-6 w-6 shrink-0 rounded-md border border-app-border bg-app-card" />}
              <span className="truncate hover:underline">{getTeamName(gameState.teams, player.team_id)}</span>
            </button>
          </td>
          <td className="px-3 py-2.5 text-right font-semibold text-app-text-muted">{formatVal(player.market_value)}</td>
          <td className="px-3 py-2.5 text-center">
            <span className={cx("font-heading text-sm font-bold tabular-nums", ovr >= 75 ? "text-app-green" : ovr >= 55 ? "text-amber-400" : "text-app-text-muted")}>{ovr}</span>
          </td>
          <td className="px-3 py-2.5">
            <div className="flex flex-wrap justify-end gap-1">
              {player.transfer_listed ? <Badge variant="accent" size="sm">{t("transfers.transfer")}</Badge> : null}
              {player.loan_listed ? <Badge variant="primary" size="sm">{t("transfers.loan")}</Badge> : null}
              {player.injury ? <Badge variant="danger" size="sm">{t("common.injured")}</Badge> : null}
              {!player.transfer_listed && !player.loan_listed && !player.injury ? <span className="text-[10px] text-app-text-muted">—</span> : null}
            </div>
          </td>
        </tr>
      </ContextMenu>
    );
  };

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">PLAYERS</h1>
          <p className="text-sm text-app-text-muted">
            {filtered.length} / {gameState.players.length} players &bull; {t("common.page", "Page")} {safePage} / {totalPages} &bull; {sortKey.toUpperCase()} {sortDirection.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderChip icon={<Users className="h-4 w-4" />} label="Pool" value={String(gameState.players.length)} />
          <HeaderChip icon={<Target className="h-4 w-4" />} label="Listed" value={String(listedCount)} />
          <HeaderChip icon={<ShieldCheck className="h-4 w-4" />} label="Scouts" value={`${availableScouts.length}/${scouts.length}`} />
          <div className="flex items-center gap-2 rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            <Filter className="h-4 w-4" />
            {filtered.length} Results
          </div>
        </div>
      </div>

      {scoutError ? <p role="alert" className="text-xs font-heading font-bold uppercase tracking-wider text-red-400">{scoutError}</p> : null}

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 h-full">
          <TemplateCard className="relative z-20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-green">PLAYER SEARCH</h2>
              <span className="text-[10px] uppercase tracking-wider text-app-text-muted">{t("players.nPlayersFound", { count: filtered.length })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-muted" />
                <input
                  type="text"
                  placeholder={t("players.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-app-border bg-app-bg py-2 pl-8 pr-3 text-[11px] text-app-text placeholder:text-app-text-muted focus:border-app-green/60 focus:outline-none"
                />
              </div>
              <button type="button" onClick={() => setPosFilter(null)} className={cx("rounded border px-3 py-1.5 text-xs font-semibold transition-colors", !posFilter ? "border-app-green bg-app-green/20 text-app-green" : "border-app-border bg-app-bg text-app-text-muted hover:text-white")}>{t("players.allPos")}</button>
              {POSITIONS.map((position) => (
                <button key={position} type="button" onClick={() => setPosFilter(posFilter === position ? null : position)} className={cx("rounded border px-3 py-1.5 text-xs font-semibold transition-colors", posFilter === position ? "border-app-green bg-app-green/20 text-app-green" : "border-app-border bg-app-bg text-app-text-muted hover:text-white")}>
                  {t(`common.posAbbr.${position}`)}
                </button>
              ))}
              <Select value={teamFilter || ""} onChange={(event) => setTeamFilter(event.target.value || null)} selectSize="sm" className="min-w-44 border-app-border bg-app-bg text-app-text focus:border-app-green">
                <option value="">{t("players.allTeams")}</option>
                {gameState.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </Select>
            </div>
          </TemplateCard>

          <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app-bg">
            <div className="flex items-center justify-between border-b border-app-border/50 bg-app-card px-4 py-3">
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-green">PLAYER RESULTS</h2>
                <p className="mt-1 text-xs text-app-text-muted">Click a player for profile, or expand the table for more room.</p>
              </div>
              <button type="button" onClick={() => setResultsExpanded(true)} className="flex items-center gap-1.5 rounded border border-app-green/30 px-3 py-1.5 text-xs font-semibold text-app-green transition-colors hover:bg-app-green/10">
                <Maximize2 className="h-3.5 w-3.5" /> Expand
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1070px] table-fixed text-left text-[11px] whitespace-nowrap">
                <PlayerResultsColGroup />
                <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card">
                  <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                    <SortHeader label={t("common.position")} sortKey="position" current={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortHeader label={t("common.name")} sortKey="name" current={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortHeader label={t("common.age")} sortKey="age" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <th className="px-3 py-3">NAT</th>
                    <SortHeader label={t("common.team")} sortKey="team" current={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortHeader label={t("common.value")} sortKey="value" current={sortKey} asc={sortAsc} onClick={handleSort} align="right" />
                    <SortHeader label={t("common.ovr")} sortKey="ovr" current={sortKey} asc={sortAsc} onClick={handleSort} align="center" />
                    <th className="px-3 py-3 text-right">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30 text-app-text">
                  {visiblePlayers.length > 0 ? visiblePlayers.map(renderPlayerRow) : (
                    <tr><td colSpan={8} className="py-12 text-center text-app-text-muted">{t("players.noMatch")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-app-border/50 px-4 py-3 text-[11px] text-app-text-muted">
              <span>{t("players.showingRange", { from: filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1, to: Math.min(safePage * PAGE_SIZE, filtered.length), total: filtered.length })}</span>
              <div className="flex items-center gap-1">
                <PageButton disabled={safePage === 1} onClick={() => setPage(1)}><ChevronsLeft className="h-4 w-4" /></PageButton>
                <PageButton disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></PageButton>
                <span className="px-3 py-1 text-[10px] font-bold text-app-text">{safePage} / {totalPages}</span>
                <PageButton disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" /></PageButton>
                <PageButton disabled={safePage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="h-4 w-4" /></PageButton>
              </div>
            </div>
          </TemplateCard>
        </section>

        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[360px]">
          <div>
            <SectionTitle title="TOP RATED" action="Filtered" />
            <TemplateCard className="overflow-hidden">
              {topOverallPlayers.map((player) => <PlayerMiniRow key={player.id} player={player} teams={gameState.teams} onSelectPlayer={onSelectPlayer} />)}
            </TemplateCard>
          </div>
          <div>
            <SectionTitle title="HIGHEST VALUE" action="Market" />
            <TemplateCard className="overflow-hidden">
              {topValuePlayers.map((player) => <PlayerMiniRow key={player.id} player={player} teams={gameState.teams} valueMode onSelectPlayer={onSelectPlayer} />)}
            </TemplateCard>
          </div>
          <div>
            <SectionTitle title="ROW ACTIONS" action="Right click" />
            <TemplateCard className="flex flex-col gap-3 p-4 text-xs text-app-text-muted">
              <p>Use row context menus for profile, team, scouting, bid, and list actions.</p>
              <StatRow label="Available scouts" value={`${availableScouts.length}/${scouts.length}`} tone="text-app-green" />
              <StatRow label="Active scouting" value={String(alreadyScoutingIds.size)} tone="text-blue-300" />
            </TemplateCard>
          </div>
        </aside>
      </div>

      {resultsExpanded ? (
        <PlayersResultsExpandedModal
          filteredCount={filtered.length}
          totalCount={gameState.players.length}
          safePage={safePage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          players={visiblePlayers}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onPageChange={setPage}
          renderPlayerRow={renderPlayerRow}
          t={t}
          onClose={() => setResultsExpanded(false)}
        />
      ) : null}

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

function PlayersResultsExpandedModal({
  filteredCount,
  totalCount,
  safePage,
  totalPages,
  pageSize,
  players,
  sortKey,
  sortAsc,
  onSort,
  onPageChange,
  renderPlayerRow,
  t,
  onClose,
}: {
  filteredCount: number;
  totalCount: number;
  safePage: number;
  totalPages: number;
  pageSize: number;
  players: PlayerData[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onPageChange: (value: SetStateAction<number>) => void;
  renderPlayerRow: (player: PlayerData) => ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-[min(1500px,96vw)] flex-col gap-4 rounded-2xl border border-app-border bg-app-card p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border/50 pb-3">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wide text-app-green">PLAYER RESULTS EXPANDED</h2>
            <p className="mt-0.5 text-xs text-app-text-muted">{filteredCount} / {totalCount} players in the current view.</p>
          </div>
          <button type="button" aria-label="Close expanded player results" onClick={onClose} className="rounded-lg border border-app-border bg-app-bg p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <TemplateCard className="flex min-h-0 flex-1 flex-col bg-app-bg">
          <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
            <table className="w-full min-w-[1120px] table-fixed whitespace-nowrap text-left text-[11px]">
              <PlayerResultsColGroup />
              <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card text-[9px] font-bold uppercase tracking-wider text-app-text-muted shadow-sm">
                <tr>
                  <SortHeader label={t("common.position")} sortKey="position" current={sortKey} asc={sortAsc} onClick={onSort} />
                  <SortHeader label={t("common.name")} sortKey="name" current={sortKey} asc={sortAsc} onClick={onSort} />
                  <SortHeader label={t("common.age")} sortKey="age" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                  <th className="px-3 py-3">NAT</th>
                  <SortHeader label={t("common.team")} sortKey="team" current={sortKey} asc={sortAsc} onClick={onSort} />
                  <SortHeader label={t("common.value")} sortKey="value" current={sortKey} asc={sortAsc} onClick={onSort} align="right" />
                  <SortHeader label={t("common.ovr")} sortKey="ovr" current={sortKey} asc={sortAsc} onClick={onSort} align="center" />
                  <th className="px-3 py-3 text-right">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30 text-app-text">
                {players.length > 0 ? players.map((player) => renderPlayerRow(player)) : (
                  <tr><td colSpan={8} className="py-12 text-center text-app-text-muted">{t("players.noMatch")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-app-border/50 p-2.5 text-[11px] text-app-text-muted">
            <span>{t("players.showingRange", { from: filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1, to: Math.min(safePage * pageSize, filteredCount), total: filteredCount })}</span>
            <div className="flex items-center gap-1">
              <PageButton disabled={safePage === 1} onClick={() => onPageChange(1)}><ChevronsLeft className="h-4 w-4" /></PageButton>
              <PageButton disabled={safePage === 1} onClick={() => onPageChange((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></PageButton>
              <span className="flex h-6 min-w-6 items-center justify-center rounded bg-app-green px-2 font-bold text-app-bg">{safePage}</span>
              <span className="px-1">/</span>
              <span className="px-1 font-mono text-app-text-muted">{totalPages}</span>
              <PageButton disabled={safePage === totalPages} onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" /></PageButton>
              <PageButton disabled={safePage === totalPages} onClick={() => onPageChange(totalPages)}><ChevronsRight className="h-4 w-4" /></PageButton>
            </div>
          </div>
        </TemplateCard>
      </div>
    </div>
  );
}

function PlayerResultsColGroup() {
  return (
    <colgroup>
      <col className="w-[105px]" />
      <col className="w-[260px]" />
      <col className="w-[70px]" />
      <col className="w-[70px]" />
      <col className="w-[230px]" />
      <col className="w-[130px]" />
      <col className="w-[80px]" />
      <col className="w-[125px]" />
    </colgroup>
  );
}

function PageButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text disabled:pointer-events-none disabled:opacity-30">{children}</button>;
}

function PlayerMiniRow({ player, teams, valueMode, onSelectPlayer }: { player: PlayerData; teams: GameStateData["teams"]; valueMode?: boolean; onSelectPlayer: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelectPlayer(player.id)} className="flex w-full items-center gap-3 border-b border-app-border/30 px-4 py-3 text-left text-xs transition-colors last:border-b-0 hover:bg-white/5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-bg text-[10px] font-bold text-app-green">{valueMode ? formatVal(player.market_value).slice(0, 2) : getPlayerOvr(player)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-app-text">{valueMode ? formatVal(player.market_value) : `${getPlayerOvr(player)} OVR`}</span>
        <span className="block truncate text-[10px] text-app-text-muted">{getTeamName(teams, player.team_id)}</span>
      </span>
      <Star className="h-3.5 w-3.5 text-app-text-muted" />
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (k: SortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = current === sortKey;
  return (
    <th className={cx("px-3 py-3", align === "center" && "text-center", align === "right" && "text-right")}>
      <button type="button" onClick={() => onClick(sortKey)} className={cx("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-app-green", align === "center" && "justify-center", align === "right" && "justify-end", isActive ? "text-app-green" : "text-app-text-muted")}>
        {label}
        <ArrowUpDown className={cx("h-3 w-3", isActive ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}
