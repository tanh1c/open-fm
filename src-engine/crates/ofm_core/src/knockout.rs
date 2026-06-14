//! Round-by-round knockout progression for domestic cups and the Champions
//! League knockout phase.
//!
//! Cups and the continental knockout stage only schedule their *first* round up
//! front (see `schedule::generate_domestic_cup` and the Swiss-model continental
//! generator). After each simulated day, `process_knockout_progression` checks
//! whether the latest round finished and, if so, draws the next round from the
//! actual winners — so the bracket reflects real results instead of assuming the
//! higher-listed team always advances.
//!
//! - **Cups**: single-leg ties, redrawn each round (FA-Cup style). Draws are
//!   broken by a deterministic per-fixture "shoot-out" so a winner always emerges.
//! - **Champions League**: 36-team Swiss league phase (handled by normal standings
//!   simulation) → top 8 seed straight into the Round of 16, ranks 9–24 contest a
//!   two-legged playoff for the other 8 spots, ranks 25–36 are eliminated → R16,
//!   QF, SF are two-legged, the final is a single match.

use chrono::{DateTime, Datelike, Duration, Utc, Weekday};
use domain::league::{
    Competition, CompetitionKind, Fixture, FixtureCompetition, FixtureStatus, MatchResolution,
};
use rand::SeedableRng;
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use serde::Deserialize;
use std::collections::HashSet;
use uuid::Uuid;

use crate::game::Game;

/// Smallest power of two that is greater than or equal to `n` (min 1).
pub fn smallest_pow2_ge(n: usize) -> usize {
    let mut size = 1;
    while size < n {
        size *= 2;
    }
    size
}

/// Largest power of two that is less than or equal to `n` (min 1).
pub fn next_round_size(n: usize) -> usize {
    if n < 2 {
        return n;
    }
    let mut size = 1;
    while size * 2 <= n {
        size *= 2;
    }
    size
}

/// Human-stable stage key for a round in which `bracket_size` teams take part.
pub fn knockout_stage_label(bracket_size: usize) -> String {
    match bracket_size {
        0 | 1 => "final".to_string(),
        2 => "final".to_string(),
        4 => "sf".to_string(),
        8 => "qf".to_string(),
        16 => "r16".to_string(),
        other => format!("round_{other}"),
    }
}

fn advance_to_weekday(date: DateTime<Utc>, weekday: Weekday) -> DateTime<Utc> {
    let current = date.weekday().num_days_from_monday() as i64;
    let target = weekday.num_days_from_monday() as i64;
    let delta = (target - current).rem_euclid(7);
    date + Duration::days(delta)
}

fn parse_date(date: &str) -> Option<DateTime<Utc>> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
}

