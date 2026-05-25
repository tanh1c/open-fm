// season commands — port of src-engine/src/commands/season.rs
use wasm_bindgen::prelude::*;

use super::{to_js_value, AppHandle};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = checkSeasonComplete)]
    pub fn check_season_complete(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        to_js_value(&ofm_core::end_of_season::is_season_complete(&game))
    }

    #[wasm_bindgen(js_name = advanceToNextSeason)]
    pub fn advance_to_next_season(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        if !ofm_core::end_of_season::is_season_complete(&game) {
            return Err(super::to_js("be.error.seasonNotComplete".to_string()));
        }

        let summary = ofm_core::end_of_season::process_end_of_season(&mut game);
        ofm_core::firing::check_manager_firing(&mut game);
        self.state.set_game(game.clone());

        if game.manager.team_id.is_none() {
            return to_js_value(&serde_json::json!({
                "action": "fired",
                "game": game,
                "summary": summary,
            }));
        }

        to_js_value(&serde_json::json!({
            "game": game,
            "summary": summary,
        }))
    }

    #[wasm_bindgen(js_name = getSeasonAwards)]
    pub fn get_season_awards(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        to_js_value(&ofm_core::season_awards::compute_season_awards(&game))
    }
}
