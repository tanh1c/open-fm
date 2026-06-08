// world commands — port of src-engine/src/commands/world.rs
//
// On the web, the filesystem-based flows go away:
//   * `exportWorldDatabase` returns the world JSON string for the UI to save
//     via the browser's download API.
//   * `listWorldDatabases` only ever returns the built-in random option;
//     user-imported worlds live in browser memory until they call startNewGameWithWorld.
//   * The legacy `write_temp_database` is gone — startNewGameWithWorld takes
//     the JSON content directly.
use ofm_core::generator::WorldData;
use wasm_bindgen::prelude::*;

use super::{to_js, to_js_value, AppHandle};

const EXPORTED_WORLD_NAME_KEY: &str = "be.msg.world.exportedName";
const EXPORTED_WORLD_DESCRIPTION_KEY: &str = "be.msg.world.exportedDescription";
const FC26_WORLD_NAME_KEY: &str = "be.msg.world.fc26RealName";
const FC26_WORLD_DESCRIPTION_KEY: &str = "be.msg.world.fc26RealDescription";
const RANDOM_WORLD_NAME_KEY: &str = "be.msg.world.randomName";
const RANDOM_WORLD_DESCRIPTION_KEY: &str = "be.msg.world.randomDescription";
const TEAM_COUNT_PARAM: &str = "teamCount";

fn backend_text_with_param(key: &str, param_name: &str, param_value: impl ToString) -> String {
    let mut text = String::from(key);
    text.push('?');
    text.push_str(param_name);
    text.push('=');
    text.push_str(&param_value.to_string());
    text
}

#[wasm_bindgen]
impl AppHandle {
    /// Returns the catalog of world databases the user can pick from.
    /// On the web there's no filesystem to scan, so this is just the built-in
    /// random option. Imported user worlds are kept in JS memory until used.
    #[wasm_bindgen(js_name = listWorldDatabases)]
    pub fn list_world_databases(&self) -> Result<JsValue, JsValue> {
        let databases = vec![
            serde_json::json!({
                "id": "random",
                "name": RANDOM_WORLD_NAME_KEY,
                "description": backend_text_with_param(RANDOM_WORLD_DESCRIPTION_KEY, TEAM_COUNT_PARAM, 248),
                "team_count": 248,
                "player_count": 5456,
                "source": "builtin",
                "path": "",
            }),
            serde_json::json!({
                "id": "fc26_real",
                "name": FC26_WORLD_NAME_KEY,
                "description": backend_text_with_param(FC26_WORLD_DESCRIPTION_KEY, TEAM_COUNT_PARAM, 248),
                "team_count": 248,
                "player_count": ofm_core::generator::fc26_real_player_count_estimate(),
                "source": "builtin",
                "path": "",
            }),
        ];
        to_js_value(&databases)
    }

    /// Build a world JSON string from the active game and return it. The UI is
    /// responsible for triggering the download (e.g., via a Blob + anchor).
    #[wasm_bindgen(js_name = exportWorldDatabase)]
    pub fn export_world_database(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let world = WorldData {
            name: EXPORTED_WORLD_NAME_KEY.to_string(),
            description: backend_text_with_param(
                EXPORTED_WORLD_DESCRIPTION_KEY,
                TEAM_COUNT_PARAM,
                game.teams.len(),
            ),
            teams: game.teams.clone(),
            players: game.players.clone(),
            staff: game.staff.clone(),
        };
        let json = ofm_core::generator::export_world_to_json(&world).map_err(to_js)?;
        to_js_value(&json)
    }
}
