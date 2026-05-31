# Save System Redesign — Architecture Document

## Overview

> **Status: implemented.** This document was originally written as a redesign proposal. The relational, one-database-per-save model described below now ships in the `db` crate. Two things diverge from the original proposal and are corrected throughout this document:
> 1. The game runs **WASM-only in the browser**, so persistence lives in **OPFS** (Origin Private File System) via an `sqlite-wasm` sahpool VFS — not a native `~/.local/share` path.
> 2. The save manifest is stored in a small SQLite database (`app.db`), not a `save_index.json` file.

The design replaces a single `saves.db` (JSON blob per save) with a proper relational
database per save session. Each save is its own SQLite file with a well-defined schema
managed through migrations.

## Legacy State (replaced)

- Old `db` crate: `DbManager` opened a single `saves.db`, storing the entire `Game` struct as a
  JSON TEXT column.
- All game state was serialized/deserialized as one monolithic blob.
- No schema validation, no checksums, no migration support.

## Architecture

### 1. One Database Per Save

Storage lives under the OPFS root mounted by the sahpool VFS (`install_opfs_sahpool()`,
which must run inside the engine Web Worker because `FileSystemSyncAccessHandle` would
block the main thread):

```
<OPFS root>/
├── app.db                   # App-level DB: save index/manifest + app settings
├── saves/
│   ├── <uuid1>.db           # Save session 1
│   ├── <uuid2>.db           # Save session 2
│   └── ...
└── databases/               # User-imported world databases
```

### 2. Database Schema (per save `.db` file)

Managed by `rusqlite_migration`. The schema starts at V1 and currently includes 27 additive migrations (latest **V27**); earlier milestones include V14 for football identity fields.

