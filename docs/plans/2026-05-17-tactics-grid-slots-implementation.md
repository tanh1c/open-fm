# Tactics Grid Slots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fixed-placeholder grid-slot tactics editor that lets managers create custom formations, derives the formation label from occupied slots, persists custom slot assignments, and applies Football Manager-style shape effects in the match engine.

**Architecture:** Add a small shared tactics-slot model in the frontend first, then wire `TacticsPitch` and `TacticsTab` to use slot assignments instead of formation-only pitch rows. Persist the same assignment data in team state and Rust domain structs with backward-compatible defaults. Translate custom slots into broad engine positions and shape modifiers so the engine can reward balanced shapes and penalize extreme ones without rewriting match simulation.

**Tech Stack:** React, TypeScript, Tailwind, Vitest/Testing Library, Tauri invoke commands, Rust domain/ofm_core/engine crates.

---

## Constraints

- Preserve existing features: drag/drop, bench-to-pitch, pitch select/compare/swap, table/profile navigation, formation presets, play style, roles, set pieces, and old saves.
- Do not remove `team.formation` or `starting_xi`; custom grid slots are an additive layer.
- Keep implementation bounded to fixed placeholders. Do not add free x/y dragging or advanced individual roles yet.
- Do not commit or push unless explicitly requested by the user.

---

### Task 1: Add frontend grid-slot model helpers

**Files:**
- Modify: `src/components/tactics/TacticsTab.helpers.ts`
- Test: `src/components/tactics/TacticsTab.helpers.test.ts`
- Reference: `src/components/squad/SquadTab.helpers.ts`

**Step 1: Write failing tests for grid slot definitions and formation derivation**

Add tests near the existing tactics helper tests:

```ts
import {
  GRID_TACTIC_SLOTS,
  deriveFormationFromGridAssignments,
  mapGridSlotToPosition,
  buildGridAssignmentsFromFormation,
} from "./TacticsTab.helpers";

describe("grid tactic slots", () => {
  it("defines one goalkeeper and ten-plus outfield placeholders", () => {
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

  it("maps grid slots to existing broad position groups", () => {
    expect(mapGridSlotToPosition("gk")).toBe("Goalkeeper");
    expect(mapGridSlotToPosition("lb")).toBe("Defender");
    expect(mapGridSlotToPosition("dm")).toBe("Midfielder");
    expect(mapGridSlotToPosition("st")).toBe("Forward");
  });

  it("builds a preset assignment from a formation and starting XI ids", () => {
    const ids = ["gk", "lb", "cb1", "cb2", "rb", "lm", "cm1", "cm2", "rm", "st1", "st2"];
    const assignments = buildGridAssignmentsFromFormation("4-4-2", ids);

    expect(assignments.find((slot) => slot.slotId === "gk")?.playerId).toBe("gk");
    expect(assignments.filter((slot) => slot.playerId).map((slot) => slot.playerId)).toHaveLength(11);
    expect(deriveFormationFromGridAssignments(assignments)).toBe("4-4-2");
  });
});
```

**Step 2: Run the helper tests and verify failure**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.helpers.test.ts
```

Expected: FAIL because the new exports do not exist.

**Step 3: Implement the grid-slot helpers**

Add types and helpers to `src/components/tactics/TacticsTab.helpers.ts`:

```ts
export type GridTacticSlotRole = "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD";

export interface GridTacticSlotDefinition {
  id: string;
  label: string;
  role: GridTacticSlotRole;
  x: number;
  y: number;
}

export interface GridTacticAssignment {
  slotId: string;
  playerId: string | null;
}

