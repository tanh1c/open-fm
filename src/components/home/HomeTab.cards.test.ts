import { describe, it, expect } from "vitest";

import type {
  FixtureData,
  GameStateData,
  PlayerData,
  TeamData,
} from "../../store/gameStore";
import type { CompactMatchEventData } from "../../store/types";
import {
  buildFormBreakdown,
  buildGoalSegments,
  buildSquadOverviewRows,
  buildTacticsSlots,
} from "./HomeTab.cards";

function team(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Alpha FC",
    short_name: "ALP",
    country: "BR",
    city: "Rio",
    stadium_name: "Alpha Arena",
    stadium_capacity: 50000,
    finance: 0,
    manager_id: null,
    reputation: 50,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "Physical",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "#111", secondary: "#fff" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "p-1",
    match_name: "Doe",
    full_name: "John Doe",
    date_of_birth: "2000-01-01",
    nationality: "BR",
    position: "Striker",
    natural_position: "Striker",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: 50, stamina: 50, strength: 50, agility: 50, passing: 50,
      shooting: 50, tackling: 50, dribbling: 50, defending: 50, positioning: 50,
      vision: 50, decisions: 50, composure: 50, aggression: 50, teamwork: 50,
      leadership: 50, handling: 50, reflexes: 50, aerial: 50,
    },
    condition: 90,
    morale: 80,
    injury: null,
    team_id: "team-1",
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: {
      appearances: 12,
      goals: 5,
      assists: 3,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      avg_rating: 7.4,
      minutes_played: 1080,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

function fixture(overrides: Partial<FixtureData> = {}): FixtureData {
  return {
    id: "f-1",
    matchday: 1,
    date: "2026-01-01",
    home_team_id: "team-1",
    away_team_id: "team-2",
    competition: "League",
    status: "Scheduled",
    result: null,
    ...overrides,
  };
}

describe("buildFormBreakdown", () => {
  it("aggregates W/D/L counts and PPG", () => {
    const result = buildFormBreakdown(["W", "W", "D", "L", "W"]);
    expect(result.totals).toEqual({ won: 3, drawn: 1, lost: 1 });
    expect(result.pointsPerGame).toBeCloseTo((3 * 3 + 1) / 5, 2);
    expect(result.results).toEqual(["W", "W", "D", "L", "W"]);
  });

  it("returns 0 PPG for an empty form", () => {
    const result = buildFormBreakdown([]);
    expect(result.totals).toEqual({ won: 0, drawn: 0, lost: 0 });
    expect(result.pointsPerGame).toBe(0);
  });

  it("ignores unknown codes", () => {
    const result = buildFormBreakdown(["W", "?", "L", ""]);
    expect(result.totals).toEqual({ won: 1, drawn: 0, lost: 1 });
  });
});

describe("buildGoalSegments", () => {
  function gameState(): GameStateData {
    const events: CompactMatchEventData[] = [
      { minute: 10, event_type: "Goal", side: "Home", player_id: "p-1", secondary_player_id: null },
      { minute: 20, event_type: "Goal", side: "Home", player_id: "p-1", secondary_player_id: null },
      { minute: 30, event_type: "PenaltyGoal", side: "Home", player_id: "p-1", secondary_player_id: null },
      { minute: 40, event_type: "Goal", side: "Away", player_id: "p-x", secondary_player_id: null },
    ];

    const completed: FixtureData = {
      ...fixture({ id: "f-completed" }),
      status: "Completed",
      result: {
        home_goals: 3,
        away_goals: 1,
        home_scorers: [],
        away_scorers: [],
        report: {
          total_minutes: 90,
          home_stats: {
            possession_pct: 50, shots: 10, shots_on_target: 5,
            fouls: 0, corners: 3, yellow_cards: 0, red_cards: 0,
          },
          away_stats: {
            possession_pct: 50, shots: 8, shots_on_target: 3,
            fouls: 0, corners: 2, yellow_cards: 0, red_cards: 0,
          },
          events,
        },
      },
    };

    return {
      teams: [team()],
      players: [],
      league: {
        id: "L",
        name: "League",
        country: "BR",
        season: 2026,
        fixtures: [completed],
        standings: [],
      },
      manager: { id: "m1", first_name: "M", last_name: "N", team_id: "team-1", date_of_birth: "1980-01-01", nationality: "BR", satisfaction: 50 },
      news: [],
      messages: [],
      clock: { current_date: "2026-01-01", start_date: "2026-01-01" },
    } as unknown as GameStateData;
  }

  it("splits goals by kind", () => {
    const segments = buildGoalSegments(gameState(), "team-1");
    const open = segments.find((s) => s.kind === "open_play");
    const pen = segments.find((s) => s.kind === "penalty");
    expect(open?.count).toBe(2);
    expect(pen?.count).toBe(1);
  });

  it("returns empty array when team has no completed fixtures", () => {
    const segments = buildGoalSegments(gameState(), "missing-team");
    expect(segments.every((s) => s.count === 0)).toBe(true);
  });
});

describe("buildSquadOverviewRows", () => {
  it("maps player fields to table rows", () => {
    const roster = [player({ id: "p-1", match_name: "Smith", position: "Striker", nationality: "BR" })];
    const rows = buildSquadOverviewRows(roster);
    expect(rows[0]).toMatchObject({
      id: "p-1",
      matchName: "Smith",
      position: "ST",
      nationality: "BR",
      goals: 5,
      assists: 3,
      avgRating: 7.4,
    });
    expect(rows[0].age).toBeGreaterThan(0);
  });

  it("limits the list to the first N rows", () => {
    const roster = Array.from({ length: 20 }, (_, i) =>
      player({ id: `p-${i}`, match_name: `P${i}` }),
    );
    const rows = buildSquadOverviewRows(roster, 6);
    expect(rows).toHaveLength(6);
  });
});

describe("buildTacticsSlots", () => {
  it("returns an empty list when there is no team", () => {
    expect(buildTacticsSlots(null, [])).toEqual([]);
  });

  it("places players for a 4-4-2 formation with role labels", () => {
    const myTeam = team({ formation: "4-4-2", starting_xi_ids: ["g", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"] });
    const roster: PlayerData[] = [
      player({ id: "g", match_name: "Keeper", natural_position: "Goalkeeper" }),
      player({ id: "d1", match_name: "LB", natural_position: "LeftBack" }),
      player({ id: "d2", match_name: "CB1", natural_position: "CenterBack" }),
      player({ id: "d3", match_name: "CB2", natural_position: "CenterBack" }),
      player({ id: "d4", match_name: "RB", natural_position: "RightBack" }),
      player({ id: "m1", match_name: "LM", natural_position: "LeftMidfielder" }),
      player({ id: "m2", match_name: "CM1", natural_position: "CentralMidfielder" }),
      player({ id: "m3", match_name: "CM2", natural_position: "CentralMidfielder" }),
      player({ id: "m4", match_name: "RM", natural_position: "RightMidfielder" }),
      player({ id: "f1", match_name: "ST1", natural_position: "Striker" }),
      player({ id: "f2", match_name: "ST2", natural_position: "Striker" }),
    ];
    const slots = buildTacticsSlots(myTeam, roster);
    expect(slots).toHaveLength(11);
    const keeper = slots.find((s) => s.id === "g");
    expect(keeper?.role).toBe("GK");
    const striker = slots.find((s) => s.id === "f1");
    expect(striker?.y).toBeLessThan(50);
    expect(keeper?.y).toBeGreaterThan(70);
  });
});
