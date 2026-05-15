use engine::{MatchConfig, MatchReport, TeamData, simulate_with_rng};
use rand::SeedableRng;
use rand::rngs::StdRng;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn _start() {
    #[cfg(feature = "console_errors")]
    console_error_panic_hook::set_once();
}

/// Simulate a single match. Inputs/outputs are JSON-compatible JS values.
///
/// `home`, `away`: TeamData
/// `config`: MatchConfig (or null for default)
/// `seed`: u64 seed for deterministic RNG (optional, pass 0 for none)
#[wasm_bindgen]
pub fn simulate_match(
    home: JsValue,
    away: JsValue,
    config: JsValue,
    seed: u64,
) -> Result<JsValue, JsValue> {
    let home: TeamData = serde_wasm_bindgen::from_value(home)
        .map_err(|e| JsValue::from_str(&format!("home parse: {e}")))?;
    let away: TeamData = serde_wasm_bindgen::from_value(away)
        .map_err(|e| JsValue::from_str(&format!("away parse: {e}")))?;
    let config: MatchConfig = if config.is_null() || config.is_undefined() {
        MatchConfig::default()
    } else {
        serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&format!("config parse: {e}")))?
    };

    let mut rng = StdRng::seed_from_u64(seed);
    let report: MatchReport = simulate_with_rng(&home, &away, &config, &mut rng);
    serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&format!("encode: {e}")))
}

/// Bench helper: simulate N matches, return total elapsed milliseconds (measured in JS).
/// Returns just the final report's goal totals to prevent dead-code elimination.
#[wasm_bindgen]
pub fn bench_simulate(home: JsValue, away: JsValue, n: u32, seed: u64) -> Result<JsValue, JsValue> {
    let home: TeamData = serde_wasm_bindgen::from_value(home)
        .map_err(|e| JsValue::from_str(&format!("home parse: {e}")))?;
    let away: TeamData = serde_wasm_bindgen::from_value(away)
        .map_err(|e| JsValue::from_str(&format!("away parse: {e}")))?;
    let config = MatchConfig::default();

    let mut rng = StdRng::seed_from_u64(seed);
    let mut total_home = 0u32;
    let mut total_away = 0u32;
    for _ in 0..n {
        let r = simulate_with_rng(&home, &away, &config, &mut rng);
        total_home += r.home_goals as u32;
        total_away += r.away_goals as u32;
    }

    let result = serde_json::json!({
        "matches": n,
        "total_home_goals": total_home,
        "total_away_goals": total_away,
    });
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&format!("encode: {e}")))
}
