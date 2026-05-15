import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("renders team name and date", () => {
    render(
      <Topbar
        teamName="Test FC"
        gameDate="15 May 2026"
        financeDisplay="£12,345,000"
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText("Test FC")).toBeInTheDocument();
    expect(screen.getByText("15 May 2026")).toBeInTheDocument();
    expect(screen.getByText("£12,345,000")).toBeInTheDocument();
  });

  it("renders Continue button when onContinue provided", () => {
    render(
      <Topbar
        teamName="Test FC"
        gameDate="15 May 2026"
        financeDisplay="£0"
        onContinue={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("omits Continue button when onContinue is not provided", () => {
    render(
      <Topbar teamName="Test FC" gameDate="15 May 2026" financeDisplay="£0" />,
    );
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });
});
