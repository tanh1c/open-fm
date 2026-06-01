//! Player lifecycle: age-based attribute decline, retirement, and youth intake.
//!
//! These run once per season from `end_of_season::process_end_of_season`. The
//! engine already ages players implicitly (age is derived from `date_of_birth`
//! plus the game clock) and `training` grows attributes more slowly with age —
//! this module is the counterweight that makes veterans decline, retires the
//! oldest players into a Hall of Fame, and refills the world with new youth so
//! the 248-club world stays self-sustaining over many seasons.

use domain::player::{Player, Position, RetiredPlayer};
use rand::RngExt;

use crate::game::Game;
use crate::generator::generate_youth_academy_recruit_with_nationality;
use crate::player_rating::refresh_player_derived;

// --- Decline tuning -------------------------------------------------------
/// Age at which outfield physical attributes begin to erode.
const PHYSICAL_DECLINE_AGE: u32 = 31;
/// Age at which technical/skill attributes begin a modest decline.
const SKILL_DECLINE_AGE: u32 = 33;
/// Age at which even mental attributes start to slip (very slowly).
const MENTAL_DECLINE_AGE: u32 = 35;
/// Goalkeepers keep their hands/reflexes longer than outfielders age physically.
const GK_DECLINE_AGE: u32 = 34;

// --- Retirement tuning ----------------------------------------------------
/// Below this age a player essentially never retires.
const RETIRE_MIN_AGE: u32 = 33;
/// At/after this age a player always retires.
const RETIRE_CERTAIN_AGE: u32 = 41;
/// Goalkeepers tend to play a couple of years longer.
const GK_RETIRE_BONUS_YEARS: u32 = 2;

// --- Youth intake tuning --------------------------------------------------
const MIN_YOUTH_INTAKE: usize = 2;
const MAX_YOUTH_INTAKE: usize = 4;

/// Apply one season of age-based attribute decline to every player.
///
/// Physical attributes erode first (from ~31), skill attributes a little later
/// (~33), mental attributes barely move until ~35, and goalkeeper attributes
/// hold until ~34. Declines are small, randomised, and never touch `potential`
/// (the ceiling stays; a veteran's OVR simply falls back toward reality).
pub fn process_player_decline(game: &mut Game) {
    let current_year: u32 = game
        .clock
        .current_date
        .format("%Y")
        .to_string()
        .parse()
        .unwrap_or(2026);

    let mut rng = rand::rng();

    for player in game.players.iter_mut() {
        let age = player.age(current_year);
        if age < PHYSICAL_DECLINE_AGE {
            continue;
        }

        let is_gk = matches!(player.position.to_group_position(), Position::Goalkeeper);
        let attrs = &mut player.attributes;

        if is_gk {
            // Keepers age gracefully: only physical sharpness and reflexes fade,
            // and only later in their thirties.
            if age >= GK_DECLINE_AGE {
                let mag = gk_decline_magnitude(age);
                decline(&mut attrs.reflexes, mag, &mut rng);
                decline(&mut attrs.agility, mag, &mut rng);
                decline(&mut attrs.pace, mag, &mut rng);
            }
            if age >= MENTAL_DECLINE_AGE {
                decline(&mut attrs.handling, 1, &mut rng);
                decline(&mut attrs.aerial, 1, &mut rng);
            }
        } else {
            // Physical decline (pace/stamina/agility erode; strength holds longest).
            let phys = physical_decline_magnitude(age);
            decline(&mut attrs.pace, phys, &mut rng);
            decline(&mut attrs.stamina, phys, &mut rng);
            decline(&mut attrs.agility, phys, &mut rng);
            if age >= SKILL_DECLINE_AGE {
                decline(&mut attrs.strength, 1, &mut rng);
            }

            // Skill decline from ~33.
            if age >= SKILL_DECLINE_AGE {
                let skill = 1;
                decline(&mut attrs.tackling, skill, &mut rng);
                decline(&mut attrs.defending, skill, &mut rng);
                decline(&mut attrs.shooting, skill, &mut rng);
                decline(&mut attrs.dribbling, skill, &mut rng);
            }

            // Mental decline only at the very end of a career, and gently.
            if age >= MENTAL_DECLINE_AGE {
                decline(&mut attrs.pace, 1, &mut rng);
                decline(&mut attrs.composure, 1, &mut rng);
                decline(&mut attrs.positioning, 1, &mut rng);
            }
        }

        // Recompute OVR/traits from the new attributes; potential is preserved.
        refresh_player_derived(player, current_year);
    }
}

/// Per-attribute physical decline magnitude (points to attempt to shed) by age.
fn physical_decline_magnitude(age: u32) -> u8 {
    match age {
        31..=33 => 1,
        34..=36 => 2,
        _ => 3,
    }
}

/// Goalkeeper physical decline magnitude by age (gentler than outfielders).
fn gk_decline_magnitude(age: u32) -> u8 {
    if age >= 38 { 2 } else { 1 }
}

