// finances commands — port of src-engine/src/commands/finances.rs
use ofm_core::finances;
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js, to_js_value};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = getFinanceSnapshot)]
    pub fn get_finance_snapshot(&self, team_id: Option<String>) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let resolved = match team_id {
            Some(id) => id,
            None => game
                .manager
                .team_id
                .clone()
                .ok_or_else(|| to_js("be.error.noTeamAssigned".to_string()))?,
        };

        let snapshot = finances::team_finance_snapshot(&game, &resolved)
            .ok_or_else(|| to_js("be.error.managedTeamNotFound".to_string()))?;
        let previews = finances::finance_action_previews(&game, &resolved).unwrap_or_default();

        to_js_value(&serde_json::json!({
            "snapshot": snapshot,
            "previews": previews,
        }))
    }

    #[wasm_bindgen(js_name = requestBoardSupport)]
    pub fn request_board_support(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js("be.error.noTeamAssigned".to_string()))?;
        let result = finances::request_board_support(&mut game, &team_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game, "result": result }))
    }

    #[wasm_bindgen(js_name = requestSponsorPitch)]
    pub fn request_sponsor_pitch(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js("be.error.noTeamAssigned".to_string()))?;
        let result = finances::request_sponsor_pitch(&mut game, &team_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game, "result": result }))
    }

    #[wasm_bindgen(js_name = requestMarketingCampaign)]
    pub fn request_marketing_campaign(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| to_js("be.error.noTeamAssigned".to_string()))?;
        let result = finances::request_marketing_campaign(&mut game, &team_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game, "result": result }))
    }
}
