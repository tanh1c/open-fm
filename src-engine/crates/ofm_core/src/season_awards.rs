use crate::game::Game;
use chrono::{Datelike, NaiveDate};
use domain::league::{CompetitionKind, FixtureCompetition};
use domain::player::{Player, Position};
use domain::stats::StatsState;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// A single award entry (player + stat value).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwardEntry {
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
    pub value: f64,
}

/// Season award standings — top 5 in each category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonAwards {
    pub golden_boot: Vec<AwardEntry>,      // Top scorers
    pub assist_king: Vec<AwardEntry>,      // Top assists
    pub player_of_year: Vec<AwardEntry>,   // Best avg rating (min 5 apps)
    pub clean_sheet_king: Vec<AwardEntry>, // Most clean sheets (GKs only)
    pub most_appearances: Vec<AwardEntry>,
    pub young_player: Vec<AwardEntry>, // Best avg rating, age <= 21
}

struct PlayerAwardContext<'a> {
    player: &'a Player,
    team_id: String,
    team_name: String,
    age: i32,
}

fn free_agent_team_name() -> String {
    ["Free", "Agent"].join(" ")
}

fn player_age_on(today: &NaiveDate, date_of_birth: &str) -> i32 {
    if let Ok(dob) = NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d") {
        let mut age = today.year() - dob.year();
        if today.ordinal() < dob.ordinal() {
            age -= 1;
        }
        age
    } else {
        30
    }
}

fn resolve_team_info(game: &Game, player: &Player) -> (String, String) {
    let team_name = player
        .team_id
        .as_ref()
        .and_then(|team_id| game.teams.iter().find(|team| &team.id == team_id))
        .map(|team| team.name.clone())
        .unwrap_or_else(free_agent_team_name);
    let team_id = player.team_id.clone().unwrap_or_default();

    (team_id, team_name)
}

fn build_player_award_contexts(game: &Game) -> Vec<PlayerAwardContext<'_>> {
    let today = game.clock.current_date.date_naive();

    game.players
        .iter()
        .filter(|player| player.stats.appearances > 0)
        .map(|player| {
            let (team_id, team_name) = resolve_team_info(game, player);

            PlayerAwardContext {
                player,
                team_id,
                team_name,
                age: player_age_on(&today, &player.date_of_birth),
            }
        })
        .collect()
}

fn award_entry<'a>(context: &PlayerAwardContext<'a>, value: f64) -> AwardEntry {
    AwardEntry {
        player_id: context.player.id.clone(),
        player_name: context.player.match_name.clone(),
        team_id: context.team_id.clone(),
        team_name: context.team_name.clone(),
        value,
    }
}