export const GRID_TACTIC_SLOTS: GridTacticSlotDefinition[] = [
  { id: "gk", label: "GK", role: "GK", x: 50, y: 91 },
  { id: "lb", label: "LB", role: "DEF", x: 18, y: 72 },
  { id: "lcb", label: "LCB", role: "DEF", x: 34, y: 72 },
  { id: "cb", label: "CB", role: "DEF", x: 50, y: 74 },
  { id: "rcb", label: "RCB", role: "DEF", x: 66, y: 72 },
  { id: "rb", label: "RB", role: "DEF", x: 82, y: 72 },
  { id: "ldm", label: "LDM", role: "DM", x: 32, y: 58 },
  { id: "dm", label: "DM", role: "DM", x: 50, y: 59 },
  { id: "rdm", label: "RDM", role: "DM", x: 68, y: 58 },
  { id: "lm", label: "LM", role: "MID", x: 17, y: 47 },
  { id: "lcm", label: "LCM", role: "MID", x: 35, y: 45 },
  { id: "cm", label: "CM", role: "MID", x: 50, y: 45 },
  { id: "rcm", label: "RCM", role: "MID", x: 65, y: 45 },
  { id: "rm", label: "RM", role: "MID", x: 83, y: 47 },
  { id: "lw", label: "LW", role: "FWD", x: 18, y: 28 },
  { id: "lam", label: "LAM", role: "AM", x: 36, y: 31 },
  { id: "am", label: "AM", role: "AM", x: 50, y: 30 },
  { id: "ram", label: "RAM", role: "AM", x: 64, y: 31 },
  { id: "rw", label: "RW", role: "FWD", x: 82, y: 28 },
  { id: "ls", label: "LS", role: "FWD", x: 38, y: 17 },
  { id: "st", label: "ST", role: "FWD", x: 50, y: 15 },
  { id: "rs", label: "RS", role: "FWD", x: 62, y: 17 },
];
```

Implement minimal helpers:

```ts
const PRESET_SLOT_IDS: Record<string, string[]> = {
  "4-4-2": ["gk", "lb", "lcb", "rcb", "rb", "lm", "lcm", "rcm", "rm", "ls", "rs"],
  "4-3-3": ["gk", "lb", "lcb", "rcb", "rb", "lcm", "cm", "rcm", "lw", "st", "rw"],
  "3-5-2": ["gk", "lcb", "cb", "rcb", "lm", "ldm", "cm", "rdm", "rm", "ls", "rs"],
  "4-5-1": ["gk", "lb", "lcb", "rcb", "rb", "lm", "ldm", "cm", "rdm", "rm", "st"],
  "4-2-3-1": ["gk", "lb", "lcb", "rcb", "rb", "ldm", "rdm", "lam", "am", "ram", "st"],
  "3-4-3": ["gk", "lcb", "cb", "rcb", "lm", "lcm", "rcm", "rm", "lw", "st", "rw"],
  "5-3-2": ["gk", "lb", "lcb", "cb", "rcb", "rb", "lcm", "cm", "rcm", "ls", "rs"],
  "4-1-4-1": ["gk", "lb", "lcb", "rcb", "rb", "dm", "lm", "lcm", "rcm", "rm", "st"],
};

export function mapGridSlotToPosition(slotId: string): string {
  const slot = GRID_TACTIC_SLOTS.find((candidate) => candidate.id === slotId);
  if (!slot) return "Midfielder";
  if (slot.role === "GK") return "Goalkeeper";
  if (slot.role === "DEF") return "Defender";
  if (slot.role === "FWD") return "Forward";
  return "Midfielder";
}

export function deriveFormationFromGridAssignments(assignments: GridTacticAssignment[]): string {
  const assignedSlotIds = new Set(assignments.filter((slot) => slot.playerId).map((slot) => slot.slotId));
  let defenders = 0;
  let midfielders = 0;
  let forwards = 0;

  for (const slot of GRID_TACTIC_SLOTS) {
    if (!assignedSlotIds.has(slot.id) || slot.role === "GK") continue;
    if (slot.role === "DEF") defenders += 1;
    else if (slot.role === "FWD") forwards += 1;
    else midfielders += 1;
  }

  return `${defenders}-${midfielders}-${forwards}`;
}

export function buildEmptyGridAssignments(): GridTacticAssignment[] {
  return GRID_TACTIC_SLOTS.map((slot) => ({ slotId: slot.id, playerId: null }));
}

export function buildGridAssignmentsFromFormation(
  formation: string,
  startingXiIds: string[],
): GridTacticAssignment[] {
  const assignments = buildEmptyGridAssignments();
  const presetSlotIds = PRESET_SLOT_IDS[formation] ?? PRESET_SLOT_IDS["4-4-2"];

  presetSlotIds.forEach((slotId, index) => {
    const assignment = assignments.find((slot) => slot.slotId === slotId);
    if (assignment) assignment.playerId = startingXiIds[index] ?? null;
  });

  return assignments;
}
```

**Step 4: Run helper tests and typecheck**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.helpers.test.ts
npx tsc --noEmit
```

