use crate::types::{MatchConfig, PitchCondition, PlayStyle, PlayerData, Side, TeamData, WeatherCondition};

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
    pub morale: u8,
    pub condition: u8,
    pub fitness: u8,
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
            morale: p.morale,
            condition: p.condition,
            fitness: p.fitness,
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
#[allow(dead_code)]
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
    match context {
        TraitContext::Shooting => trait_shot_quality_modifier(snap),
        TraitContext::Dribbling => trait_carry_modifier(snap),
        TraitContext::Passing => trait_pass_safety_modifier(snap),
        TraitContext::Tackling => trait_tackle_modifier(snap),
        TraitContext::Goalkeeping => trait_goalkeeping_modifier(snap),
        TraitContext::Foul => trait_foul_risk_modifier(snap),
        TraitContext::Midfield => trait_midfield_modifier(snap),
    }
}

pub(crate) fn trait_shot_tendency_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Sharpshooter") {
        modifier *= 1.12;
    }
    if snap.has_trait("CompleteForward") {
        modifier *= 1.08;
    }
    if snap.has_trait("Dribbler") {
        modifier *= 1.03;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 1.02;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_shot_quality_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Sharpshooter") {
        modifier *= 1.08;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 1.05;
    }
    if snap.has_trait("CompleteForward") {
        modifier *= 1.05;
    }
    if snap.has_trait("Visionary") {
        modifier *= 1.02;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_pass_safety_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Playmaker") {
        modifier *= 1.07;
    }
    if snap.has_trait("TeamPlayer") {
        modifier *= 1.05;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 1.04;
    }
    if snap.has_trait("Visionary") {
        modifier *= 1.02;
    }
    if snap.has_trait("HotHead") {
        modifier *= 0.94;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_pass_creativity_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Visionary") {
        modifier *= 1.10;
    }
    if snap.has_trait("Playmaker") {
        modifier *= 1.08;
    }
    if snap.has_trait("SetPieceSpecialist") {
        modifier *= 1.04;
    }
    if snap.has_trait("CompleteForward") {
        modifier *= 1.03;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_carry_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Dribbler") {
        modifier *= 1.08;
    }
    if snap.has_trait("Speedster") {
        modifier *= 1.05;
    }
    if snap.has_trait("Agile") {
        modifier *= 1.05;
    }
    if snap.has_trait("CompleteForward") {
        modifier *= 1.03;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_tackle_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("BallWinner") {
        modifier *= 1.08;
    }
    if snap.has_trait("Rock") {
        modifier *= 1.06;
    }
    if snap.has_trait("Tank") {
        modifier *= 1.04;
    }
    if snap.has_trait("HotHead") {
        modifier *= 0.96;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn trait_foul_risk_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("HotHead") {
        modifier *= 1.30;
    }
    if snap.has_trait("BallWinner") {
        modifier *= 1.06;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 0.72;
    }
    if snap.has_trait("TeamPlayer") {
        modifier *= 0.95;
    }
    modifier.clamp(0.65, 1.45)
}

pub(crate) fn trait_press_work_rate_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("Engine") {
        modifier *= 1.08;
    }
    if snap.has_trait("Tireless") {
        modifier *= 1.06;
    }
    if snap.has_trait("TeamPlayer") {
        modifier *= 1.04;
    }
    if snap.has_trait("Leader") {
        modifier *= 1.03;
    }
    modifier.clamp(0.85, 1.18)
}

pub(crate) fn compress_skill(skill: f64) -> f64 {
    50.0 + (skill - 50.0) * 0.82
}

pub(crate) fn morale_performance_modifier(morale: u8) -> f64 {
    let delta = (morale.clamp(0, 100) as f64 - 50.0) / 50.0;
    (1.0 + delta * 0.085).clamp(0.915, 1.085)
}

pub(crate) fn morale_risk_modifier(morale: u8) -> f64 {
    let delta = (morale.clamp(0, 100) as f64 - 50.0) / 50.0;
    (1.0 - delta * 0.08).clamp(0.92, 1.08)
}

pub(crate) fn fitness_injury_risk_modifier(condition: u8, fitness: u8) -> f64 {
    let condition_delta = (50.0 - condition.clamp(0, 100) as f64) / 50.0;
    let fitness_delta = (50.0 - fitness.clamp(0, 100) as f64) / 50.0;
    (1.0 + condition_delta.max(0.0) * 0.14 + fitness_delta * 0.10).clamp(0.85, 1.25)
}

pub(crate) fn referee_foul_modifier(config: &MatchConfig) -> f64 {
    config.referee.foul_modifier.clamp(0.80, 1.35)
}

