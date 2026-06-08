pub(crate) mod data;
pub mod definitions;
mod generation;
mod real_fc26;
pub mod world_io;

pub use definitions::*;
pub use real_fc26::{fc26_real_player_count_estimate, generate_fc26_world};
pub use world_io::*;

use domain::player::{Player, Position};
use domain::staff::{Staff, StaffRole};
use domain::team::Team;
use domain::team::{Facilities, PlayStyle, TacticalInstructions, TeamColors};
use log::{debug, info};
use rand::RngExt;
use uuid::Uuid;

use crate::player_rating::refresh_player_derived;
use generation::*;

const MAX_OPENING_EXPIRING_CONTRACTS: usize = 2;
const MIN_OPENING_RUNWAY_WEEKS: i64 = 16;
const OPENING_SHORT_CONTRACT_END: &str = "2027-06-30";
const OPENING_YOUTH_ACADEMY_SIZE: usize = 3;
const OPENING_YOUTH_MAX_AGE: i32 = 21;

fn target_wage_usage_percent(reputation: u32) -> i64 {
    if reputation >= 750 {
        95
    } else if reputation >= 550 {
        94
    } else {
        93
    }
}

fn normalized_wage_budget(annual_wage_bill: i64, reputation: u32) -> i64 {
    let annual_wage_bill = annual_wage_bill.max(0);
    let usage_target = target_wage_usage_percent(reputation);
    ((annual_wage_bill * 100) + usage_target - 1) / usage_target
}

pub(super) fn facility_level(score: u8) -> u8 {
    match score {
        85..=100 => 5,
        70..=84 => 4,
        55..=69 => 3,
        40..=54 => 2,
        _ => 1,
    }
}

pub(super) fn tactical_familiarity_from_level(tactical_level: u8, volatility: u8) -> u8 {
    let base = 35_i16 + (tactical_level as i16 * 45 / 100);
    let volatility_penalty = ((volatility as i16 - 45).max(0) * 12) / 55;
    (base - volatility_penalty).clamp(35, 88) as u8
}

pub(super) fn default_formation_for_team(play_style: &PlayStyle, tactical_level: u8, volatility: u8) -> String {
    let formation = match play_style {
        PlayStyle::Possession if tactical_level >= 70 => "4-3-3",
        PlayStyle::Possession => "4-2-3-1",
        PlayStyle::HighPress if tactical_level >= 70 => "4-3-3",
        PlayStyle::HighPress => "4-2-3-1",
        PlayStyle::Attacking if volatility >= 65 => "3-4-3",
        PlayStyle::Attacking => "4-2-3-1",
        PlayStyle::Counter => "4-2-3-1",
        PlayStyle::Defensive if tactical_level >= 65 => "3-5-2",
        PlayStyle::Defensive => "5-3-2",
        PlayStyle::Balanced if tactical_level >= 75 => "4-3-3",
        PlayStyle::Balanced if volatility >= 70 => "4-4-2",
        PlayStyle::Balanced => "4-2-3-1",
    };

    formation.to_string()
}

