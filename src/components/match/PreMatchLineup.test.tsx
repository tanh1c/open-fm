import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { parseFormationNeeds, condColor, statColor, starterOvrColor, starterBadgeStyle, getStatVal, sortBenchByPosition, resolveStarterSlotIds, POSITION_KEY_STATS } from "./PreMatchLineup";
import PreMatchLineup from "./PreMatchLineup";
import type { EnginePlayerData, EngineTeamData } from "./types";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) => {
      if (typeof arg === "string") {
        return arg;
      }

      if (
        typeof arg === "object" &&
        arg !== null &&
        "count" in arg &&
        typeof (arg as Record<string, unknown>).count !== "undefined"
      ) {
        return `${key}:${String((arg as Record<string, unknown>).count)}`;
      }

      if (key === "match.selectForSwap") {
        return "Select for swap";
      }

      if (key === "match.swapWithSelectedStarter") {
        return "Swap with selected starter";
      }

      return key;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Minimal fixture
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<EnginePlayerData> = {}): EnginePlayerData => ({
  id: "p1",
  name: "Test Player",
  position: "Midfielder",
  ovr: 70,
  condition: 100,
  pace: 70, stamina: 70, strength: 70, agility: 70,
  passing: 70, shooting: 70, tackling: 70, dribbling: 70,
  defending: 70, positioning: 70, vision: 70, decisions: 70,
  composure: 70, aggression: 50, teamwork: 70,
  leadership: 50, handling: 70, reflexes: 70, aerial: 70,
  traits: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// parseFormationNeeds
// ---------------------------------------------------------------------------

describe("parseFormationNeeds", () => {
  it("parses standard 3-part formations", () => {
    expect(parseFormationNeeds("4-4-2")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 4, Forward: 2 });
    expect(parseFormationNeeds("4-3-3")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 3, Forward: 3 });
    expect(parseFormationNeeds("3-5-2")).toEqual({ Goalkeeper: 1, Defender: 3, Midfielder: 5, Forward: 2 });
  });

  it("parses 4-part formations (always 1 GK, mid = sum of middle parts)", () => {
    expect(parseFormationNeeds("4-2-3-1")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 5, Forward: 1 });
    expect(parseFormationNeeds("4-1-4-1")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 5, Forward: 1 });
    expect(parseFormationNeeds("3-4-1-2")).toEqual({ Goalkeeper: 1, Defender: 3, Midfielder: 5, Forward: 2 });
    expect(parseFormationNeeds("4-3-2-1")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 5, Forward: 1 });
  });

  it("returns default 4-4-2 for unparsable input", () => {
    expect(parseFormationNeeds("invalid")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 4, Forward: 2 });
    expect(parseFormationNeeds("")).toEqual({ Goalkeeper: 1, Defender: 4, Midfielder: 4, Forward: 2 });
  });
});

// ---------------------------------------------------------------------------
// condColor
// ---------------------------------------------------------------------------

describe("condColor", () => {
  it("returns primary for high condition (>= 75)", () => {
    expect(condColor(75)).toBe("text-primary-400");
    expect(condColor(100)).toBe("text-primary-400");
  });

  it("returns amber for medium condition (50-74)", () => {
    expect(condColor(50)).toBe("text-amber-400");
    expect(condColor(74)).toBe("text-amber-400");
  });

  it("returns red for low condition (< 50)", () => {
    expect(condColor(49)).toBe("text-red-400");
    expect(condColor(0)).toBe("text-red-400");
  });
});

// ---------------------------------------------------------------------------
// statColor
// ---------------------------------------------------------------------------

describe("statColor", () => {
  it("returns primary + bold for high stats (>= 75)", () => {
    expect(statColor(75)).toBe("text-primary-500 dark:text-primary-400 font-bold");
    expect(statColor(99)).toBe("text-primary-500 dark:text-primary-400 font-bold");
  });

  it("returns theme-safe neutral for medium stats (60-74)", () => {
    expect(statColor(60)).toBe("text-gray-700 dark:text-gray-200");
    expect(statColor(74)).toBe("text-gray-700 dark:text-gray-200");
  });

  it("returns subdued but readable neutral for low stats (< 60)", () => {
    expect(statColor(59)).toBe("text-gray-500 dark:text-gray-400");
    expect(statColor(0)).toBe("text-gray-500 dark:text-gray-400");
  });
});