/// Deterministic coin flip for breaking a knockout deadlock (a drawn single-leg
/// tie or a level two-legged aggregate). Returns true when the home team wins.
fn home_wins_shootout(seed_source: &str) -> bool {
    let hash = seed_source
        .bytes()
        .fold(1469598103934665603_u64, |acc, byte| {
            (acc ^ byte as u64).wrapping_mul(1099511628211)
        });
    hash % 2 == 0
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KnockoutResolution {
    pub winner_team_id: String,
    pub runner_up_team_id: String,
    pub resolution: MatchResolution,
    pub home_penalties: Option<u8>,
    pub away_penalties: Option<u8>,
}

fn penalty_score(seed_source: &str, home_wins: bool) -> (u8, u8) {
    let base = seed_source
        .bytes()
        .fold(0_u8, |acc, byte| acc.wrapping_add(byte));
    let loser = 2 + (base % 3);
    let winner = loser + 1;
    if home_wins {
        (winner, loser)
    } else {
        (loser, winner)
    }
}

/// Winner of a single-leg knockout fixture (draws broken deterministically).
pub fn single_leg_resolution(fixture: &Fixture) -> Option<KnockoutResolution> {
    let result = fixture.result.as_ref()?;
    if result.home_goals > result.away_goals {
        Some(KnockoutResolution {
            winner_team_id: fixture.home_team_id.clone(),
            runner_up_team_id: fixture.away_team_id.clone(),
            resolution: MatchResolution::RegularTime,
            home_penalties: None,
            away_penalties: None,
        })
    } else if result.away_goals > result.home_goals {
        Some(KnockoutResolution {
            winner_team_id: fixture.away_team_id.clone(),
            runner_up_team_id: fixture.home_team_id.clone(),
            resolution: MatchResolution::RegularTime,
            home_penalties: None,
            away_penalties: None,
        })
    } else {
        let home_wins = home_wins_shootout(&fixture.id);
        let (home_penalties, away_penalties) = penalty_score(&fixture.id, home_wins);
        Some(KnockoutResolution {
            winner_team_id: if home_wins { fixture.home_team_id.clone() } else { fixture.away_team_id.clone() },
            runner_up_team_id: if home_wins { fixture.away_team_id.clone() } else { fixture.home_team_id.clone() },
            resolution: MatchResolution::AfterPenalties,
            home_penalties: Some(home_penalties),
            away_penalties: Some(away_penalties),
        })
    }
}

/// Winner of a single-leg knockout fixture (draws broken deterministically).
fn single_leg_winner(fixture: &Fixture) -> Option<String> {
    single_leg_resolution(fixture).map(|resolution| resolution.winner_team_id)
}

/// Winner of a two-legged tie identified by `tie_id`. The first team listed in
/// leg 1 is the tie's nominal "first leg home"; aggregate goals decide it, then a
/// deterministic shoot-out breaks a level aggregate.
fn two_leg_winner(legs: &[&Fixture]) -> Option<String> {
    if legs.is_empty() {
        return None;
    }
    // Identify the two participants from leg 1.
    let leg1 = legs.iter().min_by_key(|f| f.leg.unwrap_or(1))?;
    let team_a = leg1.home_team_id.clone();
    let team_b = leg1.away_team_id.clone();

    let mut agg_a = 0u32;
    let mut agg_b = 0u32;
    for leg in legs {
        let Some(result) = leg.result.as_ref() else {
            return None; // tie not finished
        };
        if leg.home_team_id == team_a {
            agg_a += result.home_goals as u32;
            agg_b += result.away_goals as u32;
        } else {
            agg_b += result.home_goals as u32;
            agg_a += result.away_goals as u32;
        }
    }

    if agg_a > agg_b {
        Some(team_a)
    } else if agg_b > agg_a {
        Some(team_b)
    } else if home_wins_shootout(&leg1.id) {
        Some(team_a)
    } else {
        Some(team_b)
    }
}

/// Run knockout progression for every applicable competition. Called once per
/// simulated day after that day's fixtures resolve.
pub fn process_knockout_progression(game: &mut Game, today: &str) {
    let competition_count = game.competitions.len();
    for index in 0..competition_count {
        let kind = game.competitions[index].kind.clone();
        match kind {
            CompetitionKind::DomesticCup => progress_cup(game, index, today),
            CompetitionKind::ContinentalLeague => progress_continental(game, index, today),
            CompetitionKind::WorldCup => progress_worldcup(game, index, today),
            _ => {}
        }
    }
}

/// A cup is single-leg and redrawn each round. Generate the next round once the
/// latest round's fixtures all complete and more than one team remains.
fn progress_cup(game: &mut Game, index: usize, today: &str) {
    let competition = &game.competitions[index];
    if competition.fixtures.is_empty() {
        return;
    }
    let max_matchday = competition
        .fixtures
        .iter()
        .map(|f| f.matchday)
        .max()
        .unwrap_or(0);
    let latest: Vec<&Fixture> = competition
        .fixtures
        .iter()
        .filter(|f| f.matchday == max_matchday)
        .collect();
    if latest.is_empty() || !latest.iter().all(|f| f.status == FixtureStatus::Completed) {
        return;
    }

    // Alive = every participant that has not lost a completed tie. Bye teams
    // (never scheduled) stay alive automatically.
    let mut losers: HashSet<String> = HashSet::new();
    for fixture in &competition.fixtures {
        if fixture.status != FixtureStatus::Completed {
            continue;
        }
        if let Some(winner) = single_leg_winner(fixture) {
            let loser = if winner == fixture.home_team_id {
                fixture.away_team_id.clone()
            } else {
                fixture.home_team_id.clone()
            };
            losers.insert(loser);
        }
    }
    let mut alive: Vec<String> = competition
        .team_ids
        .iter()
        .filter(|id| !losers.contains(*id))
        .cloned()
        .collect();
    if alive.len() < 2 {
        return; // champion decided
    }

    // Deterministic redraw seeded from competition id + next matchday.
    let next_matchday = max_matchday + 1;
    let seed = fnv_seed(&format!("{}-cup-{}", competition.id, next_matchday));
    let mut rng = StdRng::seed_from_u64(seed);
    alive.shuffle(&mut rng);

    let last_date = competition
        .fixtures
        .iter()
        .filter(|f| f.matchday == max_matchday)
        .filter_map(|f| parse_date(&f.date))
        .max();
    let base = last_date
        .map(|d| d + Duration::days(14))
        .or_else(|| parse_date(today))
        .unwrap_or_else(Utc::now);
    let round_date = advance_to_weekday(base, Weekday::Wed)
        .format("%Y-%m-%d")
        .to_string();

    let stage = knockout_stage_label(smallest_pow2_ge(alive.len()));
    let competition_id = competition.id.clone();
    let season = competition.season;
    let mut new_fixtures = Vec::new();
    let mut iter = alive.into_iter();
    while let (Some(home), Some(away)) = (iter.next(), iter.next()) {
        new_fixtures.push(Fixture {
            id: Uuid::new_v4().to_string(),
            matchday: next_matchday,
            date: round_date.clone(),
            home_team_id: home,
            away_team_id: away,
            competition_id: Some(competition_id.clone()),
            season: Some(season),
            competition: FixtureCompetition::DomesticCup,
            status: FixtureStatus::Scheduled,
            result: None,
            stage: Some(stage.clone()),
            leg: None,
            tie_id: None,
            ..Default::default()
        });
    }
    game.competitions[index].fixtures.extend(new_fixtures);
}

/// The Champions League knockout phase. Driven by stage labels rather than
/// matchdays because the league phase and knockout rounds coexist in one
/// competition.
///
/// The full 2024-25 model (≥24 league-phase teams) seeds the top 8 straight into
/// the Round of 16 while ranks 9–24 contest a two-legged playoff for the other 8
/// places. Smaller fields (mostly tests / lightweight worlds) skip the playoff
/// and seed the strongest power-of-two block straight into the first knockout
/// round.
fn progress_continental(game: &mut Game, index: usize, today: &str) {
    let competition = &game.competitions[index];
    if competition.fixtures.is_empty() {
        return;
    }

    // League phase = fixtures with no knockout `stage`. It must be fully played
    // before any knockout round can be drawn.
    let league_phase_done = competition
        .fixtures
        .iter()
        .filter(|f| f.stage.is_none())
        .all(|f| f.status == FixtureStatus::Completed)
        && competition.fixtures.iter().any(|f| f.stage.is_none());
    if !league_phase_done {
        return;
    }

    let has_stage = |stage: &str| {
        competition
            .fixtures
            .iter()
            .any(|f| f.stage.as_deref() == Some(stage))
    };
    let stage_complete = |stage: &str| {
        let legs: Vec<&Fixture> = competition
            .fixtures
            .iter()
            .filter(|f| f.stage.as_deref() == Some(stage))
            .collect();
        !legs.is_empty() && legs.iter().all(|f| f.status == FixtureStatus::Completed)
    };

    // Final standings of the league phase (frozen — knockout fixtures don't count).
    let ranked = ranked_team_ids(competition);
    let n = ranked.len();
    if n < 2 {
        return;
    }

    // Knockout bracket size: largest power of two ≤ min(n, 16).
    let knockout_size = next_round_size(n.min(16));
    if knockout_size < 2 {
        return;
    }
    let direct = knockout_size / 2;
    // Real model needs the top half direct + a full playoff pool of `knockout_size`.
    let use_playoff = n >= direct + knockout_size;
    let first_knockout_stage = knockout_stage_label(knockout_size);

    // Decide which round to draw next.
    if use_playoff {
        if !has_stage("playoff") && !has_stage(&first_knockout_stage) {
            let playoff_pool: Vec<String> =
                ranked.iter().skip(direct).take(knockout_size).cloned().collect();
            if playoff_pool.len() >= 2 {
                let ties = seed_two_leg_ties(&playoff_pool);
                schedule_two_leg_round(game, index, "playoff", &ties, today);
            }
            return;
        }
        if has_stage("playoff") && !has_stage(&first_knockout_stage) {
            if !stage_complete("playoff") {
                return;
            }
            let mut pool: Vec<String> = ranked.iter().take(direct).cloned().collect();
            pool.extend(stage_winners(competition, "playoff"));
            if pool.len() >= 2 {
                let ties = seed_two_leg_ties(&pool);
                schedule_two_leg_round(game, index, &first_knockout_stage, &ties, today);
            }
            return;
        }
    } else if !has_stage(&first_knockout_stage) {
        // No playoff: seed the strongest power-of-two block straight in.
        let pool: Vec<String> = ranked.iter().take(knockout_size).cloned().collect();
        if pool.len() >= 2 {
            let ties = seed_two_leg_ties(&pool);
            schedule_two_leg_round(game, index, &first_knockout_stage, &ties, today);
        }
        return;
    }

    // From the first knockout round onward, advance winners through r16 → qf →
    // sf → final regardless of how the bracket was seeded.
    for (stage, next) in [("r16", "qf"), ("qf", "sf"), ("sf", "final")] {
        if has_stage(stage) && !has_stage(next) {
            if !stage_complete(stage) {
                return;
            }
            let winners = stage_winners(competition, stage);
            if next == "final" {
                if winners.len() >= 2 {
                    schedule_single_final(game, index, &winners[0], &winners[1], today);
                }
            } else if winners.len() >= 2 {
                let ties = seed_two_leg_ties(&winners);
                schedule_two_leg_round(game, index, next, &ties, today);
            }
            return;
        }
    }
}

/// League-phase standings order (points, GD, GF) as team ids.
fn ranked_team_ids(competition: &Competition) -> Vec<String> {
    let mut standings = competition.standings.clone();
    standings.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then(b.goal_difference().cmp(&a.goal_difference()))
            .then(b.goals_for.cmp(&a.goals_for))
            .then(a.team_id.cmp(&b.team_id))
    });
    standings.into_iter().map(|s| s.team_id).collect()
}

