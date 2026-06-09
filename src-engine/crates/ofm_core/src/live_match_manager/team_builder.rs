use crate::game::Game;
use crate::player_rating::{effective_rating_for_assignment, formation_slots, natural_ovr};
use domain::player::Position as DomainPosition;
use domain::team::CustomTacticSlot;
use engine::{
    LateralProfile, PlayStyle, PlayerData, Position, RoleInfluenceProfile, ShapeProfile,
    TacticalInstructionProfile, TacticalProfile, TeamData, WidthProfile,
};

// ---------------------------------------------------------------------------
// Domain → Engine conversion with starting XI / bench split
// ---------------------------------------------------------------------------

pub(crate) fn build_team_with_bench(game: &Game, team_id: &str) -> (TeamData, Vec<PlayerData>) {
    let is_user_team = game.manager.team_id.as_deref() == Some(team_id);
    build_team_with_bench_for_side(game, team_id, is_user_team)
}

fn build_team_with_bench_for_side(
    game: &Game,
    team_id: &str,
    respect_manual_slots: bool,
) -> (TeamData, Vec<PlayerData>) {
    let team = game.teams.iter().find(|t| t.id == team_id);
    let (name, formation, play_style, form, tactical_familiarity) = match team {
        Some(t) => (
            t.name.clone(),
            t.formation.clone(),
            match t.play_style {
                domain::team::PlayStyle::Attacking => PlayStyle::Attacking,
                domain::team::PlayStyle::Defensive => PlayStyle::Defensive,
                domain::team::PlayStyle::Possession => PlayStyle::Possession,
                domain::team::PlayStyle::Counter => PlayStyle::Counter,
                domain::team::PlayStyle::HighPress => PlayStyle::HighPress,
                _ => PlayStyle::Balanced,
            },
            t.form.clone(),
            t.tactical_familiarity as f64 / 100.0,
        ),
        None => (
            "Unknown".into(),
            "4-4-2".into(),
            PlayStyle::Balanced,
            Vec::new(),
            0.5,
        ),
    };

    // Collect all available (non-injured) players for this team
    let available_players: Vec<&domain::player::Player> = game
        .players
        .iter()
        .filter(|p| p.team_id.as_deref() == Some(team_id) && p.injury.is_none())
        .collect();
    let mut used_ids = std::collections::HashSet::new();
    let mut starting_xi = Vec::with_capacity(11);

    if respect_manual_slots {
        if let Some(team) = team {
            for slot in team
                .custom_tactic_slots
                .iter()
                .filter(|slot| slot.player_id.is_some())
            {
            let Some(player_id) = slot.player_id.as_ref() else {
                continue;
            };
            let Some(player) = available_players
                .iter()
                .copied()
                .find(|candidate| &candidate.id == player_id && !used_ids.contains(&candidate.id))
            else {
                continue;
            };

                let slot_position = domain_position_for_tactic_slot(&slot.role);
                used_ids.insert(player.id.clone());
                let mut engine_player = to_engine_player_for_slot(player, &slot_position);
                engine_player.position = to_engine_position_for_tactic_slot(&slot.role);
                starting_xi.push(engine_player);
            }
        }
    }

    if starting_xi.len() < 11 {
        let slots = formation_slots(&formation);
        for slot in slots.iter().take(11) {
            let best_player = available_players
                .iter()
                .copied()
                .filter(|player| !used_ids.contains(&player.id))
                .max_by(|left, right| {
                    selection_score(left, slot, respect_manual_slots)
                        .partial_cmp(&selection_score(right, slot, respect_manual_slots))
                        .unwrap_or(std::cmp::Ordering::Equal)
                });

            let Some(player) = best_player else {
                break;
            };

            used_ids.insert(player.id.clone());
            starting_xi.push(to_engine_player_for_slot(player, slot));
            if starting_xi.len() == 11 {
                break;
            }
        }
    }

    let mut bench_domain: Vec<&domain::player::Player> = available_players
        .into_iter()
        .filter(|player| !used_ids.contains(&player.id))
        .collect();
    bench_domain.sort_by(|left, right| {
        natural_ovr(right)
            .partial_cmp(&natural_ovr(left))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let bench = bench_domain.into_iter().map(to_engine_player).collect();

    let shape_profile = shape_profile_from_formation(&formation);
    let tactical_profile = team.map(tactical_profile_from_slots).unwrap_or_default();
    let team_data = TeamData {
        id: team_id.to_string(),
        name,
        formation,
        play_style,
        players: starting_xi,
        form,
        tactical_familiarity,
        shape_profile,
        tactical_profile,
    };

    (team_data, bench)
}

fn selection_score(player: &domain::player::Player, slot: &DomainPosition, preserve_raw_rating: bool) -> f64 {
    let rating = effective_rating_for_assignment(player, slot);
    if preserve_raw_rating {
        rating
    } else {
        rating * rotation_readiness(player)
    }
}

fn rotation_readiness(player: &domain::player::Player) -> f64 {
    let condition = player.condition as f64;
    let fitness = player.fitness as f64;
    let stamina = player.attributes.stamina as f64;

    let condition_mult = if condition >= 80.0 {
        1.0
    } else if condition >= 70.0 {
        0.94
    } else if condition >= 50.0 {
        0.82 + (condition - 50.0) * 0.006
    } else {
        0.58 + condition * 0.006
    };
    let fitness_mult = if fitness >= 65.0 {
        1.0 + ((fitness - 65.0) / 35.0) * 0.04
    } else {
        0.82 + (fitness / 65.0) * 0.18
    };
    let stamina_mult = 0.92 + (stamina / 100.0) * 0.10;

    (condition_mult * fitness_mult * stamina_mult).clamp(0.42, 1.08)
}

fn shape_profile_from_formation(formation: &str) -> ShapeProfile {
    let parts: Vec<u8> = formation
        .split('-')
        .filter_map(|part| part.parse::<u8>().ok())
        .collect();

    match parts.as_slice() {
        [defenders, midfielders, forwards] => ShapeProfile {
            defenders: *defenders,
            midfielders: *midfielders,
            forwards: *forwards,
        },
        [
            defenders,
            defensive_midfielders,
            attacking_midfielders,
            forwards,
        ] => ShapeProfile {
            defenders: *defenders,
            midfielders: defensive_midfielders + attacking_midfielders,
            forwards: *forwards,
        },
        _ => ShapeProfile::default(),
    }
}

fn tactical_profile_from_slots(team: &domain::team::Team) -> TacticalProfile {
    let occupied_slots: Vec<&CustomTacticSlot> = team
        .custom_tactic_slots
        .iter()
        .filter(|slot| slot.player_id.is_some() && slot.role != "GK")
        .collect();

    if occupied_slots.is_empty() {
        return TacticalProfile {
            instructions: to_engine_tactical_instructions(team.tactical_instructions),
            ..TacticalProfile::default()
        };
    }

    let total_weight: f64 = occupied_slots
        .iter()
        .map(|slot| tactic_slot_weight(slot))
        .sum();
    let left_weight: f64 = occupied_slots
        .iter()
        .filter(|slot| slot.x < 42)
        .map(|slot| tactic_slot_weight(slot))
        .sum();
    let right_weight: f64 = occupied_slots
        .iter()
        .filter(|slot| slot.x > 58)
        .map(|slot| tactic_slot_weight(slot))
        .sum();
    let central_weight: f64 = occupied_slots
        .iter()
        .filter(|slot| (42..=58).contains(&slot.x))
        .map(|slot| tactic_slot_weight(slot))
        .sum();
    let mean_x =
        occupied_slots.iter().map(|slot| slot.x as f64).sum::<f64>() / occupied_slots.len() as f64;
    let mean_y =
        occupied_slots.iter().map(|slot| slot.y as f64).sum::<f64>() / occupied_slots.len() as f64;
    let spread = occupied_slots
        .iter()
        .map(|slot| (slot.x as f64 - mean_x).abs())
        .sum::<f64>()
        / occupied_slots.len() as f64;

    let left_share = left_weight / total_weight;
    let right_share = right_weight / total_weight;
    let central_share = central_weight / total_weight;
    let width = (spread / 32.0).clamp(0.0, 1.0);

    TacticalProfile {
        lateral: LateralProfile {
            left_overload: (left_share - 0.34).max(0.0).clamp(0.0, 0.45),
            right_overload: (right_share - 0.34).max(0.0).clamp(0.0, 0.45),
            left_weakness: (0.26 - left_share).max(0.0).clamp(0.0, 0.35),
            right_weakness: (0.26 - right_share).max(0.0).clamp(0.0, 0.35),
        },
        width: WidthProfile {
            width,
            central_density: central_share.clamp(0.0, 1.0),
            wing_threat: ((left_share + right_share) * 0.65 + width * 0.35).clamp(0.0, 1.0),
            central_compactness: (central_share * 0.7 + (1.0 - width) * 0.3).clamp(0.0, 1.0),
        },
        roles: role_influence_from_slots(&occupied_slots),
        instructions: tactical_instructions_from_slots(team, &occupied_slots, width, mean_y),
    }
}

fn role_influence_from_slots(occupied_slots: &[&CustomTacticSlot]) -> RoleInfluenceProfile {
    let total = occupied_slots.len().max(1) as f64;
    let mut profile = RoleInfluenceProfile::default();

    for slot in occupied_slots {
        match slot.tactical_role.as_deref() {
            Some("DLP" | "AP") => profile.playmaking += 1.0,
            Some("BWM") => profile.ball_winning += 1.0,
            Some("W" | "WB" | "IW") => profile.wide_support += 1.0,
            Some("PF") => profile.pressing_forward += 1.0,
            Some("IF") => profile.inside_forward += 1.0,
            _ => {}
        }
        match slot.duty.as_deref() {
            Some("Attack") => profile.attacking_duty += 1.0,
            Some("Defend") => profile.defensive_duty += 1.0,
            _ => {}
        }
    }

    RoleInfluenceProfile {
        playmaking: (profile.playmaking / total).clamp(0.0, 1.0),
        ball_winning: (profile.ball_winning / total).clamp(0.0, 1.0),
        wide_support: (profile.wide_support / total).clamp(0.0, 1.0),
        pressing_forward: (profile.pressing_forward / total).clamp(0.0, 1.0),
        inside_forward: (profile.inside_forward / total).clamp(0.0, 1.0),
        attacking_duty: (profile.attacking_duty / total).clamp(0.0, 1.0),
        defensive_duty: (profile.defensive_duty / total).clamp(0.0, 1.0),
    }
}

fn to_engine_tactical_instructions(
    instructions: domain::team::TacticalInstructions,
) -> TacticalInstructionProfile {
    let instructions = instructions.clamped();
    TacticalInstructionProfile {
        pressing_intensity: instructions.pressing_intensity,
        defensive_line: instructions.defensive_line,
        tempo: instructions.tempo,
        width: instructions.width,
        passing_directness: instructions.passing_directness,
        risk_appetite: instructions.risk_appetite,
        counter_attack: instructions.counter_attack,
        counter_press: instructions.counter_press,
    }
}

fn tactical_instructions_from_slots(
    team: &domain::team::Team,
    occupied_slots: &[&CustomTacticSlot],
    width: f64,
    mean_y: f64,
) -> TacticalInstructionProfile {
    let mut profile = to_engine_tactical_instructions(team.tactical_instructions);
    let vertical_aggression = ((62.0 - mean_y) / 50.0).clamp(-0.3, 0.3);
    let attack_duties = occupied_slots
        .iter()
        .filter(|slot| slot.duty.as_deref() == Some("Attack"))
        .count() as f64
        / occupied_slots.len() as f64;
    let defend_duties = occupied_slots
        .iter()
        .filter(|slot| slot.duty.as_deref() == Some("Defend"))
        .count() as f64
        / occupied_slots.len() as f64;

    profile.defensive_line += vertical_aggression * 0.28;
    profile.risk_appetite += vertical_aggression * 0.18 + attack_duties * 0.12 - defend_duties * 0.10;
    profile.tempo += attack_duties * 0.08 - defend_duties * 0.06;
    profile.width = (profile.width * 0.45 + width * 0.55).clamp(0.0, 1.0);
    profile.counter_attack += attack_duties * 0.06 - defend_duties * 0.05;

    for slot in occupied_slots {
        match slot.tactical_role.as_deref() {
            Some("PF" | "BWM") => {
                profile.pressing_intensity += 0.025;
                profile.counter_press += 0.020;
            }
            Some("W" | "WB") => profile.width += 0.025,
            Some("DLP" | "AP") => {
                profile.passing_directness -= 0.025;
                profile.risk_appetite -= 0.010;
            }
            Some("AF") => {
                profile.passing_directness += 0.025;
                profile.risk_appetite += 0.015;
                profile.counter_attack += 0.015;
            }
            Some("IF" | "IW") => {
                profile.risk_appetite += 0.012;
                profile.width -= 0.010;
            }
            _ => {}
        }
    }

    TacticalInstructionProfile {
        pressing_intensity: profile.pressing_intensity.clamp(0.0, 1.0),
        defensive_line: profile.defensive_line.clamp(0.0, 1.0),
        tempo: profile.tempo.clamp(0.0, 1.0),
        width: profile.width.clamp(0.0, 1.0),
        passing_directness: profile.passing_directness.clamp(0.0, 1.0),
        risk_appetite: profile.risk_appetite.clamp(0.0, 1.0),
        counter_attack: profile.counter_attack.clamp(0.0, 1.0),
        counter_press: profile.counter_press.clamp(0.0, 1.0),
    }
}

fn tactic_slot_weight(slot: &CustomTacticSlot) -> f64 {
    let role = slot.role.as_str();
    let line_weight = match role {
        "DEF" => 0.9,
        "DM" | "MID" | "AM" => 1.0,
        "FWD" => 1.1,
        _ => 1.0,
    };
    let role_weight = match slot.tactical_role.as_deref() {
        Some("IF" | "IW" | "AF" | "PF") => 1.06,
        Some("W" | "WB") => 1.04,
        Some("DLP" | "AP" | "BWM") => 1.03,
        _ => 1.0,
    };
    let duty_weight = match slot.duty.as_deref() {
        Some("Attack") => 1.05,
        Some("Defend") => 0.97,
        _ => 1.0,
    };
    let vertical_weight = if slot.y < 35 {
        1.08
    } else if slot.y > 70 {
        0.94
    } else {
        1.0
    };

    line_weight * role_weight * duty_weight * vertical_weight
}

fn to_engine_position_for_tactic_slot(role: &str) -> Position {
    match role {
        "GK" => Position::Goalkeeper,
        "DEF" => Position::Defender,
        "FWD" => Position::Forward,
        _ => Position::Midfielder,
    }
}

fn domain_position_for_tactic_slot(role: &str) -> DomainPosition {
    match role {
        "GK" => DomainPosition::Goalkeeper,
        "DEF" => DomainPosition::Defender,
        "FWD" => DomainPosition::Forward,
        _ => DomainPosition::Midfielder,
    }
}

fn to_engine_player_for_slot(p: &domain::player::Player, slot: &DomainPosition) -> PlayerData {
    let mut player = to_engine_player(p);
    let condition = (p.condition as f64 / 100.0).max(0.01);
    player.ovr = (effective_rating_for_assignment(p, slot) / condition)
        .round()
        .clamp(1.0, 99.0) as u8;
    player
}

fn to_engine_player(p: &domain::player::Player) -> PlayerData {
    let pos = match p.position.to_group_position() {
        DomainPosition::Goalkeeper => Position::Goalkeeper,
        DomainPosition::Defender => Position::Defender,
        DomainPosition::Midfielder => Position::Midfielder,
        DomainPosition::Forward => Position::Forward,
        _ => Position::Midfielder,
    };

    PlayerData {
        id: p.id.clone(),
        name: p.match_name.clone(),
        position: pos,
        ovr: p.ovr,
        condition: p.condition,
        morale: p.morale,
        fitness: p.fitness,
        pace: p.attributes.pace,
        stamina: p.attributes.stamina,
        strength: p.attributes.strength,
        agility: p.attributes.agility,
        passing: p.attributes.passing,
        shooting: p.attributes.shooting,
        tackling: p.attributes.tackling,
        dribbling: p.attributes.dribbling,
        defending: p.attributes.defending,
        positioning: p.attributes.positioning,
        vision: p.attributes.vision,
        decisions: p.attributes.decisions,
        composure: p.attributes.composure,
        aggression: p.attributes.aggression,
        teamwork: p.attributes.teamwork,
        leadership: p.attributes.leadership,
        handling: p.attributes.handling,
        reflexes: p.attributes.reflexes,
        aerial: p.attributes.aerial,
        traits: p.traits.iter().map(|t| format!("{:?}", t)).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slot(id: &str, x: u8, y: u8, role: &str) -> CustomTacticSlot {
        CustomTacticSlot {
            slot_id: id.to_string(),
            player_id: Some(format!("player-{id}")),
            role: role.to_string(),
            x,
            y,
            tactical_role: None,
            duty: None,
        }
    }

    fn role_slot(id: &str, x: u8, y: u8, role: &str, tactical_role: &str, duty: &str) -> CustomTacticSlot {
        CustomTacticSlot {
            slot_id: id.to_string(),
            player_id: Some(format!("player-{id}")),
            role: role.to_string(),
            x,
            y,
            tactical_role: Some(tactical_role.to_string()),
            duty: Some(duty.to_string()),
        }
    }

    fn profile_from_slots(slots: Vec<CustomTacticSlot>) -> TacticalProfile {
        let mut team = domain::team::Team::new(
            "team".to_string(),
            "Team".to_string(),
            "TEAM".to_string(),
            "England".to_string(),
            "London".to_string(),
            "Ground".to_string(),
            40_000,
        );
        team.custom_tactic_slots = slots;
        tactical_profile_from_slots(&team)
    }

    #[test]
    fn derives_left_overload_and_right_weakness_from_left_heavy_slots() {
        let profile = profile_from_slots(vec![
            slot("lb", 18, 72, "DEF"),
            slot("lm", 17, 47, "MID"),
            slot("lw", 18, 28, "FWD"),
            slot("lcm", 35, 45, "MID"),
            slot("gk", 50, 91, "GK"),
        ]);

        assert!(profile.lateral.left_overload > profile.lateral.right_overload);
        assert!(profile.lateral.right_weakness > profile.lateral.left_weakness);
    }

    #[test]
    fn derives_right_overload_and_left_weakness_from_right_heavy_slots() {
        let profile = profile_from_slots(vec![
            slot("rb", 82, 72, "DEF"),
            slot("rm", 83, 47, "MID"),
            slot("rw", 82, 28, "FWD"),
            slot("rcm", 65, 45, "MID"),
        ]);

        assert!(profile.lateral.right_overload > profile.lateral.left_overload);
        assert!(profile.lateral.left_weakness > profile.lateral.right_weakness);
    }

    #[test]
    fn central_cluster_increases_density_more_than_width() {
        let profile = profile_from_slots(vec![
            slot("cb", 50, 74, "DEF"),
            slot("dm", 50, 59, "DM"),
            slot("cm", 50, 45, "MID"),
            slot("am", 50, 30, "AM"),
            slot("st", 50, 15, "FWD"),
        ]);

        assert!(profile.width.central_density > 0.9);
        assert!(profile.width.width < 0.1);
        assert!(profile.width.central_compactness > profile.width.wing_threat);
    }

    #[test]
    fn wide_shape_increases_wing_threat_more_than_central_compactness() {
        let profile = profile_from_slots(vec![
            slot("lb", 18, 72, "DEF"),
            slot("rb", 82, 72, "DEF"),
            slot("lm", 17, 47, "MID"),
            slot("rm", 83, 47, "MID"),
            slot("lw", 18, 28, "FWD"),
            slot("rw", 82, 28, "FWD"),
        ]);

        assert!(profile.width.width > 0.8);
        assert!(profile.width.wing_threat > profile.width.central_compactness);
    }

    #[test]
    fn derives_role_influence_profile_from_tactical_roles_and_duties() {
        let profile = profile_from_slots(vec![
            role_slot("dlp", 50, 56, "MID", "DLP", "Support"),
            role_slot("bwm", 45, 52, "MID", "BWM", "Defend"),
            role_slot("wb", 18, 70, "DEF", "WB", "Attack"),
            role_slot("pf", 50, 18, "FWD", "PF", "Attack"),
            role_slot("if", 35, 26, "FWD", "IF", "Attack"),
        ]);

        assert!(profile.roles.playmaking > 0.0);
        assert!(profile.roles.ball_winning > 0.0);
        assert!(profile.roles.wide_support > 0.0);
        assert!(profile.roles.pressing_forward > 0.0);
        assert!(profile.roles.inside_forward > 0.0);
        assert!(profile.roles.attacking_duty > profile.roles.defensive_duty);
    }
}

/// Auto-select set-piece takers from a set of player IDs.
/// Returns (captain_id, penalty_taker_id, free_kick_taker_id, corner_taker_id).
pub fn auto_select_set_pieces(
    game: &Game,
    player_ids: &[String],
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let players: Vec<&domain::player::Player> = player_ids
        .iter()
        .filter_map(|id| game.players.iter().find(|p| &p.id == id))
        .collect();

    if players.is_empty() {
        return (None, None, None, None);
    }

    // Captain: highest leadership + teamwork
    let captain = players
        .iter()
        .max_by_key(|p| (p.attributes.leadership as u16) + (p.attributes.teamwork as u16))
        .map(|p| p.id.clone());

    // Penalty taker: highest shooting + composure (exclude GK)
    let penalty = players
        .iter()
        .filter(|p| p.position != DomainPosition::Goalkeeper)
        .max_by_key(|p| (p.attributes.shooting as u16) + (p.attributes.composure as u16))
        .map(|p| p.id.clone());

    // Free kick taker: highest passing + vision + shooting (exclude GK)
    let free_kick = players
        .iter()
        .filter(|p| p.position != DomainPosition::Goalkeeper)
        .max_by_key(|p| {
            (p.attributes.passing as u16)
                + (p.attributes.vision as u16)
                + (p.attributes.shooting as u16) / 2
        })
        .map(|p| p.id.clone());

    // Corner taker: highest passing + vision (exclude GK, prefer different from FK)
    let corner = players
        .iter()
        .filter(|p| p.position != DomainPosition::Goalkeeper)
        .max_by_key(|p| {
            let base = (p.attributes.passing as u16) + (p.attributes.vision as u16);
            // Small penalty if same as free kick taker to encourage variety
            if free_kick.as_ref() == Some(&p.id) {
                base.saturating_sub(5)
            } else {
                base
            }
        })
        .map(|p| p.id.clone());

    (captain, penalty, free_kick, corner)
}
