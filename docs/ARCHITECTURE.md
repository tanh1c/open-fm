# Architecture

Open Futball Manager is a web-first football management simulation built with **React** (TypeScript frontend) and a **Rust engine compiled to WebAssembly**. The engine runs entirely in the browser inside a Web Worker; there is no native backend or server. This document describes the project structure, key architectural decisions, and how the pieces fit together.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Browser + WebAssembly | Web-first game shell and Rust engine execution |
| **Engine host** | Web Worker (Comlink) | Runs the WASM engine off the main thread |
| **Backend engine** | Rust workspace → WASM | Game logic, simulation, persistence, WASM bindings |
| **Persistence** | SQLite (`sqlite-wasm`) on OPFS | Per-save databases in the Origin Private File System |
| **Frontend** | React + TypeScript | UI rendering, user interaction |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **State (frontend)** | Zustand | Lightweight stores for game and settings |
| **i18n** | i18next + react-i18next | Internationalization (8 locales) |
| **Build** | Vite | Frontend bundler and dev server |

---

## Project Structure

```
openfootmanager/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # Reusable UI components
│   │   ├── match/                # Match day sub-components
│   │   └── ui/                   # Design system primitives (Badge, ThemeToggle)
│   ├── context/                  # React contexts (ThemeContext)
│   ├── core/                     # WASM engine bridge (Web Worker + invoke() shim)
│   │   ├── wasmCore.ts           # Main-thread shim: engine proxy + Tauri-compatible invoke()
│   │   ├── engineWorker.ts       # Comlink Web Worker hosting the WASM AppHandle
│   │   ├── engineCommands.generated.ts  # Auto-generated snake_case → AppHandle method map
│   │   └── appWindow.ts          # Window/runtime helpers
│   ├── i18n/                     # Internationalization config + locale files
│   │   └── locales/              # en, de, es, fr, it, pt, pt-BR, zh-CN (8 locales)
│   ├── lib/                      # Shared utilities (helpers.ts, countries.ts)
│   ├── pages/                    # Route-level pages
│   ├── services/                 # Frontend command wrappers (call invoke())
│   ├── store/                    # Zustand stores (gameStore, settingsStore)
│   ├── utils/                    # Frontend helpers and i18n adapters
│   ├── App.tsx                   # Router setup
│   └── main.tsx                  # Entry point (bootstraps the engine worker)
├── src-engine/                   # Rust engine/workspace + WASM command bridge
│   ├── src/                      # WASM-facing AppHandle command surface
│   │   ├── app_handle/           # #[wasm_bindgen] AppHandle + per-domain command bindings
│   │   ├── application/          # Reusable business-logic services (vacation, time, etc.)
│   │   ├── commands/             # Command modules shared by the AppHandle layer
│   │   └── lib.rs                # WASM-only library entry point
│   ├── crates/
│   │   ├── domain/               # Pure data types (no logic)
│   │   ├── engine/               # Match simulation engine
│   │   ├── ofm_core/             # Game logic, state, turn processing
│   │   ├── db/                   # Save/load persistence (SQLite on OPFS)
│   │   └── engine_wasm/          # Standalone match-sim WASM package boundary
│   └── examples/                 # Native benchmark and diagnostic entry points
├── docs/                         # Documentation
├── public/                       # Static assets
└── images/                       # Branding assets
```

---

## Crate Architecture

The Rust backend is organized into 4 crates with clear dependency boundaries:

```
                  ┌──────────────┐
                  │  AppHandle   │  src-engine/src/app_handle/
                  │ (#[wasm_     │  (single #[wasm_bindgen] entry surface)
                  │  bindgen])   │
                  └──────┬───────┘
                         │
                  ┌──────┴────────┐
                  │  application/ │  Reusable services (vacation, time, ...)
                  └──────┬────────┘
                         │
                    ┌────┴─────┐
                    │ ofm_core │  Game logic, turn processing, state
                    └──┬───┬───┘
                       │   │
              ┌────────┘   └────────┐
         ┌────┴───┐           ┌─────┴────┐
         │ engine │           │    db    │
         │        │           │          │
         └────────┘           └──────────┘
              │
         ┌────┴───┐
         │ domain │  Pure data types (shared by all)
         └────────┘
```

