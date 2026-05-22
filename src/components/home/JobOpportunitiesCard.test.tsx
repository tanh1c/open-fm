import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import JobOpportunitiesCard from "./JobOpportunitiesCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "jobs.opportunitiesTitle") return "Job Opportunities";
      if (key === "jobs.applyButton") return "Apply";
      if (key === "jobs.applicationSent") return "Applying...";
      if (key === "jobs.hired") return "You have been appointed manager!";
      if (key === "jobs.rejected") return "Your application was unsuccessful.";
      if (key === "jobs.noJobs") return "No positions currently available.";
      if (key === "jobs.refresh") return "Check for new positions";
      if (key === "jobs.leaguePosition")
        return `Last Season: ${params?.position}`;
      return key;
    },
  }),
}));

const { getAvailableJobsMock, applyForJobMock } = vi.hoisted(() => ({
  getAvailableJobsMock: vi.fn(),
  applyForJobMock: vi.fn(),
}));

vi.mock("../../services/jobService", () => ({
  getAvailableJobs: (...args: unknown[]) => getAvailableJobsMock(...args),
  applyForJob: (...args: unknown[]) => applyForJobMock(...args),
}));

function createGameState(): GameStateData {
  return {
    clock: { current_date: "2026-11-01", start_date: "2026-07-01" },
    manager: {
      id: "mgr1",
      first_name: "Alex",
      last_name: "Boss",
      date_of_birth: "1980-01-01",
      nationality: "England",
      reputation: 500,
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
    teams: [],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  } as unknown as GameStateData;
}

describe("JobOpportunitiesCard", () => {
  beforeEach(() => {
    getAvailableJobsMock.mockReset();
    applyForJobMock.mockReset();
  });

  it("shows the loading spinner before jobs resolve", () => {
    getAvailableJobsMock.mockReturnValue(new Promise(() => {}));

    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Job Opportunities")).toBeInTheDocument();
    // Spinner is visible (no empty-state text, no job rows)
    expect(
      screen.queryByText("No positions currently available."),
    ).not.toBeInTheDocument();
  });

  it("renders the empty state when no jobs are returned", async () => {
    getAvailableJobsMock.mockResolvedValue([]);

    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("No positions currently available."),
    ).toBeInTheDocument();
  });

  it("renders returned jobs with team name, city and last league position", async () => {
    getAvailableJobsMock.mockResolvedValue([
      {
        team_id: "team2",
        team_name: "New FC",
        city: "Newville",
        reputation: 480,
        last_league_position: 7,
      },
    ]);

    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(await screen.findByText("New FC")).toBeInTheDocument();
    expect(screen.getByText("Newville")).toBeInTheDocument();
    expect(screen.getByText("Last Season: 7")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply" }),
    ).toBeInTheDocument();
  });

  it("shows a success message and propagates updated game state on hire", async () => {
    const hiredGame = createGameState();
    hiredGame.manager.team_id = "team2";
    getAvailableJobsMock.mockResolvedValue([
      {
        team_id: "team2",
        team_name: "New FC",
        city: "Newville",
        reputation: 480,
        last_league_position: 7,
      },
    ]);
    applyForJobMock.mockResolvedValue({ result: "hired", game: hiredGame });

    const onGameUpdate = vi.fn();
    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={onGameUpdate}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("You have been appointed manager!"),
    ).toBeInTheDocument();
    expect(applyForJobMock).toHaveBeenCalledWith("team2");
    expect(onGameUpdate).toHaveBeenCalledWith(hiredGame);
  });

  it("shows a failure message and refreshes jobs when rejected", async () => {
    getAvailableJobsMock
      .mockResolvedValueOnce([
        {
          team_id: "team2",
          team_name: "New FC",
          city: "Newville",
          reputation: 480,
          last_league_position: 7,
        },
      ])
      .mockResolvedValueOnce([]);
    applyForJobMock.mockResolvedValue({
      result: "rejected",
      game: createGameState(),
    });

    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("Your application was unsuccessful."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(getAvailableJobsMock).toHaveBeenCalledTimes(2),
    );
  });

  it("refreshes the list when the refresh button is clicked", async () => {
    getAvailableJobsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          team_id: "team3",
          team_name: "Refreshed FC",
          city: "Elsewhere",
          reputation: 500,
          last_league_position: null,
        },
      ]);

    render(
      <JobOpportunitiesCard
        gameState={createGameState()}
        onGameUpdate={vi.fn()}
      />,
    );

    await screen.findByText("No positions currently available.");

    fireEvent.click(
      screen.getByRole("button", { name: "Check for new positions" }),
    );

    expect(await screen.findByText("Refreshed FC")).toBeInTheDocument();
  });
});