/// Winners of every two-legged tie within a stage, in tie order.
fn stage_winners(competition: &Competition, stage: &str) -> Vec<String> {
    let mut tie_ids: Vec<String> = Vec::new();
    for fixture in &competition.fixtures {
        if fixture.stage.as_deref() != Some(stage) {
            continue;
        }
        if let Some(tie_id) = &fixture.tie_id {
            if !tie_ids.contains(tie_id) {
                tie_ids.push(tie_id.clone());
            }
        }
    }
    let mut winners = Vec::new();
    for tie_id in tie_ids {
        let legs: Vec<&Fixture> = competition
            .fixtures
            .iter()
            .filter(|f| f.tie_id.as_deref() == Some(tie_id.as_str()))
            .collect();
        if let Some(winner) = two_leg_winner(&legs) {
            winners.push(winner);
        }
    }
    winners
}

/// Pair a seeded pool into two-legged ties: 1st vs last, 2nd vs second-last, …
/// (top seeds host the decisive second leg).
fn seed_two_leg_ties(pool: &[String]) -> Vec<(String, String)> {
    let mut ties = Vec::new();
    let half = pool.len() / 2;
    for i in 0..half {
        let seeded = pool[i].clone();
        let unseeded = pool[pool.len() - 1 - i].clone();
        // Unseeded hosts leg 1, seeded hosts the decisive leg 2.
        ties.push((unseeded, seeded));
    }
    ties
}

