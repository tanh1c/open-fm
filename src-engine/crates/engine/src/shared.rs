use rand::{Rng, RngExt};

use crate::types::{MatchConfig, PitchCondition, PlayStyle, PlayerData, Position, Side, TeamData, WeatherCondition};

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
        modifier *= 1.11;
    }
    if snap.has_trait("TeamPlayer") {
        modifier *= 1.07;
    }
    if snap.has_trait("CoolHead") {
        modifier *= 1.05;
    }
    if snap.has_trait("Visionary") {
        modifier *= 1.04;
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
    (1.0 + weighted_score * 0.016).clamp(0.91, 1.10)
}

pub(crate) fn tactical_familiarity_modifier(familiarity: f64) -> f64 {
    let delta = (familiarity.clamp(0.0, 1.0) - 0.5) * 2.0;
    (1.0 + delta * 0.095).clamp(0.905, 1.095)
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
    let roles = team.tactical_profile.roles;
    let press = instruction_delta(instructions.pressing_intensity);
    let line = instruction_delta(instructions.defensive_line);
    let tempo = instruction_delta(instructions.tempo);
    let counter_press = instruction_delta(instructions.counter_press).max(0.0);
    (1.0
        + press * 0.17
        + line * 0.060
        + tempo * 0.045
        + counter_press * 0.035
        + roles.ball_winning * 0.055
        + roles.pressing_forward * 0.060)
        .clamp(0.78, 1.34)
}

pub(crate) fn tactical_buildup_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let roles = team.tactical_profile.roles;
    let directness = instruction_delta(instructions.passing_directness);
    let tempo = instruction_delta(instructions.tempo);
    let risk = instruction_delta(instructions.risk_appetite);
    let central_control = instruction_delta(team.tactical_profile.width.central_density);
    (1.0
        + central_control * 0.050
        + roles.playmaking * 0.095
        + roles.defensive_duty * 0.025
        - directness * 0.095
        - tempo * 0.050
        - risk * 0.065)
        .clamp(0.78, 1.24)
}

pub(crate) fn tactical_midfield_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let roles = team.tactical_profile.roles;
    let tempo = instruction_delta(instructions.tempo);
    let directness = instruction_delta(instructions.passing_directness);
    let risk = instruction_delta(instructions.risk_appetite);
    let central_control = instruction_delta(team.tactical_profile.width.central_density);
    (1.0
        + central_control * 0.090
        + directness * 0.050
        + tempo * 0.065
        + roles.playmaking * 0.055
        + roles.ball_winning * 0.045
        - risk * 0.035)
        .clamp(0.78, 1.28)
}

