// settings commands — port of src-engine/src/commands/settings.rs.
//
// Settings are persisted in the app.db key/value store (`app_kv` table) under
// the "settings:json" key. Replaces the Tauri implementation that wrote a
// settings.json file in app_data_dir.
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::{to_js, to_js_value, AppHandle, SAVE_MANAGER_LOCK_ERROR};

const SETTINGS_KEY: &str = "settings:json";
const SETTINGS_PARSE_FAILED_ERROR: &str = "be.error.settings.parseFailed";
const SETTINGS_SAVE_FAILED_ERROR: &str = "be.error.settings.saveFailed";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub currency: String,
    pub default_match_mode: String,
    pub auto_save: bool,
    #[serde(default = "default_auto_save_mode")]
    pub auto_save_mode: String,
    pub match_speed: String,
    pub show_match_commentary: bool,
    pub confirm_advance: bool,
    #[serde(default = "default_ui_scale")]
    pub ui_scale: String,
    #[serde(default)]
    pub high_contrast: bool,
}

fn default_language() -> String {
    "en".to_string()
}

fn default_ui_scale() -> String {
    "normal".to_string()
}

fn default_auto_save_mode() -> String {
    "matchday".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "en".to_string(),
            currency: "EUR".to_string(),
            default_match_mode: "live".to_string(),
            auto_save: true,
            auto_save_mode: "matchday".to_string(),
            match_speed: "normal".to_string(),
            show_match_commentary: true,
            confirm_advance: false,
            ui_scale: "normal".to_string(),
            high_contrast: false,
        }
    }
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = getSettings)]
    pub fn get_settings(&self) -> Result<JsValue, JsValue> {
        let sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        let settings = match sm.kv_get(SETTINGS_KEY).map_err(to_js)? {
            None => AppSettings::default(),
            Some(json) => serde_json::from_str(&json)
                .map_err(|_| to_js(SETTINGS_PARSE_FAILED_ERROR.to_string()))?,
        };
        to_js_value(&settings)
    }

    #[wasm_bindgen(js_name = saveSettings)]
    pub fn save_settings(&self, settings: JsValue) -> Result<JsValue, JsValue> {
        let settings: AppSettings = serde_wasm_bindgen::from_value(settings)
            .map_err(|_| to_js(SETTINGS_PARSE_FAILED_ERROR.to_string()))?;
        let json = serde_json::to_string(&settings)
            .map_err(|_| to_js(SETTINGS_SAVE_FAILED_ERROR.to_string()))?;
        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        sm.kv_put(SETTINGS_KEY, &json).map_err(to_js)?;
        Ok(JsValue::NULL)
    }

    #[wasm_bindgen(js_name = clearAllSaves)]
    pub fn clear_all_saves(&self) -> Result<JsValue, JsValue> {
        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        sm.clear_all_saves().map_err(to_js)?;
        Ok(JsValue::NULL)
    }
}
