// squad commands — port of src-engine/src/commands/squad.rs
use chrono::Datelike;
use ofm_core::live_match_manager;
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js, to_js_value};

const NO_TEAM_ASSIGNED: &str = "be.error.noTeamAssigned";

fn parse_squad_role(squad_role: &str) -> Option<domain::player::SquadRole> {
    match squad_role {
        "Senior" => Some(domain::player::SquadRole::Senior),
        "Youth" => Some(domain::player::SquadRole::Youth),
        _ => None,
    }
}

fn player_age_on(current_date: chrono::NaiveDate, date_of_birth: &str) -> Option<i32> {
    let dob = chrono::NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d").ok()?;
    let mut age = current_date.year() - dob.year();
    if (current_date.month(), current_date.day()) < (dob.month(), dob.day()) {
        age -= 1;
    }
    Some(age)
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
        let training_focus = match focus.as_str() {
            "Physical" => domain::team::TrainingFocus::Physical,
            "Technical" => domain::team::TrainingFocus::Technical,
            "Tactical" => domain::team::TrainingFocus::Tactical,
            "Defending" => domain::team::TrainingFocus::Defending,
            "Attacking" => domain::team::TrainingFocus::Attacking,
            "Recovery" => domain::team::TrainingFocus::Recovery,
            _ => domain::team::TrainingFocus::Physical,
        };
        let training_intensity = match intensity.as_str() {
            "Low" => domain::team::TrainingIntensity::Low,
            "Medium" => domain::team::TrainingIntensity::Medium,
            "High" => domain::team::TrainingIntensity::High,
            _ => domain::team::TrainingIntensity::Medium,
        };
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
        let training_schedule = match schedule.as_str() {
            "Intense" => domain::team::TrainingSchedule::Intense,
            "Balanced" => domain::team::TrainingSchedule::Balanced,
            "Light" => domain::team::TrainingSchedule::Light,
            _ => domain::team::TrainingSchedule::Balanced,
        };
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

        let training_focus = focus.as_deref().and_then(|f| match f {
            "Physical" => Some(domain::team::TrainingFocus::Physical),
            "Technical" => Some(domain::team::TrainingFocus::Technical),
            "Tactical" => Some(domain::team::TrainingFocus::Tactical),
            "Defending" => Some(domain::team::TrainingFocus::Defending),
            "Attacking" => Some(domain::team::TrainingFocus::Attacking),
            "Recovery" => Some(domain::team::TrainingFocus::Recovery),
            _ => None,
        });

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
        let target_role =
            parse_squad_role(&squad_role).ok_or_else(|| to_js("be.error.invalidSquadRole".to_string()))?;
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

    #[wasm_bindgen(js_name = autoSelectSetPieces)]
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
