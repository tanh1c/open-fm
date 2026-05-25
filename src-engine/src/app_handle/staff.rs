// staff commands — port of src-engine/src/commands/staff.rs
use wasm_bindgen::prelude::*;

use super::{to_js, to_js_value, AppHandle};

const NO_TEAM_ASSIGNED: &str = "be.error.noTeamAssigned";

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = hireStaff)]
    pub fn hire_staff(&self, staff_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let staff = game
            .staff
            .iter_mut()
            .find(|s| s.id == staff_id)
            .ok_or_else(|| to_js("be.error.staffMemberNotFound".to_string()))?;

        if staff.team_id.is_some() {
            return Err(to_js("be.error.staffMemberAlreadyEmployed".to_string()));
        }

        let wage = staff.wage as i64;
        staff.team_id = Some(team_id.clone());

        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.season_expenses += wage;
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = releaseStaff)]
    pub fn release_staff(&self, staff_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let staff = game
            .staff
            .iter_mut()
            .find(|s| s.id == staff_id)
            .ok_or_else(|| to_js("be.error.staffMemberNotFound".to_string()))?;

        if staff.team_id.as_deref() != Some(&team_id) {
            return Err(to_js("be.error.staffMemberNotInTeam".to_string()));
        }

        let wage = staff.wage as i64;
        staff.team_id = None;

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.season_expenses = team.season_expenses.saturating_sub(wage);
        }

        self.state.set_game(game.clone());
        to_js_value(&game)
    }
}
