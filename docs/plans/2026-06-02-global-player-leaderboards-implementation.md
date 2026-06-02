# Global Player Leaderboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand `/tournaments` player leaderboards so selected competitions can show any competition with recorded player match stats, and add a Global leaderboard with season, country, competition type, and position filters.

**Architecture:** Keep `StatsState.player_matches` as the only source of truth for full player leaderboards. Move shared leaderboard aggregation into `ofm_core::leaderboards`, expose a new stats command for global aggregation, then wire `/tournaments` to a new top-level Global tab and a shortcut from the selected competition Leaderboards tab.

**Tech Stack:** Rust (`ofm_core`, Tauri/app-handle command layer), React + TypeScript (`TournamentsTab.tsx`), Vitest/Testing Library, Cargo tests.

---

## Guardrails

- Do not use fixture scorer arrays as fallback data for the main leaderboards.
- If detailed `StatsState.player_matches` do not exist for a competition/filter, return/render empty leaderboards.
- Do not stage or overwrite unrelated current local modifications in:
  - `src-engine/src/app_handle/season.rs`
  - `src-engine/src/app_handle/time.rs`
  - `src-engine/src/application/vacation.rs`
- Commit/push only if the user explicitly asks.
- Prefer same-session implementation; the user has a standing preference against subagents.

---

## Task 1: Extend core leaderboard DTOs and remove league-only competition filtering

**Files:**
- Modify: `src-engine/crates/ofm_core/src/leaderboards.rs`

**Step 1: Write/adjust core tests for non-league competition records**

Add or update tests in the same module if `leaderboards.rs` already has unit tests; otherwise add a focused test module at the bottom of the file.

Test intent:

```rust
#[test]
fn competition_leaderboards_include_non_league_player_match_records() {
    // Arrange a StatsState with player match records for a DomesticCup or Continental competition.
    // Arrange a matching CompetitionData/team list for that competition.
    // Act with compute_competition_leaderboards(...).
    // Assert top_scorers/top_assists/top_clean_sheets include the cup/continental records.
}
```

Expected before implementation: FAIL because `compute_competition_leaderboards` skips non-league records with `is_league_competition`.

**Step 2: Run focused Rust test**

Run:

```bash
cargo test -p ofm_core --manifest-path src-engine/Cargo.toml leaderboards
```

Expected: FAIL on the new non-league leaderboard test.

**Step 3: Remove the domestic-league-only filter**

In `compute_competition_leaderboards(...)`, remove this condition:

```rust
if !is_league_competition(&record.competition) {
    continue;
}
```

Then delete `is_league_competition(...)` if it becomes unused.

Keep these existing constraints:

```rust
if record.season != season {
    continue;
}
if !team_id_set.contains(record.team_id.as_str()) {
    continue;
}
```

If `PlayerMatchStatsRecord` exposes a stronger competition identifier, prefer matching by identity; otherwise keep the team-membership fallback described in the design.

**Step 4: Ensure stable sorting stays deterministic**

Confirm existing sorting remains value descending, then player name ascending. If needed, centralize with a helper like:

```rust
entries.sort_by(|a, b| b.value.cmp(&a.value).then_with(|| a.player_name.cmp(&b.player_name)));
```

**Step 5: Run focused Rust test again**

Run:

```bash
cargo test -p ofm_core --manifest-path src-engine/Cargo.toml leaderboards
```

Expected: PASS.

---

## Task 2: Add global leaderboard query/response types in core

**Files:**
- Modify: `src-engine/crates/ofm_core/src/leaderboards.rs`

**Step 1: Add failing tests for global aggregation filters**

Add tests covering:

```rust
#[test]
fn global_leaderboards_filter_by_season_country_competition_type_and_position() {
    // Arrange player match records across two seasons, two countries,
    // two competition types, and multiple positions.
    // Act with a GlobalPlayerLeaderboardQuery containing all filters.
    // Assert only matching players appear.
}

#[test]
fn global_leaderboards_empty_filters_return_empty_boards_without_error() {
    // Arrange records that do not match the query.
    // Assert all returned boards are empty, not panics/errors.
}
```

Expected before implementation: FAIL because global types/functions do not exist.

**Step 2: Add serializable DTOs**

Add these structs near existing leaderboard DTOs:

