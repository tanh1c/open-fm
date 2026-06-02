mod news;
mod post_match;
mod round_summary;

use crate::board_objectives;
use crate::game::Game;
use crate::live_match_manager::build_team_with_bench;
use crate::player_events;
use crate::random_events;
use crate::scouting;
use crate::training;
use crate::transfers;
use chrono::Datelike;
use domain::league::{Fixture, FixtureStatus, GoalEvent, MatchResult};
use domain::stats::{PlayerMatchStatsRecord, StatsState, TeamMatchStatsRecord};
use log::{debug, info};
use std::collections::HashMap;

// Re-export public items
pub use news::generate_matchday_news;
pub use post_match::{apply_match_report, apply_match_report_with_capture};
pub use round_summary::{
    NotableUpset, RoundResultSummary, RoundSummary, StandingDelta, TopScorerDelta,
    build_round_summary,
};

/// Progress injury recovery by one day for all currently injured players.
/// Players with 1 day remaining are cleared (fully recovered).
fn progress_injury_recovery(game: &mut Game) {
    for player in game.players.iter_mut() {
        if let Some(mut injury) = player.injury.take()
            && injury.days_remaining > 1
        {
            injury.days_remaining -= 1;
            player.injury = Some(injury);
        }
    }
}

/// Process a single day advance.
pub fn process_day(game: &mut Game) {
    process_day_with_capture(game, &mut |_| {});
}

pub fn process_day_with_capture<F>(game: &mut Game, on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();

    let has_match_today = has_scheduled_fixture_today(game, &today);

    if has_match_today {
        info!("[turn] process_day {}: matchday", today);
        simulate_matchday_with_capture(game, &today, on_capture);
    } else {
        let weekday_num = game.clock.current_date.weekday().num_days_from_monday();
        training::process_training(game, weekday_num);
        training::check_squad_fitness_warnings(game);
    }

    // After today's results resolve, advance any knockout brackets whose latest
    // round just completed (domestic cups + Champions League knockout phase).
    crate::knockout::process_knockout_progression(game, &today);

    crate::contracts::process_contract_expiries(game);
    transfers::process_loan_expiries(game);

    // Weekly financial processing (wages, matchday income, warnings)
    crate::finances::process_weekly_finances(game);

    // Board objectives (generate if missing, update progress)
    board_objectives::generate_objectives(game);
    board_objectives::update_objective_progress(game);

    // Player conversations, random events, and scouting
    player_events::check_player_events(game);
    progress_injury_recovery(game);
    random_events::check_random_events(game);
    scouting::process_scouting(game);
    transfers::process_transfer_market_tick(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);

    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);
    news::prune_old_news(game);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    debug!("[turn] process_day {}: complete, advancing clock", today);
    game.clock.advance_days(1);
    // Keep the mirrored primary competition in step with the legacy league the
    // simulation just mutated, so the frontend (which prefers competitions)
    // sees fresh results/standings instead of a stale scheduled copy.
    game.sync_primary_competition_from_legacy_league();
    crate::season_context::refresh_game_context(game);
}

/// Called after a live match finishes to complete the day:
/// generates matchday news, pre-match messages, and advances the clock by one day.
pub fn finish_live_match_day(game: &mut Game) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    info!("[turn] finish_live_match_day: {}", today);
    generate_matchday_news(game, &today);

    // Advance any knockout brackets whose latest round just completed.
    crate::knockout::process_knockout_progression(game, &today);

    crate::contracts::process_contract_expiries(game);
    crate::finances::process_weekly_finances(game);

    board_objectives::generate_objectives(game);
    board_objectives::update_objective_progress(game);

    player_events::check_player_events(game);
    progress_injury_recovery(game);
    random_events::check_random_events(game);
    scouting::process_scouting(game);
    transfers::process_transfer_market_tick(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);
    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);
    news::prune_old_news(game);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    game.clock.advance_days(1);
    // Mirror the just-played user match (and any same-day results) from the
    // legacy league into the primary competition the frontend reads from.
    game.sync_primary_competition_from_legacy_league();
    crate::season_context::refresh_game_context(game);
}

