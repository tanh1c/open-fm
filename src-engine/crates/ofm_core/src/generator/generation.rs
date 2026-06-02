use domain::player::{Player, PlayerAttributes, Position};
use domain::staff::{Staff, StaffAttributes, StaffRole};
use domain::team::PlayStyle;
use rand::{Rng, RngExt};
use uuid::Uuid;

use super::definitions::NamesDefinition;
use crate::player_rating::{generate_potential, refresh_player_derived};

// ---------------------------------------------------------------------------
// Helper functions for world generation
// ---------------------------------------------------------------------------

/// Compute a sensible alternate position based on primary position and attributes.
fn compute_alternate_position(primary: &Position, attrs: &PlayerAttributes) -> Option<Position> {
    match primary {
        Position::Goalkeeper => None,
        Position::LeftBack | Position::LeftWingBack => Some(Position::LeftMidfielder),
        Position::RightBack | Position::RightWingBack => Some(Position::RightMidfielder),
        Position::CenterBack | Position::Defender => {
            if attrs.passing >= 62 && attrs.vision >= 56 {
                Some(Position::DefensiveMidfielder)
            } else {
                None
            }
        }
        Position::DefensiveMidfielder => {
            if attrs.defending >= 62 && attrs.tackling >= 62 {
                Some(Position::CenterBack)
            } else {
                Some(Position::CentralMidfielder)
            }
        }
        Position::CentralMidfielder | Position::Midfielder => {
            if attrs.defending >= 62 && attrs.tackling >= 60 {
                Some(Position::DefensiveMidfielder)
            } else if attrs.shooting >= 62 && attrs.dribbling >= 60 {
                Some(Position::AttackingMidfielder)
            } else {
                None
            }
        }
        Position::AttackingMidfielder => {
            if attrs.shooting >= 64 && attrs.dribbling >= 62 {
                Some(Position::Striker)
            } else {
                Some(Position::CentralMidfielder)
            }
        }
        Position::LeftMidfielder => Some(Position::LeftWinger),
        Position::RightMidfielder => Some(Position::RightWinger),
        Position::LeftWinger => {
            if attrs.passing >= 60 && attrs.vision >= 56 {
                Some(Position::LeftMidfielder)
            } else {
                Some(Position::Striker)
            }
        }
        Position::RightWinger => {
            if attrs.passing >= 60 && attrs.vision >= 56 {
                Some(Position::RightMidfielder)
            } else {
                Some(Position::Striker)
            }
        }
        Position::Striker | Position::Forward => {
            if attrs.passing >= 58 && attrs.vision >= 56 {
                Some(Position::AttackingMidfielder)
            } else {
                None
            }
        }
    }
}

/// Pick a nationality code weighted 60% toward team country.
pub(super) fn pick_nationality_from_def(
    team_country: &str,
    available_codes: &[String],
    rng: &mut impl Rng,
) -> String {
    // Map team country name → ISO code for the 60% local weight
    let local_code = country_to_iso(team_country);
    let selected_code = if rng.random_range(0..100) < 60 {
        local_code.to_string()
    } else if available_codes.is_empty() {
        local_code.to_string()
    } else {
        available_codes[rng.random_range(0..available_codes.len())].clone()
    };

    canonicalize_generated_nationality(&selected_code)
}

pub(super) fn canonicalize_generated_nationality(value: &str) -> String {
    match value.trim().to_ascii_uppercase().as_str() {
        // Freshly generated football identities should never persist the ambiguous GB code.
        "GB" => "ENG".to_string(),
        other => other.to_string(),
    }
}

/// Pick a name from the NamesDefinition for a given nationality code.
pub(super) fn pick_name_from_def(
    nationality: &str,
    names_def: &NamesDefinition,
    rng: &mut impl Rng,
) -> (String, String) {
    let candidate_codes = match nationality {
        "ENG" | "SCO" | "WAL" | "NIR" => vec![nationality, "GB"],
        _ => vec![nationality],
    };

    for candidate in candidate_codes {
        if let Some(pool) = names_def.pools.get(candidate)
            && !pool.first_names.is_empty()
            && !pool.last_names.is_empty()
        {
            let first = pool.first_names[rng.random_range(0..pool.first_names.len())].clone();
            let last = pool.last_names[rng.random_range(0..pool.last_names.len())].clone();
            return (first, last);
        }
    }

    // Fallback: pick from any available pool
    let keys: Vec<&String> = names_def.pools.keys().collect();
    if let Some(key) = keys.first() {
        let pool = &names_def.pools[*key];
        let first = pool.first_names[rng.random_range(0..pool.first_names.len())].clone();
        let last = pool.last_names[rng.random_range(0..pool.last_names.len())].clone();
        return (first, last);
    }
    ("Player".to_string(), "Unknown".to_string())
}

