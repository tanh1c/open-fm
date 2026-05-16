import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TemplateTactics } from "./TemplateTactics";

describe("TemplateTactics", () => {
  it("renders the copied template tactics card and div-based pitch", () => {
    render(
      <TemplateTactics
        formation="4-4-2"
        tacticalStyle="Balanced"
        players={[{ id: "player-1", name: "J. Smith", number: 9, role: "AF - At", x: 25, y: 50 }]}
        instructions={{
          teamInstructions: ["Play Out Of Defense"],
          inPossession: "Fairly Wide",
          inTransition: "Counter",
          outOfPossession: "Mid Block",
        }}
      />,
    );

    expect(screen.getByText("Tactics • 4-4-2")).toHaveClass("uppercase", "tracking-widest");
    expect(screen.getByTestId("template-tactics-pitch")).toHaveClass(
      "bg-surface-800",
      "border-primary-700/50",
      "rounded-xl",
    );
    expect(screen.getByText("TACTICAL STYLE")).toBeInTheDocument();
    expect(screen.getByText("J. Smith")).toBeInTheDocument();
    expect(screen.getByText("Play Out Of Defense")).toBeInTheDocument();
  });
});