```sql
-- Game clock / session metadata
CREATE TABLE game_meta (
    id              TEXT PRIMARY KEY DEFAULT 'singleton',
    save_id         TEXT NOT NULL,
    save_name       TEXT NOT NULL,
    manager_id      TEXT NOT NULL,
    start_date      TEXT NOT NULL,
    current_date    TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_played_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE managers (
    id              TEXT PRIMARY KEY,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   TEXT NOT NULL,
    nationality     TEXT NOT NULL,
    football_nation TEXT NOT NULL DEFAULT '',
    birth_country   TEXT,
    reputation      INTEGER NOT NULL DEFAULT 500,
    satisfaction    INTEGER NOT NULL DEFAULT 100,
    fan_approval    INTEGER NOT NULL DEFAULT 50,
    team_id         TEXT,
    career_stats    TEXT NOT NULL DEFAULT '{}',   -- JSON for ManagerCareerStats
    career_history  TEXT NOT NULL DEFAULT '[]'    -- JSON for Vec<ManagerCareerEntry>
);

CREATE TABLE teams (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    short_name          TEXT NOT NULL,
    country             TEXT NOT NULL,
    football_nation     TEXT NOT NULL DEFAULT '',
    city                TEXT NOT NULL,
    stadium_name        TEXT NOT NULL,
    stadium_capacity    INTEGER NOT NULL,
    finance             INTEGER NOT NULL DEFAULT 1000000,
    manager_id          TEXT,
    reputation          INTEGER NOT NULL DEFAULT 500,
    wage_budget         INTEGER NOT NULL,
    transfer_budget     INTEGER NOT NULL,
    season_income       INTEGER NOT NULL DEFAULT 0,
    season_expenses     INTEGER NOT NULL DEFAULT 0,
    formation           TEXT NOT NULL DEFAULT '4-4-2',
    play_style          TEXT NOT NULL DEFAULT 'Balanced',
    training_focus      TEXT NOT NULL DEFAULT 'Physical',
    training_intensity  TEXT NOT NULL DEFAULT 'Medium',
    training_schedule   TEXT NOT NULL DEFAULT 'Balanced',
    founded_year        INTEGER NOT NULL DEFAULT 1900,
    colors_primary      TEXT NOT NULL DEFAULT '#10b981',
    colors_secondary    TEXT NOT NULL DEFAULT '#ffffff',
    starting_xi_ids     TEXT NOT NULL DEFAULT '[]',   -- JSON array
    form                TEXT NOT NULL DEFAULT '[]',   -- JSON array
    history             TEXT NOT NULL DEFAULT '[]'    -- JSON for Vec<TeamSeasonRecord>
);

CREATE TABLE players (
    id                  TEXT PRIMARY KEY,
    match_name          TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    football_nation     TEXT NOT NULL DEFAULT '',
    birth_country       TEXT,
    position            TEXT NOT NULL,
    attributes          TEXT NOT NULL,    -- JSON for PlayerAttributes
    condition           INTEGER NOT NULL DEFAULT 100,
    morale              INTEGER NOT NULL DEFAULT 100,
    injury              TEXT,             -- JSON for Option<Injury> (NULL if none)
    team_id             TEXT,
    traits              TEXT NOT NULL DEFAULT '[]',  -- JSON array
    contract_end        TEXT,
    wage                INTEGER NOT NULL DEFAULT 0,
    market_value        INTEGER NOT NULL DEFAULT 0,
    stats               TEXT NOT NULL DEFAULT '{}',  -- JSON for PlayerSeasonStats
    career              TEXT NOT NULL DEFAULT '[]',  -- JSON for Vec<CareerEntry>
    transfer_listed     INTEGER NOT NULL DEFAULT 0,
    loan_listed         INTEGER NOT NULL DEFAULT 0,
    transfer_offers     TEXT NOT NULL DEFAULT '[]'   -- JSON array
);

CREATE TABLE staff (
    id                  TEXT PRIMARY KEY,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    football_nation     TEXT NOT NULL DEFAULT '',
    birth_country       TEXT,
    role                TEXT NOT NULL,
    attributes          TEXT NOT NULL,   -- JSON for StaffAttributes
    team_id             TEXT,
    specialization      TEXT,            -- NULL if none
    wage                INTEGER NOT NULL DEFAULT 0,
    contract_end        TEXT
);

CREATE TABLE league (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    season          INTEGER NOT NULL
);

CREATE TABLE fixtures (
    id              TEXT PRIMARY KEY,
    league_id       TEXT NOT NULL REFERENCES league(id),
    matchday        INTEGER NOT NULL,
    date            TEXT NOT NULL,
    home_team_id    TEXT NOT NULL REFERENCES teams(id),
    away_team_id    TEXT NOT NULL REFERENCES teams(id),
    status          TEXT NOT NULL DEFAULT 'Scheduled',
    result          TEXT       -- JSON for Option<MatchResult> (NULL if not played)
);

CREATE TABLE standings (
    league_id       TEXT NOT NULL REFERENCES league(id),
    team_id         TEXT NOT NULL REFERENCES teams(id),
    played          INTEGER NOT NULL DEFAULT 0,
    won             INTEGER NOT NULL DEFAULT 0,
    drawn           INTEGER NOT NULL DEFAULT 0,
    lost            INTEGER NOT NULL DEFAULT 0,
    goals_for       INTEGER NOT NULL DEFAULT 0,
    goals_against   INTEGER NOT NULL DEFAULT 0,
    points          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (league_id, team_id)
);

CREATE TABLE messages (
    id              TEXT PRIMARY KEY,
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,
    sender          TEXT NOT NULL,
    sender_role     TEXT NOT NULL DEFAULT '',
    date            TEXT NOT NULL,
    read            INTEGER NOT NULL DEFAULT 0,
    category        TEXT NOT NULL DEFAULT 'System',
    priority        TEXT NOT NULL DEFAULT 'Normal',
    actions         TEXT NOT NULL DEFAULT '[]',   -- JSON
    context         TEXT NOT NULL DEFAULT '{}',   -- JSON
    i18n            TEXT NOT NULL DEFAULT '{}'    -- JSON for all i18n fields
);

CREATE TABLE news (
    id              TEXT PRIMARY KEY,
    headline        TEXT NOT NULL,
    body            TEXT NOT NULL,
    source          TEXT NOT NULL,
    date            TEXT NOT NULL,
    category        TEXT NOT NULL,
    team_ids        TEXT NOT NULL DEFAULT '[]',
    player_ids      TEXT NOT NULL DEFAULT '[]',
    match_score     TEXT,            -- JSON, NULL if none
    read            INTEGER NOT NULL DEFAULT 0,
    i18n            TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE board_objectives (
    id              TEXT PRIMARY KEY,
    description     TEXT NOT NULL,
    target          INTEGER NOT NULL,
    objective_type  TEXT NOT NULL,
    met             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scouting_assignments (
    id              TEXT PRIMARY KEY,
    scout_id        TEXT NOT NULL REFERENCES staff(id),
    player_id       TEXT NOT NULL REFERENCES players(id),
    days_remaining  INTEGER NOT NULL
);
```

### Football Identity Notes