#[cfg(test)]
mod tests {
    use super::{build_synthetic_stats_state, finish_live_match_day};
    use crate::clock::GameClock;
    use crate::game::Game;
    use chrono::{TimeZone, Utc};
    use domain::league::{Fixture, FixtureCompetition, FixtureStatus, GoalEvent, MatchResult};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::staff::{Staff, StaffAttributes, StaffRole};
    use domain::team::Team;

    fn make_team() -> Team {
        make_team_with_id("team1", "Test FC")
    }

    fn make_team_with_id(id: &str, name: &str) -> Team {
        let mut team = Team::new(
            id.to_string(),
            name.to_string(),
            id.chars().take(3).collect::<String>().to_uppercase(),
            "England".to_string(),
            "London".to_string(),
            "Stadium".to_string(),
            40_000,
        );
        team.finance = 5_000_000;
        team.wage_budget = 2_000_000;
        team
    }

    fn make_player() -> Player {
        make_player_with_id("player1", "team1", Position::Midfielder)
    }

    fn make_player_with_id(id: &str, team_id: &str, position: Position) -> Player {
        let attrs = PlayerAttributes {
            pace: 65,
            stamina: 65,
            strength: 65,
            agility: 65,
            passing: 65,
            shooting: 65,
            tackling: 65,
            dribbling: 65,
            defending: 65,
            positioning: 65,
            vision: 65,
            decisions: 65,
            composure: 65,
            aggression: 50,
            teamwork: 65,
            leadership: 50,
            handling: 20,
            reflexes: 30,
            aerial: 60,
        };
        let mut player = Player::new(
            id.to_string(),
            id.to_string(),
            format!("Test {id}"),
            "1995-01-01".to_string(),
            "GB".to_string(),
            position,
            attrs,
        );
        player.team_id = Some(team_id.to_string());
        player.wage = 52_000;
        player
    }

    fn make_staff() -> Staff {
        let mut staff = Staff::new(
            "staff1".to_string(),
            "Staff".to_string(),
            "Coach".to_string(),
            "1980-01-01".to_string(),
            StaffRole::Coach,
            StaffAttributes {
                coaching: 70,
                judging_ability: 50,
                judging_potential: 50,
                physiotherapy: 30,
            },
        );
        staff.team_id = Some("team1".to_string());
        staff.nationality = "GB".to_string();
        staff.wage = 10_400;
        staff
    }

    #[test]
    fn finish_live_match_day_runs_weekly_finances_on_monday() {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2025, 6, 16, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "mgr1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team1".to_string());

        let mut game = Game::new(
            clock,
            manager,
            vec![make_team()],
            vec![make_player()],
            vec![make_staff()],
            vec![],
        );
        let initial_finance = game.teams[0].finance;

        finish_live_match_day(&mut game);