The browser never calls the engine directly. The React app calls `invoke('snake_case_cmd', { args })` (or the typed `engine` proxy), which `src/core/wasmCore.ts` forwards over Comlink to the Web Worker, where the WASM `AppHandle` method runs.

### `domain` — Pure Data Types

Contains only structs and enums with no game logic. All other crates depend on it.

- **`player.rs`** — `Player`, `PlayerAttributes` (18 attributes), `Position`, `PlayerTrait` (20 traits), `PlayerSeasonStats`, `Injury`, `TransferOffer`
- **`team.rs`** — `Team`, `PlayStyle`, `TrainingFocus`, `TrainingIntensity`, `TrainingSchedule`, `TeamColors`
- **`staff.rs`** — `Staff`, `StaffRole` (4 roles), `CoachingSpecialization` (7 specializations), `StaffAttributes`
- **`manager.rs`** — `Manager`, `ManagerCareerStats`, `ManagerCareerEntry`
- **`league.rs`** — `League`, `Fixture`, `StandingEntry`, `MatchResult`, `GoalEvent`
- **`message.rs`** — `InboxMessage`, `MessageCategory` (15 categories), `MessagePriority`, `MessageAction`, `ActionType`
- **`news.rs`** — `NewsArticle`, `NewsCategory` (8 categories), `NewsMatchScore`

**Design decision**: Domain types use `#[serde(default)]` extensively on newer fields for backward compatibility with old save files.

### `engine` — Match Simulation

Self-contained simulation engine, deliberately **decoupled from `domain`**. Defines its own mirror types (`PlayerData`, `TeamData`, `Position`, `PlayStyle`) so it can be tested and evolved independently.

See [MATCH_SIMULATION.md](MATCH_SIMULATION.md) for full details.

- **`engine/`** — Instant full-match simulation (`simulate()`, `simulate_with_rng()`) plus zone resolution and fouls
- **`live_match/`** — Step-by-step `LiveMatchState` with phase management, commands, substitutions, penalty shootout
- **`ai.rs`** — AI manager decisions (`AiProfile`, `ai_decide()`)
- **`types.rs`** — Engine-specific data types and `MatchConfig`
- **`event.rs`** — `MatchEvent` + `EventType` (29 variants)
- **`report.rs`** — `MatchReport`, `TeamStats`, `PlayerMatchStats`, `GoalDetail`

### `ofm_core` — Game Logic

The core game loop — ties domain, engine, and all game systems together.

- **`game.rs`** — `Game` struct (the root game state: clock, manager, teams, players, staff, messages, news, legacy league, and `competitions`)
- **`clock.rs`** — `GameClock` with date tracking and day advancement
- **`state.rs`** — `StateManager` with `Mutex<Option<Game>>` and `Mutex<Option<LiveMatchSession>>` for safe access from the engine worker
- **`turn/`** — Day processing: match simulation, domain↔engine conversion, stats application, news generation, post-match handling, round summaries
- **`training/`** — Training system: attribute gains, condition management, staff bonuses, fitness warnings
- **`schedule.rs`** — Round-robin league schedule generation (circle method) and domestic cup brackets
- **`generator/`** — World generation: name/team definition loading, player/staff/team creation, multi-league/cup scheduling
- **`live_match_manager/`** — `LiveMatchSession` wrapping the engine's `LiveMatchState` with RNG, AI profiles
- **`messages/`** — Inbox message generation (welcome, match previews/results, board directives, etc.)
- **`transfers.rs`** — Transfer market: incoming offers, bids, negotiation, loans, free agents, shortlist
- **`contracts.rs` / `delegated_renewals.rs` / `contract_wage_policy.rs`** — Contract renewals (incl. assistant-delegated) and wage policy
- **`finances.rs`** — Wages, matchday income, sponsorship, finance warnings
- **`job_offers.rs`** — Vacancy-backed job opportunities, direct applications, offer responses, and offer expiry
- **`firing.rs`** — Board warning/firing flow and managerial-change dismissal news
- **`ai_hiring.rs`** — AI manager seeding, vacancy aging, and delayed replacement hires
- **`board_objectives.rs`** — Board objective messages and objective tracking
- **`end_of_season.rs` / `season_context.rs` / `season_awards.rs`** — Season rollover, promotion/relegation, context refresh, awards
- **`news/`** — News article generation (match reports, league roundups, standings, season previews, managerial appointments)

