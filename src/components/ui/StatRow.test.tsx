import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatRow, StatCell } from "./StatRow";

describe("StatRow", () => {
  it("renders children", () => {
    render(
      <StatRow>
        <StatCell>Player Name</StatCell>
        <StatCell numeric>42</StatCell>
      </StatRow>,
    );
    expect(screen.getByText("Player Name")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("applies font-stat to numeric cells", () => {
    render(
      <StatRow>
        <StatCell numeric data-testid="num">99</StatCell>
      </StatRow>,
    );
    expect(screen.getByTestId("num").className).toContain("font-stat");
  });

  it("does not apply font-stat to non-numeric cells", () => {
    render(
      <StatRow>
        <StatCell data-testid="text">Player Name</StatCell>
      </StatRow>,
    );
    expect(screen.getByTestId("text").className).not.toContain("font-stat");
  });
});
