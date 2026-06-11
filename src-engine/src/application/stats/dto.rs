use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerAdvancedMetricDto {
    pub total: u32,
    pub per90: Option<f32>,
    pub percentile: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerAdvancedPassMetricDto {
    pub completed: u32,
    pub attempted: u32,
    pub accuracy: Option<f32>,
    pub percentile: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerStatsOverviewMetricsDto {
    pub shots: PlayerAdvancedMetricDto,
    pub shots_on_target: PlayerAdvancedMetricDto,
    pub passes: PlayerAdvancedPassMetricDto,
    pub tackles_won: PlayerAdvancedMetricDto,
    pub interceptions: PlayerAdvancedMetricDto,
    pub fouls_committed: PlayerAdvancedMetricDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSeasonTotalsDto {
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
    pub clean_sheets: u32,
    pub yellow_cards: u32,
    pub red_cards: u32,
    pub avg_rating: f32,
    pub minutes_played: u32,
    pub shots: u32,
    pub shots_on_target: u32,
    pub passes_completed: u32,
    pub passes_attempted: u32,
    pub tackles_won: u32,
    pub interceptions: u32,
    pub fouls_committed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerCompetitionStatsDto {
    pub competition: String,
    pub team_id: String,
    pub team_name: String,
    pub totals: PlayerSeasonTotalsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerTransferHistoryDto {
    pub date: String,
    pub from_team_id: String,
    pub from_team_name: String,
    pub to_team_id: String,
    pub to_team_name: String,
    pub fee: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayerStatsOverviewDto {
    pub percentile_eligible: bool,
    pub season_totals: Option<PlayerSeasonTotalsDto>,
    pub competition_stats: Vec<PlayerCompetitionStatsDto>,
    pub transfer_history: Vec<PlayerTransferHistoryDto>,
    pub metrics: PlayerStatsOverviewMetricsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayerMatchHistoryEntryDto {
    pub fixture_id: String,
    pub date: String,
    pub competition: String,
    pub matchday: u32,
    pub opponent_team_id: String,
    pub opponent_name: String,
    pub team_goals: u8,
    pub opponent_goals: u8,
    pub minutes_played: u8,
    pub goals: u8,
    pub assists: u8,
    pub shots: u8,
    pub shots_on_target: u8,
    pub passes_completed: u8,
    pub passes_attempted: u8,
    pub tackles_won: u8,
    pub interceptions: u8,
    pub fouls_committed: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub rating: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamMatchHistoryEntryDto {
    pub fixture_id: String,
    pub date: String,
    pub competition: String,
    pub matchday: u32,
    pub opponent_team_id: String,
    pub opponent_name: String,
    pub goals_for: u8,
    pub goals_against: u8,
    pub possession_pct: u8,
    pub shots: u16,
    pub shots_on_target: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamAdvancedMetricDto {
    pub total: u32,
    pub per_match: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamAdvancedPassMetricDto {
    pub completed: u32,
    pub attempted: u32,
    pub accuracy: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamStatsOverviewMetricsDto {
    pub shots: TeamAdvancedMetricDto,
    pub shots_on_target: TeamAdvancedMetricDto,
    pub passes: TeamAdvancedPassMetricDto,
    pub tackles_won: TeamAdvancedMetricDto,
    pub interceptions: TeamAdvancedMetricDto,
    pub fouls_committed: TeamAdvancedMetricDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamStatsOverviewDto {
    pub matches_played: u32,
    pub goals_for: u32,
    pub goals_against: u32,
    pub goal_difference: i32,
    pub possession_average: Option<f32>,
    pub metrics: TeamStatsOverviewMetricsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamProfileStatsDto {
    pub team_stats_overview: Option<TeamStatsOverviewDto>,
    pub recent_matches: Vec<TeamMatchHistoryEntryDto>,
    pub roster_stats_by_player_id: std::collections::HashMap<String, PlayerSeasonTotalsDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchDetailDto {
    pub fixture_id: String,
    pub date: String,
    pub competition: String,
    pub matchday: u32,
    pub stage: Option<String>,
    pub leg: Option<u8>,
    pub home_team_id: String,
    pub home_team_name: String,
    pub away_team_id: String,
    pub away_team_name: String,
    pub home_goals: u8,
    pub away_goals: u8,
    pub resolution: Option<String>,
    pub home_penalties: Option<u8>,
    pub away_penalties: Option<u8>,
    pub total_minutes: Option<u8>,
    pub events: Vec<MatchDetailEventDto>,
    pub home_stats: Option<MatchDetailTeamStatsDto>,
    pub away_stats: Option<MatchDetailTeamStatsDto>,
    pub player_stats: Vec<MatchDetailPlayerStatsDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchDetailEventDto {
    pub minute: u8,
    pub event_type: String,
    pub side: String,
    pub player_id: Option<String>,
    pub player_name: Option<String>,
    pub secondary_player_id: Option<String>,
    pub secondary_player_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchDetailTeamStatsDto {
    pub team_id: String,
    pub team_name: String,
    pub possession_pct: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub passes_completed: Option<u16>,
    pub passes_attempted: Option<u16>,
    pub tackles_won: Option<u16>,
    pub interceptions: Option<u16>,
    pub fouls: u16,
    pub corners: Option<u16>,
    pub yellow_cards: u8,
    pub red_cards: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchDetailPlayerStatsDto {
    pub player_id: String,
    pub player_name: String,
    pub team_id: String,
    pub team_name: String,
    pub side: String,
    pub minutes_played: u8,
    pub goals: u8,
    pub assists: u8,
    pub shots: u8,
    pub shots_on_target: u8,
    pub passes_completed: u8,
    pub passes_attempted: u8,
    pub tackles_won: u8,
    pub interceptions: u8,
    pub fouls_committed: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub rating: f32,
}
