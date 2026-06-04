import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FixtureData, GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import TournamentsTab from "./TournamentsTab";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "tournaments.noActive") return "No active tournament";
      if (key === "schedule.standings") return "Standings";
      if (key === "schedule.fixtures") return "Fixtures";
      if (key === "common.viewTeam") return "View team";
      if (key === "squad.viewProfile") return "View profile";
      if (key === "tournaments.overview") return "Overview";
      if (key === "tournaments.leagueTable") return "League Table";
      if (key === "tournaments.nTeams") return `${params?.count} teams`;
      if (key === "tournaments.progress") return "Progress";
      if (key === "tournaments.matches") return "Matches";
      if (key === "tournaments.goals") return "Goals";
      if (key === "tournaments.topScorers") return "Top Scorers";
      if (key === "tournaments.noGoals") return "No goals yet";
      if (key === "schedule.season") return `Season ${params?.number}`;
      if (key === "common.team") return "Team";
      if (key === "common.played") return "P";
      if (key === "common.won") return "W";
      if (key === "common.drawn") return "D";
      if (key === "common.lost") return "L";
      if (key === "common.gd") return "GD";
      if (key === "common.pts") return "Pts";
      if (key === "common.position") return "Position";
      if (key === "common.all") return "All";
      if (key === "common.country") return "Country";
      if (key === "tournaments.globalLeaderboardsTab") return params?.defaultValue?.toString() ?? "Global";
      if (key === "tournaments.viewGlobalLeaderboard") return "View Global Leaderboard";
      if (key === "tournaments.competitionType") return "Competition type";
      if (key === "tournaments.allCompetitions") return "All competitions";
      if (key === "tournaments.globalLeaderboardsScope") return "Season totals across all selected competitions.";
      if (key === "tournaments.wonOnPenalties") return `${params?.team} won ${params?.score} on penalties`;
      if (key === "tournaments.historyTab") return "History";
      if (key === "tournaments.honoursTab") return "Honours";
      if (key === "tournaments.seasonHonours") return "Season honours";
      if (key === "tournaments.champions") return "Champions";
      if (key === "tournaments.goldenBoot") return "Golden Boot";
      if (key === "tournaments.playerOfYear") return "Player of the Year";
      if (key === "tournaments.assistKing") return "Assist King";
      if (key === "tournaments.goldenGlove") return "Golden Glove";
      if (key === "tournaments.awards.units.goals") return "goals";
      if (key === "tournaments.awards.units.assists") return "assists";
      if (key === "tournaments.awards.units.rating") return "rating";
      if (key === "tournaments.awards.units.cleanSheets") return "clean sheets";
      if (key === "endOfSeason.nGoals") return `${params?.count} goals`;
      if (key === "tournaments.champion") return "Champion";
      if (key === "tournaments.runnerUp") return "Runner-up";
      if (key === "tournaments.historyAfterPenalties") return "won on penalties";
      if (key === "tournaments.domesticLeague") return "Domestic League";
      if (key === "tournaments.domesticCup") return "Domestic Cup";
      if (key === "tournaments.continental") return "Continental";
      if (key === "positions.goalkeeper") return "Goalkeeper";
      if (key === "positions.defender") return "Defender";
      if (key === "positions.midfielder") return "Midfielder";
      if (key === "positions.forward") return "Forward";
      if (key.startsWith("season.phases.")) return key.replace("season.phases.", "");
      return key;
    },
  }),
}));

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Alpha FC",
    short_name: "ALP",
    country: "GB",
    city: "London",
    stadium_name: "Alpha Ground",
    stadium_capacity: 30000,
    finance: 500000,
    manager_id: "manager-1",
    reputation: 50,
    wage_budget: 50000,
    transfer_budget: 250000,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "General",
    training_intensity: "Balanced",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "#000000", secondary: "#ffffff" },
    starting_xi_ids: [],
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
    nationality: "GB",
    position: "Forward",
    natural_position: "Forward",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: 60,
      stamina: 60,
      strength: 60,
      agility: 60,
      passing: 60,
      shooting: 60,
      tackling: 60,
      dribbling: 60,
      defending: 60,
      positioning: 60,
      vision: 60,
      decisions: 60,
      composure: 60,
      aggression: 60,
      teamwork: 60,
      leadership: 60,
      handling: 20,
      reflexes: 20,
      aerial: 60,
    },
    condition: 80,
    morale: 75,
    injury: null,
    team_id: "team-1",
    contract_end: "2027-06-30",
    wage: 12000,
    market_value: 350000,
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
    ...overrides,
  };
}

