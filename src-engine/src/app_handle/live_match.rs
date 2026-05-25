// live_match commands — port of src-engine/src/commands/live_match.rs
//
// Press conference logic is large and self-contained; the entire body is moved
// here verbatim, only adapted to take `&self` and JsValue I/O.

use std::collections::HashMap;

use rand::RngExt;
use serde::Deserialize;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::application::live_match::{
    apply_match_command as apply_match_command_service,
    finish_live_match as finish_live_match_service,
    get_match_snapshot as get_match_snapshot_service, start_live_match as start_live_match_service,
    step_live_match as step_live_match_service,
};
use crate::application::team_talk::apply_team_talk as apply_team_talk_service;

use super::{to_js, to_js_value, AppHandle};

#[derive(Debug, Deserialize)]
struct PressConferenceAnswer {
    question_id: String,
    response_id: String,
    #[allow(dead_code)]
    #[serde(default, rename = "response_tone")]
    response_tone: String,
    response_text: String,
    #[serde(default)]
    response_text_key: String,
    #[serde(default)]
    response_text_params: HashMap<String, String>,
    #[allow(dead_code)]
    #[serde(default)]
    question_text: String,
    #[serde(default)]
    player_id: String,
}

#[derive(Debug, Serialize)]
struct LocalizedPressQuote {
    #[serde(skip_serializing_if = "String::is_empty")]
    key: String,
    fallback: String,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    params: HashMap<String, String>,
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = startLiveMatch)]
    pub fn start_live_match(
        &self,
        fixture_index: usize,
        mode: String,
        allows_extra_time: bool,
    ) -> Result<JsValue, JsValue> {
        let snapshot =
            start_live_match_service(&self.state, fixture_index, &mode, allows_extra_time)
                .map_err(to_js)?;
        to_js_value(&snapshot)
    }

    #[wasm_bindgen(js_name = stepLiveMatch)]
    pub fn step_live_match(&self, minutes: u16) -> Result<JsValue, JsValue> {
        let results = step_live_match_service(&self.state, minutes).map_err(to_js)?;
        to_js_value(&results)
    }

    #[wasm_bindgen(js_name = applyMatchCommand)]
    pub fn apply_match_command(&self, command: JsValue) -> Result<JsValue, JsValue> {
        let command: engine::MatchCommand = serde_wasm_bindgen::from_value(command)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;
        let snapshot = apply_match_command_service(&self.state, command).map_err(to_js)?;
        to_js_value(&snapshot)
    }

    #[wasm_bindgen(js_name = getMatchSnapshot)]
    pub fn get_match_snapshot(&self) -> Result<JsValue, JsValue> {
        let snapshot = get_match_snapshot_service(&self.state).map_err(to_js)?;
        to_js_value(&snapshot)
    }

    #[wasm_bindgen(js_name = finishLiveMatch)]
    pub fn finish_live_match(&self) -> Result<JsValue, JsValue> {
        let response = finish_live_match_service(&self.state).map_err(to_js)?;
        to_js_value(&response)
    }

    #[wasm_bindgen(js_name = applyTeamTalk)]
    pub fn apply_team_talk(&self, tone: String, context: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let seed = rand::rng().random::<u64>();
        let results = apply_team_talk_service(&mut game, &tone, &context, seed).map_err(to_js)?;
        self.state.set_game(game);
        to_js_value(&results)
    }

    /// Process press conference answers: generate news article, affect squad morale.
    #[wasm_bindgen(js_name = submitPressConference)]
    #[allow(clippy::too_many_arguments)]
    pub fn submit_press_conference(
        &self,
        answers: JsValue,
        home_team: String,
        away_team: String,
        home_score: u8,
        away_score: u8,
        user_team_name: String,
        user_team_id: String,
    ) -> Result<JsValue, JsValue> {
        let answers: Vec<PressConferenceAnswer> = serde_wasm_bindgen::from_value(answers)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;

        let mut game = self.snapshot_game()?;
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();
        let mut rng = rand::rng();

        let mut quotes: Vec<String> = Vec::new();
        let mut localized_quotes: Vec<LocalizedPressQuote> = Vec::new();
        let mut morale_delta: i16 = 0;
        let mut mentioned_player_ids: Vec<String> = Vec::new();

        for answer in &answers {
            let rid = answer.response_id.as_str();
            let text = answer.response_text.as_str();
            let qid = answer.question_id.as_str();

            if !text.is_empty() {
                quotes.push(format!("\"{}\"", text));
                localized_quotes.push(LocalizedPressQuote {
                    key: answer.response_text_key.clone(),
                    fallback: text.to_string(),
                    params: answer.response_text_params.clone(),
                });
            }

            if !answer.player_id.is_empty() {
                mentioned_player_ids.push(answer.player_id.clone());
            }

            match rid {
                "humble" | "fair" | "positive" | "focused" | "grateful" | "patience"
                | "appreciate" | "understand" => morale_delta += rng.random_range(1..=3),
                "confident" | "ambitious" | "shared" => morale_delta += rng.random_range(2..=5),
                "defiant" | "frustrated" => morale_delta += rng.random_range(-2..=2),
                "curt" | "evasive" => morale_delta += rng.random_range(-3..=0),
                "accept" | "detailed" | "apologize" => morale_delta += rng.random_range(0..=2),
                "deflect" => morale_delta += rng.random_range(-1..=1),
                "praise" => morale_delta += rng.random_range(3..=6),
                "demanding" => morale_delta += rng.random_range(-2..=3),
                _ => {}
            }

            if qid == "player_focus" && !answer.player_id.is_empty() {
                let player_delta: i16 = match rid {
                    "praise" => rng.random_range(4..=8),
                    "demanding" => rng.random_range(-3..=4),
                    "deflect" => rng.random_range(-2..=1),
                    _ => rng.random_range(0..=3),
                };
                if let Some(p) = game.players.iter_mut().find(|p| p.id == answer.player_id) {
                    p.morale = ((p.morale as i16) + player_delta).clamp(10, 100) as u8;
                }
            }
        }

        morale_delta = morale_delta.clamp(-8, 8);
        if morale_delta != 0 {
            for p in game.players.iter_mut() {
                if p.team_id.as_deref() == Some(&user_team_id) {
                    p.morale = ((p.morale as i16) + morale_delta).clamp(10, 100) as u8;
                }
            }
        }

        let result_str = format!(
            "{} {} - {} {}",
            home_team, home_score, away_score, away_team
        );
        let headline_key = if quotes.is_empty() {
            "be.news.pressConference.headlinePostMatch"
        } else if rng.random::<bool>() {
            "be.news.pressConference.headlineManagerQuote"
        } else {
            "be.news.pressConference.headlinePressConf"
        };
        let body_key = if quotes.len() > 1 {
            "be.news.pressConference.bodyMultiple"
        } else if quotes.len() == 1 {
            "be.news.pressConference.bodySingle"
        } else {
            "be.news.pressConference.bodyNone"
        };

        let mut i18n_params = HashMap::new();
        i18n_params.insert("team".to_string(), user_team_name.clone());
        i18n_params.insert("result".to_string(), result_str);
        if !localized_quotes.is_empty() {
            if let Ok(serialized_quotes) = serde_json::to_string(&localized_quotes) {
                i18n_params.insert("quotesData".to_string(), serialized_quotes);
            }
            i18n_params.insert("quote".to_string(), quotes[0].trim_matches('"').to_string());
        }

        let article_id = format!("press_conf_{}", today);
        let article = domain::news::NewsArticle::new(
            article_id,
            String::new(),
            String::new(),
            String::new(),
            today,
            domain::news::NewsCategory::MatchReport,
        )
        .with_teams(vec![user_team_id.clone()])
        .with_players(mentioned_player_ids)
        .with_i18n(headline_key, body_key, "be.source.sportsDaily", i18n_params);

        game.news.push(article);
        self.state.set_game(game.clone());

        to_js_value(&serde_json::json!({
            "game": game,
            "morale_delta": morale_delta,
        }))
    }
}
