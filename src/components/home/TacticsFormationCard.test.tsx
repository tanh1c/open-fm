import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TacticsFormationCard } from "./TacticsFormationCard";

const sampleProps = {
  formation: "4-2-3-1 WIDE",
  tacticalStyle: "Balanced",
  players: [
    { id: "gk", name: "G. Donnarumma", number: 1, role: "SK - De", x: 50, y: 90 },
    { id: "lb", name: "N. Mendes", number: 3, role: "WB - Su", x: 18, y: 70 },
    { id: "lcb", name: "A. Bastoni", number: 4, role: "BPD - De", x: 38, y: 70 },
    { id: "rcb", name: "R. Dias", number: 15, role: "BPD - De", x: 62, y: 70 },
    { id: "rb", name: "K. Walker", number: 2, role: "WB - Su", x: 82, y: 70 },
    { id: "ldm", name: "R. Neves", number: 6, role: "DLP - De", x: 38, y: 50 },
    { id: "rdm", name: "M. Caicedo", number: 23, role: "BBM - Su", x: 62, y: 50 },
    { id: "lw", name: "J. Silva", number: 10, role: "IF - Su", x: 18, y: 30 },
    { id: "am", name: "E. Odegaard", number: 8, role: "AM - At", x: 50, y: 30 },
    { id: "rw", name: "M. Salah", number: 11, role: "IF - At", x: 82, y: 30 },
    { id: "st", name: "H. Kane", number: 9, role: "PF - At", x: 50, y: 12 },
  ],
  instructions: {
    teamInstructions: ["Play Out Of Defense", "Work Ball Into Box", "Higher Tempo"],
    inPossession: "Fairly Wide",
    inTransition: "Counter",
    outOfPossession: "Mid Block",
  },
};

describe("TacticsFormationCard", () => {
  it("renders the formation label", () => {
    const { container } = render(<TacticsFormationCard {...sampleProps} />);
    expect(container.textContent).toContain("4-2-3-1 WIDE");
  });

  it("renders the tactical style label", () => {
    render(<TacticsFormationCard {...sampleProps} />);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });

  it("renders one jersey per player", () => {
    const { container } = render(<TacticsFormationCard {...sampleProps} />);
    const jerseys = container.querySelectorAll("[data-jersey]");
    expect(jerseys).toHaveLength(sampleProps.players.length);
  });

  it("renders all team instruction phrases", () => {
    render(<TacticsFormationCard {...sampleProps} />);
    sampleProps.instructions.teamInstructions.forEach((phrase) => {
      expect(screen.getByText(phrase)).toBeInTheDocument();
    });
  });

  it("renders in/out of possession + transition labels", () => {
    render(<TacticsFormationCard {...sampleProps} />);
    expect(screen.getByText("Fairly Wide")).toBeInTheDocument();
    expect(screen.getByText("Counter")).toBeInTheDocument();
    expect(screen.getByText("Mid Block")).toBeInTheDocument();
  });
});
