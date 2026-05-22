use super::format_money;
use crate::game::Game;
use domain::team::{Sponsorship, SponsorshipBonusCriterion};
use rand::RngExt;
use std::collections::HashMap;

pub struct RandomEventResponseEffect {
    pub message: String,
    pub i18n_key: String,
    pub i18n_params: HashMap<String, String>,
}

fn response_effect(
    i18n_key: &str,
    i18n_params: HashMap<String, String>,
) -> RandomEventResponseEffect {
    RandomEventResponseEffect {
        message: String::new(),
        i18n_key: i18n_key.to_string(),
        i18n_params,
    }
}

fn parse_amount_param(value: &str) -> Option<u64> {
    let digits: String = value.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        digits.parse::<u64>().ok()
    }
}

/// Apply the effect of a sponsor offer choice.
pub fn apply_event_response(
    game: &mut Game,
    message_id: &str,
    _action_id: &str,
    option_id: &str,
) -> Option<RandomEventResponseEffect> {
    if message_id.starts_with("sponsor_") {
        let user_team_id = game.manager.team_id.clone()?;
        match option_id {
            "accept" => {
                let amount = game
                    .messages
                    .iter()
                    .find(|m| m.id == message_id)
                    .and_then(|m| m.i18n_params.get("amount"))
                    .and_then(|amount| parse_amount_param(amount))
                    .unwrap_or(100_000);
                let sponsor_name = game
                    .messages
                    .iter()
                    .find(|m| m.id == message_id)
                    .and_then(|m| m.i18n_params.get("sponsor"))
                    .cloned()
                    .unwrap_or_else(|| "Sponsor".to_string());
                if let Some(team) = game.teams.iter_mut().find(|t| t.id == user_team_id) {
                    team.sponsorship = Some(Sponsorship {
                        sponsor_name,
                        base_value: amount as i64,
                        remaining_weeks: 12,
                        bonus_criteria: vec![SponsorshipBonusCriterion::UnbeatenRun {
                            required_matches: 3,
                            bonus_amount: amount as i64 / 4,
                        }],
                    });
                }
                // Mark resolved
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.sponsor.effects.accepted",
                    HashMap::from([("amount".to_string(), format_money(amount))]),
                ))
            }
            "decline" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.sponsor.effects.declined",
                    HashMap::new(),
                ))
            }
            _ => None,
        }
    } else if message_id.starts_with("board_confidence_") {
        match option_id {
            "reassure_board" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.boardConfidence.effects.reassureBoard",
                    HashMap::new(),
                ))
            }
            "accept_pressure" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.boardConfidence.effects.acceptPressure",
                    HashMap::new(),
                ))
            }
            "blame_circumstances" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.boardConfidence.effects.blameCircumstances",
                    HashMap::new(),
                ))
            }
            _ => None,
        }
    } else if message_id.starts_with("fan_petition_") {
        match option_id {
            "listen_fans" => {
                // Small morale boost across squad
                let user_team_id = game.manager.team_id.clone().unwrap_or_default();
                let mut rng = rand::rng();
                for p in game.players.iter_mut() {
                    if p.team_id.as_deref() == Some(&user_team_id) {
                        p.morale = (p.morale as i16 + rng.random_range(1..=3)).clamp(10, 100) as u8;
                    }
                }
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.fanPetition.effects.listenFans",
                    HashMap::new(),
                ))
            }
            "ignore_fans" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.fanPetition.effects.ignoreFans",
                    HashMap::new(),
                ))
            }
            "address_publicly" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.fanPetition.effects.addressPublicly",
                    HashMap::new(),
                ))
            }
            _ => None,
        }
    } else if message_id.starts_with("rival_interest_") {
        let player_id = game
            .messages
            .iter()
            .find(|m| m.id == message_id)
            .and_then(|m| m.context.player_id.clone());
        match option_id {
            "not_for_sale" => {
                // Player morale boost — they feel valued
                if let Some(pid) = &player_id
                    && let Some(p) = game.players.iter_mut().find(|p| p.id == *pid)
                {
                    let mut rng = rand::rng();
                    p.morale = (p.morale as i16 + rng.random_range(3..=8)).clamp(10, 100) as u8;
                }
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.rivalInterest.effects.notForSale",
                    HashMap::new(),
                ))
            }
            "open_to_offers" => {
                // Player morale drop — they feel uncertain
                if let Some(pid) = &player_id
                    && let Some(p) = game.players.iter_mut().find(|p| p.id == *pid)
                {
                    let mut rng = rand::rng();
                    p.morale = (p.morale as i16 - rng.random_range(3..=8)).clamp(10, 100) as u8;
                }
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.rivalInterest.effects.openToOffers",
                    HashMap::new(),
                ))
            }
            "no_comment" => {
                if let Some(msg) = game.messages.iter_mut().find(|m| m.id == message_id) {
                    for a in msg.actions.iter_mut() {
                        a.resolved = true;
                    }
                }
                Some(response_effect(
                    "be.msg.rivalInterest.effects.noComment",
                    HashMap::new(),
                ))
            }
            _ => None,
        }
    } else {
        None
    }
}