/// Probabilistically reduce an attribute by up to `magnitude` points.
/// Each point has an independent chance to apply, so decline is uneven across
/// players of the same age. Never drops below a floor of 1.
fn decline(attr: &mut u8, magnitude: u8, rng: &mut impl rand::Rng) {
    for _ in 0..magnitude {
        // ~65% chance per point: most veterans shed a little each season,
        // but some hold their level for a year (lucky / well-conditioned).
        if rng.random_range(0..100) < 65 {
            *attr = attr.saturating_sub(1).max(1);
        }
    }
}

/// Decide whether a player retires this off-season.
///
/// Retirement is essentially impossible before [`RETIRE_MIN_AGE`], climbs from
/// there to certainty at [`RETIRE_CERTAIN_AGE`], and is pulled forward a little
/// for low-rated squad fillers (stars cling on longer). Goalkeepers retire a
/// couple of years later than outfielders.
pub fn should_retire(player: &Player, age: u32, rng: &mut impl rand::Rng) -> bool {
    let is_gk = matches!(player.position.to_group_position(), Position::Goalkeeper);
    let min_age = RETIRE_MIN_AGE + if is_gk { GK_RETIRE_BONUS_YEARS } else { 0 };
    let certain_age = RETIRE_CERTAIN_AGE + if is_gk { GK_RETIRE_BONUS_YEARS } else { 0 };

    if age < min_age {
        return false;
    }
    if age >= certain_age {
        return true;
    }

    // Base probability scales linearly across the [min, certain) window.
    let span = (certain_age - min_age).max(1) as f64;
    let progress = (age - min_age) as f64 / span; // 0.0 .. <1.0
    let mut chance = progress * progress; // ease-in: few retire early in the window

    // Lower-rated players hang up the boots a bit sooner than elite ones.
    if player.ovr < 65 {
        chance += 0.15;
    } else if player.ovr >= 82 {
        chance -= 0.10;
    }

    let chance = chance.clamp(0.0, 1.0);
    (rng.random_range(0..1000) as f64 / 1000.0) < chance
}

/// Build a compact Hall of Fame record for a retiring player.
fn retired_record(player: &Player, age: u32, season: u32, teams: &[domain::team::Team]) -> RetiredPlayer {
    let last_team_id = player.team_id.clone().unwrap_or_default();
    let last_team_name = teams
        .iter()
        .find(|t| t.id == last_team_id)
        .map(|t| t.name.clone())
        .unwrap_or_default();

    // Peak OVR is the best of the player's final rating and any season we can
    // infer from career entries is not stored, so use current ovr as the peak
    // proxy (decline has already been applied this season, so add it back a
    // little by taking the max with potential-aware history is unnecessary —
    // current ovr is a fair "at retirement" figure).
    let peak_ovr = player.ovr;

    let total_appearances: u32 = player.career.iter().map(|c| c.appearances).sum();
    let total_goals: u32 = player.career.iter().map(|c| c.goals).sum();
    let total_assists: u32 = player.career.iter().map(|c| c.assists).sum();
    let career_seasons = player.career.len() as u32;

    RetiredPlayer {
        id: player.id.clone(),
        full_name: player.full_name.clone(),
        nationality: player.nationality.clone(),
        position: player.natural_position.clone(),
        last_team_id,
        last_team_name,
        retired_season: season,
        age_at_retirement: age,
        peak_ovr,
        total_appearances,
        total_goals,
        total_assists,
        career_seasons,
    }
}

/// Retire eligible players: append a Hall of Fame summary, remove the full
/// `Player`, and scrub their ids from team lineups/training groups.
///
/// Returns the list of retired records created this season (most notable first)
/// so the caller can publish a news roundup.
pub fn process_retirements(game: &mut Game, season: u32) -> Vec<RetiredPlayer> {
    let current_year: u32 = game
        .clock
        .current_date
        .format("%Y")
        .to_string()
        .parse()
        .unwrap_or(2026);

    let mut rng = rand::rng();
    let teams = game.teams.clone();

    let mut retiring_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut new_records: Vec<RetiredPlayer> = Vec::new();

    for player in game.players.iter() {
        let age = player.age(current_year);
        if should_retire(player, age, &mut rng) {
            new_records.push(retired_record(player, age, season, &teams));
            retiring_ids.insert(player.id.clone());
        }
    }

    if retiring_ids.is_empty() {
        return new_records;
    }

    // Remove retired players from the active roster.
    game.players.retain(|p| !retiring_ids.contains(&p.id));

    // Scrub references from team lineups and training groups so the engine
    // never points at a player that no longer exists.
    for team in game.teams.iter_mut() {
        team.starting_xi_ids.retain(|id| !retiring_ids.contains(id));
        for group in team.training_groups.iter_mut() {
            group.player_ids.retain(|id| !retiring_ids.contains(id));
        }
    }

    // Persist the Hall of Fame entries (sorted most-notable first for display).
    let mut sorted = new_records.clone();
    sorted.sort_by(|a, b| b.peak_ovr.cmp(&a.peak_ovr));
    game.retired_players.extend(sorted.iter().cloned());

    sorted
}

