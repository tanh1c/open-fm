use std::collections::{HashMap, HashSet};

use domain::player::{Footedness, Player, PlayerAttributes, Position, SquadTier};
use domain::staff::StaffRole;
use domain::team::{Facilities, Team, TeamColors};
use rand::RngExt;
use uuid::Uuid;

use super::definitions::{default_names_definition, default_teams_definition, TeamDef};
use super::generation::{
    canonicalize_generated_nationality, generate_random_player_from_def, generate_random_staff_from_def,
    generate_random_staff_unattached_from_def, pick_nationality_from_def, play_style_from_str,
    PlayerGenerationQuality,
};
use super::{
    assign_squad_numbers, centered_finance, centered_reputation, default_formation_for_team, facility_level,
    generated_tactical_instructions_for_team, normalize_generated_team, opening_morale_from_context,
    tactical_familiarity_from_level,
};
use crate::football_identity;
use crate::player_rating::{generate_potential, refresh_player_derived};

const FC26_CSV: &str = include_str!("EAFC26-Men.csv");
const MIN_SQUAD_SIZE: usize = 22;
const MAX_REAL_SQUAD_SIZE: usize = 35;

#[derive(Clone, Debug)]
struct Fc26PlayerRow {
    id: String,
    name: String,
    ovr: u8,
    position: String,
    alternate_positions: String,
    age: u8,
    nation: String,
    team: String,
    preferred_foot: String,
    weak_foot: u8,
    pace: u8,
    shooting: u8,
    passing: u8,
    dribbling: u8,
    defending: u8,
    physical: u8,
    acceleration: u8,
    sprint_speed: u8,
    positioning: u8,
    finishing: u8,
    shot_power: u8,
    vision: u8,
    short_passing: u8,
    long_passing: u8,
    ball_control: u8,
    reactions: u8,
    composure: u8,
    interceptions: u8,
    heading_accuracy: u8,
    defensive_awareness: u8,
    standing_tackle: u8,
    sliding_tackle: u8,
    jumping: u8,
    stamina: u8,
    strength: u8,
    aggression: u8,
    gk_diving: u8,
    gk_handling: u8,
    gk_kicking: u8,
    gk_positioning: u8,
    gk_reflexes: u8,
}

pub fn fc26_real_player_count_estimate() -> usize {
    parse_fc26_rows().len().min(248 * MAX_REAL_SQUAD_SIZE)
}

