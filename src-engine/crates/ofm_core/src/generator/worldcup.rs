//! World Cup 2026 generator — 48 national teams, 26 players each.
//!
//! Generates a self-contained international tournament world:
//! - 48 national teams with relative strength ratings
//! - 26 players per team (all with matching nationality)
//! - Minimal staff per team
//! - No club concepts (no contracts, market values, domestic tiers, finances)

use domain::player::{Player, Position};
use domain::staff::{Staff, StaffRole};
use domain::team::Team;
use rand::RngExt;
use uuid::Uuid;

use super::definitions::NamesDefinition;
use super::generation::{
    canonicalize_generated_nationality,
    generate_random_staff_from_def, pick_name_from_def, play_style_from_str,
    PlayerGenerationQuality,
};
use super::{assign_squad_numbers, default_formation_for_team, default_names_definition};

const SQUAD_SIZE: usize = 26;

/// A national team participating in the World Cup 2026.
struct NationalTeamDef {
    name: &'static str,
    iso_code: &'static str,
    confederation: &'static str,
    /// 0-100 strength rating. Drives OVR distribution: top player ≈ strength,
    /// squad average ≈ strength - 8.
    strength: u8,
    play_style: &'static str,
}

/// 48 qualified teams for FIFA World Cup 2026.
///
/// Strengths are rough relative rankings: elite contenders 88-94, strong 82-87,
/// competitive 75-81, developing 65-74, minnows 55-64.
const WORLD_CUP_TEAMS: &[NationalTeamDef] = &[
    // ── AFC ──
    NationalTeamDef { name: "Australia",                  iso_code: "AU",  confederation: "AFC",      strength: 73, play_style: "Balanced" },
    NationalTeamDef { name: "Iran",                       iso_code: "IR",  confederation: "AFC",      strength: 74, play_style: "Defensive" },
    NationalTeamDef { name: "Iraq",                       iso_code: "IQ",  confederation: "AFC",      strength: 67, play_style: "Counter" },
    NationalTeamDef { name: "Japan",                      iso_code: "JP",  confederation: "AFC",      strength: 81, play_style: "Possession" },
    NationalTeamDef { name: "Jordan",                     iso_code: "JO",  confederation: "AFC",      strength: 64, play_style: "Counter" },
    NationalTeamDef { name: "Korea Republic",             iso_code: "KR",  confederation: "AFC",      strength: 79, play_style: "HighPress" },
    NationalTeamDef { name: "Saudi Arabia",               iso_code: "SA",  confederation: "AFC",      strength: 72, play_style: "Balanced" },
    NationalTeamDef { name: "Qatar",                      iso_code: "QA",  confederation: "AFC",      strength: 68, play_style: "Balanced" },
    NationalTeamDef { name: "Uzbekistan",                 iso_code: "UZ",  confederation: "AFC",      strength: 68, play_style: "Balanced" },
    // ── CAF ──
    NationalTeamDef { name: "Algeria",                    iso_code: "DZ",  confederation: "CAF",      strength: 74, play_style: "Balanced" },
    NationalTeamDef { name: "Côte d'Ivoire",              iso_code: "CI",  confederation: "CAF",      strength: 76, play_style: "Attacking" },
    NationalTeamDef { name: "Cabo Verde",                 iso_code: "CV",  confederation: "CAF",      strength: 66, play_style: "Counter" },
    NationalTeamDef { name: "Congo DR",                   iso_code: "CD",  confederation: "CAF",      strength: 70, play_style: "Counter" },
    NationalTeamDef { name: "Egypt",                      iso_code: "EG",  confederation: "CAF",      strength: 75, play_style: "Defensive" },
    NationalTeamDef { name: "Ghana",                      iso_code: "GH",  confederation: "CAF",      strength: 73, play_style: "Balanced" },
    NationalTeamDef { name: "Morocco",                    iso_code: "MA",  confederation: "CAF",      strength: 83, play_style: "Counter" },
    NationalTeamDef { name: "South Africa",               iso_code: "ZA",  confederation: "CAF",      strength: 68, play_style: "Balanced" },
    NationalTeamDef { name: "Senegal",                    iso_code: "SN",  confederation: "CAF",      strength: 79, play_style: "Balanced" },
    NationalTeamDef { name: "Tunisia",                    iso_code: "TN",  confederation: "CAF",      strength: 72, play_style: "Defensive" },
    // ── CONCACAF ──
    NationalTeamDef { name: "Canada",                     iso_code: "CA",  confederation: "CONCACAF", strength: 76, play_style: "Counter" },
    NationalTeamDef { name: "United States",              iso_code: "US",  confederation: "CONCACAF", strength: 82, play_style: "Balanced" },
    NationalTeamDef { name: "Mexico",                     iso_code: "MX",  confederation: "CONCACAF", strength: 80, play_style: "Attacking" },
    NationalTeamDef { name: "Curaçao",                    iso_code: "CW",  confederation: "CONCACAF", strength: 65, play_style: "Counter" },
    NationalTeamDef { name: "Haiti",                      iso_code: "HT",  confederation: "CONCACAF", strength: 64, play_style: "Counter" },
    NationalTeamDef { name: "Panama",                     iso_code: "PA",  confederation: "CONCACAF", strength: 69, play_style: "Balanced" },
    // ── CONMEBOL ──
    NationalTeamDef { name: "Argentina",                  iso_code: "AR",  confederation: "CONMEBOL", strength: 94, play_style: "Possession" },
    NationalTeamDef { name: "Brazil",                     iso_code: "BR",  confederation: "CONMEBOL", strength: 93, play_style: "Attacking" },
    NationalTeamDef { name: "Colombia",                   iso_code: "CO",  confederation: "CONMEBOL", strength: 80, play_style: "Balanced" },
    NationalTeamDef { name: "Ecuador",                    iso_code: "EC",  confederation: "CONMEBOL", strength: 74, play_style: "Counter" },
    NationalTeamDef { name: "Paraguay",                   iso_code: "PY",  confederation: "CONMEBOL", strength: 72, play_style: "Defensive" },
    NationalTeamDef { name: "Uruguay",                    iso_code: "UY",  confederation: "CONMEBOL", strength: 82, play_style: "Defensive" },
    // ── UEFA ──
    NationalTeamDef { name: "Austria",                    iso_code: "AT",  confederation: "UEFA",     strength: 77, play_style: "HighPress" },
    NationalTeamDef { name: "Belgium",                    iso_code: "BE",  confederation: "UEFA",     strength: 83, play_style: "Balanced" },
    NationalTeamDef { name: "Bosnia and Herzegovina",     iso_code: "BA",  confederation: "UEFA",     strength: 70, play_style: "Counter" },
    NationalTeamDef { name: "Croatia",                    iso_code: "HR",  confederation: "UEFA",     strength: 82, play_style: "Balanced" },
    NationalTeamDef { name: "Czechia",                    iso_code: "CZ",  confederation: "UEFA",     strength: 74, play_style: "Balanced" },
    NationalTeamDef { name: "England",                    iso_code: "ENG", confederation: "UEFA",     strength: 90, play_style: "Attacking" },
    NationalTeamDef { name: "France",                     iso_code: "FR",  confederation: "UEFA",     strength: 92, play_style: "Attacking" },
    NationalTeamDef { name: "Germany",                    iso_code: "DE",  confederation: "UEFA",     strength: 86, play_style: "HighPress" },
    NationalTeamDef { name: "Netherlands",                iso_code: "NL",  confederation: "UEFA",     strength: 84, play_style: "Attacking" },
    NationalTeamDef { name: "Norway",                     iso_code: "NO",  confederation: "UEFA",     strength: 78, play_style: "Balanced" },
    NationalTeamDef { name: "Portugal",                   iso_code: "PT",  confederation: "UEFA",     strength: 87, play_style: "Possession" },
    NationalTeamDef { name: "Scotland",                   iso_code: "SCO", confederation: "UEFA",     strength: 74, play_style: "Balanced" },
    NationalTeamDef { name: "Spain",                      iso_code: "ES",  confederation: "UEFA",     strength: 89, play_style: "Possession" },
    NationalTeamDef { name: "Sweden",                     iso_code: "SE",  confederation: "UEFA",     strength: 76, play_style: "Balanced" },
    NationalTeamDef { name: "Switzerland",                iso_code: "CH",  confederation: "UEFA",     strength: 78, play_style: "Defensive" },
    NationalTeamDef { name: "Türkiye",                    iso_code: "TR",  confederation: "UEFA",     strength: 76, play_style: "Attacking" },
    // ── OFC ──
    NationalTeamDef { name: "New Zealand",                iso_code: "NZ",  confederation: "OFC",      strength: 66, play_style: "Balanced" },
];

