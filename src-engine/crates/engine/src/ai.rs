use rand::{Rng, RngExt};

use crate::live_match::{LiveMatchState, MatchCommand, MatchPhase};
use crate::types::{PlayStyle, PlayerData, Position, Side, TeamData};

// ---------------------------------------------------------------------------
// AI Manager profile — drives decision-making style
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct AiProfile {
    /// Team reputation 0–1000. Higher = more sophisticated decisions.
    pub reputation: u32,
    /// Manager experience level 0–100. Affects timing and quality of subs.
    pub experience: u8,
}

impl Default for AiProfile {
    fn default() -> Self {
        Self {
            reputation: 500,
            experience: 50,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MatchNeed {
    Protect,
    Chase,
    Control,
    SurviveRedCard,
}

#[derive(Debug, Clone, Copy)]
struct ScoreState {
    goal_diff: i8,
    minute: u8,
    subs_made: u8,
    yellows: usize,
    sent_off: usize,
    experience_factor: f64,
    reputation_factor: f64,
}

// ---------------------------------------------------------------------------
// AI decision engine — called once per minute for AI-controlled sides
// ---------------------------------------------------------------------------

/// Evaluate the current match state and return any commands the AI wants to
/// execute. Should be called after each `step_minute` for AI-controlled sides.
pub fn ai_decide<R: Rng>(
    match_state: &LiveMatchState,
    side: Side,
    profile: &AiProfile,
    rng: &mut R,
) -> Vec<MatchCommand> {
    let mut commands = Vec::new();

    let minute = match_state.minute();

    match match_state.phase() {
        MatchPhase::FirstHalf
        | MatchPhase::SecondHalf
        | MatchPhase::ExtraTimeFirstHalf
        | MatchPhase::ExtraTimeSecondHalf => {}
        _ => return commands,
    }

    let subs_made = match_state.substitutions_made(side);

    if subs_made < match_state.max_substitutions()
        && let Some(sub_cmd) = consider_substitution(match_state, side, profile, minute, subs_made, rng)
    {
        commands.push(sub_cmd);
    }

    if let Some(tactic_cmd) = consider_tactic_change(match_state, side, profile, minute, rng) {
        commands.push(tactic_cmd);
    }

    commands
}

// ---------------------------------------------------------------------------
// Substitution logic
// ---------------------------------------------------------------------------

fn consider_substitution<R: Rng>(
    match_state: &LiveMatchState,
    side: Side,
    profile: &AiProfile,
    minute: u8,
    subs_made: u8,
    rng: &mut R,
) -> Option<MatchCommand> {
    let team = match_state.team(side);
    let bench = match_state.bench(side);

    if bench.is_empty() {
        return None;
    }

    let state = score_state(match_state, side, profile, minute, subs_made);
    let need = match_need(state);
    let best = team
        .players
        .iter()
        .filter(|player| !match_state.is_sent_off(&player.id))
        .filter(|player| {
            player.position != Position::Goalkeeper
                || match_state.player_condition(&player.id, player.condition) <= 25
        })
        .filter_map(|player| {
            let on = find_best_bench_replacement(bench, player.position, need, match_state)?;
            let off_score = player_off_score(player, team, state, need, match_state);
            let on_score = bench_fit_score(on, player.position, need);
            let upgrade = (on.effective_overall() - player.effective_overall()).max(-10.0) * 0.25;
            Some((player, on, off_score + on_score + upgrade))
        })
        .max_by(|left, right| left.2.partial_cmp(&right.2).unwrap_or(std::cmp::Ordering::Equal));

    let (player_off, player_on, score) = best?;
    let threshold = substitution_threshold(state, need);
    let chance = substitution_chance(score, threshold, state, need);
    if score >= threshold && rng.random_range(0.0..1.0f64) < chance {
        return Some(MatchCommand::Substitute {
            side,
            player_off_id: player_off.id.clone(),
            player_on_id: player_on.id.clone(),
        });
    }

    None
}

fn score_state(
    match_state: &LiveMatchState,
    side: Side,
    profile: &AiProfile,
    minute: u8,
    subs_made: u8,
) -> ScoreState {
    let (own_goals, opp_goals) = match_state.score_for(side);
    let team = match_state.team(side);
    let sent_off = team
        .players
        .iter()
        .filter(|player| match_state.is_sent_off(&player.id))
        .count();
    let yellows = team
        .players
        .iter()
        .filter(|player| match_state.yellow_count(&player.id) > 0)
        .count();

    ScoreState {
        goal_diff: own_goals as i8 - opp_goals as i8,
        minute,
        subs_made,
        yellows,
        sent_off,
        experience_factor: profile.experience as f64 / 100.0,
        reputation_factor: (profile.reputation.min(1000) as f64 / 1000.0).clamp(0.0, 1.0),
    }
}

fn match_need(state: ScoreState) -> MatchNeed {
    if state.sent_off > 0 {
        MatchNeed::SurviveRedCard
    } else if state.goal_diff < 0 && state.minute >= 62 {
        MatchNeed::Chase
    } else if state.goal_diff > 0 && state.minute >= 68 {
        MatchNeed::Protect
    } else {
        MatchNeed::Control
    }
}

fn player_off_score(
    player: &PlayerData,
    team: &TeamData,
    state: ScoreState,
    need: MatchNeed,
    match_state: &LiveMatchState,
) -> f64 {
    let condition = match_state.player_condition(&player.id, player.condition) as f64;
    let condition_gap = (72.0 - condition).max(0.0);
    let fatigue_score = if state.minute < 55 {
        (45.0 - condition).max(0.0) * 1.8
    } else if state.minute < 70 {
        condition_gap * 1.25
    } else {
        condition_gap * 1.55
    };

    let card_score = match_state.yellow_count(&player.id) as f64
        * match player.position {
            Position::Defender => 24.0,
            Position::Midfielder => 20.0,
            Position::Forward => 10.0,
            Position::Goalkeeper => 4.0,
        }
        * (0.75 + state.minute as f64 / 120.0);

    let tactical_score = match need {
        MatchNeed::Chase => match player.position {
            Position::Defender => 13.0,
            Position::Midfielder => 6.0,
            Position::Forward => -8.0,
            Position::Goalkeeper => -40.0,
        },
        MatchNeed::Protect => match player.position {
            Position::Forward => 11.0,
            Position::Midfielder => 5.0,
            Position::Defender => -7.0,
            Position::Goalkeeper => -40.0,
        },
        MatchNeed::SurviveRedCard => red_card_rebalance_score(player, team),
        MatchNeed::Control => match player.position {
            Position::Midfielder => 3.0,
            Position::Forward | Position::Defender => 1.0,
            Position::Goalkeeper => -45.0,
        },
    };

    let starter_protection = if player.ovr >= 82 && condition > 58.0 && state.minute < 78 {
        -8.0
    } else {
        0.0
    };

    fatigue_score + card_score + tactical_score + starter_protection
}

fn red_card_rebalance_score(player: &PlayerData, team: &TeamData) -> f64 {
    let defenders = team
        .players
        .iter()
        .filter(|p| p.position == Position::Defender)
        .count();
    let midfielders = team
        .players
        .iter()
        .filter(|p| p.position == Position::Midfielder)
        .count();

    match player.position {
        Position::Forward if defenders < 4 => 14.0,
        Position::Forward if midfielders < 3 => 10.0,
        Position::Midfielder if defenders < 3 => 8.0,
        Position::Goalkeeper => -50.0,
        _ => 0.0,
    }
}

fn substitution_threshold(state: ScoreState, need: MatchNeed) -> f64 {
    let timing = if state.minute < 50 {
        52.0
    } else if state.minute < 60 {
        34.0
    } else if state.minute < 75 {
        25.0
    } else {
        18.0
    };
    let sub_pressure = state.subs_made as f64 * 6.0;
    let manager_discount = state.experience_factor * 5.0 + state.reputation_factor * 3.0;
    let need_discount = match need {
        MatchNeed::Chase | MatchNeed::SurviveRedCard => 7.0,
        MatchNeed::Protect if state.minute >= 78 => 5.0,
        _ => 0.0,
    };

    (timing + sub_pressure - manager_discount - need_discount).clamp(12.0, 55.0)
}

fn substitution_chance(score: f64, threshold: f64, state: ScoreState, need: MatchNeed) -> f64 {
    let urgency = ((score - threshold) / 20.0).clamp(0.0, 1.0);
    let late = ((state.minute.saturating_sub(55) as f64) / 35.0).clamp(0.0, 1.0);
    let need_bonus = match need {
        MatchNeed::Chase | MatchNeed::SurviveRedCard => 0.18,
        MatchNeed::Protect => 0.10,
        MatchNeed::Control => 0.0,
    };

    (0.25 + urgency * 0.50 + late * 0.18 + state.experience_factor * 0.12 + need_bonus)
        .clamp(0.0, 0.95)
}

fn find_best_bench_replacement<'a>(
    bench: &'a [PlayerData],
    preferred_position: Position,
    need: MatchNeed,
    match_state: &LiveMatchState,
) -> Option<&'a PlayerData> {
    bench
        .iter()
        .filter(|player| !match_state.is_sent_off(&player.id))
        .max_by(|left, right| {
            bench_candidate_score(left, preferred_position, need)
                .partial_cmp(&bench_candidate_score(right, preferred_position, need))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
}

fn bench_candidate_score(player: &PlayerData, preferred_position: Position, need: MatchNeed) -> f64 {
    let position_fit = if player.position == preferred_position {
        22.0
    } else if compatible_position(player.position, preferred_position) {
        9.0
    } else {
        -16.0
    };

    player.effective_overall()
        + position_fit
        + bench_fit_score(player, preferred_position, need)
}

fn compatible_position(candidate: Position, preferred: Position) -> bool {
    matches!(
        (candidate, preferred),
        (Position::Defender, Position::Midfielder)
            | (Position::Midfielder, Position::Defender)
            | (Position::Midfielder, Position::Forward)
            | (Position::Forward, Position::Midfielder)
    )
}

fn bench_fit_score(player: &PlayerData, preferred_position: Position, need: MatchNeed) -> f64 {
    let role_score = match need {
        MatchNeed::Chase => match player.position {
            Position::Forward => player.shooting as f64 * 0.22 + player.dribbling as f64 * 0.14,
            Position::Midfielder => player.passing as f64 * 0.12 + player.vision as f64 * 0.16,
            Position::Defender => -5.0,
            Position::Goalkeeper => -40.0,
        },
        MatchNeed::Protect | MatchNeed::SurviveRedCard => match player.position {
            Position::Defender => player.defending as f64 * 0.18 + player.tackling as f64 * 0.16,
            Position::Midfielder => player.stamina as f64 * 0.12 + player.teamwork as f64 * 0.12,
            Position::Forward => -3.0,
            Position::Goalkeeper => -35.0,
        },
        MatchNeed::Control => match player.position {
            Position::Midfielder => player.passing as f64 * 0.11 + player.teamwork as f64 * 0.11,
            Position::Defender | Position::Forward => player.stamina as f64 * 0.06,
            Position::Goalkeeper => -35.0,
        },
    };
    let fit = if player.position == preferred_position { 5.0 } else { 0.0 };
    role_score + fit
}

// ---------------------------------------------------------------------------
// Tactical change logic
// ---------------------------------------------------------------------------

fn consider_tactic_change<R: Rng>(
    match_state: &LiveMatchState,
    side: Side,
    profile: &AiProfile,
    minute: u8,
    rng: &mut R,
) -> Option<MatchCommand> {
    let team = match_state.team(side);
    let state = score_state(
        match_state,
        side,
        profile,
        minute,
        match_state.substitutions_made(side),
    );
    let need = match_need(state);

    if minute < 55 {
        return None;
    }

    let chance = tactical_change_chance(state, need);
    if rng.random_range(0.0..1.0f64) >= chance {
        return None;
    }

    if let Some(style) = desired_play_style(team.play_style, state, need) {
        return Some(MatchCommand::ChangePlayStyle {
            side,
            play_style: style,
        });
    }

    if let Some(formation) = desired_formation(&team.formation, state, need) {
        return Some(MatchCommand::ChangeFormation {
            side,
            formation: formation.to_string(),
        });
    }

    None
}

fn tactical_change_chance(state: ScoreState, need: MatchNeed) -> f64 {
    let phase_window = if state.minute >= 82 {
        0.32
    } else if state.minute >= 70 {
        0.22
    } else if state.minute >= 60 {
        0.10
    } else {
        0.04
    };
    let need_bonus = match need {
        MatchNeed::Chase => 0.18 + (-state.goal_diff as f64).max(1.0) * 0.06,
        MatchNeed::Protect => 0.12 + state.goal_diff as f64 * 0.04,
        MatchNeed::SurviveRedCard => 0.26,
        MatchNeed::Control => 0.0,
    };
    let card_noise = (state.yellows as f64 * 0.01).min(0.04);

    (phase_window + need_bonus + card_noise + state.experience_factor * 0.08).clamp(0.0, 0.75)
}

fn desired_play_style(current: PlayStyle, state: ScoreState, need: MatchNeed) -> Option<PlayStyle> {
    let target = match need {
        MatchNeed::Chase if state.minute >= 78 && state.goal_diff <= -1 => PlayStyle::HighPress,
        MatchNeed::Chase if state.minute >= 65 => PlayStyle::Attacking,
        MatchNeed::Protect if state.minute >= 76 && state.goal_diff >= 2 => PlayStyle::Defensive,
        MatchNeed::Protect if state.minute >= 70 => PlayStyle::Counter,
        MatchNeed::SurviveRedCard => PlayStyle::Defensive,
        MatchNeed::Control => return None,
        _ => return None,
    };

    (current != target).then_some(target)
}

fn desired_formation(current: &str, state: ScoreState, need: MatchNeed) -> Option<&'static str> {
    let target = match need {
        MatchNeed::Chase if state.minute >= 80 && state.goal_diff <= -2 => "3-4-3",
        MatchNeed::Chase if state.minute >= 76 => "4-2-4",
        MatchNeed::Protect if state.minute >= 82 && state.goal_diff >= 2 => "5-4-1",
        MatchNeed::Protect if state.minute >= 76 => "4-5-1",
        MatchNeed::SurviveRedCard => "4-4-1",
        MatchNeed::Control => return None,
        _ => return None,
    };

    (current != target).then_some(target)
}
