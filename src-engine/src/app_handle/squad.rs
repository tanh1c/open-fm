// squad commands — port of src-engine/src/commands/squad.rs
use std::collections::HashSet;

use chrono::Datelike;
use ofm_core::live_match_manager;
use wasm_bindgen::prelude::*;

use super::{to_js, to_js_value, AppHandle};

#[derive(serde::Deserialize)]
struct CustomTacticSlotInput {
    slot_id: String,
    player_id: Option<String>,
    role: String,
    x: u8,
    y: u8,
    tactical_role: Option<String>,
    duty: Option<String>,
}

#[derive(serde::Deserialize)]
struct SaveTacticPresetInput {
    name: String,
    slots: Vec<CustomTacticSlotInput>,
}

#[derive(serde::Deserialize)]
struct TacticalInstructionsInput {
    pressing_intensity: f64,
    defensive_line: f64,
    tempo: f64,
    width: f64,
    passing_directness: f64,
    risk_appetite: f64,
    #[serde(default = "half_instruction_input")]
    counter_attack: f64,
    #[serde(default = "half_instruction_input")]
    counter_press: f64,
}

fn half_instruction_input() -> f64 {
    0.5
}

impl From<TacticalInstructionsInput> for domain::team::TacticalInstructions {
    fn from(input: TacticalInstructionsInput) -> Self {
        Self {
            pressing_intensity: input.pressing_intensity,
            defensive_line: input.defensive_line,
            tempo: input.tempo,
            width: input.width,
            passing_directness: input.passing_directness,
            risk_appetite: input.risk_appetite,
            counter_attack: input.counter_attack,
            counter_press: input.counter_press,
        }
        .clamped()
    }
}

const NO_TEAM_ASSIGNED: &str = "be.error.noTeamAssigned";

fn parse_squad_role(squad_role: &str) -> Option<domain::player::SquadRole> {
    match squad_role {
        "Senior" => Some(domain::player::SquadRole::Senior),
        "Youth" => Some(domain::player::SquadRole::Youth),
        _ => None,
    }
}

fn parse_training_focus(focus: &str) -> Option<domain::team::TrainingFocus> {
    match focus {
        "Physical" => Some(domain::team::TrainingFocus::Physical),
        "Technical" => Some(domain::team::TrainingFocus::Technical),
        "Tactical" => Some(domain::team::TrainingFocus::Tactical),
        "Defending" => Some(domain::team::TrainingFocus::Defending),
        "Attacking" => Some(domain::team::TrainingFocus::Attacking),
        "Recovery" => Some(domain::team::TrainingFocus::Recovery),
        _ => None,
    }
}

fn parse_training_intensity(intensity: &str) -> Option<domain::team::TrainingIntensity> {
    match intensity {
        "Low" => Some(domain::team::TrainingIntensity::Low),
        "Medium" => Some(domain::team::TrainingIntensity::Medium),
        "High" => Some(domain::team::TrainingIntensity::High),
        _ => None,
    }
}

fn parse_training_schedule(schedule: &str) -> Option<domain::team::TrainingSchedule> {
    match schedule {
        "Intense" => Some(domain::team::TrainingSchedule::Intense),
        "Balanced" => Some(domain::team::TrainingSchedule::Balanced),
        "Light" => Some(domain::team::TrainingSchedule::Light),
        _ => None,
    }
}

fn validate_training_groups(
    groups: &[domain::team::TrainingGroup],
    squad_player_ids: &HashSet<String>,
) -> Result<(), JsValue> {
    if groups.len() > 5 {
        return Err(to_js("be.error.training.tooManyGroups".to_string()));
    }

    let mut group_ids = HashSet::new();
    let mut assigned_player_ids = HashSet::new();

    for group in groups {
        if group.id.trim().is_empty() || group.name.trim().is_empty() {
            return Err(to_js("be.error.training.invalidGroup".to_string()));
        }

        if !group_ids.insert(group.id.as_str()) {
            return Err(to_js("be.error.training.duplicateGroup".to_string()));
        }

        for player_id in &group.player_ids {
            if !squad_player_ids.contains(player_id) {
                return Err(to_js("be.error.training.playerNotInTeam".to_string()));
            }

            if !assigned_player_ids.insert(player_id.as_str()) {
                return Err(to_js("be.error.training.duplicatePlayer".to_string()));
            }
        }
    }

    Ok(())
}

