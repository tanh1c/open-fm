# Tournaments Redesign Design

## Goal

Redesign `http://localhost:1420/tournaments` to match the shared dashboard UI style while preserving all current tournament logic and interactions.

## Selected approach

Use a hybrid dashboard layout:

- Header and competition selector inspired by Schedule.
- Main content structured like the newer dashboard pages with a left insight rail, center primary module, and right detail rail.
- Awards and top scorers remain visible as tournament context instead of becoming isolated legacy cards.

## Layout

The page uses `mx-auto flex min-h-max max-w-[1700px] flex-col gap-4` and a fixed-height workspace for dense content.

Top header:

- Title: `TOURNAMENTS`.
- Subtitle: selected competition, season, team count.
- Right-side chips for progress, completed matches, goals, and competition category counts.
- Competition selector styled with `app-*` classes.

Workspace:

- Left rail: competition summary, season/preseason status, competition category breakdown.
- Center module: tabbed primary content for Overview, Standings, Fixtures, and Awards.
- Right rail: top scorers, user/leader snapshots, quick tournament stats.

## Behavior to preserve

- Competition selection.
- Tabs: Overview, Standings, Fixtures, Awards.
- Preseason hint and standings-locked state.
- Knockout no-standings state.
- Fixture grouping by matchday/round.
- Context menus for team/player navigation.
- Awards lazy loading and retry via `invoke("get_season_awards")`.

## Implementation constraints

- Do not change backend data, routing, or game state shape.
- Do not remove existing actions or test IDs used by current tests.
- Prefer local helper components inside `TournamentsTab.tsx`.
- Use the shared dashboard style guide from `docs/dashboard-page-design.md`.

## Verification

Run:

1. `npx tsc --noEmit`
2. `npx vitest run src/components/tournaments/TournamentsTab.test.tsx`

Manual check:

1. Open `http://localhost:1420/tournaments`.
2. Switch competitions if multiple exist.
3. Test Overview, Standings, Fixtures, and Awards tabs.
4. Right-click standings, fixtures, top scorers, and award rows to confirm navigation actions still work.
5. Confirm layout matches Schedule/Teams/Players dashboard style.
