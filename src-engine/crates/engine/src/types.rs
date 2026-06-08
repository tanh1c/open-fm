use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Position — mirrors domain::player::Position but kept independent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Position {
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
}

// ---------------------------------------------------------------------------
// PlayStyle — mirrors domain::team::PlayStyle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayStyle {
    Balanced,
    Attacking,
    Defensive,
    Possession,
    Counter,
    HighPress,
}

// ---------------------------------------------------------------------------
// PlayerData — a snapshot of a player for engine consumption
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerData {
    pub id: String,
    pub name: String,
    pub position: Position,
    #[serde(default)]
    pub ovr: u8,
    pub condition: u8, // 0-100
    #[serde(default = "default_morale")]
    pub morale: u8,
    /// Long-term physical shape (0-100). Multiplies stamina depletion rate in-match.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    // Physical
    pub pace: u8,
    pub stamina: u8,
    pub strength: u8,
    #[serde(default = "default_engine_attr")]
    pub agility: u8,

    // Technical
    pub passing: u8,
    pub shooting: u8,
    pub tackling: u8,
    pub dribbling: u8,
    pub defending: u8,

    // Mental
    pub positioning: u8,
    pub vision: u8,
    pub decisions: u8,
    #[serde(default = "default_engine_attr")]
    pub composure: u8,
    #[serde(default = "default_engine_attr")]
    pub aggression: u8,
    #[serde(default = "default_engine_attr")]
    pub teamwork: u8,
    #[serde(default = "default_engine_attr")]
    pub leadership: u8,

    // Goalkeeper
    #[serde(default = "default_engine_attr")]
    pub handling: u8,
    #[serde(default = "default_engine_attr")]
    pub reflexes: u8,
    #[serde(default = "default_engine_attr")]
    pub aerial: u8,

    // Traits (string names matching domain::player::PlayerTrait variants)
    #[serde(default)]
    pub traits: Vec<String>,
}

fn default_engine_attr() -> u8 {
    50
}

fn default_morale() -> u8 {
    50
}

fn default_fitness() -> u8 {
    75
}

fn default_tactical_familiarity() -> f64 {
    0.5
}

impl PlayerData {
    /// Overall rating (simple mean of core 11 attributes).
    pub fn overall(&self) -> f64 {
        (self.pace as f64
            + self.stamina as f64
            + self.strength as f64
            + self.passing as f64
            + self.shooting as f64
            + self.tackling as f64
            + self.dribbling as f64
            + self.defending as f64
            + self.positioning as f64
            + self.vision as f64
            + self.decisions as f64)
            / 11.0
    }

    /// Effective rating accounting for current condition (0-100).
    pub fn effective_overall(&self) -> f64 {
        self.overall() * (self.condition as f64 / 100.0)
    }
}

// ---------------------------------------------------------------------------
// TeamData — everything the engine needs to know about one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ShapeProfile {
    pub defenders: u8,
    pub midfielders: u8,
    pub forwards: u8,
}