function createFixture(overrides: Partial<FixtureData> = {}): FixtureData {
  return {
    id: "fixture-1",
    matchday: 1,
    date: "2026-08-01",
    home_team_id: "team-1",
    away_team_id: "team-2",
    competition: "League",
    status: "Completed",
    result: {
      home_goals: 1,
      away_goals: 0,
      home_scorers: [{ player_id: "player-1", minute: 14 }],
      away_scorers: [],
    },
    ...overrides,
  };
}

function createGameState(withLeague = true): GameStateData {
  return {
    clock: {
      current_date: "2026-08-10T00:00:00Z",
      start_date: "2026-07-01T00:00:00Z",
    },
    manager: {
      id: "manager-1",
      first_name: "Jane",
      last_name: "Doe",
      date_of_birth: "1980-01-01",
      nationality: "GB",
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
      createTeam({ id: "team-2", name: "Beta FC", short_name: "BET", manager_id: "manager-2" }),
    ],
    players: [
      createPlayer(),
      createPlayer({ id: "player-2", team_id: "team-2", full_name: "Alex Beta" }),
    ],
    staff: [],
    messages: [],
    news: [],
    league: withLeague
      ? {
        id: "league-1",
        name: "Premier League",
        season: 1,
        fixtures: [createFixture()],
        standings: [
          {
            team_id: "team-1",
            played: 1,
            won: 1,
            drawn: 0,
            lost: 0,
            goals_for: 1,
            goals_against: 0,
            points: 3,
          },
          {
            team_id: "team-2",
            played: 1,
            won: 0,
            drawn: 0,
            lost: 1,
            goals_for: 0,
            goals_against: 1,
            points: 0,
          },
        ],
      }
      : null,
    competitions: withLeague ? [
      {
        id: "league-1",
        name: "Premier League",
        season: 1,
        kind: "DomesticLeague",
        format: "RoundRobin",
        country: "GB",
        tier: 1,
        team_ids: ["team-1", "team-2"],
        fixtures: [createFixture({ competition: "DomesticLeague" })],
        standings: [
          {
            team_id: "team-1",
            played: 1,
            won: 1,
            drawn: 0,
            lost: 0,
            goals_for: 1,
            goals_against: 0,
            points: 3,
          },
          {
            team_id: "team-2",
            played: 1,
            won: 0,
            drawn: 0,
            lost: 1,
            goals_for: 0,
            goals_against: 1,
            points: 0,
          },
        ],
      },
    ] : [],
    scouting_assignments: [],
    board_objectives: [],
  };
}

function globalLeaderboardResponse() {
  return {
    season: 1,
    top_scorers: [
      { player_id: "player-1", player_name: "John Smith", team_id: "team-1", team_name: "Alpha FC", value: 9 },
    ],
    top_assists: [],
    top_clean_sheets: [],
    appearances: [],
    minutes: [],
    yellow_cards: [],
    red_cards: [],
    average_ratings: [
      { player_id: "player-1", player_name: "John Smith", team_id: "team-1", team_name: "Alpha FC", value: 7.82, appearances: 3, minutes: 270 },
    ],
  };
}

