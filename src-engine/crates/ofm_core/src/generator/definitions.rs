use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::data::{NATIONALITY_POOLS, TEAM_TEMPLATES};

// ---------------------------------------------------------------------------
// Definition file types (JSON-serialisable)
// ---------------------------------------------------------------------------

/// Name pools definition file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamesDefinition {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub description: String,
    /// Keyed by ISO 3166-1 alpha-2 country code.
    pub pools: HashMap<String, NamePool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamePool {
    pub first_names: Vec<String>,
    pub last_names: Vec<String>,
}

/// Team templates definition file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamsDefinition {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub description: String,
    pub teams: Vec<TeamDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamDef {
    pub name: String,
    #[serde(default)]
    pub short_name: String,
    pub city: String,
    /// ISO 3166-1 alpha-2 country code.
    pub country: String,
    #[serde(default)]
    pub domestic_tier: Option<u8>,
    pub colors: TeamColorsDef,
    #[serde(default = "default_play_style")]
    pub play_style: String,
    #[serde(default)]
    pub stadium_name: String,
    #[serde(default)]
    pub reputation_range: Option<[u32; 2]>,
    #[serde(default)]
    pub finance_range: Option<[i64; 2]>,
    #[serde(default)]
    pub current_strength: Option<u8>,
    #[serde(default)]
    pub youth_development: Option<u8>,
    #[serde(default)]
    pub recruitment_power: Option<u8>,
    #[serde(default)]
    pub tactical_level: Option<u8>,
    #[serde(default)]
    pub volatility: Option<u8>,
    #[serde(default)]
    pub expected_squad_avg_ovr: Option<u8>,
    #[serde(default)]
    pub expected_top_player_ovr: Option<u8>,
    #[serde(default)]
    pub squad_depth: Option<u8>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClubBalancingDef {
    country: String,
    club_name: String,
    reputation: u32,
    current_strength: u8,
    financial_power: u8,
    youth_development: u8,
    recruitment_power: u8,
    tactical_level: u8,
    volatility: u8,
    expected_squad_avg_ovr: u8,
    expected_top_player_ovr: u8,
    squad_depth: u8,
    play_style_hint: String,
}

fn default_play_style() -> String {
    "Balanced".to_string()
}

fn play_style_from_hint(hint: &str, fallback: &str) -> String {
    match hint.to_ascii_lowercase().as_str() {
        "attacking" => "Attacking".to_string(),
        "defensive" => "Defensive".to_string(),
        "possession" => "Possession".to_string(),
        "counter" => "Counter".to_string(),
        "pressing" => "HighPress".to_string(),
        "direct" | "balanced" => fallback.to_string(),
        _ => fallback.to_string(),
    }
}

fn finance_range_from_power(financial_power: u8) -> [i64; 2] {
    let min = 8_000_000 + financial_power as i64 * 1_250_000;
    let max = 20_000_000 + financial_power as i64 * 4_500_000;
    [min, max.max(min + 10_000_000)]
}

fn reputation_range_from_value(reputation: u32) -> [u32; 2] {
    let spread = if reputation >= 850 { 25 } else { 40 };
    [reputation.saturating_sub(spread).max(1), (reputation + spread).min(1000)]
}

fn club_balancing_by_key() -> HashMap<(String, String), ClubBalancingDef> {
    serde_json::from_str::<Vec<ClubBalancingDef>>(include_str!(
        "club_generation_balancing_248.json"
    ))
    .unwrap_or_default()
    .into_iter()
    .map(|entry| ((entry.country.clone(), entry.club_name.clone()), entry))
    .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamColorsDef {
    pub primary: String,
    pub secondary: String,
}

/// Parse a names definition from a JSON string.
pub fn parse_names_definition(json: &str) -> Option<NamesDefinition> {
    serde_json::from_str(json).ok()
}

/// Parse a teams definition from a JSON string.
pub fn parse_teams_definition(json: &str) -> Option<TeamsDefinition> {
    serde_json::from_str(json).ok()
}

/// Build the hardcoded names definition as fallback.
pub(super) fn default_names_definition() -> NamesDefinition {
    let mut pools = HashMap::new();
    for entry in NATIONALITY_POOLS {
        pools.insert(
            entry.nationality.to_string(),
            NamePool {
                first_names: entry.first_names.iter().map(|s| s.to_string()).collect(),
                last_names: entry.last_names.iter().map(|s| s.to_string()).collect(),
            },
        );
    }
    NamesDefinition {
        version: 1,
        description: "Built-in default".to_string(),
        pools,
    }
}

/// Build the hardcoded teams definition as fallback.
pub(super) fn default_teams_definition() -> TeamsDefinition {
    let balancing = club_balancing_by_key();

    TeamsDefinition {
        version: 1,
        description: "Built-in default".to_string(),
        teams: TEAM_TEMPLATES
            .iter()
            .map(|t| {
                let balanced = balancing.get(&(t.country.to_string(), t.name.to_string()));
                TeamDef {
                    name: t.name.to_string(),
                    short_name: t
                        .name
                        .split_whitespace()
                        .filter_map(|w| w.chars().next())
                        .collect::<String>()
                        .to_uppercase()
                        .chars()
                        .take(3)
                        .collect(),
                    city: t.city.to_string(),
                    country: t.country.to_string(),
                    domestic_tier: Some(t.domestic_tier),
                    colors: TeamColorsDef {
                        primary: t.colors.0.to_string(),
                        secondary: t.colors.1.to_string(),
                    },
                    play_style: balanced
                        .map(|entry| play_style_from_hint(&entry.play_style_hint, t.play_style))
                        .unwrap_or_else(|| t.play_style.to_string()),
                    stadium_name: format!("{} Arena", t.city),
                    reputation_range: balanced
                        .map(|entry| reputation_range_from_value(entry.reputation))
                        .or(Some([300, 900])),
                    finance_range: balanced
                        .map(|entry| finance_range_from_power(entry.financial_power))
                        .or(Some([25_000_000, 350_000_000])),
                    current_strength: balanced.map(|entry| entry.current_strength),
                    youth_development: balanced.map(|entry| entry.youth_development),
                    recruitment_power: balanced.map(|entry| entry.recruitment_power),
                    tactical_level: balanced.map(|entry| entry.tactical_level),
                    volatility: balanced.map(|entry| entry.volatility),
                    expected_squad_avg_ovr: balanced.map(|entry| entry.expected_squad_avg_ovr),
                    expected_top_player_ovr: balanced.map(|entry| entry.expected_top_player_ovr),
                    squad_depth: balanced.map(|entry| entry.squad_depth),
                }
            })
            .collect(),
    }
}

/// Serialisable world database — can be saved to / loaded from JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldData {
    pub name: String,
    pub description: String,
    pub teams: Vec<domain::team::Team>,
    pub players: Vec<domain::player::Player>,
    pub staff: Vec<domain::staff::Staff>,
}

/// Lightweight metadata shown in the UI when listing available databases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldDatabaseInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub team_count: usize,
    pub player_count: usize,
    /// "builtin" | "user"
    pub source: String,
    /// Filesystem path (empty for built-in random)
    pub path: String,
}