- Legacy saves may still store `nationality` / `country` values such as `"GB"`, `"British"`, or demonyms like `"English"`.
- New additive columns persist the normalized football-facing identity separately from the legacy source fields.
- Load-time migration fills missing `football_nation` and `birth_country` values conservatively and auto-resaves upgraded saves.
- Ambiguous legacy `GB` values are not blanket-rewritten. Deterministic cases, such as known bundled English clubs, can be upgraded to `ENG` via migration heuristics.

### 3. Save Index (`app.db`)

The save manifest is persisted as a table in `app.db` (a small app-level SQLite database
managed by `save_index_manager.rs` / `app_db.rs`), rather than a JSON file. Each entry
records the same metadata originally proposed for `save_index.json`:

```jsonc
// One row per save (conceptual shape)
{
  "id": "uuid-1",
  "name": "John's Career",
  "manager_name": "John Smith",
  "db_filename": "uuid-1.db",
  "checksum": "sha256hex...",
  "created_at": "2026-03-05T18:00:00Z",
  "last_played_at": "2026-03-05T19:30:00Z"
}
```

- **On save**: compute SHA-256 of the `.db` file, upsert the index row.
- **On load (list)**: read the index table from `app.db` — no per-save DB opens needed.
- **If index missing/stale**: scan the `saves/` directory, open each `.db`, validate schema
  via migration version check, rebuild the index.
- **If DB invalid**: mark as corrupted in UI, do not crash.

### 4. Crate Boundaries

```
db crate (persistence layer):
├── migrations.rs          — Migration definitions (rusqlite_migration)
├── game_database.rs       — GameDatabase struct (open, apply migrations, close)
├── game_persistence.rs    — Game ↔ storage record (de)serialization
├── app_db.rs              — App-level DB (save index + settings)
├── opfs.rs                — OPFS sahpool VFS bootstrap (wasm32 only)
├── repositories/
│   ├── mod.rs
│   ├── team_repo.rs
│   ├── player_repo.rs
│   ├── staff_repo.rs
│   ├── manager_repo.rs
│   ├── league_repo.rs
│   ├── message_repo.rs
│   ├── news_repo.rs
│   ├── meta_repo.rs
│   ├── objective_repo.rs
│   ├── scouting_repo.rs
│   └── stats_repo.rs
├── save_index.rs          — SaveIndex record types
├── save_index_manager.rs  — Save index read/write/rebuild (backed by app.db)
├── save_manager.rs        — High-level orchestration (create/load/save/delete)
└── lib.rs
```

> The original proposal also listed a `legacy.rs` for migrating an old monolithic `saves.db`. The codebase now ships the relational model directly; consult the crate source for the current legacy-handling status.

### 5. Data Flow

**New Game:**
1. User fills form → `start_new_game` → generates world in memory → `Game` in `StateManager`
2. User selects team → `select_team` → updates `Game` in memory (NO DB write yet)
3. User explicitly saves → `save_game` → `SaveManager::save()`:
   - Creates `saves/<uuid>.db` if new
   - Applies migrations
   - Writes all entities from `Game` to tables
   - Computes checksum, updates the save index in `app.db`

**Load Game:**
1. `get_saves` → reads the save index from `app.db` → returns metadata list
2. `load_game(id)` → `SaveManager::load(id)`:
   - Opens `saves/<id>.db`
   - Validates schema version
   - Reads all tables → constructs `Game`
   - Sets in `StateManager`

**New Game from Existing Save DB:**
1. Copy `.db` file to new UUID
2. Open new DB, DELETE FROM session-specific tables (messages, news, standings
   results, board_objectives, scouting_assignments)
3. Reset player stats, team season_income/expenses, manager assignment
4. Reset game_meta with new save info

**Legacy Migration:**
1. On startup, check for an old monolithic `saves.db`
2. Open it, read all JSON blobs
3. For each: create new individual DB, write entities
4. Populate the save index in `app.db`
5. Rename `saves.db` → `saves.db.migrated`

### 6. Definition File Validation

- **Built-in definitions**: hardcoded in the generator's `data.rs` (always available)
- **Custom definition files**: if provided, must be valid; missing required fields
  cause an explicit error returned to the caller.
- **Regeneration**: if shipped definition files are deleted, regenerate from hardcoded
  data with identical content.
- **Pre-populated DB**: a starting `default_world.db` can be used instead of generating
  from scratch.

### 7. Implementation Status

The relational save system described above is implemented. Earlier phases were built with
TDD (Red→Green→Refactor) and atomic Conventional Commits; the schema has since advanced to
migration V27.