fn top_awards<'a, F, G>(
    contexts: &[PlayerAwardContext<'a>],
    include: F,
    value: G,
) -> Vec<AwardEntry>
where
    F: Fn(&PlayerAwardContext<'a>) -> bool,
    G: Fn(&PlayerAwardContext<'a>) -> f64,
{
    let mut awards: Vec<_> = contexts
        .iter()
        .filter_map(|context| include(context).then(|| award_entry(context, value(context))))
        .collect();

    awards.sort_by(|a, b| {
        b.value
            .partial_cmp(&a.value)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    awards.truncate(5);
    awards
}

/// Compute current season award standings from player stats.
pub fn compute_season_awards(game: &Game) -> SeasonAwards {
    let contexts = build_player_award_contexts(game);

    // Golden Boot — top scorers
    let golden_boot = top_awards(
        &contexts,
        |context| context.player.stats.goals > 0,
        |context| context.player.stats.goals as f64,
    );

    // Assist King
    let assist_king = top_awards(
        &contexts,
        |context| context.player.stats.assists > 0,
        |context| context.player.stats.assists as f64,
    );

    // Player of the Year — best avg rating, min 5 appearances
    let player_of_year = top_awards(
        &contexts,
        |context| context.player.stats.appearances >= 5 && context.player.stats.avg_rating > 0.0,
        |context| context.player.stats.avg_rating as f64,
    );

    // Clean Sheet King — GKs only
    let clean_sheet_king = top_awards(
        &contexts,
        |context| {
            context.player.position == Position::Goalkeeper && context.player.stats.clean_sheets > 0
        },
        |context| context.player.stats.clean_sheets as f64,
    );

    // Most Appearances
    let most_appearances = top_awards(
        &contexts,
        |_| true,
        |context| context.player.stats.appearances as f64,
    );

    // Young Player of the Year — age <= 21, best avg rating, min 3 apps
    let young_player = top_awards(
        &contexts,
        |context| {
            context.age <= 21
                && context.player.stats.appearances >= 3
                && context.player.stats.avg_rating > 0.0
        },
        |context| context.player.stats.avg_rating as f64,
    );

    SeasonAwards {
        golden_boot,
        assist_king,
        player_of_year,
        clean_sheet_king,
        most_appearances,
        young_player,
    }
}

fn is_competitive_kind(kind: &CompetitionKind) -> bool {
    !matches!(
        kind,
        CompetitionKind::Friendly | CompetitionKind::PreseasonTournament
    )
}

fn is_competitive_fixture(competition: &FixtureCompetition) -> bool {
    !matches!(
        competition,
        FixtureCompetition::Friendly | FixtureCompetition::PreseasonTournament
    )
}

fn fixture_competition_matches_kind(competition: &FixtureCompetition, kind: Option<&CompetitionKind>) -> bool {
    if !is_competitive_fixture(competition) {
        return false;
    }

    match kind {
        Some(CompetitionKind::DomesticLeague) => matches!(
            competition,
            FixtureCompetition::League | FixtureCompetition::DomesticLeague
        ),
        Some(CompetitionKind::DomesticCup) => matches!(competition, FixtureCompetition::DomesticCup),
        Some(CompetitionKind::ContinentalLeague) => {
            matches!(competition, FixtureCompetition::ContinentalLeague)
        }
        Some(CompetitionKind::Friendly | CompetitionKind::PreseasonTournament | CompetitionKind::WorldCup) => false,
        None => true,
    }
}

/// Per-competition aggregate of a player's match stats, scoped to one competition.
#[derive(Default)]
struct CompetitionTally {
    goals: u32,
    assists: u32,
    appearances: u32,
    clean_sheets: u32,
    rating_sum: f64,
    last_team_id: String,
}

/// Compute season award standings for a single competition, summing only that
/// competition's per-match records. This mirrors `compute_competition_leaderboards`
/// so the Awards tab and the Leaderboards tab report the same goal/assist totals
/// (a player's cup or continental goals no longer leak into a league award).
///
/// Only the user's domestic league captures full per-player match detail, so
/// awards are populated for that competition and otherwise empty — matching the
/// leaderboards' FM-style behavior.
pub fn compute_competition_awards(
    game: &Game,
    stats: &StatsState,
    competition_id: &str,
) -> SeasonAwards {
    // Resolve the competition's team set + season (competitions first, then the
    // legacy league fallback for older saves).
    let (team_ids, season, competition_kind): (Vec<String>, u32, Option<CompetitionKind>) = game
        .competitions
        .iter()
        .find(|competition| competition.id == competition_id)
        .map(|competition| {
            (
                competition.team_ids.clone(),
                competition.season,
                Some(competition.kind.clone()),
            )
        })
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
                    (ids, league.season, Some(CompetitionKind::DomesticLeague))
                })
        })
        .unwrap_or_default();

    if team_ids.is_empty() || competition_kind.as_ref().is_some_and(|kind| !is_competitive_kind(kind)) {
        return SeasonAwards {
            golden_boot: Vec::new(),
            assist_king: Vec::new(),
            player_of_year: Vec::new(),
            clean_sheet_king: Vec::new(),
            most_appearances: Vec::new(),
            young_player: Vec::new(),
        };
    }

    let team_id_set: HashSet<&str> = team_ids.iter().map(|id| id.as_str()).collect();
    let goalkeeper_ids: HashSet<&str> = game
        .players
        .iter()
        .filter(|player| matches!(player.position.to_group_position(), Position::Goalkeeper))
        .map(|player| player.id.as_str())
        .collect();

    let mut tallies: HashMap<String, CompetitionTally> = HashMap::new();
    for record in &stats.player_matches {
        if record.season != season {
            continue;
        }
        if !fixture_competition_matches_kind(&record.competition, competition_kind.as_ref()) {
            continue;
        }
        if !team_id_set.contains(record.team_id.as_str()) {
            continue;
        }

        let tally = tallies.entry(record.player_id.clone()).or_default();
        tally.goals += record.goals as u32;
        tally.assists += record.assists as u32;
        tally.appearances += 1;
        tally.rating_sum += record.rating as f64;
        tally.last_team_id = record.team_id.clone();

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

    let today = game.clock.current_date.date_naive();
    let find_player = |player_id: &str| -> Option<&Player> {
        game.players.iter().find(|player| player.id == player_id)
    };
    let team_name = |team_id: &str| -> String {
        if team_id.is_empty() {
            return free_agent_team_name();
        }
        game.teams
            .iter()
            .find(|team| team.id == team_id)
            .map(|team| team.name.clone())
            .unwrap_or_else(free_agent_team_name)
    };

    let make_entry = |player_id: &str, tally: &CompetitionTally, value: f64| -> Option<AwardEntry> {
        let player = find_player(player_id)?;
        Some(AwardEntry {
            player_id: player.id.clone(),
            player_name: player.match_name.clone(),
            team_id: tally.last_team_id.clone(),
            team_name: team_name(&tally.last_team_id),
            value,
        })
    };

    let build = |include: &dyn Fn(&str, &CompetitionTally) -> Option<f64>| -> Vec<AwardEntry> {
        let mut entries: Vec<AwardEntry> = tallies
            .iter()
            .filter_map(|(player_id, tally)| {
                let value = include(player_id, tally)?;
                make_entry(player_id, tally, value)
            })
            .collect();
        entries.sort_by(|a, b| {
            b.value
                .partial_cmp(&a.value)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.player_name.cmp(&b.player_name))
        });
        entries.truncate(5);
        entries
    };

    let avg_rating = |tally: &CompetitionTally| -> f64 {
        if tally.appearances == 0 {
            0.0
        } else {
            tally.rating_sum / tally.appearances as f64
        }
    };

    let golden_boot = build(&|_, tally| (tally.goals > 0).then_some(tally.goals as f64));
    let assist_king = build(&|_, tally| (tally.assists > 0).then_some(tally.assists as f64));
    let player_of_year = build(&|_, tally| {
        let rating = avg_rating(tally);
        (tally.appearances >= 5 && rating > 0.0).then_some(rating)
    });
    let clean_sheet_king = build(&|player_id, tally| {
        (goalkeeper_ids.contains(player_id) && tally.clean_sheets > 0)
            .then_some(tally.clean_sheets as f64)
    });
    let most_appearances =
        build(&|_, tally| (tally.appearances > 0).then_some(tally.appearances as f64));
    let young_player = build(&|player_id, tally| {
        let rating = avg_rating(tally);
        let age = find_player(player_id)
            .map(|player| player_age_on(&today, &player.date_of_birth))
            .unwrap_or(30);
        (age <= 21 && tally.appearances >= 3 && rating > 0.0).then_some(rating)
    });

    SeasonAwards {
        golden_boot,
        assist_king,
        player_of_year,
        clean_sheet_king,
        most_appearances,
        young_player,
    }
}

