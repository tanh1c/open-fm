import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormChartCard } from "./FormChartCard";

describe("FormChartCard", () => {
  const sample = {
    results: ["W", "W", "D", "W", "L", "W"] as Array<"W" | "D" | "L">,
    totals: { won: 14, drawn: 4, lost: 2 },
    pointsPerGame: 2.05,
  };

  it("renders summary totals", () => {
    render(<FormChartCard {...sample} />);
    expect(screen.getByText("14")).toBeInTheDocument(); // won
    expect(screen.getByText("4")).toBeInTheDocument(); // drawn
    expect(screen.getByText("2")).toBeInTheDocument(); // lost
  });

  it("renders points per game", () => {
    render(<FormChartCard {...sample} />);
    expect(screen.getByText(/2\.05/)).toBeInTheDocument();
  });

  it("renders one polyline point per result", () => {
    const { container } = render(<FormChartCard {...sample} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(sample.results.length);
  });

  it("renders nothing-special placeholder when results empty", () => {
    render(
      <FormChartCard
        results={[]}
        totals={{ won: 0, drawn: 0, lost: 0 }}
        pointsPerGame={0}
      />,
    );
    expect(screen.getByText(/no recent/i)).toBeInTheDocument();
  });
});