pub(crate) fn referee_card_modifier(config: &MatchConfig) -> f64 {
    config.referee.card_modifier.clamp(0.75, 1.45)
}

pub(crate) fn referee_penalty_modifier(config: &MatchConfig) -> f64 {
    config.referee.penalty_modifier.clamp(0.75, 1.35)
}

pub(crate) fn weather_pass_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Clear => 1.0,
        WeatherCondition::Rain => 0.96,
        WeatherCondition::Wind => 0.95,
        WeatherCondition::Heat => 0.98,
        WeatherCondition::Cold => 0.97,
    }
}

pub(crate) fn weather_shot_accuracy_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Clear => 1.0,
        WeatherCondition::Rain => 0.96,
        WeatherCondition::Wind => 0.93,
        WeatherCondition::Heat => 0.98,
        WeatherCondition::Cold => 0.97,
    }
}

pub(crate) fn weather_conversion_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Clear => 1.0,
        WeatherCondition::Rain => 0.98,
        WeatherCondition::Wind => 0.97,
        WeatherCondition::Heat => 0.99,
        WeatherCondition::Cold => 0.98,
    }
}

pub(crate) fn weather_fatigue_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Heat => 1.12,
        WeatherCondition::Cold => 1.04,
        WeatherCondition::Rain => 1.03,
        _ => 1.0,
    }
}

pub(crate) fn weather_foul_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Rain => 1.05,
        WeatherCondition::Cold => 1.03,
        _ => 1.0,
    }
}

pub(crate) fn weather_injury_modifier(config: &MatchConfig) -> f64 {
    match config.weather {
        WeatherCondition::Rain => 1.06,
        WeatherCondition::Cold => 1.04,
        WeatherCondition::Heat => 1.03,
        _ => 1.0,
    }
}

pub(crate) fn pitch_pass_modifier(config: &MatchConfig) -> f64 {
    match config.pitch {
        PitchCondition::Excellent => 1.02,
        PitchCondition::Normal => 1.0,
        PitchCondition::Wet => 0.96,
        PitchCondition::Worn => 0.97,
        PitchCondition::Poor => 0.94,
    }
}

pub(crate) fn pitch_carry_modifier(config: &MatchConfig) -> f64 {
    match config.pitch {
        PitchCondition::Excellent => 1.02,
        PitchCondition::Normal => 1.0,
        PitchCondition::Wet => 0.95,
        PitchCondition::Worn => 0.96,
        PitchCondition::Poor => 0.93,
    }
}

pub(crate) fn pitch_foul_modifier(config: &MatchConfig) -> f64 {
    match config.pitch {
        PitchCondition::Wet => 1.07,
        PitchCondition::Worn => 1.04,
        PitchCondition::Poor => 1.09,
        _ => 1.0,
    }
}

pub(crate) fn pitch_injury_modifier(config: &MatchConfig) -> f64 {
    match config.pitch {
        PitchCondition::Excellent => 0.95,
        PitchCondition::Normal => 1.0,
        PitchCondition::Wet => 1.08,
        PitchCondition::Worn => 1.06,
        PitchCondition::Poor => 1.12,
    }
}

pub(crate) fn team_form_modifier(form: &[String]) -> f64 {
    if form.is_empty() {
        return 1.0;
    }
    let weighted_score = form
        .iter()
        .rev()
        .take(5)
        .enumerate()
        .map(|(index, result)| {
            let weight = 1.0 + (4usize.saturating_sub(index) as f64) * 0.05;
            match result.as_str() {
                "W" => weight,
                "L" => -weight,
                _ => 0.0,
            }
        })
        .sum::<f64>();
    (1.0 + weighted_score * 0.013).clamp(0.93, 1.08)
}

pub(crate) fn tactical_familiarity_modifier(familiarity: f64) -> f64 {
    let delta = (familiarity.clamp(0.0, 1.0) - 0.5) * 2.0;
    (1.0 + delta * 0.085).clamp(0.915, 1.085)
}

pub(crate) fn team_cohesion_modifier(team: &TeamData) -> f64 {
    (team_form_modifier(&team.form) * tactical_familiarity_modifier(team.tactical_familiarity))
        .clamp(0.86, 1.18)
}

fn trait_midfield_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier = trait_pass_creativity_modifier(snap);
    if snap.has_trait("Engine") {
        modifier *= 1.06;
    }
    if snap.has_trait("TeamPlayer") {
        modifier *= 1.04;
    }
    if snap.has_trait("Tireless") {
        modifier *= 1.03;
    }
    if snap.has_trait("Leader") {
        modifier *= 1.03;
    }
    modifier.clamp(0.85, 1.18)
}