describe("starterOvrColor", () => {
  it("uses theme-safe colors for each OVR tier", () => {
    expect(starterOvrColor(72)).toBe("text-primary-600 dark:text-primary-400");
    expect(starterOvrColor(58)).toBe("text-gray-700 dark:text-gray-300");
    expect(starterOvrColor(44)).toBe("text-red-600 dark:text-red-400");
  });
});

describe("starterBadgeStyle", () => {
  it("keeps dark team colors as the badge accent", () => {
    expect(starterBadgeStyle("#008866")).toEqual({
      backgroundColor: "#00886630",
      color: "#008866",
      borderColor: "#00886655",
      borderWidth: 1,
      borderStyle: "solid",
    });
  });

  it("normalizes 3-digit hex colors before applying alpha variants", () => {
    expect(starterBadgeStyle("#123")).toEqual({
      backgroundColor: "#11223330",
      color: "#112233",
      borderColor: "#11223355",
      borderWidth: 1,
      borderStyle: "solid",
    });
  });

  it("falls back to a readable neutral badge for very light team colors", () => {
    expect(starterBadgeStyle("#ffffff")).toEqual({
      backgroundColor: "#f8fafc",
      color: "#334155",
      borderColor: "#cbd5e1",
      borderWidth: 1,
      borderStyle: "solid",
    });
  });
});

// ---------------------------------------------------------------------------
// getStatVal
// ---------------------------------------------------------------------------