impl Default for ShapeProfile {
    fn default() -> Self {
        Self {
            defenders: 4,
            midfielders: 4,
            forwards: 2,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LateralProfile {
    pub left_overload: f64,
    pub right_overload: f64,
    pub left_weakness: f64,
    pub right_weakness: f64,
}

impl Default for LateralProfile {
    fn default() -> Self {
        Self {
            left_overload: 0.0,
            right_overload: 0.0,
            left_weakness: 0.0,
            right_weakness: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct WidthProfile {
    pub width: f64,
    pub central_density: f64,
    pub wing_threat: f64,
    pub central_compactness: f64,
}

impl Default for WidthProfile {
    fn default() -> Self {
        Self {
            width: 0.5,
            central_density: 0.5,
            wing_threat: 0.5,
            central_compactness: 0.5,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TacticalInstructionProfile {
    pub pressing_intensity: f64,
    pub defensive_line: f64,
    pub tempo: f64,
    pub width: f64,
    pub passing_directness: f64,
    pub risk_appetite: f64,
    #[serde(default = "half_instruction")]
    pub counter_attack: f64,
    #[serde(default = "half_instruction")]
    pub counter_press: f64,
}

fn half_instruction() -> f64 {
    0.5
}

impl Default for TacticalInstructionProfile {
    fn default() -> Self {
        Self {
            pressing_intensity: 0.5,
            defensive_line: 0.5,
            tempo: 0.5,
            width: 0.5,
            passing_directness: 0.5,
            risk_appetite: 0.5,
            counter_attack: 0.5,
            counter_press: 0.5,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct TacticalProfile {
    pub lateral: LateralProfile,
    pub width: WidthProfile,
    #[serde(default)]
    pub instructions: TacticalInstructionProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamData {
    pub id: String,
    pub name: String,
    pub formation: String,
    pub play_style: PlayStyle,
    pub players: Vec<PlayerData>,
    #[serde(default)]
    pub form: Vec<String>,
    #[serde(default = "default_tactical_familiarity")]
    pub tactical_familiarity: f64,
    #[serde(default)]
    pub shape_profile: ShapeProfile,
    #[serde(default)]
    pub tactical_profile: TacticalProfile,
}

impl TeamData {
    fn shape_multiplier(&self, phase: Position) -> f64 {
        let profile = self.shape_profile;
        let tactical = self.tactical_profile;
        let extreme_penalty = if profile.defenders < 2 || profile.midfielders < 2 || profile.forwards > 4 {
            0.94
        } else {
            1.0
        };

        let multiplier = match phase {
            Position::Goalkeeper => 1.0,
            Position::Defender => {
                1.0 + (profile.defenders as f64 - 4.0) * 0.045
                    + tactical.width.central_compactness * 0.035
                    - tactical.width.width * 0.025
                    - (tactical.lateral.left_weakness + tactical.lateral.right_weakness) * 0.025
            }
            Position::Midfielder => {
                1.0 + (profile.midfielders as f64 - 4.0) * 0.035
                    + tactical.width.central_density * 0.04
                    - tactical.width.width * 0.015
            }
            Position::Forward => {
                1.0 + (profile.forwards as f64 - 2.0) * 0.05
                    + tactical.width.wing_threat * 0.035
                    + (tactical.lateral.left_overload + tactical.lateral.right_overload) * 0.02
                    - tactical.width.central_density * 0.015
            }
        };

        (multiplier * extreme_penalty).clamp(0.82, 1.18)
    }

    /// Count players by position.
    pub fn count_position(&self, pos: Position) -> usize {
        self.players.iter().filter(|p| p.position == pos).count()
    }

    /// Average of a specific attribute among players in the given position.
    pub fn position_attr_avg(&self, pos: Position, attr_fn: fn(&PlayerData) -> u8) -> f64 {
        let players: Vec<_> = self.players.iter().filter(|p| p.position == pos).collect();
        if players.is_empty() {
            return 40.0; // fallback
        }
        players.iter().map(|p| attr_fn(p) as f64).sum::<f64>() / players.len() as f64
    }

    /// Composite defense rating (from defenders + goalkeeper).
    pub fn defense_rating(&self) -> f64 {
        let def_avg = self.position_attr_avg(Position::Defender, |p| {
            ((p.defending as u16 + p.tackling as u16 + p.positioning as u16 + p.strength as u16)
                / 4) as u8
        });
        let gk_avg = self.position_attr_avg(Position::Goalkeeper, |p| {
            ((p.positioning as u16 + p.decisions as u16 + p.strength as u16 + p.pace as u16) / 4)
                as u8
        });
        (def_avg * 0.7 + gk_avg * 0.3) * self.shape_multiplier(Position::Defender)
    }

    /// Composite midfield rating.
    pub fn midfield_rating(&self) -> f64 {
        self.position_attr_avg(Position::Midfielder, |p| {
            ((p.passing as u16 + p.vision as u16 + p.decisions as u16 + p.stamina as u16) / 4) as u8
        }) * self.shape_multiplier(Position::Midfielder)
    }

    /// Composite attack rating (from forwards + midfielders).
    pub fn attack_rating(&self) -> f64 {
        let fwd_avg = self.position_attr_avg(Position::Forward, |p| {
            ((p.shooting as u16 + p.dribbling as u16 + p.pace as u16 + p.positioning as u16) / 4)
                as u8
        });
        let mid_contrib = self.position_attr_avg(Position::Midfielder, |p| {
            ((p.shooting as u16 + p.passing as u16 + p.vision as u16) / 3) as u8
        });
        (fwd_avg * 0.75 + mid_contrib * 0.25) * self.shape_multiplier(Position::Forward)
    }

    /// Goalkeeper save rating.
    pub fn goalkeeper_rating(&self) -> f64 {
        self.position_attr_avg(Position::Goalkeeper, |p| {
            ((p.positioning as u16 + p.decisions as u16 + p.pace as u16 + p.strength as u16) / 4)
                as u8
        })
    }
}

// ---------------------------------------------------------------------------
// MatchConfig — tuneable simulation parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RefereeProfile {
    #[serde(default = "default_context_modifier")]
    pub foul_modifier: f64,
    #[serde(default = "default_context_modifier")]
    pub card_modifier: f64,
    #[serde(default = "default_context_modifier")]
    pub penalty_modifier: f64,
}

impl Default for RefereeProfile {
    fn default() -> Self {
        Self {
            foul_modifier: 1.0,
            card_modifier: 1.0,
            penalty_modifier: 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum WeatherCondition {
    #[default]
    Clear,
    Rain,
    Wind,
    Heat,
    Cold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PitchCondition {
    Excellent,
    #[default]
    Normal,
    Wet,
    Worn,
    Poor,
}

fn default_context_modifier() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchConfig {
    /// Multiplier applied to the home team's ratings (e.g. 1.08 = 8% boost).
    pub home_advantage: f64,
    /// Base probability that a shot from the box is on target (0.0–1.0).
    pub shot_accuracy_base: f64,
    /// Base probability that an on-target shot beats the keeper (0.0–1.0).
    pub goal_conversion_base: f64,
    /// Per-minute fatigue factor applied to condition.
    pub fatigue_per_minute: f64,
    /// Probability of a foul on any defensive action (0.0–1.0).
    pub foul_probability: f64,
    /// Probability a foul results in a yellow card.
    pub yellow_card_probability: f64,
    /// Probability a yellow-card foul is upgraded to red (second yellow or serious foul).
    pub red_card_probability: f64,
    /// Probability a foul in the box results in a penalty.
    pub penalty_probability: f64,
    /// Minutes of stoppage time per half (0 = none).
    pub stoppage_time_max: u8,
    /// Probability of an injury per foul event.
    pub injury_probability: f64,
    #[serde(default)]
    pub referee: RefereeProfile,
    #[serde(default)]
    pub weather: WeatherCondition,
    #[serde(default)]
    pub pitch: PitchCondition,
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            home_advantage: 1.08,
            shot_accuracy_base: 0.45,
            goal_conversion_base: 0.18,
            fatigue_per_minute: 0.20,
            foul_probability: 0.12,
            yellow_card_probability: 0.24,
            red_card_probability: 0.04,
            penalty_probability: 0.08,
            stoppage_time_max: 4,
            injury_probability: 0.03,
            referee: RefereeProfile::default(),
            weather: WeatherCondition::default(),
            pitch: PitchCondition::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// Side — which side of the match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    Home,
    Away,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::Home => Side::Away,
            Side::Away => Side::Home,
        }
    }
}

// ---------------------------------------------------------------------------
// Zone — regions of the pitch from the perspective of the match (not a team)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Zone {
    HomeBox,
    HomeDefense,
    Midfield,
    AwayDefense,
    AwayBox,
}

impl Zone {
    /// The attacking zone for a given side (where they score).
    pub fn attacking_box(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayBox,
            Side::Away => Zone::HomeBox,
        }
    }

    /// The attacking third for a given side.
    pub fn attacking_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayDefense,
            Side::Away => Zone::HomeDefense,
        }
    }

    /// The defensive third for a given side.
    pub fn defensive_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::HomeDefense,
            Side::Away => Zone::AwayDefense,
        }
    }

    /// Advance the ball one zone towards the given side's goal.
    pub fn advance_towards(self, attacking_side: Side) -> Zone {
        match attacking_side {
            Side::Home => match self {
                Zone::HomeBox => Zone::HomeDefense,
                Zone::HomeDefense => Zone::Midfield,
                Zone::Midfield => Zone::AwayDefense,
                Zone::AwayDefense => Zone::AwayBox,
                Zone::AwayBox => Zone::AwayBox,
            },
            Side::Away => match self {
                Zone::AwayBox => Zone::AwayDefense,
                Zone::AwayDefense => Zone::Midfield,
                Zone::Midfield => Zone::HomeDefense,
                Zone::HomeDefense => Zone::HomeBox,
                Zone::HomeBox => Zone::HomeBox,
            },
        }
    }

    /// Is this zone the attacking box for the given side?
    pub fn is_box_for(self, attacking_side: Side) -> bool {
        self == Zone::attacking_box(attacking_side)
    }
}
