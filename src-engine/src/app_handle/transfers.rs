// transfers commands — port of src-engine/src/commands/transfers.rs
use domain::player::Position;
use ofm_core::game::{YouthScoutingObjective, YouthScoutingRegion};
use ofm_core::transfers::{TransferContractOutcome, TransferNegotiationOutcome};
use wasm_bindgen::prelude::*;

use super::{AppHandle, to_js, to_js_value};

const INVALID_YOUTH_SCOUTING_REGION_ERROR: &str = "be.error.transfers.invalidYouthScoutingRegion";
const INVALID_YOUTH_SCOUTING_OBJECTIVE_ERROR: &str =
    "be.error.transfers.invalidYouthScoutingObjective";
const INVALID_YOUTH_SCOUTING_TARGET_POSITION_ERROR: &str =
    "be.error.transfers.invalidYouthScoutingTargetPosition";

fn parse_youth_region(value: Option<&str>) -> Result<YouthScoutingRegion, String> {
    match value {
        None | Some("") | Some("Domestic") => Ok(YouthScoutingRegion::Domestic),
        Some("International") => Ok(YouthScoutingRegion::International),
        Some(_) => Err(INVALID_YOUTH_SCOUTING_REGION_ERROR.to_string()),
    }
}

fn parse_youth_objective(value: Option<&str>) -> Result<YouthScoutingObjective, String> {
    match value {
        None | Some("") | Some("Balanced") => Ok(YouthScoutingObjective::Balanced),
        Some("HighPotential") => Ok(YouthScoutingObjective::HighPotential),
        Some("ReadySoon") => Ok(YouthScoutingObjective::ReadySoon),
        Some(_) => Err(INVALID_YOUTH_SCOUTING_OBJECTIVE_ERROR.to_string()),
    }
}

fn parse_youth_target_position(value: Option<&str>) -> Result<Option<Position>, String> {
    match value {
        None | Some("") => Ok(None),
        Some("Defender") => Ok(Some(Position::Defender)),
        Some("Midfielder") => Ok(Some(Position::Midfielder)),
        Some("Forward") => Ok(Some(Position::Forward)),
        Some(_) => Err(INVALID_YOUTH_SCOUTING_TARGET_POSITION_ERROR.to_string()),
    }
}

fn negotiation_response(outcome: TransferNegotiationOutcome, game: ofm_core::game::Game) -> serde_json::Value {
    serde_json::json!({
        "decision": outcome.decision,
        "suggested_fee": outcome.suggested_fee,
        "is_terminal": outcome.is_terminal,
        "feedback": outcome.feedback,
        "game": game,
    })
}

fn contract_response(outcome: TransferContractOutcome, game: ofm_core::game::Game) -> serde_json::Value {
    serde_json::json!({
        "decision": outcome.decision,
        "suggested_wage": outcome.suggested_wage,
        "suggested_years": outcome.suggested_years,
        "is_terminal": outcome.is_terminal,
        "feedback": outcome.feedback,
        "game": game,
    })
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = toggleTransferList)]
    pub fn toggle_transfer_list(&self, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        if let Some(p) = game.players.iter_mut().find(|p| p.id == player_id) {
            p.transfer_listed = !p.transfer_listed;
        } else {
            return Err(to_js("be.error.playerNotFound".to_string()));
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = toggleLoanList)]
    pub fn toggle_loan_list(&self, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        if let Some(p) = game.players.iter_mut().find(|p| p.id == player_id) {
            p.loan_listed = !p.loan_listed;
        } else {
            return Err(to_js("be.error.playerNotFound".to_string()));
        }
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = makeTransferBid)]
    pub fn make_transfer_bid(&self, player_id: String, fee: u64) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result =
            ofm_core::transfers::make_transfer_bid(&mut game, &player_id, fee).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&negotiation_response(result, game))
    }

    #[wasm_bindgen(js_name = toggleShortlist)]
    pub fn toggle_shortlist(&self, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::transfers::toggle_shortlist(&mut game, &player_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = approachFreeAgent)]
    pub fn approach_free_agent(
        &self,
        player_id: String,
        weekly_wage: u32,
        contract_years: u32,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result = ofm_core::transfers::approach_free_agent(
            &mut game,
            &player_id,
            weekly_wage,
            contract_years,
        )
        .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&contract_response(result, game))
    }

    #[wasm_bindgen(js_name = makeLoanOffer)]
    pub fn make_loan_offer(
        &self,
        player_id: String,
        loan_months: u32,
        wage_share_percent: u8,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result = ofm_core::transfers::make_loan_offer(
            &mut game,
            &player_id,
            loan_months,
            wage_share_percent,
        )
        .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&negotiation_response(result, game))
    }

    #[wasm_bindgen(js_name = proposeTransferContract)]
    pub fn propose_transfer_contract(
        &self,
        player_id: String,
        offer_id: String,
        weekly_wage: u32,
        contract_years: u32,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result = ofm_core::transfers::propose_transfer_contract(
            &mut game,
            &player_id,
            &offer_id,
            weekly_wage,
            contract_years,
        )
        .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&contract_response(result, game))
    }

    #[wasm_bindgen(js_name = previewTransferBidFinancialImpact)]
    pub fn preview_transfer_bid_financial_impact(
        &self,
        player_id: String,
        fee: u64,
    ) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let projection =
            ofm_core::transfers::project_transfer_bid_financial_impact(&game, &player_id, fee)
                .map_err(to_js)?;
        to_js_value(&serde_json::json!({ "projection": projection }))
    }

    #[wasm_bindgen(js_name = respondToOffer)]
    pub fn respond_to_offer(
        &self,
        player_id: String,
        offer_id: String,
        accept: bool,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::transfers::respond_to_offer(&mut game, &player_id, &offer_id, accept)
            .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = counterOffer)]
    pub fn counter_offer(
        &self,
        player_id: String,
        offer_id: String,
        requested_fee: u64,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let result =
            ofm_core::transfers::counter_offer(&mut game, &player_id, &offer_id, requested_fee)
                .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&negotiation_response(result, game))
    }

    #[wasm_bindgen(js_name = sendScout)]
    pub fn send_scout(&self, scout_id: String, player_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::scouting::send_scout(&mut game, &scout_id, &player_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = startYouthScouting)]
    pub fn start_youth_scouting(
        &self,
        scout_id: String,
        region: Option<String>,
        objective: Option<String>,
        target_position: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let region = parse_youth_region(region.as_deref()).map_err(to_js)?;
        let objective = parse_youth_objective(objective.as_deref()).map_err(to_js)?;
        let target_position = parse_youth_target_position(target_position.as_deref())
            .map_err(to_js)?;

        ofm_core::scouting::start_youth_scouting(
            &mut game,
            &scout_id,
            region,
            objective,
            target_position,
        )
        .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = cancelYouthScouting)]
    pub fn cancel_youth_scouting(&self, assignment_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::scouting::cancel_youth_scouting(&mut game, &assignment_id).map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = reassignYouthScouting)]
    pub fn reassign_youth_scouting(
        &self,
        assignment_id: String,
        scout_id: String,
    ) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        ofm_core::scouting::reassign_youth_scouting(&mut game, &assignment_id, &scout_id)
            .map_err(to_js)?;
        self.state.set_game(game.clone());
        to_js_value(&game)
    }
}
