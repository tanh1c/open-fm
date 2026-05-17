import { describe, expect, it } from "vitest";
import type { PlayerData } from "../../store/gameStore";
import {
    GRID_TACTIC_SLOTS,
    buildGridAssignmentsFromFormation,
    buildGridAssignmentsFromSavedSlots,
    deriveFormationFromGridAssignments,
    getGridAssignmentIssues,
    getGridAssignmentSignature,
    getStartingXiIdsFromGridAssignments,
    mapGridSlotToPosition,
    movePlayerInGridAssignments,
    resolveStartingXiIds,
} from "./TacticsTab.helpers";

const makePlayer = (
    id: string,
    position: string,
    overrides: Partial<PlayerData> = {},
): PlayerData => ({
    id,
    match_name: id,
    full_name: `Player ${id}`,
    date_of_birth: "1998-01-01",
    nationality: "GB",
    position,
    natural_position: position,
    alternate_positions: [],
    training_focus: null,
    attributes: {
        pace: 60,
        stamina: 60,
        strength: 60,
        agility: 60,
        passing: 60,
        shooting: 60,
        tackling: 60,
        dribbling: 60,
        defending: 60,
        positioning: 60,
        vision: 60,
        decisions: 60,
        composure: 60,
        aggression: 60,
        teamwork: 60,
        leadership: 60,
        handling: 60,
        reflexes: 60,
        aerial: 60,
    },
    condition: 100,
    morale: 80,
    injury: null,
    team_id: "team1",
    contract_end: "2027-06-30",
    wage: 1000,
    market_value: 100000,
    stats: {
        appearances: 0,
        goals: 0,
        assists: 0,
        clean_sheets: 0,
        yellow_cards: 0,
        red_cards: 0,
        avg_rating: 0,
        minutes_played: 0,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
});

describe("grid tactic slots", () => {
    it("defines one goalkeeper and expected outfield placeholders", () => {
        expect(GRID_TACTIC_SLOTS.filter((slot) => slot.role === "GK")).toHaveLength(1);
        expect(GRID_TACTIC_SLOTS.some((slot) => slot.id === "st")).toBe(true);
        expect(GRID_TACTIC_SLOTS.some((slot) => slot.id === "cb")).toBe(true);
    });

    it("derives compact formation labels from occupied slots", () => {
        const assignments = [
            { slotId: "gk", playerId: "gk" },
            { slotId: "lcb", playerId: "d1" },
            { slotId: "rcb", playerId: "d2" },
            { slotId: "lm", playerId: "m1" },
            { slotId: "lcm", playerId: "m2" },
            { slotId: "rcm", playerId: "m3" },
            { slotId: "rm", playerId: "m4" },
            { slotId: "lw", playerId: "f1" },
            { slotId: "ls", playerId: "f2" },
            { slotId: "rs", playerId: "f3" },
            { slotId: "rw", playerId: "f4" },
        ];

        expect(deriveFormationFromGridAssignments(assignments)).toBe("2-4-4");
    });

    it("maps grid slots to broad position groups", () => {
        expect(mapGridSlotToPosition("gk")).toBe("Goalkeeper");
        expect(mapGridSlotToPosition("lb")).toBe("Defender");
        expect(mapGridSlotToPosition("dm")).toBe("Midfielder");
        expect(mapGridSlotToPosition("st")).toBe("Forward");
    });

    it("builds preset assignments from a formation and starting XI ids", () => {
        const ids = ["gk", "lb", "cb1", "cb2", "rb", "lm", "cm1", "cm2", "rm", "st1", "st2"];
        const assignments = buildGridAssignmentsFromFormation("4-4-2", ids);

        expect(assignments.find((slot) => slot.slotId === "gk")?.playerId).toBe("gk");
        expect(assignments.filter((slot) => slot.playerId).map((slot) => slot.playerId)).toHaveLength(11);
        expect(deriveFormationFromGridAssignments(assignments)).toBe("4-4-2");
    });

    it("moves a player to a target grid slot without duplicating them", () => {
        const assignments = buildGridAssignmentsFromFormation("4-4-2", ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]);
        const moved = movePlayerInGridAssignments(assignments, "d5", "lb");

        expect(moved.find((slot) => slot.slotId === "lb")?.playerId).toBe("d5");
        expect(moved.filter((slot) => slot.playerId === "d5")).toHaveLength(1);
    });

    it("returns starting XI ids in grid assignment order", () => {
        const assignments = buildGridAssignmentsFromFormation("4-4-2", ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]);

        expect(getStartingXiIdsFromGridAssignments(assignments)).toEqual(["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]);
    });

    it("loads saved custom slots and ignores duplicate or unavailable players", () => {
        const fallback = buildGridAssignmentsFromFormation("4-4-2", ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]);
        const assignments = buildGridAssignmentsFromSavedSlots(
            [
                { slot_id: "gk", player_id: "gk", role: "GK", x: 50, y: 91 },
                { slot_id: "lb", player_id: "d2", role: "DEF", x: 18, y: 72 },
                { slot_id: "lcb", player_id: "d2", role: "DEF", x: 34, y: 72 },
                { slot_id: "st", player_id: "missing", role: "FWD", x: 50, y: 15 },
            ],
            fallback,
            new Set(["gk", "d2"]),
        );

        expect(assignments.find((slot) => slot.slotId === "gk")?.playerId).toBe("gk");
        expect(assignments.find((slot) => slot.slotId === "lb")?.playerId).toBe("d2");
        expect(assignments.find((slot) => slot.slotId === "lcb")?.playerId).toBeNull();
        expect(assignments.find((slot) => slot.slotId === "st")?.playerId).toBeNull();
    });

    it("reports grid assignment validation issues", () => {
        expect(getGridAssignmentIssues(buildGridAssignmentsFromFormation("4-4-2", ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]))).toEqual([]);

        expect(getGridAssignmentIssues([
            { slotId: "lb", playerId: "d1" },
            { slotId: "lcb", playerId: "d1" },
        ])).toEqual([
            "tactics.validation.requiresEleven",
            "tactics.validation.noDuplicates",
            "tactics.validation.requiresGoalkeeper",
        ]);
    });

    it("detects same-row slot changes even when starting xi order is unchanged", () => {
        const assignments = buildGridAssignmentsFromFormation("4-4-2", ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"]);
        const moved = movePlayerInGridAssignments(assignments, "f2", "st");

        expect(getStartingXiIdsFromGridAssignments(moved)).toEqual(getStartingXiIdsFromGridAssignments(assignments));
        expect(getGridAssignmentSignature(moved)).not.toBe(getGridAssignmentSignature(assignments));
    });
});

