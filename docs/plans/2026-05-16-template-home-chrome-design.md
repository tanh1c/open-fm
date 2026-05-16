# Template Home + Chrome Design

**Goal:** Port the UI/UX style from `FE_template/untitled` into the current app's dashboard chrome and Home page without changing game logic.

**Approved approach:** Port style and layout into existing components rather than copying the template components wholesale.

## Source Template

The reference template uses:

- Full-height shell: left sidebar, top header, scrollable content area.
- Palette: charcoal background `#11161d`, card surface `#181f29`, border `#232d3b`, teal accent `#2dd4bf`, muted text `#94a3b8`.
- Typography: Inter body, compact 10-12px uppercase widget headers.
- Chrome: 256px sidebar with icon navigation, pinned Next Match widget, bottom settings area; 80px top header with season/reputation pills, search, notification buttons, manager profile.
- Home layout: main column plus 320px right sidebar. Main column has Upcoming Match + Tactics top row, Squad Overview middle row, Team Form + Goals Analysis + Transfer Activity bottom row. Right sidebar has League Table, Squad Status, Upcoming Fixtures, Training Overview.

## Current App Integration

Keep all existing data flow and navigation in place:

- `src/pages/Dashboard.tsx` remains the owner of save/continue/search/profile navigation and match-day flow.
- `src/components/home/HomeTab.tsx` remains the owner of Home-page composition and uses existing `gameState` plus helper/adapters.
- Existing Rust/WASM/backend game logic is untouched.
- Existing app tabs continue to work; this design only targets dashboard chrome and Home presentation.

## Component Mapping

- Template `Header.tsx` maps to restyled `src/components/layout/TopbarV2.tsx`.
- Template `Sidebar.tsx` maps to restyled `src/components/layout/SidebarV2.tsx`.
- Template `Card.tsx` maps to the app's `src/components/ui/Card.tsx` styling and/or Home-card classes.
- Template `Dashboard.tsx` maps to `src/components/home/HomeTab.tsx` layout.
- Template widgets map to current app cards:
  - `UpcomingMatch` → `NextMatchDisplay` / `HomeNextOpponentCard` presentation.
  - `Tactics` → `TacticsFormationCard`.
  - `SquadOverview` → `SquadOverviewTable`.
  - `TeamForm` → `FormChartCard`.
  - `GoalsAnalysis` → `GoalsAnalysisCard`.
  - `TransferActivity` → new/preserved Home transfer summary if current data supports it.
  - Right sidebar widgets → existing league position, squad overview, recent fixtures/results, training summary cards.

## Data Rules

Do not add template mock data. Every displayed value must come from `gameState` or an existing safe fallback:

- Missing template-only fields such as weather or photo avatars may be omitted or rendered as neutral placeholders.
- Navigation buttons use existing `onNavigate` handlers.
- Save, continue, match mode, inbox, settings, and exit flows remain unchanged.

## Styling Rules

- Add or map theme tokens for the template palette using existing Tailwind v4 `@theme` in `src/App.css`.
- Prefer existing token names when possible; if adding `app-*` aliases, keep them as theme aliases to avoid scattering raw hex values.
- Use rounded-xl, slim borders, teal hover/focus states, compact uppercase headers, and dense table styling matching the template.
- Avoid introducing new dependencies such as `recharts`; keep existing inline SVG cards.

## Verification

For each implementation slice:

1. Run focused tests for modified components.
2. Run `npx tsc --noEmit`.
3. Run `npx vitest run` before declaring completion.
4. Run `npm run build` before final handoff.

Frontend smoke testing should verify Home golden path, sidebar navigation, search/profile navigation, continue/save action bar, and unemployed manager state.