        assert_eq!(
            game.teams[0].finance,
            initial_finance - ((52_000 + 10_400) / 52)
        );
    }

    #[test]
    fn synthetic_fast_sim_stats_include_cup_player_records() {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2025, 8, 10, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "mgr1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team1".to_string());

        let mut players = Vec::new();
        for team_id in ["team1", "team2"] {
            players.push(make_player_with_id(&format!("{team_id}-gk"), team_id, Position::Goalkeeper));
            for index in 0..5 {
                players.push(make_player_with_id(&format!("{team_id}-def-{index}"), team_id, Position::Defender));
                players.push(make_player_with_id(&format!("{team_id}-mid-{index}"), team_id, Position::Midfielder));
                players.push(make_player_with_id(&format!("{team_id}-fwd-{index}"), team_id, Position::Forward));
            }
        }

        let game = Game::new(
            clock,
            manager,
            vec![make_team_with_id("team1", "Home FC"), make_team_with_id("team2", "Away FC")],
            players,
            vec![],
            vec![],
        );
        let fixture = Fixture {
            id: "cup-fixture-1".to_string(),
            matchday: 1,
            date: "2025-08-10".to_string(),
            home_team_id: "team1".to_string(),
            away_team_id: "team2".to_string(),
            competition_id: Some("cup-1".to_string()),
            season: Some(2025),
            competition: FixtureCompetition::DomesticCup,
            status: FixtureStatus::Completed,
            result: Some(MatchResult {
                home_goals: 2,
                away_goals: 1,
                home_scorers: Vec::<GoalEvent>::new(),
                away_scorers: Vec::<GoalEvent>::new(),
                report: None,
            }),
            stage: None,
            leg: None,
            tie_id: None,
        };

        let stats = build_synthetic_stats_state(&game, &fixture);

        assert_eq!(stats.team_matches.len(), 2);
        assert!(stats.player_matches.len() >= 22);
        assert!(stats
            .player_matches
            .iter()
            .any(|record| record.competition == FixtureCompetition::DomesticCup && record.goals > 0));
        assert!(stats.player_matches.iter().all(|record| record.season == 2025));
    }
}

// ---------------------------------------------------------------------------
// Domain → Engine type conversion
// ---------------------------------------------------------------------------

struct DaySimulationIndexes {
    scheduled_legacy_fixture_indices_by_date: HashMap<String, Vec<usize>>,
    scheduled_competition_fixture_indices_by_date: HashMap<String, Vec<(usize, usize)>>,
}

fn build_day_simulation_indexes(game: &Game) -> DaySimulationIndexes {
    let mut scheduled_legacy_fixture_indices_by_date = HashMap::new();
    if let Some(league) = game.league.as_ref() {
        for (index, fixture) in league.fixtures.iter().enumerate() {
            if fixture.status == FixtureStatus::Scheduled {
                scheduled_legacy_fixture_indices_by_date
                    .entry(fixture.date.clone())
                    .or_insert_with(Vec::new)
                    .push(index);
            }
        }
    }

    let mut scheduled_competition_fixture_indices_by_date = HashMap::new();
    for (competition_index, competition) in game.competitions.iter().enumerate() {
        for (fixture_index, fixture) in competition.fixtures.iter().enumerate() {
            if fixture.status == FixtureStatus::Scheduled {
                scheduled_competition_fixture_indices_by_date
                    .entry(fixture.date.clone())
                    .or_insert_with(Vec::new)
                    .push((competition_index, fixture_index));
            }
        }
    }

    DaySimulationIndexes {
        scheduled_legacy_fixture_indices_by_date,
        scheduled_competition_fixture_indices_by_date,
    }
}

// ---------------------------------------------------------------------------
// Matchday simulation using the engine crate
// ---------------------------------------------------------------------------

fn has_scheduled_fixture_today(game: &Game, today: &str) -> bool {
    let indexes = build_day_simulation_indexes(game);
    has_scheduled_fixture_today_with_indexes(&indexes, today)
}

fn has_scheduled_fixture_today_with_indexes(indexes: &DaySimulationIndexes, today: &str) -> bool {
    indexes
        .scheduled_legacy_fixture_indices_by_date
        .get(today)
        .is_some_and(|fixtures| !fixtures.is_empty())
        || indexes
            .scheduled_competition_fixture_indices_by_date
            .get(today)
            .is_some_and(|fixtures| !fixtures.is_empty())
}

fn simulate_matchday_with_capture<F>(game: &mut Game, today: &str, on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    info!("[turn] simulate_matchday: {}", today);
    simulate_other_matches_with_capture(game, today, None, on_capture);
    generate_matchday_news(game, today);
}