pub(super) fn country_to_iso(country: &str) -> &str {
    match country {
        "England" | "ENG" => "ENG",
        "Scotland" | "SCO" => "SCO",
        "Wales" | "WAL" => "WAL",
        "Northern Ireland" | "NIR" => "NIR",
        "Ireland" | "Republic of Ireland" | "IE" => "IE",
        "GB" => "GB",
        "Spain" | "ES" => "ES",
        "Germany" | "DE" => "DE",
        "France" | "FR" => "FR",
        "Italy" | "IT" => "IT",
        "Netherlands" | "NL" => "NL",
        "Portugal" | "PT" => "PT",
        "Brazil" | "BR" => "BR",
        "Argentina" | "AR" => "AR",
        "Belgium" | "BE" => "BE",
        "Croatia" | "HR" => "HR",
        "Sweden" | "SE" => "SE",
        other => {
            // If already a short code, return as-is.
            if other.len() == 2 || other.len() == 3 {
                other
            } else {
                "ENG"
            }
        }
    }
}

pub(super) fn play_style_from_str(s: &str) -> PlayStyle {
    match s {
        "Attacking" => PlayStyle::Attacking,
        "Defensive" => PlayStyle::Defensive,
        "Possession" => PlayStyle::Possession,
        "Counter" => PlayStyle::Counter,
        "HighPress" => PlayStyle::HighPress,
        _ => PlayStyle::Balanced,
    }
}

fn round_money(value: u64, step: u64) -> u64 {
    if step == 0 {
        return value;
    }

    ((value + step - 1) / step) * step
}

fn attr(rng: &mut impl Rng, range: std::ops::Range<u8>) -> u8 {
    rng.random_range(range)
}

#[derive(Clone, Copy)]
pub(super) struct PlayerGenerationQuality {
    pub reputation: u32,
    pub domestic_tier: Option<u8>,
}

impl Default for PlayerGenerationQuality {
    fn default() -> Self {
        Self {
            reputation: 500,
            domestic_tier: Some(2),
        }
    }
}

fn generated_position_for_slot(index: usize) -> Position {
    match index {
        0 | 1 => Position::Goalkeeper,
        2 => Position::LeftBack,
        3 | 4 | 7 => Position::CenterBack,
        5 => Position::RightBack,
        6 => Position::LeftWingBack,
        8 => Position::RightWingBack,
        9 => Position::DefensiveMidfielder,
        10 | 11 => Position::CentralMidfielder,
        12 => Position::AttackingMidfielder,
        13 => Position::LeftMidfielder,
        14 => Position::RightMidfielder,
        15 => Position::CentralMidfielder,
        16 => Position::LeftWinger,
        17 | 20 => Position::Striker,
        18 => Position::RightWinger,
        19 => Position::LeftWinger,
        _ => Position::RightWinger,
    }
}

fn quality_offset(quality: PlayerGenerationQuality, index: usize) -> i16 {
    let reputation_offset = ((quality.reputation as i16 - 600) / 45).clamp(-8, 7);
    let tier_offset = match quality.domestic_tier.unwrap_or(2) {
        1 => 1,
        2 => -1,
        3 => -4,
        4 => -6,
        _ => -8,
    };
    let squad_offset = match index {
        0 | 2..=5 | 9..=12 | 16..=18 => 3,
        6..=8 | 13..=15 | 19..=20 => -1,
        _ => -6,
    };

    (reputation_offset + tier_offset + squad_offset).clamp(-16, 12)
}

fn adjust_attr(value: u8, offset: i16, weight: i16) -> u8 {
    (value as i16 + (offset * weight) / 10).clamp(1, 99) as u8
}