/// Generate a full World Cup 2026 world: 48 national teams, 26 players each, minimal staff.
pub fn generate_worldcup_world() -> Result<(Vec<Team>, Vec<Player>, Vec<Staff>), String> {
    let mut rng = rand::rng();
    let names_def = default_names_definition();

    let mut teams_out = Vec::with_capacity(48);
    let mut players = Vec::with_capacity(48 * SQUAD_SIZE);
    let mut staff = Vec::new();

    for team_def in WORLD_CUP_TEAMS {
        let team_id = format!("wc26-{}-{}", team_def.confederation.to_lowercase(), team_def.iso_code.to_lowercase());

        let mut team = Team::new(
            team_id.clone(),
            team_def.name.to_string(),
            team_def.name.to_string(),
            team_def.iso_code.to_string(),
            team_def.name.to_string(), // city = country name for national teams
            format!("{} National Stadium", team_def.name),
            60000 + rng.random_range(0..40000),
        );
        team.play_style = play_style_from_str(team_def.play_style);
        team.formation = default_formation_for_team(&team.play_style, 65, 50);
        team.domestic_tier = None;
        team.reputation = (team_def.strength as u32 * 10).min(1000);
        // National teams have no finances
        team.finance = 0;
        team.wage_budget = 0;
        team.transfer_budget = 0;

        let team_player_start = players.len();

        // Generate 26 players for this national team
        generate_national_squad(
            &team_id,
            team_def,
            &names_def,
            None, // no target avg; strength drives quality directly
            &mut rng,
            &mut players,
        );

        assign_squad_numbers(&mut players[team_player_start..]);

        // Minimal staff: just 1 assistant manager (national-team coach)
        let staff_nat = canonicalize_generated_nationality(team_def.iso_code);
        staff.push(generate_random_staff_from_def(
            &team_id,
            StaffRole::AssistantManager,
            &staff_nat,
            &names_def,
            &mut rng,
        ));

        teams_out.push(team);
    }

    Ok((teams_out, players, staff))
}

