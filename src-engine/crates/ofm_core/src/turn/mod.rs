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
use domain::league::{
    CompactMatchEvent, CompactMatchReport, CompactTeamMatchStats, Fixture, FixtureStatus, GoalEvent,
    MatchResult,
};
use domain::stats::{PlayerMatchStatsRecord, StatsState, TeamMatchStatsRecord};
use engine::ai::{self, AiProfile};
use engine::{LiveMatchState, MatchConfig, MatchPhase, Side};
use log::{debug, info};
use rand::SeedableRng;
use rand::rngs::StdRng;
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

    crate::contracts::process_ai_contract_renewals(game);
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

    crate::contracts::process_ai_contract_renewals(game);
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
    use super::{
        assist_weight, build_synthetic_stats_state, finish_live_match_day, goal_events_from_attacking_events,
        scorer_weight, star_minutes_priority, synthetic_attacking_events, synthetic_compact_report,
        synthetic_replaced_starter_index, SyntheticPlayer, SyntheticUsage,
    };
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

    fn synthetic_player(
        id: &str,
        position: engine::Position,
        ovr: u8,
        shooting: u8,
        passing: u8,
        vision: u8,
    ) -> SyntheticPlayer {
        SyntheticPlayer {
            id: id.to_string(),
            position,
            natural_position: String::new(),
            ovr,
            minutes: 90,
            shooting,
            passing,
            positioning: shooting,
            vision,
            decisions: passing.max(vision),
            composure: shooting,
            dribbling: passing,
            aerial: shooting.saturating_sub(10),
        }
    }

    #[test]
    fn synthetic_goal_and_assist_weights_favour_elite_attackers_and_creators() {
        let elite_forward = synthetic_player("elite-forward", engine::Position::Forward, 91, 94, 74, 72);
        let average_forward = synthetic_player("average-forward", engine::Position::Forward, 66, 68, 56, 54);
        let elite_creator = synthetic_player("elite-creator", engine::Position::Midfielder, 89, 72, 95, 94);
        let average_midfielder = synthetic_player("average-midfielder", engine::Position::Midfielder, 65, 58, 65, 63);

        assert!(scorer_weight(&elite_forward) * 2 > scorer_weight(&average_forward) * 3);
        assert!(assist_weight(&elite_creator) * 2 > assist_weight(&average_midfielder) * 3);
        assert!(scorer_weight(&elite_forward) > scorer_weight(&elite_creator));
        assert!(assist_weight(&elite_creator) > assist_weight(&elite_forward));
    }

    #[test]
    fn synthetic_rotation_protects_primary_stars_from_substitution() {
        let elite_forward = synthetic_player("elite-forward", engine::Position::Forward, 92, 95, 78, 74);
        let elite_creator = synthetic_player("elite-creator", engine::Position::Midfielder, 90, 74, 96, 95);
        let average_forward = synthetic_player("average-forward", engine::Position::Forward, 67, 68, 58, 55);
        let average_midfielder = synthetic_player("average-midfielder", engine::Position::Midfielder, 64, 55, 62, 60);
        let average_defender = synthetic_player("average-defender", engine::Position::Defender, 66, 45, 60, 52);
        let players = vec![
            elite_forward.clone(),
            elite_creator.clone(),
            average_forward,
            average_midfielder,
            average_defender,
        ];
        let usage = SyntheticUsage::new(&players);

        assert!(star_minutes_priority(&elite_forward, &usage) > star_minutes_priority(&players[2], &usage));
        assert!(star_minutes_priority(&elite_creator, &usage) > star_minutes_priority(&players[3], &usage));

        for substitution_index in 0..3 {
            let replaced_index = synthetic_replaced_starter_index(&players, &usage, 17, substitution_index);
            assert_ne!(players[replaced_index].id, "elite-forward");
            assert_ne!(players[replaced_index].id, "elite-creator");
        }
    }

    #[test]
    fn synthetic_usage_concentrates_goals_and_assists_around_primary_players() {
        let elite_forward = synthetic_player("elite-forward", engine::Position::Forward, 91, 94, 74, 72);
        let average_forward = synthetic_player("average-forward", engine::Position::Forward, 66, 68, 56, 54);
        let elite_creator = synthetic_player("elite-creator", engine::Position::Midfielder, 89, 72, 95, 94);
        let average_midfielder = synthetic_player("average-midfielder", engine::Position::Midfielder, 65, 58, 65, 63);
        let high_ovr_defender = synthetic_player("high-ovr-defender", engine::Position::Defender, 92, 55, 70, 62);
        let players = vec![
            elite_forward.clone(),
            average_forward.clone(),
            elite_creator.clone(),
            average_midfielder.clone(),
            high_ovr_defender.clone(),
        ];
        let usage = SyntheticUsage::new(&players);

        assert!(usage.scorer_weight(&elite_forward) > usage.scorer_weight(&average_forward) * 2);
        assert!(usage.assist_weight(&elite_creator) > usage.assist_weight(&average_midfielder) * 2);
        assert!(usage.scorer_weight(&elite_forward) > usage.scorer_weight(&high_ovr_defender) * 3);
        assert!(usage.assist_weight(&elite_creator) > usage.assist_weight(&high_ovr_defender));
    }

    #[test]
    fn synthetic_competition_report_includes_goal_timeline_and_assists() {
        let scorer = synthetic_player("scorer", engine::Position::Forward, 91, 94, 74, 72);
        let creator = synthetic_player("creator", engine::Position::Midfielder, 89, 72, 95, 94);
        let support = synthetic_player("support", engine::Position::Forward, 74, 76, 70, 68);
        let players = vec![scorer, creator, support];

        let attacking_events = synthetic_attacking_events(&players, 2, 101);
        let goal_events = goal_events_from_attacking_events(&attacking_events);
        let report = synthetic_compact_report(2, 0, &attacking_events, &[], 101);

        assert_eq!(goal_events.len(), 2);
        assert_eq!(report.events.len(), 2);
        assert!(report.events.iter().all(|event| event.event_type == "Goal"));
        assert!(report.events.iter().all(|event| event.side == "Home"));
        assert!(report.events.iter().any(|event| event.secondary_player_id.is_some()));
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
                winner_team_id: None,
                resolution: None,
                home_penalties: None,
                away_penalties: None,
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
            let (home_data, home_bench) = build_team_with_bench(game, &home_team_id);
            let (away_data, away_bench) = build_team_with_bench(game, &away_team_id);
            (
                idx,
                home_team_id,
                away_team_id,
                home_data,
                away_data,
                home_bench,
                away_bench,
            )
        })
        .collect::<Vec<_>>();
    for (idx, home_team_id, away_team_id, home_data, away_data, home_bench, away_bench) in prepared_matches {
        simulate_single_match_with_capture(
            game,
            idx,
            &home_team_id,
            &away_team_id,
            home_data,
            away_data,
            home_bench,
            away_bench,
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
        let Some(competition_ref) = game.competitions.get(competition_index) else {
            continue;
        };
        let is_legacy_league = legacy_league_id == Some(competition_ref.id.as_str());
        if is_legacy_league {
            continue;
        }
        let synthetic_players_by_team = synthetic_players_for_fixtures(game, competition_ref, &fixture_indices);
        let Some(competition) = game.competitions.get_mut(competition_index) else {
            continue;
        };
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
                    &synthetic_players_by_team,
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
    synthetic_players_by_team: &HashMap<String, Vec<SyntheticPlayer>>,
    standing_index_by_team: &mut HashMap<String, usize>,
) -> Option<Fixture> {
    let completed_fixture = apply_fast_fixture_result(
        competition.fixtures.get_mut(fixture_index)?,
        team_strengths,
        synthetic_players_by_team,
        |fixture| fixture.stage.is_some() || !fixture.counts_for_competition_standings(),
    )?;

    if completed_fixture.counts_for_competition_standings() {
        record_fast_standings_result(
            &mut competition.standings,
            standing_index_by_team,
            &completed_fixture,
        );
    }

    Some(completed_fixture)
}

fn apply_fast_fixture_result(
    fixture: &mut Fixture,
    team_strengths: &HashMap<&str, u16>,
    synthetic_players_by_team: &HashMap<String, Vec<SyntheticPlayer>>,
    keep_report: impl Fn(&Fixture) -> bool,
) -> Option<Fixture> {
    let home_strength = team_strengths
        .get(fixture.home_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let away_strength = team_strengths
        .get(fixture.away_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let seed = fixture_seed(&fixture.id);
    let home_bias = 8_i16 + ((home_strength as i16 - away_strength as i16) / 75);
    let away_bias = (away_strength as i16 - home_strength as i16) / 100;
    let home_goals = ((seed % 3) as i16 + home_bias.max(0) / 8).clamp(0, 5) as u8;
    let away_goals = (((seed / 7) % 3) as i16 + away_bias.max(0) / 8).clamp(0, 5) as u8;

    fixture.status = FixtureStatus::Completed;
    let knockout_resolution = if fixture.stage.is_some() || !fixture.counts_for_competition_standings() {
        let resolution_fixture = Fixture {
            result: Some(MatchResult {
                home_goals,
                away_goals,
                home_scorers: Vec::<GoalEvent>::new(),
                away_scorers: Vec::<GoalEvent>::new(),
                report: None,
                winner_team_id: None,
                resolution: None,
                home_penalties: None,
                away_penalties: None,
            }),
            ..fixture.clone()
        };
        crate::knockout::single_leg_resolution(&resolution_fixture)
    } else {
        None
    };
    let home_players = synthetic_players_by_team
        .get(&fixture.home_team_id)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let away_players = synthetic_players_by_team
        .get(&fixture.away_team_id)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let home_attacking_events = synthetic_attacking_events(home_players, home_goals, seed.wrapping_add(101));
    let away_attacking_events = synthetic_attacking_events(away_players, away_goals, seed.wrapping_add(211));
    let mut home_scorers = goal_events_from_attacking_events(&home_attacking_events);
    let mut away_scorers = goal_events_from_attacking_events(&away_attacking_events);
    if home_goals > 0 && home_scorers.is_empty() {
        home_scorers = fallback_goal_events(home_players, home_goals, seed.wrapping_add(101));
    }
    if away_goals > 0 && away_scorers.is_empty() {
        away_scorers = fallback_goal_events(away_players, away_goals, seed.wrapping_add(211));
    }
    let report = keep_report(fixture).then(|| {
        synthetic_compact_report(
            home_goals,
            away_goals,
            &home_attacking_events,
            &away_attacking_events,
            seed,
        )
    });
    fixture.result = Some(MatchResult {
        home_goals,
        away_goals,
        home_scorers,
        away_scorers,
        report,
        winner_team_id: knockout_resolution.as_ref().map(|resolution| resolution.winner_team_id.clone()),
        resolution: knockout_resolution.as_ref().map(|resolution| resolution.resolution.clone()),
        home_penalties: knockout_resolution.as_ref().and_then(|resolution| resolution.home_penalties),
        away_penalties: knockout_resolution.as_ref().and_then(|resolution| resolution.away_penalties),
    });

    Some(fixture.clone())
}

fn record_fast_standings_result(
    standings: &mut [domain::league::StandingEntry],
    standing_index_by_team: &HashMap<String, usize>,
    fixture: &Fixture,
) {
    let Some(result) = fixture.result.as_ref() else {
        return;
    };
    if let Some(standing_index) = standing_index_by_team.get(fixture.home_team_id.as_str()).copied()
        && let Some(standing) = standings.get_mut(standing_index)
    {
        standing.record_result(result.home_goals, result.away_goals);
    }
    if let Some(standing_index) = standing_index_by_team.get(fixture.away_team_id.as_str()).copied()
        && let Some(standing) = standings.get_mut(standing_index)
    {
        standing.record_result(result.away_goals, result.home_goals);
    }
}

fn synthetic_players_for_fixtures(
    game: &Game,
    competition: &domain::league::Competition,
    fixture_indices: &[usize],
) -> HashMap<String, Vec<SyntheticPlayer>> {
    synthetic_players_for_fixture_refs(
        game,
        fixture_indices
            .iter()
            .filter_map(|fixture_index| competition.fixtures.get(*fixture_index)),
    )
}

fn synthetic_players_for_fixture_refs<'a>(
    game: &Game,
    fixtures: impl Iterator<Item = &'a Fixture>,
) -> HashMap<String, Vec<SyntheticPlayer>> {
    let mut players_by_team = HashMap::new();
    for fixture in fixtures {
        for team_id in [&fixture.home_team_id, &fixture.away_team_id] {
            players_by_team.entry(team_id.clone()).or_insert_with(|| {
                let (team_data, bench) = build_team_with_bench(game, team_id);
                synthetic_participants(&team_data, &bench, fixture_seed(team_id))
            });
        }
    }
    players_by_team
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

struct SyntheticAttackingEvent {
    scorer_id: String,
    assist_id: Option<String>,
    minute: u8,
}

fn synthetic_attacking_events(
    players: &[SyntheticPlayer],
    goals_for: u8,
    seed: u32,
) -> Vec<SyntheticAttackingEvent> {
    let usage = SyntheticUsage::new(players);
    let mut scorer_indices = pick_weighted_player_indices(players, goals_for as usize, seed, |player| {
        usage.scorer_weight(player)
    });
    usage.apply_finisher_preference(players, &mut scorer_indices, seed);

    let mut assist_indices = pick_weighted_player_indices(
        players,
        goals_for.saturating_sub(1) as usize,
        seed.wrapping_add(31),
        |player| usage.assist_weight(player),
    );
    usage.apply_creator_preference(players, &mut assist_indices, seed.wrapping_add(31));

    scorer_indices
        .iter()
        .enumerate()
        .filter_map(|(goal_index, scorer_index)| {
            let scorer = players.get(*scorer_index)?;
            let assist_id = assist_indices
                .get(goal_index)
                .and_then(|assist_index| players.get(*assist_index))
                .filter(|assist| assist.id != scorer.id)
                .map(|assist| assist.id.clone());
            Some(SyntheticAttackingEvent {
                scorer_id: scorer.id.clone(),
                assist_id,
                minute: synthetic_goal_minute(seed, goal_index),
            })
        })
        .collect()
}

fn goal_events_from_attacking_events(events: &[SyntheticAttackingEvent]) -> Vec<GoalEvent> {
    events
        .iter()
        .map(|event| GoalEvent {
            player_id: event.scorer_id.clone(),
            minute: event.minute,
        })
        .collect()
}

fn fallback_goal_events(players: &[SyntheticPlayer], goals_for: u8, seed: u32) -> Vec<GoalEvent> {
    if players.is_empty() || goals_for == 0 {
        return Vec::new();
    }

    let usage = SyntheticUsage::new(players);
    let mut scorer_indices = pick_weighted_player_indices(players, goals_for as usize, seed, |player| {
        usage.scorer_weight(player)
    });
    usage.apply_finisher_preference(players, &mut scorer_indices, seed);

    scorer_indices
        .into_iter()
        .enumerate()
        .filter_map(|(goal_index, scorer_index)| {
            players.get(scorer_index).map(|scorer| GoalEvent {
                player_id: scorer.id.clone(),
                minute: synthetic_goal_minute(seed, goal_index),
            })
        })
        .collect()
}

fn synthetic_compact_report(
    home_goals: u8,
    away_goals: u8,
    home_events: &[SyntheticAttackingEvent],
    away_events: &[SyntheticAttackingEvent],
    seed: u32,
) -> CompactMatchReport {
    let mut events = Vec::new();
    events.extend(synthetic_compact_goal_events(home_events, "Home"));
    events.extend(synthetic_compact_goal_events(away_events, "Away"));
    events.sort_by_key(|event| event.minute);

    CompactMatchReport {
        total_minutes: 90,
        home_stats: synthetic_compact_team_stats(home_goals, seed.wrapping_add(101)),
        away_stats: synthetic_compact_team_stats(away_goals, seed.wrapping_add(211)),
        events,
    }
}

fn synthetic_compact_goal_events(
    events: &[SyntheticAttackingEvent],
    side: &str,
) -> Vec<CompactMatchEvent> {
    events
        .iter()
        .map(|event| CompactMatchEvent {
            minute: event.minute,
            event_type: "Goal".to_string(),
            side: side.to_string(),
            player_id: Some(event.scorer_id.clone()),
            secondary_player_id: event.assist_id.clone(),
        })
        .collect()
}

fn synthetic_compact_team_stats(goals_for: u8, seed: u32) -> CompactTeamMatchStats {
    let shots = 8 + goals_for as u16 * 3 + (seed % 5) as u16;
    let passes_attempted = 330 + (seed % 90) as u16;
    let passes_completed = ((passes_attempted as f32) * 0.78).round() as u16;
    CompactTeamMatchStats {
        possession_pct: (48 + (seed % 9) as u8).clamp(35, 65),
        shots,
        shots_on_target: (goals_for as u16 + 2 + (seed % 3) as u16).min(shots),
        passes_completed,
        passes_intercepted: passes_attempted.saturating_sub(passes_completed),
        tackles: 12 + (seed % 9) as u16,
        interceptions: 8 + (seed % 7) as u16,
        fouls: 8 + (seed % 8) as u16,
        corners: 3 + (seed % 5) as u16,
        yellow_cards: (seed % 3) as u8,
        red_cards: u8::from(seed % 61 == 0),
    }
}

fn synthetic_goal_minute(seed: u32, goal_index: usize) -> u8 {
    let base = 8 + ((seed.wrapping_add(goal_index as u32 * 23)) % 78) as u8;
    base.clamp(1, 90)
}

#[derive(Clone)]
struct SyntheticPlayer {
    id: String,
    position: engine::Position,
    natural_position: String,
    ovr: u8,
    minutes: u8,
    shooting: u8,
    passing: u8,
    positioning: u8,
    vision: u8,
    decisions: u8,
    composure: u8,
    dribbling: u8,
    aerial: u8,
}

fn classify_synthetic_role(player: &SyntheticPlayer) -> &'static str {
    match player.natural_position.as_str() {
        "Goalkeeper" => "GK",
        "CenterBack" => "CB",
        "LeftBack" | "RightBack" => "FB",
        "LeftWingBack" | "RightWingBack" => "WB",
        "DefensiveMidfielder" => "DM",
        "CentralMidfielder" => "CM",
        "AttackingMidfielder" => "AM",
        "LeftMidfielder" | "RightMidfielder" => "WM",
        "LeftWinger" | "RightWinger" => "WG",
        "Striker" => "ST",
        _ => match player.position {
            engine::Position::Goalkeeper => "GK",
            engine::Position::Defender => "CB",
            engine::Position::Midfielder => "CM",
            engine::Position::Forward => "ST",
        },
    }
}

fn synthetic_scorer_role_weight(role: &str) -> u32 {
    match role {
        "ST" => 160,
        "WG" => 110,
        "AM" => 115,
        "CM" => 70,
        "WM" => 72,
        "DM" => 28,
        "WB" => 30,
        "FB" => 15,
        "CB" => 16,
        _ => 1,
    }
}

fn synthetic_assist_role_weight(role: &str) -> u32 {
    match role {
        "ST" => 70,
        "WG" => 140,
        "AM" => 150,
        "CM" => 115,
        "WM" => 100,
        "DM" => 40,
        "WB" => 60,
        "FB" => 25,
        "CB" => 18,
        _ => 1,
    }
}

fn synthetic_finisher_role_weight(role: &str) -> u32 {
    match role {
        "ST" => 195,
        "WG" => 160,
        "AM" => 150,
        "CM" => 100,
        "WM" => 105,
        "DM" => 35,
        "WB" => 40,
        "FB" => 25,
        "CB" => 40,
        _ => 0,
    }
}

fn synthetic_creator_role_weight(role: &str) -> u32 {
    match role {
        "ST" => 90,
        "WG" => 160,
        "AM" => 245,
        "CM" => 200,
        "WM" => 160,
        "DM" => 70,
        "WB" => 110,
        "FB" => 50,
        "CB" => 35,
        _ => 0,
    }
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
            natural_position: player.natural_position.clone(),
            ovr: player.ovr,
            minutes: 90,
            shooting: player.shooting,
            passing: player.passing,
            positioning: player.positioning,
            vision: player.vision,
            decisions: player.decisions,
            composure: player.composure,
            dribbling: player.dribbling,
            aerial: player.aerial,
        })
        .collect::<Vec<_>>();

    let starter_count = players.len();
    for (index, substitute) in bench.iter().take(3).enumerate() {
        if starter_count == 0 {
            break;
        }
        let starters = &players[..starter_count];
        let usage = SyntheticUsage::new(starters);
        let replaced_index = synthetic_replaced_starter_index(starters, &usage, seed, index);
        let minute_loss = synthetic_substitution_minute_loss(seed, index);
        players[replaced_index].minutes = players[replaced_index].minutes.saturating_sub(minute_loss);
        players.push(SyntheticPlayer {
            id: substitute.id.clone(),
            position: substitute.position,
            natural_position: substitute.natural_position.clone(),
            ovr: substitute.ovr,
            minutes: minute_loss,
            shooting: substitute.shooting,
            passing: substitute.passing,
            positioning: substitute.positioning,
            vision: substitute.vision,
            decisions: substitute.decisions,
            composure: substitute.composure,
            dribbling: substitute.dribbling,
            aerial: substitute.aerial,
        });
    }

    players
}

