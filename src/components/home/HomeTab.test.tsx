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
      if (key === "season.phases.Preseason") return "Preseason";
      if (key === "season.phases.InSeason") return "In Season";
      if (key === "season.windowClosesToday") return "Window closes today";
      if (key === "season.windowClosesInDays") return `Window closes in ${params?.count} days`;
      if (key === "season.windowOpensInDays") return `Window opens in ${params?.count} days`;
      if (key === "season.windowClosed") return "Window closed";
      if (key === "onboarding.reviewSquad") return "Review squad";
      if (key === "onboarding.hireStaff") return "Hire staff";
      if (key === "onboarding.setTactics") return "Set tactics";
      if (key === "onboarding.configTraining") return "Configure training";
      if (key === "onboarding.readMessages") return "Read messages";
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
    expect(screen.getByText("No activity available.")).toBeInTheDocument();
  });

  it("renders compact briefing cards for season, objectives, messages, and squad alerts", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          board_objectives: [
            {
              id: "objective-1",
              description: "Finish in the top half",
              objective_type: "league_position",
              target: 10,
              met: false,
            },
          ],
          messages: [
            {
              id: "message-1",
              subject: "Board expects progress",
              body: "Keep improving results.",
              sender: "Chairperson",
              sender_role: "Board",
              date: "2025-01-18",
              read: false,
              category: "Board",
              priority: "Normal",
              actions: [],
              context: {
                team_id: null,
                player_id: null,
                fixture_id: null,
                match_result: null,
              },
            },
          ],
          players: [
            createPlayer({
              condition: 42,
              injury: {
                name: "hamstring_strain",
                days_remaining: 5,
              },
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>(["Squad", "Staff", "Tactics", "Training", "Inbox"])}
      />,
    );

    expect(screen.getByTestId("template-briefing-strip")).toBeInTheDocument();
    expect(screen.getByText("Season / Window")).toBeInTheDocument();
    expect(screen.getByText("In Season")).toBeInTheDocument();
    expect(screen.getByText("Board Objective")).toBeInTheDocument();
    expect(screen.getByText("Finish in the top half")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Board expects progress")).toBeInTheDocument();
    expect(screen.getByText("Squad Alerts")).toBeInTheDocument();
    expect(screen.getByText("1 out")).toBeInTheDocument();
  });

  it("renders onboarding in the briefing strip when first steps are incomplete", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          clock: {
            current_date: "2025-01-03T00:00:00Z",
            start_date: "2025-01-01T00:00:00Z",
          },
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Review squad")).toBeInTheDocument();
  });

  it("renders club briefing with unavailable players, recent results, and player momentum", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          players: [
            createPlayer({
              id: "injured-1",
              match_name: "Senior Starter",
              condition: 80,
              injury: {
                name: "hamstring_strain",
                days_remaining: 5,
              },
            }),
            createPlayer({
              id: "hot-1",
              match_name: "Hot Prospect",
              morale: 92,
            }),
          ],
          league: {
            ...createGameState().league!,
            fixtures: [
              createFixture({
                id: "played-1",
                date: "2025-01-08",
                status: "Completed",
                result: {
                  home_goals: 2,
                  away_goals: 1,
                  home_scorers: [],
                  away_scorers: [],
                },
              }),
              createFixture(),
            ],
          },
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByTestId("template-club-briefing")).toBeInTheDocument();
    expect(screen.getByText("Unavailable Players")).toBeInTheDocument();
    expect(screen.getAllByText("Senior Starter").length).toBeGreaterThan(0);
    expect(screen.getByText("Hamstring Strain • 5 days")).toBeInTheDocument();
    expect(screen.getByText("Recent Results")).toBeInTheDocument();
    expect(screen.getAllByText("Beta FC (H)").length).toBeGreaterThan(0);
    expect(screen.getByText("2-1 • League")).toBeInTheDocument();
    expect(screen.getByText("Player Momentum")).toBeInTheDocument();
    expect(screen.getAllByText("Hot Prospect").length).toBeGreaterThan(0);
  });

  it("falls back to league digest in club briefing when no momentum rows exist", function (): void {
    render(
      <HomeTab
        gameState={createGameState({
          players: [createPlayer({ morale: 70 })],
          news: [
            createNewsArticle({
              id: "digest-1",
              headline: "League leaders hold firm",
              category: "LeagueRoundup",
              date: "2025-01-16",
            }),
          ],
        })}
        visitedOnboardingTabs={new Set<string>()}
      />,
    );

    expect(screen.getByText("League Digest")).toBeInTheDocument();
    expect(screen.getAllByText("League leaders hold firm").length).toBeGreaterThan(0);
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
              match_name: "Youth Prospect",
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
