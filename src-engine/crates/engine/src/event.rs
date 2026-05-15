use crate::types::{Side, Zone};
use serde::{Deserialize, Serialize};

/// A single event that occurred during the match.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchEvent {
    pub minute: u8,
    pub event_type: EventType,
    pub side: Side,
    pub zone: Zone,
    /// ID of the primary player involved (scorer, passer, fouler, etc.).
    pub player_id: Option<String>,
    /// ID of a secondary player (assist provider, fouled player, etc.).
    pub secondary_player_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventType {
    // --- Structural events ---
    KickOff,
    HalfTime,
    SecondHalfStart,
    FullTime,

    // --- Possession & passing ---
    PassCompleted,
    PassIntercepted,

    // --- Attacking ---
    Dribble,
    DribbleTackled,
    Cross,

    // --- Shooting ---
    ShotOnTarget,
    ShotOffTarget,
    ShotBlocked,
    ShotSaved,
    Goal,
    PenaltyAwarded,
    PenaltyGoal,
    PenaltyMiss,

    // --- Defending ---
    Tackle,
    Interception,
    Clearance,

    // --- Fouls & discipline ---
    Foul,
    YellowCard,
    RedCard,
    SecondYellow,

    // --- Set pieces ---
    Corner,
    FreeKick,

    // --- Other ---
    Injury,
    GoalKick,
    Substitution,
}

impl MatchEvent {
    pub fn new(minute: u8, event_type: EventType, side: Side, zone: Zone) -> Self {
        Self {
            minute,
            event_type,
            side,
            zone,
            player_id: None,
            secondary_player_id: None,
        }
    }

    pub fn with_player(mut self, player_id: &str) -> Self {
        self.player_id = Some(player_id.to_string());
        self
    }

    pub fn with_secondary(mut self, player_id: &str) -> Self {
        self.secondary_player_id = Some(player_id.to_string());
        self
    }

    pub fn is_goal(&self) -> bool {
        matches!(self.event_type, EventType::Goal | EventType::PenaltyGoal)
    }
}
