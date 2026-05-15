use log::info;
use tauri::Manager as TauriManager;

const SETTINGS_LOAD_FAILED_ERROR: &str = "be.error.settings.loadFailed";
const SETTINGS_PARSE_FAILED_ERROR: &str = "be.error.settings.parseFailed";
const SETTINGS_SAVE_FAILED_ERROR: &str = "be.error.settings.saveFailed";
const SAVE_MANAGER_UNAVAILABLE_ERROR: &str = "be.error.saveManagerUnavailable";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    pub theme: String, // "dark" | "light" | "system"
    #[serde(default = "default_language")]
    pub language: String, // "en" | "es" | "pt" | "fr" | "de"
    pub currency: String, // "EUR" | "GBP" | "USD"
    pub default_match_mode: String, // "live" | "spectator" | "delegate"
    pub auto_save: bool,
    pub match_speed: String, // "slow" | "normal" | "fast"
    pub show_match_commentary: bool,
    pub confirm_advance: bool,
    #[serde(default = "default_ui_scale")]
    pub ui_scale: String, // "small" | "normal" | "large" | "xlarge"
    #[serde(default)]
    pub high_contrast: bool,
}

fn default_language() -> String {
    "en".to_string()
}
fn default_ui_scale() -> String {
    "normal".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "en".to_string(),
            currency: "EUR".to_string(),
            default_match_mode: "live".to_string(),
            auto_save: true,
            match_speed: "normal".to_string(),
            show_match_commentary: true,
            confirm_advance: false,
            ui_scale: "normal".to_string(),
            high_contrast: false,
        }
    }
}

fn settings_path(
    app_handle: &tauri::AppHandle,
    error_key: &str,
) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| error_key.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|_| error_key.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn get_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    log::debug!("[cmd] get_settings");
    let path = settings_path(&app_handle, SETTINGS_LOAD_FAILED_ERROR)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let json = std::fs::read_to_string(&path).map_err(|_| SETTINGS_LOAD_FAILED_ERROR.to_string())?;
    serde_json::from_str(&json).map_err(|_| SETTINGS_PARSE_FAILED_ERROR.to_string())
}

#[tauri::command]
pub fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    info!(
        "[cmd] save_settings: theme={}, lang={}",
        settings.theme, settings.language
    );
    let path = settings_path(&app_handle, SETTINGS_SAVE_FAILED_ERROR)?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|_| SETTINGS_SAVE_FAILED_ERROR.to_string())?;
    std::fs::write(&path, json).map_err(|_| SETTINGS_SAVE_FAILED_ERROR.to_string())
}

#[tauri::command]
pub fn clear_all_saves(sm_state: tauri::State<crate::SaveManagerState>) -> Result<(), String> {
    log::warn!("[cmd] clear_all_saves: deleting all save data!");
    let mut sm = sm_state
        .0
        .lock()
        .map_err(|_| SAVE_MANAGER_UNAVAILABLE_ERROR.to_string())?;
    let save_ids: Vec<String> = sm.load_saves()?.into_iter().map(|s| s.id).collect();
    for id in save_ids {
        sm.delete_save(&id)?;
    }
    Ok(())
}