fn national_quality_for_team(strength: u8) -> PlayerGenerationQuality {
    let strength = strength.clamp(45, 98);
    let avg_ovr = (strength - 6).max(44);
    let top_ovr = (strength + 2).min(99);
    PlayerGenerationQuality {
        reputation: (strength as u32 * 10).min(1000),
        domestic_tier: None,
        current_strength: Some(strength),
        expected_squad_avg_ovr: Some(avg_ovr),
        expected_top_player_ovr: Some(top_ovr),
        squad_depth: Some(strength.saturating_sub(8).max(40)),
    }
}

/// Position slots for a 26-player national squad:
/// 3 GK, 4 CB, 2 LB, 2 RB, 2 DM, 4 CM, 2 AM, 2 LM, 2 RM, 2 ST, 1 extra Winger
const NATIONAL_SQUAD_SLOTS: &[(usize, Position)] = &[
    // Goalkeepers (3)
    (0, Position::Goalkeeper),
    (1, Position::Goalkeeper),
    (2, Position::Goalkeeper),
    // Center backs (4)
    (3, Position::CenterBack),
    (4, Position::CenterBack),
    (5, Position::CenterBack),
    (6, Position::CenterBack),
    // Full backs (4)
    (7, Position::LeftBack),
    (8, Position::RightBack),
    (9, Position::LeftBack),
    (10, Position::RightBack),
    // Defensive midfielders (2)
    (11, Position::DefensiveMidfielder),
    (12, Position::DefensiveMidfielder),
    // Central midfielders (4)
    (13, Position::CentralMidfielder),
    (14, Position::CentralMidfielder),
    (15, Position::CentralMidfielder),
    (16, Position::CentralMidfielder),
    // Attacking midfielders (2)
    (17, Position::AttackingMidfielder),
    (18, Position::AttackingMidfielder),
    // Wide midfielders (4)
    (19, Position::LeftMidfielder),
    (20, Position::RightMidfielder),
    (21, Position::LeftMidfielder),
    (22, Position::RightMidfielder),
    // Strikers (2)
    (23, Position::Striker),
    (24, Position::Striker),
    // Extra forward (1 — winger)
    (25, Position::LeftWinger),
];