```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GlobalPlayerLeaderboardQuery {
    pub season: Option<u32>,
    pub country: Option<String>,
    pub competition_type: Option<String>,
    pub position: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GlobalPlayerLeaderboards {
    pub season: Option<u32>,
    pub top_scorers: Vec<LeaderboardEntry>,
    pub top_assists: Vec<LeaderboardEntry>,
    pub top_clean_sheets: Vec<LeaderboardEntry>,
    pub appearances: Vec<LeaderboardEntry>,
    pub minutes: Vec<LeaderboardEntry>,
    pub yellow_cards: Vec<LeaderboardEntry>,
    pub red_cards: Vec<LeaderboardEntry>,
    pub average_ratings: Vec<RatingLeaderboardEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingLeaderboardEntry {
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
    pub value: f64,
    pub appearances: u32,
    pub minutes: u32,
}
```

If frontend needs competition/country context per row and backend data is available, extend entries with optional context fields instead of replacing existing `LeaderboardEntry`:

```rust
pub competition_name: Option<String>,
pub country: Option<String>,
```

Only add these fields if they can be populated reliably from current state.

**Step 3: Add aggregation function**

Add:

```rust
pub fn compute_global_player_leaderboards(
    stats: &StatsState,
    teams: &[TeamData],
    competitions: &[CompetitionData],
    query: &GlobalPlayerLeaderboardQuery,
) -> GlobalPlayerLeaderboards {
    // Aggregate matching player match records.
}
```

Implementation notes:

- Build maps for `team_id -> team`, `player_id -> player`, and competition/country metadata from loaded competitions/teams.
- Match filters:
  - `season`: compare to `record.season` when `Some`.
  - `country`: derive from team/competition country where current data exposes it; otherwise use team country if available.
  - `competition_type`: normalize accepted UI values to current enum names:
    - `DomesticLeague`
    - `DomesticCup`
    - `ContinentalLeague`
  - `position`: map broad values to current player positions:
    - `Goalkeeper`
    - `Defender`
    - `Midfielder`
    - `Forward`
- Aggregate per player/team:
  - goals
  - assists
  - clean sheets
  - appearances
  - minutes
  - yellow cards if record exposes them
  - red cards if record exposes them
  - average rating weighted by appearances or minutes, depending current record fields
- Apply limit with `query.limit.unwrap_or(50)`.
- Keep deterministic sorting:
  - counting boards: value desc, player name asc.
  - average rating board: rating desc, player name asc.
- If current `PlayerMatchStatsRecord` lacks cards or ratings, return empty boards for those fields rather than inventing values.

**Step 4: Run focused Rust tests**

Run:

```bash
cargo test -p ofm_core --manifest-path src-engine/Cargo.toml leaderboards
```

Expected: PASS.

---

## Task 3: Expose global leaderboard command through stats commands

**Files:**
- Modify: `src-engine/src/commands/stats/dto.rs`
- Modify: `src-engine/src/commands/stats/mod.rs`
- Modify: `src-engine/src/commands/stats/player.rs` or create `src-engine/src/commands/stats/leaderboards.rs`
- Modify: `src-engine/src/commands/stats/tests.rs`

**Step 1: Add failing command tests**

In `src-engine/src/commands/stats/tests.rs`, add tests for the command/internal function:

```rust
#[test]
fn get_global_player_leaderboards_filters_records() {
    // Build test StateManager with StatsState.player_matches and teams/competitions.
    // Call get_global_player_leaderboards_internal(...).
    // Assert filter and sorting behavior.
}

#[test]
fn get_global_player_leaderboards_returns_empty_for_unknown_filters() {
    // Query a country/type/position with no matches.
    // Assert empty boards and no error.
}
```

Expected before implementation: FAIL because command/internal function does not exist.

**Step 2: Add command DTOs if core DTOs are not directly exported to frontend bindings**

If the command layer already reuses core DTOs cleanly, re-export/use them. Otherwise mirror the core DTOs in `dto.rs`:

```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GlobalPlayerLeaderboardQueryDto {
    pub season: Option<u32>,
    pub country: Option<String>,
    pub competition_type: Option<String>,
    pub position: Option<String>,
    pub limit: Option<usize>,
}
```

Prefer direct core types if they already derive the traits needed by Tauri/WASM bindings.

**Step 3: Add internal implementation**

