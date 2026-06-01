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

    #[wasm_bindgen(js_name = getCompetitionAwards)]
    pub fn get_competition_awards(&self, competition_id: String) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let awards = self
            .state
            .get_stats_state(|stats| {
                ofm_core::season_awards::compute_competition_awards(&game, stats, &competition_id)
            })
            .unwrap_or_else(|| ofm_core::season_awards::SeasonAwards {
                golden_boot: Vec::new(),
                assist_king: Vec::new(),
                player_of_year: Vec::new(),
                clean_sheet_king: Vec::new(),
                most_appearances: Vec::new(),
                young_player: Vec::new(),
            });
        to_js_value(&awards)
    }

    #[wasm_bindgen(js_name = getCompetitionLeaderboards)]
    pub fn get_competition_leaderboards(
        &self,
        competition_id: String,
    ) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let leaderboards = self
            .state
            .get_stats_state(|stats| {
                ofm_core::leaderboards::compute_competition_leaderboards(
                    &game,
                    stats,
                    &competition_id,
                )
            })
            .unwrap_or_else(|| ofm_core::leaderboards::CompetitionLeaderboards {
                competition_id,
                ..Default::default()
            });
        to_js_value(&leaderboards)
    }
}