### `db` — Persistence

Save/load functionality, backed by SQLite (`sqlite-wasm`) on OPFS in the browser:

- **`save_manager.rs`** — Save slot orchestration, load/save flows, and round-trip tests
- **`game_database.rs`** / **`migrations.rs`** — Per-save DB open + `rusqlite_migration` schema (currently V27)
- **`game_persistence.rs`** — `Game` serialization/deserialization between runtime state and storage records
- **`app_db.rs`** / **`save_index_manager.rs`** — App-level DB holding the save index/manifest
- **`opfs.rs`** — OPFS sahpool VFS bootstrap (wasm32 only)
- **`repositories/`** — SQLite repositories for teams, players, staff, manager, league, messages, news, meta, objectives, scouting, and stats

---

## State Management

### Engine State

The `StateManager` (in `ofm_core/state.rs`) holds the active game and live match session behind `Mutex` locks:

```rust
pub struct StateManager {
    pub active_game: Mutex<Option<Game>>,
    pub live_match: Mutex<Option<LiveMatchSession>>,
}
```

It is owned by the `AppHandle` inside the engine Web Worker and accessed by every command binding via `self.state`.

**Key pattern**: Commands acquire the mutex, clone the `Game` for return, and release the lock. Mutations happen inside the lock scope.

### Frontend State

Two Zustand stores:

- **`gameStore`** — Active game state (`GameStateData`), manager info, `hasActiveGame` flag. Updated after every engine command that returns game state.
- **`settingsStore`** — `AppSettings` (theme, language, currency, match preferences). Loaded once on Settings page mount, persisted via engine commands.

---

## Engine Command Interface

The frontend never talks to the WASM engine directly. All frontend↔engine communication is dispatched through `src/core/wasmCore.ts`, which exposes two surfaces:

1. A **Tauri-compatible `invoke()` shim** — `invoke('snake_case_cmd', { camelCaseArg })`. This lets the 50+ existing service files keep their imports unchanged. The shim looks up the command in `engineCommands.generated.ts` (an auto-generated map of `snake_case` command → `AppHandle` camelCase method + positional arg order) and forwards the call.
2. A **typed `engine` proxy** — `engine.someCommand(...)` for new code.