Create `src-engine/src/commands/stats/leaderboards.rs` if it keeps command code cleaner:

```rust
pub(super) fn get_global_player_leaderboards_internal(
    state: &StateManager,
    query: GlobalPlayerLeaderboardQuery,
) -> Result<GlobalPlayerLeaderboards, String> {
    let snapshot = state.current_snapshot()?;
    Ok(compute_global_player_leaderboards(
        &snapshot.stats,
        &snapshot.teams,
        &snapshot.competitions,
        &query,
    ))
}
```

Adjust snapshot/state access names to the actual patterns used in `player.rs` and `tests.rs`.

**Step 4: Add Tauri command**

In `src-engine/src/commands/stats/mod.rs`:

```rust
#[tauri::command]
pub fn get_global_player_leaderboards(
    state: State<'_, StateManager>,
    query: GlobalPlayerLeaderboardQuery,
) -> Result<GlobalPlayerLeaderboards, String> {
    leaderboards::get_global_player_leaderboards_internal(&state, query)
}
```

Then export/register the module function consistently with existing stats commands.

**Step 5: Run stats command tests**

Run:

```bash
cargo test --manifest-path src-engine/Cargo.toml commands::stats
```

If the workspace does not support that filter cleanly, run the crate test target containing `src-engine/src/commands/stats/tests.rs`.

Expected: PASS.

---

## Task 4: Wire app-handle/WASM access without disturbing unrelated hunks

**Files:**
- Carefully modify: `src-engine/src/app_handle/season.rs` or the existing app-handle module that exposes generated commands
- Check command registration file if needed: `src-engine/src/lib.rs`, `src-engine/src/commands/mod.rs`, or current Tauri builder registry file

**Step 1: Locate existing `get_competition_leaderboards` exposure**

Use current app-handle patterns around:

```rust
get_competition_leaderboards
```

Do not rewrite unrelated parts of `season.rs` because it already has local modifications.

**Step 2: Add a minimal global leaderboard app-handle method if this project requires one**

Mirror the existing competition leaderboard exposure:

```rust
pub fn get_global_player_leaderboards(
    &self,
    query: GlobalPlayerLeaderboardQuery,
) -> Result<GlobalPlayerLeaderboards, String> {
    stats::get_global_player_leaderboards_internal(&self.state, query)
}
```

Use actual `self.state`/module access pattern from the file.

**Step 3: Add command registration**

Where commands are registered for frontend `invoke`, add:

```rust
get_global_player_leaderboards
```

Keep the command name exactly as the frontend will invoke it.

**Step 4: Run engine binding/build check**

Run:

```bash
npm run build:engine
```

Expected: generated bindings update successfully.

If this command modifies generated files, inspect/stage only files related to the new command when committing later.

---

## Task 5: Add frontend types for global leaderboards

**Files:**
- Modify: `src/store/types.ts`

**Step 1: Add TypeScript interfaces**

Add near existing `LeaderboardEntry` and `CompetitionLeaderboards`:

```ts
export interface RatingLeaderboardEntry {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  value: number;
  appearances: number;
  minutes: number;
}

export interface GlobalPlayerLeaderboardQuery {
  season?: number | null;
  country?: string | null;
  competition_type?: string | null;
  position?: string | null;
  limit?: number | null;
}

export interface GlobalPlayerLeaderboards {
  season?: number | null;
  top_scorers: LeaderboardEntry[];
  top_assists: LeaderboardEntry[];
  top_clean_sheets: LeaderboardEntry[];
  appearances: LeaderboardEntry[];
  minutes: LeaderboardEntry[];
  yellow_cards: LeaderboardEntry[];
  red_cards: LeaderboardEntry[];
  average_ratings: RatingLeaderboardEntry[];
}
```

If Rust DTOs include optional `competition_name` or `country`, add optional fields to `LeaderboardEntry` and `RatingLeaderboardEntry` too.

**Step 2: Run TypeScript check later with frontend tests**

No standalone test is needed for types.

---

