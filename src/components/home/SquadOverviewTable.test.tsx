import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SquadOverviewTable, type SquadOverviewPlayer } from "./SquadOverviewTable";

const PLAYERS: SquadOverviewPlayer[] = [
  {
    id: "p1",
    position: "GK",
    number: 1,
    matchName: "G. Donnarumma",
    age: 31,
    nationality: "ITA",
    condition: 92,
    morale: 100,
    appearances: 41,
    goals: 0,
    assists: 0,
    avgRating: 7.12,
  },
  {
    id: "p2",
    position: "RB",
    number: 2,
    matchName: "K. Walker",
    age: 30,
    nationality: "ENG",
    condition: 87,
    morale: 91,
    appearances: 37,
    goals: 1,
    assists: 5,
    avgRating: 6.89,
  },
];

describe("SquadOverviewTable", () => {
  it("renders one row per player", () => {
    render(
      <SquadOverviewTable
        players={PLAYERS}
        activeTab="overview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByText("G. Donnarumma")).toBeInTheDocument();
    expect(screen.getByText("K. Walker")).toBeInTheDocument();
  });

  it("renders position pills for each player", () => {
    render(
      <SquadOverviewTable
        players={PLAYERS}
        activeTab="overview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByText("GK")).toBeInTheDocument();
    expect(screen.getByText("RB")).toBeInTheDocument();
  });

  it("color-grades AV-RAT cells via ratingClass", () => {
    const { container } = render(
      <SquadOverviewTable
        players={PLAYERS}
        activeTab="overview"
        onTabChange={vi.fn()}
      />,
    );
    // 7.12 → 71.2 → good band
    const ratingCells = container.querySelectorAll("[data-cell='avgRating']");
    expect(ratingCells.length).toBe(2);
    expect(ratingCells[0].className).toContain("rating-cell");
  });

  it("invokes onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(
      <SquadOverviewTable
        players={PLAYERS}
        activeTab="overview"
        onTabChange={onTabChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /stats/i }));
    expect(onTabChange).toHaveBeenCalledWith("stats");
  });
});
