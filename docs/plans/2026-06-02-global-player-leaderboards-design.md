# Global Player Leaderboards Design

## Goal

Expand `/tournaments` so player stats are not limited to the manager's domestic competition context. Each selected competition should keep its own leaderboard tab, and `/tournaments` should also expose a global player leaderboard with filters for season, country, competition type, and position.

## Current state

- `TournamentsTab` already has a `Leaderboards` tab for the selected competition.
- `get_competition_leaderboards` loads `CompetitionLeaderboards` on demand.
- Backend aggregation currently reads `StatsState.player_matches`, but `ofm_core::leaderboards` filters records to domestic-league competitions only.
- The UI also computes a small top-scorer sidebar directly from fixture scorers, but that is goal-only and should not become the primary leaderboard source.

## Recommended approach

Use real recorded player match stats as the source of truth.

- Extend backend leaderboard aggregation so competition leaderboards can aggregate any tracked competition when player match records exist for it.
- Add a new global leaderboard command that aggregates across competitions and applies filters.
- Avoid mixing fixture-scorer fallback data into the main leaderboards because it would provide goals but not assists, ratings, minutes, clean sheets, or cards.
- If a competition lacks detailed player match records, show a clear empty state instead of partial fake completeness.

## UI design

### Competition leaderboards

The existing `Leaderboards` tab remains scoped to the selected competition. It should keep the same card/table visual language and player/team navigation behavior.

Add a small action inside this panel: `View Global Leaderboard`, which switches to the global leaderboard view.

### Global leaderboard

Add a top-level `Global` tab in `/tournaments` and also make it reachable from the `Leaderboards` panel.

Global filters:

- Season: current season by default, optionally `All seasons` if the command can aggregate historical records safely.
- Country: `All` plus countries from loaded competitions/teams.
- Competition type: `All`, `Domestic League`, `Domestic Cup`, `Continental`.
- Position: `All`, `Goalkeeper`, `Defender`, `Midfielder`, `Forward`; granular positions can be added later if the backend exposes them consistently.

Global metrics:

- Goals
- Assists
- Average rating
- Clean sheets
- Appearances or minutes
- Cards if available

Rows should include player name, team, competition/country context where useful, and values. Player and team context-menu navigation should match the existing leaderboard rows.

## Backend design

Add DTOs for a global query and response, for example:

- `GlobalPlayerLeaderboardQuery`
  - `season: Option<u32>`
  - `country: Option<String>`
  - `competition_type: Option<String>`
  - `position: Option<String>`
  - `limit: Option<usize>`
- `GlobalPlayerLeaderboards`
  - `season: Option<u32>`
  - `filters`
  - metric boards for goals, assists, rating, clean sheets, appearances/minutes, cards

Add command:

- `get_global_player_leaderboards(query)`

Update competition aggregation:

- Remove the domestic-league-only filter where possible.
- Match records to selected competition by competition identity if available; otherwise by competition kind and team membership as a fallback.
- Keep stable sorting by value desc, then player name.

## Data constraints

This feature depends on `StatsState.player_matches`. If some competitions are still simulated score-only, they will not produce detailed player leaderboards until match-stat persistence is expanded for those competitions. The UI should communicate this instead of falling back to incomplete fixture-only stats.

## Testing

Backend:

- Competition leaderboards include domestic cup/continental records when player match stats exist.
- Global filters by country, competition type, season, and position.
- Rating board uses minute/appearance eligibility and stable sorting.
- Unknown or empty filters return empty leaderboards without errors.

Frontend:

- `/tournaments` renders the new `Global` tab.
- Filters call the global command with the expected query.
- Competition `Leaderboards` can switch to the global view.
- Empty states display for competitions without detailed player stat records.