#[cfg(test)]
mod tests {
    use super::compute_season_awards;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, PlayerSeasonStats, Position};
    use domain::team::Team;

    use crate::clock::GameClock;
    use crate::game::Game;

    fn default_attrs() -> PlayerAttributes {
        PlayerAttributes {
            pace: 60,
            stamina: 60,
            strength: 60,
            agility: 60,
            passing: 60,
            shooting: 60,
            tackling: 60,
            dribbling: 60,
            defending: 60,
            positioning: 60,
            vision: 60,
            decisions: 60,
            composure: 60,
            aggression: 60,
            teamwork: 60,
            leadership: 60,
            handling: 60,
            reflexes: 60,
            aerial: 60,
        }
    }

    fn make_team(id: &str, name: &str) -> Team {
        Team::new(
            id.to_string(),
            name.to_string(),
            name.to_string(),
            "England".to_string(),
            "Testville".to_string(),
            "Test Ground".to_string(),
            20_000,
        )
    }

    fn make_player(
        id: &str,
        name: &str,
        team_id: Option<&str>,
        position: Position,
        dob: &str,
        stats: PlayerSeasonStats,
    ) -> Player {
        let mut player = Player::new(
            id.to_string(),
            name.to_string(),
            name.to_string(),
            dob.to_string(),
            "England".to_string(),
            position,
            default_attrs(),
        );
        player.team_id = team_id.map(str::to_string);
        player.stats = stats;
        player
    }

    fn make_game(players: Vec<Player>, teams: Vec<Team>) -> Game {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2025, 6, 15, 12, 0, 0).unwrap());
        let manager = Manager::new(
            "mgr1".to_string(),
            "Alex".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );

        Game::new(clock, manager, teams, players, vec![], vec![])
    }

    #[test]
    fn golden_boot_is_sorted_descending_and_limited_to_top_five() {
        let team = make_team("team1", "Test FC");
        let mut players = vec![
            make_player(
                "p1",
                "Player 1",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 4,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "p2",
                "Player 2",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 6,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "p3",
                "Player 3",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 1,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "p4",
                "Player 4",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 5,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "p5",
                "Player 5",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 2,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "p6",
                "Player 6",
                Some("team1"),
                Position::Forward,
                "2000-01-01",
                PlayerSeasonStats {
                    appearances: 8,
                    goals: 3,
                    ..PlayerSeasonStats::default()
                },
            ),
        ];
        players.push(make_player(
            "p7",
            "Zero Apps",
            Some("team1"),
            Position::Forward,
            "2000-01-01",
            PlayerSeasonStats {
                appearances: 0,
                goals: 99,
                ..PlayerSeasonStats::default()
            },
        ));

        let awards = compute_season_awards(&make_game(players, vec![team]));

        let top_ids: Vec<_> = awards
            .golden_boot
            .iter()
            .map(|entry| entry.player_id.as_str())
            .collect();
        assert_eq!(top_ids, vec!["p2", "p4", "p1", "p6", "p5"]);
        assert_eq!(awards.golden_boot.len(), 5);
        assert!(
            awards
                .golden_boot
                .iter()
                .all(|entry| entry.player_name != "Zero Apps")
        );
    }

    #[test]
    fn player_of_year_and_young_player_apply_their_thresholds_and_age_rules() {
        let team = make_team("team1", "Test FC");
        let players = vec![
            make_player(
                "older-star",
                "Older Star",
                Some("team1"),
                Position::Midfielder,
                "2001-02-10",
                PlayerSeasonStats {
                    appearances: 6,
                    avg_rating: 8.4,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "young-eligible",
                "Young Eligible",
                Some("team1"),
                Position::Forward,
                "2004-06-15",
                PlayerSeasonStats {
                    appearances: 5,
                    avg_rating: 7.8,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "young-four-apps",
                "Young Four Apps",
                Some("team1"),
                Position::Forward,
                "2004-09-10",
                PlayerSeasonStats {
                    appearances: 4,
                    avg_rating: 9.0,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "young-low-apps",
                "Young Low Apps",
                Some("team1"),
                Position::Forward,
                "2005-03-10",
                PlayerSeasonStats {
                    appearances: 2,
                    avg_rating: 9.5,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "invalid-dob",
                "Invalid DOB",
                Some("team1"),
                Position::Midfielder,
                "unknown",
                PlayerSeasonStats {
                    appearances: 6,
                    avg_rating: 8.1,
                    ..PlayerSeasonStats::default()
                },
            ),
        ];

        let awards = compute_season_awards(&make_game(players, vec![team]));

        let player_of_year_ids: Vec<_> = awards
            .player_of_year
            .iter()
            .map(|entry| entry.player_id.as_str())
            .collect();
        assert_eq!(
            player_of_year_ids,
            vec!["older-star", "invalid-dob", "young-eligible"]
        );

        let young_player_ids: Vec<_> = awards
            .young_player
            .iter()
            .map(|entry| entry.player_id.as_str())
            .collect();
        assert_eq!(young_player_ids, vec!["young-four-apps", "young-eligible"]);
    }

    #[test]
    fn clean_sheet_king_only_counts_goalkeepers_and_uses_free_agent_fallback() {
        let team = make_team("team1", "Test FC");
        let players = vec![
            make_player(
                "team-gk",
                "Team Keeper",
                Some("team1"),
                Position::Goalkeeper,
                "1998-01-01",
                PlayerSeasonStats {
                    appearances: 10,
                    clean_sheets: 8,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "free-agent-gk",
                "Free Agent Keeper",
                None,
                Position::Goalkeeper,
                "1996-01-01",
                PlayerSeasonStats {
                    appearances: 9,
                    clean_sheets: 9,
                    ..PlayerSeasonStats::default()
                },
            ),
            make_player(
                "defender",
                "Defender",
                Some("team1"),
                Position::Defender,
                "1999-01-01",
                PlayerSeasonStats {
                    appearances: 12,
                    clean_sheets: 12,
                    ..PlayerSeasonStats::default()
                },
            ),
        ];

        let awards = compute_season_awards(&make_game(players, vec![team]));

        assert_eq!(awards.clean_sheet_king.len(), 2);
        assert_eq!(awards.clean_sheet_king[0].player_id, "free-agent-gk");
        assert_eq!(awards.clean_sheet_king[0].team_id, "");
        assert_eq!(awards.clean_sheet_king[0].team_name, "Free Agent");
        assert!(
            awards
                .clean_sheet_king
                .iter()
                .all(|entry| entry.player_id != "defender")
        );
    }

    #[test]
    fn competition_awards_only_count_that_competitions_matches() {
        use super::compute_competition_awards;
        use domain::league::{
            Competition, CompetitionFormat, CompetitionKind, FixtureCompetition,
        };
        use domain::stats::{PlayerMatchStatsRecord, StatsState};

        let team = make_team("team1", "Test FC");
        // Striker's season total is 14 goals, but only 11 came in the league.
        let striker = make_player(
            "striker",
            "Striker",
            Some("team1"),
            Position::Forward,
            "2000-01-01",
            PlayerSeasonStats {
                appearances: 20,
                goals: 14,
                ..PlayerSeasonStats::default()
            },
        );

        let mut game = make_game(vec![striker], vec![team]);
        let season = chrono::Datelike::year(&game.clock.current_date.date_naive()) as u32;
        game.competitions = vec![Competition {
            id: "league-1".to_string(),
            name: "Test League".to_string(),
            season,
            kind: CompetitionKind::DomesticLeague,
            format: CompetitionFormat::RoundRobin,
            country: Some("England".to_string()),
            tier: Some(1),
            team_ids: vec!["team1".to_string()],
            fixtures: vec![],
            standings: vec![],
            transfer_log: vec![],
        }];

        let mut stats = StatsState::default();
        let record = |competition: FixtureCompetition, goals: u8| PlayerMatchStatsRecord {
            fixture_id: format!("fx-{:?}-{goals}", competition),
            season,
            matchday: 1,
            date: "2026-09-01".to_string(),
            competition,
            player_id: "striker".to_string(),
            team_id: "team1".to_string(),
            opponent_team_id: "team2".to_string(),
            home_team_id: "team1".to_string(),
            away_team_id: "team2".to_string(),
            home_goals: goals,
            away_goals: 0,
            minutes_played: 90,
            goals,
            assists: 0,
            shots: 0,
            shots_on_target: 0,
            passes_completed: 0,
            passes_attempted: 0,
            tackles_won: 0,
            interceptions: 0,
            fouls_committed: 0,
            yellow_cards: 0,
            red_cards: 0,
            rating: 7.5,
        };
        // 11 league goals + 3 cup goals = the 14 the all-competition stat shows.
        stats.player_matches.push(record(FixtureCompetition::DomesticLeague, 11));
        stats.player_matches.push(record(FixtureCompetition::DomesticCup, 3));

        let awards = compute_competition_awards(&game, &stats, "league-1");
        assert_eq!(awards.golden_boot.len(), 1);
        // Must report only the 11 league goals, not the 14 season aggregate.
        assert_eq!(awards.golden_boot[0].player_id, "striker");
        assert_eq!(awards.golden_boot[0].value, 11.0);
    }

    #[test]
    fn friendly_competition_awards_are_not_official_awards() {
        use super::compute_competition_awards;
        use domain::league::{
            Competition, CompetitionFormat, CompetitionKind, FixtureCompetition,
        };
        use domain::stats::{PlayerMatchStatsRecord, StatsState};

        let team = make_team("team1", "Test FC");
        let striker = make_player(
            "striker",
            "Striker",
            Some("team1"),
            Position::Forward,
            "2000-01-01",
            PlayerSeasonStats::default(),
        );
        let mut game = make_game(vec![striker], vec![team]);
        let season = chrono::Datelike::year(&game.clock.current_date.date_naive()) as u32;
        game.competitions = vec![Competition {
            id: "friendly-1".to_string(),
            name: "Friendly".to_string(),
            season,
            kind: CompetitionKind::Friendly,
            format: CompetitionFormat::Knockout,
            country: Some("England".to_string()),
            tier: None,
            team_ids: vec!["team1".to_string()],
            fixtures: vec![],
            standings: vec![],
            transfer_log: vec![],
        }];

        let mut stats = StatsState::default();
        stats.player_matches.push(PlayerMatchStatsRecord {
            fixture_id: "friendly-fixture".to_string(),
            season,
            matchday: 1,
            date: "2026-09-01".to_string(),
            competition: FixtureCompetition::Friendly,
            player_id: "striker".to_string(),
            team_id: "team1".to_string(),
            opponent_team_id: "team2".to_string(),
            home_team_id: "team1".to_string(),
            away_team_id: "team2".to_string(),
            home_goals: 4,
            away_goals: 0,
            minutes_played: 90,
            goals: 4,
            assists: 3,
            shots: 0,
            shots_on_target: 0,
            passes_completed: 0,
            passes_attempted: 0,
            tackles_won: 0,
            interceptions: 0,
            fouls_committed: 0,
            yellow_cards: 0,
            red_cards: 0,
            rating: 8.8,
        });

        let awards = compute_competition_awards(&game, &stats, "friendly-1");

        assert!(awards.golden_boot.is_empty());
        assert!(awards.assist_king.is_empty());
        assert!(awards.player_of_year.is_empty());
    }
}
