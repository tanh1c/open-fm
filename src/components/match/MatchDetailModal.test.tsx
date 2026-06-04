import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MatchDetailModal from "./MatchDetailModal";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const detail = {
  fixtureId: "fixture-1",
  date: "2026-08-01",
  competition: "Premier League",
  matchday: 1,
  stage: null,
  leg: null,
  homeTeamId: "team-1",
  homeTeamName: "Alpha FC",
  awayTeamId: "team-2",
  awayTeamName: "Beta FC",
  homeGoals: 2,
  awayGoals: 1,
  resolution: null,
  homePenalties: null,
  awayPenalties: null,
  totalMinutes: 90,
  events: [
    {
      minute: 14,
      eventType: "Goal",
      side: "Home",
      playerId: "player-1",
      playerName: "John Smith",
      secondaryPlayerId: null,
      secondaryPlayerName: null,
    },
  ],
  homeStats: {
    teamId: "team-1",
    teamName: "Alpha FC",
    possessionPct: 58,
    shots: 14,
    shotsOnTarget: 6,
    passesCompleted: 410,
    passesAttempted: 500,
    tacklesWon: 18,
    interceptions: 9,
    fouls: 8,
    corners: 5,
    yellowCards: 1,
    redCards: 0,
  },
  awayStats: {
    teamId: "team-2",
    teamName: "Beta FC",
    possessionPct: 42,
    shots: 8,
    shotsOnTarget: 3,
    passesCompleted: 300,
    passesAttempted: 390,
    tacklesWon: 15,
    interceptions: 7,
    fouls: 10,
    corners: 2,
    yellowCards: 2,
    redCards: 0,
  },
  playerStats: [
    {
      playerId: "player-1",
      playerName: "John Smith",
      teamId: "team-1",
      teamName: "Alpha FC",
      side: "Home",
      minutesPlayed: 90,
      goals: 1,
      assists: 0,
      shots: 4,
      shotsOnTarget: 2,
      passesCompleted: 30,
      passesAttempted: 36,
      tacklesWon: 1,
      interceptions: 0,
      foulsCommitted: 1,
      yellowCards: 0,
      redCards: 0,
      rating: 8.1,
    },
  ],
};

describe("MatchDetailModal", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("loads and renders the saved match detail", async () => {
    vi.mocked(invoke).mockResolvedValue(detail);

    render(<MatchDetailModal fixtureId="fixture-1" onClose={vi.fn()} />);

    expect(invoke).toHaveBeenCalledWith("get_match_detail", { fixtureId: "fixture-1" });
    expect(await screen.findByText("Full Time")).toBeInTheDocument();
    expect(screen.getAllByText("Alpha FC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta FC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/John Smith/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Goal").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Team Stats" }));
    expect((await screen.findAllByText("58%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("14").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Player Stats" }));
    expect((await screen.findAllByText("8.1")).length).toBeGreaterThan(0);
  });

  it("shows an empty state when no detail is available", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    render(<MatchDetailModal fixtureId="fixture-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No match detail is available for this fixture.")).toBeInTheDocument();
    });
  });
});