/// Simulate all scheduled matches for `today`, optionally skipping one fixture
/// (the user's live match). Called by both process_day and advance_time_with_mode.
pub fn simulate_other_matches(game: &mut Game, today: &str, skip_fixture: Option<usize>) {
    simulate_other_matches_with_capture(game, today, skip_fixture, &mut |_| {});
}

pub fn simulate_other_matches_with_capture<F>(
    game: &mut Game,
    today: &str,
    skip_fixture: Option<usize>,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    let indexes = build_day_simulation_indexes(game);
    let fixture_indices = indexes
        .scheduled_legacy_fixture_indices_by_date
        .get(today)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|index| skip_fixture != Some(*index))
        .collect::<Vec<_>>();

    let prepared_matches = fixture_indices
        .into_iter()
        .map(|idx| {
            let fixture = &game.league.as_ref().unwrap().fixtures[idx];
            let home_team_id = fixture.home_team_id.clone();
            let away_team_id = fixture.away_team_id.clone();
            let (home_data, _) = build_team_with_bench(game, &home_team_id);
            let (away_data, _) = build_team_with_bench(game, &away_team_id);
            (idx, home_team_id, away_team_id, home_data, away_data)
        })
        .collect::<Vec<_>>();
    for (idx, home_team_id, away_team_id, home_data, away_data) in prepared_matches {
        simulate_single_match_with_capture(
            game,
            idx,
            &home_team_id,
            &away_team_id,
            home_data,
            away_data,
            on_capture,
        );
    }
    simulate_competition_matches_for_date(game, today, &indexes, on_capture);
}

fn simulate_competition_matches_for_date<F>(
    game: &mut Game,
    today: &str,
    indexes: &DaySimulationIndexes,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    let legacy_league_id = game.league.as_ref().map(|league| league.id.as_str());
    let team_strengths: std::collections::HashMap<&str, u16> = game
        .teams
        .iter()
        .map(|team| (team.id.as_str(), team.reputation as u16))
        .collect();

    let competition_fixture_indices = indexes
        .scheduled_competition_fixture_indices_by_date
        .get(today)
        .cloned()
        .unwrap_or_default();

    let mut fixtures_by_competition: HashMap<usize, Vec<usize>> = HashMap::new();
    for (competition_index, fixture_index) in competition_fixture_indices {
        fixtures_by_competition
            .entry(competition_index)
            .or_default()
            .push(fixture_index);
    }

    for (competition_index, fixture_indices) in fixtures_by_competition {
        let Some(competition) = game.competitions.get_mut(competition_index) else {
            continue;
        };
        let is_legacy_league = legacy_league_id == Some(competition.id.as_str());
        if is_legacy_league {
            continue;
        }
        let mut standing_index_by_team: HashMap<String, usize> = competition
            .standings
            .iter()
            .enumerate()
            .map(|(standing_index, standing)| (standing.team_id.clone(), standing_index))
            .collect();
        let completed_fixtures = {
            let mut completed_fixtures = Vec::new();
            for fixture_index in fixture_indices {
                if let Some(fixture) = apply_fast_competition_result(
                    competition,
                    fixture_index,
                    &team_strengths,
                    &mut standing_index_by_team,
                ) {
                    completed_fixtures.push(fixture);
                }
            }
            completed_fixtures
        };

        for fixture in completed_fixtures {
            on_capture(build_synthetic_stats_state(game, &fixture));
        }
    }
}

