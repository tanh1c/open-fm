use crate::league::FixtureCompetition;
use serde::{Deserialize, Serialize};

/// How many of the most recent seasons of per-match detail to retain.
///
/// Per-match records exist for the "recent matches / form" screens and grow
/// every fixture. Long-term records (player career summaries, team history,
/// season honours) are stored separately and are NOT affected by this cap, so
/// leaderboards and historical records survive pruning.
pub const MAX_RETAINED_STAT_SEASONS: u32 = 5;

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
        self.prune_to_recent_seasons();
    }

    /// Oldest season to retain, or `None` when there are no records yet.
    pub fn retained_min_season(&self) -> Option<u32> {
        let max_season = self
            .player_matches
            .iter()
            .map(|record| record.season)
            .chain(self.team_matches.iter().map(|record| record.season))
            .max()?;
        Some(max_season.saturating_sub(MAX_RETAINED_STAT_SEASONS - 1))
    }

    /// Drop per-match records older than the retention window. Keeps the most
    /// recent `MAX_RETAINED_STAT_SEASONS` seasons relative to the newest record.
    pub fn prune_to_recent_seasons(&mut self) {
        let Some(min_season) = self.retained_min_season() else {
            return;
        };
        self.player_matches
            .retain(|record| record.season >= min_season);
        self.team_matches
            .retain(|record| record.season >= min_season);
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

#[cfg(test)]
mod tests {
    use super::*;

    fn player_record(fixture_id: &str, season: u32) -> PlayerMatchStatsRecord {
        PlayerMatchStatsRecord {
            fixture_id: fixture_id.to_string(),
            season,
            matchday: 1,
            date: format!("{season}-08-10"),
            competition: FixtureCompetition::League,
            player_id: "p1".to_string(),
            team_id: "t1".to_string(),
            opponent_team_id: "t2".to_string(),
            home_team_id: "t1".to_string(),
            away_team_id: "t2".to_string(),
            home_goals: 1,
            away_goals: 0,
            minutes_played: 90,
            goals: 0,
            assists: 0,
            shots: 0,
            shots_on_target: 0,
            passes_completed: 0,
            passes_attempted: 0,
            tackles_won: 0,
            interceptions: 0,
            fouls_committed: 0,
            yellow_cards: 0,
            red_cards: 0,
            rating: 6.5,
        }
    }

    #[test]
    fn append_prunes_seasons_older_than_retention_window() {
        let mut state = StatsState::default();
        // Seasons 2020..=2027 (8 seasons); window keeps the most recent 5.
        for season in 2020..=2027 {
            let mut incoming = StatsState::default();
            incoming
                .player_matches
                .push(player_record(&format!("fix-{season}"), season));
            state.append(incoming);
        }

        let seasons: Vec<u32> = state
            .player_matches
            .iter()
            .map(|record| record.season)
            .collect();
        assert_eq!(seasons, vec![2023, 2024, 2025, 2026, 2027]);
        assert_eq!(state.retained_min_season(), Some(2023));
    }

    #[test]
    fn prune_keeps_everything_within_window() {
        let mut state = StatsState::default();
        for season in 2026..=2027 {
            state
                .player_matches
                .push(player_record(&format!("fix-{season}"), season));
        }
        state.prune_to_recent_seasons();
        assert_eq!(state.player_matches.len(), 2);
    }
}
