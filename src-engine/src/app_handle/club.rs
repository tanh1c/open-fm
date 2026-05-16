// club commands — port of src-engine/src/commands/club.rs
use ofm_core::finances::{self, FinanceHealthLevel};
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js, to_js_value};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = upgradeFacility)]
    pub fn upgrade_facility(&self, facility: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js("be.error.noTeamAssigned".to_string()))?;

        let facility_type = match facility.as_str() {
            "Training" => domain::team::FacilityType::Training,
            "Medical" => domain::team::FacilityType::Medical,
            "Scouting" => domain::team::FacilityType::Scouting,
            _ => return Err(to_js("be.error.unknownFacilityType".to_string())),
        };

        let snapshot = finances::team_finance_snapshot(&game, &team_id)
            .ok_or_else(|| to_js("be.error.managedTeamNotFound".to_string()))?;
        if snapshot.currently_over_budget {
            return Err(to_js("be.error.finance.facilityUpgradeOverBudget".to_string()));
        }
        if matches!(
            snapshot.overall_status,
            FinanceHealthLevel::Warning | FinanceHealthLevel::Critical
        ) {
            return Err(to_js("be.error.finance.facilityUpgradeCritical".to_string()));
        }

        let team = game
            .teams
            .iter_mut()
            .find(|team| team.id == team_id)
            .ok_or_else(|| to_js("be.error.managedTeamNotFound".to_string()))?;
        ofm_core::club::upgrade_facility(team, facility_type).map_err(to_js)?;

        self.state.set_game(game.clone());
        to_js_value(&game)
    }
}
