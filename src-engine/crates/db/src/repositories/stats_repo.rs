use domain::league::FixtureCompetition;
use domain::stats::{PlayerMatchStatsRecord, StatsState, TeamMatchStatsRecord};
use rusqlite::{Connection, params};

const GAME_PERSISTENCE_LOAD_ERROR: &str = "be.error.gamePersistence.loadFailed";
const GAME_PERSISTENCE_WRITE_ERROR: &str = "be.error.gamePersistence.writeFailed";

fn competition_to_string(competition: &FixtureCompetition) -> String {
    match competition {
        FixtureCompetition::League => "League".to_string(),
        FixtureCompetition::DomesticLeague => "DomesticLeague".to_string(),
        FixtureCompetition::DomesticCup => "DomesticCup".to_string(),
        FixtureCompetition::ContinentalLeague => "ContinentalLeague".to_string(),
        FixtureCompetition::Friendly => "Friendly".to_string(),
        FixtureCompetition::PreseasonTournament => "PreseasonTournament".to_string(),
    }
}

fn parse_competition(value: &str) -> FixtureCompetition {
    match value {
        "DomesticLeague" => FixtureCompetition::DomesticLeague,
        "DomesticCup" => FixtureCompetition::DomesticCup,
        "ContinentalLeague" => FixtureCompetition::ContinentalLeague,
        "Friendly" => FixtureCompetition::Friendly,
        "PreseasonTournament" => FixtureCompetition::PreseasonTournament,
        _ => FixtureCompetition::League,
    }
}

pub fn replace_stats_state(conn: &Connection, stats: &StatsState) -> Result<(), String> {
    upsert_stats_state(conn, stats)
}

/// Persist match stats append-only.
///
/// Match stats are immutable once a fixture is played, and both tables are
/// keyed by `(fixture_id, player_id)` / `(fixture_id, team_id)`. Using
/// `INSERT OR IGNORE` with a single cached statement means each save only
/// writes rows for fixtures not already stored, instead of rewriting the whole
/// career history every time — the dominant cost as a save accumulates seasons.
pub fn upsert_stats_state(conn: &Connection, stats: &StatsState) -> Result<(), String> {
    {
        let mut player_stmt = conn
            .prepare_cached(
                "INSERT OR IGNORE INTO player_match_stats (
                    fixture_id, season, matchday, date, competition, player_id, team_id,
                    opponent_team_id, home_team_id, away_team_id, home_goals, away_goals,
                    minutes_played, goals, assists, shots, shots_on_target, passes_completed,
                    passes_attempted, tackles_won, interceptions, fouls_committed,
                    yellow_cards, red_cards, rating
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
            )
            .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;

        for record in &stats.player_matches {
            player_stmt
                .execute(params![
                    record.fixture_id,
                    record.season,
                    record.matchday,
                    record.date,
                    competition_to_string(&record.competition),
                    record.player_id,
                    record.team_id,
                    record.opponent_team_id,
                    record.home_team_id,
                    record.away_team_id,
                    record.home_goals,
                    record.away_goals,
                    record.minutes_played,
                    record.goals,
                    record.assists,
                    record.shots,
                    record.shots_on_target,
                    record.passes_completed,
                    record.passes_attempted,
                    record.tackles_won,
                    record.interceptions,
                    record.fouls_committed,
                    record.yellow_cards,
                    record.red_cards,
                    record.rating,
                ])
                .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;
        }
    }

    {
        let mut team_stmt = conn
            .prepare_cached(
                "INSERT OR IGNORE INTO team_match_stats (
                    fixture_id, season, matchday, date, competition, team_id, opponent_team_id,
                    home_team_id, away_team_id, goals_for, goals_against, possession_pct,
                    shots, shots_on_target, passes_completed, passes_attempted, tackles_won,
                    interceptions, fouls_committed, yellow_cards, red_cards
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            )
            .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;

        for record in &stats.team_matches {
            team_stmt
                .execute(params![
                    record.fixture_id,
                    record.season,
                    record.matchday,
                    record.date,
                    competition_to_string(&record.competition),
                    record.team_id,
                    record.opponent_team_id,
                    record.home_team_id,
                    record.away_team_id,
                    record.goals_for,
                    record.goals_against,
                    record.possession_pct,
                    record.shots,
                    record.shots_on_target,
                    record.passes_completed,
                    record.passes_attempted,
                    record.tackles_won,
                    record.interceptions,
                    record.fouls_committed,
                    record.yellow_cards,
                    record.red_cards,
                ])
                .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;
        }
    }

    // Mirror the in-memory retention window on disk: drop per-match rows older
    // than the kept seasons so the DB cannot grow without bound across a long
    // career. Long-term summaries live in other tables and are unaffected.
    if let Some(min_season) = stats.retained_min_season() {
        conn.execute(
            "DELETE FROM player_match_stats WHERE season < ?1",
            params![min_season],
        )
        .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;
        conn.execute(
            "DELETE FROM team_match_stats WHERE season < ?1",
            params![min_season],
        )
        .map_err(|_| GAME_PERSISTENCE_WRITE_ERROR.to_string())?;
    }

    Ok(())
}