fn player_age_on(current_date: chrono::NaiveDate, date_of_birth: &str) -> Option<i32> {
    let dob = chrono::NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d").ok()?;
    let mut age = current_date.year() - dob.year();
    if (current_date.month(), current_date.day()) < (dob.month(), dob.day()) {
        age -= 1;
    }
    Some(age)
}

fn to_domain_tactic_slot(slot: CustomTacticSlotInput) -> domain::team::CustomTacticSlot {
    domain::team::CustomTacticSlot {
        slot_id: slot.slot_id,
        player_id: slot.player_id,
        role: slot.role,
        x: slot.x,
        y: slot.y,
        tactical_role: slot.tactical_role,
        duty: slot.duty,
    }
}

fn formation_from_slots(slots: &[CustomTacticSlotInput]) -> String {
    let has_assigned = |slot_id: &str| {
        slots
            .iter()
            .any(|slot| slot.slot_id == slot_id && slot.player_id.is_some())
    };
    let assigned_slot_ids: std::collections::BTreeSet<String> = slots
        .iter()
        .filter(|slot| slot.player_id.is_some() && slot.slot_id != "gk")
        .map(|slot| slot.slot_id.clone())
        .collect();
    let presets: [(&str, &[&str]); 8] = [
        (
            "4-4-2",
            &[
                "lb", "lcb", "rcb", "rb", "lm", "lcm", "rcm", "rm", "ls", "rs",
            ],
        ),
        (
            "4-3-3",
            &[
                "lb", "lcb", "rcb", "rb", "lcm", "cm", "rcm", "lw", "st", "rw",
            ],
        ),
        (
            "3-5-2",
            &[
                "lcb", "cb", "rcb", "lm", "ldm", "cm", "rdm", "rm", "ls", "rs",
            ],
        ),
        (
            "4-5-1",
            &[
                "lb", "lcb", "rcb", "rb", "lm", "ldm", "cm", "rdm", "rm", "st",
            ],
        ),
        (
            "4-2-3-1",
            &[
                "lb", "lcb", "rcb", "rb", "ldm", "rdm", "lam", "am", "ram", "st",
            ],
        ),
        (
            "3-4-3",
            &[
                "lcb", "cb", "rcb", "lm", "lcm", "rcm", "rm", "lw", "st", "rw",
            ],
        ),
        (
            "5-3-2",
            &[
                "lb", "lcb", "cb", "rcb", "rb", "lcm", "cm", "rcm", "ls", "rs",
            ],
        ),
        (
            "4-1-4-1",
            &[
                "lb", "lcb", "rcb", "rb", "dm", "lm", "lcm", "rcm", "rm", "st",
            ],
        ),
    ];

    for (formation, preset_slots) in presets {
        if assigned_slot_ids.len() == preset_slots.len()
            && preset_slots.iter().all(|slot_id| has_assigned(slot_id))
        {
            return formation.to_string();
        }
    }

    let defenders = slots
        .iter()
        .filter(|slot| slot.player_id.is_some() && slot.role == "DEF")
        .count();
    let midfielders = slots
        .iter()
        .filter(|slot| {
            slot.player_id.is_some() && matches!(slot.role.as_str(), "DM" | "MID" | "AM")
        })
        .count();
    let forwards = slots
        .iter()
        .filter(|slot| slot.player_id.is_some() && slot.role == "FWD")
        .count();

    format!("{}-{}-{}", defenders, midfielders, forwards)
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = setFormation)]
    pub fn set_formation(&self, formation: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let parts: Vec<usize> = formation
            .split('-')
            .filter_map(|s| s.parse().ok())
            .collect();
        let (num_def, num_mid, num_fwd) = match parts.len() {
            3 => (parts[0], parts[1], parts[2]),
            4 => (parts[0], parts[1] + parts[2], parts[3]),
            _ => (4, 4, 2),
        };

        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.formation = formation;
        }

        let player_ids: Vec<String> = game
            .players
            .iter()
            .filter(|p| {
                p.team_id.as_deref() == Some(&team_id)
                    && p.position != domain::player::Position::Goalkeeper
            })
            .map(|p| p.id.clone())
            .collect();

        let mut sorted_ids = player_ids.clone();
        sorted_ids.sort_by(|a_id, b_id| {
            let pa = game.players.iter().find(|p| p.id == *a_id).unwrap();
            let pb = game.players.iter().find(|p| p.id == *b_id).unwrap();
            let def_a = pa.attributes.defending as u16
                + pa.attributes.tackling as u16
                + pa.attributes.strength as u16;
            let def_b = pb.attributes.defending as u16
                + pb.attributes.tackling as u16
                + pb.attributes.strength as u16;
            def_b.cmp(&def_a)
        });

        for (slot, pid) in sorted_ids.iter().enumerate() {
            let new_pos = if slot < num_def {
                domain::player::Position::Defender
            } else if slot < num_def + num_mid {
                domain::player::Position::Midfielder
            } else if slot < num_def + num_mid + num_fwd {
                domain::player::Position::Forward
            } else {
                continue;
            };
            if let Some(player) = game.players.iter_mut().find(|p| p.id == *pid) {
                player.position = new_pos;
            }
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setStartingXi)]
    pub fn set_starting_xi(&self, player_ids: JsValue) -> Result<JsValue, JsValue> {
        let player_ids: Vec<String> = serde_wasm_bindgen::from_value(player_ids)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.starting_xi_ids = player_ids;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTacticSlots)]
    pub fn set_tactic_slots(&self, slots: JsValue) -> Result<JsValue, JsValue> {
        let slots: Vec<CustomTacticSlotInput> = serde_wasm_bindgen::from_value(slots)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let assigned_player_ids: Vec<String> = slots
            .iter()
            .filter_map(|slot| slot.player_id.clone())
            .collect();
        if assigned_player_ids.len() > 11 {
            return Err(to_js("be.error.tactics.tooManyPlayers".to_string()));
        }
        let unique_player_ids: std::collections::HashSet<&String> =
            assigned_player_ids.iter().collect();
        if unique_player_ids.len() != assigned_player_ids.len() {
            return Err(to_js("be.error.tactics.duplicatePlayer".to_string()));
        }

        let goalkeeper_count = slots
            .iter()
            .filter(|slot| slot.role == "GK" && slot.player_id.is_some())
            .count();
        if goalkeeper_count != 1 {
            return Err(to_js("be.error.tactics.goalkeeperRequired".to_string()));
        }

        let defenders = slots
            .iter()
            .filter(|slot| slot.player_id.is_some() && slot.role == "DEF")
            .count();
        let midfielders = slots
            .iter()
            .filter(|slot| {
                slot.player_id.is_some() && matches!(slot.role.as_str(), "DM" | "MID" | "AM")
            })
            .count();
        let forwards = slots
            .iter()
            .filter(|slot| slot.player_id.is_some() && slot.role == "FWD")
            .count();

        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.custom_tactic_slots = slots.into_iter().map(to_domain_tactic_slot).collect();
            team.starting_xi_ids = assigned_player_ids;
            team.formation = format!("{}-{}-{}", defenders, midfielders, forwards);
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = saveTacticPreset)]
    pub fn save_tactic_preset(&self, preset: JsValue) -> Result<JsValue, JsValue> {
        let preset: SaveTacticPresetInput = serde_wasm_bindgen::from_value(preset)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let formation = formation_from_slots(&preset.slots);
        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            let id = format!("preset-{}", team.saved_tactic_presets.len() + 1);
            team.saved_tactic_presets.push(domain::team::TacticPreset {
                id,
                name: preset.name,
                formation,
                slots: preset
                    .slots
                    .into_iter()
                    .map(to_domain_tactic_slot)
                    .collect(),
                tactical_instructions: team.tactical_instructions,
            });
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = loadTacticPreset)]
    pub fn load_tactic_preset(&self, preset_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            let preset = team
                .saved_tactic_presets
                .iter()
                .find(|preset| preset.id == preset_id)
                .cloned()
                .ok_or_else(|| to_js("be.error.tactics.presetNotFound".to_string()))?;
            team.custom_tactic_slots = preset.slots;
            team.starting_xi_ids = team
                .custom_tactic_slots
                .iter()
                .filter_map(|slot| slot.player_id.clone())
                .collect();
            team.formation = preset.formation;
            team.tactical_instructions = preset.tactical_instructions.clamped();
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = deleteTacticPreset)]
    pub fn delete_tactic_preset(&self, preset_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.saved_tactic_presets
                .retain(|preset| preset.id != preset_id);
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setPlayStyle)]
    pub fn set_play_style(&self, play_style: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        let style = match play_style.as_str() {
            "Attacking" => domain::team::PlayStyle::Attacking,
            "Defensive" => domain::team::PlayStyle::Defensive,
            "Possession" => domain::team::PlayStyle::Possession,
            "Counter" => domain::team::PlayStyle::Counter,
            "HighPress" => domain::team::PlayStyle::HighPress,
            _ => domain::team::PlayStyle::Balanced,
        };
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.play_style = style;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTacticalInstructions)]
    pub fn set_tactical_instructions(&self, instructions: JsValue) -> Result<JsValue, JsValue> {
        let instructions: TacticalInstructionsInput = serde_wasm_bindgen::from_value(instructions)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.tactical_instructions = instructions.into();
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTeamMatchRoles)]
    pub fn set_team_match_roles(&self, match_roles: JsValue) -> Result<JsValue, JsValue> {
        let match_roles: domain::team::MatchRoles = serde_wasm_bindgen::from_value(match_roles)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.match_roles = match_roles;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTraining)]
    pub fn set_training(&self, focus: String, intensity: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        let training_focus = parse_training_focus(&focus)
            .ok_or_else(|| to_js("be.error.training.invalidFocus".to_string()))?;
        let training_intensity = parse_training_intensity(&intensity)
            .ok_or_else(|| to_js("be.error.training.invalidIntensity".to_string()))?;
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.training_focus = training_focus;
            team.training_intensity = training_intensity;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTrainingSchedule)]
    pub fn set_training_schedule(&self, schedule: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        let training_schedule = parse_training_schedule(&schedule)
            .ok_or_else(|| to_js("be.error.training.invalidSchedule".to_string()))?;
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.training_schedule = training_schedule;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setTrainingGroups)]
    pub fn set_training_groups(&self, groups: JsValue) -> Result<JsValue, JsValue> {
        let groups: Vec<domain::team::TrainingGroup> = serde_wasm_bindgen::from_value(groups)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        let squad_player_ids: HashSet<String> = game
            .players
            .iter()
            .filter(|player| player.team_id.as_deref() == Some(team_id.as_str()))
            .map(|player| player.id.clone())
            .collect();

        validate_training_groups(&groups, &squad_player_ids)?;

        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.training_groups = groups;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setPlayerTrainingFocus)]
    pub fn set_player_training_focus(
        &self,
        player_id: String,
        focus: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let training_focus = focus
            .as_deref()
            .map(|focus| {
                parse_training_focus(focus)
                    .ok_or_else(|| to_js("be.error.training.invalidFocus".to_string()))
            })
            .transpose()?;

        if let Some(player) = game
            .players
            .iter_mut()
            .find(|p| p.id == player_id && p.team_id.as_deref() == Some(team_id.as_str()))
        {
            player.training_focus = training_focus;
        } else {
            return Err(to_js("be.error.playerNotFound".to_string()));
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setPlayerSquadRole)]
    pub fn set_player_squad_role(
        &self,
        player_id: String,
        squad_role: String,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;
        let target_role = parse_squad_role(&squad_role)
            .ok_or_else(|| to_js("be.error.invalidSquadRole".to_string()))?;
        let current_date = game.clock.current_date.date_naive();

        let player_index = game
            .players
            .iter()
            .position(|player| player.id == player_id)
            .ok_or_else(|| to_js("be.error.playerNotFound".to_string()))?;

        if game.players[player_index].team_id.as_deref() != Some(team_id.as_str()) {
            return Err(to_js("be.error.playerNotInSquad".to_string()));
        }

        if matches!(target_role, domain::player::SquadRole::Youth) {
            let age = player_age_on(current_date, &game.players[player_index].date_of_birth)
                .ok_or_else(|| to_js("be.error.invalidDateOfBirth".to_string()))?;
            if age > 21 {
                return Err(to_js("be.error.youthAcademyOverage".to_string()));
            }
        }

        game.players[player_index].squad_role = target_role;

        if matches!(target_role, domain::player::SquadRole::Youth) {
            if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
                team.starting_xi_ids.retain(|id| id != &player_id);
            }
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setPlayerSquadNumber)]
    pub fn set_player_squad_number(
        &self,
        player_id: String,
        squad_number: Option<u32>,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        // Validate the requested number (1-99) and ensure no team-mate already wears it.
        let target_number: Option<u8> = match squad_number {
            None => None,
            Some(value) => {
                if !(1..=99).contains(&value) {
                    return Err(to_js("be.error.invalidSquadNumber".to_string()));
                }
                let value = value as u8;
                let clash = game.players.iter().any(|player| {
                    player.id != player_id
                        && player.team_id.as_deref() == Some(team_id.as_str())
                        && player.squad_number == Some(value)
                });
                if clash {
                    return Err(to_js("be.error.squadNumberTaken".to_string()));
                }
                Some(value)
            }
        };

        let player_index = game
            .players
            .iter()
            .position(|player| player.id == player_id)
            .ok_or_else(|| to_js("be.error.playerNotFound".to_string()))?;

        if game.players[player_index].team_id.as_deref() != Some(team_id.as_str()) {
            return Err(to_js("be.error.playerNotInSquad".to_string()));
        }

        game.players[player_index].squad_number = target_number;

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = setPlayerSquadTier)]
    pub fn set_player_squad_tier(
        &self,
        player_id: String,
        squad_tier: String,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let target_tier = match squad_tier.as_str() {
            "Substitute" => domain::player::SquadTier::Substitute,
            "Reserve" => domain::player::SquadTier::Reserve,
            _ => return Err(to_js("be.error.invalidSquadTier".to_string())),
        };

        let player_index = game
            .players
            .iter()
            .position(|player| player.id == player_id)
            .ok_or_else(|| to_js("be.error.playerNotFound".to_string()))?;

        if game.players[player_index].team_id.as_deref() != Some(team_id.as_str()) {
            return Err(to_js("be.error.playerNotInSquad".to_string()));
        }

        game.players[player_index].squad_tier = target_tier;

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    pub fn auto_select_set_pieces(&self, player_ids: JsValue) -> Result<JsValue, JsValue> {
        let player_ids: Vec<String> = serde_wasm_bindgen::from_value(player_ids)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let game = self.snapshot_game()?;
        let (captain, penalty, free_kick, corner) =
            live_match_manager::auto_select_set_pieces(&game, &player_ids);
        to_js_value(&serde_json::json!({
            "captain": captain,
            "penalty_taker": penalty,
            "free_kick_taker": free_kick,
            "corner_taker": corner,
        }))
    }
}
