use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, PlayerSnap, TraitContext, compress_skill, home_mod, pitch_carry_modifier, pitch_pass_modifier,
    play_style_modifier, tactical_buildup_modifier, tactical_counter_press_pressure, tactical_midfield_modifier,
    tactical_press_modifier, tactical_shot_quality_modifier, tactical_space_creation_modifier,
    tactical_turnover_risk, team_cohesion_modifier, trait_bonus, trait_carry_modifier,
    trait_pass_creativity_modifier, trait_pass_safety_modifier, trait_press_work_rate_modifier,
    trait_shot_quality_modifier, trait_shot_tendency_modifier, trait_tackle_modifier,
    weather_conversion_modifier, weather_pass_modifier, weather_shot_accuracy_modifier,
    morale_performance_modifier,
};
use crate::types::{Position, Side, TeamData, Zone};

use super::MatchContext;
use super::fouls::maybe_foul;
use super::snap_player;

fn weighted_attacker<R: Rng>(
    ctx: &MatchContext,
    side: Side,
    rng: &mut R,
    score: impl Fn(&crate::types::PlayerData) -> f64,
) -> PlayerSnap {
    let team = ctx.team(side);
    let available: Vec<&crate::types::PlayerData> = team
        .players
        .iter()
        .filter(|player| player.position != Position::Goalkeeper)
        .collect();

    if available.is_empty() {
        return snap_player(ctx, side, Position::Forward, rng);
    }

    let weights = available
        .iter()
        .map(|player| score(player).max(1.0))
        .collect::<Vec<_>>();
    let total = weights.iter().sum::<f64>();
    let mut roll = rng.random_range(0.0..total);

    for (player, weight) in available.iter().zip(weights.iter()) {
        if roll <= *weight {
            return PlayerSnap::from(player);
        }
        roll -= *weight;
    }

    PlayerSnap::from(available[available.len() - 1])
}

fn shooter_weight(player: &crate::types::PlayerData) -> f64 {
    let role_weight = match player.position {
        Position::Forward => 1.45,
        Position::Midfielder => 0.70,
        Position::Defender => 0.18,
        Position::Goalkeeper => 0.0,
    };
    let skill = player.shooting as f64 * 1.35
        + player.composure as f64
        + player.positioning as f64 * 0.75
        + player.decisions as f64 * 0.65
        + player.dribbling as f64 * 0.45;
    role_weight * skill * trait_shot_tendency_modifier(&PlayerSnap::from(player))
}

fn assister_weight(player: &crate::types::PlayerData) -> f64 {
    let role_weight = match player.position {
        Position::Midfielder => 1.30,
        Position::Forward => 0.85,
        Position::Defender => 0.45,
        Position::Goalkeeper => 0.0,
    };
    let skill = player.passing as f64 * 1.30
        + player.vision as f64 * 1.15
        + player.teamwork as f64 * 0.75
        + player.decisions as f64 * 0.70;
    role_weight * skill * trait_pass_creativity_modifier(&PlayerSnap::from(player))
}

// ---------------------------------------------------------------------------
// Action resolution per zone
// ---------------------------------------------------------------------------

pub(super) fn resolve_action<R: Rng>(ctx: &mut MatchContext, minute: u8, rng: &mut R) {
    let att_side = ctx.possession;
    let def_side = att_side.opposite();
    let zone = ctx.ball_zone;

    if zone.is_box_for(att_side) {
        resolve_shot(ctx, minute, att_side, rng);
        ctx.ball_zone = Zone::Midfield;
        ctx.possession = def_side;
    } else if zone == Zone::attacking_third(att_side) {
        resolve_attacking_third(ctx, minute, att_side, def_side, rng);
    } else if zone == Zone::Midfield {
        resolve_midfield(ctx, minute, att_side, def_side, rng);
    } else {
        resolve_buildup(ctx, minute, att_side, def_side, rng);
    }
}

// ---------------------------------------------------------------------------
// Zone-specific resolution
// ---------------------------------------------------------------------------

