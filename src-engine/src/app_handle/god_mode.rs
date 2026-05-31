// god_mode commands — God Mode player editing.
//
// Exposes `edit_player` (JS: `editPlayer`), which lets the player edit any
// player's attributes and metadata while God Mode is enabled. The God Mode
// flag itself is a frontend concern (see `AppSettings.god_mode`); this command
// is unguarded, mirroring the other mutation commands — the UI only surfaces
// the editor when God Mode is on.
//
// Mutation pattern matches the rest of app_handle: snapshot the game, mutate a
// clone, recompute derived ratings, then `set_game`. Auto-save persists it.
use chrono::Datelike;
use serde::{Deserialize, Deserializer};
use wasm_bindgen::prelude::*;

use domain::player::Position;
use ofm_core::player_rating::refresh_player_derived;

use super::{to_js, to_js_value, AppHandle};

/// Deserialize helper that distinguishes an absent field (`None`) from a
/// present-but-null field (`Some(None)`). Needed so the editor can either leave
/// a field untouched or explicitly clear it (e.g. make a player a free agent).
fn double_option<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

#[derive(Debug, Default, Deserialize)]
struct AttributeEdits {
    pace: Option<i64>,
    stamina: Option<i64>,
    strength: Option<i64>,
    agility: Option<i64>,
    passing: Option<i64>,
    shooting: Option<i64>,
    tackling: Option<i64>,
    dribbling: Option<i64>,
    defending: Option<i64>,
    positioning: Option<i64>,
    vision: Option<i64>,
    decisions: Option<i64>,
    composure: Option<i64>,
    aggression: Option<i64>,
    teamwork: Option<i64>,
    leadership: Option<i64>,
    handling: Option<i64>,
    reflexes: Option<i64>,
    aerial: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
struct PlayerEdits {
    attributes: Option<AttributeEdits>,
    condition: Option<i64>,
    morale: Option<i64>,
    fitness: Option<i64>,
    potential: Option<i64>,
    position: Option<Position>,
    natural_position: Option<Position>,
    date_of_birth: Option<String>,
    wage: Option<u32>,
    market_value: Option<u64>,
    #[serde(default, deserialize_with = "double_option")]
    team_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    contract_end: Option<Option<String>>,
}

/// Clamp an attribute-like value into the inclusive 0..=100 range.
fn clamp_attr(value: i64) -> u8 {
    value.clamp(0, 100) as u8
}

fn apply_attribute_edits(attrs: &mut domain::player::PlayerAttributes, edits: &AttributeEdits) {
    if let Some(v) = edits.pace {
        attrs.pace = clamp_attr(v);
    }
    if let Some(v) = edits.stamina {
        attrs.stamina = clamp_attr(v);
    }
    if let Some(v) = edits.strength {
        attrs.strength = clamp_attr(v);
    }
    if let Some(v) = edits.agility {
        attrs.agility = clamp_attr(v);
    }
    if let Some(v) = edits.passing {
        attrs.passing = clamp_attr(v);
    }
    if let Some(v) = edits.shooting {
        attrs.shooting = clamp_attr(v);
    }
    if let Some(v) = edits.tackling {
        attrs.tackling = clamp_attr(v);
    }
    if let Some(v) = edits.dribbling {
        attrs.dribbling = clamp_attr(v);
    }
    if let Some(v) = edits.defending {
        attrs.defending = clamp_attr(v);
    }
    if let Some(v) = edits.positioning {
        attrs.positioning = clamp_attr(v);
    }
    if let Some(v) = edits.vision {
        attrs.vision = clamp_attr(v);
    }
    if let Some(v) = edits.decisions {
        attrs.decisions = clamp_attr(v);
    }
    if let Some(v) = edits.composure {
        attrs.composure = clamp_attr(v);
    }
    if let Some(v) = edits.aggression {
        attrs.aggression = clamp_attr(v);
    }
    if let Some(v) = edits.teamwork {
        attrs.teamwork = clamp_attr(v);
    }
    if let Some(v) = edits.leadership {
        attrs.leadership = clamp_attr(v);
    }
    if let Some(v) = edits.handling {
        attrs.handling = clamp_attr(v);
    }
    if let Some(v) = edits.reflexes {
        attrs.reflexes = clamp_attr(v);
    }
    if let Some(v) = edits.aerial {
        attrs.aerial = clamp_attr(v);
    }
}

#[wasm_bindgen]
impl AppHandle {
    #[wasm_bindgen(js_name = editPlayer)]
    pub fn edit_player(&self, player_id: String, edits: JsValue) -> Result<JsValue, JsValue> {
        let edits: PlayerEdits = serde_wasm_bindgen::from_value(edits)
            .map_err(|e| to_js(format!("be.error.deserialize:{e}")))?;

        let mut game = self.snapshot_game()?;
        let current_year = game.clock.current_date.year() as u32;

        let player_index = game
            .players
            .iter()
            .position(|player| player.id == player_id)
            .ok_or_else(|| to_js("be.error.playerNotFound".to_string()))?;

        let old_team_id = game.players[player_index].team_id.clone();

        {
            let player = &mut game.players[player_index];

            if let Some(attr_edits) = &edits.attributes {
                apply_attribute_edits(&mut player.attributes, attr_edits);
            }
            if let Some(v) = edits.condition {
                player.condition = clamp_attr(v);
            }
            if let Some(v) = edits.morale {
                player.morale = clamp_attr(v);
            }
            if let Some(v) = edits.fitness {
                player.fitness = clamp_attr(v);
            }
            if let Some(v) = edits.potential {
                player.potential = clamp_attr(v);
            }
            if let Some(position) = edits.position.clone() {
                player.position = position;
            }
            if let Some(position) = edits.natural_position.clone() {
                player.natural_position = position;
            }
            if let Some(dob) = edits.date_of_birth.clone() {
                player.date_of_birth = dob;
            }
            if let Some(wage) = edits.wage {
                player.wage = wage;
            }
            if let Some(value) = edits.market_value {
                player.market_value = value;
            }
            if let Some(team_id) = edits.team_id.clone() {
                player.team_id = team_id;
            }
            if let Some(contract_end) = edits.contract_end.clone() {
                player.contract_end = contract_end;
            }

            refresh_player_derived(player, current_year);
        }

        // If the player changed clubs, drop them from the previous team's
        // starting XI so the old squad doesn't reference a player who left.
        if let Some(new_team_id) = edits.team_id.clone() {
            if old_team_id != new_team_id {
                if let Some(old_id) = old_team_id {
                    if let Some(team) = game.teams.iter_mut().find(|t| t.id == old_id) {
                        team.starting_xi_ids.retain(|id| id != &player_id);
                    }
                }
            }
        }

        self.state.set_game(game.clone());
        to_js_value(&serde_json::json!({ "game": game }))
    }
}
