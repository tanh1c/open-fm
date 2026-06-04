// stats commands — port of src-engine/src/commands/stats/mod.rs
//
// The DTO logic moved into application/stats/. This file is just the wasm
// entry surface that delegates to the existing internal helpers.

use wasm_bindgen::prelude::*;

use ofm_core::leaderboards::GlobalPlayerLeaderboardQuery;

use crate::application::stats::{
    get_global_player_leaderboards_internal, get_match_detail_internal,
    get_player_match_history_internal, get_player_stats_overview_internal,
    get_team_match_history_internal, get_team_stats_overview_internal,
};

use super::{to_js, to_js_value, AppHandle};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = getPlayerMatchHistory)]
    pub fn get_player_match_history(
        &self,
        player_id: String,
        limit: Option<usize>,
    ) -> Result<JsValue, JsValue> {
        let entries =
            get_player_match_history_internal(&self.state, &player_id, limit).map_err(to_js)?;
        to_js_value(&entries)
    }

    #[wasm_bindgen(js_name = getPlayerStatsOverview)]
    pub fn get_player_stats_overview(&self, player_id: String) -> Result<JsValue, JsValue> {
        let overview =
            get_player_stats_overview_internal(&self.state, &player_id).map_err(to_js)?;
        to_js_value(&overview)
    }

    #[wasm_bindgen(js_name = getTeamStatsOverview)]
    pub fn get_team_stats_overview(&self, team_id: String) -> Result<JsValue, JsValue> {
        let overview = get_team_stats_overview_internal(&self.state, &team_id).map_err(to_js)?;
        to_js_value(&overview)
    }

    #[wasm_bindgen(js_name = getTeamMatchHistory)]
    pub fn get_team_match_history(
        &self,
        team_id: String,
        limit: Option<usize>,
    ) -> Result<JsValue, JsValue> {
        let entries =
            get_team_match_history_internal(&self.state, &team_id, limit).map_err(to_js)?;
        to_js_value(&entries)
    }

    #[wasm_bindgen(js_name = getMatchDetail)]
    pub fn get_match_detail(&self, fixture_id: String) -> Result<JsValue, JsValue> {
        let detail = get_match_detail_internal(&self.state, &fixture_id).map_err(to_js)?;
        to_js_value(&detail)
    }

    #[wasm_bindgen(js_name = getGlobalPlayerLeaderboards)]
    pub fn get_global_player_leaderboards(&self, query: JsValue) -> Result<JsValue, JsValue> {
        let query: GlobalPlayerLeaderboardQuery = serde_wasm_bindgen::from_value(query)
            .map_err(|error| to_js(format!("be.error.deserialize:{error}")))?;
        let leaderboards =
            get_global_player_leaderboards_internal(&self.state, query).map_err(to_js)?;
        to_js_value(&leaderboards)
    }
}