Expected: PASS.

---

### Task 2: Render grid placeholders in TacticsPitch while preserving drag/drop test IDs

**Files:**
- Modify: `src/components/tactics/TacticsPitch.tsx`
- Modify: `src/components/tactics/TacticsTab.tsx`
- Test: `src/components/tactics/TacticsTab.test.tsx`

**Step 1: Write failing UI tests for visible placeholders and derived label**

Add or update tests in `src/components/tactics/TacticsTab.test.tsx`:

```ts
it("renders grid tactic placeholders on the overview pitch", () => {
  render(<TacticsTab gameState={makeGameState()} onSelectPlayer={vi.fn()} onGameUpdate={vi.fn()} />);

  expect(screen.getByTestId("grid-slot-gk")).toBeInTheDocument();
  expect(screen.getByTestId("grid-slot-st")).toBeInTheDocument();
  expect(screen.getByTestId("grid-slot-cb")).toBeInTheDocument();
});

it("shows a derived formation label from grid assignments", () => {
  render(<TacticsTab gameState={makeGameState()} onSelectPlayer={vi.fn()} onGameUpdate={vi.fn()} />);

  expect(screen.getByText(/4-4-2/)).toBeInTheDocument();
});
```

**Step 2: Run the Tactics test and verify failure**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx
```

Expected: FAIL because `grid-slot-*` placeholders are not rendered yet.

**Step 3: Update TacticsPitch props**

Change `TacticsPitchProps` from `pitchSlotRows` to grid assignments while keeping existing callbacks:

```ts
import {
  GRID_TACTIC_SLOTS,
  type GridTacticAssignment,
} from "./TacticsTab.helpers";

interface TacticsPitchProps {
  gridAssignments: GridTacticAssignment[];
  formationLabel: string;
  // keep current props: benchPlayers, dragState, comparePlayerId, callbacks, etc.
  onSlotDragOver: (event: DragEvent<HTMLElement>, slotId: string) => void;
  onSlotDragLeave: (slotId: string) => void;
  onSlotDrop: (event: DragEvent<HTMLElement>, slotId: string) => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotId: string | null,
  ) => void;
}
```

Keep `data-testid="pitch-player-${player.id}"` and `data-testid="pitch-bench-player-${player.id}"` unchanged. Add `data-testid="grid-slot-${slot.id}"` to each placeholder container.

**Step 4: Render all grid slots at fixed x/y coordinates**

Replace the `allSlots.map` block with a map over `GRID_TACTIC_SLOTS`:

```tsx
{GRID_TACTIC_SLOTS.map((slot) => {
  const assignment = gridAssignments.find((candidate) => candidate.slotId === slot.id);
  const player = assignment?.playerId ? playersById.get(assignment.playerId) ?? null : null;
  const wrongPos = player ? isPlayerOutOfPosition(player, mapGridSlotToPosition(slot.id)) : false;

  return (
    <div
      key={slot.id}
      data-testid={`grid-slot-${slot.id}`}
      className="absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      onDragOver={(event) => onSlotDragOver(event, slot.id)}
      onDragLeave={() => onSlotDragLeave(slot.id)}
      onDrop={(event) => onSlotDrop(event, slot.id)}
    >
      {player ? render existing player button : render placeholder with slot.label}
    </div>
  );
})}
```

If `TacticsPitch` does not currently receive `playersById`, add it as a prop or pass a helper function from `TacticsTab`. Prefer passing `playersById` to avoid recreating lookup logic.

**Step 5: Wire TacticsTab grid state**

In `TacticsTab.tsx`, derive initial assignments:

```ts
const [gridAssignments, setGridAssignments] = useState<GridTacticAssignment[]>(() =>
  buildGridAssignmentsFromFormation(formation, startingXIIds),
);

useEffect(() => {
  setGridAssignments(buildGridAssignmentsFromFormation(formation, startingXIIds));
}, [formation, startingXIIds]);
```

This is temporary until persistence is added in Task 4. Compute:

```ts
const derivedFormationLabel = deriveFormationFromGridAssignments(gridAssignments);
```

Pass `gridAssignments` and `formationLabel={derivedFormationLabel}` into `TacticsPitch`.

**Step 6: Run tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx
npx tsc --noEmit
```