pub(crate) fn tactical_space_creation_modifier(att_team: &TeamData, def_team: &TeamData) -> f64 {
    let att = att_team.tactical_profile.instructions;
    let roles = att_team.tactical_profile.roles;
    let def = def_team.tactical_profile.instructions;
    let tempo = instruction_delta(att.tempo);
    let directness = instruction_delta(att.passing_directness);
    let risk = instruction_delta(att.risk_appetite);
    let width = instruction_delta(att.width);
    let high_line_space = instruction_delta(def.defensive_line).max(0.0);
    let deep_block_space = (-instruction_delta(def.defensive_line)).max(0.0);
    let defensive_compactness = instruction_delta(def_team.tactical_profile.width.central_compactness);
    let counter_matchup = if matches!(att_team.play_style, PlayStyle::Counter) {
        high_line_space * (0.56 + directness.max(0.0) * 0.30) - deep_block_space * 0.240
    } else {
        0.0
    };
    let counter_attack = instruction_delta(att.counter_attack);
    let counter_attack_bonus =
        counter_attack * (0.060 + high_line_space * 0.080) - counter_attack.max(0.0) * deep_block_space * 0.060;
    let compact_block_penalty = if deep_block_space > 0.0 {
        defensive_compactness.max(0.0) * 0.115 + deep_block_space * 0.115
    } else {
        defensive_compactness.max(0.0) * 0.040
    };
    (1.0 + tempo * 0.075 + directness * 0.115 + risk * 0.110 + width * 0.045
        + high_line_space * 0.085
        + roles.playmaking * 0.040
        + roles.wide_support * 0.045
        + roles.inside_forward * 0.050
        + roles.attacking_duty * 0.035
        - roles.defensive_duty * 0.025
        + counter_matchup
        + counter_attack_bonus
        - compact_block_penalty)
        .clamp(0.72, 1.40)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ChanceType {
    CentralCombination,
    WideCross,
    CounterBreak,
    SetPiece,
    LongShot,
}

pub(crate) fn select_chance_type<R: Rng>(att_team: &TeamData, def_team: &TeamData, rng: &mut R) -> ChanceType {
    let att = att_team.tactical_profile.instructions;
    let def = def_team.tactical_profile.instructions;
    let roles = att_team.tactical_profile.roles;
    let width = instruction_delta(att.width);
    let directness = instruction_delta(att.passing_directness);
    let risk = instruction_delta(att.risk_appetite);
    let counter_attack = instruction_delta(att.counter_attack);
    let defensive_line = instruction_delta(def.defensive_line);
    let compactness = instruction_delta(def_team.tactical_profile.width.central_compactness);
    let central_density = instruction_delta(att_team.tactical_profile.width.central_density);

    let central = 1.0 + central_density.max(0.0) * 0.55 + roles.playmaking * 0.70 - directness.max(0.0) * 0.18;
    let wide = 0.85 + width.max(0.0) * 0.80 + roles.wide_support * 0.85 + roles.inside_forward * 0.25;
    let counter = 0.55
        + directness.max(0.0) * 0.55
        + counter_attack.max(0.0) * 0.75
        + defensive_line.max(0.0) * 0.95
        - compactness.max(0.0) * 0.20
        + if matches!(att_team.play_style, PlayStyle::Counter) { 0.45 } else { 0.0 };
    let set_piece = 0.34 + roles.wide_support * 0.12 + compactness.max(0.0) * 0.08;
    let long_shot = 0.36 + risk.max(0.0) * 0.45 + compactness.max(0.0) * 0.45 + roles.inside_forward * 0.22;

    let weights = [
        (ChanceType::CentralCombination, central.max(0.05)),
        (ChanceType::WideCross, wide.max(0.05)),
        (ChanceType::CounterBreak, counter.max(0.05)),
        (ChanceType::SetPiece, set_piece.max(0.05)),
        (ChanceType::LongShot, long_shot.max(0.05)),
    ];
    let total = weights.iter().map(|(_, weight)| *weight).sum::<f64>();
    let mut roll = rng.random_range(0.0..total);
    for (chance_type, weight) in weights {
        if roll <= weight {
            return chance_type;
        }
        roll -= weight;
    }
    ChanceType::CentralCombination
}

pub(crate) fn chance_shooter_weight_modifier(chance_type: ChanceType, player: &PlayerData) -> f64 {
    match chance_type {
        ChanceType::CentralCombination => match player.position {
            Position::Forward => 1.04,
            Position::Midfielder => 1.08,
            Position::Defender => 0.82,
            Position::Goalkeeper => 0.0,
        },
        ChanceType::WideCross | ChanceType::SetPiece => {
            let aerial_bonus = 1.0 + f64::from(player.aerial.saturating_sub(65)) * 0.006;
            match player.position {
                Position::Forward => 1.08 * aerial_bonus,
                Position::Midfielder => 0.92 * aerial_bonus,
                Position::Defender => 1.28 * aerial_bonus,
                Position::Goalkeeper => 0.0,
            }
        }
        ChanceType::CounterBreak => {
            let pace_bonus = 1.0 + f64::from(player.pace.saturating_sub(65)) * 0.006;
            match player.position {
                Position::Forward => 1.22 * pace_bonus,
                Position::Midfielder => 0.92 * pace_bonus,
                Position::Defender => 0.62 * pace_bonus,
                Position::Goalkeeper => 0.0,
            }
        }
        ChanceType::LongShot => match player.position {
            Position::Forward => 0.94,
            Position::Midfielder => 1.30,
            Position::Defender => 0.78,
            Position::Goalkeeper => 0.0,
        },
    }
    .clamp(0.45, 1.65)
}

pub(crate) fn chance_shot_rating(chance_type: ChanceType, shooter: &PlayerSnap, base_rating: f64) -> f64 {
    let channel_rating = match chance_type {
        ChanceType::CentralCombination => {
            shooter.shooting as f64 * 0.36
                + shooter.composure as f64 * 0.25
                + shooter.positioning as f64 * 0.20
                + shooter.decisions as f64 * 0.19
        }
        ChanceType::WideCross | ChanceType::SetPiece => {
            shooter.shooting as f64 * 0.26
                + shooter.aerial as f64 * 0.28
                + shooter.strength as f64 * 0.18
                + shooter.positioning as f64 * 0.28
        }
        ChanceType::CounterBreak => {
            shooter.shooting as f64 * 0.31
                + shooter.pace as f64 * 0.24
                + shooter.composure as f64 * 0.22
                + shooter.decisions as f64 * 0.23
        }
        ChanceType::LongShot => {
            shooter.shooting as f64 * 0.45
                + shooter.composure as f64 * 0.20
                + shooter.vision as f64 * 0.15
                + shooter.decisions as f64 * 0.20
        }
    };
    compress_skill(channel_rating) * 0.58 + base_rating * 0.42
}

pub(crate) fn tactical_shot_quality_modifier(att_team: &TeamData, def_team: &TeamData, chance_type: ChanceType) -> f64 {
    let att = att_team.tactical_profile.instructions;
    let roles = att_team.tactical_profile.roles;
    let def = def_team.tactical_profile.instructions;
    let risk = instruction_delta(att.risk_appetite);
    let directness = instruction_delta(att.passing_directness);
    let width = instruction_delta(att.width);
    let defensive_line = instruction_delta(def.defensive_line);
    let compactness = instruction_delta(def_team.tactical_profile.width.central_compactness);
    let counter_bonus = if matches!(att_team.play_style, PlayStyle::Counter) {
        defensive_line.max(0.0) * (0.190 + directness.max(0.0) * 0.110)
            - (-defensive_line).max(0.0) * 0.170
    } else {
        0.0
    };
    let counter_attack = instruction_delta(att.counter_attack);
    let counter_attack_bonus = counter_attack * (0.035 + defensive_line.max(0.0) * 0.075)
        - counter_attack.max(0.0) * (-defensive_line).max(0.0) * 0.040;
    let channel_bonus = match chance_type {
        ChanceType::CentralCombination => roles.playmaking * 0.055 - compactness.max(0.0) * 0.055,
        ChanceType::WideCross => width.max(0.0) * 0.075 + roles.wide_support * 0.070 - compactness.max(0.0) * 0.025,
        ChanceType::CounterBreak => defensive_line.max(0.0) * 0.105 + counter_attack.max(0.0) * 0.080 - (-defensive_line).max(0.0) * 0.095,
        ChanceType::SetPiece => roles.wide_support * 0.025 + roles.attacking_duty * 0.025,
        ChanceType::LongShot => risk.max(0.0) * 0.050 - compactness.max(0.0) * 0.025,
    };
    (1.0 + risk * 0.055 + directness * 0.045 + width * 0.025 + defensive_line * 0.040
        + roles.playmaking * 0.025
        + roles.inside_forward * 0.060
        + roles.attacking_duty * 0.040
        - roles.defensive_duty * 0.035
        + counter_bonus
        + counter_attack_bonus
        + channel_bonus
        - compactness.max(0.0) * 0.085)
        .clamp(0.76, 1.34)
}

pub(crate) fn tactical_fatigue_modifier(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let roles = team.tactical_profile.roles;
    let press = instruction_delta(instructions.pressing_intensity);
    let tempo = instruction_delta(instructions.tempo);
    let line = instruction_delta(instructions.defensive_line);
    let counter_press = instruction_delta(instructions.counter_press);
    (1.0
        + press * 0.145
        + tempo * 0.095
        + line.max(0.0) * 0.055
        + counter_press.max(0.0) * 0.065
        + roles.pressing_forward * 0.060
        + roles.attacking_duty * 0.035)
        .clamp(0.82, 1.34)
}

pub(crate) fn tactical_turnover_risk(team: &TeamData) -> f64 {
    let instructions = team.tactical_profile.instructions;
    let roles = team.tactical_profile.roles;
    let directness = instruction_delta(instructions.passing_directness);
    let tempo = instruction_delta(instructions.tempo);
    let risk = instruction_delta(instructions.risk_appetite);
    let counter_attack = instruction_delta(instructions.counter_attack);
    let cohesion_safety = (team_cohesion_modifier(team) - 1.0) * 0.55;
    (1.0 + directness * 0.110 + tempo * 0.070 + risk * 0.105 + counter_attack * 0.045
        - roles.playmaking * 0.045
        - cohesion_safety)
        .clamp(0.74, 1.34)
}

/// How much the DEFENDING team's counter-press raises the attacking team's
/// turnover risk. Returns a multiplier (>=1.0 when pressing hard to win it back).
pub(crate) fn tactical_counter_press_pressure(def_team: &TeamData) -> f64 {
    let counter_press = instruction_delta(def_team.tactical_profile.instructions.counter_press);
    (1.0 + counter_press.max(0.0) * 0.190 - (-counter_press).max(0.0) * 0.090).clamp(0.88, 1.24)
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn match_state_adapted_team(
    team: &TeamData,
    side: Side,
    minute: u8,
    home_score: u8,
    away_score: u8,
    sent_off_count: usize,
    average_condition: f64,
) -> TeamData {
    let mut adapted = team.clone();
    let instructions = &mut adapted.tactical_profile.instructions;
    let score_delta = match side {
        Side::Home => home_score as i16 - away_score as i16,
        Side::Away => away_score as i16 - home_score as i16,
    };
    let late_factor = ((minute.saturating_sub(55) as f64) / 35.0).clamp(0.0, 1.0);
    let fatigue_factor = ((68.0 - average_condition) / 28.0).clamp(0.0, 1.0);
    let red_card_factor = (sent_off_count as f64).clamp(0.0, 2.0);

    if score_delta > 0 {
        instructions.risk_appetite -= 0.12 * late_factor;
        instructions.tempo -= 0.08 * late_factor;
        instructions.defensive_line -= 0.10 * late_factor;
        instructions.pressing_intensity -= 0.07 * late_factor;
        instructions.counter_attack -= 0.08 * late_factor;
    } else if score_delta < 0 {
        let urgency = late_factor * (-score_delta as f64).clamp(1.0, 2.0);
        instructions.risk_appetite += 0.13 * urgency;
        instructions.tempo += 0.10 * urgency;
        instructions.pressing_intensity += 0.10 * urgency;
        instructions.passing_directness += 0.08 * urgency;
        instructions.defensive_line += 0.05 * urgency;
        instructions.counter_attack += 0.10 * urgency;
        instructions.counter_press += 0.08 * urgency;
    }

    if red_card_factor > 0.0 {
        instructions.pressing_intensity -= 0.10 * red_card_factor;
        instructions.risk_appetite -= 0.08 * red_card_factor;
        instructions.defensive_line -= 0.07 * red_card_factor;
        instructions.tempo -= 0.05 * red_card_factor;
        instructions.counter_press -= 0.09 * red_card_factor;
    }

    if fatigue_factor > 0.0 {
        instructions.pressing_intensity -= 0.09 * fatigue_factor;
        instructions.tempo -= 0.07 * fatigue_factor;
        instructions.counter_press -= 0.08 * fatigue_factor;
    }

    instructions.pressing_intensity = instructions.pressing_intensity.clamp(0.0, 1.0);
    instructions.defensive_line = instructions.defensive_line.clamp(0.0, 1.0);
    instructions.tempo = instructions.tempo.clamp(0.0, 1.0);
    instructions.width = instructions.width.clamp(0.0, 1.0);
    instructions.passing_directness = instructions.passing_directness.clamp(0.0, 1.0);
    instructions.risk_appetite = instructions.risk_appetite.clamp(0.0, 1.0);
    instructions.counter_attack = instructions.counter_attack.clamp(0.0, 1.0);
    instructions.counter_press = instructions.counter_press.clamp(0.0, 1.0);
    adapted
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ShapeProfile, TacticalProfile};

    fn team_with_balanced_instructions() -> TeamData {
        TeamData {
            id: "team".to_string(),
            name: "Team".to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            players: Vec::new(),
            shape_profile: ShapeProfile::default(),
            tactical_profile: TacticalProfile::default(),
            form: Vec::new(),
            tactical_familiarity: 0.5,
        }
    }

    #[test]
    fn match_state_adaptation_protects_late_leads_without_mutating_original() {
        let team = team_with_balanced_instructions();
        let adapted = match_state_adapted_team(&team, Side::Home, 82, 2, 1, 0, 82.0);

        assert!(adapted.tactical_profile.instructions.risk_appetite < team.tactical_profile.instructions.risk_appetite);
        assert!(adapted.tactical_profile.instructions.tempo < team.tactical_profile.instructions.tempo);
        assert!(adapted.tactical_profile.instructions.defensive_line < team.tactical_profile.instructions.defensive_line);
        assert_eq!(team.tactical_profile.instructions.risk_appetite, 0.5);
    }

    #[test]
    fn match_state_adaptation_adds_urgency_when_trailing_late() {
        let team = team_with_balanced_instructions();
        let adapted = match_state_adapted_team(&team, Side::Away, 80, 2, 1, 0, 82.0);

        assert!(adapted.tactical_profile.instructions.risk_appetite > team.tactical_profile.instructions.risk_appetite);
        assert!(adapted.tactical_profile.instructions.tempo > team.tactical_profile.instructions.tempo);
        assert!(adapted.tactical_profile.instructions.pressing_intensity > team.tactical_profile.instructions.pressing_intensity);
        assert!(adapted.tactical_profile.instructions.passing_directness > team.tactical_profile.instructions.passing_directness);
    }

    #[test]
    fn match_state_adaptation_reduces_intensity_for_red_cards_and_fatigue() {
        let team = team_with_balanced_instructions();
        let adapted = match_state_adapted_team(&team, Side::Home, 70, 1, 1, 1, 50.0);

        assert!(adapted.tactical_profile.instructions.pressing_intensity < team.tactical_profile.instructions.pressing_intensity);
        assert!(adapted.tactical_profile.instructions.risk_appetite < team.tactical_profile.instructions.risk_appetite);
        assert!(adapted.tactical_profile.instructions.tempo < team.tactical_profile.instructions.tempo);
    }
}