## Task 6: Add Global tab state and command loading in tournaments UI

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`

**Step 1: Add failing frontend test for Global tab invoke**

In `src/components/tournaments/TournamentsTab.test.tsx`, add:

```tsx
it("loads global player leaderboards from the Global tab", async () => {
  // Render TournamentsTab with competitions and teams.
  // Click the Global tab.
  // Assert invoke was called with "get_global_player_leaderboards" and default filters.
});
```

Expected before implementation: FAIL because the Global tab does not exist.

**Step 2: Extend view union**

Change:

```ts
type TournamentView = "overview" | "fixtures" | ... | "halloffame";
```

Add:

```ts
| "global"
```

**Step 3: Add global leaderboard state**

Add state near existing `leaderboardsByCompetition`:

```ts
const [globalLeaderboards, setGlobalLeaderboards] = useState<GlobalPlayerLeaderboards | null>(null);
const [globalLeaderboardsLoadState, setGlobalLeaderboardsLoadState] = useState<"idle" | "loading" | "error">("idle");
const [globalFilters, setGlobalFilters] = useState<GlobalPlayerLeaderboardQuery>({
  season: currentSeason,
  country: null,
  competition_type: null,
  position: null,
  limit: 50,
});
```

Use the actual current season source already available in `TournamentsTab` props/state.

**Step 4: Add global leaderboard loader**

Add callback/effect:

```ts
const loadGlobalLeaderboards = useCallback(async () => {
  setGlobalLeaderboardsLoadState("loading");
  try {
    const data = await invoke<GlobalPlayerLeaderboards>("get_global_player_leaderboards", {
      query: globalFilters,
    });
    setGlobalLeaderboards(data);
    setGlobalLeaderboardsLoadState("idle");
  } catch {
    setGlobalLeaderboardsLoadState("error");
  }
}, [globalFilters]);

useEffect(() => {
  if (view === "global") {
    void loadGlobalLeaderboards();
  }
}, [view, loadGlobalLeaderboards]);
```

Match existing `invoke` error handling style in the file.

**Step 5: Add tab button**

Add `global` to the tab list rendered in `/tournaments`, ideally first or near `leaderboards`:

```tsx
"global"
```

Label it as:

```tsx
Global
```

**Step 6: Run frontend test**

Run:

```bash
npm test -- TournamentsTab
```

If this project uses a different test script, use the existing command from `package.json`.

Expected: new test should still fail until panel rendering is added in the next task.

---

## Task 7: Render Global leaderboard filters and boards

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Modify: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Add failing test for filters**

Add:

```tsx
it("reloads global player leaderboards when filters change", async () => {
  // Click Global.
  // Change country, competition type, and position filters.
  // Assert invoke receives updated query fields.
});
```

Expected before implementation: FAIL because filters do not exist.

**Step 2: Derive filter options**

Inside `TournamentsTab`, derive:

```ts
const countryOptions = useMemo(() => {
  // All plus countries from loaded competitions/teams.
}, [competitions, teams]);

const competitionTypeOptions = [
  { value: "", label: "All" },
  { value: "DomesticLeague", label: "Domestic League" },
  { value: "DomesticCup", label: "Domestic Cup" },
  { value: "ContinentalLeague", label: "Continental" },
];

const positionOptions = [
  { value: "", label: "All" },
  { value: "Goalkeeper", label: "Goalkeeper" },
  { value: "Defender", label: "Defender" },
  { value: "Midfielder", label: "Midfielder" },
  { value: "Forward", label: "Forward" },
];
```

Use existing country/competition field names from `src/store/types.ts` and current `TournamentsTab.tsx` data.

**Step 3: Create `GlobalLeaderboardsPanel` in the same file**

Add a local component below `LeaderboardsPanel`:

```tsx
function GlobalLeaderboardsPanel({
  leaderboards,
  loadState,
  filters,
  onFiltersChange,
  countryOptions,
  onSelectPlayer,
  onSelectTeam,
}: Props) {
  // Render filter controls and board cards.
}
```

Keep visual language aligned with existing leaderboard cards/tables.

Render boards:

- Goals
- Assists
- Average rating
- Clean sheets
- Appearances
- Minutes
- Cards

For card boards, show yellow/red separately or combine in two small columns depending current layout constraints.

**Step 4: Add empty/error/loading states**

Follow existing `LeaderboardsPanel` patterns:

- loading: clear loading message/spinner text
- error: concise error state
- empty: “No detailed player match stats found for these filters.”

**Step 5: Wire navigation handlers**

Rows must use existing player/team navigation behavior:

```tsx
onSelectPlayer(entry.player_id)
onSelectTeam(entry.team_id)
```

Use the same context menu/click pattern as existing leaderboard rows.

**Step 6: Render panel for `view === "global"`**

Add:

```tsx
{view === "global" ? (
  <GlobalLeaderboardsPanel ... />
) : null}
```

**Step 7: Run frontend tests**

Run:

```bash
npm test -- TournamentsTab
```

Expected: PASS.

---

## Task 8: Add shortcut from competition Leaderboards to Global

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Modify: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Add failing test for shortcut**

Add:

```tsx
it("opens the Global leaderboard from the competition leaderboards panel", async () => {
  // Navigate to a competition Leaderboards tab.
  // Click View Global Leaderboard.
  // Assert the Global panel appears and invokes get_global_player_leaderboards.
});
```

Expected before implementation: FAIL because shortcut does not exist.

**Step 2: Extend `LeaderboardsPanel` props**

Add:

```ts
onViewGlobal: () => void;
```

**Step 3: Render action button/link inside `LeaderboardsPanel`**

Place near the panel heading:

```tsx
<button type="button" onClick={onViewGlobal}>
  View Global Leaderboard
