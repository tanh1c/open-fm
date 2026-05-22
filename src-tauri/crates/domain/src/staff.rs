use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub football_nation: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    pub role: StaffRole,

    // Attributes 0-100
    pub attributes: StaffAttributes,
    pub team_id: Option<String>,

    // Coaching specialization — boosts one training focus area
    #[serde(default)]
    pub specialization: Option<CoachingSpecialization>,

    // Contract & finances
    #[serde(default)]
    pub wage: u32,
    #[serde(default)]
    pub contract_end: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StaffRole {
    AssistantManager,
    Coach,
    Scout,
    Physio,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CoachingSpecialization {
    Fitness,     // Boosts Physical training
    Technique,   // Boosts Technical training
    Tactics,     // Boosts Tactical training
    Defending,   // Boosts Defending training
    Attacking,   // Boosts Attacking training
    GoalKeeping, // Boosts GK-specific development
    Youth,       // Boosts young player development
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffAttributes {
    pub coaching: u8,
    pub judging_ability: u8,
    pub judging_potential: u8,
    pub physiotherapy: u8,
}

impl Staff {
    pub fn new(
        id: String,
        first_name: String,
        last_name: String,
        date_of_birth: String,
        role: StaffRole,
        attributes: StaffAttributes,
    ) -> Self {
        Self {
            id,
            first_name,
            last_name,
            date_of_birth,
            nationality: String::new(),
            football_nation: String::new(),
            birth_country: None,
            role,
            attributes,
            team_id: None,
            specialization: None,
            wage: 0,
            contract_end: None,
        }
    }
}
