import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeTab from "./HomeTab";
import type {
  FixtureData,
  GameStateData,
  NewsArticle,
  PlayerData,
  TeamData,
} from "../../store/gameStore";

const backendI18nMocks = vi.hoisted(() => ({
  resolveBoardObjective: vi.fn((value: unknown) => value),
  resolveMessage: vi.fn((value: unknown) => value),
  resolveNewsArticle: vi.fn((value: unknown) => value),
}));

vi.mock("../../utils/backendI18n", () => ({
  resolveBoardObjective: backendI18nMocks.resolveBoardObjective,
  resolveMessage: backendI18nMocks.resolveMessage,
  resolveNewsArticle: backendI18nMocks.resolveNewsArticle,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "home.nextOpponent") return "Next Opponent";
      if (key === "home.noUpcomingOpponent")
        return "No upcoming league fixture.";
      if (key === "home.leagueDigest") return "League Digest";
      if (key === "home.noLeagueDigest") return "No league digest yet.";
      if (key === "dashboard.news") return "News";
      if (key === "dashboard.schedule") return "Schedule";
      if (key === "home.matchdayN") return `Matchday ${params?.n}`;
      if (key === "season.friendly") return "Friendly";
      if (key === "home.home") return "Home";
      if (key === "home.away") return "Away";
      if (key === "home.pointsShort") return `${params?.points} pts`;
      if (key === "news.categories.LeagueRoundup") return "League Roundup";
      if (key === "news.categories.StandingsUpdate") return "Standings";
      return key;
    },
  }),
}));

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Alpha FC",
    short_name: "ALP",
    country: "BR",
    city: "Rio",
    stadium_name: "Alpha Arena",
    stadium_capacity: 50000,
    finance: 0,
    manager_id: "manager-1",
    reputation: 50,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "Physical",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: {
      primary: "#111111",
      secondary: "#ffffff",
    },
    starting_xi_ids: [],
    match_roles: {
      captain: null,
      vice_captain: null,
      penalty_taker: null,
      free_kick_taker: null,
      corner_taker: null,
    },
    form: [],
    history: [],
    ...overrides,
  };
}

function createPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "J. Smith",
    full_name: "John Smith",
    date_of_birth: "2000-01-01",
    nationality: "BR",
    position: "Forward",
    natural_position: "Forward",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: 10,
      stamina: 10,
      strength: 10,
      agility: 10,
      passing: 10,
      shooting: 10,
      tackling: 10,
      dribbling: 10,
      defending: 10,
      positioning: 10,
      vision: 10,
      decisions: 10,
      composure: 10,
      aggression: 10,
      teamwork: 10,
      leadership: 10,
      handling: 10,
      reflexes: 10,
      aerial: 10,
    },
    condition: 80,
    morale: 80,
    injury: null,
    team_id: "team-1",
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      avg_rating: 0,
      minutes_played: 0,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ovr: 1,
    ...overrides,
  };
}

function createFixture(overrides: Partial<FixtureData> = {}): FixtureData {
  return {
    id: "fixture-1",
    matchday: 2,
    date: "2025-01-12",
    home_team_id: "team-1",
    away_team_id: "team-2",
    competition: "League",
    status: "Scheduled",
    result: null,
    ...overrides,
  };
}

function createNewsArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: "news-1",
    headline: "Headline",
    body: "Body",
    source: "OpenFoot Times",
    date: "2025-01-10",
    category: "LeagueRoundup",
    team_ids: [],
    player_ids: [],
    match_score: null,
    read: false,
    ...overrides,
  };
}

function createGameState(
  overrides: Partial<GameStateData> = {},
): GameStateData {
  return {
    clock: {
      current_date: "2025-01-20T00:00:00Z",
      start_date: "2025-01-01T00:00:00Z",
    },
    manager: {
      id: "manager-1",
      first_name: "Jane",
      last_name: "Doe",
      date_of_birth: "1980-01-01",
      nationality: "BR",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: "team-1",
      career_stats: {
        matches_managed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        trophies: 0,
        best_finish: null,
      },
      career_history: [],
    },
    teams: [
      createTeam(),
      createTeam({
        id: "team-2",
        name: "Beta FC",
        short_name: "BET",
        form: ["W", "D", "W"],
      }),
    ],
    players: [createPlayer()],
    staff: [],
    messages: [],
    news: [],
    league: {
      id: "league-1",
      name: "League",
      season: 1,
      fixtures: [createFixture()],
      standings: [
        {
          team_id: "team-2",
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goals_for: 2,
          goals_against: 0,
          points: 3,
        },
        {
          team_id: "team-1",
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goals_for: 0,
          goals_against: 2,
          points: 0,
        },
      ],
    },
    scouting_assignments: [],
    board_objectives: [],
    ...overrides,
  };
}

