use crate::league::FixtureCompetition;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct StatsState {
    pub player_matches: Vec<PlayerMatchStatsRecord>,
    pub team_matches: Vec<TeamMatchStatsRecord>,
}

impl StatsState {
    pub fn append(&mut self, other: StatsState) {
        self.player_matches.extend(other.player_matches);
        self.team_matches.extend(other.team_matches);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlayerMatchStatsRecord {
    pub fixture_id: String,
    pub season: u32,
    pub matchday: u32,
    pub date: String,
    pub competition: FixtureCompetition,
    pub player_id: String,
    pub team_id: String,
    pub opponent_team_id: String,
    pub home_team_id: String,
    pub away_team_id: String,
    pub home_goals: u8,
    pub away_goals: u8,
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
pub struct TeamMatchStatsRecord {
    pub fixture_id: String,
    pub season: u32,
    pub matchday: u32,
    pub date: String,
    pub competition: FixtureCompetition,
    pub team_id: String,
    pub opponent_team_id: String,
    pub home_team_id: String,
    pub away_team_id: String,
    pub goals_for: u8,
    pub goals_against: u8,
    pub possession_pct: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub passes_completed: u16,
    pub passes_attempted: u16,
    pub tackles_won: u16,
    pub interceptions: u16,
    pub fouls_committed: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
}
