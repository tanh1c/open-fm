use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use domain::player::{Footedness, Player, PlayerAttributes, PlayerTrait, Position, SquadTier};
use domain::staff::StaffRole;
use domain::team::{Facilities, Team, TeamColors};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::definitions::{default_names_definition, default_teams_definition, TeamDef};
use super::generation::{
    canonicalize_generated_nationality, generate_random_staff_from_def,
    generate_random_staff_unattached_from_def, pick_nationality_from_def, play_style_from_str,
};
use super::{
    assign_squad_numbers, centered_finance, centered_reputation, default_formation_for_team, facility_level,
    generated_tactical_instructions_for_team, normalize_generated_team, opening_morale_from_context,
    tactical_familiarity_from_level,
};
use crate::football_identity;
use crate::player_rating::{generate_potential, refresh_player_derived};

const FC26_CSV: &str = include_str!("FC26_20250921.csv");
const EAFC26_CSV: &str = include_str!("EAFC26-Men.csv");
const WORLDCUP_ADDITIONS_JSON: &str = include_str!("data/fc26_worldcup_2026_additions.json");
const MAX_REAL_SQUAD_SIZE: usize = 35;
const WORLDCUP_SQUAD_SIZE: usize = 26;

#[derive(Clone, Debug)]
struct Fc26PlayerRow {
    id: String,
    name: String,
    ovr: u8,
    potential: u8,
    position: String,
    alternate_positions: String,
    position_ratings: HashMap<Position, u8>,
    age: u8,
    dob: String,
    nation: String,
    team: String,
    preferred_foot: String,
    weak_foot: u8,
    value_eur: u64,
    wage_eur: u64,
    jersey_number: Option<u8>,
    contract_end_year: Option<u32>,
    skill_moves: u8,
    international_reputation: u8,
    work_rate: String,
    player_tags: String,
    player_traits: String,
    club_loaned_from: String,
    club_joined_date: String,
    release_clause_eur: u64,
    height_cm: u8,
    weight_kg: u8,
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
    fc26_rows().len().min(248 * MAX_REAL_SQUAD_SIZE)
}

fn fc26_rows() -> &'static [Fc26PlayerRow] {
    static ROWS: OnceLock<Vec<Fc26PlayerRow>> = OnceLock::new();
    ROWS.get_or_init(parse_fc26_rows).as_slice()
}

fn worldcup_additions() -> Result<&'static WorldCupAdditionsFile, String> {
    static ADDITIONS: OnceLock<Result<WorldCupAdditionsFile, String>> = OnceLock::new();
    ADDITIONS
        .get_or_init(|| serde_json::from_str(WORLDCUP_ADDITIONS_JSON).map_err(|_| "be.error.worldParseFailed".to_string()))
        .as_ref()
        .map_err(Clone::clone)
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

    resolve_fc26_loans(&rows_by_team, &teams_out, &mut players);
    football_identity::upgrade_world_football_identities(&mut teams_out, &mut players, &mut staff);
    Ok((teams_out, players, staff))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorldCupCallupCandidate {
    pub id: String,
    pub full_name: String,
    pub match_name: String,
    pub position: Position,
    pub alternate_positions: Vec<Position>,
    pub ovr: u8,
    pub age: u8,
    pub club: String,
    pub nationality: String,
}

#[derive(Clone)]
struct WorldCupCandidatePlayer {
    player: Player,
    club: String,
}

#[derive(Clone, Copy)]
struct WorldCupNationalTeamDef {
    name: &'static str,
    iso_code: &'static str,
    aliases: &'static [&'static str],
    strength: u8,
    play_style: &'static str,
}