pub fn generate_fc26_world() -> Result<(Vec<Team>, Vec<Player>, Vec<domain::staff::Staff>), String> {
    let mut rng = rand::rng();
    let names_def = default_names_definition();
    let teams_def = default_teams_definition();
    let country_codes: Vec<String> = names_def.pools.keys().cloned().collect();
    let rows_by_team = rows_by_team();

    let mut teams_out = Vec::new();
    let mut players = Vec::new();
    let mut staff = Vec::new();

    for tdef in &teams_def.teams {
        let team_id = Uuid::new_v4().to_string();
        let mut team = build_team_from_def(tdef, &team_id, &mut rng);
        let team_player_start = players.len();

        if let Some(rows) = rows_for_team(tdef, &rows_by_team) {
            for (index, row) in select_squad_rows(rows).iter().enumerate() {
                let mut player = row_to_player(row, &team_id, index);
                player.morale = opening_morale_from_context(
                    team.reputation,
                    tdef.current_strength,
                    team.volatility,
                    index as u8,
                );
                players.push(player);
            }
        }

        while players.len() - team_player_start < MIN_SQUAD_SIZE {
            let index = players.len() - team_player_start;
            let nationality = pick_nationality_from_def(&tdef.country, &country_codes, &mut rng);
            let mut player = generate_random_player_from_def(
                &team_id,
                index,
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
            players.push(player);
        }

        assign_squad_numbers(&mut players[team_player_start..]);

        let roles = [
            StaffRole::AssistantManager,
            StaffRole::Coach,
            StaffRole::Scout,
            StaffRole::Physio,
        ];
        for role in &roles {
            let nationality = pick_nationality_from_def(&tdef.country, &country_codes, &mut rng);
            staff.push(generate_random_staff_from_def(
                &team_id,
                role.clone(),
                &nationality,
                &names_def,
                &mut rng,
            ));
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
        staff.push(generate_random_staff_unattached_from_def(
            role.clone(),
            nat,
            &names_def,
            &mut rng,
        ));
    }

    football_identity::upgrade_world_football_identities(&mut teams_out, &mut players, &mut staff);
    Ok((teams_out, players, staff))
}

fn build_team_from_def(tdef: &TeamDef, team_id: &str, rng: &mut impl rand::Rng) -> Team {
    let short_name = if tdef.short_name.is_empty() {
        tdef.name
            .split_whitespace()
            .filter_map(|word| word.chars().next())
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
    let mut team = Team::new(
        team_id.to_string(),
        tdef.name.clone(),
        short_name,
        tdef.country.clone(),
        tdef.city.clone(),
        stadium,
        tdef.stadium_capacity.unwrap_or_else(|| rng.random_range(10000..80000)),
    );
    let rep_range = tdef.reputation_range.unwrap_or([300, 900]);
    let fin_range = tdef.finance_range.unwrap_or([25_000_000, 350_000_000]);

    team.domestic_tier = tdef.domestic_tier;
    team.finance = centered_finance(fin_range, rng);
    team.reputation = centered_reputation(rep_range, rng);
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
    team
}

fn rows_by_team() -> HashMap<String, Vec<Fc26PlayerRow>> {
    let mut grouped = HashMap::<String, Vec<Fc26PlayerRow>>::new();
    for row in parse_fc26_rows() {
        grouped.entry(row.team.clone()).or_default().push(row);
    }
    grouped
}

fn rows_for_team<'a>(
    tdef: &TeamDef,
    rows_by_team: &'a HashMap<String, Vec<Fc26PlayerRow>>,
) -> Option<&'a [Fc26PlayerRow]> {
    let csv_name = team_alias_map()
        .get(tdef.name.as_str())
        .copied()
        .unwrap_or(tdef.name.as_str());
    rows_by_team.get(csv_name).map(Vec::as_slice)
}

fn select_squad_rows(rows: &[Fc26PlayerRow]) -> Vec<Fc26PlayerRow> {
    let mut selected = Vec::new();
    let mut used_ids = HashSet::new();
    let quotas = [
        ("GK", 2usize),
        ("CB", 3),
        ("RB", 2),
        ("LB", 2),
        ("CDM", 1),
        ("CM", 3),
        ("CAM", 1),
        ("RM", 1),
        ("LM", 1),
        ("RW", 1),
        ("LW", 1),
        ("ST", 3),
    ];

    for (position, quota) in quotas {
        let mut candidates = rows
            .iter()
            .filter(|row| row.position == position)
            .collect::<Vec<_>>();
        candidates.sort_by(|left, right| right.ovr.cmp(&left.ovr));
        for row in candidates.into_iter().take(quota) {
            if used_ids.insert(row.id.clone()) {
                selected.push(row.clone());
            }
        }
    }

    let mut remaining = rows.iter().collect::<Vec<_>>();
    remaining.sort_by(|left, right| right.ovr.cmp(&left.ovr));
    for row in remaining {
        if selected.len() >= MAX_REAL_SQUAD_SIZE {
            break;
        }
        if used_ids.insert(row.id.clone()) {
            selected.push(row.clone());
        }
    }

    selected
}

fn row_to_player(row: &Fc26PlayerRow, team_id: &str, index: usize) -> Player {
    let position = map_position(&row.position).unwrap_or(Position::CentralMidfielder);
    let attrs = attributes_from_row(row, &position);
    let dob = date_of_birth(row.age, &row.id, index);
    let nationality = canonicalize_generated_nationality(&row.nation);
    let mut player = Player::new(
        format!("fc26-{}", row.id),
        match_name(&row.name),
        row.name.clone(),
        dob,
        nationality,
        position.clone(),
        attrs,
    );
    player.team_id = Some(team_id.to_string());
    player.natural_position = position;
    player.alternate_positions = parse_alternate_positions(&row.alternate_positions);
    player.footedness = match row.preferred_foot.as_str() {
        "Left" => Footedness::Left,
        _ => Footedness::Right,
    };
    player.weak_foot = row.weak_foot.clamp(1, 5);
    player.condition = 90;
    player.fitness = row.stamina.max(row.physical).clamp(45, 99);
    player.contract_end = Some(contract_end(row.age, index));
    player.squad_tier = SquadTier::Reserve;
    refresh_player_derived(&mut player, 2026);
    player.ovr = row.ovr.clamp(1, 99);
    player.potential = generate_potential(player.ovr, row.age as u32).max(player.ovr);
    set_economy(&mut player, row.age as u32, row.ovr);
    player
}

fn attributes_from_row(row: &Fc26PlayerRow, position: &Position) -> PlayerAttributes {
    if matches!(position, Position::Goalkeeper) {
        return PlayerAttributes {
            pace: row.pace.max((row.acceleration as u16 + row.sprint_speed as u16) as u8 / 2).clamp(25, 99),
            stamina: row.stamina.clamp(35, 99),
            strength: row.strength.max(row.physical).clamp(35, 99),
            agility: row.gk_reflexes.max(row.reactions).clamp(35, 99),
            passing: row.gk_kicking.max(row.short_passing).clamp(25, 99),
            shooting: 20,
            tackling: 20,
            dribbling: row.ball_control.clamp(20, 70),
            defending: row.defensive_awareness.max(row.gk_positioning).clamp(30, 99),
            positioning: row.gk_positioning.max(row.positioning).clamp(35, 99),
            vision: row.vision.max(row.gk_kicking).clamp(30, 99),
            decisions: row.reactions.max(row.composure).clamp(35, 99),
            composure: row.composure.max(row.reactions).clamp(35, 99),
            aggression: row.aggression.clamp(20, 99),
            teamwork: row.passing.max(row.vision).clamp(35, 99),
            leadership: row.composure.max(row.ovr).saturating_sub(8).clamp(35, 99),
            handling: row.gk_handling.clamp(35, 99),
            reflexes: row.gk_reflexes.max(row.gk_diving).clamp(35, 99),
            aerial: row.gk_positioning.max(row.jumping).clamp(35, 99),
        };
    }

    PlayerAttributes {
        pace: row.pace.max(((row.acceleration as u16 + row.sprint_speed as u16) / 2) as u8).clamp(1, 99),
        stamina: row.stamina.max(row.physical.saturating_sub(8)).clamp(1, 99),
        strength: row.strength.max(row.physical.saturating_sub(5)).clamp(1, 99),
        agility: row.dribbling.max(row.reactions).clamp(1, 99),
        passing: row.passing.max(((row.short_passing as u16 + row.long_passing as u16) / 2) as u8).clamp(1, 99),
        shooting: row.shooting.max(((row.finishing as u16 + row.shot_power as u16) / 2) as u8).clamp(1, 99),
        tackling: row.standing_tackle.max(row.sliding_tackle).clamp(1, 99),
        dribbling: row.dribbling.max(row.ball_control).clamp(1, 99),
        defending: row.defending.max(((row.interceptions as u16 + row.defensive_awareness as u16) / 2) as u8).clamp(1, 99),
        positioning: row.positioning.max(row.reactions).clamp(1, 99),
        vision: row.vision.clamp(1, 99),
        decisions: row.reactions.max(row.composure).clamp(1, 99),
        composure: row.composure.clamp(1, 99),
        aggression: row.aggression.clamp(1, 99),
        teamwork: row.passing.max(row.vision).clamp(1, 99),
        leadership: row.composure.max(row.ovr).saturating_sub(10).clamp(1, 99),
        handling: 12,
        reflexes: 14,
        aerial: row.heading_accuracy.max(row.jumping).clamp(1, 99),
    }
}

fn set_economy(player: &mut Player, age: u32, ovr: u8) {
    let age_factor = if age <= 20 {
        1.35
    } else if age <= 23 {
        1.25
    } else if age <= 27 {
        1.12
    } else if age <= 30 {
        1.0
    } else if age <= 32 {
        0.72
    } else {
        0.42
    };
    let rating_factor = ((ovr as f64 - 42.0).max(1.0) / 50.0).powf(2.2);
    let elite_premium = if ovr >= 90 {
        2.75
    } else if ovr >= 87 {
        2.15
    } else if ovr >= 84 {
        1.55
    } else if ovr >= 81 {
        1.25
    } else {
        1.0
    };
    let base_value = 300_000.0 + rating_factor * 70_000_000.0;
    player.market_value = round_money((base_value * age_factor * elite_premium) as u64, 50_000);
    let weekly_wage = (player.market_value / 1_250).clamp(2_000, 260_000);
    player.wage = round_money(weekly_wage * 52, 5_000) as u32;
}

fn round_money(value: u64, step: u64) -> u64 {
    ((value + step / 2) / step) * step
}

fn date_of_birth(age: u8, id: &str, index: usize) -> String {
    let seed = id.parse::<u32>().unwrap_or(index as u32 + 1);
    let birth_year = 2026u32.saturating_sub(age as u32);
    let month = seed % 12 + 1;
    let day = seed / 12 % 28 + 1;
    format!("{birth_year:04}-{month:02}-{day:02}")
}

fn contract_end(age: u8, index: usize) -> String {
    let years = if age <= 23 { 5 } else if age <= 30 { 4 } else { 2 + index as u8 % 2 };
    format!("{}-06-30", 2026 + years as u32)
}

fn match_name(full_name: &str) -> String {
    let parts = full_name.split_whitespace().collect::<Vec<_>>();
    if parts.len() <= 2 {
        return full_name.to_string();
    }
    parts.last().copied().unwrap_or(full_name).to_string()
}

fn parse_alternate_positions(raw: &str) -> Vec<Position> {
    raw.trim_matches(|c| c == '[' || c == ']')
        .split(',')
        .filter_map(|part| {
            let code = part.trim().trim_matches('\'').trim_matches('"');
            map_position(code)
        })
        .collect()
}

fn map_position(code: &str) -> Option<Position> {
    Some(match code {
        "GK" => Position::Goalkeeper,
        "CB" => Position::CenterBack,
        "RB" => Position::RightBack,
        "LB" => Position::LeftBack,
        "RWB" => Position::RightWingBack,
        "LWB" => Position::LeftWingBack,
        "CDM" => Position::DefensiveMidfielder,
        "CM" => Position::CentralMidfielder,
        "CAM" => Position::AttackingMidfielder,
        "RM" => Position::RightMidfielder,
        "LM" => Position::LeftMidfielder,
        "RW" => Position::RightWinger,
        "LW" => Position::LeftWinger,
        "ST" | "CF" => Position::Striker,
        _ => return None,
    })
}

fn parse_fc26_rows() -> Vec<Fc26PlayerRow> {
    let records = parse_csv(FC26_CSV);
    let Some(header) = records.first() else {
        return Vec::new();
    };
    let indexes = header
        .iter()
        .enumerate()
        .map(|(index, name)| (name.as_str(), index))
        .collect::<HashMap<_, _>>();

    records
        .iter()
        .skip(1)
        .filter_map(|record| row_from_record(record, &indexes))
        .collect()
}

fn row_from_record(record: &[String], indexes: &HashMap<&str, usize>) -> Option<Fc26PlayerRow> {
    let get = |name: &str| -> String {
        indexes
            .get(name)
            .and_then(|index| record.get(*index))
            .cloned()
            .unwrap_or_default()
    };
    let num = |name: &str| -> u8 { get(name).parse::<u8>().unwrap_or(0) };

    let id = get("ID");
    let name = get("Name");
    let team = get("Team");
    if id.is_empty() || name.is_empty() || team.is_empty() {
        return None;
    }

    Some(Fc26PlayerRow {
        id,
        name,
        ovr: num("OVR"),
        position: get("Position"),
        alternate_positions: get("Alternative positions"),
        age: num("Age"),
        nation: get("Nation"),
        team,
        preferred_foot: get("Preferred foot"),
        weak_foot: num("Weak foot"),
        pace: num("PAC"),
        shooting: num("SHO"),
        passing: num("PAS"),
        dribbling: num("DRI"),
        defending: num("DEF"),
        physical: num("PHY"),
        acceleration: num("Acceleration"),
        sprint_speed: num("Sprint Speed"),
        positioning: num("Positioning"),
        finishing: num("Finishing"),
        shot_power: num("Shot Power"),
        vision: num("Vision"),
        short_passing: num("Short Passing"),
        long_passing: num("Long Passing"),
        ball_control: num("Ball Control"),
        reactions: num("Reactions"),
        composure: num("Composure"),
        interceptions: num("Interceptions"),
        heading_accuracy: num("Heading Accuracy"),
        defensive_awareness: num("Def Awareness"),
        standing_tackle: num("Standing Tackle"),
        sliding_tackle: num("Sliding Tackle"),
        jumping: num("Jumping"),
        stamina: num("Stamina"),
        strength: num("Strength"),
        aggression: num("Aggression"),
        gk_diving: num("GK Diving"),
        gk_handling: num("GK Handling"),
        gk_kicking: num("GK Kicking"),
        gk_positioning: num("GK Positioning"),
        gk_reflexes: num("GK Reflexes"),
    })
}

fn parse_csv(input: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut chars = input.chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' if in_quotes && chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                row.push(std::mem::take(&mut field));
            }
            '\n' if !in_quotes => {
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            '\r' if !in_quotes => {}
            _ => field.push(ch),
        }
    }

    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }

    rows
}

