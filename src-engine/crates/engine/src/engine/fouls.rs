use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::shared::{
    PlayerSnap, fitness_injury_risk_modifier, morale_performance_modifier, morale_risk_modifier,
    pitch_foul_modifier, pitch_injury_modifier, referee_card_modifier, referee_foul_modifier,
    referee_penalty_modifier, trait_foul_risk_modifier, trait_shot_quality_modifier,
    weather_foul_modifier, weather_injury_modifier,
};
use crate::types::{Position, Side, Zone};

use super::MatchContext;
use super::snap_player;

/// `fouled_snap` is the player who was fouled; `fouler_snap` committed the foul.
/// `fouling_side` is the side that committed the foul.
pub(super) fn maybe_foul<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    fouling_side: Side,
    fouled_snap: &PlayerSnap,
    fouler_snap: &PlayerSnap,
    zone: Zone,
    rng: &mut R,
) {
    let aggression_mod = fouler_snap.aggression as f64 / 100.0;
    let foul_chance = ctx.config.foul_probability
        * (0.6 + aggression_mod * 0.8)
        * trait_foul_risk_modifier(fouler_snap)
        * morale_risk_modifier(fouler_snap.morale)
        * referee_foul_modifier(ctx.config)
        * weather_foul_modifier(ctx.config)
        * pitch_foul_modifier(ctx.config);
    if rng.random_range(0.0..1.0f64) >= foul_chance {
        return;
    }

    ctx.emit(
        MatchEvent::new(minute, EventType::Foul, fouling_side, zone)
            .with_player(&fouler_snap.id)
            .with_secondary(&fouled_snap.id),
    );

    let att_side = fouling_side.opposite();

    if zone.is_box_for(att_side)
        && rng.random_range(0.0..1.0f64)
            < (ctx.config.penalty_probability * referee_penalty_modifier(ctx.config)).clamp(0.0, 1.0)
    {
        ctx.emit(MatchEvent::new(
            minute,
            EventType::PenaltyAwarded,
            att_side,
            zone,
        ));
        resolve_penalty(ctx, minute, att_side, rng);
    } else {
        ctx.emit(MatchEvent::new(minute, EventType::FreeKick, att_side, zone));
    }

    maybe_card(ctx, minute, fouling_side, fouler_snap, zone, rng);

    let injury_chance = ctx.config.injury_probability
        * fitness_injury_risk_modifier(fouled_snap.condition, fouled_snap.fitness)
        * weather_injury_modifier(ctx.config)
        * pitch_injury_modifier(ctx.config);
    if rng.random_range(0.0..1.0f64) < injury_chance {
        ctx.emit(
            MatchEvent::new(minute, EventType::Injury, att_side, zone).with_player(&fouled_snap.id),
        );
    }
}

fn maybe_card<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    side: Side,
    fouler: &PlayerSnap,
    zone: Zone,
    rng: &mut R,
) {
    let aggression_factor = fouler.aggression as f64 / 100.0;
    let card_chance = ctx.config.yellow_card_probability
        * (0.5 + aggression_factor)
        * trait_foul_risk_modifier(fouler).sqrt()
        * morale_risk_modifier(fouler.morale).sqrt()
        * referee_card_modifier(ctx.config);
    if rng.random_range(0.0..1.0f64) >= card_chance {
        return;
    }

    if rng.random_range(0.0..1.0f64)
        < (ctx.config.red_card_probability
            * trait_foul_risk_modifier(fouler).sqrt()
            * morale_risk_modifier(fouler.morale).sqrt()
            * referee_card_modifier(ctx.config))
        .clamp(0.0, 1.0)
    {
        ctx.emit(MatchEvent::new(minute, EventType::RedCard, side, zone).with_player(&fouler.id));
        ctx.sent_off.insert(fouler.id.clone());
        return;
    }

    let current_yellows = ctx.yellows.entry(fouler.id.clone()).or_insert(0);
    *current_yellows += 1;

    if *current_yellows >= 2 {
        ctx.emit(
            MatchEvent::new(minute, EventType::SecondYellow, side, zone).with_player(&fouler.id),
        );
        ctx.sent_off.insert(fouler.id.clone());
    } else {
        ctx.emit(MatchEvent::new(minute, EventType::YellowCard, side, zone).with_player(&fouler.id));
    }
}

fn resolve_penalty<R: Rng>(ctx: &mut MatchContext, minute: u8, att_side: Side, rng: &mut R) {
    let taker = snap_player(ctx, att_side, Position::Forward, rng);
    let gk = snap_player(ctx, att_side.opposite(), Position::Goalkeeper, rng);

    let shoot_skill = (taker.shooting as f64 + taker.decisions as f64) / 2.0;
    let gk_skill = (gk.positioning as f64 + gk.decisions as f64) / 2.0;
    let conversion = (0.75
        + (shoot_skill * trait_shot_quality_modifier(&taker) * morale_performance_modifier(taker.morale)
            - gk_skill * morale_performance_modifier(gk.morale))
            / 300.0)
        .clamp(0.55, 0.92);
    let zone = Zone::attacking_box(att_side);

    if rng.random_range(0.0..1.0f64) < conversion {
        ctx.emit(
            MatchEvent::new(minute, EventType::PenaltyGoal, att_side, zone).with_player(&taker.id),
        );
        ctx.add_goal(att_side);
    } else {
        ctx.emit(
            MatchEvent::new(minute, EventType::PenaltyMiss, att_side, zone).with_player(&taker.id),
        );
    }
}