fn apply_fast_competition_result(
    competition: &mut domain::league::Competition,
    fixture_index: usize,
    team_strengths: &HashMap<&str, u16>,
    standing_index_by_team: &mut HashMap<String, usize>,
) -> Option<Fixture> {
    let fixture = &competition.fixtures[fixture_index];
    let home_strength = team_strengths
        .get(fixture.home_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let away_strength = team_strengths
        .get(fixture.away_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let seed = fixture.id.bytes().fold(0_u32, |acc, byte| {
        acc.wrapping_mul(31).wrapping_add(byte as u32)
    });
    let home_bias = 8_i16 + ((home_strength as i16 - away_strength as i16) / 75);
    let away_bias = (away_strength as i16 - home_strength as i16) / 100;
    let home_goals = ((seed % 3) as i16 + home_bias.max(0) / 8).clamp(0, 5) as u8;
    let away_goals = (((seed / 7) % 3) as i16 + away_bias.max(0) / 8).clamp(0, 5) as u8;

    let fixture = &mut competition.fixtures[fixture_index];
    fixture.status = FixtureStatus::Completed;
    fixture.result = Some(MatchResult {
        home_goals,
        away_goals,
        home_scorers: Vec::<GoalEvent>::new(),
        away_scorers: Vec::<GoalEvent>::new(),
        report: None,
    });

    if fixture.counts_for_competition_standings() {
        let home_team_id = fixture.home_team_id.clone();
        let away_team_id = fixture.away_team_id.clone();
        if let Some(standing_index) = standing_index_by_team.get(home_team_id.as_str()).copied()
            && let Some(standing) = competition.standings.get_mut(standing_index)
        {
            standing.record_result(home_goals, away_goals);
        }
        if let Some(standing_index) = standing_index_by_team.get(away_team_id.as_str()).copied()
            && let Some(standing) = competition.standings.get_mut(standing_index)
        {
            standing.record_result(away_goals, home_goals);
        }
    }

    Some(fixture.clone())
}

fn build_synthetic_stats_state(game: &Game, fixture: &Fixture) -> StatsState {
    let Some(result) = fixture.result.as_ref() else {
        return StatsState::default();
    };

    let (home_data, home_bench) = build_team_with_bench(game, &fixture.home_team_id);
    let (away_data, away_bench) = build_team_with_bench(game, &fixture.away_team_id);
    let home_players = synthetic_participants(&home_data, &home_bench, fixture_seed(&fixture.id));
    let away_players = synthetic_participants(&away_data, &away_bench, fixture_seed(&fixture.id).wrapping_add(17));

    let home_seed = fixture_seed(&fixture.id).wrapping_add(101);
    let away_seed = fixture_seed(&fixture.id).wrapping_add(211);
    let mut player_matches = Vec::new();
    player_matches.extend(synthetic_player_records(
        fixture,
        &home_players,
        &fixture.home_team_id,
        &fixture.away_team_id,
        result.home_goals,
        result.away_goals,
        home_seed,
    ));
    player_matches.extend(synthetic_player_records(
        fixture,
        &away_players,
        &fixture.away_team_id,
        &fixture.home_team_id,
        result.away_goals,
        result.home_goals,
        away_seed,
    ));

    StatsState {
        player_matches,
        team_matches: vec![
            synthetic_team_record(
                fixture,
                &fixture.home_team_id,
                &fixture.away_team_id,
                result.home_goals,
                result.away_goals,
                home_seed,
            ),
            synthetic_team_record(
                fixture,
                &fixture.away_team_id,
                &fixture.home_team_id,
                result.away_goals,
                result.home_goals,
                away_seed,
            ),
        ],
    }
}

#[derive(Clone)]
struct SyntheticPlayer {
    id: String,
    position: engine::Position,
    ovr: u8,
    minutes: u8,
}

fn synthetic_participants(
    team: &engine::TeamData,
    bench: &[engine::PlayerData],
    seed: u32,
) -> Vec<SyntheticPlayer> {
    let mut players = team
        .players
        .iter()
        .map(|player| SyntheticPlayer {
            id: player.id.clone(),
            position: player.position,
            ovr: player.ovr,
            minutes: 90,
        })
        .collect::<Vec<_>>();

    for (index, substitute) in bench.iter().take(3).enumerate() {
        if players.is_empty() {
            break;
        }
        let replaced_index = ((seed as usize) + index * 3) % players.len();
        players[replaced_index].minutes = players[replaced_index].minutes.saturating_sub(25);
        players.push(SyntheticPlayer {
            id: substitute.id.clone(),
            position: substitute.position,
            ovr: substitute.ovr,
            minutes: 25,
        });
    }

    players
}

fn synthetic_player_records(
    fixture: &Fixture,
    players: &[SyntheticPlayer],
    team_id: &str,
    opponent_team_id: &str,
    goals_for: u8,
    goals_against: u8,
    seed: u32,
) -> Vec<PlayerMatchStatsRecord> {
    let scorer_indices = pick_weighted_player_indices(players, goals_for as usize, seed, |player| {
        let position_weight = match player.position {
            engine::Position::Forward => 90,
            engine::Position::Midfielder => 50,
            engine::Position::Defender => 14,
            engine::Position::Goalkeeper => 1,
        };
        position_weight + player.ovr as u32
    });
    let assist_indices = pick_weighted_player_indices(
        players,
        goals_for.saturating_sub(1) as usize,
        seed.wrapping_add(31),
        |player| {
            let position_weight = match player.position {
                engine::Position::Midfielder => 80,
                engine::Position::Forward => 55,
                engine::Position::Defender => 28,
                engine::Position::Goalkeeper => 1,
            };
            position_weight + player.ovr as u32
        },
    );
    let yellow_indices = pick_weighted_player_indices(players, ((seed % 3) as usize).min(players.len()), seed.wrapping_add(59), |player| {
        match player.position {
            engine::Position::Defender => 70,
            engine::Position::Midfielder => 45,
            engine::Position::Forward => 20,
            engine::Position::Goalkeeper => 8,
        }
    });

    players
        .iter()
        .enumerate()
        .map(|(index, player)| {
            let goals = scorer_indices.iter().filter(|scorer_index| **scorer_index == index).count() as u8;
            let assists = assist_indices.iter().filter(|assist_index| **assist_index == index).count() as u8;
            let yellow_cards = u8::from(yellow_indices.contains(&index));
            let is_goalkeeper = matches!(player.position, engine::Position::Goalkeeper);
            let base_rating = 6.45
                + (goals_for as f32 * 0.12)
                - (goals_against as f32 * 0.08)
                + (player.ovr as f32 - 60.0) * 0.01
                + goals as f32 * 0.55
                + assists as f32 * 0.32
                + if is_goalkeeper && goals_against == 0 { 0.35 } else { 0.0 };
            let rating_noise = ((seed.wrapping_add(index as u32 * 13) % 21) as f32 - 10.0) / 100.0;
            let rating = (base_rating + rating_noise).clamp(5.4, 8.9);
            let shot_bias = match player.position {
                engine::Position::Forward => 2,
                engine::Position::Midfielder => 1,
                _ => 0,
            };
            let shots = (goals + shot_bias + ((seed.wrapping_add(index as u32) % 2) as u8)).min(6);
            let shots_on_target = shots.min(goals.saturating_add(1));
            let passes_attempted = match player.position {
                engine::Position::Goalkeeper => 28,
                engine::Position::Defender => 44,
                engine::Position::Midfielder => 52,
                engine::Position::Forward => 30,
            } + (player.minutes / 15);
            let passes_completed = ((passes_attempted as f32) * (0.72 + (player.ovr as f32 / 500.0))).round() as u8;

            PlayerMatchStatsRecord {
                fixture_id: fixture.id.clone(),
                season: fixture.season.unwrap_or(1),
                matchday: fixture.matchday,
                date: fixture.date.clone(),
                competition: fixture.competition.clone(),
                player_id: player.id.clone(),
                team_id: team_id.to_string(),
                opponent_team_id: opponent_team_id.to_string(),
                home_team_id: fixture.home_team_id.clone(),
                away_team_id: fixture.away_team_id.clone(),
                home_goals: fixture.result.as_ref().map_or(0, |result| result.home_goals),
                away_goals: fixture.result.as_ref().map_or(0, |result| result.away_goals),
                minutes_played: player.minutes,
                goals,
                assists,
                shots,
                shots_on_target,
                passes_completed,
                passes_attempted,
                tackles_won: synthetic_defensive_count(player.position, seed, index, 3),
                interceptions: synthetic_defensive_count(player.position, seed.wrapping_add(7), index, 2),
                fouls_committed: synthetic_defensive_count(player.position, seed.wrapping_add(11), index, 2),
                yellow_cards,
                red_cards: u8::from(yellow_cards == 1 && seed.wrapping_add(index as u32) % 47 == 0),
                rating,
            }
        })
        .collect()
}

fn pick_weighted_player_indices(
    players: &[SyntheticPlayer],
    count: usize,
    seed: u32,
    weight: impl Fn(&SyntheticPlayer) -> u32,
) -> Vec<usize> {
    if players.is_empty() || count == 0 {
        return Vec::new();
    }

    let total_weight = players.iter().map(&weight).sum::<u32>().max(1);
    (0..count)
        .map(|offset| {
            let mut target = seed
                .wrapping_mul(37)
                .wrapping_add(offset as u32 * 19)
                % total_weight;
            for (index, player) in players.iter().enumerate() {
                let player_weight = weight(player);
                if target < player_weight {
                    return index;
                }
                target = target.saturating_sub(player_weight);
            }
            players.len() - 1
        })
        .collect()
}

fn synthetic_defensive_count(position: engine::Position, seed: u32, index: usize, max_extra: u8) -> u8 {
    let base = match position {
        engine::Position::Goalkeeper => 0,
        engine::Position::Defender => 2,
        engine::Position::Midfielder => 1,
        engine::Position::Forward => 0,
    };
    base + (seed.wrapping_add(index as u32) % (max_extra as u32 + 1)) as u8
}

fn synthetic_team_record(
    fixture: &Fixture,
    team_id: &str,
    opponent_team_id: &str,
    goals_for: u8,
    goals_against: u8,
    seed: u32,
) -> TeamMatchStatsRecord {
    let shots = 8 + goals_for as u16 * 3 + (seed % 5) as u16;
    let shots_on_target = (goals_for as u16 + 2 + (seed % 3) as u16).min(shots);
    let passes_attempted = 330 + (seed % 90) as u16;
    let passes_completed = ((passes_attempted as f32) * 0.78).round() as u16;

    TeamMatchStatsRecord {
        fixture_id: fixture.id.clone(),
        season: fixture.season.unwrap_or(1),
        matchday: fixture.matchday,
        date: fixture.date.clone(),
        competition: fixture.competition.clone(),
        team_id: team_id.to_string(),
        opponent_team_id: opponent_team_id.to_string(),
        home_team_id: fixture.home_team_id.clone(),
        away_team_id: fixture.away_team_id.clone(),
        goals_for,
        goals_against,
        possession_pct: (48 + (seed % 9) as u8).clamp(35, 65),
        shots,
        shots_on_target,
        passes_completed,
        passes_attempted,
        tackles_won: 12 + (seed % 9) as u16,
        interceptions: 8 + (seed % 7) as u16,
        fouls_committed: 8 + (seed % 8) as u16,
        yellow_cards: (seed % 3) as u8,
        red_cards: u8::from(seed % 61 == 0),
    }
}

fn fixture_seed(fixture_id: &str) -> u32 {
    fixture_id.bytes().fold(0_u32, |acc, byte| {
        acc.wrapping_mul(31).wrapping_add(byte as u32)
    })
}

fn simulate_single_match_with_capture<F>(
    game: &mut Game,
    idx: usize,
    home_team_id: &str,
    away_team_id: &str,
    home_data: engine::TeamData,
    away_data: engine::TeamData,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    let config = engine::MatchConfig::default();
    let report = engine::simulate(&home_data, &away_data, &config);
    apply_match_report_with_capture(game, idx, home_team_id, away_team_id, &report, on_capture);
}