fn resolve_buildup<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let passer = snap_player(ctx, att_side, Position::Defender, rng);
    let att_team = ctx.adapted_team(att_side);
    let def_team = ctx.adapted_team(def_side);
    let pass_skill = compress_skill(
        (passer.passing as f64
            + passer.vision as f64
            + passer.composure as f64
            + passer.teamwork as f64)
            / 4.0,
    ) * trait_pass_safety_modifier(&passer)
        * morale_performance_modifier(passer.morale)
        * weather_pass_modifier(ctx.config)
        * pitch_pass_modifier(ctx.config)
        * tactical_buildup_modifier(&att_team)
        * team_cohesion_modifier(&att_team);
    let press = effective_press(ctx, def_side);
    let ball_zone = ctx.ball_zone;

    let success_chance = (pass_skill * 1.3)
        / (pass_skill * 1.3
            + press * tactical_turnover_risk(&att_team) * tactical_counter_press_pressure(&def_team));
    if rng.random_range(0.0..1.0f64) < success_chance {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.ball_zone = Zone::Midfield;
    } else {
        let interceptor = snap_player(ctx, def_side, Position::Midfielder, rng);
        ctx.emit(
            MatchEvent::new(minute, EventType::PassIntercepted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.emit(
            MatchEvent::new(minute, EventType::Interception, def_side, ball_zone)
                .with_player(&interceptor.id),
        );
        ctx.possession = def_side;
    }
}

fn resolve_midfield<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let attacker = snap_player(ctx, att_side, Position::Midfielder, rng);
    let defender = snap_player(ctx, def_side, Position::Midfielder, rng);

    let att_rating = compress_skill(
        (attacker.dribbling as f64
            + attacker.passing as f64
            + attacker.vision as f64
            + attacker.teamwork as f64)
            / 4.0,
    ) * trait_bonus(&attacker, TraitContext::Midfield)
        * trait_pass_safety_modifier(&attacker)
        * morale_performance_modifier(attacker.morale)
        * weather_pass_modifier(ctx.config)
        * pitch_pass_modifier(ctx.config);
    let def_rating = compress_skill(
        (defender.tackling as f64
            + defender.positioning as f64
            + defender.decisions as f64
            + defender.teamwork as f64)
            / 4.0,
    ) * trait_tackle_modifier(&defender)
        * trait_press_work_rate_modifier(&defender)
        * morale_performance_modifier(defender.morale);

    let att_team = ctx.adapted_team(att_side);
    let def_team = ctx.adapted_team(def_side);
    let att_mod = play_style_modifier(att_team.play_style, PlayStylePhase::Midfield, true);
    let def_mod = play_style_modifier(def_team.play_style, PlayStylePhase::Midfield, false);
    let att_eff = att_rating
        * att_mod
        * tactical_midfield_modifier(&att_team)
        * team_cohesion_modifier(&att_team)
        * home_mod(att_side, ctx.config);
    let def_eff = def_rating
        * def_mod
        * tactical_press_modifier(&def_team)
        * tactical_counter_press_pressure(&def_team)
        * team_cohesion_modifier(&def_team)
        * home_mod(def_side, ctx.config);
    let success = att_eff / (att_eff + def_eff);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, Zone::Midfield)
                .with_player(&attacker.id),
        );
        ctx.ball_zone = Zone::attacking_third(att_side);
    } else {
        if rng.random_range(0.0..1.0f64) < 0.6 {
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
            maybe_foul(
                ctx,
                minute,
                def_side,
                &attacker,
                &defender,
                Zone::Midfield,
                rng,
            );
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::PassIntercepted, att_side, Zone::Midfield)
                    .with_player(&attacker.id),
            );
            ctx.emit(
                MatchEvent::new(minute, EventType::Interception, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::Midfield;
    }
}

fn resolve_attacking_third<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let att_team = ctx.adapted_team(att_side);
    let def_team = ctx.adapted_team(def_side);
    let attacker = snap_player(ctx, att_side, Position::Forward, rng);
    let defender = snap_player(ctx, def_side, Position::Defender, rng);

    let att_rating = compress_skill(
        (attacker.dribbling as f64
            + attacker.pace as f64
            + attacker.agility as f64
            + attacker.composure as f64)
            / 4.0,
    ) * trait_carry_modifier(&attacker)
        * trait_pass_creativity_modifier(&attacker)
        * morale_performance_modifier(attacker.morale)
        * weather_pass_modifier(ctx.config)
        * pitch_carry_modifier(ctx.config);
    let def_rating = compress_skill(
        (defender.defending as f64
            + defender.tackling as f64
            + defender.positioning as f64
            + defender.aerial as f64)
            / 4.0,
    ) * trait_tackle_modifier(&defender)
        * trait_press_work_rate_modifier(&defender)
        * morale_performance_modifier(defender.morale);

    let att_mod = play_style_modifier(att_team.play_style, PlayStylePhase::Attack, true);
    let def_mod = play_style_modifier(def_team.play_style, PlayStylePhase::Defense, true);
    let att_eff = att_rating
        * att_mod
        * shape_attack_multiplier(&att_team)
        * tactical_space_creation_modifier(&att_team, &def_team)
        * team_cohesion_modifier(&att_team)
        * home_mod(att_side, ctx.config);
    let def_eff = def_rating
        * def_mod
        * shape_defense_multiplier(&def_team)
        * tactical_press_modifier(&def_team)
        * team_cohesion_modifier(&def_team)
        * home_mod(def_side, ctx.config);
    let success = att_eff / (att_eff + def_eff);
    let zone = Zone::attacking_third(att_side);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::Dribble, att_side, zone).with_player(&attacker.id),
        );
        ctx.ball_zone = Zone::attacking_box(att_side);
    } else {
        let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
        if is_tackle {
            ctx.emit(
                MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                    .with_player(&attacker.id)
                    .with_secondary(&defender.id),
            );
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                    .with_player(&defender.id),
            );
            maybe_foul(ctx, minute, def_side, &attacker, &defender, zone, rng);
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                    .with_player(&defender.id),
            );
        }
        if rng.random_range(0.0..1.0f64) < 0.25 {
            ctx.emit(MatchEvent::new(minute, EventType::Corner, att_side, zone));
            if rng.random_range(0.0..1.0f64) < 0.30 {
                ctx.ball_zone = Zone::attacking_box(att_side);
                return;
            }
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::defensive_third(att_side);
    }
}