describe("getStatVal", () => {
  const player = makePlayer({ pace: 85, shooting: 72 });

  it("returns the attribute value for a valid key", () => {
    expect(getStatVal(player, "pace")).toBe(85);
    expect(getStatVal(player, "shooting")).toBe(72);
  });

  it("returns 0 for a non-existent key", () => {
    expect(getStatVal(player, "nonexistent")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sortBenchByPosition
// ---------------------------------------------------------------------------

describe("sortBenchByPosition", () => {
  it("orders bench left-to-right Forward, Midfielder, Defender, Goalkeeper", () => {
    const bench = [
      makePlayer({ id: "gk", position: "Goalkeeper", ovr: 70 }),
      makePlayer({ id: "def", position: "Defender", ovr: 70 }),
      makePlayer({ id: "fwd", position: "Forward", ovr: 70 }),
      makePlayer({ id: "mid", position: "Midfielder", ovr: 70 }),
    ];

    expect(sortBenchByPosition(bench).map((player) => player.id)).toEqual([
      "fwd",
      "mid",
      "def",
      "gk",
    ]);
  });

  it("breaks ties within a position by descending OVR", () => {
    const bench = [
      makePlayer({ id: "mid-low", position: "Midfielder", ovr: 60 }),
      makePlayer({ id: "mid-high", position: "Midfielder", ovr: 80 }),
    ];

    expect(sortBenchByPosition(bench).map((player) => player.id)).toEqual([
      "mid-high",
      "mid-low",
    ]);
  });

  it("does not mutate the input array", () => {
    const bench = [
      makePlayer({ id: "gk", position: "Goalkeeper" }),
      makePlayer({ id: "fwd", position: "Forward" }),
    ];
    const original = bench.map((player) => player.id);

    sortBenchByPosition(bench);

    expect(bench.map((player) => player.id)).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// POSITION_KEY_STATS
// ---------------------------------------------------------------------------

describe("POSITION_KEY_STATS", () => {
  it("has entries for all four positions", () => {
    expect(Object.keys(POSITION_KEY_STATS)).toEqual(["Goalkeeper", "Defender", "Midfielder", "Forward"]);
  });

  it("each position has 3 stat entries with label and key", () => {
    for (const pos of Object.keys(POSITION_KEY_STATS)) {
      expect(POSITION_KEY_STATS[pos]).toHaveLength(3);
      for (const stat of POSITION_KEY_STATS[pos]) {
        expect(stat).toHaveProperty("label");
        expect(stat).toHaveProperty("key");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// resolveStarterSlotIds
// ---------------------------------------------------------------------------

describe("resolveStarterSlotIds", () => {
  it("falls back to the formation preset when no custom slots exist", () => {
    expect(resolveStarterSlotIds("4-4-2", undefined)).toEqual([
      "gk", "lb", "lcb", "rcb", "rb", "lm", "lcm", "rcm", "rm", "ls", "rs",
    ]);
  });

  it("uses the custom tactic shape when all 11 slots are occupied", () => {
    const customSlots = [
      { slot_id: "gk", player_id: "p1", role: "GK" as const, x: 50, y: 91 },
      { slot_id: "lb", player_id: "p2", role: "DEF" as const, x: 18, y: 72 },
      { slot_id: "lcb", player_id: "p3", role: "DEF" as const, x: 34, y: 72 },
      { slot_id: "rcb", player_id: "p4", role: "DEF" as const, x: 66, y: 72 },
      { slot_id: "rb", player_id: "p5", role: "DEF" as const, x: 82, y: 72 },
      { slot_id: "dm", player_id: "p6", role: "DM" as const, x: 50, y: 59 },
      { slot_id: "lw", player_id: "p7", role: "FWD" as const, x: 18, y: 28 },
      { slot_id: "lam", player_id: "p8", role: "AM" as const, x: 36, y: 31 },
      { slot_id: "am", player_id: "p9", role: "AM" as const, x: 50, y: 30 },
      { slot_id: "ram", player_id: "p10", role: "AM" as const, x: 64, y: 31 },
      { slot_id: "rw", player_id: "p11", role: "FWD" as const, x: 82, y: 28 },
    ];

    // A hand-built 4-1-5 shape — must be returned in canonical grid order, not
    // the formation preset.
    expect(resolveStarterSlotIds("4-4-2", customSlots)).toEqual([
      "gk", "lb", "lcb", "rcb", "rb", "dm", "lw", "lam", "am", "ram", "rw",
    ]);
  });

  it("ignores incomplete custom slots and uses the formation preset", () => {
    const customSlots = [
      { slot_id: "gk", player_id: "p1", role: "GK" as const, x: 50, y: 91 },
      { slot_id: "lb", player_id: null, role: "DEF" as const, x: 18, y: 72 },
    ];

    expect(resolveStarterSlotIds("4-3-3", customSlots)).toEqual(
      resolveStarterSlotIds("4-3-3", undefined),
    );
  });
});

// ---------------------------------------------------------------------------
// PreMatchLineup component
// ---------------------------------------------------------------------------

const makeTeam = (overrides: Partial<EngineTeamData> = {}): EngineTeamData => ({
  id: "team1",
  name: "Test FC",
  formation: "4-4-2",
  play_style: "Balanced",
  players: [
    makePlayer({ id: "gk1", name: "GK One", position: "Goalkeeper", handling: 80, reflexes: 80, aerial: 60, positioning: 70, composure: 65 }),
    makePlayer({ id: "d1", name: "Def One", position: "Defender" }),
    makePlayer({ id: "m1", name: "Mid One", position: "Midfielder" }),
    makePlayer({ id: "f1", name: "Fwd One", position: "Forward", shooting: 85, pace: 80 }),
  ],
  ...overrides,
});

const defaultProps = {
  userTeam: makeTeam(),
  userBench: [makePlayer({ id: "b1", name: "Bench One", position: "Midfielder", condition: 90 })],
  oppTeam: makeTeam({ id: "opp", name: "Rival United", formation: "3-5-2", play_style: "Counter" }),
  userColor: "#00ff00",
  homeTeamColor: "#ff0000",
  awayTeamColor: "#0000ff",
  userSide: "Home" as const,
  formationNeeds: { Goalkeeper: 1, Defender: 4, Midfielder: 4, Forward: 2 },
  selectedStarterId: null as string | null,
  isAutoSelecting: false,
  onSelectStarter: vi.fn(),
  onSwap: vi.fn(),
  onAutoSelect: vi.fn(),
};

describe("PreMatchLineup component", () => {
  it("renders starting XI header and player names", () => {
    render(<PreMatchLineup {...defaultProps} />);
    expect(screen.getByText("match.startingXI")).toBeInTheDocument();
    expect(screen.getByText("GK One")).toBeInTheDocument();
    expect(screen.getByText("Def One")).toBeInTheDocument();
    expect(screen.getByText("Mid One")).toBeInTheDocument();
    expect(screen.getByText("Fwd One")).toBeInTheDocument();
  });

  it("renders bench section with substitutes", () => {
    render(<PreMatchLineup {...defaultProps} />);
    expect(screen.getByText("match.substitutes")).toBeInTheDocument();
    expect(screen.getByText("Bench One")).toBeInTheDocument();
  });

  it("renders opponent info", () => {
    render(<PreMatchLineup {...defaultProps} />);
    expect(screen.getByText("match.opponent")).toBeInTheDocument();
    expect(screen.getByText("Rival United")).toBeInTheDocument();
    expect(screen.getByText("3-5-2 · Counter")).toBeInTheDocument();
  });

  it("renders auto-select button and calls onAutoSelect", () => {
    const onAutoSelect = vi.fn();
    render(<PreMatchLineup {...defaultProps} onAutoSelect={onAutoSelect} />);
    const autoBtn = screen.getByText("match.autoSelectXI");
    expect(autoBtn).toBeInTheDocument();
    fireEvent.click(autoBtn.closest("button")!);
    expect(onAutoSelect).toHaveBeenCalledOnce();
  });

  it("shows 'selecting' text when isAutoSelecting is true", () => {
    render(<PreMatchLineup {...defaultProps} isAutoSelecting={true} />);
    expect(screen.getByText("match.selecting")).toBeInTheDocument();
  });

  it("calls onSelectStarter when a starter is clicked", () => {
    const onSelectStarter = vi.fn();
    render(<PreMatchLineup {...defaultProps} onSelectStarter={onSelectStarter} />);
    fireEvent.click(screen.getByText("Mid One"));
    expect(onSelectStarter).toHaveBeenCalledWith("m1");
  });

  it("offers a context menu action to select a starter for swapping", () => {
    const onSelectStarter = vi.fn();

    render(<PreMatchLineup {...defaultProps} onSelectStarter={onSelectStarter} />);

    fireEvent.contextMenu(screen.getByTestId("pre-match-starter-m1"));
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("button", {
        name: "Select for swap",
      }),
    );

    expect(onSelectStarter).toHaveBeenCalledWith("m1");
  });

  it("shows swap prompt when a starter is selected", () => {
    render(<PreMatchLineup {...defaultProps} selectedStarterId="m1" />);
    expect(screen.getByText("match.swapPrompt")).toBeInTheDocument();
    expect(screen.getByText("match.cancel")).toBeInTheDocument();
  });

  it("offers a context menu action to clear the selected starter", () => {
    const onSelectStarter = vi.fn();

    render(
      <PreMatchLineup
        {...defaultProps}
        selectedStarterId="m1"
        onSelectStarter={onSelectStarter}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("pre-match-starter-m1"));
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("button", {
        name: "match.cancel",
      }),
    );

    expect(onSelectStarter).toHaveBeenCalledWith(null);
  });

  it("calls onSwap when bench player is clicked while a starter is selected", () => {
    const onSwap = vi.fn();
    render(<PreMatchLineup {...defaultProps} selectedStarterId="m1" onSwap={onSwap} />);
    fireEvent.click(screen.getByText("Bench One"));
    expect(onSwap).toHaveBeenCalledWith("b1");
  });

  it("calls onSwap with the dropped bench player and target starter ids", () => {
    const onSelectStarter = vi.fn();
    const onSwap = vi.fn();

    render(
      <PreMatchLineup
        {...defaultProps}
        onSelectStarter={onSelectStarter}
        onSwap={onSwap}
      />,
    );

    const dataTransfer = {
      dropEffect: "move",
      effectAllowed: "move",
      getData: vi.fn(() => "b1"),
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByTestId("pre-match-bench-b1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("pre-match-slot-lcb"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("pre-match-slot-lcb"), { dataTransfer });

    expect(onSelectStarter).toHaveBeenCalledWith("m1");
    expect(onSwap).toHaveBeenCalledWith("b1", "m1");
  });

  it("keeps the drop target tied to the exact player in the hovered same-row slot", () => {
    const onSelectStarter = vi.fn();
    const onSwap = vi.fn();
    const twoForwardTeam = makeTeam({
      players: [
        makePlayer({ id: "gk1", name: "GK One", position: "Goalkeeper" }),
        makePlayer({ id: "d1", name: "Def One", position: "Defender" }),
        makePlayer({ id: "d2", name: "Def Two", position: "Defender" }),
        makePlayer({ id: "d3", name: "Def Three", position: "Defender" }),
        makePlayer({ id: "d4", name: "Def Four", position: "Defender" }),
        makePlayer({ id: "m1", name: "Mid One", position: "Midfielder" }),
        makePlayer({ id: "m2", name: "Mid Two", position: "Midfielder" }),
        makePlayer({ id: "m3", name: "Mid Three", position: "Midfielder" }),
        makePlayer({ id: "m4", name: "Mid Four", position: "Midfielder" }),
        makePlayer({ id: "f-left", name: "Left Striker", position: "Forward" }),
        makePlayer({ id: "f-right", name: "Right Striker", position: "Forward" }),
      ],
    });

    render(
      <PreMatchLineup
        {...defaultProps}
        userTeam={twoForwardTeam}
        onSelectStarter={onSelectStarter}
        onSwap={onSwap}
      />,
    );

    const dataTransfer = {
      dropEffect: "move",
      effectAllowed: "move",
      getData: vi.fn(() => "b1"),
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByTestId("pre-match-bench-b1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("pre-match-starter-f-left"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("pre-match-starter-f-left"), { dataTransfer });

    expect(onSelectStarter).toHaveBeenCalledWith("f-left");
    expect(onSwap).toHaveBeenCalledWith("b1", "f-left");
  });

  it("does not treat a dragged starter as a bench swap", () => {
    const onSelectStarter = vi.fn();
    const onSwap = vi.fn();

    render(
      <PreMatchLineup
        {...defaultProps}
        onSelectStarter={onSelectStarter}
        onSwap={onSwap}
      />,
    );

    const dataTransfer = {
      dropEffect: "move",
      effectAllowed: "move",
      getData: vi.fn(() => "m1"),
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByTestId("pre-match-starter-m1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("pre-match-starter-d1"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("pre-match-starter-d1"), { dataTransfer });

    expect(onSelectStarter).not.toHaveBeenCalled();
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("lets a starter be dragged into an empty grid slot locally without calling the backend", () => {
    const onSwap = vi.fn();

    render(<PreMatchLineup {...defaultProps} onSwap={onSwap} />);

    // The 4-4-2 preset leaves the "st" slot empty; dragging a starter there
    // should move them locally (no PreMatchSwap to the backend).
    expect(screen.queryByTestId("pre-match-starter-f1")).toBeInTheDocument();

    const dataTransfer = {
      dropEffect: "move",
      effectAllowed: "move",
      getData: vi.fn(() => "f1"),
      setData: vi.fn(),
    };

    fireEvent.dragStart(screen.getByTestId("pre-match-starter-f1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("pre-match-slot-st"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("pre-match-slot-st"), { dataTransfer });

    // No backend swap; the move stayed local.
    expect(onSwap).not.toHaveBeenCalled();
    // Player still rendered, now occupying the target slot.
    expect(screen.getByTestId("pre-match-starter-f1")).toBeInTheDocument();
  });

  it("keeps unswapped starters in their original pitch slots after a swap reorders the array", () => {
    const startingTeam = makeTeam({
      players: [
        makePlayer({ id: "gk1", name: "Keeper", position: "Goalkeeper" }),
        makePlayer({ id: "d1", name: "Back One", position: "Defender" }),
        makePlayer({ id: "d2", name: "Back Two", position: "Defender" }),
        makePlayer({ id: "d3", name: "Back Three", position: "Defender" }),
        makePlayer({ id: "d4", name: "Back Four", position: "Defender" }),
        makePlayer({ id: "m1", name: "Mid One", position: "Midfielder" }),
        makePlayer({ id: "m2", name: "Mid Two", position: "Midfielder" }),
        makePlayer({ id: "m3", name: "Mid Three", position: "Midfielder" }),
        makePlayer({ id: "m4", name: "Mid Four", position: "Midfielder" }),
        makePlayer({ id: "f1", name: "Striker One", position: "Forward" }),
        makePlayer({ id: "f2", name: "Striker Two", position: "Forward" }),
      ],
    });

    const slotOrderBefore = () =>
      screen
        .getAllByTestId(/^pre-match-starter-/)
        .map((node) => node.getAttribute("data-testid"));

    const { rerender } = render(
      <PreMatchLineup
        {...defaultProps}
        userTeam={startingTeam}
        userBench={[makePlayer({ id: "sub1", name: "Sub One", position: "Defender" })]}
      />,
    );

    const before = slotOrderBefore();

    // Backend pre-match swap removes the swapped-out starter and appends the
    // incoming player to the END of the players array, shifting later indices.
    const swappedTeam = makeTeam({
      players: [
        makePlayer({ id: "gk1", name: "Keeper", position: "Goalkeeper" }),
        makePlayer({ id: "d2", name: "Back Two", position: "Defender" }),
        makePlayer({ id: "d3", name: "Back Three", position: "Defender" }),
        makePlayer({ id: "d4", name: "Back Four", position: "Defender" }),
        makePlayer({ id: "m1", name: "Mid One", position: "Midfielder" }),
        makePlayer({ id: "m2", name: "Mid Two", position: "Midfielder" }),
        makePlayer({ id: "m3", name: "Mid Three", position: "Midfielder" }),
        makePlayer({ id: "m4", name: "Mid Four", position: "Midfielder" }),
        makePlayer({ id: "f1", name: "Striker One", position: "Forward" }),
        makePlayer({ id: "f2", name: "Striker Two", position: "Forward" }),
        makePlayer({ id: "sub1", name: "Sub One", position: "Defender" }),
      ],
    });

    rerender(
      <PreMatchLineup
        {...defaultProps}
        userTeam={swappedTeam}
        userBench={[makePlayer({ id: "d1", name: "Back One", position: "Defender" })]}
      />,
    );

    const after = slotOrderBefore();

    // The incoming sub takes the exact slot the swapped-out starter vacated;
    // every other slot keeps its original occupant.
    const swappedOutIndex = before.indexOf("pre-match-starter-d1");
    expect(after[swappedOutIndex]).toBe("pre-match-starter-sub1");

    before.forEach((slot, index) => {
      if (index === swappedOutIndex) return;
      expect(after[index]).toBe(slot);
    });
  });

  it("offers a context menu action to swap in a bench player", () => {
    const onSwap = vi.fn();

    render(
      <PreMatchLineup
        {...defaultProps}
        selectedStarterId="m1"
        onSwap={onSwap}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("pre-match-bench-b1"));
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("button", {
        name: "Swap with selected starter",
      }),
    );

    expect(onSwap).toHaveBeenCalledWith("b1");
  });

  it("renders formation fit indicators", () => {
    render(<PreMatchLineup {...defaultProps} />);
    // With 1 GK and formationNeeds.Goalkeeper=1, should show 1/1
    expect(screen.getByText("match.formationFit")).toBeInTheDocument();
  });

  it("shows empty bench message when no bench players", () => {
    render(<PreMatchLineup {...defaultProps} userBench={[]} />);
    expect(screen.getByText("match.noBenchAvailable2")).toBeInTheDocument();
  });

  it("renders player condition percentages", () => {
    render(<PreMatchLineup {...defaultProps} />);
    // All default players have condition=100, bench has 90
    const pcts = screen.getAllByText(/100%/);
    expect(pcts.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/90%/)).toBeInTheDocument();
  });
});
