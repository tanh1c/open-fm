// jobs commands — port of src-engine/src/commands/jobs.rs
use ofm_core::job_offers::{self, JobApplicationResult};
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js_value};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = getAvailableJobs)]
    pub fn get_available_jobs(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        to_js_value(&job_offers::get_available_jobs(&game))
    }

    #[wasm_bindgen(js_name = applyForJob)]
    pub fn apply_for_job(&self, team_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result = job_offers::apply_for_job(&mut game, &team_id);
        self.state.set_game(game.clone());

        let result_str = match result {
            JobApplicationResult::Hired => "hired",
            JobApplicationResult::Rejected => "rejected",
            JobApplicationResult::InvalidTeam => "invalid_team",
            JobApplicationResult::AlreadyEmployed => "already_employed",
        };

        to_js_value(&serde_json::json!({
            "result": result_str,
            "game": game,
        }))
    }
}