Both surfaces forward over [Comlink](https://github.com/GoogleChromeLabs/comlink) to `engineWorker.ts`, the Web Worker that hosts the WASM `AppHandle`. The command itself is a `#[wasm_bindgen]` method defined in `src-engine/src/app_handle/`. Command names below use the `snake_case` form accepted by `invoke()`.

### Game Lifecycle Commands

> The tables below list the core commands. The full surface (transfers, contracts, job offers, season rollover, scouting, finances, vacation, etc.) is larger — see `engineCommands.generated.ts` for the complete, always-current list.

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `list_world_databases` | — | `Vec<WorldDatabaseInfo>` | Scan for available world databases |
| `start_new_game` | first_name, last_name, dob, nationality, world_source? | — | Create game, generate or load world |
| `select_team` | team_id | `Game` | Assign manager to a team |
| `get_active_game` | — | `GameStateData` | Get current game state |
| `advance_time` | — | `Game` | Advance one day |
| `advance_time_with_mode` | mode | `{action, game?, snapshot?}` | Advance with match mode preference |
| `advance_to_date` | target_date, settings | `{action, game?, report?, ...}` | Vacation: fast-forward to a date with assistant delegation |
| `skip_to_match_day` | — | `Game` | Fast-forward to next fixture |
| `save_game` | — | — | Persist current game |
| `load_game` | save_id | — | Load a saved game |
| `exit_to_menu` | — | — | Save and clear active game |

### Match Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `start_live_match` | fixture_index, mode, allows_extra_time | `MatchSnapshot` | Initialize a live match session |
| `step_live_match` | minutes | `Vec<MinuteResult>` | Advance simulation by N minutes |
| `apply_match_command` | command | `MatchSnapshot` | Send a tactical command |
| `get_match_snapshot` | — | `MatchSnapshot` | Get current match state |
| `finish_live_match` | — | `Game` | Apply results and clean up |

### Team Management Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `set_formation` | formation | `Game` | Change team formation |
| `set_play_style` | play_style | `Game` | Change play style |
| `set_training` | focus, intensity | `Game` | Set training focus and intensity |
| `set_training_schedule` | schedule | `Game` | Set weekly training schedule |
| `hire_staff` | staff_id | `Game` | Hire an unattached staff member |
| `release_staff` | staff_id | `Game` | Release a staff member |

### Settings Commands

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_settings` | — | `AppSettings` | Load settings from `app.db` |
| `save_settings` | settings | — | Persist settings |
| `clear_all_saves` | — | — | Delete all save files |
| `export_world_database` | — | `String` | Export the active world to JSON |

---

## Data Flow

### New Game Flow

```
MainMenu → Create Manager → Choose World → Choose Team → Dashboard
    │              │               │              │
    │         form input     generate_world   select_team
    │                        or load JSON      command
    │                             │              │
    │                        ┌────┴────┐    ┌────┴────┐
    │                        │Generator│    │  Game   │
    │                        │  +JSON  │    │ created │
    │                        └─────────┘    └─────────┘
```

### Daily Turn Flow

```
Dashboard → "Continue" button → advance_time_with_mode
                                        │
                           ┌────────────┼────────────┐
                           │            │            │
                      No match     Live match    Delegate
                           │            │            │
                    process_day()  start_live    simulate
                           │       _match()     instantly
                    ┌──────┴──────┐     │            │
                    │ Training    │  Navigate     apply
                    │ + Recovery  │  to /match    results
                    │ + Messages  │     │            │
                    │ + Clock++   │  [interactive]   │
                    └─────────────┘     │      ┌─────┴─────┐
                                   finish_live  Return to
                                   _match()     Dashboard
                                        │
                                   apply results
                                   + news + clock
```

---

## Frontend Architecture

### Routing

The router (`App.tsx`) defines three standalone routes plus a set of top-level dashboard routes that all render the same `Dashboard` shell (which switches content by path):

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `MainMenu` | Main menu with new/load/settings |
| `/select-team` | `TeamSelection` | Choose club to manage |
| `/match` | `MatchSimulation` | Live match simulation |
| `/dashboard`, `/inbox`, `/news`, `/schedule`, `/squad`, `/tactics`, `/training`, `/staff`, `/scouting`, `/youth`, `/finances`, `/transfers`, `/players`, `/teams`, `/tournaments`, `/settings` | `Dashboard` | Main game interface — each path selects a Dashboard tab |

Pages are lazy-loaded via `React.lazy`. Settings is a Dashboard tab (`/settings`), not a separate page component.

### Dashboard Component Architecture

The Dashboard is a slim layout shell (~620 lines) with a sidebar, header, and content area. Content is rendered by tab-specific components:

```
Dashboard.tsx (layout shell)
├── Sidebar: NavItem buttons for each tab
├── Header: Back button, tab title, date, search, finances, Continue
└── Content area (conditional rendering by activeTab):
    ├── HomeTab         — Overview, next match, standings, squad summary
    ├── InboxTab        — Two-pane email client with categories
    ├── ManagerTab      — Manager profile, career stats
    ├── SquadTab        — Player roster table
    ├── TacticsTab      — Formation picker, pitch visualization
    ├── TrainingTab     — Focus/intensity/schedule selection, fitness
    ├── StaffTab        — Staff management (hire/release)
    ├── FinancesTab     — Financial overview
    ├── TransfersTab    — Transfer market with 4 views
    ├── PlayersListTab  — Full player database browser
    ├── TeamsListTab    — All teams grid
    ├── TournamentsTab  — League standings and fixtures
    ├── ScheduleTab     — Calendar of fixtures
    ├── NewsTab         — News feed
    ├── PlayerProfile   — Detailed player view (inline)
    └── TeamProfile     — Detailed team view (inline)
```

**Navigation history**: The Dashboard maintains a `navHistory` stack for back navigation when drilling into player/team profiles from any tab.

### Match Day Components

The match simulation uses a multi-stage orchestrator:

```
MatchSimulation.tsx (orchestrator)
├── PreMatchSetup    — Team sheet, formation, set pieces
├── MatchLive        — Live simulation with events, stats, controls
├── HalfTimeBreak    — Team talk, tactical changes
├── PostMatchScreen  — Result summary, scorers, team talk
└── PressConference  — Post-match press questions
```

Flow: `prematch → first_half → halftime → second_half → postmatch → press`

### Design Language

The UI follows a **"Matchday" broadcast-quality** design language:

- **Colors**: Emerald green primary (#10b981), gold accent (#ffd60a), dark navy backgrounds
- **Typography**: Barlow Condensed (headings, uppercase tracking) + Inter (body)
- **Fonts**: Bundled locally via `@fontsource` packages (no CDN)
- **Dark/Light**: Full theme support with system detection

---

## Key Architectural Decisions

### 1. Engine Isolation

The `engine` crate has **no dependency on `domain`**. It defines its own `PlayerData`, `TeamData`, etc. This means:
- The engine can be tested with synthetic data (no need to generate full game worlds)
- Engine types can evolve independently (e.g., adding engine-only fields)
- The `turn/` module bridge in `ofm_core` handles all type conversion

### 2. `#[serde(default)]` for Backward Compatibility

Every new field added to domain types uses `#[serde(default)]` or a custom default function. This ensures old save files can be loaded without migration scripts. The trade-off is that new features gracefully degrade (e.g., old saves have no traits, empty training schedules) rather than failing.

### 3. Hardcoded Fallbacks for External Data

Generator definition files (`default_names.json`, `default_teams.json`) are loaded at runtime with fallback to hardcoded arrays compiled into the binary. This means:
- The game always works, even without external files
- Users can customize by placing definition files in the data directory
- No build-time dependency on external data files

### 4. Mutex-Based State Management

The engine uses `Mutex<Option<Game>>` rather than `RwLock` or actor patterns. This is simpler and sufficient because:
- Only one game is active at a time
- Commands run sequentially in the single engine Web Worker
- Lock contention is negligible (commands are fast)

### 5. `PlayerSnap` Pattern in Engine

The engine uses a "snapshot" pattern (`PlayerSnap`) to work around Rust's borrow checker. Before resolving an action, it clones the relevant player data into a lightweight struct, releasing the immutable borrow on `MatchContext`. This allows event emission (which needs `&mut self`) to happen in the same function.

### 6. Football Identity Codes

The game now distinguishes between general country data and football-facing identity data.
Most countries still use ISO 3166-1 alpha-2 codes (for example, `"ES"`, `"DE"`, `"BR"`), but football-specific identities can use project-owned short codes where the sport diverges from ISO country data, such as `"ENG"`, `"SCO"`, `"WAL"`, and `"NIR"`.

This enables:
- Locale-aware country and football-nation display
- Backward compatibility for legacy demonyms and `GB` saves
- Correct modeling of football nations without forcing a full non-ISO rewrite for the rest of the world

### 7. Frontend Tab Architecture

Each Dashboard tab has its own top-level route (`/squad`, `/tactics`, `/transfers`, ...), all rendering the same `Dashboard` shell which selects content by the current path. This means:
- Tabs are URL-addressable, deep-linkable, and work with browser back/forward
- The Dashboard shell stays mounted across tab changes, so layout state is preserved
- Profile views (player/team) overlay on top of the current tab with a back-navigation stack
