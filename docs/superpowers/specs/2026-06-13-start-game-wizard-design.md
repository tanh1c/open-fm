# Start Game Wizard Redesign

## Goal

Redesign the new-game setup flow so players choose the game shape before choosing the data source. The approved flow is:

```text
Main menu
  → Create Manager
  → Choose Game Mode
      - Club Career
      - World Cup 2026
  → Choose Data Source
      - Generated
      - FC26 Real
  → Start world generation
  → Team Selection
```

This keeps the backend world-source IDs unchanged while making the UX clearer and more game-like.

## Approved user choices

- Use a wizard-style setup flow.
- Game mode labels: `Club Career` and `World Cup 2026`.
- Data source labels: `Generated` and `FC26 Real`.
- Data source descriptions change depending on the selected game mode.
- Team selection should use separate UX by mode:
  - Club Career: `Country → Division → Club`.
  - World Cup 2026: `Confederation → National Team`.

## MainMenu architecture

`src/pages/MainMenu.tsx` should keep the existing main menu, create-manager form, load-game flow, save loading, and app exit behavior.

The new-game flow should use explicit wizard state instead of treating built-in game modes as a flat world database list.

Suggested types:

```ts
type MenuState = "main" | "create" | "load";
type NewGameStep = "manager" | "mode" | "data";
type GameMode = "club" | "worldcup";
type DataSource = "generated" | "fc26";
```

The backend world source should be derived in one place:

```ts
function resolveWorldSource(mode: GameMode, dataSource: DataSource): string {
  if (mode === "club" && dataSource === "generated") return "random";
  if (mode === "club" && dataSource === "fc26") return "fc26_real";
  if (mode === "worldcup" && dataSource === "generated") return "worldcup2026";
  return "worldcup2026_fc26";
}
```

`handleStartGame` should continue using:

- `start_new_game` for built-in modes.
- `start_new_game_with_world` for imported custom JSON.

The generated `GameStateData` should still be stored through `setGameState(game)`, then navigate to `/select-team`.

## Wizard UI

### Create Manager

Keep the existing `CreateManagerForm` and validation behavior, including DOB validation and random manager generation.

After a valid submit, go to the mode step instead of a flat world database picker.

### Choose Game Mode

Show two large selectable cards:

```text
Club Career
Long-term club management: leagues, transfers, finances, youth, staff.

World Cup 2026
Standalone national-team tournament with 48 countries.
```

Footer actions:

```text
Back → Manager
Continue → Data Source
```

The selected card should use the current menu visual language: rounded cards, border/ring highlight, gradient or primary accent.

### Choose Data Source

Show two selectable cards with short labels:

```text
Generated
FC26 Real
```

Descriptions should depend on mode:

- Club Career + Generated: generated football world with fictional players and clubs.
- Club Career + FC26 Real: real FC26 player dataset and club squads.
- World Cup + Generated: generated national-team squads for all 48 countries.
- World Cup + FC26 Real: FC26 real players plus call-up selection for countries with deep pools.

Footer actions:

```text
Back → Mode
Start Game
```

### Custom world import

Do not remove the existing custom JSON import feature.

Move it into an `Advanced` section on the data-source step and only show it for `Club Career`. Imported worlds should continue using `start_new_game_with_world` and session storage for `imported_world_json` as the current flow does.

World Cup mode should not show custom world import because it is a fixed 48-team tournament mode.

## TeamSelection architecture

`src/pages/TeamSelection.tsx` should detect World Cup mode from `gameState.world_source`:

- `worldcup2026`
- `worldcup2026_fc26`

Club mode should preserve the current flow:

```text
Country → Division → Club
```

World Cup mode should use a shorter flow:

```text
Confederation → National Team
```

The current intermediate World Cup tier/tournament step should be removed for World Cup mode because there is only one tournament.

## TeamSelection UI behavior

### Club Career

Preserve existing cards and data:

- team logo
- reputation
- squad count
- finances
- average OVR
- stadium information

### World Cup 2026

Use World Cup copy and labels:

- `Confederation` instead of `Country`.
- `National Team` instead of `Club` or `Team`.
- Header/subtitle should guide the user to choose a confederation, then a national team.

World Cup team cards should avoid club-only emphasis. Prefer:

- flag/logo
- reputation or strength
- squad size
- average OVR
- data source badge if straightforward from `world_source`

Hide or de-emphasize:

- finances
- club division/tier language
- club-specific stadium framing if it feels misleading

### FC26 call-up path

For `worldcup2026_fc26`, keep the existing call-up behavior:

```text
Confederation → National Team → Call-up 26 players
```

Rules stay unchanged:

- exactly 26 selected players
- at least 3 goalkeepers
- backend validation through `select_worldcup_team_with_callups`

## Backend scope

No deep backend rewrite is needed. The existing world-source IDs remain authoritative:

```text
random
fc26_real
worldcup2026
worldcup2026_fc26
```

No changes are intended for:

- World Cup tournament scheduling
- FC26 World Cup generation
- call-up validation rules
- dashboard World Cup tab hiding

## Testing and verification

Update or add frontend tests covering world-source mapping:

- Club Career + Generated → `random`
- Club Career + FC26 Real → `fc26_real`
- World Cup 2026 + Generated → `worldcup2026`
- World Cup 2026 + FC26 Real → `worldcup2026_fc26`

Update or add TeamSelection coverage:

- Club mode still shows `Country → Division → Club` flow.
- World Cup mode shows `Confederation → National Team` without the intermediate tournament/division step.
- World Cup FC26 still reaches call-up UI when a team requires squad selection.

Run after implementation:

```bash
npx tsc --noEmit
npx vitest run <relevant-tests>
npm run build
```

Manual smoke test after implementation:

1. Create a Club Career + Generated save.
2. Create a Club Career + FC26 Real save.
3. Create a World Cup + Generated save.
4. Create a World Cup + FC26 Real save and complete call-up selection.
5. Verify each flow reaches the expected team selection/dashboard path.

## Non-goals

- Do not rename backend world-source IDs.
- Do not rewrite Rust world generation.
- Do not remove custom world import.
- Do not redesign the dashboard as part of this work.
- Do not commit or push unless the user explicitly asks.