Expected: PASS or only existing drag/drop tests fail because slot identifiers changed from number to string. Do not proceed until tests are adjusted in Task 3.

---

### Task 3: Preserve grid drag/drop, select, compare, and swap behavior

**Files:**
- Modify: `src/components/tactics/TacticsTab.tsx`
- Modify: `src/components/tactics/TacticsPitch.tsx`
- Test: `src/components/tactics/TacticsTab.test.tsx`
- Reference: `src/components/squad/SquadTab.helpers.ts`

**Step 1: Update failing behavior tests to use grid slot IDs**

Change old `pitch-slot-0` style tests to `grid-slot-*`. Example:

```ts
it("drops a bench player into a grid slot and persists the starting XI", async () => {
  const onGameUpdate = vi.fn();
  render(<TacticsTab gameState={makeGameState()} onSelectPlayer={vi.fn()} onGameUpdate={onGameUpdate} />);

  fireEvent.dragStart(screen.getByTestId("pitch-bench-player-d5"));
  fireEvent.drop(screen.getByTestId("grid-slot-lb"));

  await waitFor(() => {
    expect(mockInvoke).toHaveBeenCalledWith("set_starting_xi", expect.any(Object));
  });
});
```

Keep tests for:

- Bench cards remain draggable.
- Pitch click selects/compares without opening profile.
- Confirm swap calls `set_starting_xi`.
- Role suitability rows still select/compare.

**Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx
```

Expected: FAIL while handlers still use numeric slot indices.

**Step 3: Change drag state slot index to support string slot IDs**

Do not mutate shared squad helpers if avoidable. In Tactics code, introduce a local drag state type or extend the imported type carefully:

```ts
type TacticsDragState = {
  playerId: string;
  from: SquadSection;
  slotId: string | null;
};
```

Use this in `TacticsTab.tsx` and `TacticsPitch.tsx` instead of `DragState` for tactics-only code.

**Step 4: Implement assignment operations**

Add helper functions in `TacticsTab.helpers.ts` and tests if needed:

```ts
export function movePlayerInGridAssignments(
  assignments: GridTacticAssignment[],
  playerId: string,
  targetSlotId: string,
): GridTacticAssignment[] {
  return assignments.map((assignment) => {
    if (assignment.playerId === playerId) return { ...assignment, playerId: null };
    if (assignment.slotId === targetSlotId) return { ...assignment, playerId };
    return assignment;
  });
}

export function getStartingXiIdsFromGridAssignments(assignments: GridTacticAssignment[]): string[] {
  return assignments
    .filter((assignment) => assignment.playerId)
    .map((assignment) => assignment.playerId as string)
    .slice(0, 11);
}
```

**Step 5: Wire drop persistence**

In `handleSlotDrop`, update grid assignments first, then persist current starting XI order:

```ts
const nextAssignments = movePlayerInGridAssignments(gridAssignments, dragState.playerId, targetSlotId);
setGridAssignments(nextAssignments);
await persistStartingXI(getStartingXiIdsFromGridAssignments(nextAssignments));
```

Preserve existing error rollback behavior if present.

**Step 6: Preserve click selection and swap**

When a pitch player is clicked, pass the `slotId` to selection state. For confirm swap, swap `playerId`s between two assignment records and persist the resulting XI ids.

**Step 7: Run tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx src/components/tactics/TacticsTab.helpers.test.ts
npx tsc --noEmit
```

Expected: PASS.

---