fn generate_national_squad(
    team_id: &str,
    team_def: &NationalTeamDef,
    names_def: &NamesDefinition,
    _target_avg: Option<u8>,
    rng: &mut impl rand::Rng,
    players: &mut Vec<Player>,
) {
    let quality = national_quality_for_team(team_def.strength);

    for &(slot_index, ref position) in NATIONAL_SQUAD_SLOTS {
        let nationality = if rng.random_range(0..100) < 90 {
            canonicalize_generated_nationality(team_def.iso_code)
        } else {
            // 10% chance of dual-nationality player
            let other_team = &WORLD_CUP_TEAMS[rng.random_range(0..WORLD_CUP_TEAMS.len())];
            canonicalize_generated_nationality(other_team.iso_code)
        };

        let mut player = generate_random_player_for_slot(
            team_id,
            slot_index,
            position.clone(),
            &nationality,
            names_def,
            quality,
            rng,
        );

        // National team players have no contracts, no market values
        player.contract_end = None;
        player.wage = 0;
        player.market_value = 0;
        player.transfer_listed = false;
        player.loan_listed = false;

        players.push(player);
    }
}

/// Generate a player at a specific position slot. Reuses the core
/// `generate_position_attributes` and quality offset machinery.
fn generate_random_player_for_slot(
    team_id: &str,
    slot_index: usize,
    position: Position,
    nationality: &str,
    names_def: &NamesDefinition,
    quality: PlayerGenerationQuality,
    rng: &mut impl rand::Rng,
) -> Player {
    let (first_name, last_name) = pick_name_from_def(nationality, names_def, rng);
    let full_name = format!("{} {}", first_name, last_name);
    let match_name = last_name.clone();
    let p_id = Uuid::new_v4().to_string();

    let age = rng.random_range(19..35);
    let birth_year = 2026 - age;
    let birth_month = rng.random_range(1..13);
    let birth_day = rng.random_range(1..29);
    let dob = format!("{:04}-{:02}-{:02}", birth_year, birth_month, birth_day);

    let mut attrs = super::generation::generate_position_attributes(&position, rng);
    let offset = super::generation::quality_offset(quality, slot_index);
    super::generation::apply_generation_quality(&mut attrs, &position, offset);

    let mut player = Player::new(p_id, match_name, full_name, dob, nationality.to_string(), position, attrs);
    player.team_id = Some(team_id.to_string());
    player.condition = rng.random_range(75..100);
    player.morale = rng.random_range(55..85);

    use crate::player_rating::refresh_player_derived;
    refresh_player_derived(&mut player, 2026);

    player
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn worldcup_teams_match_requested_2026_field() {
        let expected = [
            "Australia", "Iran", "Iraq", "Japan", "Jordan", "Korea Republic", "Saudi Arabia", "Qatar", "Uzbekistan",
            "Algeria", "Côte d'Ivoire", "Cabo Verde", "Congo DR", "Egypt", "Ghana", "Morocco", "South Africa", "Senegal", "Tunisia",
            "Canada", "United States", "Mexico", "Curaçao", "Haiti", "Panama",
            "Argentina", "Brazil", "Colombia", "Ecuador", "Paraguay", "Uruguay",
            "Austria", "Belgium", "Bosnia and Herzegovina", "Croatia", "Czechia", "England", "France", "Germany", "Netherlands", "Norway", "Portugal", "Scotland", "Spain", "Sweden", "Switzerland", "Türkiye",
            "New Zealand",
        ];
        let actual = WORLD_CUP_TEAMS.iter().map(|team| team.name).collect::<Vec<_>>();

        assert_eq!(actual, expected);
        assert_eq!(actual.len(), 48);
        assert_eq!(actual.iter().copied().collect::<HashSet<_>>().len(), 48);
    }

    #[test]
    fn generated_worldcup_world_has_teams_and_26_player_squads() {
        let (teams, players, staff) = generate_worldcup_world().unwrap();

        assert_eq!(teams.len(), 48);
        assert_eq!(players.len(), 48 * SQUAD_SIZE);
        assert_eq!(staff.len(), 48);
        for team in teams {
            let squad = players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                .collect::<Vec<_>>();
            assert_eq!(squad.len(), SQUAD_SIZE, "{} squad size", team.name);
            assert_eq!(
                squad
                    .iter()
                    .filter(|player| player.position == Position::Goalkeeper)
                    .count(),
                3,
                "{} goalkeeper count",
                team.name
            );
        }
    }
}