fn apply_generation_quality(attributes: &mut PlayerAttributes, position: &Position, offset: i16) {
    attributes.pace = adjust_attr(attributes.pace, offset, 8);
    attributes.stamina = adjust_attr(attributes.stamina, offset, 7);
    attributes.strength = adjust_attr(attributes.strength, offset, 7);
    attributes.agility = adjust_attr(attributes.agility, offset, 8);
    attributes.passing = adjust_attr(attributes.passing, offset, 9);
    attributes.shooting = adjust_attr(attributes.shooting, offset, 9);
    attributes.tackling = adjust_attr(attributes.tackling, offset, 9);
    attributes.dribbling = adjust_attr(attributes.dribbling, offset, 9);
    attributes.defending = adjust_attr(attributes.defending, offset, 9);
    attributes.positioning = adjust_attr(attributes.positioning, offset, 10);
    attributes.vision = adjust_attr(attributes.vision, offset, 9);
    attributes.decisions = adjust_attr(attributes.decisions, offset, 10);
    attributes.composure = adjust_attr(attributes.composure, offset, 10);
    attributes.aggression = adjust_attr(attributes.aggression, offset, 5);
    attributes.teamwork = adjust_attr(attributes.teamwork, offset, 8);
    attributes.leadership = adjust_attr(attributes.leadership, offset, 7);
    attributes.aerial = adjust_attr(attributes.aerial, offset, 8);

    if matches!(position.to_group_position(), Position::Goalkeeper) {
        attributes.handling = adjust_attr(attributes.handling, offset, 11);
        attributes.reflexes = adjust_attr(attributes.reflexes, offset, 11);
    } else {
        attributes.handling = adjust_attr(attributes.handling, offset, 2);
        attributes.reflexes = adjust_attr(attributes.reflexes, offset, 2);
    }
}

