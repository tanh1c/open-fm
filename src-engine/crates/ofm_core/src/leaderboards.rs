//! Per-competition player leaderboards (top scorers / assists / clean sheets).
//!
//! Aggregated from `StatsState.player_matches`, which carry per-match goals,
//! assists, minutes, and the goals conceded by each player's team — scoped to a
//! single competition's teams and season. Only the user's domestic league
//! produces full per-player match detail (other competitions are fast-simmed
//! with score-only results), so leaderboards are populated for the league the
//! manager actually plays in and empty elsewhere — matching FM-style behavior.

use std::collections::HashMap;

use domain::league::FixtureCompetition;
use domain::player::Position;
use domain::stats::StatsState;
use serde::{Deserialize, Serialize};

use crate::game::Game;

/// A single leaderboard row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
    pub value: u32,
}

/// Top-N standings for one competition.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompetitionLeaderboards {
    pub competition_id: String,
    pub season: u32,
    pub top_scorers: Vec<LeaderboardEntry>,
    pub top_assists: Vec<LeaderboardEntry>,
    pub top_clean_sheets: Vec<LeaderboardEntry>,
}

const LEADERBOARD_LIMIT: usize = 10;

#[derive(Default)]
struct Tally {
    goals: u32,
    assists: u32,
    clean_sheets: u32,
    /// The team the player most recently appeared for within this competition.
    last_team_id: String,
}

/// True for the per-match `competition` values that represent domestic-league play.
fn is_league_competition(competition: &FixtureCompetition) -> bool {
    matches!(
        competition,
        FixtureCompetition::League | FixtureCompetition::DomesticLeague
    )
}

