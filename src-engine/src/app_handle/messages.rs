// messages commands — port of src-engine/src/commands/messages.rs
use std::collections::HashSet;

use wasm_bindgen::prelude::*;

use super::{to_js, to_js_value, AppHandle};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = markMessageRead)]
    pub fn mark_message_read(&self, message_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
            msg.read = true;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = deleteMessage)]
    pub fn delete_message(&self, message_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        game.messages.retain(|m| m.id != message_id);
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = deleteMessages)]
    pub fn delete_messages(&self, message_ids: JsValue) -> Result<JsValue, JsValue> {
        let ids: Vec<String> = serde_wasm_bindgen::from_value(message_ids)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let mut game = self.snapshot_game()?;
        let id_set: HashSet<String> = ids.into_iter().collect();
        game.messages.retain(|m| !id_set.contains(&m.id));
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = markAllMessagesRead)]
    pub fn mark_all_messages_read(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        for msg in game.messages.iter_mut() {
            msg.read = true;
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = clearOldMessages)]
    pub fn clear_old_messages(&self) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let current_date = game.clock.current_date.format("%Y-%m-%d").to_string();
        game.messages.retain(|m| {
            if !m.read {
                return true;
            }
            if m.actions.iter().any(|a| !a.resolved) {
                return true;
            }
            if let Ok(msg_date) = chrono::NaiveDate::parse_from_str(&m.date, "%Y-%m-%d") {
                if let Ok(cur_date) = chrono::NaiveDate::parse_from_str(&current_date, "%Y-%m-%d") {
                    return (cur_date - msg_date).num_days() <= 14;
                }
            }
            false
        });
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = resolveMessageAction)]
    pub fn resolve_message_action(
        &self,
        message_id: String,
        action_id: String,
        option_id: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;

        let (effect, effect_i18n_key, effect_i18n_params) = if let Some(opt) = option_id.as_deref()
        {
            if let Some(player_effect) = ofm_core::player_events::apply_player_response(
                &mut game,
                &message_id,
                &action_id,
                opt,
            ) {
                (
                    Some(player_effect.message),
                    Some(player_effect.i18n_key),
                    Some(player_effect.i18n_params),
                )
            } else if let Some(random_effect) = ofm_core::random_events::apply_event_response(
                &mut game,
                &message_id,
                &action_id,
                opt,
            ) {
                (
                    Some(random_effect.message),
                    Some(random_effect.i18n_key),
                    Some(random_effect.i18n_params),
                )
            } else if let Some(effect) = ofm_core::job_offers::apply_job_offer_response(
                &mut game,
                &message_id,
                &action_id,
                opt,
            ) {
                (
                    Some(effect.message),
                    Some(effect.i18n_key),
                    Some(effect.i18n_params),
                )
            } else if let Some(effect) = ofm_core::scouting::apply_youth_recruitment_response(
                &mut game,
                &message_id,
                &action_id,
                opt,
            ) {
                (
                    Some(effect.message),
                    Some(effect.i18n_key),
                    Some(effect.i18n_params),
                )
            } else {
                (None, None, None)
            }
        } else {
            if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                if let Some(action) = msg.actions.iter_mut().find(|a| a.id == action_id) {
                    action.resolved = true;
                }
            }
            (None, None, None)
        };

        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({
            "game": game,
            "effect": effect,
            "effect_i18n_key": effect_i18n_key,
            "effect_i18n_params": effect_i18n_params,
        }))
    }
}