fn trait_goalkeeping_modifier(snap: &PlayerSnap) -> f64 {
    let mut modifier: f64 = 1.0;
    if snap.has_trait("SafeHands") {
        modifier *= 1.08;
    }
    if snap.has_trait("CatReflexes") {
        modifier *= 1.06;
    }
    if snap.has_trait("AerialDominance") {
        modifier *= 1.04;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 1.02;
    }
    modifier.clamp(0.85, 1.18)
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

fn instruction_delta(value: f64) -> f64 {
    (value.clamp(0.0, 1.0) - 0.5) * 2.0
}

pub(crate) fn tactical_press_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let press = instruction_delta(instructions.pressing_intensity);
    let line = instruction_delta(instructions.defensive_line);
    let tempo = instruction_delta(instructions.tempo);
    (1.0 + press * 0.14 + line * 0.050 + tempo * 0.035).clamp(0.82, 1.24)
}

pub(crate) fn tactical_buildup_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let directness = instruction_delta(instructions.passing_directness);
    let tempo = instruction_delta(instructions.tempo);
    let risk = instruction_delta(instructions.risk_appetite);
    let central_control = instruction_delta(team.tactical_profile.width.central_density);
    (1.0 + central_control * 0.035 - directness * 0.075 - tempo * 0.035 - risk * 0.045)
        .clamp(0.82, 1.18)
}

pub(crate) fn tactical_midfield_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let tempo = instruction_delta(instructions.tempo);
    let directness = instruction_delta(instructions.passing_directness);
    let risk = instruction_delta(instructions.risk_appetite);
    let central_control = instruction_delta(team.tactical_profile.width.central_density);
    (1.0 + central_control * 0.070 + directness * 0.040 - risk * 0.020 + tempo * 0.055)
        .clamp(0.82, 1.20)
}

pub(crate) fn tactical_space_creation_modifier(att_team: &TeamData, def_team: &TeamData) -> f64 {
    let att = att_team.tactical_profile.instructions;
    let def = def_team.tactical_profile.instructions;
    let tempo = instruction_delta(att.tempo);
    let directness = instruction_delta(att.passing_directness);
    let risk = instruction_delta(att.risk_appetite);
    let width = instruction_delta(att.width);
    let high_line_space = instruction_delta(def.defensive_line).max(0.0);
    let deep_block_space = (-instruction_delta(def.defensive_line)).max(0.0);
    let defensive_compactness = instruction_delta(def_team.tactical_profile.width.central_compactness);
    let counter_matchup = if matches!(att_team.play_style, PlayStyle::Counter) {
        high_line_space * (0.075 + directness.max(0.0) * 0.045)
    } else {
        0.0
    };
    let compact_block_penalty = if deep_block_space > 0.0 {
        defensive_compactness.max(0.0) * 0.065 + deep_block_space * 0.040
    } else {
        defensive_compactness.max(0.0) * 0.030
    };
    (1.0 + tempo * 0.060 + directness * 0.095 + risk * 0.090 + width * 0.035
        + high_line_space * 0.055
        + counter_matchup
        - compact_block_penalty)
        .clamp(0.78, 1.28)
}

pub(crate) fn tactical_shot_quality_modifier(att_team: &TeamData, def_team: &TeamData) -> f64 {
    let att = att_team.tactical_profile.instructions;
    let def = def_team.tactical_profile.instructions;
    let risk = instruction_delta(att.risk_appetite);
    let directness = instruction_delta(att.passing_directness);
    let width = instruction_delta(att.width);
    let defensive_line = instruction_delta(def.defensive_line);
    let compactness = instruction_delta(def_team.tactical_profile.width.central_compactness);
    let counter_bonus = if matches!(att_team.play_style, PlayStyle::Counter) {
        defensive_line.max(0.0) * 0.045
    } else {
        0.0
    };
    (1.0 + risk * 0.045 + directness * 0.035 + width * 0.020 + defensive_line * 0.025
        + counter_bonus
        - compactness.max(0.0) * 0.055)
        .clamp(0.84, 1.18)
}

pub(crate) fn tactical_fatigue_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let press = instruction_delta(instructions.pressing_intensity);
    let tempo = instruction_delta(instructions.tempo);
    let line = instruction_delta(instructions.defensive_line);
    (1.0 + press * 0.11 + tempo * 0.075 + line.max(0.0) * 0.040).clamp(0.86, 1.22)
}

pub(crate) fn tactical_turnover_risk(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let directness = instruction_delta(instructions.passing_directness);
    let tempo = instruction_delta(instructions.tempo);
    let risk = instruction_delta(instructions.risk_appetite);
    (1.0 + directness * 0.085 + tempo * 0.055 + risk * 0.080).clamp(0.82, 1.24)
}
