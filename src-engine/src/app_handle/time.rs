// time commands — port of src-engine/src/commands/time.rs
//
// Free helpers (advance_time_internal, compute_blocking_actions) are kept as
// `pub(crate)` so other handlers (skip_to_match_day, etc.) can reuse them.
use ofm_core::game::Game;
use ofm_core::state::StateManager;
use wasm_bindgen::prelude::*;

use crate::application::time_advancement::{
    advance_time_with_mode as advance_time_with_mode_service, AdvanceTimeWithModeResponse,
};
use crate::application::time_blockers::compute_blocking_actions as compute_blocking_actions_service;

use super::{to_js_value, AppHandle};

const NO_TEAM_ASSIGNED: &str = "be.error.noTeamAssigned";

pub(crate) fn advance_time_internal(state: &StateManager) -> Result<Game, String> {
    let mut current_game = state
        .get_game(|g| g.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;

    let mut captures = Vec::new();
    ofm_core::turn::process_day_with_capture(&mut current_game, &mut |capture| {
        captures.push(capture);
    });

    for capture in captures {
        state.append_stats_state(capture);
    }

    state.set_game(current_game.clone());
    Ok(current_game)
}

pub(crate) fn compute_blocking_actions(game: &Game) -> Vec<serde_json::Value> {
    compute_blocking_actions_service(game)
}

pub(crate) fn advance_time_with_mode_internal(
    state: &StateManager,
    mode: &str,
) -> Result<AdvanceTimeWithModeResponse, String> {
    advance_time_with_mode_service(state, mode)
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = advanceTime)]
    pub fn advance_time(&self) -> Result<JsValue, JsValue> {
        let game = advance_time_internal(&self.state).map_err(super::to_js)?;
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = advanceTimeWithMode)]
    pub fn advance_time_with_mode(&self, mode: String) -> Result<JsValue, JsValue> {
        let response = advance_time_with_mode_internal(&self.state, &mode).map_err(super::to_js)?;
        to_js_value(&response)
    }

    #[wasm_bindgen(js_name = checkBlockingActions)]
    pub fn check_blocking_actions(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let blockers = compute_blocking_actions(&game);
        to_js_value(&serde_json::json!(blockers))
    }

    #[wasm_bindgen(js_name = skipToMatchDay)]
    pub fn skip_to_match_day(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let user_team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| super::to_js(NO_TEAM_ASSIGNED.to_string()))?;

        let mut days_skipped = 0u32;
        loop {
            if days_skipped >= 60 {
                break;
            }

            let today = game.clock.current_date.format("%Y-%m-%d").to_string();
            let has_match = game.league.as_ref().is_some_and(|league| {
                league.fixtures.iter().any(|fixture| {
                    fixture.date == today
                        && fixture.status == domain::league::FixtureStatus::Scheduled
                        && (fixture.home_team_id == user_team_id
                            || fixture.away_team_id == user_team_id)
                })
            });
            if has_match {
                break;
            }

            let mut captures = Vec::new();
            ofm_core::turn::process_day_with_capture(&mut game, &mut |capture| {
                captures.push(capture);
            });
            for capture in captures {
                self.state.append_stats_state(capture);
            }
            days_skipped += 1;

            if game.manager.team_id.is_none() {
                self.state.set_game(game.clone());
                return to_js_value(&serde_json::json!({
                    "action": "fired",
                    "game": game,
                    "days_skipped": days_skipped,
                }));
            }

            let blockers = compute_blocking_actions(&game);
            if !blockers.is_empty() {
                self.state.set_game(game.clone());
                return to_js_value(&serde_json::json!({
                    "action": "blocked",
                    "game": game,
                    "blockers": blockers,
                    "days_skipped": days_skipped,
                }));
            }
        }

        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({
            "action": "arrived",
            "game": game,
            "days_skipped": days_skipped,
        }))
    }

    /// Advance day-by-day until the in-game date reaches `target_date`
    /// (inclusive lower bound: stops once `current_date >= target_date`).
    ///
    /// Vacation = FM-style holiday: the assistant takes charge and auto-plays
    /// every match (including the user's own fixtures, simulated instantly), so
    /// the run never pauses to open the matchday menu. It is still interrupted
    /// early — without further simulation — when one of these arises before the
    /// target is reached:
    ///   * the manager is fired       → action "fired"
    ///   * a blocking action appears  → action "blocked"
    /// Otherwise it returns action "arrived" at (or just past) the target.
    #[wasm_bindgen(js_name = advanceToDate)]
    pub fn advance_to_date(&self, target_date: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        // Vacation is only offered to employed managers; bail otherwise.
        let _user_team_id = game
            .manager
            .team_id
            .clone()
            .ok_or_else(|| super::to_js(NO_TEAM_ASSIGNED.to_string()))?;

        // Hard cap so a far-future target can never spin indefinitely.
        let max_days = 400u32;
        let mut days_advanced = 0u32;

        loop {
            let today = game.clock.current_date.format("%Y-%m-%d").to_string();
            // ISO dates sort lexicographically, so string comparison is a valid
            // chronological comparison here.
            if today.as_str() >= target_date.as_str() || days_advanced >= max_days {
                break;
            }

            // process_day simulates every fixture scheduled today — including the
            // user's match (instant, assistant-managed) — then advances the clock.
            let mut captures = Vec::new();
            ofm_core::turn::process_day_with_capture(&mut game, &mut |capture| {
                captures.push(capture);
            });
            for capture in captures {
                self.state.append_stats_state(capture);
            }
            days_advanced += 1;

            if game.manager.team_id.is_none() {
                self.state.set_game(game.clone());
                return to_js_value(&serde_json::json!({
                    "action": "fired",
                    "game": game,
                    "days_advanced": days_advanced,
                }));
            }

            let blockers = compute_blocking_actions(&game);
            if !blockers.is_empty() {
                self.state.set_game(game.clone());
                return to_js_value(&serde_json::json!({
                    "action": "blocked",
                    "game": game,
                    "blockers": blockers,
                    "days_advanced": days_advanced,
                }));
            }
        }

        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({
            "action": "arrived",
            "game": game,
            "days_advanced": days_advanced,
        }))
    }
}