### Task 4: Persist custom grid assignments in frontend/backend state

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/gameStore.ts` if team types are duplicated there
- Modify: `src-engine/crates/domain/src/team.rs`
- Modify: `src-engine/crates/ofm_core/src/generator/world_io.rs` only if serialization defaults require explicit handling
- Modify: existing Tauri command file that handles `set_starting_xi` / `set_formation` under `src-engine/src/app_handle/` or command module currently used in this branch
- Test: relevant Rust tests near team serialization or command tests
- Test: `src/components/tactics/TacticsTab.test.tsx`

**Step 1: Locate the authoritative team type and command handler**

Use `Grep` for:

- `struct Team`
- `starting_xi`
- `set_starting_xi`
- `set_formation`

Do not assume command paths; this branch moved commands under `src-engine/src/app_handle/`.

**Step 2: Add failing frontend persistence test**

In `TacticsTab.test.tsx`, test that dropping into a grid slot calls a new persistence command or payload field. Prefer extending existing `set_starting_xi` payload only if backend already owns that command shape. Otherwise add a separate command `set_tactic_slots`.

Recommended command for low risk:

```ts
expect(mockInvoke).toHaveBeenCalledWith("set_tactic_slots", {
  slots: expect.arrayContaining([
    expect.objectContaining({ slot_id: "lb", player_id: "d5" }),
  ]),
});
```

Expected: FAIL because command is not implemented.

**Step 3: Add Rust domain structs with serde defaults**

In `src-engine/crates/domain/src/team.rs`, add:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustomTacticSlot {
    pub slot_id: String,
    pub player_id: Option<String>,
    pub role: String,
    pub x: u8,
    pub y: u8,
}
```

Add field to `Team`:

```rust
#[serde(default)]
pub custom_tactic_slots: Vec<CustomTacticSlot>,
```

Make sure existing saves deserialize with an empty vector.

**Step 4: Add TypeScript type field**

In the frontend team type:

```ts
export interface CustomTacticSlotData {
  slot_id: string;
  player_id: string | null;
  role: "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD";
  x: number;
  y: number;
}

export interface TeamData {
  // existing fields
  custom_tactic_slots?: CustomTacticSlotData[];
}
```

Use optional field for backward compatibility.

**Step 5: Implement backend command**

Add a Tauri command such as:

```rust
#[tauri::command]
pub fn set_tactic_slots(slots: Vec<CustomTacticSlot>) -> Result<GameStateData, String> {
    // get active game/team, validate exactly one GK and max 11 assigned players,
    // reject duplicate player ids,
    // save team.custom_tactic_slots,
    // update team.starting_xi from assigned player order,
    // update team.formation from derived compact label,
    // return updated game state
}
```

Register it with the generated/app handle command system used in this branch. If commands are generated from app_handle modules, follow the existing pattern and regenerate if required by `scripts/generate-engine-commands.mjs`.

**Step 6: Wire frontend invoke**

After grid assignment changes:

```ts
await invoke<GameStateData>("set_tactic_slots", {
  slots: toBackendGridSlots(nextAssignments),
});
```

`toBackendGridSlots` should include slot metadata from `GRID_TACTIC_SLOTS`.

**Step 7: Run tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx
npx tsc --noEmit
cargo test -p domain
```

If the workspace crate names differ, run the smallest available Rust test command from `src-engine` that covers domain/ofm_core serialization.

Expected: PASS.

---

### Task 5: Load saved custom slots and keep formation presets as quick-fill actions

**Files:**
- Modify: `src/components/tactics/TacticsTab.tsx`
- Modify: `src/components/tactics/TacticsPitch.tsx`
- Modify: `src/components/tactics/TacticsTab.helpers.ts`
- Test: `src/components/tactics/TacticsTab.test.tsx`

**Step 1: Add failing tests for loading saved custom slots**

Create a game state whose manager team includes custom slots:

```ts
const gameState = makeGameState({
  teamOverrides: {
    custom_tactic_slots: [
      { slot_id: "gk", player_id: "g1", role: "GK", x: 50, y: 91 },
      { slot_id: "lcb", player_id: "d1", role: "DEF", x: 34, y: 72 },
      { slot_id: "rcb", player_id: "d2", role: "DEF", x: 66, y: 72 },
      { slot_id: "lw", player_id: "f1", role: "FWD", x: 18, y: 28 },
      { slot_id: "ls", player_id: "f2", role: "FWD", x: 38, y: 17 },
      { slot_id: "st", player_id: "f3", role: "FWD", x: 50, y: 15 },
      { slot_id: "rw", player_id: "f4", role: "FWD", x: 82, y: 28 },
    ],
  },
});

