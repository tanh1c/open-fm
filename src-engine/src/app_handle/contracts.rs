// contracts commands — port of src-engine/src/commands/contracts.rs
use ofm_core::contracts::{
    ContractTerminationResult, DelegatedRenewalOptions, RenewalOffer,
};
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js, to_js_value};

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = proposeRenewal)]
    pub fn propose_renewal(
        &self,
        player_id: String,
        weekly_wage: u32,
        contract_years: u32,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let outcome = ofm_core::contracts::propose_renewal(
            &mut game,
            &player_id,
            RenewalOffer {
                weekly_wage,
                contract_years,
            },
        )
        .map_err(to_js)?;

        self.state.set_game(game.clone());

        to_js_value(&serde_json::json!({
            "outcome": outcome.decision,
            "game": game,
            "suggested_wage": outcome.suggested_wage,
            "suggested_years": outcome.suggested_years,
            "session_status": outcome.session_status,
            "is_terminal": outcome.is_terminal,
            "cooled_off": outcome.cooled_off,
            "feedback": outcome.feedback,
        }))
    }

    #[wasm_bindgen(js_name = delegateRenewals)]
    pub fn delegate_renewals(
        &self,
        player_ids: JsValue,
        max_wage_increase_pct: u32,
        max_contract_years: u32,
    ) -> Result<JsValue, JsValue> {
        let player_ids: Option<Vec<String>> = if player_ids.is_null() || player_ids.is_undefined() {
            None
        } else {
            serde_wasm_bindgen::from_value(player_ids)
                .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?
        };

        let mut game = self.snapshot_game()?;
        let report = ofm_core::contracts::delegate_renewals(
            &mut game,
            DelegatedRenewalOptions {
                player_ids,
                max_wage_increase_pct,
                max_contract_years,
            },
        )
        .map_err(to_js)?;

        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game, "report": report }))
    }

    #[wasm_bindgen(js_name = previewRenewalFinancialImpact)]
    pub fn preview_renewal_financial_impact(
        &self,
        player_id: String,
        weekly_wage: u32,
    ) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let projection =
            ofm_core::contracts::project_renewal_financial_impact(&game, &player_id, weekly_wage)
                .map_err(to_js)?;
        to_js_value(&serde_json::json!({ "projection": projection }))
    }

    #[wasm_bindgen(js_name = setContractExitIntent)]
    pub fn set_contract_exit_intent(
        &self,
        player_id: String,
        reason: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::contracts::set_contract_exit_intent(&mut game, &player_id, reason)
            .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game }))
    }

    #[wasm_bindgen(js_name = clearContractExitIntent)]
    pub fn clear_contract_exit_intent(&self, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::contracts::clear_contract_exit_intent(&mut game, &player_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game }))
    }

    #[wasm_bindgen(js_name = previewContractTermination)]
    pub fn preview_contract_termination(&self, player_id: String) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let preview = ofm_core::contracts::preview_contract_termination(&game, &player_id)
            .map_err(to_js)?;
        to_js_value(&serde_json::json!({ "preview": preview }))
    }

    #[wasm_bindgen(js_name = terminateContractNow)]
    pub fn terminate_contract_now(&self, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let ContractTerminationResult {
            severance_cost,
            squad_safety,
        } = ofm_core::contracts::terminate_contract_now(&mut game, &player_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({
            "game": game,
            "severance_cost": severance_cost,
            "squad_safety": squad_safety,
        }))
    }
}