/// Compute top scorers, assist makers, and goalkeeper clean sheets for the
/// competition identified by `competition_id`, scoped to that competition's
/// teams and season.
pub fn compute_competition_leaderboards(
    game: &Game,
    stats: &StatsState,
    competition_id: &str,
) -> CompetitionLeaderboards {
    // Resolve the competition's team set + season (competitions first, then the
    // legacy league fallback for older saves).
    let (team_ids, season): (Vec<String>, u32) = game
        .competitions
        .iter()
        .find(|competition| competition.id == competition_id)
        .map(|competition| (competition.team_ids.clone(), competition.season))
        .or_else(|| {
            game.league
                .as_ref()
                .filter(|league| league.id == competition_id)
                .map(|league| {
                    let ids: Vec<String> = league
                        .standings
                        .iter()
                        .map(|standing| standing.team_id.clone())
                        .collect();
                    (ids, league.season)
                })
        })
        .unwrap_or_default();

    let mut result = CompetitionLeaderboards {
        competition_id: competition_id.to_string(),
        season,
        ..Default::default()
    };

    if team_ids.is_empty() {
        return result;
    }

    let team_id_set: std::collections::HashSet<&str> =
        team_ids.iter().map(|id| id.as_str()).collect();
    let goalkeeper_ids: std::collections::HashSet<&str> = game
        .players
        .iter()
        .filter(|player| {
            matches!(player.position.to_group_position(), Position::Goalkeeper)
        })
        .map(|player| player.id.as_str())
        .collect();

    let mut tallies: HashMap<String, Tally> = HashMap::new();

    for record in &stats.player_matches {
        if record.season != season {
            continue;
        }
        if !is_league_competition(&record.competition) {
            continue;
        }
        if !team_id_set.contains(record.team_id.as_str()) {
            continue;
        }

        let tally = tallies.entry(record.player_id.clone()).or_default();
        tally.goals += record.goals as u32;
        tally.assists += record.assists as u32;
        tally.last_team_id = record.team_id.clone();

        // Clean sheet: the player's team conceded nothing while they were on
        // the pitch. Only goalkeepers count toward the clean-sheet board.
        if record.minutes_played > 0 && goalkeeper_ids.contains(record.player_id.as_str()) {
            let conceded = if record.team_id == record.home_team_id {
                record.away_goals
            } else {
                record.home_goals
            };
            if conceded == 0 {
                tally.clean_sheets += 1;
            }
        }
    }

    let player_name = |player_id: &str| -> String {
        game.players
            .iter()
            .find(|player| player.id == player_id)
            .map(|player| player.full_name.clone())
            .unwrap_or_else(|| player_id.to_string())
    };
    let team_name = |team_id: &str| -> String {
        game.teams
            .iter()
            .find(|team| team.id == team_id)
            .map(|team| team.name.clone())
            .unwrap_or_default()
    };

    let build = |select: &dyn Fn(&Tally) -> u32| -> Vec<LeaderboardEntry> {
        let mut entries: Vec<LeaderboardEntry> = tallies
            .iter()
            .filter_map(|(player_id, tally)| {
                let value = select(tally);
                if value == 0 {
                    return None;
                }
                Some(LeaderboardEntry {
                    player_id: player_id.clone(),
                    player_name: player_name(player_id),
                    team_id: tally.last_team_id.clone(),
                    team_name: team_name(&tally.last_team_id),
                    value,
                })
            })
            .collect();
        // Sort by value desc, then name for stable ties.
        entries.sort_by(|a, b| b.value.cmp(&a.value).then_with(|| a.player_name.cmp(&b.player_name)));
        entries.truncate(LEADERBOARD_LIMIT);
        entries
    };

    result.top_scorers = build(&|tally| tally.goals);
    result.top_assists = build(&|tally| tally.assists);
    result.top_clean_sheets = build(&|tally| tally.clean_sheets);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes};
    use domain::stats::PlayerMatchStatsRecord;
    use domain::team::Team;

    fn attrs() -> PlayerAttributes {
        PlayerAttributes {
            pace: 60, stamina: 60, strength: 60, agility: 60, passing: 60,
            shooting: 60, tackling: 60, dribbling: 60, defending: 60,
            positioning: 60, vision: 60, decisions: 60, composure: 60,
            aggression: 60, teamwork: 60, leadership: 60, handling: 20,
            reflexes: 20, aerial: 60,
        }
    }

    fn player(id: &str, team: &str, pos: Position) -> Player {
        let mut p = Player::new(
            id.to_string(), id.to_string(), format!("Name {id}"),
            "2000-01-01".to_string(), "ENG".to_string(), pos, attrs(),
        );
        p.team_id = Some(team.to_string());
        p
    }

    fn league_match(
        player_id: &str,
        team_id: &str,
        home_team_id: &str,
        away_team_id: &str,
        home_goals: u8,
        away_goals: u8,
        goals: u8,
        assists: u8,
    ) -> PlayerMatchStatsRecord {
        PlayerMatchStatsRecord {
            fixture_id: format!("fx-{player_id}-{home_team_id}-{away_team_id}"),
            season: 2026,
            matchday: 1,
            date: "2026-09-01".to_string(),
            competition: FixtureCompetition::DomesticLeague,
            player_id: player_id.to_string(),
            team_id: team_id.to_string(),
            opponent_team_id: if team_id == home_team_id { away_team_id } else { home_team_id }.to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            home_goals,
            away_goals,
            minutes_played: 90,
            goals,
            assists,
            shots: 0, shots_on_target: 0, passes_completed: 0, passes_attempted: 0,
            tackles_won: 0, interceptions: 0, fouls_committed: 0, yellow_cards: 0,
            red_cards: 0, rating: 7.0,
        }
    }

    fn test_game() -> Game {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
        let manager = Manager::new(
            "m".to_string(), "T".to_string(), "M".to_string(),
            "1980-01-01".to_string(), "England".to_string(),
        );
        let teams = vec![
            Team::new("t1".to_string(), "Team One".to_string(), "T1".to_string(), "England".to_string(), "England".to_string(), "G".to_string(), 30000),
            Team::new("t2".to_string(), "Team Two".to_string(), "T2".to_string(), "England".to_string(), "England".to_string(), "G".to_string(), 30000),
        ];
        let players = vec![
            player("striker", "t1", Position::Striker),
            player("keeper", "t2", Position::Goalkeeper),
        ];
        let mut game = Game::new(GameClock::new(start), manager, teams, players, vec![], vec![]);
        // Minimal competition so the leaderboard can resolve team_ids + season.
        game.competitions = vec![domain::league::Competition {
            id: "comp-1".to_string(),
            name: "Test League".to_string(),
            season: 2026,
            kind: domain::league::CompetitionKind::DomesticLeague,
            format: domain::league::CompetitionFormat::RoundRobin,
            country: Some("England".to_string()),
            tier: Some(1),
            team_ids: vec!["t1".to_string(), "t2".to_string()],
            fixtures: vec![],
            standings: vec![],
            transfer_log: vec![],
        }];
        game
    }

    #[test]
    fn leaderboards_rank_scorers_assists_and_gk_clean_sheets() {
        let game = test_game();
        let mut stats = StatsState::default();
        // Striker scores 2 + 1 assist across two t1 wins (t1 keeps clean sheets,
        // but the striker is not a GK so should not appear on clean-sheet board).
        stats.player_matches.push(league_match("striker", "t1", "t1", "t2", 2, 0, 2, 1));
        stats.player_matches.push(league_match("striker", "t1", "t2", "t1", 0, 1, 1, 0));
        // Keeper (t2) plays two matches, conceding in the first, clean in the second.
        stats.player_matches.push(league_match("keeper", "t2", "t1", "t2", 2, 0, 0, 0));
        stats.player_matches.push(league_match("keeper", "t2", "t2", "t1", 3, 0, 0, 0)); // t2 home, away_goals=0 → clean

        let board = compute_competition_leaderboards(&game, &stats, "comp-1");

        assert_eq!(board.season, 2026);
        assert_eq!(board.top_scorers[0].player_id, "striker");
        assert_eq!(board.top_scorers[0].value, 3);
        assert_eq!(board.top_assists[0].player_id, "striker");
        assert_eq!(board.top_assists[0].value, 1);
        // Only the goalkeeper, with exactly one clean sheet (the 3-0 home win).
        assert_eq!(board.top_clean_sheets.len(), 1);
        assert_eq!(board.top_clean_sheets[0].player_id, "keeper");
        assert_eq!(board.top_clean_sheets[0].value, 1);
    }

    #[test]
    fn leaderboards_empty_for_unknown_competition() {
        let game = test_game();
        let stats = StatsState::default();
        let board = compute_competition_leaderboards(&game, &stats, "does-not-exist");
        assert!(board.top_scorers.is_empty());
        assert!(board.top_assists.is_empty());
        assert!(board.top_clean_sheets.is_empty());
    }
}