describe("TournamentsTab", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("renders the empty state when there is no active tournament", () => {
    render(<TournamentsTab gameState={createGameState(false)} onSelectTeam={vi.fn()} />);

    expect(screen.getByText("No active tournament")).toBeInTheDocument();
  });

  it("switches to standings and lets the user select a team", () => {
    const onSelectTeam = vi.fn();

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={onSelectTeam} />);

    fireEvent.click(screen.getByRole("button", { name: /Standings/i }));
    fireEvent.click(screen.getAllByText("Beta FC")[0]);

    expect(onSelectTeam).toHaveBeenCalledWith("team-2");
  });

  it("offers fixture context menu actions to open a team", () => {
    const onSelectTeam = vi.fn();

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={onSelectTeam} />);

    fireEvent.click(screen.getByRole("button", { name: /Fixtures/i }));
    fireEvent.contextMenu(screen.getByTestId("tournaments-fixture-fixture-1"));
    fireEvent.click(screen.getByRole("button", { name: "View team: Beta FC" }));

    expect(onSelectTeam).toHaveBeenCalledWith("team-2");
  });

  it("opens match detail from a completed fixture", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Fixtures/i }));
    fireEvent.click(screen.getByRole("button", { name: "1 - 0" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_match_detail", { fixtureId: "fixture-1" });
    });
  });

  it("offers a top-scorer context menu action to view the player profile", () => {
    const onSelectPlayer = vi.fn();

    render(
      <TournamentsTab
        gameState={createGameState(true)}
        onSelectPlayer={onSelectPlayer}
        onSelectTeam={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("tournaments-top-scorer-player-1"));
    fireEvent.click(screen.getByRole("button", { name: "View profile" }));

    expect(onSelectPlayer).toHaveBeenCalledWith("player-1");
  });

  it("replaces Honours with a single History table", () => {
    const gameState = createGameState(true);
    gameState.season_honours = [
      {
        season: 1,
        champions: [
          {
            competition_id: "league-1",
            competition_name: "Premier League",
            team_id: "team-1",
            team_name: "Alpha FC",
          },
        ],
        awards: {
          golden_boot: [
            { player_id: "player-1", player_name: "John Smith", team_id: "team-1", team_name: "Alpha FC", value: 24 },
          ],
          assist_king: [
            { player_id: "player-2", player_name: "Alex Beta", team_id: "team-2", team_name: "Beta FC", value: 15 },
          ],
          player_of_year: [
            { player_id: "player-1", player_name: "John Smith", team_id: "team-1", team_name: "Alpha FC", value: 7.9 },
          ],
          clean_sheet_king: [],
          most_appearances: [],
          young_player: [],
        },
      },
    ];
    const onSelectTeam = vi.fn();

    render(<TournamentsTab gameState={gameState} onSelectTeam={onSelectTeam} />);

    expect(screen.queryByRole("button", { name: /^Honours$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^History$/i }));

    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Runner-up")).toBeInTheDocument();
    expect(screen.getByText("Golden Boot")).toBeInTheDocument();
    expect(screen.getByText("Assist King")).toBeInTheDocument();
    expect(screen.getByText("Player of the Year")).toBeInTheDocument();
    expect(screen.getByText("Golden Glove")).toBeInTheDocument();
    expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    expect(screen.getByText("24 goals")).toBeInTheDocument();
    expect(screen.getByText("Alex Beta")).toBeInTheDocument();
    expect(screen.getByText("15 assists")).toBeInTheDocument();
    expect(screen.getByText("7.90 rating")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Alpha FC" })[0]);

    expect(onSelectTeam).toHaveBeenCalledWith("team-1");
  });

  it("shows penalty resolution for a drawn knockout fixture", () => {
    const gameState = createGameState(true);
    const cupFinal = createFixture({
      id: "cup-final",
      competition: "DomesticCup",
      matchday: 3,
      stage: "final",
      result: {
        home_goals: 2,
        away_goals: 2,
        home_scorers: [],
        away_scorers: [],
        winner_team_id: "team-1",
        resolution: "AfterPenalties",
        home_penalties: 4,
        away_penalties: 3,
      },
    });
    gameState.competitions = [
      {
        id: "cup-1",
        name: "FA Cup",
        season: 1,
        kind: "DomesticCup",
        format: "Knockout",
        country: "GB",
        tier: null,
        team_ids: ["team-1", "team-2"],
        fixtures: [cupFinal],
        standings: [],
      },
    ];

    render(<TournamentsTab gameState={gameState} onSelectTeam={vi.fn()} />);

    expect(screen.getByText("Alpha FC won 4-3 on penalties")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fixtures/i }));
    expect(screen.getByText("Alpha FC won 4-3 on penalties")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bracket/i }));
    expect(screen.getByText("Alpha FC won 4-3 on penalties")).toBeInTheDocument();
  });

  it("shows selected competition champions and runners-up on the history tab", () => {
    const gameState = createGameState(true);
    gameState.season_honours = [
      {
        season: 1,
        champions: [
          {
            competition_id: "league-1",
            competition_name: "Premier League",
            team_id: "team-1",
            team_name: "Alpha FC",
            runner_up_team_id: "team-2",
            runner_up_team_name: "Beta FC",
            resolution_label: null,
          },
        ],
        awards: {
          golden_boot: [],
          assist_king: [],
          player_of_year: [],
          clean_sheet_king: [],
          most_appearances: [],
          young_player: [],
        },
      },
    ];

    render(<TournamentsTab gameState={gameState} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^History$/i }));

    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Runner-up")).toBeInTheDocument();
    expect(screen.getAllByText("Alpha FC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta FC").length).toBeGreaterThan(0);
    expect(invoke).not.toHaveBeenCalledWith("get_competition_awards", { competitionId: "league-1" });
  });

  it("shows all-time records on the records tab", () => {
    const gameState = createGameState(true);
    gameState.records = {
      most_goals_in_season: {
        player_id: "player-1",
        player_name: "John Smith",
        team_name: "Alpha FC",
        value: 41,
        season: 1,
      },
    };

    render(<TournamentsTab gameState={gameState} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /recordsTab/i }));

    // The record value (41) is unique to the records panel.
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getAllByText(/John Smith/).length).toBeGreaterThan(0);
  });

  it("loads global player leaderboards from the Global tab", async () => {
    vi.mocked(invoke).mockResolvedValue(globalLeaderboardResponse());

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^Global$/i }));

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("All competitions")).toBeInTheDocument();
    expect(screen.getByText("Season totals across all selected competitions.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_global_player_leaderboards", {
      query: {
        season: 1,
        country: null,
        competition_type: null,
        position: null,
        limit: 50,
      },
    });
  });

  it("reloads global player leaderboards when filters change", async () => {
    vi.mocked(invoke).mockResolvedValue(globalLeaderboardResponse());

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^Global$/i }));
    await screen.findByText("John Smith");
    fireEvent.change(screen.getByLabelText("Competition type"), { target: { value: "DomesticCup" } });
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "Forward" } });

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_global_player_leaderboards", {
      query: {
        season: 1,
        country: null,
        competition_type: "DomesticCup",
        position: "Forward",
        limit: 50,
      },
    });
  });

  it("opens the Global leaderboard from the competition leaderboards panel", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_competition_leaderboards") {
        return Promise.resolve({
          competition_id: "league-1",
          season: 1,
          top_scorers: [],
          top_assists: [],
          top_clean_sheets: [],
        });
      }
      return Promise.resolve(globalLeaderboardResponse());
    });

    render(<TournamentsTab gameState={createGameState(true)} onSelectTeam={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /leaderboardsTab/i }));
    fireEvent.click(await screen.findByRole("button", { name: "View Global Leaderboard" }));

    expect(await screen.findByText("John Smith")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_global_player_leaderboards", expect.any(Object));
  });

  it("shows retired legends on the hall of fame tab sorted by peak ovr", () => {
    const gameState = createGameState(true);
    gameState.retired_players = [
      {
        id: "legend-low",
        full_name: "Older Journeyman",
        nationality: "GB",
        position: "Defender",
        last_team_id: "team-2",
        last_team_name: "Beta FC",
        retired_season: 5,
        age_at_retirement: 35,
        peak_ovr: 71,
        total_appearances: 300,
        total_goals: 8,
        total_assists: 20,
        career_seasons: 15,
      },
      {
        id: "legend-high",
        full_name: "Star Striker",
        nationality: "GB",
        position: "Forward",
        last_team_id: "team-1",
        last_team_name: "Alpha FC",
        retired_season: 6,
        age_at_retirement: 37,
        peak_ovr: 92,
        total_appearances: 500,
        total_goals: 410,
        total_assists: 120,
        career_seasons: 18,
      },
      {
        id: "random-zero",
        full_name: "Random Reserve",
        nationality: "GB",
        position: "Midfielder",
        last_team_id: "team-1",
        last_team_name: "Alpha FC",
        retired_season: 6,
        age_at_retirement: 36,
        peak_ovr: 80,
        total_appearances: 0,
        total_goals: 0,
        total_assists: 0,
        career_seasons: 0,
      },
    ];
    const onSelectTeam = vi.fn();

    render(<TournamentsTab gameState={gameState} onSelectTeam={onSelectTeam} />);

    fireEvent.click(screen.getByRole("button", { name: /hallOfFameTab/i }));

    // Both legends render; the higher peak OVR appears first.
    const star = screen.getByText("Star Striker");
    const journeyman = screen.getByText("Older Journeyman");
    expect(star).toBeInTheDocument();
    expect(journeyman).toBeInTheDocument();
    expect(screen.queryByText("Random Reserve")).not.toBeInTheDocument();
    expect(star.compareDocumentPosition(journeyman) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("92")).toBeInTheDocument();

    // Clicking the last-team link in the legend's card navigates to that team.
    const starCard = star.closest("div")!;
    fireEvent.click(within(starCard).getByRole("button", { name: "Alpha FC" }));
    expect(onSelectTeam).toHaveBeenCalledWith("team-1");
  });
});
