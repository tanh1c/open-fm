# Player Lifecycle: Retirement, Youth Newgen & Age Decline

## Context

The engine ages players automatically (age is derived from `date_of_birth` + the game clock year), and `training.rs` already grows attributes more slowly as players get older. But the world has **no player lifecycle**: nobody retires, no new youth are born, and attributes never decline. Play ~10–15 seasons and every club fills with 35+ year-olds, the transfer market dries up, and the Honours/Records system loses meaning (no "retired legends", no fresh wonderkids breaking records).

This plan adds three engine systems, hooked into the existing season rollover (`process_end_of_season`):

1. **Retirement** — old/declined players retire each season; a lightweight Hall of Fame summary is kept (full `Player` removed for perf, matching the append-only/prune work).
2. **Youth intake (newgen)** — every club in the 248-team world produces a few youth players each season, so the world stays self-sustaining and AI squads don't rot.
3. **Age-based decline (#3)** — physical attributes erode from ~31; mental/technical hold or decay slowly. Training still drives youth development.

User decisions (confirmed):
- Retirement → **Hall of Fame gọn nhẹ**: remove the `Player`, store a compact `RetiredPlayer` record.
- Youth intake → **toàn thế giới**: all 248 clubs, birth count balances retirements.
- Decline → **thực tế vừa phải**: physical decline from ~31, mental holds.

## Key existing code to reuse (do NOT reinvent)

- `process_end_of_season(game)` — `src-engine/crates/ofm_core/src/end_of_season.rs:278`. The single season-rollover chokepoint. Career entries recorded + stats reset in the player loop at lines 404–435; honours recorded at line 439. New passes hook in right after, before schedule regeneration (line 510).
- `generate_random_player_from_def(team_id, index, nationality, names_def, rng)` — `generator/generation.rs:159`. Full player creation (attributes, age, value, wage, potential, traits). Youth gen reuses this logic with youth-age + academy-quality constraints.
- `pick_name_from_def` / `pick_nationality_from_def` — `generator/generation.rs:78,51`. Name/nationality pools (static `NamesDefinition` from `generator/data.rs`).
- `generate_potential(ovr, age)` + `refresh_player_derived(player, current_year)` — `player_rating.rs:53,20`. Sets potential, recomputes OVR/traits/Wonderkid. (≤18 yr gets +15..30 potential bonus — perfect for newgens.)
- `natural_ovr(player)` — `player_rating.rs:99`. Position-weighted OVR.
- Age helper pattern: `current_year.saturating_sub(birth_year)` from `date_of_birth.split('-')` — `player_rating.rs:66`, `training.rs:349`.
- `training.rs` `age_factor` (1.5 young → 0.3 old) at line 215 — young players still gain via training; decline pass is the veteran counterweight.
- `honours.rs` `GameRecords` already snapshots player records by id/name/value, so a retired legend's records survive after the `Player` is dropped.
- News pattern: `news::season_awards_article(...)` — `news.rs:419`. Reuse `NewsArticle::new(...).with_players(...).with_i18n(headline, body, source, params)`.
- Free agents = `team_id: None`; `process_contract_expiries` (`contracts.rs:608`) already frees expired players via `release_player_contract`.
- Persistence: `upsert_players` (`player_repo.rs:16`) is INSERT-OR-REPLACE only — removing a player from `game.players` orphans its DB row, so retirement MUST prune (mirror the match-stats DELETE prune in `stats_repo.rs`). New JSON columns follow the `season_honours_json`/`records_json` pattern (`game_persistence.rs:60-104`, `meta_repo.rs`).

## Phase 1 — Domain: retirement record

`src-engine/crates/domain/src/player.rs`:
- Add `RetiredPlayer` struct (compact Hall of Fame entry): `id`, `full_name`, `nationality`, `position`, `last_team_id`, `last_team_name`, `retired_season`, `age_at_retirement`, `peak_ovr`, `total_appearances`, `total_goals`, `total_assists`, `career_seasons`. Derive `Debug, Clone, Serialize, Deserialize`; `#[serde(default)]`-friendly.
- Optional: add `Player::age(current_year: u32) -> u32` to centralize the age math duplicated across player_rating/training/contracts. Low risk, nice-to-have.
- No new `Player` flag needed (Hall of Fame mode removes players).

## Phase 2 — Game state: retired list

`src-engine/crates/ofm_core/src/game.rs`:
- Add `#[serde(default)] pub retired_players: Vec<domain::player::RetiredPlayer>` to `Game` + init in `Game::new`. Mirrors how `season_honours`/`records` were added.

## Phase 3 — Aging module (new file)

New `src-engine/crates/ofm_core/src/aging.rs` (register `pub mod aging;` in `ofm_core/src/lib.rs`). All thresholds as named consts at top for tuning.

- `pub fn process_player_decline(game: &mut Game)` — once per season inside rollover. Per player, compute age; apply gentle per-attribute decline:
  - Physical (`pace, stamina, agility`): decline from ~31, scaling up with age (31–33 small ~ -1, 34+ larger ~ -2/-3). `strength` declines least/latest.
  - Skill (`tackling, defending, shooting, dribbling`): modest decline past ~33.
  - Mental (`passing, vision, decisions, composure, positioning, leadership`): hold; tiny decline only at 35+.
  - GK (`handling, reflexes, aerial`): decline later (~34+) — keepers age well.
  - Small random rolls (reuse `rand::rng()` like training's `try_gain`) so decline isn't uniform.
  - After mutating, `refresh_player_derived(player, current_year)`. Do NOT touch `potential` (ceiling stays; OVR may fall below it for veterans — fine).
- `pub fn should_retire(player, age, rng) -> bool` — probability curve: ~0% before 33, rising 34→40, ~100% at 41+. Lower-OVR players retire slightly earlier; GKs skew ~2 years older.

## Phase 4 — Youth intake

Add to `aging.rs` (intake lives beside decline/retirement; player CONSTRUCTION stays in `generator/`):
- New `pub(crate) fn generate_youth_player(team_id, country, names_def, rng) -> Player` in `generator/generation.rs` (+ re-export via `generator/mod.rs`): wraps existing attribute/value code with youth constraints — age 16–18, low current OVR but high potential via `generate_potential`, `squad_role = SquadRole::Youth`, youth contract (3–4y), modest wage/value, randomized position, then `refresh_player_derived`.
- Names access: add `pub fn default_names() -> NamesDefinition` accessor in the generator (static `data.rs` pool) so rollover can build youth without threading `names_def` through every signature.
- `pub fn process_youth_intake(game, names_def, season)`: for each team generate `N` youth (2–4, scaled slightly by `team.facilities.training` + `team.reputation`). Total intake ≈ total retirements so `game.players` stays bounded over decades.

## Phase 5 — Wire into season rollover

`end_of_season.rs`, inside `process_end_of_season`, AFTER the career/stats loop (~435) and honours (439), BEFORE schedule regen (510), in this order:
1. `aging::process_player_decline(game)` — veterans lose a step.
2. Retirement: for each player `if should_retire(...)` → push `RetiredPlayer` summary into `game.retired_players`, collect ids; then `game.players.retain(|p| !retiring.contains(&p.id))`. Strip retired ids from every team's `starting_xi_ids` and `training_groups`. (Free agents can retire too.)
3. `aging::process_youth_intake(game, &names, next_season)` — refill the world.
4. One news roundup (reuse `NewsArticle` + i18n) of notable retirements (highest peak_ovr); optional youth-intake note for user's club. News is cleared each season (line 503) so keep to 1–2 articles.

Order = decline → retire → intake, so a player declining into retirement is removed before intake counts (keeps totals balanced).

## Phase 6 — Persistence

`player_repo.rs` + `game_persistence.rs:96`:
- After `upsert_players`, `DELETE FROM players WHERE id NOT IN (current ids)` (parameterized/chunked), mirroring the match-stats prune. Retired players don't linger in the DB.
- Persist `game.retired_players` via new `retired_players_json` column on `game_meta` (same JSON-column pattern as `season_honours_json`/`records_json`): new migration `sql/vNNN_retired_players.sql` (`ALTER TABLE game_meta ADD COLUMN retired_players_json TEXT NOT NULL DEFAULT '[]'`), bump `MIGRATION_COUNT` in `migrations.rs`, extend `meta_repo.rs` `GameMeta` struct + upsert/load + all test literals, and `read_game` sets `retired_players: serde_json::from_str(...).unwrap_or_default()`.

## Phase 7 — Frontend surfacing

- `src/store/types.ts`: add `RetiredPlayer` interface + `retired_players?: RetiredPlayer[]` on `GameStateData`. (`squad_role: "Youth"` already exists on `PlayerData`.)
- Hall of Fame: add a panel to the existing Honours/Records area in `src/components/tournaments/TournamentsTab.tsx` reading `gameState.retired_players`, sorted by peak OVR; reuse `RecordGroup`/row primitives.
- Youth: Youth Academy tab already renders `squad_role: Youth` players — just confirm new intakes show up; no structural change.
- i18n: add retirement/intake news keys (`be.news.*`) + Hall of Fame labels across all 8 locales (`src/i18n/locales/*.json`), English `defaultValue` fallbacks.

## Critical files

- `src-engine/crates/domain/src/player.rs` (RetiredPlayer, optional `Player::age`)
- `src-engine/crates/ofm_core/src/game.rs` (`retired_players` field)
- `src-engine/crates/ofm_core/src/aging.rs` (NEW: decline + retirement + intake)
- `src-engine/crates/ofm_core/src/lib.rs` (`pub mod aging;`)
- `src-engine/crates/ofm_core/src/generator/generation.rs` + `generator/mod.rs` (youth gen helper, `default_names`)
- `src-engine/crates/ofm_core/src/end_of_season.rs` (wire passes into rollover)
- `src-engine/crates/ofm_core/src/news.rs` (retirement/intake roundup)
- `src-engine/crates/db/src/repositories/player_repo.rs` (prune orphaned rows)
- `src-engine/crates/db/src/repositories/meta_repo.rs` + `migrations.rs` + new `sql/vNNN_retired_players.sql`
- `src-engine/crates/db/src/game_persistence.rs` (write/read retired_players + prune call)
- `src/store/types.ts`, `src/components/tournaments/TournamentsTab.tsx`, `src/i18n/locales/*.json`

## Tests

Rust (engine):
- decline reduces an old player's pace but not a 24-year-old's; a 35-year-old's mental attributes barely move.
- `should_retire` ~never at 30, frequent at 38, always at 42.
- `process_end_of_season` removes retired players from `game.players`, strips their ids from `starting_xi_ids`, appends a `RetiredPlayer` with correct peak_ovr/totals.
- youth intake adds `SquadRole::Youth` players ≤18 with potential > current OVR for every club; world player count stays roughly stable across a simulated season (intake ≈ retirements).
- persistence round-trip: save → load preserves `retired_players`; a retired player's id is gone from the `players` table.

Frontend:
- Hall of Fame panel renders retired players sorted by peak OVR from `gameState.retired_players`.
- locale-coverage test passes (all 8 locales have new keys).

## Verification

1. `cargo test -p ofm_core aging --manifest-path src-engine/Cargo.toml`
2. `cargo test -p ofm_core end_of_season --manifest-path src-engine/Cargo.toml`
3. `cargo test -p db --manifest-path src-engine/Cargo.toml`
4. `npm run build:engine`
5. `npx tsc --noEmit`
6. `npx vitest run src/components/tournaments/ src/i18n`
7. Manual: start a save, simulate ~3–5 seasons via vacation/advance-to-date; confirm old players retire (appear in Hall of Fame), youth appear at every club, veteran OVRs trend down, squad sizes stay sane, and Continue/season rollover still works.
