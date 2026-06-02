//! Per-competition and global player leaderboards.
//!
//! Aggregated from `StatsState.player_matches`, which carry per-match goals,
//! assists, minutes, ratings, cards, and team score context. Competitions without
//! detailed player match records return empty leaderboards instead of falling
//! back to partial fixture-scorer data.

use std::collections::HashMap;

use domain::league::{CompetitionKind, FixtureCompetition};
use domain::player::Position;
use domain::stats::StatsState;
use serde::{Deserialize, Serialize};

use crate::game::Game;

/// A single counting leaderboard row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
    pub value: u32,
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

/// Top-N standings for one competition.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompetitionLeaderboards {
    pub competition_id: String,
    pub season: u32,
    pub top_scorers: Vec<LeaderboardEntry>,
    pub top_assists: Vec<LeaderboardEntry>,
    pub top_clean_sheets: Vec<LeaderboardEntry>,
}

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

const LEADERBOARD_LIMIT: usize = 10;
const GLOBAL_LEADERBOARD_LIMIT: usize = 50;

#[derive(Default)]
struct Tally {
    goals: u32,
    assists: u32,
    clean_sheets: u32,
    appearances: u32,
    minutes: u32,
    yellow_cards: u32,
    red_cards: u32,
    rating_total: f64,
    rating_count: u32,
    last_team_id: String,
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

pub fn compute_global_player_leaderboards(
    game: &Game,
    stats: &StatsState,
    query: GlobalPlayerLeaderboardQuery,
) -> GlobalPlayerLeaderboards {
    let player_by_id: HashMap<&str, _> = game.players.iter().map(|player| (player.id.as_str(), player)).collect();
    let team_by_id: HashMap<&str, _> = game.teams.iter().map(|team| (team.id.as_str(), team)).collect();
    let competition_by_kind: Vec<_> = game.competitions.iter().collect();
    let limit = query.limit.unwrap_or(GLOBAL_LEADERBOARD_LIMIT).max(1);
    let country_filter = normalized_filter(query.country.as_deref());
    let competition_filter = normalized_filter(query.competition_type.as_deref());
    let position_filter = normalized_filter(query.position.as_deref());
    let mut tallies: HashMap<String, Tally> = HashMap::new();

    for record in &stats.player_matches {
        if query.season.is_some_and(|season| record.season != season) {
            continue;
        }

        let Some(player) = player_by_id.get(record.player_id.as_str()) else {
            continue;
        };
        let Some(team) = team_by_id.get(record.team_id.as_str()) else {
            continue;
        };

        if let Some(position) = position_filter.as_deref() {
            if !position_matches(position, &player.position) {
                continue;
            }
        }

        let competition_kind = competition_kind_from_fixture(&record.competition);
        if let Some(competition_type) = competition_filter.as_deref() {
            if !competition_type_matches(competition_type, &competition_kind) {
                continue;
            }
        }

        let competition_country = competition_by_kind
            .iter()
            .find(|competition| {
                competition.season == record.season
                    && competition.kind == competition_kind
                    && competition.team_ids.iter().any(|team_id| team_id == &record.team_id)
            })
            .and_then(|competition| competition.country.as_deref());
        let country = competition_country.unwrap_or(team.country.as_str());
        if let Some(country_filter) = country_filter.as_deref() {
            if !country.eq_ignore_ascii_case(country_filter) {
                continue;
            }
        }

        let tally = tallies.entry(record.player_id.clone()).or_default();
        tally.goals += record.goals as u32;
        tally.assists += record.assists as u32;
        tally.appearances += u32::from(record.minutes_played > 0);
        tally.minutes += record.minutes_played as u32;
        tally.yellow_cards += record.yellow_cards as u32;
        tally.red_cards += record.red_cards as u32;
        if record.minutes_played > 0 {
            tally.rating_total += record.rating as f64;
            tally.rating_count += 1;
        }
        tally.last_team_id = record.team_id.clone();

        if record.minutes_played > 0
            && matches!(player.position.to_group_position(), Position::Goalkeeper)
        {
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

    let mut result = GlobalPlayerLeaderboards {
        season: query.season,
        ..Default::default()
    };
    result.top_scorers = build_count_board(&tallies, game, limit, |tally| tally.goals);
    result.top_assists = build_count_board(&tallies, game, limit, |tally| tally.assists);
    result.top_clean_sheets = build_count_board(&tallies, game, limit, |tally| tally.clean_sheets);
    result.appearances = build_count_board(&tallies, game, limit, |tally| tally.appearances);
    result.minutes = build_count_board(&tallies, game, limit, |tally| tally.minutes);
    result.yellow_cards = build_count_board(&tallies, game, limit, |tally| tally.yellow_cards);
    result.red_cards = build_count_board(&tallies, game, limit, |tally| tally.red_cards);
    result.average_ratings = build_rating_board(&tallies, game, limit);
    result
}

fn normalized_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("all"))
        .map(ToOwned::to_owned)
}

fn competition_kind_from_fixture(competition: &FixtureCompetition) -> CompetitionKind {
    match competition {
        FixtureCompetition::League | FixtureCompetition::DomesticLeague => CompetitionKind::DomesticLeague,
        FixtureCompetition::DomesticCup => CompetitionKind::DomesticCup,
        FixtureCompetition::ContinentalLeague => CompetitionKind::ContinentalLeague,
        FixtureCompetition::Friendly => CompetitionKind::Friendly,
        FixtureCompetition::PreseasonTournament => CompetitionKind::PreseasonTournament,
    }
}

fn competition_type_matches(filter: &str, kind: &CompetitionKind) -> bool {
    matches!(
        (filter, kind),
        ("DomesticLeague", CompetitionKind::DomesticLeague)
            | ("Domestic Cup", CompetitionKind::DomesticCup)
            | ("DomesticCup", CompetitionKind::DomesticCup)
            | ("Continental", CompetitionKind::ContinentalLeague)
            | ("ContinentalLeague", CompetitionKind::ContinentalLeague)
            | ("Friendly", CompetitionKind::Friendly)
            | ("PreseasonTournament", CompetitionKind::PreseasonTournament)
    )
}

fn position_matches(filter: &str, position: &Position) -> bool {
    matches!(
        (filter, position.to_group_position()),
        ("Goalkeeper", Position::Goalkeeper)
            | ("Defender", Position::Defender)
            | ("Midfielder", Position::Midfielder)
            | ("Forward", Position::Forward)
    )
}

fn build_count_board(
    tallies: &HashMap<String, Tally>,
    game: &Game,
    limit: usize,
    select: impl Fn(&Tally) -> u32,
) -> Vec<LeaderboardEntry> {
    let mut entries: Vec<LeaderboardEntry> = tallies
        .iter()
        .filter_map(|(player_id, tally)| {
            let value = select(tally);
            if value == 0 {
                return None;
            }
            Some(LeaderboardEntry {
                player_id: player_id.clone(),
                player_name: player_name(game, player_id),
                team_id: tally.last_team_id.clone(),
                team_name: team_name(game, &tally.last_team_id),
                value,
            })
        })
        .collect();
    entries.sort_by(|a, b| b.value.cmp(&a.value).then_with(|| a.player_name.cmp(&b.player_name)));
    entries.truncate(limit);
    entries
}

fn build_rating_board(
    tallies: &HashMap<String, Tally>,
    game: &Game,
    limit: usize,
) -> Vec<RatingLeaderboardEntry> {
    let mut entries: Vec<RatingLeaderboardEntry> = tallies
        .iter()
        .filter_map(|(player_id, tally)| {
            if tally.rating_count == 0 || tally.minutes == 0 {
                return None;
            }
            Some(RatingLeaderboardEntry {
                player_id: player_id.clone(),
                player_name: player_name(game, player_id),
                team_id: tally.last_team_id.clone(),
                team_name: team_name(game, &tally.last_team_id),
                value: tally.rating_total / tally.rating_count as f64,
                appearances: tally.appearances,
                minutes: tally.minutes,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.value
            .total_cmp(&a.value)
            .then_with(|| a.player_name.cmp(&b.player_name))
    });
    entries.truncate(limit);
    entries
}

fn player_name(game: &Game, player_id: &str) -> String {
    game.players
        .iter()
        .find(|player| player.id == player_id)
        .map(|player| player.full_name.clone())
        .unwrap_or_else(|| player_id.to_string())
}

fn team_name(game: &Game, team_id: &str) -> String {
    game.teams
        .iter()
        .find(|team| team.id == team_id)
        .map(|team| team.name.clone())
        .unwrap_or_default()
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
        player_match(
            FixtureCompetition::DomesticLeague,
            player_id,
            team_id,
            home_team_id,
            away_team_id,
            home_goals,
            away_goals,
            goals,
            assists,
        )
    }

    fn player_match(
        competition: FixtureCompetition,
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
            fixture_id: format!("fx-{player_id}-{home_team_id}-{away_team_id}-{competition:?}"),
            season: 2026,
            matchday: 1,
            date: "2026-09-01".to_string(),
            competition,
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
            player("mid", "t1", Position::CentralMidfielder),
            player("def", "t2", Position::CenterBack),
        ];
        let mut game = Game::new(GameClock::new(start), manager, teams, players, vec![], vec![]);
        // Minimal competition so the leaderboard can resolve team_ids + season.
        game.competitions = vec![
            domain::league::Competition {
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
            },
            domain::league::Competition {
                id: "cup-1".to_string(),
                name: "Test Cup".to_string(),
                season: 2026,
                kind: domain::league::CompetitionKind::DomesticCup,
                format: domain::league::CompetitionFormat::Knockout,
                country: Some("England".to_string()),
                tier: None,
                team_ids: vec!["t1".to_string(), "t2".to_string()],
                fixtures: vec![],
                standings: vec![],
                transfer_log: vec![],
            },
            domain::league::Competition {
                id: "continental-1".to_string(),
                name: "Test Continental".to_string(),
                season: 2026,
                kind: domain::league::CompetitionKind::ContinentalLeague,
                format: domain::league::CompetitionFormat::RoundRobin,
                country: None,
                tier: None,
                team_ids: vec!["t1".to_string(), "t2".to_string()],
                fixtures: vec![],
                standings: vec![],
                transfer_log: vec![],
            },
        ];
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
    fn competition_leaderboards_include_non_league_records() {
        let game = test_game();
        let mut stats = StatsState::default();
        stats.player_matches.push(player_match(
            FixtureCompetition::DomesticCup,
            "striker",
            "t1",
            "t1",
            "t2",
            2,
            0,
            2,
            1,
        ));

        let board = compute_competition_leaderboards(&game, &stats, "cup-1");

        assert_eq!(board.top_scorers[0].player_id, "striker");
        assert_eq!(board.top_scorers[0].value, 2);
        assert_eq!(board.top_assists[0].value, 1);
    }

    #[test]
    fn global_leaderboards_filter_by_season_country_competition_type_and_position() {
        let game = test_game();
        let mut stats = StatsState::default();
        let mut matching = player_match(
            FixtureCompetition::DomesticCup,
            "striker",
            "t1",
            "t1",
            "t2",
            3,
            1,
            2,
            1,
        );
        matching.yellow_cards = 1;
        matching.rating = 8.2;
        stats.player_matches.push(matching);
        stats.player_matches.push(player_match(
            FixtureCompetition::DomesticLeague,
            "mid",
            "t1",
            "t1",
            "t2",
            1,
            0,
            1,
            2,
        ));
        stats.player_matches.push(player_match(
            FixtureCompetition::DomesticCup,
            "def",
            "t2",
            "t1",
            "t2",
            3,
            1,
            1,
            0,
        ));

        let board = compute_global_player_leaderboards(
            &game,
            &stats,
            GlobalPlayerLeaderboardQuery {
                season: Some(2026),
                country: Some("England".to_string()),
                competition_type: Some("DomesticCup".to_string()),
                position: Some("Forward".to_string()),
                limit: Some(10),
            },
        );

        assert_eq!(board.top_scorers.len(), 1);
        assert_eq!(board.top_scorers[0].player_id, "striker");
        assert_eq!(board.top_assists[0].player_id, "striker");
        assert_eq!(board.yellow_cards[0].value, 1);
        assert_eq!(board.average_ratings[0].player_id, "striker");
        assert!((board.average_ratings[0].value - 8.2).abs() < 0.01);
    }

    #[test]
    fn global_leaderboards_aggregate_all_competitions_when_type_is_empty() {
        let game = test_game();
        let mut stats = StatsState::default();
        stats.player_matches.push(player_match(
            FixtureCompetition::DomesticLeague,
            "striker",
            "t1",
            "t1",
            "t2",
            2,
            0,
            2,
            1,
        ));
        stats.player_matches.push(player_match(
            FixtureCompetition::DomesticCup,
            "striker",
            "t1",
            "t1",
            "t2",
            1,
            0,
            1,
            2,
        ));
        stats.player_matches.push(player_match(
            FixtureCompetition::ContinentalLeague,
            "striker",
            "t1",
            "t1",
            "t2",
            3,
            1,
            3,
            1,
        ));

        let board = compute_global_player_leaderboards(
            &game,
            &stats,
            GlobalPlayerLeaderboardQuery {
                season: Some(2026),
                country: None,
                competition_type: None,
                position: None,
                limit: Some(10),
            },
        );

        assert_eq!(board.top_scorers[0].player_id, "striker");
        assert_eq!(board.top_scorers[0].value, 6);
        assert_eq!(board.top_assists[0].player_id, "striker");
        assert_eq!(board.top_assists[0].value, 4);
        assert_eq!(board.appearances[0].value, 3);
        assert_eq!(board.minutes[0].value, 270);

        let cup_board = compute_global_player_leaderboards(
            &game,
            &stats,
            GlobalPlayerLeaderboardQuery {
                season: Some(2026),
                country: None,
                competition_type: Some("DomesticCup".to_string()),
                position: None,
                limit: Some(10),
            },
        );

        assert_eq!(cup_board.top_scorers[0].value, 1);
        assert_eq!(cup_board.top_assists[0].value, 2);
        assert_eq!(cup_board.appearances[0].value, 1);
        assert_eq!(cup_board.minutes[0].value, 90);
    }

    #[test]
    fn global_leaderboards_empty_for_unknown_filters() {
        let game = test_game();
        let mut stats = StatsState::default();
        stats.player_matches.push(league_match("striker", "t1", "t1", "t2", 2, 0, 2, 1));

        let board = compute_global_player_leaderboards(
            &game,
            &stats,
            GlobalPlayerLeaderboardQuery {
                season: Some(2026),
                country: Some("Spain".to_string()),
                competition_type: Some("DomesticCup".to_string()),
                position: Some("Goalkeeper".to_string()),
                limit: Some(10),
            },
        );

        assert!(board.top_scorers.is_empty());
        assert!(board.top_assists.is_empty());
        assert!(board.top_clean_sheets.is_empty());
        assert!(board.average_ratings.is_empty());
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

