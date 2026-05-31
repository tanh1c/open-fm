// Long-term honours and all-time records.
//
// These summaries are tiny (a handful of rows per season) and are meant to
// persist for the entire career, independent of the per-match stat retention
// window. They power leaderboards, a champions roll of honour, and FM-style
// "club records" screens.
use serde::{Deserialize, Serialize};

use crate::season_awards::SeasonAwards;

/// The winner of a single competition in a given season.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompetitionChampion {
    pub competition_id: String,
    pub competition_name: String,
    pub team_id: String,
    pub team_name: String,
}

/// Honours awarded at the end of one season: all competition champions plus
/// the individual award standings (golden boot, POTY, ...).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonHonours {
    pub season: u32,
    pub champions: Vec<CompetitionChampion>,
    pub awards: SeasonAwards,
}

/// A player-held all-time record (e.g. most goals in a single season).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct PlayerRecord {
    pub player_id: String,
    pub player_name: String,
    pub team_name: String,
    pub value: u32,
    pub season: u32,
}

/// A team-held all-time record (e.g. most points in a season).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct TeamRecord {
    pub team_id: String,
    pub team_name: String,
    pub value: u32,
    pub season: u32,
}

/// The most expensive transfer ever recorded in the save.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct TransferRecord {
    pub player_id: String,
    pub player_name: String,
    pub from_team_name: String,
    pub to_team_name: String,
    pub fee: u64,
    pub season: u32,
}

/// All-time "best ever" records for the save. Updated once per season at
/// rollover; every field is optional so a fresh or legacy save starts empty.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct GameRecords {
    pub most_goals_in_season: Option<PlayerRecord>,
    pub most_career_goals: Option<PlayerRecord>,
    pub most_assists_in_season: Option<PlayerRecord>,
    pub most_career_assists: Option<PlayerRecord>,
    pub most_clean_sheets_in_season: Option<PlayerRecord>,
    pub most_career_clean_sheets: Option<PlayerRecord>,
    pub longest_unbeaten_run: Option<TeamRecord>,
    pub record_transfer_fee: Option<TransferRecord>,
    pub highest_points_in_season: Option<TeamRecord>,
    pub most_goals_team_in_season: Option<TeamRecord>,
}

impl GameRecords {
    /// Replace `slot` with `candidate` when the candidate's value is strictly
    /// higher than the current holder (or there is no holder yet).
    pub fn promote_player_record(slot: &mut Option<PlayerRecord>, candidate: PlayerRecord) {
        if candidate.value == 0 {
            return;
        }
        let better = match slot {
            Some(current) => candidate.value > current.value,
            None => true,
        };
        if better {
            *slot = Some(candidate);
        }
    }

    pub fn promote_team_record(slot: &mut Option<TeamRecord>, candidate: TeamRecord) {
        if candidate.value == 0 {
            return;
        }
        let better = match slot {
            Some(current) => candidate.value > current.value,
            None => true,
        };
        if better {
            *slot = Some(candidate);
        }
    }

    pub fn promote_transfer_record(slot: &mut Option<TransferRecord>, candidate: TransferRecord) {
        if candidate.fee == 0 {
            return;
        }
        let better = match slot {
            Some(current) => candidate.fee > current.fee,
            None => true,
        };
        if better {
            *slot = Some(candidate);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn promote_player_record_keeps_higher_value() {
        let mut slot = None;
        GameRecords::promote_player_record(
            &mut slot,
            PlayerRecord {
                player_id: "p1".into(),
                player_name: "One".into(),
                team_name: "A".into(),
                value: 30,
                season: 2026,
            },
        );
        assert_eq!(slot.as_ref().unwrap().value, 30);

        // Lower candidate does not replace.
        GameRecords::promote_player_record(
            &mut slot,
            PlayerRecord {
                player_id: "p2".into(),
                player_name: "Two".into(),
                team_name: "B".into(),
                value: 25,
                season: 2027,
            },
        );
        assert_eq!(slot.as_ref().unwrap().player_id, "p1");

        // Higher candidate replaces.
        GameRecords::promote_player_record(
            &mut slot,
            PlayerRecord {
                player_id: "p3".into(),
                player_name: "Three".into(),
                team_name: "C".into(),
                value: 41,
                season: 2028,
            },
        );
        assert_eq!(slot.as_ref().unwrap().player_id, "p3");
        assert_eq!(slot.as_ref().unwrap().value, 41);
    }

    #[test]
    fn promote_ignores_zero_value() {
        let mut slot = None;
        GameRecords::promote_team_record(
            &mut slot,
            TeamRecord {
                team_id: "t".into(),
                team_name: "T".into(),
                value: 0,
                season: 2026,
            },
        );
        assert!(slot.is_none());
    }
}