fn clamp_instruction(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn avg_attr(players: &[Player], f: impl Fn(&domain::player::Player) -> u8) -> f64 {
    players.iter().map(|player| f(player) as u32).sum::<u32>() as f64 / players.len().max(1) as f64
}

pub(super) fn generated_tactical_instructions_for_team(
    team: &Team,
    players: &[Player],
) -> TacticalInstructions {
    let technical = (avg_attr(players, |player| player.attributes.passing)
        + avg_attr(players, |player| player.attributes.vision)
        + avg_attr(players, |player| player.attributes.decisions)
        + avg_attr(players, |player| player.attributes.composure))
        / 4.0;
    let physical = (avg_attr(players, |player| player.attributes.stamina)
        + avg_attr(players, |player| player.attributes.pace)
        + avg_attr(players, |player| player.attributes.aggression))
        / 3.0;
    let defensive = (avg_attr(players, |player| player.attributes.defending)
        + avg_attr(players, |player| player.attributes.tackling)
        + avg_attr(players, |player| player.attributes.positioning))
        / 3.0;
    let attacking = (avg_attr(players, |player| player.attributes.shooting)
        + avg_attr(players, |player| player.attributes.dribbling)
        + avg_attr(players, |player| player.attributes.positioning))
        / 3.0;
    let technical_bias = ((technical - 70.0) / 100.0).clamp(-0.12, 0.12);
    let physical_bias = ((physical - 70.0) / 100.0).clamp(-0.12, 0.12);
    let defensive_bias = ((defensive - 70.0) / 100.0).clamp(-0.10, 0.10);
    let attacking_bias = ((attacking - 70.0) / 100.0).clamp(-0.10, 0.10);
    let tactical_bias = ((team.tactical_level as f64 - 55.0) / 100.0).clamp(-0.08, 0.12);
    let volatility_bias = ((team.volatility as f64 - 50.0) / 100.0).clamp(-0.08, 0.12);

    let base = match team.play_style {
        PlayStyle::Attacking => TacticalInstructions {
            pressing_intensity: 0.64,
            defensive_line: 0.62,
            tempo: 0.70,
            width: 0.66,
            passing_directness: 0.58,
            risk_appetite: 0.74,
            counter_attack: 0.58,
            counter_press: 0.62,
        },
        PlayStyle::Defensive => TacticalInstructions {
            pressing_intensity: 0.34,
            defensive_line: 0.30,
            tempo: 0.38,
            width: 0.42,
            passing_directness: 0.44,
            risk_appetite: 0.28,
            counter_attack: 0.40,
            counter_press: 0.32,
        },
        PlayStyle::Possession => TacticalInstructions {
            pressing_intensity: 0.58,
            defensive_line: 0.56,
            tempo: 0.54,
            width: 0.54,
            passing_directness: 0.30,
            risk_appetite: 0.44,
            counter_attack: 0.40,
            counter_press: 0.62,
        },
        PlayStyle::Counter => TacticalInstructions {
            pressing_intensity: 0.46,
            defensive_line: 0.40,
            tempo: 0.72,
            width: 0.62,
            passing_directness: 0.76,
            risk_appetite: 0.56,
            counter_attack: 0.80,
            counter_press: 0.48,
        },
        PlayStyle::HighPress => TacticalInstructions {
            pressing_intensity: 0.86,
            defensive_line: 0.74,
            tempo: 0.74,
            width: 0.56,
            passing_directness: 0.56,
            risk_appetite: 0.66,
            counter_attack: 0.62,
            counter_press: 0.84,
        },
        PlayStyle::Balanced => TacticalInstructions::default(),
    };

    TacticalInstructions {
        pressing_intensity: clamp_instruction(base.pressing_intensity + physical_bias + tactical_bias - volatility_bias * 0.2),
        defensive_line: clamp_instruction(base.defensive_line + defensive_bias * 0.4 + tactical_bias - volatility_bias * 0.15),
        tempo: clamp_instruction(base.tempo + physical_bias * 0.6 + attacking_bias * 0.4 + volatility_bias * 0.35),
        width: clamp_instruction(base.width + attacking_bias * 0.4 - defensive_bias * 0.15),
        passing_directness: clamp_instruction(base.passing_directness - technical_bias * 0.7 + physical_bias * 0.25 + volatility_bias * 0.2),
        risk_appetite: clamp_instruction(base.risk_appetite + attacking_bias * 0.7 + tactical_bias * 0.4 + volatility_bias * 0.35),
        counter_attack: clamp_instruction(base.counter_attack + physical_bias * 0.5 + attacking_bias * 0.4 + volatility_bias * 0.25),
        counter_press: clamp_instruction(base.counter_press + physical_bias * 0.5 + tactical_bias * 0.3 - volatility_bias * 0.15),
    }
    .clamped()
}

/// Iconic shirt number preferred for a granular position. Used to give the best
/// player in each role a "nice" number (1 GK, 9/10 strikers, 7/11 wingers, etc.).
fn iconic_number_for_position(position: &Position) -> u8 {
    match position {
        Position::Goalkeeper => 1,
        Position::RightBack => 2,
        Position::LeftBack => 3,
        Position::CenterBack => 4,
        Position::Defender => 5,
        Position::DefensiveMidfielder => 6,
        Position::RightWinger | Position::RightMidfielder => 7,
        Position::CentralMidfielder | Position::Midfielder => 8,
        Position::Striker | Position::Forward => 9,
        Position::AttackingMidfielder => 10,
        Position::LeftWinger | Position::LeftMidfielder => 11,
        Position::RightWingBack => 2,
        Position::LeftWingBack => 3,
    }
}

/// Assign realistic shirt numbers to a freshly generated squad. The strongest
/// player (by OVR) at each iconic number's position claims that number; remaining
/// players fill the lowest free numbers from 12 upward, then 1-11 if needed.
pub(super) fn assign_squad_numbers(players: &mut [Player]) {
    use std::collections::HashSet;

    // Order candidates strongest-first so the best player at a position wins the
    // contest for its iconic number.
    let mut order: Vec<usize> = (0..players.len()).collect();
    order.sort_by(|&a, &b| players[b].ovr.cmp(&players[a].ovr));

    let mut taken: HashSet<u8> = players
        .iter()
        .filter_map(|player| player.squad_number.filter(|number| (1..=99).contains(number)))
        .collect();

    // Pass 1: give each unnumbered player its position's iconic number if still free.
    for &index in &order {
        if players[index].squad_number.is_some() {
            continue;
        }
        let desired = iconic_number_for_position(&players[index].natural_position);
        if !taken.contains(&desired) {
            players[index].squad_number = Some(desired);
            taken.insert(desired);
        }
    }

    // Pass 2: fill anyone left with the lowest available number (prefer 12+ so
    // the classic 1-11 stay with the iconic-position winners).
    for &index in &order {
        if players[index].squad_number.is_some() {
            continue;
        }
        let mut number = 12u8;
        while taken.contains(&number) && number < 99 {
            number += 1;
        }
        if taken.contains(&number) {
            // 12-99 exhausted (shouldn't happen for 22 players); fall back to 1-11.
            number = (1..=99).find(|n| !taken.contains(n)).unwrap_or(99);
        }
        players[index].squad_number = Some(number);
        taken.insert(number);
    }
}

pub(super) fn opening_morale_from_context(reputation: u32, current_strength: Option<u8>, volatility: u8, seed: u8) -> u8 {    let strength = current_strength.unwrap_or((reputation / 10).clamp(1, 100) as u8);
    let reputation_bonus = if reputation >= 850 {
        5
    } else if reputation >= 650 {
        3
    } else if reputation <= 350 {
        -3
    } else {
        0
    };
    let strength_bonus = (strength as i16 - 70) / 8;
    let volatility_swing = (volatility as i16 - 50) / 6;
    let jitter = seed as i16 % 9 - 4;

    (58 + reputation_bonus + strength_bonus + jitter - volatility_swing).clamp(35, 82) as u8
}

fn normalize_opening_contracts(players: &mut [Player]) {
    let mut expiring_indices: Vec<usize> = players
        .iter()
        .enumerate()
        .filter(|(_, player)| player.contract_end.as_deref() == Some(OPENING_SHORT_CONTRACT_END))
        .map(|(index, _)| index)
        .collect();

    expiring_indices.sort_by_key(|index| players[*index].date_of_birth.clone());

    for index in expiring_indices
        .into_iter()
        .skip(MAX_OPENING_EXPIRING_CONTRACTS)
    {
        if let Some(contract_end) = players[index].contract_end.as_deref()
            && let Ok(year) = contract_end[0..4].parse::<i32>()
        {
            players[index].contract_end = Some(format!("{}-06-30", year + 1));
        }
    }
}

fn opening_player_age(date_of_birth: &str) -> Option<i32> {
    use chrono::{Datelike, NaiveDate};

    let opening_date = NaiveDate::from_ymd_opt(2026, 7, 1)?;
    let birth_date = NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d").ok()?;
    let mut age = opening_date.year() - birth_date.year();

    if (birth_date.month(), birth_date.day()) > (opening_date.month(), opening_date.day()) {
        age -= 1;
    }

    Some(age)
}

fn is_opening_youth_candidate(player: &Player) -> bool {
    use domain::player::Position;

    player.position != Position::Goalkeeper
        && opening_player_age(&player.date_of_birth).is_some_and(|age| age <= OPENING_YOUTH_MAX_AGE)
}

fn sort_opening_youth_indices(players: &[Player], indices: &mut [usize]) {
    indices.sort_by(|left, right| {
        players[*right]
            .date_of_birth
            .cmp(&players[*left].date_of_birth)
            .then_with(|| players[*left].ovr.cmp(&players[*right].ovr))
    });
}

fn apply_opening_youth_assignments(players: &mut [Player], candidate_indices: Vec<usize>) -> usize {
    use domain::player::SquadRole;

    let mut assigned = 0;

    for index in candidate_indices
        .into_iter()
        .take(OPENING_YOUTH_ACADEMY_SIZE)
    {
        if players[index].squad_role != SquadRole::Youth {
            players[index].squad_role = SquadRole::Youth;
            assigned += 1;
        }
    }

    assigned
}

fn seed_opening_youth_academy(players: &mut [Player]) {
    let mut eligible_indices: Vec<usize> = players
        .iter()
        .enumerate()
        .filter(|(_, player)| is_opening_youth_candidate(player))
        .map(|(index, _)| index)
        .collect();

    sort_opening_youth_indices(players, &mut eligible_indices);
    apply_opening_youth_assignments(players, eligible_indices);
}

pub fn repair_opening_youth_academies(game: &mut crate::game::Game) -> bool {
    use chrono::Duration;
    use domain::player::SquadRole;

    if game
        .players
        .iter()
        .any(|player| player.squad_role == SquadRole::Youth)
    {
        return false;
    }

    if game.clock.current_date > game.clock.start_date + Duration::days(30) {
        return false;
    }

    let team_ids: Vec<String> = game.teams.iter().map(|team| team.id.clone()).collect();
    let mut repaired = false;

    for team_id in team_ids {
        let mut candidate_indices: Vec<usize> = game
            .players
            .iter()
            .enumerate()
            .filter(|(_, player)| player.team_id.as_deref() == Some(team_id.as_str()))
            .filter(|(_, player)| is_opening_youth_candidate(player))
            .map(|(index, _)| index)
            .collect();

        sort_opening_youth_indices(&game.players, &mut candidate_indices);
        repaired |= apply_opening_youth_assignments(&mut game.players, candidate_indices) > 0;
    }

    repaired
}

pub fn generate_youth_academy_recruit(team: &Team, target_position: Option<&Position>) -> Player {
    generate_youth_academy_recruit_with_nationality(team, target_position, None)
}

pub fn generate_youth_academy_recruit_with_nationality(
    team: &Team,
    target_position: Option<&Position>,
    nationality_override: Option<&str>,
) -> Player {
    use domain::player::SquadRole;

    let mut rng = rand::rng();
    let names_def = default_names_definition();
    let country_codes: Vec<String> = names_def.pools.keys().cloned().collect();
    let nationality = nationality_override
        .map(generation::canonicalize_generated_nationality)
        .unwrap_or_else(|| pick_nationality_from_def(&team.country, &country_codes, &mut rng));
    let youth_slots: &[usize] = match target_position.map(Position::to_group_position) {
        Some(Position::Defender) => &[8],
        Some(Position::Midfielder) => &[15],
        Some(Position::Forward) => &[21],
        _ => &[8, 15, 21],
    };
    let slot_index = youth_slots[rng.random_range(0..youth_slots.len())];
    let mut player = generate_random_player_from_def(
        &team.id,
        slot_index,
        &nationality,
        &names_def,
        PlayerGenerationQuality {
            reputation: team.reputation,
            domestic_tier: team.domestic_tier,
            current_strength: Some(team.youth_development),
            expected_squad_avg_ovr: Some((58 + team.youth_development / 5).clamp(58, 76)),
            expected_top_player_ovr: Some((66 + team.youth_development / 4).clamp(66, 88)),
            squad_depth: Some(team.youth_development),
        },
        &mut rng,
    );
    player.squad_role = SquadRole::Youth;
    player.transfer_listed = false;
    player.loan_listed = false;
    player
}

pub(super) fn centered_reputation(reputation_range: [u32; 2], rng: &mut impl rand::Rng) -> u32 {
    let center = (reputation_range[0] + reputation_range[1]) / 2;
    let jitter = if center >= 850 { 8 } else { 12 };
    let min = center.saturating_sub(jitter).max(reputation_range[0]);
    let max = (center + jitter).min(reputation_range[1]);
    rng.random_range(min..=max)
}

pub(super) fn centered_finance(finance_range: [i64; 2], rng: &mut impl rand::Rng) -> i64 {
    let center = finance_range[0] + (finance_range[1] - finance_range[0]) / 2;
    let jitter = ((center as f64) * 0.08).round() as i64;
    let min = center.saturating_sub(jitter).max(finance_range[0]);
    let max = (center + jitter).min(finance_range[1]);
    rng.random_range(min..=max)
}

fn adjust_player_attributes(player: &mut Player, delta: i16) {
    if delta == 0 {
        return;
    }

    let attrs = &mut player.attributes;
    attrs.pace = (attrs.pace as i16 + delta).clamp(1, 99) as u8;
    attrs.stamina = (attrs.stamina as i16 + delta).clamp(1, 99) as u8;
    attrs.strength = (attrs.strength as i16 + delta).clamp(1, 99) as u8;
    attrs.agility = (attrs.agility as i16 + delta).clamp(1, 99) as u8;
    attrs.passing = (attrs.passing as i16 + delta).clamp(1, 99) as u8;
    attrs.shooting = (attrs.shooting as i16 + delta).clamp(1, 99) as u8;
    attrs.tackling = (attrs.tackling as i16 + delta).clamp(1, 99) as u8;
    attrs.dribbling = (attrs.dribbling as i16 + delta).clamp(1, 99) as u8;
    attrs.defending = (attrs.defending as i16 + delta).clamp(1, 99) as u8;
    attrs.positioning = (attrs.positioning as i16 + delta).clamp(1, 99) as u8;
    attrs.vision = (attrs.vision as i16 + delta).clamp(1, 99) as u8;
    attrs.decisions = (attrs.decisions as i16 + delta).clamp(1, 99) as u8;
    attrs.composure = (attrs.composure as i16 + delta).clamp(1, 99) as u8;
    attrs.aggression = (attrs.aggression as i16 + delta / 2).clamp(1, 99) as u8;
    attrs.teamwork = (attrs.teamwork as i16 + delta).clamp(1, 99) as u8;
    attrs.leadership = (attrs.leadership as i16 + delta / 2).clamp(1, 99) as u8;
    attrs.handling = (attrs.handling as i16 + delta).clamp(1, 99) as u8;
    attrs.reflexes = (attrs.reflexes as i16 + delta).clamp(1, 99) as u8;
    attrs.aerial = (attrs.aerial as i16 + delta).clamp(1, 99) as u8;

    refresh_player_derived(player, 2026);
}

fn squad_avg_ovr(players: &[Player]) -> f64 {
    players.iter().map(|player| player.ovr as u32).sum::<u32>() as f64 / players.len().max(1) as f64
}

fn normalize_squad_ovr(players: &mut [Player], target_avg: Option<u8>, target_top: Option<u8>) {
    let Some(target_avg) = target_avg else {
        return;
    };
    let target_avg = target_avg.clamp(45, 90) as f64;

    for _ in 0..4 {
        let delta = (target_avg - squad_avg_ovr(players)).round() as i16;
        if delta.abs() <= 1 {
            break;
        }
        for player in players.iter_mut() {
            adjust_player_attributes(player, delta.clamp(-3, 3));
        }
    }

    if let Some(target_top) = target_top {
        if let Some(top_index) = players
            .iter()
            .enumerate()
            .max_by_key(|(_, player)| player.ovr)
            .map(|(index, _)| index)
        {
            for _ in 0..4 {
                let delta = target_top as i16 - players[top_index].ovr as i16;
                if delta.abs() <= 1 {
                    break;
                }
                adjust_player_attributes(&mut players[top_index], delta.clamp(-3, 3));
            }
        }
    }

    let delta = (target_avg - squad_avg_ovr(players)).round() as i16;
    if delta.abs() > 1 {
        for player in players.iter_mut() {
            adjust_player_attributes(player, delta.clamp(-2, 2));
        }
    }
}

pub(super) fn normalize_generated_team(
    team: &mut Team,
    players: &mut [Player],
    target_avg: Option<u8>,
    target_top: Option<u8>,
) {
    seed_opening_youth_academy(players);
    normalize_squad_ovr(players, target_avg, target_top);
    normalize_opening_contracts(players);

    let annual_wage_bill: i64 = players.iter().map(|player| player.wage as i64).sum();
    let weekly_wage_spend = (annual_wage_bill + 51) / 52;

    team.wage_budget = normalized_wage_budget(annual_wage_bill, team.reputation);
    team.finance = team
        .finance
        .max(weekly_wage_spend.saturating_mul(MIN_OPENING_RUNWAY_WEEKS));
}

// ---------------------------------------------------------------------------
// World generation
// ---------------------------------------------------------------------------

/// Generate a random world (raw tuple — used by `generate_world_data`).
///
/// `definitions`: optional pre-parsed definitions. Pass `None` to use the hardcoded fallbacks.
/// On native callers can read JSON from disk and call `parse_names_definition`/`parse_teams_definition`
/// before invoking this. On wasm32 the JSON is supplied by the host.
pub fn generate_world(
    definitions: Option<(NamesDefinition, TeamsDefinition)>,
) -> (Vec<domain::team::Team>, Vec<Player>, Vec<Staff>) {
    info!(
        "[generator] generate_world: custom_defs={}",
        definitions.is_some()
    );
    let mut rng = rand::rng();
    let mut teams_out = Vec::new();
    let mut players = Vec::new();
    let mut staff = Vec::new();

    let (names_def, teams_def) = definitions.unwrap_or_else(|| {
        debug!("[generator] using hardcoded default name and team definitions");
        (default_names_definition(), default_teams_definition())
    });

    let country_codes: Vec<String> = names_def.pools.keys().cloned().collect();

    for tdef in &teams_def.teams {
        let team_id = Uuid::new_v4().to_string();
        let short_name = if tdef.short_name.is_empty() {
            tdef.name
                .split_whitespace()
                .filter_map(|w| w.chars().next())
                .collect::<String>()
                .to_uppercase()
                .chars()
                .take(3)
                .collect()
        } else {
            tdef.short_name.clone()
        };
        let stadium = if tdef.stadium_name.is_empty() {
            format!("{} Arena", tdef.city)
        } else {
            tdef.stadium_name.clone()
        };

        let rep_range = tdef.reputation_range.unwrap_or([300, 900]);
        let fin_range = tdef.finance_range.unwrap_or([25_000_000, 350_000_000]);

        let mut team = domain::team::Team::new(
            team_id.clone(),
            tdef.name.clone(),
            short_name,
            tdef.country.clone(),
            tdef.city.clone(),
            stadium,
            tdef.stadium_capacity.unwrap_or_else(|| rng.random_range(10000..80000)),
        );
        team.domestic_tier = tdef.domestic_tier;
        team.finance = centered_finance(fin_range, &mut rng);
        team.reputation = centered_reputation(rep_range, &mut rng);
        team.youth_development = tdef.youth_development.unwrap_or(50).clamp(1, 100);
        team.recruitment_power = tdef.recruitment_power.unwrap_or(50).clamp(1, 100);
        team.tactical_level = tdef.tactical_level.unwrap_or(50).clamp(1, 100);
        team.volatility = tdef.volatility.unwrap_or(50).clamp(1, 100);
        team.facilities = Facilities {
            training: facility_level(team.youth_development),
            medical: facility_level((team.youth_development / 2).saturating_add(team.tactical_level / 2)),
            scouting: facility_level(team.recruitment_power),
        };
        team.tactical_familiarity = tactical_familiarity_from_level(team.tactical_level, team.volatility);
        team.wage_budget = (team.finance as f64 * 0.45) as i64;
        team.transfer_budget = (team.finance as f64 * 0.25) as i64;
        team.founded_year = rng.random_range(1880..1960);
        team.colors = TeamColors {
            primary: tdef.colors.primary.clone(),
            secondary: tdef.colors.secondary.clone(),
        };
        team.play_style = play_style_from_str(&tdef.play_style);
        team.formation = default_formation_for_team(&team.play_style, team.tactical_level, team.volatility);
        let team_player_start = players.len();

        // Generate 22 players
        for j in 0..22 {
            let nationality = pick_nationality_from_def(&tdef.country, &country_codes, &mut rng);
            let mut player = generate_random_player_from_def(
                &team_id,
                j,
                &nationality,
                &names_def,
                PlayerGenerationQuality {
                    reputation: team.reputation,
                    domestic_tier: team.domestic_tier,
                    current_strength: tdef.current_strength,
                    expected_squad_avg_ovr: tdef.expected_squad_avg_ovr,
                    expected_top_player_ovr: tdef.expected_top_player_ovr,
                    squad_depth: tdef.squad_depth,
                },
                &mut rng,
            );
            player.morale = opening_morale_from_context(
                team.reputation,
                tdef.current_strength,
                team.volatility,
                rng.random_range(0..100),
            );
            if rng.random_range(0..100) < 12 {
                player.transfer_listed = true;
            } else if rng.random_range(0..100) < 8 {
                player.loan_listed = true;
            }
            players.push(player);
        }

        // Assign shirt numbers: best player per position gets the iconic number.
        assign_squad_numbers(&mut players[team_player_start..]);

        // Generate 4 staff per team
        let roles = [
            StaffRole::AssistantManager,
            StaffRole::Coach,
            StaffRole::Scout,
            StaffRole::Physio,
        ];
        for role in &roles {
            let nationality = pick_nationality_from_def(&tdef.country, &country_codes, &mut rng);
            let s = generate_random_staff_from_def(
                &team_id,
                role.clone(),
                &nationality,
                &names_def,
                &mut rng,
            );
            staff.push(s);
        }

        normalize_generated_team(
            &mut team,
            &mut players[team_player_start..],
            tdef.expected_squad_avg_ovr,
            tdef.expected_top_player_ovr,
        );
        team.tactical_instructions = generated_tactical_instructions_for_team(
            &team,
            &players[team_player_start..],
        );
        teams_out.push(team);
    }

    // Generate free-agent staff
    let free_roles = [
        StaffRole::Coach,
        StaffRole::Scout,
        StaffRole::Physio,
        StaffRole::Coach,
        StaffRole::AssistantManager,
        StaffRole::Scout,
        StaffRole::Physio,
        StaffRole::Coach,
        StaffRole::Coach,
        StaffRole::Physio,
        StaffRole::Scout,
        StaffRole::AssistantManager,
    ];
    for role in &free_roles {
        let nat = &country_codes[rng.random_range(0..country_codes.len())];
        let s = generate_random_staff_unattached_from_def(role.clone(), nat, &names_def, &mut rng);
        staff.push(s);
    }

    info!(
        "[generator] world generated: {} teams, {} players, {} staff",
        teams_out.len(),
        players.len(),
        staff.len()
    );
    (teams_out, players, staff)
}

#[cfg(test)]
mod tests {
    use super::data::{NATIONALITY_POOLS, TEAM_TEMPLATES};
    use super::*;
    use domain::player::{Position, SquadRole};

    #[test]
    fn test_generate_world_team_count() {
        let (teams, players, staff) = generate_world(None);
        assert_eq!(teams.len(), 248);
        assert_eq!(players.len(), 248 * 22);
        assert_eq!(staff.len(), 248 * 4 + 12);
    }

    #[test]
    fn test_generate_world_has_multiple_league_ready_countries() {
        let (teams, _, _) = generate_world(None);
        let mut counts = std::collections::HashMap::<String, usize>::new();
        for team in &teams {
            *counts.entry(team.country.clone()).or_default() += 1;
        }

        let league_ready_countries = counts.values().filter(|count| **count >= 4).count();
        assert!(
            league_ready_countries >= 5,
            "expected at least five countries with four or more clubs, got {league_ready_countries}"
        );
    }

    #[test]
    fn test_generate_world_all_players_assigned() {
        let (teams, players, _) = generate_world(None);
        let team_ids: Vec<&str> = teams.iter().map(|t| t.id.as_str()).collect();
        for p in &players {
            assert!(p.team_id.is_some(), "Player {} has no team", p.full_name);
            assert!(
                team_ids.contains(&p.team_id.as_deref().unwrap()),
                "Player has unknown team"
            );
        }
    }

    #[test]
    fn test_generate_world_positions_per_team() {
        let (teams, players, _) = generate_world(None);
        for team in &teams {
            let team_players: Vec<_> = players
                .iter()
                .filter(|p| p.team_id.as_deref() == Some(&team.id))
                .collect();
            assert_eq!(team_players.len(), 22);
            let gk = team_players
                .iter()
                .filter(|p| p.position == Position::Goalkeeper)
                .count();
            assert!(gk >= 2, "Team {} has only {} GK", team.name, gk);
        }
    }

    #[test]
    fn test_generate_world_normalizes_opening_financials() {
        for _ in 0..8 {
            let (teams, players, _) = generate_world(None);
            for team in &teams {
                let annual_wages: i64 = players
                    .iter()
                    .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                    .map(|player| player.wage as i64)
                    .sum();
                let weekly_wage_spend = (annual_wages + 51) / 52;
                let usage_percent = (annual_wages * 100) / std::cmp::max(1, team.wage_budget);

                assert!(
                    annual_wages <= team.wage_budget,
                    "{} started over budget: wages={} budget={}",
                    team.name,
                    annual_wages,
                    team.wage_budget
                );
                assert!(
                    (90..=96).contains(&usage_percent),
                    "{} opened outside target wage band: {}%",
                    team.name,
                    usage_percent
                );
                assert!(
                    team.finance >= weekly_wage_spend * MIN_OPENING_RUNWAY_WEEKS,
                    "{} opened without the minimum wage runway",
                    team.name
                );
            }
        }
    }

    #[test]
    fn test_generate_world_seeds_opening_youth_academies() {
        let (teams, players, _) = generate_world(None);

        for team in &teams {
            let youth_players: Vec<_> = players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                .filter(|player| player.squad_role == SquadRole::Youth)
                .collect();

            assert_eq!(
                youth_players.len(),
                OPENING_YOUTH_ACADEMY_SIZE,
                "{} should open with {} youth academy players",
                team.name,
                OPENING_YOUTH_ACADEMY_SIZE
            );
            assert!(
                youth_players.iter().all(|player| {
                    opening_player_age(&player.date_of_birth)
                        .is_some_and(|age| age <= OPENING_YOUTH_MAX_AGE)
                }),
                "{} has an overage opening youth player",
                team.name
            );
            assert!(
                youth_players
                    .iter()
                    .all(|player| player.position != Position::Goalkeeper),
                "{} should keep opening youth players in outfield reserve slots",
                team.name
            );
        }
    }

    #[derive(Default)]
    struct AttributeAverages {
        count: u32,
        shooting: u32,
        passing: u32,
        vision: u32,
        defending: u32,
        tackling: u32,
        aerial: u32,
        handling: u32,
        reflexes: u32,
    }

    impl AttributeAverages {
        fn add(&mut self, player: &Player) {
            self.count += 1;
            self.shooting += player.attributes.shooting as u32;
            self.passing += player.attributes.passing as u32;
            self.vision += player.attributes.vision as u32;
            self.defending += player.attributes.defending as u32;
            self.tackling += player.attributes.tackling as u32;
            self.aerial += player.attributes.aerial as u32;
            self.handling += player.attributes.handling as u32;
            self.reflexes += player.attributes.reflexes as u32;
        }

        fn avg(&self, total: u32) -> f64 {
            total as f64 / self.count as f64
        }

        fn shooting(&self) -> f64 {
            self.avg(self.shooting)
        }

        fn passing(&self) -> f64 {
            self.avg(self.passing)
        }

        fn vision(&self) -> f64 {
            self.avg(self.vision)
        }

        fn defending(&self) -> f64 {
            self.avg(self.defending)
        }

        fn tackling(&self) -> f64 {
            self.avg(self.tackling)
        }

        fn aerial(&self) -> f64 {
            self.avg(self.aerial)
        }

        fn handling(&self) -> f64 {
            self.avg(self.handling)
        }

        fn reflexes(&self) -> f64 {
            self.avg(self.reflexes)
        }
    }

    #[test]
    fn test_generated_players_use_granular_positions() {
        let (_, players, _) = generate_world(None);
        let granular_count = players
            .iter()
            .filter(|player| !player.position.is_legacy_bucket())
            .count();

        assert!(granular_count > players.len() / 2);
        assert!(
            players
                .iter()
                .all(|player| player.natural_position == player.position)
        );
    }

    #[test]
    fn test_generated_players_reflect_team_quality_and_squad_roles() {
        let names_def = default_names_definition();
        let mut rng = rand::rng();
        let high_quality = PlayerGenerationQuality {
            reputation: 900,
            domestic_tier: Some(1),
            current_strength: Some(93),
            expected_squad_avg_ovr: Some(85),
            expected_top_player_ovr: Some(95),
            squad_depth: Some(93),
        };
        let low_quality = PlayerGenerationQuality {
            reputation: 300,
            domestic_tier: Some(4),
            current_strength: Some(55),
            expected_squad_avg_ovr: Some(64),
            expected_top_player_ovr: Some(70),
            squad_depth: Some(50),
        };

        let high_players = (0..22)
            .map(|index| {
                generate_random_player_from_def(
                    "high",
                    index,
                    "ENG",
                    &names_def,
                    high_quality,
                    &mut rng,
                )
            })
            .collect::<Vec<_>>();
        let low_players = (0..22)
            .map(|index| {
                generate_random_player_from_def(
                    "low",
                    index,
                    "ENG",
                    &names_def,
                    low_quality,
                    &mut rng,
                )
            })
            .collect::<Vec<_>>();

        let avg_ovr = |players: &[Player]| {
            players.iter().map(|player| player.ovr as u32).sum::<u32>() as f64 / players.len() as f64
        };
        let high_avg = avg_ovr(&high_players);
        let low_avg = avg_ovr(&low_players);
        assert!(
            high_avg > low_avg + 8.0,
            "high quality avg {high_avg} should exceed low quality avg {low_avg}"
        );

        let mut high_ovrs = high_players.iter().map(|player| player.ovr).collect::<Vec<_>>();
        high_ovrs.sort_unstable();
        let top_three = high_ovrs.iter().rev().take(3).map(|ovr| *ovr as u32).sum::<u32>() as f64 / 3.0;
        let bottom_three = high_ovrs.iter().take(3).map(|ovr| *ovr as u32).sum::<u32>() as f64 / 3.0;
        assert!(
            top_three > bottom_three + 8.0,
            "top squad band {top_three} should clear backup band {bottom_three}"
        );
    }

    #[test]
    fn test_default_world_uses_club_balancing_data() {
        let (teams, players, _) = generate_world(None);
        let team_by_name = |name: &str| {
            teams
                .iter()
                .find(|team| team.name == name)
                .unwrap_or_else(|| panic!("missing team {name}"))
        };
        let team_players = |team_id: &str| {
            players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team_id))
                .collect::<Vec<_>>()
        };
        let avg_ovr = |team_id: &str| {
            let team_players = team_players(team_id);
            team_players
                .iter()
                .map(|player| player.ovr as u32)
                .sum::<u32>() as f64
                / team_players.len() as f64
        };
        let top_ovr = |team_id: &str| {
            team_players(team_id)
                .iter()
                .map(|player| player.ovr)
                .max()
                .unwrap_or_default()
        };

        let arsenal = team_by_name("Arsenal");
        let manchester_city = team_by_name("Manchester City");
        let boulogne = team_by_name("Boulogne");
        let carrarese = team_by_name("Carrarese");

        assert!(arsenal.reputation >= 895, "Arsenal reputation should be elite");
        assert_eq!(arsenal.youth_development, 84);
        assert_eq!(arsenal.recruitment_power, 92);
        assert_eq!(arsenal.tactical_level, 91);
        assert_eq!(arsenal.volatility, 28);
        assert_eq!(arsenal.facilities.training, 4);
        assert_eq!(arsenal.facilities.scouting, 5);
        assert!(arsenal.tactical_familiarity >= 75);
        assert_eq!(arsenal.formation, "4-3-3");
        assert_ne!(manchester_city.formation, "4-4-2");
        assert!(manchester_city.reputation > boulogne.reputation + 550);
        assert!(arsenal.finance > boulogne.finance + 100_000_000);
        assert!(arsenal.recruitment_power > boulogne.recruitment_power + 35);
        assert!(arsenal.youth_development > carrarese.youth_development + 20);
        assert!((avg_ovr(&arsenal.id) - 85.0).abs() <= 2.0);
        assert!(top_ovr(&arsenal.id) >= 93);
        assert!((avg_ovr(&boulogne.id) - 64.0).abs() <= 2.0);
        assert!(avg_ovr(&arsenal.id) > avg_ovr(&boulogne.id) + 15.0);
        assert!(avg_ovr(&manchester_city.id) > avg_ovr(&carrarese.id) + 15.0);
    }

    #[test]
    fn test_default_world_tracks_expected_squad_targets() {
        let (_, teams_def) = (default_names_definition(), default_teams_definition());
        let (teams, players, _) = generate_world(None);

        for tdef in teams_def.teams.iter().filter(|team| team.expected_squad_avg_ovr.is_some()) {
            let team = teams
                .iter()
                .find(|team| team.name == tdef.name && team.country == tdef.country)
                .unwrap_or_else(|| panic!("missing generated team {}", tdef.name));
            let team_players = players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                .collect::<Vec<_>>();
            let avg_ovr = team_players
                .iter()
                .map(|player| player.ovr as u32)
                .sum::<u32>() as f64
                / team_players.len() as f64;
            let top_ovr = team_players
                .iter()
                .map(|player| player.ovr)
                .max()
                .unwrap_or_default();
            let target_avg = tdef.expected_squad_avg_ovr.unwrap() as f64;

            assert!(
                (avg_ovr - target_avg).abs() <= 2.5,
                "{} avg ovr {avg_ovr:.1} should track target {target_avg:.1}",
                team.name
            );
            if let Some(target_top) = tdef.expected_top_player_ovr {
                assert!(
                    top_ovr + 3 >= target_top,
                    "{} top ovr {top_ovr} should track target {target_top}",
                    team.name
                );
            }
        }
    }

    #[test]
    fn test_generated_world_assigns_varied_tactical_instructions() {
        let (teams, _, _) = generate_world(None);
        let profile_key = |team: &Team| {
            let instructions = team.tactical_instructions;
            format!(
                "{}-{}-{}-{}-{}-{}",
                (instructions.pressing_intensity * 20.0).round() as u8,
                (instructions.defensive_line * 20.0).round() as u8,
                (instructions.tempo * 20.0).round() as u8,
                (instructions.width * 20.0).round() as u8,
                (instructions.passing_directness * 20.0).round() as u8,
                (instructions.risk_appetite * 20.0).round() as u8,
            )
        };
        let unique_profiles = teams
            .iter()
            .map(profile_key)
            .collect::<std::collections::HashSet<_>>();
        let high_press = teams
            .iter()
            .find(|team| matches!(team.play_style, PlayStyle::HighPress))
            .expect("high press team");
        let defensive = teams
            .iter()
            .find(|team| matches!(team.play_style, PlayStyle::Defensive))
            .expect("defensive team");
        let possession = teams
            .iter()
            .find(|team| matches!(team.play_style, PlayStyle::Possession))
            .expect("possession team");

        assert!(unique_profiles.len() >= 8, "expected varied tactical profiles");
        assert!(high_press.tactical_instructions.pressing_intensity > defensive.tactical_instructions.pressing_intensity + 0.25);
        assert!(high_press.tactical_instructions.defensive_line > defensive.tactical_instructions.defensive_line + 0.25);
        assert!(possession.tactical_instructions.passing_directness < defensive.tactical_instructions.passing_directness + 0.05);
        assert!(possession.tactical_instructions.passing_directness < high_press.tactical_instructions.passing_directness);
    }

    #[test]
    fn test_generated_players_have_position_archetypes() {
        let (_, players, _) = generate_world(None);
        let mut by_group = std::collections::HashMap::<Position, AttributeAverages>::new();

        for player in &players {
            by_group
                .entry(player.position.to_group_position())
                .or_default()
                .add(player);
        }

        let gk = by_group.get(&Position::Goalkeeper).expect("goalkeepers");
        let def = by_group.get(&Position::Defender).expect("defenders");
        let mid = by_group.get(&Position::Midfielder).expect("midfielders");
        let fwd = by_group.get(&Position::Forward).expect("forwards");

        assert!(fwd.shooting() > mid.shooting());
        assert!(mid.shooting() > def.shooting());
        assert!(mid.passing() > def.passing());
        assert!(mid.passing() > fwd.passing());
        assert!(mid.vision() > def.vision());
        assert!(mid.vision() > fwd.vision());
        assert!(def.defending() > mid.defending());
        assert!(def.defending() > fwd.defending());
        assert!(def.tackling() > mid.tackling());
        assert!(def.tackling() > fwd.tackling());
        assert!(def.aerial() > mid.aerial());
        assert!(def.aerial() > fwd.aerial());
        assert!(gk.handling() > def.handling() + 35.0);
        assert!(gk.reflexes() > mid.reflexes() + 35.0);
    }

    #[test]
    fn test_generate_world_limits_immediate_contract_pressure() {
        for _ in 0..8 {
            let (teams, players, _) = generate_world(None);
            for team in &teams {
                let expiring_contracts = players
                    .iter()
                    .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                    .filter(|player| {
                        player.contract_end.as_deref() == Some(OPENING_SHORT_CONTRACT_END)
                    })
                    .count();

                assert!(
                    expiring_contracts <= MAX_OPENING_EXPIRING_CONTRACTS,
                    "{} started with {} immediate renewal cases",
                    team.name,
                    expiring_contracts
                );
            }
        }
    }

    #[test]
    fn test_pick_name_from_def() {
        let mut rng = rand::rng();
        let names_def = default_names_definition();
        // Known nationality (ISO alpha-2)
        let (first, last) = pick_name_from_def("ES", &names_def, &mut rng);
        assert!(!first.is_empty());
        assert!(!last.is_empty());
        // Football identity falls back to GB pool if a dedicated pool does not exist yet.
        let (eng_first, eng_last) = pick_name_from_def("ENG", &names_def, &mut rng);
        assert!(!eng_first.is_empty());
        assert!(!eng_last.is_empty());
        // Unknown code falls back to any pool
        let (first2, last2) = pick_name_from_def("ZZ", &names_def, &mut rng);
        assert!(!first2.is_empty());
        assert!(!last2.is_empty());
    }

    #[test]
    fn test_pick_nationality_weighted() {
        let mut rng = rand::rng();
        let codes: Vec<String> = NATIONALITY_POOLS
            .iter()
            .map(|p| p.nationality.to_string())
            .collect();
        let mut eng_count = 0;
        for _ in 0..100 {
            let nat = pick_nationality_from_def("England", &codes, &mut rng);
            if nat == "ENG" {
                eng_count += 1;
            }
        }
        assert!(
            eng_count > 30,
            "ENG players should be weighted: got {}/100",
            eng_count
        );
    }

    #[test]
    fn test_pick_nationality_defaults_generated_gb_to_eng() {
        let mut rng = rand::rng();
        let codes = vec!["GB".to_string()];

        for _ in 0..100 {
            let nat = pick_nationality_from_def("Spain", &codes, &mut rng);
            assert!(nat == "ES" || nat == "ENG", "unexpected nationality: {nat}");
            assert_ne!(nat, "GB");
        }
    }

    #[test]
    fn test_youth_recruit_override_defaults_gb_to_eng() {
        let team = domain::team::Team::new(
            "team-1".to_string(),
            "London FC".to_string(),
            "LON".to_string(),
            "England".to_string(),
            "London".to_string(),
            "Ground".to_string(),
            20000,
        );

        let player = generate_youth_academy_recruit_with_nationality(&team, None, Some("GB"));

        assert_eq!(player.nationality, "ENG");
        assert_eq!(player.football_nation, "ENG");
    }

    #[test]
    fn test_all_nationalities_use_short_uppercase_codes() {
        let (_, players, staff) = generate_world(None);
        for p in &players {
            assert_eq!(
                p.nationality.len() == 2 || p.nationality.len() == 3,
                true,
                "Player {} has invalid nationality code: {}",
                p.full_name,
                p.nationality
            );
            assert!(
                p.nationality.chars().all(|c| c.is_ascii_uppercase()),
                "Player {} nationality not uppercase: {}",
                p.full_name,
                p.nationality
            );
        }
        for s in &staff {
            assert_eq!(
                s.nationality.len() == 2 || s.nationality.len() == 3,
                true,
                "Staff {} has invalid nationality code: {}",
                s.first_name,
                s.nationality
            );
        }
    }

    #[test]
    fn test_team_templates_have_unique_names() {
        let names: Vec<&str> = TEAM_TEMPLATES.iter().map(|t| t.name).collect();
        let unique: std::collections::HashSet<&str> = names.iter().cloned().collect();
        assert_eq!(names.len(), unique.len(), "Duplicate team names found");
    }

    #[test]
    fn test_world_data_wrapper() {
        let world = generate_world_data(None);
        assert_eq!(world.teams.len(), 248);
        assert!(!world.name.is_empty());
        assert!(!world.description.is_empty());
    }

    #[test]
    fn test_definition_file_roundtrip() {
        let names_def = default_names_definition();
        let json = serde_json::to_string(&names_def).unwrap();
        let parsed: NamesDefinition = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.pools.len(), names_def.pools.len());

        let teams_def = default_teams_definition();
        let json2 = serde_json::to_string(&teams_def).unwrap();
        let parsed2: TeamsDefinition = serde_json::from_str(&json2).unwrap();
        assert_eq!(parsed2.teams.len(), teams_def.teams.len());
    }

    #[test]
    fn test_default_names_include_british_home_nation_pools() {
        let names_def = default_names_definition();

        for code in ["ENG", "SCO", "WAL", "NIR", "IE", "GB"] {
            let pool = names_def
                .pools
                .get(code)
                .unwrap_or_else(|| panic!("missing pool {code}"));
            assert!(
                !pool.first_names.is_empty(),
                "pool {code} should have first names"
            );
            assert!(
                !pool.last_names.is_empty(),
                "pool {code} should have last names"
            );
        }
    }
}
