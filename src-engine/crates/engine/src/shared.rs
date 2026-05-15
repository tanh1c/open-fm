use crate::types::{MatchConfig, PlayStyle, PlayerData, Side};

// ---------------------------------------------------------------------------
// PlayerSnap — lightweight snapshot of a player to avoid borrow conflicts
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[allow(dead_code)]
pub(crate) struct PlayerSnap {
    pub id: String,
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
    pub agility: u8,
    pub passing: u8,
    pub shooting: u8,
    pub tackling: u8,
    pub dribbling: u8,
    pub defending: u8,
    pub positioning: u8,
    pub vision: u8,
    pub decisions: u8,
    pub composure: u8,
    pub aggression: u8,
    pub teamwork: u8,
    pub leadership: u8,
    pub handling: u8,
    pub reflexes: u8,
    pub aerial: u8,
    pub traits: Vec<String>,
}

impl PlayerSnap {
    pub fn from(p: &PlayerData) -> Self {
        Self {
            id: p.id.clone(),
            pace: p.pace,
            stamina: p.stamina,
            strength: p.strength,
            agility: p.agility,
            passing: p.passing,
            shooting: p.shooting,
            tackling: p.tackling,
            dribbling: p.dribbling,
            defending: p.defending,
            positioning: p.positioning,
            vision: p.vision,
            decisions: p.decisions,
            composure: p.composure,
            aggression: p.aggression,
            teamwork: p.teamwork,
            leadership: p.leadership,
            handling: p.handling,
            reflexes: p.reflexes,
            aerial: p.aerial,
            traits: p.traits.clone(),
        }
    }

    pub fn has_trait(&self, name: &str) -> bool {
        self.traits.iter().any(|t| t == name)
    }
}

// ---------------------------------------------------------------------------
// TraitContext — which game action context we're computing a bonus for
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub(crate) enum TraitContext {
    Shooting,
    Dribbling,
    Passing,
    Tackling,
    Goalkeeping,
    Foul,
    Midfield,
}

/// Compute a multiplicative trait bonus for a specific action context.
/// Returns a modifier >= 1.0 (bonus) based on relevant traits.
pub(crate) fn trait_bonus(snap: &PlayerSnap, context: TraitContext) -> f64 {
    let mut bonus = 1.0;
    match context {
        TraitContext::Shooting => {
            if snap.has_trait("Sharpshooter") {
                bonus *= 1.08;
            }
            if snap.has_trait("CoolHead") {
                bonus *= 1.04;
            }
            if snap.has_trait("CompleteForward") {
                bonus *= 1.05;
            }
        }
        TraitContext::Dribbling => {
            if snap.has_trait("Dribbler") {
                bonus *= 1.08;
            }
            if snap.has_trait("Speedster") {
                bonus *= 1.04;
            }
            if snap.has_trait("Agile") {
                bonus *= 1.04;
            }
        }
        TraitContext::Passing => {
            if snap.has_trait("Playmaker") {
                bonus *= 1.08;
            }
            if snap.has_trait("Visionary") {
                bonus *= 1.05;
            }
            if snap.has_trait("SetPieceSpecialist") {
                bonus *= 1.03;
            }
        }
        TraitContext::Tackling => {
            if snap.has_trait("BallWinner") {
                bonus *= 1.08;
            }
            if snap.has_trait("Rock") {
                bonus *= 1.05;
            }
            if snap.has_trait("Tank") {
                bonus *= 1.04;
            }
        }
        TraitContext::Goalkeeping => {
            if snap.has_trait("SafeHands") {
                bonus *= 1.08;
            }
            if snap.has_trait("CatReflexes") {
                bonus *= 1.06;
            }
            if snap.has_trait("AerialDominance") {
                bonus *= 1.04;
            }
        }
        TraitContext::Foul => {
            if snap.has_trait("HotHead") {
                bonus *= 1.25;
            }
            if snap.has_trait("CoolHead") {
                bonus *= 0.70;
            }
        }
        TraitContext::Midfield => {
            if snap.has_trait("Engine") {
                bonus *= 1.06;
            }
            if snap.has_trait("TeamPlayer") {
                bonus *= 1.04;
            }
            if snap.has_trait("Tireless") {
                bonus *= 1.03;
            }
        }
    }
    bonus
}

// ---------------------------------------------------------------------------
// Play-style modifiers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub(crate) enum PlayStylePhase {
    Midfield,
    Attack,
    Defense,
    Press,
}

pub(crate) fn play_style_modifier(
    style: PlayStyle,
    phase: PlayStylePhase,
    is_own_phase: bool,
) -> f64 {
    if !is_own_phase {
        return 1.0;
    }
    match (style, phase) {
        (PlayStyle::Attacking, PlayStylePhase::Attack) => 1.12,
        (PlayStyle::Attacking, PlayStylePhase::Defense) => 0.93,
        (PlayStyle::Defensive, PlayStylePhase::Defense) => 1.12,
        (PlayStyle::Defensive, PlayStylePhase::Attack) => 0.93,
        (PlayStyle::Possession, PlayStylePhase::Midfield) => 1.15,
        (PlayStyle::Possession, PlayStylePhase::Attack) => 0.97,
        (PlayStyle::Counter, PlayStylePhase::Attack) => 1.18,
        (PlayStyle::Counter, PlayStylePhase::Midfield) => 0.92,
        (PlayStyle::HighPress, PlayStylePhase::Press) => 1.20,
        (PlayStyle::HighPress, PlayStylePhase::Defense) => 0.95,
        _ => 1.0,
    }
}

// ---------------------------------------------------------------------------
// Home advantage modifier
// ---------------------------------------------------------------------------

pub(crate) fn home_mod(side: Side, config: &MatchConfig) -> f64 {
    match side {
        Side::Home => config.home_advantage,
        Side::Away => 1.0,
    }
}