render(<TacticsTab gameState={gameState} onSelectPlayer={vi.fn()} onGameUpdate={vi.fn()} />);
expect(screen.getByText(/2-1-4|2-0-4/)).toBeInTheDocument();
```

Adjust expected midfield count based on the exact saved test data.

**Step 2: Implement conversion from backend slots**

Add helper:

```ts
export function buildGridAssignmentsFromTeam(
  customSlots: CustomTacticSlotData[] | undefined,
  formation: string,
  startingXiIds: string[],
): GridTacticAssignment[] {
  if (customSlots?.some((slot) => slot.player_id)) {
    const assignments = buildEmptyGridAssignments();
    for (const customSlot of customSlots) {
      const assignment = assignments.find((slot) => slot.slotId === customSlot.slot_id);
      if (assignment) assignment.playerId = customSlot.player_id;
    }
    return assignments;
  }

  return buildGridAssignmentsFromFormation(formation, startingXiIds);
}
```

**Step 3: Keep preset dropdown behavior**

When the user chooses a formation preset from the pitch dropdown:

- Build new grid assignments from that preset and current XI ids.
- Persist both formation and slots.
- Keep the dropdown label as the preset-derived/current-derived label after save.

**Step 4: Run focused tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx src/components/tactics/TacticsTab.helpers.test.ts
npx tsc --noEmit
```

Expected: PASS.

---

### Task 6: Add engine shape profile and modifiers

**Files:**
- Modify: `src-engine/crates/engine/src/types.rs`
- Modify: `src-engine/crates/engine/src/engine/resolution.rs`
- Modify: `src-engine/crates/ofm_core/src/live_match_manager/team_builder.rs`
- Test: `src-engine/crates/engine/tests/simulation_tests.rs` or create/modify focused engine tests

**Step 1: Write failing Rust tests for shape profile effects**

Add a focused test near existing engine tests:

```rust
#[test]
fn forward_heavy_shape_increases_attack_but_reduces_midfield_and_defense() {
    let balanced = make_team_with_shape("balanced", 4, 4, 2);
    let forward_heavy = make_team_with_shape("forward", 2, 4, 4);

    assert!(forward_heavy.attack_rating() > balanced.attack_rating());
    assert!(forward_heavy.defense_rating() < balanced.defense_rating());
    assert!(forward_heavy.midfield_rating() <= balanced.midfield_rating());
}
```

Use helpers already available in that test file if present. If no helper exists, create the smallest local helper constructing `TeamData` with generated `PlayerData`.

**Step 2: Add shape profile to engine TeamData**

In `src-engine/crates/engine/src/types.rs`, add:

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ShapeProfile {
    pub defenders: u8,
    pub midfielders: u8,
    pub forwards: u8,
}

impl Default for ShapeProfile {
    fn default() -> Self {
        Self { defenders: 4, midfielders: 4, forwards: 2 }
    }
}
```

Add field to `TeamData`:

```rust
#[serde(default)]
pub shape: ShapeProfile,
```

**Step 3: Apply conservative modifiers**

In `TeamData` methods, multiply final ratings with small bounded modifiers:

```rust
impl TeamData {
    fn shape_stability(&self) -> f64 {
        let total = self.shape.defenders + self.shape.midfielders + self.shape.forwards;
        if total != 10 { return 0.92; }
        if self.shape.defenders < 2 || self.shape.midfielders < 2 || self.shape.forwards > 4 { return 0.90; }
        1.0
    }

    fn defense_shape_modifier(&self) -> f64 {
        (0.90 + self.shape.defenders as f64 * 0.035).clamp(0.92, 1.12) * self.shape_stability()
    }

    fn midfield_shape_modifier(&self) -> f64 {
        (0.88 + self.shape.midfielders as f64 * 0.03).clamp(0.90, 1.12) * self.shape_stability()
    }

