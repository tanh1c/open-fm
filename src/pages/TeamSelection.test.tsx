import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStateData } from "../store/gameStore";
import type { TeamData } from "../store/types";
import TeamSelection from "./TeamSelection";

const navigateMock = vi.fn();
const setGameStateMock = vi.fn();
const setGameActiveMock = vi.fn();
let gameState: GameStateData | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.name ? `${key}:${params.name}` : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../store/gameStore", () => ({
  useGameStore: () => ({
    gameState,
    setGameState: setGameStateMock,
    setGameActive: setGameActiveMock,
  }),
}));

vi.mock("../components/ui", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TeamLocation: ({ city }: { city: string }) => <span>{city}</span>,
  ThemeToggle: () => <div data-testid="theme-toggle" />,
  CountryFlag: ({ code }: { code: string }) => <span data-testid={`flag-${code}`} />,
}));

vi.mock("../components/common/DivisionLogo", () => ({
  default: ({ leagueName }: { leagueName: string }) => <span>{leagueName}</span>,
}));

vi.mock("../components/common/TeamLogo", () => ({
  default: ({ team }: { team: TeamData }) => <span>{team.short_name}</span>,
}));

function createTeam(overrides: Partial<TeamData>): TeamData {
  return {
    id: "team-1",
    name: "England",
    short_name: "ENG",
    country: "ENG",
    domestic_tier: 1,
    city: "London",
    stadium_name: "National Stadium",
    stadium_capacity: 90000,
    finance: 1000000,
    manager_id: null,
    reputation: 750,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    formation: "4-3-3",
    play_style: "Balanced",
    training_focus: "General",
    training_intensity: "Balanced",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "#ffffff", secondary: "#111111" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

function createGameState(worldSource: string | null, teams: TeamData[]): GameStateData {
  return {
    clock: { current_date: "2026-06-01", start_date: "2026-06-01" },
    manager: {
      id: "manager-1",
      first_name: "Ada",
      last_name: "Lovelace",
      date_of_birth: "1980-01-01",
      nationality: "ENG",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: null,
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
    teams,
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    competitions: [],
    scouting_assignments: [],
    board_objectives: [],
    world_source: worldSource,
  };
}

describe("TeamSelection", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setGameStateMock.mockReset();
    setGameActiveMock.mockReset();
  });

  it("uses Confederation to National team flow for World Cup saves", () => {
    gameState = createGameState("worldcup2026", [
      createTeam({ id: "eng", name: "England", short_name: "ENG", country: "ENG" }),
      createTeam({ id: "fr", name: "France", short_name: "FRA", country: "FR" }),
      createTeam({ id: "jp", name: "Japan", short_name: "JPN", country: "JP" }),
    ]);

    render(<TeamSelection />);

    expect(screen.getAllByText("Choose confederation").length).toBeGreaterThan(0);
    expect(screen.queryByText("Choose division")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /UEFA/i }));

    expect(screen.getAllByText("Choose national team").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /England/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /France/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Japan/i })).not.toBeInTheDocument();
  });

  it("keeps Country to Division to Club flow for club saves", () => {
    gameState = createGameState("random", [
      createTeam({ id: "ars", name: "Arsenal", short_name: "ARS", country: "England", domestic_tier: 1 }),
      createTeam({ id: "lee", name: "Leeds", short_name: "LEE", country: "England", domestic_tier: 2 }),
    ]);

    render(<TeamSelection />);

    fireEvent.click(screen.getByRole("button", { name: /England/i }));

    expect(screen.getAllByText("Choose division").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Premier League/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arsenal/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Premier League/i }));

    expect(screen.getAllByText("Choose team").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Arsenal/i })).toBeInTheDocument();
  });
});