</button>
```

Style using existing button classes/tokens in `TournamentsTab.tsx`.

**Step 4: Wire parent handler**

When rendering `LeaderboardsPanel`:

```tsx
onViewGlobal={() => setView("global")}
```

Optionally pre-fill filters from the selected competition if easy and reliable:

- country from selected competition/team country
- competition type from selected competition kind

Do not add this prefill if it complicates the state or risks wrong filters.

**Step 5: Run frontend tests**

Run:

```bash
npm test -- TournamentsTab
```

Expected: PASS.

---

## Task 9: Full verification

**Files:**
- No implementation files unless fixing test/build failures.

**Step 1: Format Rust**

Run:

```bash
cargo fmt --manifest-path src-engine/Cargo.toml
```

Expected: completes without changes outside intended Rust files.

**Step 2: Run core leaderboard tests**

Run:

```bash
cargo test -p ofm_core --manifest-path src-engine/Cargo.toml leaderboards
```

Expected: PASS.

**Step 3: Run stats command tests**

Run:

```bash
cargo test --manifest-path src-engine/Cargo.toml commands::stats
```

If this filter is not accepted, run the smallest valid crate/test target that includes `src-engine/src/commands/stats/tests.rs`.

Expected: PASS.

**Step 4: Build generated engine bindings**

Run:

```bash
npm run build:engine
```

Expected: PASS.

**Step 5: Run frontend tests**

Run:

```bash
npm test -- TournamentsTab
```

Expected: PASS.

**Step 6: Run full production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist` generated.

**Step 7: Inspect git diff before any commit**

Run:

```bash
git status --short
git diff -- src-engine/crates/ofm_core/src/leaderboards.rs src-engine/src/commands/stats/dto.rs src-engine/src/commands/stats/mod.rs src-engine/src/commands/stats/player.rs src-engine/src/commands/stats/leaderboards.rs src-engine/src/commands/stats/tests.rs src-engine/src/app_handle/season.rs src/store/types.ts src/components/tournaments/TournamentsTab.tsx src/components/tournaments/TournamentsTab.test.tsx
```

Expected:

- Only intended leaderboard-related hunks are present.
- Existing unrelated changes in `time.rs` and `vacation.rs` are not staged.
- Any `season.rs` hunk is limited to command/app-handle exposure for global leaderboards.

---

## Suggested commit plan, only if the user asks

If the user asks to commit after implementation, stage only relevant files explicitly:

```bash
git add docs/plans/2026-06-02-global-player-leaderboards-implementation.md \
  src-engine/crates/ofm_core/src/leaderboards.rs \
  src-engine/src/commands/stats/dto.rs \
  src-engine/src/commands/stats/mod.rs \
  src-engine/src/commands/stats/leaderboards.rs \
  src-engine/src/commands/stats/tests.rs \
  src-engine/src/app_handle/season.rs \
  src/store/types.ts \
  src/components/tournaments/TournamentsTab.tsx \
  src/components/tournaments/TournamentsTab.test.tsx
```

Then commit with:

```bash
git commit -m "feat(stats): add global player leaderboards"
```

Do not push unless the user explicitly asks.