    fn attack_shape_modifier(&self) -> f64 {
        (0.92 + self.shape.forwards as f64 * 0.045).clamp(0.92, 1.14) * self.shape_stability()
    }
}
```

Apply them to `defense_rating`, `midfield_rating`, and `attack_rating`. Keep modifiers small so player quality still dominates.

**Step 4: Build shape profile in team_builder**

In `src-engine/crates/ofm_core/src/live_match_manager/team_builder.rs`, derive shape from `team.custom_tactic_slots` when present. Fallback to existing `formation_slots(&formation)` counts.

Pseudo-code:

```rust
let shape = match team {
    Some(t) if !t.custom_tactic_slots.is_empty() => shape_from_custom_slots(&t.custom_tactic_slots),
    Some(t) => shape_from_formation(&t.formation),
    None => ShapeProfile::default(),
};
```

When converting players to engine `PlayerData`, use the assigned custom slot group for the player's engine position if custom slots exist. Fallback remains natural player group.

**Step 5: Run Rust tests**

Run from repo root or `src-engine` as appropriate:

```bash
cargo test -p engine
cargo test -p ofm_core live_match
```

If crate names differ, run the nearest existing commands listed in `src-engine/Cargo.toml`.

Expected: PASS.

---

### Task 7: Add validation and user feedback for invalid grid setups

**Files:**
- Modify: `src/components/tactics/TacticsTab.helpers.ts`
- Modify: `src/components/tactics/TacticsTab.tsx`
- Modify: `src/components/tactics/TacticsPitch.tsx`
- Test: `src/components/tactics/TacticsTab.helpers.test.ts`
- Test: `src/components/tactics/TacticsTab.test.tsx`

**Step 1: Write failing validation tests**

Add helper tests:

```ts
import { validateGridAssignments } from "./TacticsTab.helpers";

it("requires exactly one goalkeeper and ten outfield players", () => {
  expect(validateGridAssignments([]).valid).toBe(false);
});

it("rejects duplicate player assignments", () => {
  const assignments = buildEmptyGridAssignments();
  assignments[0].playerId = "same";
  assignments[1].playerId = "same";

  expect(validateGridAssignments(assignments).valid).toBe(false);
});
```

**Step 2: Implement validation helper**

```ts
export function validateGridAssignments(assignments: GridTacticAssignment[]): {
  valid: boolean;
  reason: "missingGoalkeeper" | "tooManyOutfield" | "duplicatePlayer" | "incompleteXi" | null;
} {
  const assigned = assignments.filter((slot) => slot.playerId);
  const ids = assigned.map((slot) => slot.playerId as string);
  if (new Set(ids).size !== ids.length) return { valid: false, reason: "duplicatePlayer" };

  const assignedBySlot = new Map(assignments.map((slot) => [slot.slotId, slot.playerId]));
  if (!assignedBySlot.get("gk")) return { valid: false, reason: "missingGoalkeeper" };
  if (assigned.length !== 11) return { valid: false, reason: "incompleteXi" };
  if (assigned.filter((slot) => slot.slotId !== "gk").length > 10) return { valid: false, reason: "tooManyOutfield" };

  return { valid: true, reason: null };
}
```

**Step 3: Show compact feedback in the pitch header**

If invalid, show a small amber/red badge such as:

- `Needs 11 players`
- `GK required`
- `Duplicate player`

Disable persistence or rollback invalid drops if the operation would break rules. Prefer preventing duplicate assignment by moving the player rather than duplicating it.

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.helpers.test.ts src/components/tactics/TacticsTab.test.tsx
npx tsc --noEmit
```

Expected: PASS.

---

### Task 8: Final verification and manual UI check

**Files:**
- No source edits unless verification finds issues.

**Step 1: Run focused frontend tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx src/components/tactics/TacticsTab.helpers.test.ts src/components/squad/SquadTab.helpers.test.ts
```

Expected: PASS.

**Step 2: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 3: Run relevant Rust tests**

Run:

```bash
cargo test -p engine
cargo test -p ofm_core
```

If workspace commands differ, inspect `src-engine/Cargo.toml` and run equivalent focused tests.

Expected: PASS.

**Step 4: Run broader regression tests**

Run:

```bash
npx vitest run src/components/tactics/TacticsTab.test.tsx src/components/squad/SquadTab.test.tsx src/pages/Dashboard.test.tsx
```

Expected: PASS.

**Step 5: Manual UI verification**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Open `/dashboard` and go to Tactics. Verify:

- Grid placeholders are visible and styled consistently with the current template pitch.
- Formation label changes after moving players between lines.
- Preset formation dropdown fills the expected slots.
- Bench-to-pitch drag/drop persists.
- Pitch click select/compare/swap still works.
- Play Style sidebar switch still works.
- Player Roles, Set Pieces, Team Instructions, and Analysis tabs still work.
- A match can start/simulate with custom slots and no obvious errors.

**Step 6: Report status**

Report changed areas, tests run, and any manual UI limitations. Do not commit or push unless the user explicitly asks.
