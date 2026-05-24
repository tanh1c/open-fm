mod news;
mod post_match;
mod round_summary;

use crate::board_objectives;
use crate::game::Game;
use crate::player_events;
use crate::random_events;
use crate::scouting;
use crate::training;
use crate::transfers;
use chrono::Datelike;
use domain::league::{FixtureStatus, GoalEvent, MatchResult};
use domain::player::{Player, Position as DomainPosition};
use domain::stats::StatsState;
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
    transfers::generate_incoming_transfer_offers(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);

    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);
    news::prune_old_news(game);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    debug!("[turn] process_day {}: complete, advancing clock", today);
    game.clock.advance_days(1);
    crate::season_context::refresh_game_context(game);
}

/// Called after a live match finishes to complete the day:
/// generates matchday news, pre-match messages, and advances the clock by one day.
pub fn finish_live_match_day(game: &mut Game) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    info!("[turn] finish_live_match_day: {}", today);
    generate_matchday_news(game, &today);

    crate::contracts::process_contract_expiries(game);
    crate::finances::process_weekly_finances(game);

    board_objectives::generate_objectives(game);
    board_objectives::update_objective_progress(game);

    player_events::check_player_events(game);
    progress_injury_recovery(game);
    random_events::check_random_events(game);
    scouting::process_scouting(game);
    transfers::generate_incoming_transfer_offers(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);
    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);
    news::prune_old_news(game);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    game.clock.advance_days(1);
    crate::season_context::refresh_game_context(game);
}

#[cfg(test)]
mod tests {
    use super::finish_live_match_day;
    use crate::clock::GameClock;
    use crate::game::Game;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::staff::{Staff, StaffAttributes, StaffRole};
    use domain::team::Team;

    fn make_team() -> Team {
        let mut team = Team::new(
            "team1".to_string(),
            "Test FC".to_string(),
            "TST".to_string(),
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
            "player1".to_string(),
            "Player".to_string(),
            "Test Player".to_string(),
            "1995-01-01".to_string(),
            "GB".to_string(),
            Position::Midfielder,
            attrs,
        );
        player.team_id = Some("team1".to_string());
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

fn build_players_by_team(game: &Game) -> HashMap<&str, Vec<&Player>> {
    let mut players_by_team = HashMap::new();
    for player in &game.players {
        if let Some(team_id) = player.team_id.as_deref() {
            players_by_team
                .entry(team_id)
                .or_insert_with(Vec::new)
                .push(player);
        }
    }
    players_by_team
}

fn build_engine_team_with_index(
    game: &Game,
    team_id: &str,
    players_by_team: &HashMap<&str, Vec<&Player>>,
) -> engine::TeamData {
    let team = game.teams.iter().find(|t| t.id == team_id);
    let (name, formation, play_style) = match team {
        Some(t) => (
            t.name.clone(),
            t.formation.clone(),
            match t.play_style {
                domain::team::PlayStyle::Attacking => engine::PlayStyle::Attacking,
                domain::team::PlayStyle::Defensive => engine::PlayStyle::Defensive,
                domain::team::PlayStyle::Possession => engine::PlayStyle::Possession,
                domain::team::PlayStyle::Counter => engine::PlayStyle::Counter,
                domain::team::PlayStyle::HighPress => engine::PlayStyle::HighPress,
                _ => engine::PlayStyle::Balanced,
            },
        ),
        None => (
            "Unknown".into(),
            "4-4-2".into(),
            engine::PlayStyle::Balanced,
        ),
    };

    let players: Vec<engine::PlayerData> = players_by_team
        .get(team_id)
        .map_or(&[][..], |players| players.as_slice())
        .iter()
        .map(|p| {
            let pos = match p.position.to_group_position() {
                DomainPosition::Goalkeeper => engine::Position::Goalkeeper,
                DomainPosition::Defender => engine::Position::Defender,
                DomainPosition::Midfielder => engine::Position::Midfielder,
                DomainPosition::Forward => engine::Position::Forward,
                _ => engine::Position::Midfielder,
            };
            engine::PlayerData {
                id: p.id.clone(),
                name: p.match_name.clone(),
                position: pos,
                ovr: p.ovr,
                condition: p.condition,
                fitness: p.fitness,
                pace: p.attributes.pace,
                stamina: p.attributes.stamina,
                strength: p.attributes.strength,
                agility: p.attributes.agility,
                passing: p.attributes.passing,
                shooting: p.attributes.shooting,
                tackling: p.attributes.tackling,
                dribbling: p.attributes.dribbling,
                defending: p.attributes.defending,
                positioning: p.attributes.positioning,
                vision: p.attributes.vision,
                decisions: p.attributes.decisions,
                composure: p.attributes.composure,
                aggression: p.attributes.aggression,
                teamwork: p.attributes.teamwork,
                leadership: p.attributes.leadership,
                handling: p.attributes.handling,
                reflexes: p.attributes.reflexes,
                aerial: p.attributes.aerial,
                traits: p.traits.iter().map(|t| format!("{:?}", t)).collect(),
            }
        })
        .collect();

    engine::TeamData {
        id: team_id.to_string(),
        name,
        formation,
        play_style,
        players,
        shape_profile: engine::ShapeProfile::default(),
        tactical_profile: engine::TacticalProfile::default(),
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
    let players_by_team = build_players_by_team(game);
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
            let home_data = build_engine_team_with_index(game, &home_team_id, &players_by_team);
            let away_data = build_engine_team_with_index(game, &away_team_id, &players_by_team);
            (idx, home_team_id, away_team_id, home_data, away_data)
        })
        .collect::<Vec<_>>();
    drop(players_by_team);

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
    simulate_competition_matches_for_date(game, today, &indexes);
}

fn simulate_competition_matches_for_date(
    game: &mut Game,
    today: &str,
    indexes: &DaySimulationIndexes,
) {
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
        for fixture_index in fixture_indices {
            apply_fast_competition_result(
                competition,
                fixture_index,
                &team_strengths,
                &mut standing_index_by_team,
            );
        }
    }
}

fn apply_fast_competition_result(
    competition: &mut domain::league::Competition,
    fixture_index: usize,
    team_strengths: &HashMap<&str, u16>,
    standing_index_by_team: &mut HashMap<String, usize>,
) {
    let fixture = &competition.fixtures[fixture_index];
    let home_strength = team_strengths
        .get(fixture.home_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let away_strength = team_strengths
        .get(fixture.away_team_id.as_str())
        .copied()
        .unwrap_or(500);
    let seed = fixture
        .id
        .bytes()
        .fold(0_u32, |acc, byte| acc.wrapping_mul(31).wrapping_add(byte as u32));
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

    if fixture.counts_for_league_standings() {
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