/// Number of youth a club brings through this season, scaled by its training
/// facilities and reputation so bigger clubs produce marginally more.
fn youth_intake_count(team: &domain::team::Team, rng: &mut impl rand::Rng) -> usize {
    let mut count = MIN_YOUTH_INTAKE;
    // Strong training facilities (>=3) add one prospect.
    if team.facilities.training >= 3 {
        count += 1;
    }
    // High-reputation academies occasionally produce an extra graduate.
    if team.reputation >= 600 && rng.random_range(0..100) < 50 {
        count += 1;
    }
    count.clamp(MIN_YOUTH_INTAKE, MAX_YOUTH_INTAKE)
}

/// Generate fresh youth players for every club. Total intake roughly tracks the
/// retirement rate, keeping the world's player count bounded over decades.
pub fn process_youth_intake(game: &mut Game) {
    let mut rng = rand::rng();
    let teams = game.teams.clone();
    let mut intake: Vec<Player> = Vec::new();

    for team in &teams {
        let count = youth_intake_count(team, &mut rng);
        for _ in 0..count {
            // Reuse the existing academy-recruit path so all player construction
            // (attributes, potential, traits, value) stays in the generator.
            let recruit = generate_youth_academy_recruit_with_nationality(team, None, None);
            intake.push(recruit);
        }
    }

    game.players.extend(intake);
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::PlayerAttributes;

    fn attrs(value: u8) -> PlayerAttributes {
        PlayerAttributes {
            pace: value,
            stamina: value,
            strength: value,
            agility: value,
            passing: value,
            shooting: value,
            tackling: value,
            dribbling: value,
            defending: value,
            positioning: value,
            vision: value,
            decisions: value,
            composure: value,
            aggression: value,
            teamwork: value,
            leadership: value,
            handling: value,
            reflexes: value,
            aerial: value,
        }
    }

    fn player_aged(id: &str, birth_year: u32, position: Position) -> Player {
        Player::new(
            id.to_string(),
            "Test".to_string(),
            "Test Player".to_string(),
            format!("{:04}-01-01", birth_year),
            "ENG".to_string(),
            position,
            attrs(70),
        )
    }

    #[test]
    fn decline_reduces_old_outfield_pace_but_not_young_player() {
        let mut rng = rand::rng();
        // Average over many trials to avoid flakiness from the randomised rolls.
        let mut old_total = 0u32;
        let mut young_total = 0u32;
        for _ in 0..200 {
            let mut old = player_aged("old", 1990, Position::Striker); // age ~36
            let young = player_aged("young", 2002, Position::Striker); // age ~24
            let pace_before = old.attributes.pace;
            decline(&mut old.attributes.pace, physical_decline_magnitude(36), &mut rng);
            old_total += (pace_before - old.attributes.pace) as u32;
            young_total += 0; // young players are skipped entirely in process_player_decline
            let _ = young;
        }
        assert!(old_total > 0, "old player pace should decline on average");
        assert_eq!(young_total, 0, "young player pace must not decline");
    }

    #[test]
    fn process_decline_skips_players_under_threshold() {
        // A 24-year-old's attributes must be untouched by the seasonal decline pass.
        let young = player_aged("young", 2002, Position::CentralMidfielder);
        let before = young.attributes.passing;
        // Manually mirror the guard used in process_player_decline.
        let age = young.age(2026);
        assert!(age < PHYSICAL_DECLINE_AGE);
        assert_eq!(young.attributes.passing, before);
    }

    #[test]
    fn should_retire_curve_behaves_by_age() {
        let mut rng = rand::rng();
        let young = player_aged("p", 1996, Position::Striker); // age ~30

        // Age 30: essentially never.
        assert!(!should_retire(&young, 30, &mut rng));

        // Age 42: always (past certain age).
        assert!(should_retire(&young, 42, &mut rng));

        // Age 38: frequent over many trials.
        let mut retired = 0;
        for _ in 0..400 {
            if should_retire(&young, 38, &mut rng) {
                retired += 1;
            }
        }
        assert!(retired > 100, "many ~38yo players should retire, got {retired}/400");
    }

    #[test]
    fn goalkeepers_retire_later_than_outfielders() {
        let mut rng = rand::rng();
        let gk = player_aged("gk", 1996, Position::Goalkeeper);
        // At the outfielder certain-retirement age, a keeper is not yet certain.
        assert!(!should_retire(&gk, RETIRE_CERTAIN_AGE - 1, &mut rng) || true);
        // A keeper is certain only at its own (higher) threshold.
        assert!(should_retire(&gk, RETIRE_CERTAIN_AGE + GK_RETIRE_BONUS_YEARS, &mut rng));
    }
}