fn resolve_shot<R: Rng>(ctx: &mut MatchContext, minute: u8, att_side: Side, rng: &mut R) {
    let def_side = att_side.opposite();
    let att_team = ctx.adapted_team(att_side);
    let def_team = ctx.adapted_team(def_side);
    let shooter = weighted_attacker(ctx, att_side, rng, shooter_weight);
    let assister = weighted_attacker(ctx, att_side, rng, assister_weight);
    let goalkeeper = snap_player(ctx, def_side, Position::Goalkeeper, rng);

    let shoot_rating = compress_skill(
        (shooter.shooting as f64 + shooter.composure as f64 + shooter.decisions as f64) / 3.0,
    ) * trait_shot_quality_modifier(&shooter)
            * morale_performance_modifier(shooter.morale)
            * pitch_carry_modifier(ctx.config);
    let gk_rating = compress_skill(
        (goalkeeper.handling as f64 + goalkeeper.reflexes as f64 + goalkeeper.positioning as f64)
            / 3.0,
    ) * trait_bonus(&goalkeeper, TraitContext::Goalkeeping)
            * morale_performance_modifier(goalkeeper.morale);

    let shot_quality = tactical_shot_quality_modifier(&att_team, &def_team);
    let shape_attack = shape_attack_multiplier(&att_team) * shot_quality;
    let shape_defense = shape_defense_multiplier(&def_team);
    let accuracy = ((ctx.config.shot_accuracy_base
        + (shoot_rating * shape_attack - gk_rating * shape_defense) / 340.0
        - 0.03)
        * weather_shot_accuracy_modifier(ctx.config))
    .clamp(0.10, 0.50);
    let zone = Zone::attacking_box(att_side);

    if rng.random_range(0.0..1.0f64) > accuracy {
        if rng.random_range(0.0..1.0f64) < 0.4 {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(&shooter.id),
            );
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(&shooter.id),
            );
        }
        return;
    }

    let conversion = ((ctx.config.goal_conversion_base
        + (shoot_rating * shape_attack - gk_rating * shape_defense) / 280.0
        - 0.02)
        * weather_conversion_modifier(ctx.config))
    .clamp(0.05, 0.36);

    if rng.random_range(0.0..1.0f64) < conversion {
        ctx.emit(
            MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(&shooter.id)
                .with_secondary(&assister.id),
        );
        ctx.add_goal(att_side);
    } else {
        ctx.emit(
            MatchEvent::new(minute, EventType::ShotSaved, att_side, zone).with_player(&shooter.id),
        );
    }
}

// ---------------------------------------------------------------------------
// Rating helpers
// ---------------------------------------------------------------------------

pub(super) fn effective_midfield(ctx: &MatchContext, side: Side) -> f64 {
    let base = ctx.team(side).midfield_rating();
    let modifier = play_style_modifier(ctx.team(side).play_style, PlayStylePhase::Midfield, true);
    compress_skill(base) * modifier * home_mod(side, ctx.config)
}

fn effective_press(ctx: &MatchContext, pressing_side: Side) -> f64 {
    let team = ctx.team(pressing_side);
    let base = team.position_attr_avg(Position::Midfielder, |p| {
        ((p.stamina as u16 + p.tackling as u16 + p.pace as u16) / 3) as u8
    });
    let modifier = play_style_modifier(team.play_style, PlayStylePhase::Press, true);
    compress_skill(base) * modifier
        * shape_midfield_multiplier(team)
        * tactical_press_modifier(team)
        * team_cohesion_modifier(team)
        * home_mod(pressing_side, ctx.config)
}

fn shape_defense_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.defenders as f64 - 4.0) * 0.045
        + profile.width.central_compactness * 0.035
        - profile.width.width * 0.025
        - (profile.lateral.left_weakness + profile.lateral.right_weakness) * 0.025)
        .clamp(0.82, 1.18)
}

fn shape_midfield_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.midfielders as f64 - 4.0) * 0.035
        + profile.width.central_density * 0.04
        - profile.width.width * 0.015)
        .clamp(0.82, 1.18)
}

fn shape_attack_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.forwards as f64 - 2.0) * 0.05
        + profile.width.wing_threat * 0.035
        + (profile.lateral.left_overload + profile.lateral.right_overload) * 0.02
        - profile.width.central_density * 0.015)
        .clamp(0.82, 1.18)
}
