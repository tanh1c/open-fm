use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum NegotiationMood {
    #[default]
    Calm,
    Firm,
    Tense,
    Positive,
    Guarded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct NegotiationFeedback {
    pub mood: NegotiationMood,
    pub headline_key: String,
    pub detail_key: Option<String>,
    pub tension: u8,
    pub patience: u8,
    pub round: u8,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub params: HashMap<String, String>,
}