fn generate_position_attributes(position: &Position, rng: &mut impl Rng) -> PlayerAttributes {
    match position {
        Position::Goalkeeper => PlayerAttributes {
            pace: attr(rng, 34..62),
            stamina: attr(rng, 46..78),
            strength: attr(rng, 54..86),
            agility: attr(rng, 58..92),
            passing: attr(rng, 36..68),
            shooting: attr(rng, 12..34),
            tackling: attr(rng, 16..38),
            dribbling: attr(rng, 18..42),
            defending: attr(rng, 18..44),
            positioning: attr(rng, 60..94),
            vision: attr(rng, 36..68),
            decisions: attr(rng, 58..92),
            composure: attr(rng, 56..92),
            aggression: attr(rng, 28..70),
            teamwork: attr(rng, 44..78),
            leadership: attr(rng, 38..84),
            handling: attr(rng, 64..98),
            reflexes: attr(rng, 64..98),
            aerial: attr(rng, 62..96),
        },
        Position::CenterBack | Position::Defender => PlayerAttributes {
            pace: attr(rng, 44..78),
            stamina: attr(rng, 58..90),
            strength: attr(rng, 66..98),
            agility: attr(rng, 42..76),
            passing: attr(rng, 44..78),
            shooting: attr(rng, 24..54),
            tackling: attr(rng, 66..99),
            dribbling: attr(rng, 30..62),
            defending: attr(rng, 68..99),
            positioning: attr(rng, 64..98),
            vision: attr(rng, 36..68),
            decisions: attr(rng, 58..92),
            composure: attr(rng, 54..88),
            aggression: attr(rng, 56..94),
            teamwork: attr(rng, 54..88),
            leadership: attr(rng, 42..88),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 66..98),
        },
        Position::LeftBack | Position::RightBack => PlayerAttributes {
            pace: attr(rng, 58..92),
            stamina: attr(rng, 62..96),
            strength: attr(rng, 50..82),
            agility: attr(rng, 54..88),
            passing: attr(rng, 54..86),
            shooting: attr(rng, 28..58),
            tackling: attr(rng, 62..94),
            dribbling: attr(rng, 48..82),
            defending: attr(rng, 62..94),
            positioning: attr(rng, 58..92),
            vision: attr(rng, 44..76),
            decisions: attr(rng, 56..90),
            composure: attr(rng, 50..84),
            aggression: attr(rng, 50..88),
            teamwork: attr(rng, 58..92),
            leadership: attr(rng, 36..78),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 44..78),
        },
        Position::LeftWingBack | Position::RightWingBack => PlayerAttributes {
            pace: attr(rng, 62..96),
            stamina: attr(rng, 66..98),
            strength: attr(rng, 46..78),
            agility: attr(rng, 58..92),
            passing: attr(rng, 58..90),
            shooting: attr(rng, 32..64),
            tackling: attr(rng, 56..88),
            dribbling: attr(rng, 56..90),
            defending: attr(rng, 56..88),
            positioning: attr(rng, 56..90),
            vision: attr(rng, 50..82),
            decisions: attr(rng, 56..90),
            composure: attr(rng, 50..84),
            aggression: attr(rng, 48..86),
            teamwork: attr(rng, 58..92),
            leadership: attr(rng, 34..76),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 40..74),
        },
        Position::DefensiveMidfielder => PlayerAttributes {
            pace: attr(rng, 48..82),
            stamina: attr(rng, 66..98),
            strength: attr(rng, 56..90),
            agility: attr(rng, 50..84),
            passing: attr(rng, 60..92),
            shooting: attr(rng, 34..66),
            tackling: attr(rng, 62..96),
            dribbling: attr(rng, 48..82),
            defending: attr(rng, 58..92),
            positioning: attr(rng, 64..96),
            vision: attr(rng, 56..90),
            decisions: attr(rng, 64..96),
            composure: attr(rng, 56..90),
            aggression: attr(rng, 54..92),
            teamwork: attr(rng, 64..98),
            leadership: attr(rng, 42..86),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 48..82),
        },
        Position::CentralMidfielder | Position::Midfielder => PlayerAttributes {
            pace: attr(rng, 52..86),
            stamina: attr(rng, 64..98),
            strength: attr(rng, 44..78),
            agility: attr(rng, 54..88),
            passing: attr(rng, 66..98),
            shooting: attr(rng, 42..74),
            tackling: attr(rng, 48..82),
            dribbling: attr(rng, 56..90),
            defending: attr(rng, 42..76),
            positioning: attr(rng, 58..92),
            vision: attr(rng, 66..98),
            decisions: attr(rng, 64..96),
            composure: attr(rng, 56..90),
            aggression: attr(rng, 42..82),
            teamwork: attr(rng, 66..98),
            leadership: attr(rng, 42..88),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 36..70),
        },
        Position::AttackingMidfielder => PlayerAttributes {
            pace: attr(rng, 56..90),
            stamina: attr(rng, 58..92),
            strength: attr(rng, 38..72),
            agility: attr(rng, 62..96),
            passing: attr(rng, 66..98),
            shooting: attr(rng, 54..86),
            tackling: attr(rng, 30..64),
            dribbling: attr(rng, 64..98),
            defending: attr(rng, 28..62),
            positioning: attr(rng, 60..94),
            vision: attr(rng, 68..99),
            decisions: attr(rng, 62..96),
            composure: attr(rng, 60..94),
            aggression: attr(rng, 34..76),
            teamwork: attr(rng, 58..92),
            leadership: attr(rng, 38..82),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 32..66),
        },
        Position::LeftMidfielder | Position::RightMidfielder => PlayerAttributes {
            pace: attr(rng, 60..94),
            stamina: attr(rng, 64..98),
            strength: attr(rng, 42..76),
            agility: attr(rng, 60..94),
            passing: attr(rng, 62..94),
            shooting: attr(rng, 44..76),
            tackling: attr(rng, 42..76),
            dribbling: attr(rng, 60..94),
            defending: attr(rng, 38..72),
            positioning: attr(rng, 56..90),
            vision: attr(rng, 58..90),
            decisions: attr(rng, 58..92),
            composure: attr(rng, 54..88),
            aggression: attr(rng, 38..80),
            teamwork: attr(rng, 62..96),
            leadership: attr(rng, 36..78),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 34..68),
        },
        Position::LeftWinger | Position::RightWinger => PlayerAttributes {
            pace: attr(rng, 66..99),
            stamina: attr(rng, 56..90),
            strength: attr(rng, 42..78),
            agility: attr(rng, 66..99),
            passing: attr(rng, 54..86),
            shooting: attr(rng, 58..90),
            tackling: attr(rng, 22..56),
            dribbling: attr(rng, 66..99),
            defending: attr(rng, 20..54),
            positioning: attr(rng, 58..92),
            vision: attr(rng, 54..86),
            decisions: attr(rng, 56..90),
            composure: attr(rng, 58..92),
            aggression: attr(rng, 34..78),
            teamwork: attr(rng, 50..84),
            leadership: attr(rng, 32..74),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 40..76),
        },
        Position::Striker | Position::Forward => PlayerAttributes {
            pace: attr(rng, 60..94),
            stamina: attr(rng, 52..86),
            strength: attr(rng, 54..90),
            agility: attr(rng, 58..92),
            passing: attr(rng, 42..76),
            shooting: attr(rng, 70..99),
            tackling: attr(rng, 18..50),
            dribbling: attr(rng, 58..92),
            defending: attr(rng, 16..48),
            positioning: attr(rng, 68..99),
            vision: attr(rng, 42..76),
            decisions: attr(rng, 62..96),
            composure: attr(rng, 66..99),
            aggression: attr(rng, 38..82),
            teamwork: attr(rng, 44..80),
            leadership: attr(rng, 34..78),
            handling: attr(rng, 8..28),
            reflexes: attr(rng, 12..34),
            aerial: attr(rng, 50..88),
        },
    }
}