fn schedule_two_leg_round(
    game: &mut Game,
    index: usize,
    stage: &str,
    ties: &[(String, String)],
    today: &str,
) {
    let competition = &game.competitions[index];
    let competition_id = competition.id.clone();
    let season = competition.season;
    let base = latest_fixture_date(competition)
        .map(|d| d + Duration::days(21))
        .or_else(|| parse_date(today))
        .unwrap_or_else(Utc::now);
    let leg1_date = advance_to_weekday(base, Weekday::Tue)
        .format("%Y-%m-%d")
        .to_string();
    let leg2_date = advance_to_weekday(base + Duration::days(7), Weekday::Wed)
        .format("%Y-%m-%d")
        .to_string();

    let mut new_fixtures = Vec::new();
    for (leg1_home, leg1_away) in ties {
        let tie_id = Uuid::new_v4().to_string();
        new_fixtures.push(make_continental_fixture(
            &competition_id,
            season,
            leg1_home,
            leg1_away,
            stage,
            1,
            &tie_id,
            &leg1_date,
        ));
        new_fixtures.push(make_continental_fixture(
            &competition_id,
            season,
            leg1_away,
            leg1_home,
            stage,
            2,
            &tie_id,
            &leg2_date,
        ));
    }
    game.competitions[index].fixtures.extend(new_fixtures);
}

fn schedule_single_final(
    game: &mut Game,
    index: usize,
    team_a: &str,
    team_b: &str,
    today: &str,
) {
    let competition = &game.competitions[index];
    let competition_id = competition.id.clone();
    let season = competition.season;
    let base = latest_fixture_date(competition)
        .map(|d| d + Duration::days(21))
        .or_else(|| parse_date(today))
        .unwrap_or_else(Utc::now);
    let final_date = advance_to_weekday(base, Weekday::Sat)
        .format("%Y-%m-%d")
        .to_string();
    let tie_id = Uuid::new_v4().to_string();
    let fixture = make_continental_fixture(
        &competition_id,
        season,
        team_a,
        team_b,
        "final",
        1,
        &tie_id,
        &final_date,
    );
    game.competitions[index].fixtures.push(fixture);
}

#[allow(clippy::too_many_arguments)]
fn make_continental_fixture(
    competition_id: &str,
    season: u32,
    home: &str,
    away: &str,
    stage: &str,
    leg: u8,
    tie_id: &str,
    date: &str,
) -> Fixture {
    Fixture {
        id: Uuid::new_v4().to_string(),
        matchday: 100 + leg as u32, // knockout fixtures sort after the league phase
        date: date.to_string(),
        home_team_id: home.to_string(),
        away_team_id: away.to_string(),
        competition_id: Some(competition_id.to_string()),
        season: Some(season),
        competition: FixtureCompetition::ContinentalLeague,
        status: FixtureStatus::Scheduled,
        result: None,
        stage: Some(stage.to_string()),
        leg: Some(leg),
        tie_id: Some(tie_id.to_string()),
        ..Default::default()
    }
}

fn latest_fixture_date(competition: &Competition) -> Option<DateTime<Utc>> {
    competition
        .fixtures
        .iter()
        .filter_map(|f| parse_date(&f.date))
        .max()
}