fn team_alias_map() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("Bournemouth", "AFC Bournemouth"),
        ("Brighton & Hove Albion", "Brighton"),
        ("Ipswich Town", "Ipswich"),
        ("Manchester United", "Man Utd"),
        ("Newcastle United", "Newcastle Utd"),
        ("Nottingham Forest", "Nott'm Forest"),
        ("Tottenham Hotspur", "Spurs"),
        ("Queens Park Rangers", "QPR"),
        ("Sheffield United", "Sheffield Utd"),
        ("West Bromwich Albion", "West Brom"),
        ("West Ham United", "West Ham"),
        ("Wolverhampton Wanderers", "Wolves"),
        ("Bolton Wanderers", "Bolton"),
        ("Charlton Athletic", "Charlton Ath"),
        ("Norwich City", "Norwich"),
        ("Preston North End", "Preston"),
        ("Angers", "Angers SCO"),
        ("Auxerre", "AJ Auxerre"),
        ("Brest", "Stade Brestois 29"),
        ("Le Havre AC", "Havre AC"),
        ("Lille", "LOSC Lille"),
        ("Lorient", "FC Lorient"),
        ("Lyon", "OL"),
        ("Marseille", "OM"),
        ("Nantes", "FC Nantes"),
        ("Nice", "OGC Nice"),
        ("Paris Saint-Germain", "Paris SG"),
        ("RC Strasbourg Alsace", "Strasbourg"),
        ("Rennes", "Stade Rennais FC"),
        ("Toulouse", "Toulouse FC"),
        ("Amiens", "Amiens SC"),
        ("Annecy", "FC Annecy"),
        ("Bastia", "SC Bastia"),
        ("Boulogne", "US Boulogne"),
        ("Clermont Foot", "Clermont Foot 63"),
        ("Dunkerque", "USL Dunkerque"),
        ("Guingamp", "En Avant Guingamp"),
        ("Le Mans", "Le Mans FC"),
        ("Nancy", "AS Nancy Lorraine"),
        ("Pau", "Pau FC"),
        ("Stade Lavallois", "Laval MFC"),
        ("Troyes", "ESTAC Troyes"),
        ("Augsburg", "FC Augsburg"),
        ("Bayer Leverkusen", "Leverkusen"),
        ("Bayern München", "FC Bayern München"),
        ("Borussia Mönchengladbach", "M'gladbach"),
        ("Eintracht Frankfurt", "Frankfurt"),
        ("FC Heidenheim", "Heidenheim"),
        ("Freiburg", "SC Freiburg"),
        ("Hoffenheim", "TSG Hoffenheim"),
        ("Köln", "1. FC Köln"),
        ("Mainz 05", "1. FSV Mainz 05"),
        ("St. Pauli", "FC St. Pauli"),
        ("Wolfsburg", "VfL Wolfsburg"),
        ("Werder Bremen", "SV Werder Bremen"),
        ("Darmstadt", "SV Darmstadt 98"),
        ("Eintracht Braunschweig", "Braunschweig"),
        ("FC Kaiserslautern", "Kaiserslautern"),
        ("FC Nürnberg", "1. FC Nürnberg"),
        ("Fortuna Düsseldorf", "Düsseldorf"),
        ("Karlsruher", "Karlsruher SC"),
        ("Paderborn", "SC Paderborn 07"),
        ("Schalke 04", "FC Schalke 04"),
        ("SpVgg Greuther Fürth", "Fürth"),
        ("VfL Bochum", "VfL Bochum 1848"),
        ("Atalanta", "Bergamo Calcio"),
        ("Como 1907", "Como"),
        ("Inter", "Lombardia FC"),
        ("Lazio", "Latium"),
        ("Milan", "Milano FC"),
        ("Napoli", "SSC Napoli"),
        ("Roma", "AS Roma"),
        ("Verona", "Hellas Verona"),
        ("Carrarese", "Carrarese Calcio"),
        ("Juve Stabia", "SS Juve Stabia"),
        ("Mantova 1911", "Mantova"),
        ("US Avellino 1912", "Avellino"),
        ("Virtus Entella", "Entella"),
        ("Atlético Madrid", "Atlético de Madrid"),
        ("Barcelona", "FC Barcelona"),
        ("Celta Vigo", "Celta"),
        ("Deportivo", "RC Deportivo"),
        ("Elche", "Elche CF"),
        ("Espanyol", "RCD Espanyol"),
        ("Getafe", "Getafe CF"),
        ("Girona", "Girona FC"),
        ("Levante", "Levante UD"),
        ("Mallorca", "RCD Mallorca"),
        ("Osasuna", "CA Osasuna"),
        ("Real Oviedo", "R. Oviedo"),
        ("Sevilla", "Sevilla FC"),
        ("Valencia", "Valencia CF"),
        ("Villarreal", "Villarreal CF"),
        ("Albacete", "Albacete BP"),
        ("Almería", "UD Almería"),
        ("Burgos", "Burgos CF"),
        ("Cádiz", "Cádiz CF"),
        ("Castellón", "CD Castellón"),
        ("Ceuta", "AD Ceuta FC"),
        ("Córdoba", "Córdoba CF"),
        ("Deportivo La Coruña", "RC Deportivo"),
        ("Eibar", "SD Eibar"),
        ("Granada", "Granada CF"),
        ("Huesca", "SD Huesca"),
        ("Las Palmas", "UD Las Palmas"),
        ("Leganés", "CD Leganés"),
        ("Málaga", "Málaga CF"),
        ("Mirandés", "CD Mirandés"),
        ("Racing Santander", "R. Racing Club"),
        ("Sporting Gijón", "R. Sporting"),
        ("Valladolid", "R. Valladolid CF"),
        ("Alverca", "FC Alverca"),
        ("Benfica", "SL Benfica"),
        ("Estoril", "Estoril Praia"),
        ("Estrela da Amadora", "Estrela Amadora"),
        ("Famalicão", "FC Famalicão"),
        ("Moreirense", "Moreirense FC"),
        ("Nacional da Madeira", "Nacional"),
        ("Rio Ave", "Rio Ave FC"),
        ("Tondela", "CD Tondela"),
        ("Vitória de Guimarães", "Vitória SC"),
        ("AZ Alkmaar", "AZ"),
        ("Excelsior Rotterdam", "Excelsior"),
        ("NEC Nijmegen", "N.E.C. Nijmegen"),
        ("PSV Eindhoven", "PSV"),
        ("SC Heerenveen", "sc Heerenveen"),
        ("Telstar", "SC Telstar"),
        ("Twente", "FC Twente"),
        ("Volendam", "FC Volendam"),
        ("Anderlecht", "RSC Anderlecht"),
        ("Antwerp", "Royal Antwerp FC"),
        ("Charleroi", "Sp. Charleroi"),
        ("Genk", "KRC Genk"),
        ("Gent", "KAA Gent"),
        ("Mechelen", "KV Mechelen"),
        ("Oud-Heverlee Leuven", "OH Leuven"),
        ("Sint-Truidense", "STVV"),
        ("Standard Liège", "Standard Liège"),
        ("Union Saint-Gilloise", "R. Union St.-G."),
        ("Westerlo", "KVC Westerlo"),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_finds_known_fc26_alias_teams() {
        let teams = rows_by_team().keys().cloned().collect::<HashSet<_>>();
        for team in ["Milano FC", "Lombardia FC", "Latium", "Bergamo Calcio", "Man Utd", "STVV"] {
            assert!(teams.contains(team), "missing FC26 alias team {team}");
        }
    }

    #[test]
    fn alias_map_covers_default_teams() {
        let rows = rows_by_team();
        let missing = default_teams_definition()
            .teams
            .iter()
            .filter_map(|team| {
                let csv_name = team_alias_map()
                    .get(team.name.as_str())
                    .copied()
                    .unwrap_or(team.name.as_str());
                (!rows.contains_key(csv_name)).then(|| format!("{} -> {csv_name}", team.name))
            })
            .collect::<Vec<_>>();

        assert!(missing.is_empty(), "missing FC26 mappings: {missing:?}");
    }

    #[test]
    fn generate_fc26_world_creates_full_squads() {
        let (teams, players, staff) = generate_fc26_world().unwrap();
        assert_eq!(teams.len(), 248);
        assert_eq!(staff.len(), 248 * 4 + 12);

        for team in &teams {
            let squad = players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                .collect::<Vec<_>>();
            assert!(squad.len() >= MIN_SQUAD_SIZE, "{} has {} players", team.name, squad.len());
            assert!(squad.iter().all(|player| player.squad_number.is_some()));
            assert!(squad.iter().all(|player| player.market_value > 0));
            assert!(squad.iter().all(|player| player.wage > 0));
        }
    }

    #[test]
    #[ignore]
    fn print_fc26_distribution_diagnostics() {
        let (teams, players, _) = generate_fc26_world().unwrap();
        let mut rows = teams
            .iter()
            .map(|team| {
                let squad = players
                    .iter()
                    .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                    .collect::<Vec<_>>();
                let avg_ovr = squad.iter().map(|player| player.ovr as f64).sum::<f64>() / squad.len() as f64;
                let top_ovr = squad.iter().map(|player| player.ovr).max().unwrap_or(0);
                (team.name.clone(), team.reputation as f64, avg_ovr, top_ovr, squad.len())
            })
            .collect::<Vec<_>>();

        let mean_rep = rows.iter().map(|(_, rep, _, _, _)| *rep).sum::<f64>() / rows.len() as f64;
        let mean_avg = rows.iter().map(|(_, _, avg, _, _)| *avg).sum::<f64>() / rows.len() as f64;
        let covariance = rows.iter().map(|(_, rep, avg, _, _)| (rep - mean_rep) * (avg - mean_avg)).sum::<f64>();
        let rep_var = rows.iter().map(|(_, rep, _, _, _)| (rep - mean_rep).powi(2)).sum::<f64>();
        let avg_var = rows.iter().map(|(_, _, avg, _, _)| (avg - mean_avg).powi(2)).sum::<f64>();
        let correlation = covariance / (rep_var.sqrt() * avg_var.sqrt());

        rows.sort_by(|left, right| right.2.total_cmp(&left.2));
        println!("FC26 teams={} players={} avg_ovr={:.2} min_avg={:.2} max_avg={:.2} rep_avg_correlation={:.3}", rows.len(), players.len(), mean_avg, rows.last().unwrap().2, rows.first().unwrap().2, correlation);
        println!("Top 12 by avg OVR:");
        for (name, rep, avg, top, len) in rows.iter().take(12) {
            println!("  {name}: avg={avg:.2} top={top} rep={rep:.0} squad={len}");
        }
        println!("Bottom 12 by avg OVR:");
        for (name, rep, avg, top, len) in rows.iter().rev().take(12) {
            println!("  {name}: avg={avg:.2} top={top} rep={rep:.0} squad={len}");
        }
    }

    #[test]
    fn generate_fc26_world_maps_known_players() {
        let (teams, players, _) = generate_fc26_world().unwrap();
        let liverpool = teams.iter().find(|team| team.name == "Liverpool").expect("Liverpool");
        let salah = players
            .iter()
            .find(|player| {
                player.team_id.as_deref() == Some(liverpool.id.as_str())
                    && player.full_name == "Mohamed Salah"
            })
            .expect("Mohamed Salah");

        assert_eq!(salah.natural_position, Position::RightMidfielder);
        assert_eq!(salah.footedness, Footedness::Left);
        assert_eq!(salah.weak_foot, 3);
        assert!(salah.ovr >= 88);
    }
}