pub fn load_stats_state(conn: &Connection) -> Result<StatsState, String> {
    let mut player_stmt = conn
        .prepare(
            "SELECT fixture_id, season, matchday, date, competition, player_id, team_id,
                    opponent_team_id, home_team_id, away_team_id, home_goals, away_goals,
                    minutes_played, goals, assists, shots, shots_on_target, passes_completed,
                    passes_attempted, tackles_won, interceptions, fouls_committed,
                    yellow_cards, red_cards, rating
             FROM player_match_stats
             ORDER BY date, matchday, fixture_id, player_id",
        )
        .map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?;
    let player_rows = player_stmt
        .query_map([], |row| {
            Ok(PlayerMatchStatsRecord {
                fixture_id: row.get(0)?,
                season: row.get(1)?,
                matchday: row.get(2)?,
                date: row.get(3)?,
                competition: parse_competition(&row.get::<_, String>(4)?),
                player_id: row.get(5)?,
                team_id: row.get(6)?,
                opponent_team_id: row.get(7)?,
                home_team_id: row.get(8)?,
                away_team_id: row.get(9)?,
                home_goals: row.get(10)?,
                away_goals: row.get(11)?,
                minutes_played: row.get(12)?,
                goals: row.get(13)?,
                assists: row.get(14)?,
                shots: row.get(15)?,
                shots_on_target: row.get(16)?,
                passes_completed: row.get(17)?,
                passes_attempted: row.get(18)?,
                tackles_won: row.get(19)?,
                interceptions: row.get(20)?,
                fouls_committed: row.get(21)?,
                yellow_cards: row.get(22)?,
                red_cards: row.get(23)?,
                rating: row.get(24)?,
            })
        })
        .map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?;

    let mut player_matches = Vec::new();
    for row in player_rows {
        player_matches.push(row.map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?);
    }

    let mut team_stmt = conn
        .prepare(
            "SELECT fixture_id, season, matchday, date, competition, team_id, opponent_team_id,
                    home_team_id, away_team_id, goals_for, goals_against, possession_pct,
                    shots, shots_on_target, passes_completed, passes_attempted, tackles_won,
                    interceptions, fouls_committed, yellow_cards, red_cards
             FROM team_match_stats
             ORDER BY date, matchday, fixture_id, team_id",
        )
        .map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?;
    let team_rows = team_stmt
        .query_map([], |row| {
            Ok(TeamMatchStatsRecord {
                fixture_id: row.get(0)?,
                season: row.get(1)?,
                matchday: row.get(2)?,
                date: row.get(3)?,
                competition: parse_competition(&row.get::<_, String>(4)?),
                team_id: row.get(5)?,
                opponent_team_id: row.get(6)?,
                home_team_id: row.get(7)?,
                away_team_id: row.get(8)?,
                goals_for: row.get(9)?,
                goals_against: row.get(10)?,
                possession_pct: row.get(11)?,
                shots: row.get(12)?,
                shots_on_target: row.get(13)?,
                passes_completed: row.get(14)?,
                passes_attempted: row.get(15)?,
                tackles_won: row.get(16)?,
                interceptions: row.get(17)?,
                fouls_committed: row.get(18)?,
                yellow_cards: row.get(19)?,
                red_cards: row.get(20)?,
            })
        })
        .map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?;

    let mut team_matches = Vec::new();
    for row in team_rows {
        team_matches.push(row.map_err(|_| GAME_PERSISTENCE_LOAD_ERROR.to_string())?);
    }

    Ok(StatsState {
        player_matches,
        team_matches,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;
    use rusqlite::Connection;

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    fn sample_stats_state() -> StatsState {
        StatsState {
            player_matches: vec![PlayerMatchStatsRecord {
                fixture_id: "fixture-001".to_string(),
                season: 2025,
                matchday: 1,
                date: "2025-08-10".to_string(),
                competition: FixtureCompetition::League,
                player_id: "player-001".to_string(),
                team_id: "team-001".to_string(),
                opponent_team_id: "team-002".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                home_goals: 2,
                away_goals: 1,
                minutes_played: 90,
                goals: 1,
                assists: 0,
                shots: 3,
                shots_on_target: 2,
                passes_completed: 18,
                passes_attempted: 22,
                tackles_won: 1,
                interceptions: 0,
                fouls_committed: 1,
                yellow_cards: 0,
                red_cards: 0,
                rating: 7.4,
            }],
            team_matches: vec![TeamMatchStatsRecord {
                fixture_id: "fixture-001".to_string(),
                season: 2025,
                matchday: 1,
                date: "2025-08-10".to_string(),
                competition: FixtureCompetition::League,
                team_id: "team-001".to_string(),
                opponent_team_id: "team-002".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                goals_for: 2,
                goals_against: 1,
                possession_pct: 54,
                shots: 12,
                shots_on_target: 5,
                passes_completed: 310,
                passes_attempted: 360,
                tackles_won: 14,
                interceptions: 8,
                fouls_committed: 10,
                yellow_cards: 1,
                red_cards: 0,
            }],
        }
    }

    #[test]
    fn test_replace_stats_state_roundtrip() {
        let db = test_db();
        let stats = sample_stats_state();

        replace_stats_state(db.conn(), &stats).unwrap();
        let loaded = load_stats_state(db.conn()).unwrap();

        assert_eq!(loaded.player_matches, stats.player_matches);
        assert_eq!(loaded.team_matches, stats.team_matches);
    }

    #[test]
    fn test_replace_stats_state_returns_backend_key_when_schema_is_missing() {
        let conn = Connection::open_in_memory().unwrap();
        let stats = StatsState::default();

        let result = replace_stats_state(&conn, &stats);

        assert_eq!(result.unwrap_err(), GAME_PERSISTENCE_WRITE_ERROR);
    }

    #[test]
    fn test_load_stats_state_returns_backend_key_when_schema_is_missing() {
        let conn = Connection::open_in_memory().unwrap();

        let result = load_stats_state(&conn);

        assert_eq!(result.unwrap_err(), GAME_PERSISTENCE_LOAD_ERROR);
    }

    #[test]
    fn test_save_is_append_only_and_idempotent() {
        let db = test_db();
        let first = sample_stats_state();

        // Saving the same state twice must not duplicate rows (append-only).
        upsert_stats_state(db.conn(), &first).unwrap();
        upsert_stats_state(db.conn(), &first).unwrap();

        let after_dup = load_stats_state(db.conn()).unwrap();
        assert_eq!(after_dup.player_matches.len(), 1);
        assert_eq!(after_dup.team_matches.len(), 1);

        // A later save carrying the old match plus one new match adds only the
        // new fixture's rows; the existing fixture row is left untouched.
        let mut second = sample_stats_state();
        let mut new_player = second.player_matches[0].clone();
        new_player.fixture_id = "fixture-002".to_string();
        new_player.matchday = 2;
        second.player_matches.push(new_player);
        let mut new_team = second.team_matches[0].clone();
        new_team.fixture_id = "fixture-002".to_string();
        new_team.matchday = 2;
        second.team_matches.push(new_team);

        upsert_stats_state(db.conn(), &second).unwrap();

        let loaded = load_stats_state(db.conn()).unwrap();
        assert_eq!(loaded.player_matches.len(), 2);
        assert_eq!(loaded.team_matches.len(), 2);
        assert!(loaded
            .player_matches
            .iter()
            .any(|record| record.fixture_id == "fixture-002"));
    }

    #[test]
    fn test_save_prunes_match_rows_older_than_retention_window() {
        let db = test_db();

        // Build a state spanning 8 seasons (one fixture each). The in-memory
        // prune keeps the most recent MAX_RETAINED_STAT_SEASONS; the DB write
        // must mirror that so old rows do not accumulate on disk.
        let mut state = StatsState::default();
        for season in 2020..=2027u32 {
            let mut player = sample_stats_state().player_matches[0].clone();
            player.fixture_id = format!("fix-{season}");
            player.season = season;
            let mut team = sample_stats_state().team_matches[0].clone();
            team.fixture_id = format!("fix-{season}");
            team.season = season;
            state.player_matches.push(player);
            state.team_matches.push(team);
        }

        upsert_stats_state(db.conn(), &state).unwrap();

        let player_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM player_match_stats", [], |row| row.get(0))
            .unwrap();
        let oldest: u32 = db
            .conn()
            .query_row("SELECT MIN(season) FROM player_match_stats", [], |row| row.get(0))
            .unwrap();

        // The post-insert DELETE trims to retained_min_season() = 2027 - 4 = 2023,
        // so only the most recent 5 seasons survive on disk.
        assert_eq!(player_count, 5);
        assert_eq!(oldest, 2023);
        let team_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM team_match_stats", [], |row| row.get(0))
            .unwrap();
        assert_eq!(team_count, 5);
    }
}