pub(super) fn generate_random_player_from_def(
    team_id: &str,
    index: usize,
    nationality: &str,
    names_def: &NamesDefinition,
    quality: PlayerGenerationQuality,
    rng: &mut impl Rng,
) -> Player {
    let (first_name, last_name) = pick_name_from_def(nationality, names_def, rng);
    let full_name = format!("{} {}", first_name, last_name);
    let match_name = last_name.clone();

    let position = generated_position_for_slot(index);

    let p_id = Uuid::new_v4().to_string();
    let nationality = nationality.to_string();

    // Reserve slots across the back line, midfield, and attack always start youth-aged
    // so each club can open with real academy prospects instead of an empty youth squad.
    let age = if matches!(index, 8 | 15 | 21) {
        rng.random_range(17..22)
    } else {
        rng.random_range(17..36)
    };
    let birth_year = 2026 - age;
    let birth_month = rng.random_range(1..13);
    let birth_day = rng.random_range(1..29);
    let dob = format!("{:04}-{:02}-{:02}", birth_year, birth_month, birth_day);

    let group = position.to_group_position();
    let is_gk = matches!(group, Position::Goalkeeper);
    let is_fwd = matches!(group, Position::Forward);

    let mut attributes = generate_position_attributes(&position, rng);
    apply_generation_quality(&mut attributes, &position, quality_offset(quality, index));

    let current_year: u32 = 2026;

    let contract_years = if age <= 21 {
        rng.random_range(3..6)
    } else if age <= 27 {
        rng.random_range(2..5)
    } else if age <= 31 {
        rng.random_range(2..4)
    } else if rng.random_range(0..100) < 40 {
        1
    } else {
        2
    };
    let contract_end = format!("{}-06-30", 2026 + contract_years);

    let mut player = Player::new(
        p_id,
        match_name,
        full_name,
        dob,
        nationality,
        position,
        attributes,
    );
    player.team_id = Some(team_id.to_string());
    player.contract_end = Some(contract_end);
    player.condition = rng.random_range(75..100);
    player.morale = rng.random_range(40..76);

    // ~40% of outfield players get an alternate position based on attributes
    if !is_gk && rng.random_range(0..5) < 2 {
        let alt = compute_alternate_position(&player.position, &player.attributes);
        if let Some(pos) = alt {
            player.alternate_positions.push(pos);
        }
    }

    // Set position-weighted OVR, potential, and traits (Wonderkid included if applicable)
    let player_age = current_year.saturating_sub(birth_year);
    // Pre-generate a potential so Wonderkid trait is assigned correctly on first refresh
    let temp_ovr = {
        use crate::player_rating::natural_ovr;
        natural_ovr(&player).round() as u8
    };
    player.potential = generate_potential(temp_ovr, player_age);
    refresh_player_derived(&mut player, current_year);

    let age_factor = if age <= 20 {
        1.35
    } else if age <= 23 {
        1.28
    } else if age <= 27 {
        1.15
    } else if age <= 30 {
        1.0
    } else if age <= 32 {
        0.72
    } else {
        0.36
    };
    let rating_factor = ((player.ovr as f64 - 42.0).max(1.0) / 50.0).powf(2.2);
    let position_factor = if is_gk {
        0.82
    } else if is_fwd {
        1.1
    } else {
        1.0
    };
    let potential_premium = if player_age <= 23 {
        1.0 + (player.potential.saturating_sub(player.ovr) as f64 * 0.025).min(0.45)
    } else {
        1.0
    };
    let elite_premium = if player.ovr >= 90 {
        2.75
    } else if player.ovr >= 87 {
        2.15
    } else if player.ovr >= 84 {
        1.55
    } else if player.ovr >= 81 {
        1.25
    } else {
        1.0
    };
    let base_value = 300_000.0 + rating_factor * 78_000_000.0;
    player.market_value = round_money(
        (base_value * age_factor * position_factor * potential_premium * elite_premium) as u64,
        50_000,
    );
    let weekly_wage = (player.market_value / 1_250).clamp(2_000, 260_000);
    player.wage = round_money(weekly_wage * 52, 5_000) as u32;

    player
}

