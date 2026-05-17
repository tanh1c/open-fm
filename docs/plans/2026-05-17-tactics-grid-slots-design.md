# Tactics Grid Slots Design

## Goal

Add a grid-slot tactics editor to the Tactics overview so managers can create custom shapes by placing players into pitch placeholders, while preserving existing lineup, formation, play-style, role, and match-engine behavior.

## User experience

The Tactics overview pitch becomes the primary editor. Instead of rendering only the slots implied by a fixed formation string, the pitch exposes a fixed grid of tactical placeholders:

- GK: one goalkeeper slot.
- Defense: LB, LCB, CB, RCB, RB.
- Defensive midfield: LDM, DM, RDM.
- Midfield: LM, LCM, CM, RCM, RM.
- Attacking midfield: LW, LAM, AM, RAM, RW.
- Forward: LS, ST, RS.

Players can be dragged between occupied slots, empty placeholders, and the bench. Empty placeholders remain visible but subdued. Valid drop targets highlight green; out-of-position assignments keep the existing warning tone. Clicking a placed player keeps the current select/compare/swap behavior.

## Formation derivation

The displayed formation label is derived from occupied slots rather than treated as the source of truth. The goalkeeper is excluded. Occupied outfield slots are counted into three display lines:

- Defender line: LB, LCB, CB, RCB, RB.
- Midfielder line: DM, CM, wide midfield, and attacking midfield slots.
- Forward line: LS, ST, RS, and high wide forward slots.

Examples:

- 2 defenders, 4 midfielders, 4 forwards -> `2-4-4`.
- 4 defenders, 5 midfielders, 1 forward -> `4-5-1`.

Preset formations such as `4-4-2` and `4-2-3-1` remain available as quick-fill actions. Choosing a preset fills the matching grid slots, then the manager can adjust manually.

## Data model

Keep existing fields working:

- `team.formation`
- `team.starting_xi`
- `team.play_style`

Add a custom slot assignment layer for teams that have edited grid tactics:

```ts
type CustomTacticSlot = {
  slot_id: string;
  player_id: string | null;
  role: "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD";
  x: number;
  y: number;
};
```

Older saves that do not contain custom slots should load normally. The frontend can derive default slot assignments from the current formation and starting XI.

## Engine interpretation

The engine currently consumes a team formation string, play style, and starting XI players mapped into broad positions: Goalkeeper, Defender, Midfielder, Forward. Grid slots should therefore be translated into those engine position groups first:

- GK -> Goalkeeper.
- Defense slots -> Defender.
- DM, midfield, wide midfield, and AM slots -> Midfielder.
- Striker and high wide forward slots -> Forward.

Then shape modifiers should influence ratings using Football Manager-style principles without copying exact formulas:

- More defenders improve defensive protection and compactness but reduce attacking transition.
- More midfielders improve midfield control, possession stability, and pressing support.
- More forwards improve box presence and shot threat but weaken midfield and defensive protection.
- Extreme shapes receive stability/compactness penalties to prevent exploits.
- Out-of-position players remain penalized by assignment suitability.

## Initial constraints

The first implementation should stay intentionally bounded:

- Exactly one goalkeeper slot must be occupied.
- At most 10 outfield players can be assigned.
- No duplicate player assignments.
- No free x/y dragging yet; use fixed placeholders only.
- Do not add deep tactical roles such as inverted winger, ball-winning midfielder, or advanced playmaker in this step.
- Preserve current drag/drop, click select/compare/swap, formation preset, play-style, role, and set-piece features.

## Verification targets

- Existing Tactics tests continue to pass after being updated for grid slots.
- New tests cover derived formation labels, preset fill, duplicate prevention, goalkeeper validation, and engine position mapping.
- TypeScript, frontend tests, and relevant Rust engine tests pass before completion.