describe("resolveStartingXiIds", () => {
    it("prefers exact slot matches when filling pending tactics slots", () => {
        const availablePlayers = [
            makePlayer("gk", "Goalkeeper"),
            makePlayer("lb", "Left Back", {
                natural_position: "Left Back",
                attributes: {
                    pace: 55,
                    stamina: 55,
                    strength: 55,
                    agility: 55,
                    passing: 55,
                    shooting: 40,
                    tackling: 68,
                    dribbling: 50,
                    defending: 68,
                    positioning: 62,
                    vision: 52,
                    decisions: 58,
                    composure: 56,
                    aggression: 58,
                    teamwork: 60,
                    leadership: 50,
                    handling: 10,
                    reflexes: 10,
                    aerial: 10,
                },
            }),
            makePlayer("cb1", "Center Back", {
                natural_position: "Center Back",
                attributes: {
                    pace: 70,
                    stamina: 70,
                    strength: 74,
                    agility: 62,
                    passing: 62,
                    shooting: 42,
                    tackling: 78,
                    dribbling: 52,
                    defending: 80,
                    positioning: 74,
                    vision: 58,
                    decisions: 70,
                    composure: 68,
                    aggression: 71,
                    teamwork: 68,
                    leadership: 60,
                    handling: 10,
                    reflexes: 10,
                    aerial: 10,
                },
            }),
            makePlayer("cb2", "Center Back"),
            makePlayer("rb", "Right Back", { natural_position: "Right Back" }),
            makePlayer("m1", "Midfielder"),
            makePlayer("m2", "Midfielder"),
            makePlayer("m3", "Midfielder"),
            makePlayer("m4", "Midfielder"),
            makePlayer("f1", "Forward"),
            makePlayer("f2", "Forward"),
        ];
        const playersById = new Map(availablePlayers.map((player) => [player.id, player]));

        const ids = resolveStartingXiIds({
            availablePlayers,
            formation: "4-4-2",
            pendingStartingXiIds: ["gk"],
            playersById,
            savedStartingXiIds: [],
        });

        expect(ids[1]).toBe("lb");
    });
});