fn fnv_seed(source: &str) -> u64 {
    source.bytes().fold(1469598103934665603_u64, |acc, byte| {
        (acc ^ byte as u64).wrapping_mul(1099511628211)
    })
}

// ---------------------------------------------------------------------------
// World Cup knockout progression
// ---------------------------------------------------------------------------

const WORLD_CUP_2026_SCHEDULE_JSON: &str = include_str!("wc2026_schedule_groups_knockout.json");

#[derive(Debug, Deserialize)]
struct WorldCupScheduleData {
    knockout_fixtures: Vec<WorldCupKnockoutFixtureData>,
    venues: Vec<WorldCupVenueData>,
}

#[derive(Debug, Deserialize)]
struct WorldCupKnockoutFixtureData {
    match_number: u32,
    stage: String,
    home: String,
    away: String,
    date: String,
    stadium: String,
    city: String,
}

#[derive(Debug, Deserialize)]
struct WorldCupVenueData {
    stadium: String,
    city: String,
    country: String,
}

fn worldcup_schedule_data() -> WorldCupScheduleData {
    serde_json::from_str(WORLD_CUP_2026_SCHEDULE_JSON)
        .expect("embedded World Cup schedule JSON should be valid")
}

fn worldcup_stage_key(stage: &str) -> Option<&'static str> {
    match stage {
        "Round of 32" => Some("r32"),
        "Round of 16" => Some("r16"),
        "Quarterfinals" => Some("qf"),
        "Semifinals" => Some("sf"),
        "Final" => Some("final"),
        "Match for third place" => Some("third_place"),
        _ => None,
    }
}

fn worldcup_venue_country(schedule: &WorldCupScheduleData, stadium: &str, city: &str) -> Option<String> {
    schedule
        .venues
        .iter()
        .find(|venue| venue.stadium == stadium && venue.city == city)
        .map(|venue| venue.country.clone())
}

fn progress_worldcup(game: &mut Game, index: usize, _today: &str) {
    let competition = &game.competitions[index];
    if competition.fixtures.is_empty() {
        return;
    }

    let group_stage_done = competition
        .fixtures
        .iter()
        .filter(|f| f.stage.is_none())
        .all(|f| f.status == FixtureStatus::Completed)
        && competition.fixtures.iter().any(|f| f.stage.is_none());
    if !group_stage_done {
        return;
    }

    let has_stage = |stage: &str| {
        competition
            .fixtures
            .iter()
            .any(|f| f.stage.as_deref() == Some(stage))
    };
    let stage_complete = |stage: &str| {
        let legs: Vec<&Fixture> = competition
            .fixtures
            .iter()
            .filter(|f| f.stage.as_deref() == Some(stage))
            .collect();
        !legs.is_empty() && legs.iter().all(|f| f.status == FixtureStatus::Completed)
    };

    let schedule = worldcup_schedule_data();
    if !has_stage("r32") {
        let Some(fixtures) = build_worldcup_template_stage_fixtures(competition, &schedule, "r32") else {
            return;
        };
        append_worldcup_knockout_fixtures(game, index, fixtures);
        return;
    }

    for (stage, next) in [("r32", "r16"), ("r16", "qf"), ("qf", "sf"), ("sf", "final")] {
        if has_stage(stage) && !has_stage(next) {
            if !stage_complete(stage) {
                return;
            }
            let Some(mut fixtures) = build_worldcup_template_stage_fixtures(competition, &schedule, next) else {
                return;
            };
            if next == "final"
                && let Some(third_place_fixtures) =
                    build_worldcup_template_stage_fixtures(competition, &schedule, "third_place")
            {
                fixtures.extend(third_place_fixtures);
            }
            append_worldcup_knockout_fixtures(game, index, fixtures);
            return;
        }
    }

    if has_stage("sf") && !has_stage("third_place") && stage_complete("sf") {
        if let Some(fixtures) = build_worldcup_template_stage_fixtures(competition, &schedule, "third_place") {
            append_worldcup_knockout_fixtures(game, index, fixtures);
        }
    }
}

fn append_worldcup_knockout_fixtures(game: &mut Game, index: usize, fixtures: Vec<Fixture>) {
    if fixtures.is_empty() {
        return;
    }

    if let Some(league) = game.league.as_mut() {
        if league.id == game.competitions[index].id {
            league.fixtures.extend(fixtures.iter().cloned());
        }
    }
    game.competitions[index].fixtures.extend(fixtures);
}