pub(super) fn generate_random_staff_from_def(
    team_id: &str,
    role: StaffRole,
    nationality: &str,
    names_def: &NamesDefinition,
    rng: &mut impl Rng,
) -> Staff {
    let (first_name, last_name) = pick_name_from_def(nationality, names_def, rng);
    let age = rng.random_range(30..60);
    let birth_year = 2026 - age;
    let dob = format!(
        "{:04}-{:02}-{:02}",
        birth_year,
        rng.random_range(1..13),
        rng.random_range(1..29)
    );

    let attributes = match &role {
        StaffRole::AssistantManager => StaffAttributes {
            coaching: rng.random_range(50..90),
            judging_ability: rng.random_range(50..85),
            judging_potential: rng.random_range(40..80),
            physiotherapy: rng.random_range(20..50),
        },
        StaffRole::Coach => StaffAttributes {
            coaching: rng.random_range(55..95),
            judging_ability: rng.random_range(40..75),
            judging_potential: rng.random_range(30..70),
            physiotherapy: rng.random_range(20..45),
        },
        StaffRole::Scout => StaffAttributes {
            coaching: rng.random_range(20..50),
            judging_ability: rng.random_range(60..95),
            judging_potential: rng.random_range(55..95),
            physiotherapy: rng.random_range(10..30),
        },
        StaffRole::Physio => StaffAttributes {
            coaching: rng.random_range(10..40),
            judging_ability: rng.random_range(20..50),
            judging_potential: rng.random_range(15..45),
            physiotherapy: rng.random_range(60..95),
        },
    };

    let mut s = Staff::new(
        Uuid::new_v4().to_string(),
        first_name,
        last_name,
        dob,
        role,
        attributes,
    );
    s.nationality = nationality.to_string();
    s.team_id = Some(team_id.to_string());
    s
}

pub(super) fn generate_random_staff_unattached_from_def(
    role: StaffRole,
    nationality: &str,
    names_def: &NamesDefinition,
    rng: &mut impl Rng,
) -> Staff {
    let (first_name, last_name) = pick_name_from_def(nationality, names_def, rng);
    let age = rng.random_range(28..55);
    let birth_year = 2026 - age;
    let dob = format!(
        "{:04}-{:02}-{:02}",
        birth_year,
        rng.random_range(1..13),
        rng.random_range(1..29)
    );

    let attributes = StaffAttributes {
        coaching: rng.random_range(30..80),
        judging_ability: rng.random_range(30..80),
        judging_potential: rng.random_range(25..75),
        physiotherapy: rng.random_range(25..75),
    };

    let mut s = Staff::new(
        Uuid::new_v4().to_string(),
        first_name,
        last_name,
        dob,
        role,
        attributes,
    );
    s.nationality = nationality.to_string();
    s
}