fn synthetic_substitution_minute_loss(seed: u32, index: usize) -> u8 {
    15 + (seed.wrapping_add(index as u32 * 11) % 16) as u8
}

fn synthetic_replaced_starter_index(
    players: &[SyntheticPlayer],
    usage: &SyntheticUsage,
    seed: u32,
    substitution_index: usize,
) -> usize {
    let offset = seed.wrapping_add(substitution_index as u32 * 7) as usize;
    players
        .iter()
        .enumerate()
        .filter(|(_, player)| !matches!(player.position, engine::Position::Goalkeeper))
        .max_by_key(|(index, player)| {
            let rotation_score = 1_200_u32.saturating_sub(star_minutes_priority(player, usage));
            (rotation_score, (index + offset) % players.len())
        })
        .map(|(index, _)| index)
        .unwrap_or(offset % players.len())
}

fn star_minutes_priority(player: &SyntheticPlayer, usage: &SyntheticUsage) -> u32 {
    let role_bonus = if usage.primary_finisher.as_deref() == Some(player.id.as_str()) {
        360
    } else if usage.primary_creator.as_deref() == Some(player.id.as_str()) {
        300
    } else if usage.secondary_finisher.as_deref() == Some(player.id.as_str()) {
        180
    } else if usage.secondary_creator.as_deref() == Some(player.id.as_str()) {
        140
    } else {
        0
    };

    player.ovr as u32 * 5 + role_bonus + star_rating_bonus(player.ovr) * 3
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
    let (scorer_counts, assist_counts) = synthetic_report_goal_contributions(fixture, players, team_id)
        .unwrap_or_else(|| {
            let usage = SyntheticUsage::new(players);
            let mut scorer_indices = pick_weighted_player_indices(players, goals_for as usize, seed, |player| {
                usage.scorer_weight(player)
            });
            usage.apply_finisher_preference(players, &mut scorer_indices, seed);

            let mut assist_indices = pick_weighted_player_indices(
                players,
                goals_for.saturating_sub(1) as usize,
                seed.wrapping_add(31),
                |player| usage.assist_weight(player),
            );
            usage.apply_creator_preference(players, &mut assist_indices, seed.wrapping_add(31));
            (
                synthetic_count_indices(players.len(), &scorer_indices),
                synthetic_count_indices(players.len(), &assist_indices),
            )
        });
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
            let goals = scorer_counts.get(index).copied().unwrap_or(0);
            let assists = assist_counts.get(index).copied().unwrap_or(0);
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

fn synthetic_report_goal_contributions(
    fixture: &Fixture,
    players: &[SyntheticPlayer],
    team_id: &str,
) -> Option<(Vec<u8>, Vec<u8>)> {
    let result = fixture.result.as_ref()?;
    let report = result.report.as_ref()?;
    if report.events.is_empty() {
        return None;
    }

    let side = if team_id == fixture.home_team_id {
        "Home"
    } else if team_id == fixture.away_team_id {
        "Away"
    } else {
        return None;
    };
    let mut scorer_counts = vec![0; players.len()];
    let mut assist_counts = vec![0; players.len()];
    for event in report
        .events
        .iter()
        .filter(|event| event.side == side && event.event_type == "Goal")
    {
        if let Some(player_id) = event.player_id.as_deref()
            && let Some(index) = players.iter().position(|player| player.id == player_id)
        {
            scorer_counts[index] += 1;
        }
        if let Some(player_id) = event.secondary_player_id.as_deref()
            && let Some(index) = players.iter().position(|player| player.id == player_id)
        {
            assist_counts[index] += 1;
        }
    }
    Some((scorer_counts, assist_counts))
}

fn synthetic_count_indices(player_count: usize, indices: &[usize]) -> Vec<u8> {
    let mut counts = vec![0; player_count];
    for index in indices {
        if let Some(count) = counts.get_mut(*index) {
            *count += 1;
        }
    }
    counts
}

#[derive(Default)]
struct SyntheticUsage {
    primary_finisher: Option<String>,
    secondary_finisher: Option<String>,
    primary_creator: Option<String>,
    secondary_creator: Option<String>,
}

impl SyntheticUsage {
    fn new(players: &[SyntheticPlayer]) -> Self {
        let mut finishers = players
            .iter()
            .filter(|player| !matches!(player.position, engine::Position::Goalkeeper))
            .map(|player| (player.id.clone(), finisher_score(player)))
            .collect::<Vec<_>>();
        finishers.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

        let mut creators = players
            .iter()
            .filter(|player| !matches!(player.position, engine::Position::Goalkeeper))
            .map(|player| (player.id.clone(), creator_score(player)))
            .collect::<Vec<_>>();
        creators.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

        Self {
            primary_finisher: finishers.first().map(|(id, _)| id.clone()),
            secondary_finisher: finishers.get(1).map(|(id, _)| id.clone()),
            primary_creator: creators.first().map(|(id, _)| id.clone()),
            secondary_creator: creators.get(1).map(|(id, _)| id.clone()),
        }
    }

    fn scorer_weight(&self, player: &SyntheticPlayer) -> u32 {
        let base = scorer_weight(player);
        let usage_bonus = if self.primary_finisher.as_deref() == Some(player.id.as_str()) {
            base + 220
        } else if self.secondary_finisher.as_deref() == Some(player.id.as_str()) {
            base / 2 + 110
        } else {
            0
        };

        role_capped_scorer_weight(player, base + usage_bonus)
    }

    fn assist_weight(&self, player: &SyntheticPlayer) -> u32 {
        let base = assist_weight(player);
        let usage_bonus = if self.primary_creator.as_deref() == Some(player.id.as_str()) {
            base / 3 + 70
        } else if self.secondary_creator.as_deref() == Some(player.id.as_str()) {
            base / 5 + 35
        } else {
            0
        };

        role_capped_assist_weight(player, base + usage_bonus)
    }

    fn apply_finisher_preference(&self, players: &[SyntheticPlayer], indices: &mut [usize], seed: u32) {
        if indices.is_empty() {
            return;
        }

        if seed % 100 < 48
            && let Some(index) = self.player_index(players, self.primary_finisher.as_deref())
        {
            indices[0] = index;
        }
        if indices.len() > 1
            && seed.wrapping_add(17) % 100 < 16
            && let Some(index) = self.player_index(players, self.secondary_finisher.as_deref())
        {
            indices[1] = index;
        }
    }

    fn apply_creator_preference(&self, players: &[SyntheticPlayer], indices: &mut [usize], seed: u32) {
        if indices.is_empty() {
            return;
        }

        if seed % 100 < 42
            && let Some(index) = self.player_index(players, self.primary_creator.as_deref())
        {
            indices[0] = index;
        }
        if indices.len() > 1
            && seed.wrapping_add(23) % 100 < 12
            && let Some(index) = self.player_index(players, self.secondary_creator.as_deref())
        {
            indices[1] = index;
        }
    }

    fn player_index(&self, players: &[SyntheticPlayer], player_id: Option<&str>) -> Option<usize> {
        let player_id = player_id?;
        players.iter().position(|player| player.id == player_id)
    }
}

fn star_rating_bonus(ovr: u8) -> u32 {
    let above_baseline = ovr.saturating_sub(60) as u32;
    above_baseline + (above_baseline * above_baseline) / 18
}

fn elite_usage_bonus(ovr: u8) -> u32 {
    let excellent = ovr.saturating_sub(84) as u32;
    let world_class = ovr.saturating_sub(90) as u32;
    excellent * 12 + world_class * 24
}

fn finisher_score(player: &SyntheticPlayer) -> u32 {
    let role = classify_synthetic_role(player);
    let position_weight = synthetic_finisher_role_weight(role);

    position_weight
        + player.shooting as u32 * 4
        + player.positioning as u32 * 3
        + player.composure as u32 * 3
        + player.aerial as u32
        + player.ovr as u32 * 2
        + elite_usage_bonus(player.ovr)
}

fn creator_score(player: &SyntheticPlayer) -> u32 {
    let role = classify_synthetic_role(player);
    let position_weight = synthetic_creator_role_weight(role);

    position_weight
        + player.passing as u32 * 4
        + player.vision as u32 * 4
        + player.decisions as u32 * 3
        + player.dribbling as u32 * 2
        + player.ovr as u32 * 2
        + elite_usage_bonus(player.ovr)
}

fn scorer_weight(player: &SyntheticPlayer) -> u32 {
    let role = classify_synthetic_role(player);
    let position_weight = synthetic_scorer_role_weight(role);
    let skill_weight = player.shooting as u32 * 3
        + player.positioning as u32 * 2
        + player.composure as u32 * 2
        + player.aerial as u32
        + player.ovr as u32 * 2;

    position_weight + skill_weight / 2 + star_rating_bonus(player.ovr) * 8
}

fn assist_weight(player: &SyntheticPlayer) -> u32 {
    let role = classify_synthetic_role(player);
    let position_weight = synthetic_assist_role_weight(role);
    let skill_weight = player.passing as u32 * 3
        + player.vision as u32 * 3
        + player.decisions as u32 * 2
        + player.dribbling as u32
        + player.ovr as u32 * 2;

    position_weight + skill_weight / 2 + star_rating_bonus(player.ovr) * 7
}

fn role_capped_scorer_weight(player: &SyntheticPlayer, weight: u32) -> u32 {
    match classify_synthetic_role(player) {
        "GK" => weight.min(8),
        "CB" | "FB" | "WB" => weight.min(170),
        "DM" | "CM" | "WM" => weight.min(540),
        _ => weight,
    }
}

fn role_capped_assist_weight(player: &SyntheticPlayer, weight: u32) -> u32 {
    match classify_synthetic_role(player) {
        "GK" => weight.min(8),
        "CB" | "FB" => weight.min(420),
        _ => weight,
    }
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
    home_bench: Vec<engine::PlayerData>,
    away_bench: Vec<engine::PlayerData>,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    let report = simulate_ai_managed_match(game, home_team_id, away_team_id, home_data, away_data, home_bench, away_bench);
    apply_match_report_with_capture(game, idx, home_team_id, away_team_id, &report, on_capture);
}

fn simulate_ai_managed_match(
    game: &Game,
    home_team_id: &str,
    away_team_id: &str,
    home_data: engine::TeamData,
    away_data: engine::TeamData,
    home_bench: Vec<engine::PlayerData>,
    away_bench: Vec<engine::PlayerData>,
) -> engine::MatchReport {
    let mut rng = StdRng::from_rng(&mut rand::rng());
    let mut match_state = LiveMatchState::new(
        home_data,
        away_data,
        MatchConfig::default(),
        home_bench,
        away_bench,
        false,
    );
    let home_ai = ai_profile_for_team(game, home_team_id);
    let away_ai = ai_profile_for_team(game, away_team_id);

    loop {
        let result = match_state.step_minute(&mut rng);
        if result.is_finished {
            break;
        }

        if matches!(
            result.phase,
            MatchPhase::FirstHalf
                | MatchPhase::SecondHalf
                | MatchPhase::ExtraTimeFirstHalf
                | MatchPhase::ExtraTimeSecondHalf
        ) {
            for command in ai::ai_decide(&match_state, Side::Home, &home_ai, &mut rng) {
                let _ = match_state.apply_command(command);
            }
            for command in ai::ai_decide(&match_state, Side::Away, &away_ai, &mut rng) {
                let _ = match_state.apply_command(command);
            }
        }
    }

    match_state.into_report()
}

fn ai_profile_for_team(game: &Game, team_id: &str) -> AiProfile {
    let reputation = game
        .teams
        .iter()
        .find(|team| team.id == team_id)
        .map(|team| team.reputation)
        .unwrap_or(500);

    AiProfile {
        reputation,
        experience: (reputation / 10).min(100) as u8,
    }
}