fn build_worldcup_template_stage_fixtures(
    competition: &Competition,
    schedule: &WorldCupScheduleData,
    stage_key: &str,
) -> Option<Vec<Fixture>> {
    let mut fixtures = Vec::new();
    for template in schedule
        .knockout_fixtures
        .iter()
        .filter(|template| worldcup_stage_key(&template.stage) == Some(stage_key))
    {
        let home_team_id = resolve_worldcup_placeholder(competition, &template.home)?;
        let away_team_id = resolve_worldcup_placeholder(competition, &template.away)?;
        fixtures.push(Fixture {
            id: Uuid::new_v4().to_string(),
            matchday: template.match_number,
            date: template.date.clone(),
            home_team_id,
            away_team_id,
            competition_id: Some(competition.id.clone()),
            season: Some(competition.season),
            competition: FixtureCompetition::WorldCup,
            status: FixtureStatus::Scheduled,
            result: None,
            stage: Some(stage_key.to_string()),
            leg: None,
            tie_id: Some(format!("wc2026-match-{}", template.match_number)),
            venue_name: Some(template.stadium.clone()),
            venue_city: Some(template.city.clone()),
            venue_country: worldcup_venue_country(schedule, &template.stadium, &template.city),
            group_label: None,
        });
    }

    if fixtures.is_empty() {
        None
    } else {
        Some(fixtures)
    }
}

fn resolve_worldcup_placeholder(competition: &Competition, placeholder: &str) -> Option<String> {
    if let Some(group) = placeholder.strip_prefix("Winner Group ") {
        return worldcup_group_ranked_team(competition, group, 0);
    }
    if let Some(group) = placeholder.strip_prefix("Runner-up Group ") {
        return worldcup_group_ranked_team(competition, group, 1);
    }
    if let Some(groups) = placeholder.strip_prefix("3rd Group ") {
        return worldcup_best_third_from_groups(competition, groups);
    }
    if let Some(match_number) = placeholder.strip_prefix("Winner Match ") {
        return worldcup_match_resolution(competition, match_number, true);
    }
    if let Some(match_number) = placeholder.strip_prefix("Loser Match ") {
        return worldcup_match_resolution(competition, match_number, false);
    }
    None
}

fn worldcup_group_ranked_team(competition: &Competition, group: &str, rank: usize) -> Option<String> {
    let group_index = group.as_bytes().first()?.checked_sub(b'A')? as usize;
    let start = group_index * 4;
    let end = start + 4;
    let mut group_standings: Vec<&StandingEntry> = competition.standings.get(start..end)?.iter().collect();
    group_standings.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then(b.goal_difference().cmp(&a.goal_difference()))
            .then(b.goals_for.cmp(&a.goals_for))
    });
    group_standings.get(rank).map(|standing| standing.team_id.clone())
}

fn worldcup_best_third_from_groups(competition: &Competition, groups: &str) -> Option<String> {
    let allowed_groups: HashSet<&str> = groups.split('/').collect();
    let mut thirds = Vec::new();
    for group in 'A'..='L' {
        let group_label = group.to_string();
        if !allowed_groups.contains(group_label.as_str()) {
            continue;
        }
        let Some(team_id) = worldcup_group_ranked_team(competition, &group_label, 2) else {
            continue;
        };
        let group_index = group as usize - 'A' as usize;
        let start = group_index * 4;
        let end = start + 4;
        let standing = competition
            .standings
            .get(start..end)?
            .iter()
            .find(|entry| entry.team_id == team_id)?;
        thirds.push((team_id, standing.clone()));
    }
    thirds.sort_by(|a, b| {
        b.1.points
            .cmp(&a.1.points)
            .then(b.1.goal_difference().cmp(&a.1.goal_difference()))
            .then(b.1.goals_for.cmp(&a.1.goals_for))
    });
    thirds.first().map(|(team_id, _)| team_id.clone())
}

fn worldcup_match_resolution(competition: &Competition, match_number: &str, winner: bool) -> Option<String> {
    let matchday = match_number.parse::<u32>().ok()?;
    let fixture = competition
        .fixtures
        .iter()
        .find(|fixture| fixture.matchday == matchday && fixture.competition == FixtureCompetition::WorldCup)?;
    let resolution = single_leg_resolution(fixture)?;
    Some(if winner {
        resolution.winner_team_id
    } else {
        resolution.runner_up_team_id
    })
}

/// Top 2 from each group + 8 best 3rd-place teams = 32 qualifiers.
/// Groups are determined by team order in standings (48 teams, 12 groups of 4).
#[allow(dead_code)]
fn worldcup_qualified_teams(competition: &Competition) -> Vec<String> {
    const GROUP_SIZE: usize = 4;
    const NUM_GROUPS: usize = 12;
    let standings = &competition.standings;
    if standings.len() < NUM_GROUPS * GROUP_SIZE {
        return Vec::new();
    }

    let mut group_winners = Vec::new();
    let mut group_runners_up = Vec::new();
    let mut third_place = Vec::new();

    for g in 0..NUM_GROUPS {
        let start = g * GROUP_SIZE;
        let end = start + GROUP_SIZE;
        let mut group: Vec<&StandingEntry> = standings[start..end].iter().collect();
        group.sort_by(|a, b| {
            b.points
                .cmp(&a.points)
                .then(b.goal_difference().cmp(&a.goal_difference()))
                .then(b.goals_for.cmp(&a.goals_for))
        });
        if group.len() >= 3 {
            group_winners.push(group[0].team_id.clone());
            group_runners_up.push(group[1].team_id.clone());
            third_place.push((group[2].team_id.clone(), group[2].clone()));
        }
    }

    let mut best_thirds = third_place;
    best_thirds.sort_by(|a, b| {
        b.1.points
            .cmp(&a.1.points)
            .then(b.1.goal_difference().cmp(&a.1.goal_difference()))
            .then(b.1.goals_for.cmp(&a.1.goals_for))
    });

    let mut qualified = group_winners;
    qualified.extend(group_runners_up);
    qualified.extend(best_thirds.into_iter().take(8).map(|(id, _)| id));
    qualified
}

