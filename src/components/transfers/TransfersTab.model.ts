import type { GameStateData, PlayerData } from "../../store/gameStore";
import { normalisePosition } from "../squad/SquadTab.helpers";

export type TransferTabView = "my_list" | "market" | "loans" | "offers" | "shortlist";

export interface TransferCollections {
  myTransferList: PlayerData[];
  myLoanList: PlayerData[];
  marketPlayers: PlayerData[];
  loanPlayers: PlayerData[];
  playersWithOffers: PlayerData[];
  shortlistedPlayers: PlayerData[];
}

export function deriveTransferCollections(
  gameState: GameStateData,
  userTeamId: string | null,
): TransferCollections {
  return {
    myTransferList: gameState.players.filter(
      (player) => player.team_id === userTeamId && player.transfer_listed,
    ),
    myLoanList: gameState.players.filter(
      (player) => player.team_id === userTeamId && player.loan_listed,
    ),
    marketPlayers: gameState.players.filter(
      (player) => (player.transfer_listed || player.shortlisted || player.team_id === null) && player.team_id !== userTeamId,
    ),
    loanPlayers: gameState.players.filter(
      (player) => player.loan_listed && player.team_id !== userTeamId,
    ),
    playersWithOffers: gameState.players.filter(
      (player) =>
        player.transfer_offers.length > 0 &&
        (player.team_id === userTeamId ||
          player.transfer_offers.some(
            (offer) => offer.from_team_id === userTeamId,
          )),
    ),
    shortlistedPlayers: gameState.players.filter(
      (player) => player.shortlisted && player.team_id !== userTeamId,
    ),
  };
}

export function getCurrentTransferList(
  view: TransferTabView,
  collections: TransferCollections,
): PlayerData[] {
  switch (view) {
    case "my_list":
      return [...collections.myTransferList, ...collections.myLoanList];
    case "market":
      return collections.marketPlayers;
    case "loans":
      return collections.loanPlayers;
    case "shortlist":
      return collections.shortlistedPlayers;
    case "offers":
    default:
      return collections.playersWithOffers;
  }
}

export function filterTransferPlayers(
  players: PlayerData[],
  search: string,
  posFilter: string | null,
): PlayerData[] {
  return players.filter((player) => {
    if (
      posFilter &&
      normalisePosition(player.natural_position || player.position) !== posFilter
    ) {
      return false;
    }

    if (search.length >= 2) {
      const query = search.toLowerCase();

      if (
        !player.full_name.toLowerCase().includes(query) &&
        !player.nationality.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    return true;
  });
}

export interface TransferAdvancedFilters {
  minAge: number | null;
  maxAge: number | null;
  maxValue: number | null;
  maxWeeklyWage: number | null;
  offerStatus: "Any" | "Pending" | "Accepted" | "Rejected" | "Withdrawn";
}

function ageOnDate(dateOfBirth: string, currentDate: string): number {
  const birth = new Date(dateOfBirth);
  const current = new Date(currentDate);
  let age = current.getFullYear() - birth.getFullYear();
  const monthDiff = current.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && current.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

export function applyTransferAdvancedFilters(
  players: PlayerData[],
  filters: TransferAdvancedFilters,
  currentDate: string,
): PlayerData[] {
  return players.filter((player) => {
    const age = ageOnDate(player.date_of_birth, currentDate);
    if (filters.minAge !== null && age < filters.minAge) return false;
    if (filters.maxAge !== null && age > filters.maxAge) return false;
    if (filters.maxValue !== null && player.market_value > filters.maxValue) return false;
    if (filters.maxWeeklyWage !== null && player.wage / 52 > filters.maxWeeklyWage) return false;
    if (
      filters.offerStatus !== "Any" &&
      !player.transfer_offers.some((offer) => offer.status === filters.offerStatus)
    ) {
      return false;
    }

    return true;
  });
}

export function paginateTransferPlayers<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(pageCount, Math.max(1, page));
  const start = (safePage - 1) * pageSize;

  return { items: items.slice(start, start + pageSize), page: safePage, pageCount };
}