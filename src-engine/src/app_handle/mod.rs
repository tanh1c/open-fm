// AppHandle — single #[wasm_bindgen] entry point exposed to JS.
//
// The struct lives here; per-domain command bindings live in submodules and
// are added through additional `#[wasm_bindgen] impl AppHandle` blocks. This
// keeps each domain's WASM exports next to the original Tauri command file
// they replace.

use std::sync::Mutex;

use db::save_manager::SaveManager;
use ofm_core::state::StateManager;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
const SAVES_DIR: &str = "";
#[cfg(not(target_arch = "wasm32"))]
const SAVES_DIR: &str = "saves";
pub(crate) const NO_ACTIVE_GAME_ERROR: &str = "be.error.noActiveGameSession";
pub(crate) const SAVE_MANAGER_LOCK_ERROR: &str = "be.error.saveManagerUnavailable";

mod club;
mod contracts;
mod finances;
mod game;
mod god_mode;
mod jobs;
mod live_match;
mod messages;
mod season;
mod settings;
mod squad;
mod staff;
mod stats;
mod time;
mod transfers;
mod world;

#[wasm_bindgen]
pub struct AppHandle {
    pub(crate) state: StateManager,
    pub(crate) save_manager: Mutex<SaveManager>,
}

#[wasm_bindgen]
impl AppHandle {
    /// Async constructor. Mounts OPFS, opens app.db, returns the handle.
    /// Call once per Worker boot. Idempotent if mounted already.
    #[wasm_bindgen(js_name = init)]
    pub async fn init() -> Result<AppHandle, JsValue> {
        console_error_panic_hook::set_once();

        db::opfs::install_opfs_sahpool().await.map_err(to_js)?;

        let saves_dir = std::path::Path::new(SAVES_DIR);
        let save_manager = SaveManager::init(saves_dir).map_err(to_js)?;

        Ok(Self {
            state: StateManager::new(),
            save_manager: Mutex::new(save_manager),
        })
    }
}

impl AppHandle {
    pub(crate) fn snapshot_game(&self) -> Result<ofm_core::game::Game, JsValue> {
        self.state
            .get_game(|g| g.clone())
            .ok_or_else(|| to_js(NO_ACTIVE_GAME_ERROR.to_string()))
    }
}

pub(crate) fn to_js(s: String) -> JsValue {
    JsValue::from_str(&s)
}

pub(crate) fn to_js_value<T: Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    // `Serializer::json_compatible()` produces plain JS objects (not `Map`),
    // matching what JSON.parse(JSON.stringify(x)) would yield. The default
    // serde-wasm-bindgen output emits `Map` for HashMap and unit-struct enum
    // variants, which React then sees as objects with no own keys — that
    // causes "key prop missing" warnings and stale state in components.
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    value
        .serialize(&serializer)
        .map_err(|e| to_js(format!("be.error.serialize:{e}")))
}
