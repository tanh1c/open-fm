use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum SeasonPhase {
    #[default]
    Preseason,
    InSeason,
    PostSeason,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum TransferWindowStatus {
    #[default]
    Closed,
    Open,
    DeadlineDay,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct TransferWindowContext {
    pub status: TransferWindowStatus,
    pub opens_on: Option<String>,
    pub closes_on: Option<String>,
    pub days_until_opens: Option<i64>,
    pub days_remaining: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct SeasonContext {
    pub phase: SeasonPhase,
    pub season_start: Option<String>,
    pub season_end: Option<String>,
    pub days_until_season_start: Option<i64>,
    pub transfer_window: TransferWindowContext,
}
