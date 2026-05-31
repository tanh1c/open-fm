# Game Systems

This document describes the major gameplay systems in Open Futball Manager beyond match simulation (which is covered in [MATCH_SIMULATION.md](MATCH_SIMULATION.md)).

---

## Table of Contents

- [Turn Processing](#turn-processing)
- [Training System](#training-system)
- [Staff System](#staff-system)
- [Player Traits](#player-traits)
- [League & Schedule](#league--schedule)
- [Inbox Messages](#inbox-messages)
- [News System](#news-system)
- [World Generation](#world-generation)
- [Finances](#finances)
- [Transfers](#transfers)

---

## Turn Processing

The game advances one day at a time via `process_day()` in `ofm_core/turn/mod.rs` (the `turn` module is split across `mod.rs`, `news.rs`, `post_match.rs`, and `round_summary.rs`). `process_day()` delegates to `process_day_with_capture()`, which runs the full daily pipeline. Each day follows this sequence:

```
process_day_with_capture(game, on_capture)
├── Is there a match today? (legacy league + competitions, indexed by date)
│   ├── YES → simulate_matchday_with_capture()
│   │         ├── For each fixture: build engine teams, simulate, apply results
│   │         ├── Update standings (points, goal difference)
│   │         ├── Update player season stats (goals, assists, cards, rating)
│   │         └── Generate match result news articles
│   └── NO  → process_training(game, weekday)
│             └── check_squad_fitness_warnings(game)
├── process_contract_expiries(game) + process_loan_expiries(game)
├── process_weekly_finances(game)            # wages, matchday income, sponsor, warnings
├── board_objectives: generate + update progress
├── player_events, injury recovery, random_events, scouting
├── process_transfer_market_tick(game)       # cadence-limited AI market
├── ai_hiring: update AI manager satisfaction
├── news: weekly digest, pre-match messages, prune old
├── firing check, vacant AI club hiring, job offers
├── clock.advance_days(1)
└── sync_primary_competition_from_legacy_league() + refresh_game_context()
```

> **Performance note:** Before simulating, `build_day_simulation_indexes()` groups scheduled fixtures into a `HashMap<date → indices>` (for both the legacy `league` and `competitions`), and `build_players_by_team()` builds a `HashMap<team_id → players>` once per day. This avoids repeated linear scans across the 248-club world.

### Match Day Processing

On match days, `simulate_matchday()`:

1. Finds all scheduled fixtures for today
2. For each fixture, converts domain `Player`/`Team` to engine `PlayerData`/`TeamData` via `build_engine_team()`
3. Calls `engine::simulate()` to get a `MatchReport`
4. Updates fixture status to `Completed` with the `MatchResult`
5. Updates `StandingEntry` for both teams (points: 3/1/0 for win/draw/loss)
6. Calls `apply_player_stats()` to update individual `PlayerSeasonStats`
7. Generates match report `NewsArticle` and match result `InboxMessage`

### Live Match Integration

When the user chooses to play a match live:

1. `advance_time_with_mode("live")` detects the fixture and returns `action: "live_match"` instead of simulating
2. The frontend navigates to `/match`, the user plays through the match interactively
3. On completion, `finish_live_match()` is called:
   - Applies the match report to standings and player stats
   - Simulates all other matches for that day (via `simulate_other_matches()` with `skip_fixture`)
   - Calls `finish_live_match_day()` to generate news, messages, and advance the clock

---

## Training System

Training is processed daily on non-match days. The system is controlled by three settings per team:

### Training Focus

| Focus | Attributes Trained | Notes |
|-------|-------------------|-------|
| **Physical** | pace, stamina, strength, agility | Full gain on all 4 |
| **Technical** | passing, shooting, dribbling | Full gain on all 3 |
| **Tactical** | positioning, vision, decisions, composure | Full gain on all 4 |
| **Defending** | tackling, defending + strength, positioning (half gain) | Mixed defensive |
| **Attacking** | shooting, dribbling + pace (half gain) | Mixed offensive |
| **Recovery** | — (no attribute gains) | Maximum condition recovery |

### Training Intensity

| Intensity | Gain Multiplier | Condition Cost |
|-----------|----------------|----------------|
| **Low** | 0.5× | 3 stamina |
| **Medium** | 1.0× | 6 stamina |
| **High** | 1.5× | 10 stamina |

### Training Schedule

| Schedule | Training Days | Rest Days | Days/Week |
|----------|-------------|-----------|-----------|
| **Intense** | Mon–Sat | Sun | 6 |
| **Balanced** | Mon, Tue, Thu, Fri | Wed, Sat, Sun | 4 |
| **Light** | Tue, Thu | Mon, Wed, Fri, Sat, Sun | 2 |

Rest days provide generous condition recovery (10 base, boosted by physio) with no training cost and no attribute gains.

### Attribute Gain Formula

Each training session, for each relevant attribute:

```
gain = 0.15 × intensity_mult × age_factor × coaching_mult × specialization_mult
```

The gain is **probabilistic**: a gain of 0.3 means a 30% chance of +1 to that attribute. Attributes are capped at 99.

### Age Factor

| Age | Factor | Description |
|-----|--------|-------------|
| ≤ 21 | 1.5× | Young players develop fastest |
| 22–25 | 1.2× | Prime development |
| 26–29 | 1.0× | Standard |
| 30–33 | 0.6× | Declining growth |
| 34+ | 0.3× | Minimal growth |

### Condition & Recovery

- **Training days**: condition depleted by cost, then partially recovered (base 3, boosted by physio)
- **Rest days**: no cost, generous recovery (base 10, boosted by physio)
- **Recovery focus**: no cost, highest recovery (base 12, boosted by physio)
- **Injured players**: receive 50% of base recovery, skip training

Recovery is further modified by each player's stamina attribute:
```
recovery = base × (0.5 + stamina/100 × 0.5)
```

### Fitness Warnings

After training each day, `check_squad_fitness_warnings()` evaluates the user's squad:

- **Critical** (3+ players below 25% condition): Urgent priority message from Physio/Assistant Manager with schedule-specific advice
- **Warning** (average < 50% or 4+ players below 40%): High priority message

Messages are deduplicated per day via `fitness_warn_{date}` IDs. The sender is the team's Physio if one is hired, otherwise the Assistant Manager.

---

## Staff System

Each team can employ staff in 4 roles:

| Role | Training Effect | Notes |
|------|----------------|-------|
| **Assistant Manager** | Coaching quality | Counts as coaching staff for training calculations |
| **Coach** | Coaching quality + specialization bonus | Primary training contributor |
| **Scout** | — | (Future: scouting reports) |
| **Physio** | Recovery multiplier | Boosts condition recovery for all training |

### Staff Attributes

| Attribute | Range | Effect |
|-----------|-------|--------|
| `coaching` | 0–100 | Training quality multiplier: 0→0.85×, 100→1.35× |
| `judging_ability` | 0–100 | (Future: player evaluation accuracy) |
| `judging_potential` | 0–100 | (Future: potential assessment) |
| `physiotherapy` | 0–100 | Recovery bonus: 0→1.0×, 100→1.4× |

### Coaching Bonuses

Computed per team before each training session:

- **No coaching staff**: 0.8× penalty (worse than having any coach)
- **Coaching multiplier**: `0.85 + (avg_coaching / 100) × 0.5` → range 0.85–1.35×
- **Specialization bonus**: 1.25× if any coach's specialization matches the training focus
- **Physio recovery**: `1.0 + (avg_physiotherapy / 100) × 0.4` → range 1.0–1.4×

### Coaching Specializations

| Specialization | Boosts Focus |
|----------------|-------------|
| Fitness | Physical |
| Technique | Technical |
| Tactics | Tactical |
| Defending | Defending |
| Attacking | Attacking |
| GoalKeeping | (Future: GK-specific) |
| Youth | (Future: youth development) |

### Hiring & Releasing

- **Hire**: Assigns an unattached staff member to the user's team. The staff's wage is recorded as an expense.
- **Release**: Removes the staff member from the team (becomes unattached again).

The world generates 12 unattached free-agent staff at game start, plus 4 staff per team (AssistantManager, Coach, Scout, Physio).

---

## Player Traits

Traits are automatically computed from a player's attributes and position by `compute_traits()` in `domain/player.rs`. They are recalculated whenever a `Player` is created via `Player::new()`.

### 20 Defined Traits

**Physical:**
| Trait | Requirement |
|-------|------------|
| Speedster | pace ≥ 85 |
| Tank | strength ≥ 85 AND stamina ≥ 75 |
| Agile | agility ≥ 85 |
| Tireless | stamina ≥ 90 |

**Technical:**
| Trait | Requirement |
|-------|------------|
| Playmaker | passing ≥ 80 AND vision ≥ 80 |
| Sharpshooter | shooting ≥ 85 |
| Dribbler | dribbling ≥ 85 |
| BallWinner | tackling ≥ 80 AND aggression ≥ 70 |
| Rock | defending ≥ 85 AND positioning ≥ 75 |

**Mental:**
| Trait | Requirement |
|-------|------------|
| Leader | leadership ≥ 85 AND teamwork ≥ 75 |
| CoolHead | composure ≥ 85 AND decisions ≥ 80 |
| Visionary | vision ≥ 85 |
| HotHead | aggression ≥ 85 AND composure < 50 |
| TeamPlayer | teamwork ≥ 85 |

**Goalkeeper:**
| Trait | Requirement |
|-------|------------|
| SafeHands | handling ≥ 85 (GK only) |
| CatReflexes | reflexes ≥ 85 (GK only) |
| AerialDominance | aerial ≥ 85 |

**Special/Combo:**
| Trait | Requirement |
|-------|------------|
| CompleteForward | Forward: shooting ≥ 75, dribbling ≥ 75, pace ≥ 70, strength ≥ 70 |
| Engine | Midfielder: stamina ≥ 85, pace ≥ 70, teamwork ≥ 75 |
| SetPieceSpecialist | passing ≥ 80, shooting ≥ 75, vision ≥ 75 |

### Trait Effects in Simulation

Traits provide multiplicative bonuses during match simulation. See [MATCH_SIMULATION.md — Player Traits](MATCH_SIMULATION.md#player-traits) for the full bonus table.

### Trait Display

On the frontend, traits are rendered as colored badges (`TraitBadge.tsx`) with:
- Lucide icons specific to each trait
- Color classes by category (physical = blue, technical = green, mental = purple, etc.)
- Tooltips with descriptions
- Squad tab shows max 2 badges + overflow count

---

## League & Schedule

### Competition Model

The active game keeps a legacy `game.league` copy for older UI flows, but the source of truth for current saves is `game.competitions`. A competition records:

- `kind`: domestic league, domestic cup, continental league, friendly, or preseason tournament
- `format`: round-robin, knockout, or group-stage knockout
- `country` and optional `tier`
- participating `team_ids`
- fixtures, standings, and transfer log

The default world now creates 248 clubs across England, France, Germany, Italy, Spain, Portugal, Netherlands, and Belgium. England, France, Germany, Italy, and Spain each have two domestic league tiers plus two domestic cups. Portugal, Netherlands, and Belgium each have one domestic league plus one domestic cup.

### Schedule Generation

Domestic leagues use a **double round-robin** format generated by the circle method (`schedule.rs`):

1. Fix team index 0, rotate the rest for `n-1` rounds (first leg)
2. Repeat with reversed home/away for `n-1` rounds (second leg)
3. Total matchdays: `2 × (n-1)` where `n` is the number of teams

Each league matchday is spaced 7 days apart from `start_date`. Domestic cups use a deterministic one-legged knockout bracket in the first pass, and cup fixtures are marked so they do not update league standings.

Examples:

- 16-team league: 30 matchdays, 240 fixtures
- 18-team league: 34 matchdays, 306 fixtures
- 20-team league: 38 matchdays, 380 fixtures

### Promotion, Relegation, and Continental Qualification

Two-tier countries use automatic promotion/relegation at season rollover. The rollover reads completed domestic league standings, swaps promoted/relegated teams between configured tiers, regenerates next-season competitions, and keeps `game.league` synced to the user's current domestic league.

Champions League qualification uses completed top-tier domestic standings where available and falls back to club reputation for new/unplayed worlds.

### Standings

`StandingEntry` tracks per team:
- Played, Won, Drawn, Lost
- Goals For, Goals Against, Goal Difference
- Points (3 for win, 1 for draw, 0 for loss)

Standings are sorted by: Points → Goal Difference → Goals For.

### Fixture Lifecycle

```
Scheduled → InProgress (during live match) → Completed
```

Each completed fixture stores a `MatchResult` with home/away goals and goal scorer details.

---

## Inbox Messages

The inbox system provides contextual communication from in-game characters. Messages are generated by `ofm_core/messages.rs`.

### Message Categories

The `MessageCategory` enum currently defines 15 categories: `Welcome`, `LeagueInfo`, `MatchPreview`, `MatchResult`, `Transfer`, `BoardDirective`, `PlayerMorale`, `Injury`, `Training`, `Finance`, `Contract`, `ScoutReport`, `Media`, `System`, `JobOffer`.

| Category | Sender | Trigger |
|----------|--------|---------|
| Welcome | Board of Directors | Game start (team selection) |
| LeagueInfo | League Office | League setup |
| MatchPreview | Scout / Asst. Manager | Day before a fixture |
| MatchResult | Asst. Manager | After each fixture |
| Transfer | Director of Football / Asst. Manager | Incoming/outgoing offers, completed deals |
| BoardDirective | Chairman | Board objectives, warnings, dismissal, and hiring welcome messages |
| PlayerMorale | Asst. Manager / Player | Squad unrest, unhappy players, conversations |
| Injury | Physio | Player injury reports |
| Training | Physio / Asst. Manager | Fitness warnings (daily) |
| Finance | Board / Finance Director | Sponsorship and budget updates |
| Contract | Agent / Asst. Manager | Contract negotiations and renewal decisions |
| JobOffer | Board of Directors | Vacancy-driven approaches and application replies for unemployed managers |
| ScoutReport | Scout | Player scouting reports |
| Media | Press / Media | Press stories from random events |
| System | System | Technical messages |

### Message Structure

Each `InboxMessage` has:
- **Subject, body, sender, sender_role, date**
- **Category** and **Priority** (Low, Normal, High, Urgent)
- **Actions**: Interactive buttons (Acknowledge, NavigateTo, ChooseOption, Dismiss)
- **Context**: References to teams, players, fixtures, match results
- **Optional i18n metadata**: backend subject/body/sender keys plus interpolation params for localized rendering

### Message Variations

Messages use randomized templates — for example, the welcome message has 3 variations randomly selected at game start. Match preview messages have different phrasings for home vs away matches, and incorporate rival/confident/underdog tones based on team reputation.

### Deduplication

Messages with specific IDs (e.g., `fitness_warn_2025-08-15`) are deduplicated — the system checks for existing messages with the same ID before creating new ones.

---

## News System

The news system generates public-facing articles about league events, displayed in the News tab. Articles are generated by `ofm_core/news.rs`.

### News Categories

| Category | Trigger | Content |
|----------|---------|---------|
| **MatchReport** | After each fixture | Score, scorers, commentary variations |
| **LeagueRoundup** | After each matchday | Summary of all results |
| **StandingsUpdate** | After each matchday | Current league positions |
| **TransferRumour** | Weekly digest (Monday) | Gossip/speculation about notable AI players |
| **TransferRoundup** | Weekly digest (Monday) + major completed transfers | Confirmed major move announcements and roundup coverage |
| **InjuryNews** | When a notable player (market value ≥ €500K or starting XI) suffers a training injury | Injury duration and impact report |
| **ManagerialChange** | Manager firing or vacancy fill | Public dismissal and appointment coverage |
| **SeasonPreview** | End of season / preseason rollover | Preseason analysis and contenders |
| **Editorial** | Weekly storylines, season awards, weekly digest | Opinion pieces, standings narratives |

### Article Structure

Each `NewsArticle` has:
- **Headline, body, source, date, category**
- **Team/player IDs**: Referenced entities for linking
- **Match score**: Optional score context for match reports
- **Read status**: Tracks whether the user has read it
- **Optional i18n metadata**: headline/body/source keys plus interpolation params for localized rendering

### Article Generation

Match reports use randomized commentary templates (3 variations per article). They include:
- Result description (win/loss/draw phrasing)
- Scorer details with minutes
- Contextual commentary about league implications

League roundup articles summarize all matchday results with scores, standings update articles report the current top positions, managerial-change articles cover firings and appointments, and season preview articles frame the new campaign before kickoff.

**Transfer rumours** are generated every Monday (alongside the weekly digest). Up to 2 notable AI-team players — those with a market value ≥ €800K, an expiring contract (≤ 12 months), or low morale — are picked and receive a speculative gossip article attributed to tabloid-leaning sources (Transfer Intelligence, Sports Gazette, or The Football Herald). These rumours do not correspond to actual pending transfer offers; they are flavour-driven speculation.

**Injury news** articles are generated whenever a notable player suffers a training-ground injury. Notability is defined as a market value ≥ €500K or membership of the user club's starting XI. The article reports the injury duration and is attributed to a factual source (League Wire, The Football Herald, or Match Day Press).

---

## World Generation

World generation creates the initial game state: teams, players, staff, and domestic tier membership. See [DEFINITIONS.md](DEFINITIONS.md) for the file format.

The compiled fallback world contains 248 real-world-inspired European clubs:

| Country | League structure | Cups |
|---------|------------------|------|
| England | Premier League + EFL Championship | FA Cup, EFL Cup |
| France | Ligue 1 + Ligue 2 | Coupe de France, Trophée des Champions |
| Germany | Bundesliga + 2. Bundesliga | DFB-Pokal, DFL-Supercup |
| Italy | Serie A + Serie B | Coppa Italia, Supercoppa Italiana |
| Spain | LaLiga + Segunda División | Copa del Rey, Supercopa de España |
| Portugal | Primeira Liga | Taça de Portugal |
| Netherlands | Eredivisie | KNVB Cup |
| Belgium | Belgian Pro League | Belgian Cup |

Teams carry optional `domestic_tier` metadata so scheduling can place them into the correct division without relying on reputation sorting.

### Generation Flow

```
generate_world(data_dir)
├── Load names definition (JSON or hardcoded fallback)
├── Load teams definition (JSON or hardcoded fallback)
├── For each team template:
│   ├── Create Team with randomized reputation, finances, and optional domestic tier
│   ├── Generate 22 players (2 GK, 7 DEF, 7 MID, 6 FWD)
│   │   └── For each player:
│   │       ├── Pick nationality (60% team country, 40% random)
│   │       ├── Pick name from nationality pool
│   │       ├── Generate attributes by position
│   │       ├── Compute traits
│   │       └── Set contract, wage, market value
│   └── Generate 4 staff (AssistantManager, Coach, Scout, Physio)
├── Generate 12 unattached free-agent staff
└── Return Game with all entities; competitions are scheduled when the manager selects a team
```

### Player Generation

- **Nationalities**: 60% weighted toward team country, 40% from any pool
- **Names**: Picked from nationality-specific pools (first + last names)
- **Attributes**: Randomized by position with different ranges:
  - GK: high handling/reflexes/aerial, lower outfield stats
  - DEF: high defending/tackling/strength, lower shooting
  - MID: balanced, higher passing/vision/stamina
  - FWD: high shooting/pace/dribbling, lower defending
- **Age**: 17–35, with attribute ranges scaled by age (younger = lower ceiling, older = higher but declining)
- **Condition**: Starts at 75–100

### Definition Files

Two external JSON files can customize generation:
- `default_names.json` — Name pools keyed by short uppercase nationality code (mostly ISO 3166-1 alpha-2, plus football codes such as `ENG`/`SCO`/`WAL`/`NIR`)
- `default_teams.json` — Team templates with name, city, country, optional `domestic_tier`, colors, play style, reputation/finance ranges

If files are not found or have parse errors, the generator silently falls back to hardcoded defaults compiled into the binary.

---

## Finances

Each team tracks financial state:

| Field | Description |
|-------|-------------|
| `finance` | Current balance (can be negative) |
| `wage_budget` | Weekly wage allowance |
| `transfer_budget` | Available for transfers |
| `season_income` | Cumulative income this season |
| `season_expenses` | Cumulative expenses this season |

### Income Sources
- **Matchday revenue** — computed weekly from recent home matches via `calc_matchday(stadium_capacity, home_match_count, attendance_pct, avg_ticket)` (default 76% attendance, €20 average ticket)
- **Sponsorship** — each club can hold a `Sponsorship` deal with a weekly `base_value` plus performance bonuses (league position, form) evaluated each week. Managers can pitch for new deals via the sponsor pitch flow.
- Prize money (future)

### Expenses
- Player wages (weekly, billed via `process_weekly_finances`)
- Staff wages (weekly)
- Transfer fees (applied through `execute_transfer` when deals complete)

`process_weekly_finances()` runs each Monday: it bills wages, credits matchday and sponsor income, and emits finance warnings/messages when the projected balance runs low. The `FinancesTab` displays an overview with cards for balance, wage budget, transfer budget, sponsorship, and a payroll table.

---

## Transfers

The transfer system provides a market for buying, selling, and loaning players.

### Player Transfer Status

Each player has:
- `transfer_listed: bool` — Whether the player is available for transfer
- `loan_listed: bool` — Whether the player is available for loan
- `transfer_offers: Vec<TransferOffer>` — Pending offers

### Transfer Views (Frontend)

The `TransfersTab` provides 4 views:
- **My List** — Players you've listed for transfer/loan
- **Market** — Available players from other teams
- **Loans** — Loan-listed players
- **Offers** — Incoming and outgoing transfer offers

### Transfer Mechanics

The transfer system is implemented in `ofm_core/transfers.rs` and exposed through WASM/`invoke` commands. Core flows:

- **AI market** — `process_transfer_market_tick()` runs on a cadence during day advancement (gated by `should_evaluate_transfer_market`, plus deadline-day handling). It generates incoming offers for user players and completes AI-to-AI transfers within budget. `generate_incoming_transfer_offers()` / `evaluate_transfer_market()` perform the same evaluation immediately (used by tests and direct triggers, bypassing the cadence gate).
- **Outgoing bids** — `make_transfer_bid()` creates a bid for another club's player; `project_transfer_bid_financial_impact()` previews affordability before committing.
- **Negotiation** — `respond_to_offer()` accepts/rejects an incoming offer, `counter_offer()` proposes a new fee, and `propose_transfer_contract()` agrees personal terms. Accepted deals are finalized through `execute_transfer`, which is the single authoritative move path (also used by the vacation assistant).
- **Free agents** — `approach_free_agent()` signs an unattached player on agreed terms.
- **Loans** — `make_loan_offer()` creates loan deals; `process_loan_expiries()` returns loanees when their spell ends.
- **Shortlist** — `toggle_shortlist()` adds/removes players from the manager's shortlist.

Transfer windows gate when activity is allowed; `season_context` tracks the current window status (including deadline day).