use domain::league::StandingEntry;

/// Identify the champion of a finished knockout competition, if decided.
pub fn knockout_champion(competition: &Competition) -> Option<String> {
    match competition.kind {
        CompetitionKind::DomesticCup => {
            // The final is the highest-matchday single fixture, completed, with
            // exactly one alive team afterwards.
            let max_matchday = competition.fixtures.iter().map(|f| f.matchday).max()?;
            let final_round: Vec<&Fixture> = competition
                .fixtures
                .iter()
                .filter(|f| f.matchday == max_matchday)
                .collect();
            if final_round.len() == 1
                && final_round[0].status == FixtureStatus::Completed
            {
                single_leg_winner(final_round[0])
            } else {
                None
            }
        }
        CompetitionKind::ContinentalLeague => {
            let legs: Vec<&Fixture> = competition
                .fixtures
                .iter()
                .filter(|f| f.stage.as_deref() == Some("final"))
                .collect();
            if !legs.is_empty() && legs.iter().all(|f| f.status == FixtureStatus::Completed) {
                single_leg_winner(legs[0])
            } else {
                None
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::league::MatchResult;

    #[test]
    fn pow2_helpers() {
        assert_eq!(smallest_pow2_ge(20), 32);
        assert_eq!(smallest_pow2_ge(16), 16);
        assert_eq!(next_round_size(20), 16);
        assert_eq!(next_round_size(16), 16);
        assert_eq!(next_round_size(6), 4);
    }

    #[test]
    fn stage_labels() {
        assert_eq!(knockout_stage_label(2), "final");
        assert_eq!(knockout_stage_label(4), "sf");
        assert_eq!(knockout_stage_label(8), "qf");
        assert_eq!(knockout_stage_label(16), "r16");
        assert_eq!(knockout_stage_label(32), "round_32");
    }

    fn worldcup_standing(team_id: &str, points: u32, goals_for: u32, goals_against: u32) -> StandingEntry {
        StandingEntry {
            team_id: team_id.to_string(),
            played: 3,
            won: 0,
            drawn: 0,
            lost: 0,
            goals_for,
            goals_against,
            points,
        }
    }

    #[test]
    fn worldcup_progression_uses_official_r32_template_dates_and_venues() {
        let mut standings = Vec::new();
        let mut fixtures = Vec::new();
        for group_index in 0..12 {
            let winner = format!("g{group_index}-winner");
            let runner = format!("g{group_index}-runner");
            standings.push(worldcup_standing(&winner, 9, 6, 1));
            standings.push(worldcup_standing(&runner, 6, 4, 2));
            standings.push(worldcup_standing(
                &format!("g{group_index}-third"),
                group_index as u32,
                group_index as u32 + 1,
                1,
            ));
            standings.push(worldcup_standing(&format!("g{group_index}-fourth"), 0, 1, 6));
            fixtures.push(Fixture {
                id: format!("group-{group_index}"),
                matchday: group_index as u32 + 1,
                date: "2026-06-27".to_string(),
                home_team_id: winner,
                away_team_id: runner,
                competition_id: Some("worldcup".to_string()),
                season: Some(2026),
                competition: FixtureCompetition::WorldCup,
                status: FixtureStatus::Completed,
                result: Some(MatchResult {
                    home_goals: 1,
                    away_goals: 0,
                    home_scorers: vec![],
                    away_scorers: vec![],
                    report: None,
                    winner_team_id: None,
                    resolution: None,
                    home_penalties: None,
                    away_penalties: None,
                }),
                stage: None,
                ..Default::default()
            });
        }
        let competition = Competition {
            id: "worldcup".to_string(),
            name: "World Cup 2026".to_string(),
            season: 2026,
            kind: CompetitionKind::WorldCup,
            format: domain::league::CompetitionFormat::GroupStageKnockout,
            country: None,
            tier: None,
            team_ids: standings.iter().map(|entry| entry.team_id.clone()).collect(),
            fixtures,
            standings,
            transfer_log: vec![],
        };
        let legacy_fixtures = competition.fixtures.clone();
        let legacy_standings = competition.standings.clone();
        let mut game = Game::new(
            crate::clock::GameClock::new(Utc::now()),
            domain::manager::Manager::new(
                "mgr".to_string(),
                "Test".to_string(),
                "Manager".to_string(),
                "1980-01-01".to_string(),
                "England".to_string(),
            ),
            vec![],
            vec![],
            vec![],
            vec![],
        );
        game.league = Some(domain::league::League {
            id: "worldcup".to_string(),
            name: "World Cup 2026".to_string(),
            season: 2026,
            fixtures: legacy_fixtures,
            standings: legacy_standings,
            transfer_log: vec![],
        });
        game.competitions = vec![competition];

        process_knockout_progression(&mut game, "2026-06-27");

        let r32 = game.competitions[0]
            .fixtures
            .iter()
            .find(|fixture| fixture.matchday == 73)
            .expect("match 73 should be scheduled");
        assert_eq!(r32.stage.as_deref(), Some("r32"));
        assert_eq!(r32.date, "2026-06-28");
        assert_eq!(r32.venue_name.as_deref(), Some("SoFi Stadium"));
        assert_eq!(r32.venue_city.as_deref(), Some("Inglewood"));
        assert!(game
            .league
            .as_ref()
            .expect("legacy league should exist")
            .fixtures
            .iter()
            .any(|fixture| fixture.matchday == 73 && fixture.date == "2026-06-28"));
    }

    #[test]
    fn worldcup_qualified_teams_uses_top_two_plus_best_thirds() {
        let mut standings = Vec::new();
        for group_index in 0..12 {
            standings.push(worldcup_standing(&format!("g{group_index}-winner"), 9, 6, 1));
            standings.push(worldcup_standing(&format!("g{group_index}-runner"), 6, 4, 2));
            standings.push(worldcup_standing(
                &format!("g{group_index}-third"),
                group_index as u32,
                group_index as u32 + 1,
                1,
            ));
            standings.push(worldcup_standing(&format!("g{group_index}-fourth"), 0, 1, 6));
        }
        let competition = Competition {
            id: "worldcup".to_string(),
            name: "World Cup 2026".to_string(),
            season: 2026,
            kind: CompetitionKind::WorldCup,
            format: domain::league::CompetitionFormat::GroupStageKnockout,
            country: None,
            tier: None,
            team_ids: standings.iter().map(|entry| entry.team_id.clone()).collect(),
            fixtures: vec![],
            standings,
            transfer_log: vec![],
        };

        let qualified = worldcup_qualified_teams(&competition);

        assert_eq!(qualified.len(), 32);
        for group_index in 0..12 {
            assert!(qualified.contains(&format!("g{group_index}-winner")));
            assert!(qualified.contains(&format!("g{group_index}-runner")));
        }
        for group_index in 4..12 {
            assert!(qualified.contains(&format!("g{group_index}-third")));
        }
        for group_index in 0..4 {
            assert!(!qualified.contains(&format!("g{group_index}-third")));
        }
    }

    #[test]
    fn two_leg_aggregate_decides_winner() {
        let leg1 = Fixture {
            id: "l1".into(),
            matchday: 101,
            date: "2026-02-10".into(),
            home_team_id: "A".into(),
            away_team_id: "B".into(),
            competition_id: Some("c".into()),
            season: Some(2026),
            competition: FixtureCompetition::ContinentalLeague,
            status: FixtureStatus::Completed,
            result: Some(MatchResult {
                home_goals: 1,
                away_goals: 2,
                home_scorers: vec![],
                away_scorers: vec![],
                report: None,
            winner_team_id: None,
            resolution: None,
            home_penalties: None,
            away_penalties: None,
            }),
            stage: Some("r16".into()),
            leg: Some(1),
            tie_id: Some("tie".into()),
            ..Default::default()
        };
        let leg2 = Fixture {
            id: "l2".into(),
            matchday: 102,
            date: "2026-02-17".into(),
            home_team_id: "B".into(),
            away_team_id: "A".into(),
            competition_id: Some("c".into()),
            season: Some(2026),
            competition: FixtureCompetition::ContinentalLeague,
            status: FixtureStatus::Completed,
            result: Some(MatchResult {
                home_goals: 0,
                away_goals: 0,
                home_scorers: vec![],
                away_scorers: vec![],
                report: None,
            winner_team_id: None,
            resolution: None,
            home_penalties: None,
            away_penalties: None,
            }),
            stage: Some("r16".into()),
            leg: Some(2),
            tie_id: Some("tie".into()),
            ..Default::default()
        };
        // Aggregate: A scored 1 (away) + 0 (home) = 1; B scored 2 + 0 = 2. B wins.
        assert_eq!(two_leg_winner(&[&leg1, &leg2]), Some("B".to_string()));
    }
}