const WORLDCUP_FC26_TEAMS: &[WorldCupNationalTeamDef] = &[
    WorldCupNationalTeamDef { name: "Australia", iso_code: "AU", aliases: &["Australia"], strength: 73, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Iran", iso_code: "IR", aliases: &["Iran"], strength: 74, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Iraq", iso_code: "IQ", aliases: &["Iraq"], strength: 67, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Japan", iso_code: "JP", aliases: &["Japan"], strength: 81, play_style: "Possession" },
    WorldCupNationalTeamDef { name: "Jordan", iso_code: "JO", aliases: &["Jordan"], strength: 64, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Korea Republic", iso_code: "KR", aliases: &["Korea Republic", "South Korea"], strength: 79, play_style: "HighPress" },
    WorldCupNationalTeamDef { name: "Saudi Arabia", iso_code: "SA", aliases: &["Saudi Arabia"], strength: 72, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Qatar", iso_code: "QA", aliases: &["Qatar"], strength: 68, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Uzbekistan", iso_code: "UZ", aliases: &["Uzbekistan"], strength: 68, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Algeria", iso_code: "DZ", aliases: &["Algeria"], strength: 74, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Côte d'Ivoire", iso_code: "CI", aliases: &["Côte d'Ivoire", "Ivory Coast", "Cote d'Ivoire"], strength: 76, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "Cabo Verde", iso_code: "CV", aliases: &["Cabo Verde", "Cape Verde", "Cape Verde Islands"], strength: 66, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Congo DR", iso_code: "CD", aliases: &["Congo DR", "Congo", "DR Congo"], strength: 70, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Egypt", iso_code: "EG", aliases: &["Egypt"], strength: 75, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Ghana", iso_code: "GH", aliases: &["Ghana"], strength: 73, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Morocco", iso_code: "MA", aliases: &["Morocco"], strength: 83, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "South Africa", iso_code: "ZA", aliases: &["South Africa"], strength: 68, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Senegal", iso_code: "SN", aliases: &["Senegal"], strength: 79, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Tunisia", iso_code: "TN", aliases: &["Tunisia"], strength: 72, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Canada", iso_code: "CA", aliases: &["Canada"], strength: 76, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "United States", iso_code: "US", aliases: &["United States", "USA", "United States of America"], strength: 82, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Mexico", iso_code: "MX", aliases: &["Mexico"], strength: 80, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "Curaçao", iso_code: "CW", aliases: &["Curaçao", "Curacao"], strength: 65, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Haiti", iso_code: "HT", aliases: &["Haiti"], strength: 64, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Panama", iso_code: "PA", aliases: &["Panama"], strength: 69, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Argentina", iso_code: "AR", aliases: &["Argentina"], strength: 94, play_style: "Possession" },
    WorldCupNationalTeamDef { name: "Brazil", iso_code: "BR", aliases: &["Brazil"], strength: 93, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "Colombia", iso_code: "CO", aliases: &["Colombia"], strength: 80, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Ecuador", iso_code: "EC", aliases: &["Ecuador"], strength: 74, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Paraguay", iso_code: "PY", aliases: &["Paraguay"], strength: 72, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Uruguay", iso_code: "UY", aliases: &["Uruguay"], strength: 82, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Austria", iso_code: "AT", aliases: &["Austria"], strength: 77, play_style: "HighPress" },
    WorldCupNationalTeamDef { name: "Belgium", iso_code: "BE", aliases: &["Belgium"], strength: 83, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Bosnia and Herzegovina", iso_code: "BA", aliases: &["Bosnia and Herzegovina", "Bosnia Herzegovina"], strength: 70, play_style: "Counter" },
    WorldCupNationalTeamDef { name: "Croatia", iso_code: "HR", aliases: &["Croatia"], strength: 82, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Czechia", iso_code: "CZ", aliases: &["Czechia", "Czech Republic", "Czech"], strength: 74, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "England", iso_code: "ENG", aliases: &["England"], strength: 90, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "France", iso_code: "FR", aliases: &["France"], strength: 92, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "Germany", iso_code: "DE", aliases: &["Germany"], strength: 86, play_style: "HighPress" },
    WorldCupNationalTeamDef { name: "Netherlands", iso_code: "NL", aliases: &["Netherlands"], strength: 84, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "Norway", iso_code: "NO", aliases: &["Norway"], strength: 78, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Portugal", iso_code: "PT", aliases: &["Portugal"], strength: 87, play_style: "Possession" },
    WorldCupNationalTeamDef { name: "Scotland", iso_code: "SCO", aliases: &["Scotland"], strength: 74, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Spain", iso_code: "ES", aliases: &["Spain"], strength: 89, play_style: "Possession" },
    WorldCupNationalTeamDef { name: "Sweden", iso_code: "SE", aliases: &["Sweden"], strength: 76, play_style: "Balanced" },
    WorldCupNationalTeamDef { name: "Switzerland", iso_code: "CH", aliases: &["Switzerland"], strength: 78, play_style: "Defensive" },
    WorldCupNationalTeamDef { name: "Türkiye", iso_code: "TR", aliases: &["Türkiye", "Turkey"], strength: 76, play_style: "Attacking" },
    WorldCupNationalTeamDef { name: "New Zealand", iso_code: "NZ", aliases: &["New Zealand"], strength: 66, play_style: "Balanced" },
];

#[derive(Clone, Deserialize)]
struct WorldCupAdditionsFile {
    teams: Vec<WorldCupAdditionTeam>,
}

#[derive(Clone, Deserialize)]
struct WorldCupAdditionTeam {
    country: String,
    players_to_add: Vec<WorldCupAdditionPlayer>,
}

#[derive(Clone, Deserialize)]
struct WorldCupAdditionPlayer {
    full_name: String,
    known_as: String,
    date_of_birth: String,
    age_2026: u8,
    nationality_name: String,
    primary_position: String,
    #[serde(default)]
    alternate_positions: Vec<String>,
    current_club: String,
    #[serde(default)]
    height_cm: u8,
    preferred_foot: String,
    fc26_style_attributes: WorldCupAdditionAttributes,
}

#[derive(Clone, Deserialize)]
struct WorldCupAdditionAttributes {
    overall: u8,
    potential: u8,
    pace: u8,
    shooting: u8,
    passing: u8,
    dribbling: u8,
    defending: u8,
    physic: u8,
    movement_acceleration: u8,
    movement_sprint_speed: u8,
    attacking_finishing: u8,
    power_shot_power: u8,
    mentality_positioning: u8,
    mentality_vision: u8,
    attacking_short_passing: u8,
    skill_long_passing: u8,
    skill_ball_control: u8,
    movement_reactions: u8,
    mentality_composure: u8,
    mentality_interceptions: u8,
    attacking_heading_accuracy: u8,
    defending_marking_awareness: u8,
    defending_standing_tackle: u8,
    defending_sliding_tackle: u8,
    power_jumping: u8,
    power_stamina: u8,
    power_strength: u8,
    mentality_aggression: u8,
    goalkeeping_diving: u8,
    goalkeeping_handling: u8,
    goalkeeping_kicking: u8,
    goalkeeping_positioning: u8,
    goalkeeping_reflexes: u8,
    weak_foot: u8,
    skill_moves: u8,
    international_reputation: u8,
}

pub fn generate_worldcup_fc26_world() -> Result<(Vec<Team>, Vec<Player>, Vec<domain::staff::Staff>), String> {
    generate_worldcup_fc26_world_with_user_selection(None, &[])
}

pub fn generate_worldcup_fc26_world_with_user_selection(
    user_team_id: Option<&str>,
    selected_player_ids: &[String],
) -> Result<(Vec<Team>, Vec<Player>, Vec<domain::staff::Staff>), String> {
    let mut rng = rand::rng();
    let names_def = default_names_definition();
    let mut teams = Vec::with_capacity(WORLDCUP_FC26_TEAMS.len());
    let mut players = Vec::with_capacity(WORLDCUP_FC26_TEAMS.len() * WORLDCUP_SQUAD_SIZE);
    let mut staff = Vec::with_capacity(WORLDCUP_FC26_TEAMS.len());

    for team_def in WORLDCUP_FC26_TEAMS {
        let team_id = worldcup_team_id(team_def.name);
        let mut team = build_worldcup_national_team(team_def, &team_id, &mut rng);
        let team_player_start = players.len();
        let mut candidates = worldcup_candidate_players_for_team(team_def, &team_id)?;
        candidates.sort_by(|left, right| right.player.ovr.cmp(&left.player.ovr));
        let selected = if user_team_id == Some(team_id.as_str()) && !selected_player_ids.is_empty() {
            select_worldcup_players_by_id(candidates, selected_player_ids)?
        } else {
            auto_select_worldcup_players(candidates)
        };
        players.extend(selected.into_iter().map(|candidate| candidate.player));
        assign_squad_numbers(&mut players[team_player_start..]);
        normalize_generated_team(&mut team, &mut players[team_player_start..], None, None);
        team.tactical_instructions = generated_tactical_instructions_for_team(&team, &players[team_player_start..]);
        let staff_nat = canonicalize_generated_nationality(team_def.iso_code);
        staff.push(generate_random_staff_from_def(&team_id, StaffRole::AssistantManager, &staff_nat, &names_def, &mut rng));
        teams.push(team);
    }

    Ok((teams, players, staff))
}

pub fn worldcup_fc26_callup_pool(team_id: &str) -> Result<Vec<WorldCupCallupCandidate>, String> {
    let team_def = WORLDCUP_FC26_TEAMS
        .iter()
        .find(|team| worldcup_team_id(team.name) == team_id)
        .ok_or_else(|| "be.error.teamNotFound".to_string())?;
    let players = worldcup_candidate_players_for_team(team_def, team_id)?;
    Ok(players
        .into_iter()
        .map(|candidate| WorldCupCallupCandidate {
            id: candidate.player.id,
            full_name: candidate.player.full_name,
            match_name: candidate.player.match_name,
            position: candidate.player.natural_position,
            alternate_positions: candidate.player.alternate_positions,
            ovr: candidate.player.ovr,
            age: player_age_2026(&candidate.player.date_of_birth),
            club: candidate.club,
            nationality: candidate.player.nationality,
        })
        .collect())
}

pub fn worldcup_fc26_team_id_by_name(name: &str) -> String {
    worldcup_team_id(name)
}

fn worldcup_team_id(name: &str) -> String {
    format!("wc26-{}", normalize_key(name))
}

fn build_worldcup_national_team(team_def: &WorldCupNationalTeamDef, team_id: &str, rng: &mut impl rand::Rng) -> Team {
    let mut team = Team::new(
        team_id.to_string(),
        team_def.name.to_string(),
        team_def.name.to_string(),
        team_def.iso_code.to_string(),
        team_def.name.to_string(),
        format!("{} National Stadium", team_def.name),
        60_000 + rng.random_range(0..40_000),
    );
    team.play_style = play_style_from_str(team_def.play_style);
    team.formation = default_formation_for_team(&team.play_style, 65, 50);
    team.reputation = (team_def.strength as u32 * 10).min(1000);
    team.finance = 0;
    team.wage_budget = 0;
    team.transfer_budget = 0;
    team.domestic_tier = None;
    team
}

fn worldcup_candidate_players_for_team(team_def: &WorldCupNationalTeamDef, team_id: &str) -> Result<Vec<WorldCupCandidatePlayer>, String> {
    let alias_keys = team_def.aliases.iter().map(|alias| normalize_key(alias)).collect::<HashSet<_>>();
    let mut rows = fc26_rows()
        .iter()
        .filter(|row| alias_keys.contains(&normalize_key(&row.nation)))
        .collect::<Vec<_>>();
    rows.sort_by(|left, right| right.ovr.cmp(&left.ovr));

    let mut players = rows
        .iter()
        .enumerate()
        .map(|(index, row)| {
            let mut player = row_to_player(row, team_id, index);
            player.id = format!("wc26-{}", player.id);
            player.contract_end = None;
            player.wage = 0;
            player.market_value = 0;
            WorldCupCandidatePlayer {
                player,
                club: row.team.clone(),
            }
        })
        .collect::<Vec<_>>();

    players.extend(addition_players_for_team(team_def, team_id, players.len())?);
    Ok(players)
}

fn addition_players_for_team(team_def: &WorldCupNationalTeamDef, team_id: &str, offset: usize) -> Result<Vec<WorldCupCandidatePlayer>, String> {
    let additions = worldcup_additions()?;
    let alias_keys = team_def.aliases.iter().map(|alias| normalize_key(alias)).collect::<HashSet<_>>();
    let Some(team) = additions
        .teams
        .iter()
        .find(|team| alias_keys.contains(&normalize_key(&team.country)))
    else {
        return Ok(Vec::new());
    };

    Ok(team
        .players_to_add
        .iter()
        .cloned()
        .enumerate()
        .map(|(index, addition)| addition_to_player(addition, team_def, team_id, offset + index))
        .collect())
}

fn addition_to_player(
    addition: WorldCupAdditionPlayer,
    team_def: &WorldCupNationalTeamDef,
    team_id: &str,
    index: usize,
) -> WorldCupCandidatePlayer {
    let position = map_position(&addition.primary_position).unwrap_or(Position::CentralMidfielder);
    let row = Fc26PlayerRow {
        id: format!("wc-add-{}-{}", normalize_key(team_def.name), index),
        name: if addition.known_as.trim().is_empty() { addition.full_name.clone() } else { addition.known_as.clone() },
        ovr: addition.fc26_style_attributes.overall,
        potential: addition.fc26_style_attributes.potential,
        position: addition.primary_position,
        alternate_positions: addition.alternate_positions.join(","),
        position_ratings: HashMap::from([(position.clone(), addition.fc26_style_attributes.overall)]),
        age: addition.age_2026,
        dob: addition.date_of_birth,
        nation: addition.nationality_name,
        team: addition.current_club,
        preferred_foot: addition.preferred_foot,
        weak_foot: addition.fc26_style_attributes.weak_foot,
        value_eur: 0,
        wage_eur: 0,
        jersey_number: None,
        contract_end_year: None,
        skill_moves: addition.fc26_style_attributes.skill_moves,
        international_reputation: addition.fc26_style_attributes.international_reputation,
        work_rate: "Medium/Medium".to_string(),
        player_tags: String::new(),
        player_traits: String::new(),
        club_loaned_from: String::new(),
        club_joined_date: String::new(),
        release_clause_eur: 0,
        height_cm: addition.height_cm,
        weight_kg: 75,
        pace: addition.fc26_style_attributes.pace,
        shooting: addition.fc26_style_attributes.shooting,
        passing: addition.fc26_style_attributes.passing,
        dribbling: addition.fc26_style_attributes.dribbling,
        defending: addition.fc26_style_attributes.defending,
        physical: addition.fc26_style_attributes.physic,
        acceleration: addition.fc26_style_attributes.movement_acceleration,
        sprint_speed: addition.fc26_style_attributes.movement_sprint_speed,
        positioning: addition.fc26_style_attributes.mentality_positioning,
        finishing: addition.fc26_style_attributes.attacking_finishing,
        shot_power: addition.fc26_style_attributes.power_shot_power,
        vision: addition.fc26_style_attributes.mentality_vision,
        short_passing: addition.fc26_style_attributes.attacking_short_passing,
        long_passing: addition.fc26_style_attributes.skill_long_passing,
        ball_control: addition.fc26_style_attributes.skill_ball_control,
        reactions: addition.fc26_style_attributes.movement_reactions,
        composure: addition.fc26_style_attributes.mentality_composure,
        interceptions: addition.fc26_style_attributes.mentality_interceptions,
        heading_accuracy: addition.fc26_style_attributes.attacking_heading_accuracy,
        defensive_awareness: addition.fc26_style_attributes.defending_marking_awareness,
        standing_tackle: addition.fc26_style_attributes.defending_standing_tackle,
        sliding_tackle: addition.fc26_style_attributes.defending_sliding_tackle,
        jumping: addition.fc26_style_attributes.power_jumping,
        stamina: addition.fc26_style_attributes.power_stamina,
        strength: addition.fc26_style_attributes.power_strength,
        aggression: addition.fc26_style_attributes.mentality_aggression,
        gk_diving: addition.fc26_style_attributes.goalkeeping_diving,
        gk_handling: addition.fc26_style_attributes.goalkeeping_handling,
        gk_kicking: addition.fc26_style_attributes.goalkeeping_kicking,
        gk_positioning: addition.fc26_style_attributes.goalkeeping_positioning,
        gk_reflexes: addition.fc26_style_attributes.goalkeeping_reflexes,
    };
    let club = row.team.clone();
    let mut player = row_to_player(&row, team_id, index);
    player.id = format!("wc26-add-{}-{}", normalize_key(team_def.name), index);
    player.contract_end = None;
    player.wage = 0;
    player.market_value = 0;
    WorldCupCandidatePlayer { player, club }
}

fn select_worldcup_players_by_id(
    candidates: Vec<WorldCupCandidatePlayer>,
    selected_player_ids: &[String],
) -> Result<Vec<WorldCupCandidatePlayer>, String> {
    if selected_player_ids.len() != WORLDCUP_SQUAD_SIZE {
        return Err("be.error.worldCupCallup.invalidSquadSize".to_string());
    }
    let selected_ids = selected_player_ids.iter().cloned().collect::<HashSet<_>>();
    let selected = candidates
        .into_iter()
        .filter(|candidate| selected_ids.contains(&candidate.player.id))
        .collect::<Vec<_>>();
    if selected.len() != WORLDCUP_SQUAD_SIZE {
        return Err("be.error.worldCupCallup.invalidPlayerIds".to_string());
    }
    if selected.iter().filter(|candidate| candidate.player.position == Position::Goalkeeper).count() < 3 {
        return Err("be.error.worldCupCallup.minGoalkeepers".to_string());
    }
    Ok(selected)
}

fn auto_select_worldcup_players(candidates: Vec<WorldCupCandidatePlayer>) -> Vec<WorldCupCandidatePlayer> {
    let mut selected = Vec::new();
    let mut used_ids = HashSet::new();
    for (group, quota) in [(Position::Goalkeeper, 3), (Position::Defender, 8), (Position::Midfielder, 8), (Position::Forward, 7)] {
        let mut group_players = candidates
            .iter()
            .filter(|candidate| candidate.player.position.to_group_position() == group)
            .collect::<Vec<_>>();
        group_players.sort_by(|left, right| right.player.ovr.cmp(&left.player.ovr));
        for candidate in group_players.into_iter().take(quota) {
            if used_ids.insert(candidate.player.id.clone()) {
                selected.push(candidate.clone());
            }
        }
    }
    let mut remaining = candidates.iter().collect::<Vec<_>>();
    remaining.sort_by(|left, right| right.player.ovr.cmp(&left.player.ovr));
    for candidate in remaining {
        if selected.len() >= WORLDCUP_SQUAD_SIZE {
            break;
        }
        if used_ids.insert(candidate.player.id.clone()) {
            selected.push(candidate.clone());
        }
    }
    selected
}

fn player_age_2026(date_of_birth: &str) -> u8 {
    date_of_birth
        .get(0..4)
        .and_then(|year| year.parse::<u16>().ok())
        .map(|year| 2026u16.saturating_sub(year).min(99) as u8)
        .unwrap_or(0)
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
    for row in fc26_rows() {
        grouped.entry(row.team.clone()).or_default().push(row.clone());
    }
    grouped
}

fn rows_for_team<'a>(
    tdef: &TeamDef,
    rows_by_team: &'a HashMap<String, Vec<Fc26PlayerRow>>,
) -> Option<&'a [Fc26PlayerRow]> {
    let aliases = team_alias_map();
    let candidates = [
        aliases.get(tdef.name.as_str()).copied(),
        Some(tdef.name.as_str()),
    ];

    for candidate in candidates.into_iter().flatten() {
        if let Some(rows) = rows_by_team.get(candidate) {
            return Some(rows.as_slice());
        }
    }

    let target_key = normalized_team_key(&tdef.name);
    rows_by_team
        .iter()
        .find(|(name, _)| normalized_team_key(name) == target_key)
        .map(|(_, rows)| rows.as_slice())
}

fn resolve_fc26_loans(
    rows_by_team: &HashMap<String, Vec<Fc26PlayerRow>>,
    teams: &[Team],
    players: &mut [Player],
) {
    let team_ids = build_generated_team_id_lookup(rows_by_team, teams);
    let rows_by_player_id = rows_by_team
        .values()
        .flat_map(|rows| rows.iter())
        .map(|row| (format!("fc26-{}", row.id), row))
        .collect::<HashMap<_, _>>();

    for player in players {
        let Some(row) = rows_by_player_id.get(&player.id) else {
            continue;
        };
        let loaned_from = row.club_loaned_from.trim();
        if loaned_from.is_empty() {
            continue;
        }
        let Some(parent_team_id) = team_ids.get(&normalized_team_key(loaned_from)) else {
            continue;
        };
        if player.team_id.as_deref() == Some(parent_team_id.as_str()) {
            continue;
        }

        player.loan_parent_team_id = Some(parent_team_id.clone());
        player.loan_until = player.contract_end.clone().or_else(|| Some("2027-06-30".to_string()));
        player.loan_wage_share_percent = Some(50);
    }
}

fn build_generated_team_id_lookup(
    rows_by_team: &HashMap<String, Vec<Fc26PlayerRow>>,
    teams: &[Team],
) -> HashMap<String, String> {
    let aliases = team_alias_map();
    let mut lookup = HashMap::new();
    for team in teams {
        lookup.insert(normalized_team_key(&team.name), team.id.clone());
        if let Some(alias) = aliases.get(team.name.as_str()) {
            lookup.insert(normalized_team_key(alias), team.id.clone());
        }
        if let Some(rows) = rows_for_generated_team_name(&team.name, rows_by_team) {
            if let Some(row) = rows.first() {
                lookup.insert(normalized_team_key(&row.team), team.id.clone());
            }
        }
    }
    lookup
}

fn rows_for_generated_team_name<'a>(
    team_name: &str,
    rows_by_team: &'a HashMap<String, Vec<Fc26PlayerRow>>,
) -> Option<&'a [Fc26PlayerRow]> {
    let aliases = team_alias_map();
    for candidate in [aliases.get(team_name).copied(), Some(team_name)].into_iter().flatten() {
        if let Some(rows) = rows_by_team.get(candidate) {
            return Some(rows.as_slice());
        }
    }
    let target_key = normalized_team_key(team_name);
    rows_by_team
        .iter()
        .find(|(name, _)| normalized_team_key(name) == target_key)
        .map(|(_, rows)| rows.as_slice())
}

fn normalize_key(name: &str) -> String {
    normalized_team_key(name)
}

fn normalized_team_key(name: &str) -> String {
    name.chars()
        .filter_map(|ch| match ch {
            'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' | 'ā' | 'ă' | 'ą' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' | 'Å' | 'Ā' | 'Ă' | 'Ą' => Some('a'),
            'ç' | 'ć' | 'č' | 'Ç' | 'Ć' | 'Č' => Some('c'),
            'ď' | 'Đ' | 'đ' => Some('d'),
            'é' | 'è' | 'ê' | 'ë' | 'ē' | 'ė' | 'ę' | 'É' | 'È' | 'Ê' | 'Ë' | 'Ē' | 'Ė' | 'Ę' => Some('e'),
            'í' | 'ì' | 'î' | 'ï' | 'ī' | 'Í' | 'Ì' | 'Î' | 'Ï' | 'Ī' => Some('i'),
            'ñ' | 'ń' | 'Ñ' | 'Ń' => Some('n'),
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'ø' | 'ō' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' | 'Ø' | 'Ō' => Some('o'),
            'ř' | 'Ř' => Some('r'),
            'š' | 'ś' | 'Š' | 'Ś' => Some('s'),
            'ť' | 'Ť' => Some('t'),
            'ú' | 'ù' | 'û' | 'ü' | 'ū' | 'Ú' | 'Ù' | 'Û' | 'Ü' | 'Ū' => Some('u'),
            'ý' | 'ÿ' | 'Ý' => Some('y'),
            'ž' | 'ź' | 'ż' | 'Ž' | 'Ź' | 'Ż' => Some('z'),
            _ if ch.is_ascii_alphanumeric() => Some(ch.to_ascii_lowercase()),
            _ => None,
        })
        .collect()
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
    let attrs = enriched_attributes_from_row(row, &position);
    let dob = if is_iso_date(&row.dob) {
        row.dob.clone()
    } else {
        date_of_birth(row.age, &row.id, index)
    };
    let nationality = canonicalize_generated_nationality(&row.nation);
    let mut player = Player::new(
        format!("fc26-{}", row.id),
        row.name.clone(),
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
    player.contract_end = row
        .contract_end_year
        .filter(|year| (2026..=2040).contains(year))
        .map(|year| format!("{}-06-30", year.saturating_add(1).min(2040)))
        .or_else(|| contract_end_from_joined_date(&row.club_joined_date, row.age, index))
        .or_else(|| Some(contract_end(row.age, index)));
    player.squad_number = row.jersey_number;
    player.squad_tier = SquadTier::Reserve;
    player.position_ratings = row.position_ratings.clone();
    refresh_player_derived(&mut player, 2026);
    add_imported_traits(&mut player.traits, imported_traits_from_row(row));
    player.ovr = player
        .position_ratings
        .get(&player.natural_position)
        .copied()
        .unwrap_or(player.ovr)
        .clamp(1, 99);
    player.potential = if row.potential > 0 {
        row.potential.clamp(player.ovr, 99)
    } else {
        generate_potential(player.ovr, row.age as u32).max(player.ovr)
    };
    let economy_ovr = player.ovr;
    set_economy(&mut player, row.age as u32, economy_ovr);
    if row.value_eur > 0 {
        player.market_value = row.value_eur;
    } else if row.release_clause_eur > 0 {
        player.market_value = round_money((row.release_clause_eur / 2).clamp(100_000, 250_000_000), 50_000);
    }
    if row.wage_eur > 0 {
        player.wage = round_money(row.wage_eur.saturating_mul(52), 5_000) as u32;
    }
    player
}

fn enriched_attributes_from_row(row: &Fc26PlayerRow, position: &Position) -> PlayerAttributes {
    let mut attrs = attributes_from_row(row, position);
    apply_skill_reputation_modifiers(&mut attrs, row);
    apply_work_rate_modifiers(&mut attrs, row);
    apply_body_modifiers(&mut attrs, row, position);
    attrs
}

fn attributes_from_row(row: &Fc26PlayerRow, position: &Position) -> PlayerAttributes {
    if matches!(position, Position::Goalkeeper) {
        return PlayerAttributes {
            pace: row.pace.max((row.acceleration as u16 + row.sprint_speed as u16) as u8 / 2).clamp(25, 99),
            stamina: row.stamina.clamp(35, 99),
            strength: row.strength.max(row.physical.saturating_sub(6)).clamp(35, 99),
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
        stamina: row.stamina.clamp(1, 99),
        strength: row.strength.clamp(1, 99),
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
        aerial: outfield_aerial(row).clamp(1, 99),
    }
}

fn outfield_aerial(row: &Fc26PlayerRow) -> u8 {
    let base = ((row.heading_accuracy as u16 * 2 + row.jumping as u16) / 3) as u8;
    base.max(row.jumping.saturating_sub(8))
}

fn apply_skill_reputation_modifiers(attrs: &mut PlayerAttributes, row: &Fc26PlayerRow) {
    let skill_bonus = match row.skill_moves {
        5 => 3,
        4 => 2,
        3 => 1,
        _ => 0,
    };
    boost(&mut attrs.dribbling, skill_bonus);
    boost(&mut attrs.agility, skill_bonus);
    boost(&mut attrs.composure, skill_bonus.saturating_sub(1));

    let reputation_bonus = match row.international_reputation {
        5 => 4,
        4 => 3,
        3 => 2,
        2 => 1,
        _ => 0,
    };
    boost(&mut attrs.leadership, reputation_bonus);
    boost(&mut attrs.composure, reputation_bonus);
    boost(&mut attrs.teamwork, reputation_bonus.saturating_sub(1));
}

fn apply_work_rate_modifiers(attrs: &mut PlayerAttributes, row: &Fc26PlayerRow) {
    let (attacking, defensive) = parse_work_rate(&row.work_rate);
    if attacking == WorkRate::High || defensive == WorkRate::High {
        boost_capped(&mut attrs.stamina, 1, 88);
        boost(&mut attrs.teamwork, 1);
    }
    if attacking == WorkRate::High {
        boost(&mut attrs.positioning, 2);
        boost(&mut attrs.decisions, 1);
    }
    if defensive == WorkRate::High {
        boost(&mut attrs.defending, 2);
        boost(&mut attrs.tackling, 2);
        boost(&mut attrs.decisions, 1);
    }
}

fn apply_body_modifiers(attrs: &mut PlayerAttributes, row: &Fc26PlayerRow, position: &Position) {
    if row.height_cm >= 190 {
        boost(&mut attrs.aerial, if matches!(position, Position::Goalkeeper) { 3 } else { 2 });
    } else if row.height_cm > 0 && row.height_cm <= 175 {
        boost(&mut attrs.agility, 2);
    }

    if row.weight_kg >= 85 {
        boost_capped(&mut attrs.strength, 1, 88);
    } else if row.weight_kg > 0 && row.weight_kg <= 68 {
        boost(&mut attrs.agility, 1);
        boost(&mut attrs.pace, 1);
    }
}

fn boost(value: &mut u8, amount: u8) {
    *value = value.saturating_add(amount).clamp(1, 99);
}

fn boost_capped(value: &mut u8, amount: u8, cap: u8) {
    *value = value.saturating_add(amount).min(cap).clamp(1, 99);
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum WorkRate {
    Low,
    Medium,
    High,
}

fn parse_work_rate(raw: &str) -> (WorkRate, WorkRate) {
    let mut parts = raw.split('/').map(|part| parse_single_work_rate(part.trim()));
    let attacking = parts.next().unwrap_or(WorkRate::Medium);
    let defensive = parts.next().unwrap_or(WorkRate::Medium);
    (attacking, defensive)
}

fn parse_single_work_rate(raw: &str) -> WorkRate {
    match raw.to_ascii_lowercase().as_str() {
        "high" => WorkRate::High,
        "low" => WorkRate::Low,
        _ => WorkRate::Medium,
    }
}

fn imported_traits_from_row(row: &Fc26PlayerRow) -> Vec<PlayerTrait> {
    let mut traits = Vec::new();
    for raw in row.player_tags.split(',').chain(row.player_traits.split(',')) {
        if let Some(player_trait) = map_imported_trait(raw) {
            traits.push(player_trait);
        }
    }
    traits
}

fn map_imported_trait(raw: &str) -> Option<PlayerTrait> {
    let normalized = raw
        .trim()
        .trim_matches(|ch| ch == '[' || ch == ']' || ch == '\'' || ch == '"')
        .trim_start_matches('#')
        .to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }

    if normalized.contains("dribbler") || normalized.contains("flair") || normalized.contains("technical") {
        Some(PlayerTrait::Dribbler)
    } else if normalized.contains("playmaker") || normalized.contains("passer") || normalized.contains("incisive pass") {
        Some(PlayerTrait::Playmaker)
    } else if normalized.contains("vision") || normalized.contains("complete midfielder") {
        Some(PlayerTrait::Visionary)
    } else if normalized.contains("clinical") || normalized.contains("finisher") || normalized.contains("power shot") {
        Some(PlayerTrait::Sharpshooter)
    } else if normalized.contains("free kick") || normalized.contains("dead ball") || normalized.contains("set piece") {
        Some(PlayerTrait::SetPieceSpecialist)
    } else if normalized.contains("speed") || normalized.contains("rapid") || normalized.contains("quick step") {
        Some(PlayerTrait::Speedster)
    } else if normalized.contains("leader") {
        Some(PlayerTrait::Leader)
    } else if normalized.contains("team player") || normalized.contains("solid player") {
        Some(PlayerTrait::TeamPlayer)
    } else if normalized.contains("composed") || normalized.contains("cool") {
        Some(PlayerTrait::CoolHead)
    } else if normalized.contains("ball winner") || normalized.contains("tackl") || normalized.contains("intercept") {
        Some(PlayerTrait::BallWinner)
    } else if normalized.contains("aerial") || normalized.contains("power header") {
        Some(PlayerTrait::AerialDominance)
    } else if normalized.contains("complete forward") {
        Some(PlayerTrait::CompleteForward)
    } else if normalized.contains("engine") || normalized.contains("relentless") {
        Some(PlayerTrait::Engine)
    } else {
        None
    }
}

fn add_imported_traits(existing: &mut Vec<PlayerTrait>, imported: Vec<PlayerTrait>) {
    for player_trait in imported {
        if !existing.contains(&player_trait) {
            existing.push(player_trait);
        }
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

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(idx, byte)| idx == 4 || idx == 7 || byte.is_ascii_digit())
}

fn contract_end_from_joined_date(joined_date: &str, age: u8, index: usize) -> Option<String> {
    let joined_year = joined_date.get(0..4)?.parse::<u32>().ok()?;
    if !(2010..=2026).contains(&joined_year) {
        return None;
    }
    let initial_years = if age <= 23 { 5 } else if age <= 30 { 4 } else { 2 + index as u8 % 2 } as u32;
    let end_year = (joined_year + initial_years).clamp(2026, 2040);
    Some(format!("{end_year}-06-30"))
}

fn contract_end(age: u8, index: usize) -> String {
    let years = if age <= 23 { 5 } else if age <= 30 { 4 } else { 2 + index as u8 % 2 };
    format!("{}-06-30", 2026 + years as u32)
}

fn preferred_player_name(eafc_name: &str, short_name: &str, full_name: &str) -> String {
    [eafc_name, short_name, full_name]
        .iter()
        .map(|name| name.trim())
        .find(|name| !name.is_empty())
        .unwrap_or_default()
        .to_string()
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

fn primary_position(club_position: &str, player_positions: &str) -> String {
    if map_position(club_position).is_some() {
        return normalize_position_code(club_position).to_string();
    }

    player_positions
        .split(',')
        .map(str::trim)
        .find(|code| map_position(code).is_some())
        .map(normalize_position_code)
        .unwrap_or("CM")
        .to_string()
}

fn normalize_position_code(code: &str) -> &str {
    match code.trim() {
        "SUB" | "RES" => "",
        "RCB" | "LCB" => "CB",
        "RDM" | "LDM" => "CDM",
        "RCM" | "LCM" => "CM",
        "RAM" | "LAM" => "CAM",
        "RS" | "LS" => "ST",
        "RF" | "LF" => "CF",
        other => other,
    }
}

fn map_position(code: &str) -> Option<Position> {
    Some(match normalize_position_code(code) {
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

fn parse_position_ratings(get: &impl Fn(&str) -> String) -> HashMap<Position, u8> {
    let mut ratings = HashMap::<Position, u8>::new();
    for (column, position) in [
        ("ls", Position::Striker),
        ("st", Position::Striker),
        ("rs", Position::Striker),
        ("lf", Position::Striker),
        ("cf", Position::Striker),
        ("rf", Position::Striker),
        ("lw", Position::LeftWinger),
        ("rw", Position::RightWinger),
        ("lam", Position::AttackingMidfielder),
        ("cam", Position::AttackingMidfielder),
        ("ram", Position::AttackingMidfielder),
        ("lm", Position::LeftMidfielder),
        ("lcm", Position::CentralMidfielder),
        ("cm", Position::CentralMidfielder),
        ("rcm", Position::CentralMidfielder),
        ("rm", Position::RightMidfielder),
        ("lwb", Position::LeftWingBack),
        ("ldm", Position::DefensiveMidfielder),
        ("cdm", Position::DefensiveMidfielder),
        ("rdm", Position::DefensiveMidfielder),
        ("rwb", Position::RightWingBack),
        ("lb", Position::LeftBack),
        ("lcb", Position::CenterBack),
        ("cb", Position::CenterBack),
        ("rcb", Position::CenterBack),
        ("rb", Position::RightBack),
        ("gk", Position::Goalkeeper),
    ] {
        let rating = get(column).parse::<u8>().unwrap_or(0).clamp(1, 99);
        if rating > 1 {
            ratings
                .entry(position)
                .and_modify(|existing| *existing = (*existing).max(rating))
                .or_insert(rating);
        }
    }
    ratings
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
    let eafc_names = parse_eafc_names_by_id();

    records
        .iter()
        .skip(1)
        .filter_map(|record| row_from_record(record, &indexes, &eafc_names))
        .collect()
}

fn parse_eafc_names_by_id() -> HashMap<String, String> {
    let records = parse_csv(EAFC26_CSV);
    let Some(header) = records.first() else {
        return HashMap::new();
    };
    let indexes = header
        .iter()
        .enumerate()
        .map(|(index, name)| (name.as_str(), index))
        .collect::<HashMap<_, _>>();
    let id_index = indexes.get("ID").copied();
    let name_index = indexes.get("Name").copied();

    records
        .iter()
        .skip(1)
        .filter_map(|record| {
            let id = record.get(id_index?)?.trim();
            let name = record.get(name_index?)?.trim();
            (!id.is_empty() && !name.is_empty()).then(|| (id.to_string(), name.to_string()))
        })
        .collect()
}

fn row_from_record(
    record: &[String],
    indexes: &HashMap<&str, usize>,
    eafc_names: &HashMap<String, String>,
) -> Option<Fc26PlayerRow> {
    let get = |name: &str| -> String {
        indexes
            .get(name)
            .and_then(|index| record.get(*index))
            .cloned()
            .unwrap_or_default()
    };
    let num = |name: &str| -> u8 { get(name).parse::<u8>().unwrap_or(0) };
    let money = |name: &str| -> u64 { get(name).parse::<u64>().unwrap_or(0) };
    let optional_number = |name: &str| -> Option<u8> {
        get(name)
            .parse::<u8>()
            .ok()
            .filter(|value| (1..=99).contains(value))
    };
    let optional_year = |name: &str| -> Option<u32> { get(name).parse::<u32>().ok() };

    let id = get("player_id");
    let full_name = get("long_name");
    let eafc_name = eafc_names.get(&id).map(String::as_str).unwrap_or_default();
    let name = preferred_player_name(eafc_name, &get("short_name"), &full_name);
    let team = get("club_name");
    if id.is_empty() || name.is_empty() {
        return None;
    }

    let alternate_positions = get("player_positions");
    let position = primary_position(&get("club_position"), &alternate_positions);
    let position_ratings = parse_position_ratings(&get);

    Some(Fc26PlayerRow {
        id,
        name,
        ovr: num("overall"),
        potential: num("potential"),
        position,
        alternate_positions,
        position_ratings,
        age: num("age"),
        dob: get("dob"),
        nation: get("nationality_name"),
        team,
        preferred_foot: get("preferred_foot"),
        weak_foot: num("weak_foot"),
        value_eur: money("value_eur"),
        wage_eur: money("wage_eur"),
        jersey_number: optional_number("club_jersey_number"),
        contract_end_year: optional_year("club_contract_valid_until_year"),
        skill_moves: num("skill_moves"),
        international_reputation: num("international_reputation"),
        work_rate: get("work_rate"),
        player_tags: get("player_tags"),
        player_traits: get("player_traits"),
        club_loaned_from: get("club_loaned_from"),
        club_joined_date: get("club_joined_date"),
        release_clause_eur: money("release_clause_eur"),
        height_cm: num("height_cm"),
        weight_kg: num("weight_kg"),
        pace: num("pace"),
        shooting: num("shooting"),
        passing: num("passing"),
        dribbling: num("dribbling"),
        defending: num("defending"),
        physical: num("physic"),
        acceleration: num("movement_acceleration"),
        sprint_speed: num("movement_sprint_speed"),
        positioning: num("mentality_positioning"),
        finishing: num("attacking_finishing"),
        shot_power: num("power_shot_power"),
        vision: num("mentality_vision"),
        short_passing: num("attacking_short_passing"),
        long_passing: num("skill_long_passing"),
        ball_control: num("skill_ball_control"),
        reactions: num("movement_reactions"),
        composure: num("mentality_composure"),
        interceptions: num("mentality_interceptions"),
        heading_accuracy: num("attacking_heading_accuracy"),
        defensive_awareness: num("defending_marking_awareness"),
        standing_tackle: num("defending_standing_tackle"),
        sliding_tackle: num("defending_sliding_tackle"),
        jumping: num("power_jumping"),
        stamina: num("power_stamina"),
        strength: num("power_strength"),
        aggression: num("mentality_aggression"),
        gk_diving: num("goalkeeping_diving"),
        gk_handling: num("goalkeeping_handling"),
        gk_kicking: num("goalkeeping_kicking"),
        gk_positioning: num("goalkeeping_positioning"),
        gk_reflexes: num("goalkeeping_reflexes"),
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
        ("Lyon", "Olympique Lyonnais"),
        ("Marseille", "OM"),
        ("Nantes", "FC Nantes"),
        ("Nice", "OGC Nice"),
        ("Paris Saint-Germain", "Paris SG"),
        ("RC Strasbourg Alsace", "Strasbourg"),
        ("Rennes", "Stade Rennais FC"),
        ("Toulouse", "Toulouse FC"),
        ("Amiens", "Amiens SC"),
        ("Annecy", "FC Annecy"),
        ("Bastia", "Sporting Club Bastia"),
        ("Boulogne", "US Boulogne"),
        ("Clermont Foot", "Clermont Foot 63"),
        ("Dunkerque", "USL Dunkerque"),
        ("Guingamp", "En Avant Guingamp"),
        ("Le Mans", "Le Mans FC"),
        ("Nancy", "AS Nancy Lorraine"),
        ("Pau", "Pau FC"),
        ("Rodez AF", "Rodez Aveyron Football"),
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
        ("Verona", "Hellas Verona FC"),
        ("Carrarese", "Carrarese Calcio"),
        ("Juve Stabia", "SS Juve Stabia"),
        ("Mantova 1911", "Mantova"),
        ("US Avellino 1912", "Avellino"),
        ("Virtus Entella", "Entella"),
        ("Atlético Madrid", "Atlético de Madrid"),
        ("Barcelona", "FC Barcelona"),
        ("Celta Vigo", "Celta"),
        ("Deportivo Alavés", "Deportivo Alavés"),
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
        ("Nacional da Madeira", "CD Nacional"),
        ("SC Braga", "Sporting Clube de Braga"),
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
        ("Charleroi", "Royal Charleroi Sporting Club"),
        ("Genk", "KRC Genk"),
        ("Gent", "KAA Gent"),
        ("Mechelen", "KV Mechelen"),
        ("Oud-Heverlee Leuven", "OH Leuven"),
        ("Sint-Truidense", "STVV"),
        ("Standard Liège", "Standard Liège"),
        ("Union Saint-Gilloise", "R. Union St.-G."),
        ("Westerlo", "KVC Westerlo"),
        ("Fulham", "Fulham FC"),
        ("Millwall", "Millwall FC"),
        ("Celta Vigo", "RC Celta"),
        ("Deportivo Alavés", "Deportivo Alavés"),
        ("Real Betis", "Real Betis Balompié"),
        ("Albacete", "Albacete Balompié"),
        ("Deportivo La Coruña", "RC Deportivo de La Coruña"),
        ("Sporting Gijón", "Real Sporting de Gijón"),
        ("Valladolid", "Real Valladolid CF"),
        ("Milan", "AC Milan"),
        ("Bari", "SSC Bari"),
        ("Cesena", "Cesena FC"),
        ("Palermo", "Palermo FC"),
        ("Bayer Leverkusen", "Bayer 04 Leverkusen"),
        ("FC Heidenheim", "1. FC Heidenheim 1846"),
        ("Hoffenheim", "TSG 1899 Hoffenheim"),
        ("Union Berlin", "1. FC Union Berlin"),
        ("Arminia Bielefeld", "DSC Arminia Bielefeld"),
        ("FC Kaiserslautern", "1. FC Kaiserslautern"),
        ("Preußen Münster", "SC Preußen Münster"),
        ("Lille", "Lille OSC"),
        ("Marseille", "Olympique de Marseille"),
        ("Boulogne", "US Boulogne Cote d'Opale"),
        ("Montpellier", "Montpellier HSC"),
        ("Stade Lavallois", "Stade Lavallois Mayenne FC"),
        ("Arouca", "FC Arouca"),
        ("Casa Pia AC", "Casa Pia"),
        ("Estoril", "GD Estoril Praia"),
        ("Gil Vicente", "Gil Vicente FC"),
        ("Cercle Brugge", "Cercle Brugge KSV"),
        ("Club Brugge", "Club Brugge KV"),
        ("Sint-Truidense", "Sint-Truidense VV"),
        ("Standard Liège", "Standard de Liège"),
        ("Zulte Waregem", "SV Zulte Waregem"),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_finds_known_fc26_alias_teams() {
        let teams = rows_by_team().keys().cloned().collect::<HashSet<_>>();
        for team in ["AC Milan", "Inter", "Lazio", "Atalanta", "Manchester United", "Sint-Truidense VV"] {
            assert!(teams.contains(team), "missing FC26 alias team {team}");
        }
    }

    #[test]
    fn alias_map_covers_default_teams() {
        let rows = rows_by_team();
        let missing = default_teams_definition()
            .teams
            .iter()
            .filter_map(|team| rows_for_team(team, &rows).is_none().then(|| team.name.clone()))
            .collect::<Vec<_>>();

        assert!(missing.is_empty(), "missing FC26 aliases: {missing:?}");
    }

    #[test]
    fn generate_fc26_world_uses_only_real_players() {
        let (teams, players, staff) = generate_fc26_world().unwrap();
        assert_eq!(teams.len(), 248);
        assert_eq!(staff.len(), 248 * 4 + 12);
        assert!(!players.is_empty());
        assert!(players.iter().all(|player| player.id.starts_with("fc26-")));

        for team in &teams {
            let squad = players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
                .collect::<Vec<_>>();
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
    fn worldcup_fc26_qatar_has_a_full_squad() {
        let (teams, players, _) = generate_worldcup_fc26_world().unwrap();
        let qatar = teams.iter().find(|team| team.name == "Qatar").expect("Qatar");
        let squad_count = players
            .iter()
            .filter(|player| player.team_id.as_deref() == Some(qatar.id.as_str()))
            .count();

        assert_eq!(squad_count, WORLDCUP_SQUAD_SIZE);
    }

    #[test]
    fn fc26_trait_mapping_uses_existing_player_traits() {
        assert_eq!(map_imported_trait("#Dribbler"), Some(PlayerTrait::Dribbler));
        assert_eq!(map_imported_trait("Incisive Pass"), Some(PlayerTrait::Playmaker));
        assert_eq!(map_imported_trait("Power Shot"), Some(PlayerTrait::Sharpshooter));
        assert_eq!(map_imported_trait("Dead Ball"), Some(PlayerTrait::SetPieceSpecialist));
        assert_eq!(map_imported_trait("Rapid"), Some(PlayerTrait::Speedster));
    }

    #[test]
    fn fc26_work_rate_parsing_handles_attack_and_defence() {
        assert_eq!(parse_work_rate("High/Medium"), (WorkRate::High, WorkRate::Medium));
        assert_eq!(parse_work_rate("Medium/High"), (WorkRate::Medium, WorkRate::High));
        assert_eq!(parse_work_rate("Low/Low"), (WorkRate::Low, WorkRate::Low));
    }

    #[test]
    fn fc26_player_name_prefers_eafc_name() {
        assert_eq!(
            preferred_player_name("Jude Bellingham", "J. Bellingham", "Jude Victor William Bellingham"),
            "Jude Bellingham"
        );
        assert_eq!(preferred_player_name("", "J. Bellingham", "Jude Victor William Bellingham"), "J. Bellingham");
    }

    #[test]
    fn fc26_attribute_enrichment_is_bounded() {
        let mut row = test_row();
        row.skill_moves = 5;
        row.international_reputation = 4;
        row.work_rate = "High/High".to_string();
        row.height_cm = 195;
        row.weight_kg = 88;

        let base = attributes_from_row(&row, &Position::Striker);
        let enriched = enriched_attributes_from_row(&row, &Position::Striker);

        assert!(enriched.dribbling > base.dribbling);
        assert!(enriched.leadership > base.leadership);
        assert!(enriched.stamina > base.stamina);
        assert!(enriched.aerial > base.aerial);
        assert!(enriched.strength > base.strength);
        assert!(enriched.dribbling <= 99);
    }

    #[test]
    fn fc26_release_clause_only_fills_missing_value() {
        let mut row = test_row();
        row.value_eur = 0;
        row.release_clause_eur = 20_000_000;
        let player = row_to_player(&row, "team", 0);
        assert_eq!(player.market_value, 10_000_000);
    }

    #[test]
    fn fc26_real_player_value_uses_dataset_value() {
        let mut row = test_row();
        row.age = 19;
        row.value_eur = 150_000_000;
        let player = row_to_player(&row, "team", 0);
        assert_eq!(player.market_value, 150_000_000);
    }

    #[test]
    fn fc26_natural_ovr_uses_position_rating() {
        let mut row = test_row();
        row.ovr = 85;
        row.position = "ST".to_string();
        row.position_ratings = HashMap::from([
            (Position::Striker, 76),
            (Position::CenterBack, 44),
        ]);

        let player = row_to_player(&row, "team", 0);

        assert_eq!(player.ovr, 76);
        assert_eq!(player.position_ratings.get(&Position::CenterBack), Some(&44));
    }

    #[test]
    fn fc26_position_rating_parser_keeps_best_alias() {
        let values = HashMap::from([
            ("st", "74"),
            ("ls", "76"),
            ("rs", "75"),
            ("lcb", "60"),
            ("cb", "63"),
            ("rcb", "62"),
            ("gk", "0"),
        ]);
        let get = |name: &str| values.get(name).copied().unwrap_or_default().to_string();

        let ratings = parse_position_ratings(&get);

        assert_eq!(ratings.get(&Position::Striker), Some(&76));
        assert_eq!(ratings.get(&Position::CenterBack), Some(&63));
        assert!(!ratings.contains_key(&Position::Goalkeeper));
    }

    #[test]
    fn fc26_loan_resolution_only_uses_known_parent_teams() {
        let current_team = Team::new(
            "current".to_string(),
            "Current FC".to_string(),
            "CUR".to_string(),
            "England".to_string(),
            "Current".to_string(),
            "Current Ground".to_string(),
            20_000,
        );
        let parent_team = Team::new(
            "parent".to_string(),
            "Parent FC".to_string(),
            "PAR".to_string(),
            "England".to_string(),
            "Parent".to_string(),
            "Parent Ground".to_string(),
            30_000,
        );
        let mut row = test_row();
        row.club_loaned_from = "Parent FC".to_string();
        let mut rows = HashMap::new();
        let mut parent_row = test_row_with_team("Parent FC");
        parent_row.id = "456".to_string();
        rows.insert("Current FC".to_string(), vec![row.clone()]);
        rows.insert("Parent FC".to_string(), vec![parent_row]);
        let mut players = vec![row_to_player(&row, "current", 0)];

        resolve_fc26_loans(&rows, &[current_team, parent_team], &mut players);

        assert_eq!(players[0].loan_parent_team_id.as_deref(), Some("parent"));
        assert_eq!(players[0].loan_wage_share_percent, Some(50));

        rows.remove("Parent FC");
        let mut unresolved = row.clone();
        unresolved.id = "999".to_string();
        unresolved.club_loaned_from = "Missing FC".to_string();
        let mut players = vec![row_to_player(&unresolved, "current", 0)];
        rows.insert("Current FC".to_string(), vec![unresolved]);
        resolve_fc26_loans(&rows, &[Team::new("current".to_string(), "Current FC".to_string(), "CUR".to_string(), "England".to_string(), "Current".to_string(), "Current Ground".to_string(), 20_000)], &mut players);
        assert!(players[0].loan_parent_team_id.is_none());
    }

    #[test]
    fn generate_fc26_world_maps_known_players() {
        let (teams, players, _) = generate_fc26_world().unwrap();
        let real_madrid = teams.iter().find(|team| team.name == "Real Madrid").expect("Real Madrid");
        let bellingham = players
            .iter()
            .find(|player| {
                player.team_id.as_deref() == Some(real_madrid.id.as_str())
                    && player.full_name == "Jude Bellingham"
            })
            .expect("Jude Bellingham");

        assert_eq!(bellingham.date_of_birth, "2003-06-29");
        assert_eq!(bellingham.natural_position, Position::AttackingMidfielder);
        assert_eq!(bellingham.footedness, Footedness::Right);
        assert_eq!(bellingham.weak_foot, 4);
        assert!(bellingham.ovr >= 90);
        assert!(bellingham.potential >= 94);
        assert_eq!(bellingham.squad_number, Some(5));
        assert_eq!(bellingham.contract_end.as_deref(), Some("2030-06-30"));
        assert_eq!(bellingham.market_value, 174_500_000);
        assert_eq!(bellingham.wage, 16_640_000);
    }

    fn test_row() -> Fc26PlayerRow {
        test_row_with_team("Current FC")
    }

    fn test_row_with_team(team: &str) -> Fc26PlayerRow {
        Fc26PlayerRow {
            id: "123".to_string(),
            name: "Test Player".to_string(),
            ovr: 75,
            potential: 80,
            position: "ST".to_string(),
            alternate_positions: "ST".to_string(),
            position_ratings: HashMap::from([
                (Position::Striker, 73),
                (Position::CenterBack, 38),
            ]),
            age: 24,
            dob: "2002-01-01".to_string(),
            nation: "England".to_string(),
            team: team.to_string(),
            preferred_foot: "Right".to_string(),
            weak_foot: 3,
            value_eur: 1_000_000,
            wage_eur: 10_000,
            jersey_number: Some(9),
            contract_end_year: Some(2028),
            skill_moves: 3,
            international_reputation: 1,
            work_rate: "Medium/Medium".to_string(),
            player_tags: String::new(),
            player_traits: String::new(),
            club_loaned_from: String::new(),
            club_joined_date: "2024-07-01".to_string(),
            release_clause_eur: 0,
            height_cm: 180,
            weight_kg: 75,
            pace: 70,
            shooting: 72,
            passing: 68,
            dribbling: 70,
            defending: 40,
            physical: 70,
            acceleration: 70,
            sprint_speed: 70,
            positioning: 72,
            finishing: 74,
            shot_power: 70,
            vision: 68,
            short_passing: 68,
            long_passing: 65,
            ball_control: 70,
            reactions: 70,
            composure: 70,
            interceptions: 40,
            heading_accuracy: 68,
            defensive_awareness: 40,
            standing_tackle: 40,
            sliding_tackle: 38,
            jumping: 70,
            stamina: 70,
            strength: 70,
            aggression: 65,
            gk_diving: 10,
            gk_handling: 10,
            gk_kicking: 10,
            gk_positioning: 10,
            gk_reflexes: 10,
        }
    }

    #[test]
    fn fc26_positions_handle_side_specific_and_status_codes() {
        assert_eq!(map_position("RDM"), Some(Position::DefensiveMidfielder));
        assert_eq!(map_position("LCM"), Some(Position::CentralMidfielder));
        assert_eq!(map_position("RCB"), Some(Position::CenterBack));
        assert_eq!(map_position("SUB"), None);
        assert_eq!(primary_position("SUB", "CM, CDM, RB"), "CM");
    }
}