describe("HomeTab", function (): void {
  it("uses the template dashboard layout with right sidebar", function (): void {
    render(
      <HomeTab
        gameState={createGameState()}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByTestId("home-template-layout")).toHaveClass(
      "xl:flex-row",
      "gap-4",
    );
    expect(screen.getByTestId("template-dashboard")).toBeInTheDocument();
    expect(screen.getByText("OVR")).toBeInTheDocument();
    expect(screen.getByText("POT")).toBeInTheDocument();
    expect(document.querySelector(".rating-cell-poor")).toHaveTextContent("1");
    expect(screen.getByTestId("template-right-sidebar")).toHaveClass(
      "xl:w-[320px]",
      "shrink-0",
    );
  });

  it("renders template training overview in the right sidebar", function (): void {
    render(
      <HomeTab
        gameState={createGameState()}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByTestId("template-right-sidebar")).toBeInTheDocument();
    expect(screen.getByText("TRAINING OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("Training Calendar")).toBeInTheDocument();
  });

  it("renders real transfer activity from player offers", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          players: [
            createPlayer({
              transfer_offers: [
                {
                  id: "offer-1",
                  from_team_id: "team-2",
                  fee: 1250000,
                  wage_offered: 10000,
                  last_manager_fee: null,
                  negotiation_round: 1,
                  suggested_counter_fee: null,
                  status: "Pending",
                  date: "2025-01-15",
                },
              ],
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByText("TRANSFER ACTIVITY")).toBeInTheDocument();
    expect(screen.getAllByText("J. Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("$1.3M")).toBeInTheDocument();
    expect(screen.getByText("Beta FC")).toBeInTheDocument();
  });

  it("keeps match news out of the transfer activity widget", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          news: [
            createNewsArticle({
              id: "news-activity-1",
              headline: "Standings headline",
              category: "StandingsUpdate",
              date: "2025-01-15",
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.queryByText("Next Opponent")).not.toBeInTheDocument();
    expect(screen.getByText("TRANSFER ACTIVITY")).toBeInTheDocument();
    expect(screen.queryByText("Standings headline")).not.toBeInTheDocument();
    expect(screen.getByText("No activity available.")).toBeInTheDocument();
  });

  it("keeps youth academy players out of first-team home summaries", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          players: [
            createPlayer({
              id: "senior-1",
              full_name: "Senior Starter",
              condition: 80,
              injury: {
                name: "hamstring_strain",
                days_remaining: 5,
              },
            }),
            createPlayer({
              id: "youth-1",
              full_name: "Youth Prospect",
              condition: 10,
              injury: {
                name: "ankle_sprain",
                days_remaining: 14,
              },
              squad_role: "Youth",
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getAllByText("J. Smith").length).toBeGreaterThan(0);
    expect(screen.queryByText("Youth Prospect")).not.toBeInTheDocument();
  });

  it("switches squad overview tabs to real column views", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          players: [
            createPlayer({
              wage: 12000,
              market_value: 2500000,
              contract_end: "2026-06-30",
              injury: {
                name: "hamstring_strain",
                days_remaining: 5,
              },
              stats: {
                appearances: 4,
                goals: 2,
                assists: 1,
                clean_sheets: 0,
                yellow_cards: 0,
                red_cards: 0,
                avg_rating: 7.25,
                minutes_played: 360,
              },
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(screen.getByText("APPS")).toBeInTheDocument();
    expect(screen.getByText("GLS")).toBeInTheDocument();
    expect(screen.getByText("7.25")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contract" }));
    expect(screen.getByText("WAGE")).toBeInTheDocument();
    expect(screen.getByText("VALUE")).toBeInTheDocument();
    expect(screen.getByText("$12K")).toBeInTheDocument();
    expect(screen.getByText("$2.5M")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fitness" }));
    expect(screen.getByText("STATUS")).toBeInTheDocument();
    expect(screen.getByText("Hamstring Strain")).toBeInTheDocument();
  });
});
