import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalsAnalysisCard } from "./GoalsAnalysisCard";

describe("GoalsAnalysisCard", () => {
  const segments = [
    { kind: "open_play" as const, count: 32 },
    { kind: "set_piece" as const, count: 12 },
    { kind: "counter" as const, count: 8 },
    { kind: "penalty" as const, count: 4 },
  ];

  it("renders the total goal count", () => {
    render(<GoalsAnalysisCard segments={segments} />);
    expect(screen.getByText("56")).toBeInTheDocument();
  });

  it("renders each segment with its count", () => {
    const { container } = render(<GoalsAnalysisCard segments={segments} />);
    const text = container.textContent ?? "";
    expect(text).toContain("32");
    expect(text).toContain("12");
    expect(text).toContain("8");
    expect(text).toContain("4");
  });

  it("renders the donut SVG with one path per segment", () => {
    const { container } = render(<GoalsAnalysisCard segments={segments} />);
    const arcs = container.querySelectorAll("path[data-segment]");
    expect(arcs).toHaveLength(segments.length);
  });

  it("renders zero-state when there are no goals", () => {
    render(<GoalsAnalysisCard segments={[]} />);
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });
});
