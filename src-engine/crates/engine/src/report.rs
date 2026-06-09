use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::event::{EventType, MatchEvent};
use crate::types::Side;

// ---------------------------------------------------------------------------
// TeamStats — aggregate stats for one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TeamStats {
    pub goals: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub shots_off_target: u16,
    pub shots_blocked: u16,
    pub passes_completed: u16,
    pub passes_intercepted: u16,
    pub tackles: u16,
    pub interceptions: u16,
    pub fouls: u16,
    pub corners: u16,
    pub free_kicks: u16,
    pub penalties: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub possession_ticks: u32,
}

impl TeamStats {
    pub fn pass_accuracy(&self) -> f64 {
        let total = self.passes_completed as f64 + self.passes_intercepted as f64;
        if total == 0.0 {
            return 0.0;
        }
        self.passes_completed as f64 / total * 100.0
    }
}

// ---------------------------------------------------------------------------
// PlayerMatchStats — individual player performance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlayerMatchStats {
    pub minutes_played: u8,
    pub goals: u8,
    pub assists: u8,
    pub shots: u8,
    pub shots_on_target: u8,
    pub passes_completed: u8,
    pub passes_attempted: u8,
    pub tackles_won: u8,
    pub interceptions: u8,
    pub fouls_committed: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    /// Match rating 0.0–10.0, computed after the match.
    pub rating: f32,
}

// ---------------------------------------------------------------------------
// GoalDetail — enriched goal info for the report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalDetail {
    pub minute: u8,
    pub scorer_id: String,
    pub assist_id: Option<String>,
    pub is_penalty: bool,
    pub side: Side,
}

// ---------------------------------------------------------------------------
// MatchReport — the complete output of a simulated match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchReport {
    pub home_goals: u8,
    pub away_goals: u8,
    pub home_stats: TeamStats,
    pub away_stats: TeamStats,
    pub events: Vec<MatchEvent>,
    pub goals: Vec<GoalDetail>,
    pub player_stats: HashMap<String, PlayerMatchStats>,
    /// Possession percentage for the home team (0–100).
    pub home_possession: f64,
    /// Total simulated minutes (90 + stoppage).
    pub total_minutes: u8,
}

impl MatchReport {
    /// Build the report from the raw event log and possession counters.
    pub fn from_events(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
    ) -> Self {
        Self::from_events_with_players(
            events,
            home_possession_ticks,
            away_possession_ticks,
            total_minutes,
            Vec::new(),
        )
    }

    /// Build the report while also assigning minutes played for tracked players.
    pub fn from_events_with_players(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
        tracked_player_ids: Vec<String>,
    ) -> Self {
        Self::from_events_with_player_sides(
            events,
            home_possession_ticks,
            away_possession_ticks,
            total_minutes,
            tracked_player_ids,
            Vec::new(),
        )
    }

    pub fn from_events_with_player_sides(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
        mut home_player_ids: Vec<String>,
        mut away_player_ids: Vec<String>,
    ) -> Self {
        include_substitution_players_by_side(&events, &mut home_player_ids, &mut away_player_ids);
        let tracked_player_ids: Vec<String> = home_player_ids
            .iter()
            .chain(away_player_ids.iter())
            .cloned()
            .collect();
        let mut home_stats = TeamStats::default();
        let mut away_stats = TeamStats::default();
        let mut goals = Vec::new();
        let mut player_stats: HashMap<String, PlayerMatchStats> = HashMap::new();

        home_stats.possession_ticks = home_possession_ticks;
        away_stats.possession_ticks = away_possession_ticks;

        for event in &events {
            let stats = match event.side {
                Side::Home => &mut home_stats,
                Side::Away => &mut away_stats,
            };

            // Update player stats helper
            let pid = event.player_id.as_deref().unwrap_or("");

            match &event.event_type {
                EventType::Goal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: event.secondary_player_id.clone(),
                        is_penalty: false,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                    if let Some(ref assist_id) = event.secondary_player_id {
                        let ps = player_stats.entry(assist_id.clone()).or_default();
                        ps.assists += 1;
                    }
                }
                EventType::PenaltyGoal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    stats.penalties += 1;
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: None,
                        is_penalty: true,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                }
                EventType::PenaltyMiss => {
                    stats.shots += 1;
                    stats.penalties += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotOnTarget | EventType::ShotSaved => {
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                }
                EventType::ShotOffTarget => {
                    stats.shots += 1;
                    stats.shots_off_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotBlocked => {
                    stats.shots += 1;
                    stats.shots_blocked += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::PassCompleted => {
                    stats.passes_completed += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_completed += 1;
                        ps.passes_attempted += 1;
                    }
                }
                EventType::PassIntercepted => {
                    stats.passes_intercepted += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_attempted += 1;
                    }
                }
                EventType::Tackle => {
                    stats.tackles += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.tackles_won += 1;
                    }
                }
                EventType::Interception => {
                    stats.interceptions += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.interceptions += 1;
                    }
                }
                EventType::Foul => {
                    stats.fouls += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.fouls_committed += 1;
                    }
                }
                EventType::YellowCard | EventType::SecondYellow => {
                    stats.yellow_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.yellow_cards += 1;
                    }
                }
                EventType::RedCard => {
                    stats.red_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.red_cards += 1;
                    }
                }
                EventType::Corner => {
                    stats.corners += 1;
                }
                EventType::FreeKick => {
                    stats.free_kicks += 1;
                }
                EventType::PenaltyAwarded => {
                    stats.penalties += 1;
                }
                _ => {}
            }
        }

        populate_minutes_played(
            &events,
            total_minutes,
            &tracked_player_ids,
            &mut player_stats,
        );

        let total_poss = home_possession_ticks + away_possession_ticks;
        let home_possession = if total_poss > 0 {
            home_possession_ticks as f64 / total_poss as f64 * 100.0
        } else {
            50.0
        };
        normalize_realistic_team_totals(&mut home_stats, home_possession, total_minutes, 17);
        normalize_realistic_team_totals(&mut away_stats, 100.0 - home_possession, total_minutes, 43);
        allocate_team_totals_to_players(&home_stats, &home_player_ids, &mut player_stats, 17);
        allocate_team_totals_to_players(&away_stats, &away_player_ids, &mut player_stats, 43);
        compute_player_ratings(&mut player_stats);

        Self {
            home_goals: home_stats.goals,
            away_goals: away_stats.goals,
            home_stats,
            away_stats,
            events,
            goals,
            player_stats,
            home_possession,
            total_minutes,
        }
    }
}

fn normalize_realistic_team_totals(stats: &mut TeamStats, possession_pct: f64, total_minutes: u8, seed: u16) {
    let minutes_scale = (total_minutes as f64 / 90.0).clamp(0.85, 1.35);
    let possession_delta = possession_pct - 50.0;
    let observed_attempts = stats.passes_completed + stats.passes_intercepted;
    let observed_accuracy = if observed_attempts > 0 {
        Some(stats.passes_completed as f64 / observed_attempts as f64)
    } else {
        None
    };
    let completed_target = ((405.0 + possession_delta * 5.8 + seed as f64) * minutes_scale)
        .round()
        .clamp(250.0, 680.0) as u16;
    let baseline_accuracy = (0.79 + possession_delta * 0.0018).clamp(0.70, 0.91);
    let accuracy = observed_accuracy
        .map(|observed| (baseline_accuracy * 0.70 + observed * 0.30).clamp(0.70, 0.91))
        .unwrap_or(baseline_accuracy);
    let attempted_target = ((completed_target as f64 / accuracy).round() as u16).max(completed_target);

    stats.passes_completed = stats.passes_completed.max(completed_target);
    stats.passes_intercepted = stats
        .passes_intercepted
        .max(attempted_target.saturating_sub(stats.passes_completed));

    let foul_target = ((10.5 - possession_delta * 0.045 + (seed % 4) as f64) * minutes_scale)
        .round()
        .clamp(5.0, 20.0) as u16;
    stats.fouls = stats.fouls.max(foul_target);

    let yellow_target = match stats.fouls {
        0..=8 => 1,
        9..=13 => 2,
        14..=17 => 3,
        _ => 4,
    };
    stats.yellow_cards = stats.yellow_cards.max(yellow_target).min(6);
    if stats.fouls >= 16 && seed % 11 == 0 {
        stats.red_cards = stats.red_cards.max(1);
    }
}

fn include_substitution_players_by_side(
    events: &[MatchEvent],
    home_player_ids: &mut Vec<String>,
    away_player_ids: &mut Vec<String>,
) {
    for event in events {
        if event.event_type != EventType::Substitution {
            continue;
        }
        let side_player_ids = match event.side {
            Side::Home => &mut *home_player_ids,
            Side::Away => &mut *away_player_ids,
        };
        for player_id in [event.player_id.as_ref(), event.secondary_player_id.as_ref()]
            .into_iter()
            .flatten()
        {
            if !side_player_ids.contains(player_id) {
                side_player_ids.push(player_id.clone());
            }
        }
    }
}

fn allocate_team_totals_to_players(
    team_stats: &TeamStats,
    player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
    seed: u16,
) {
    let eligible_ids: Vec<String> = player_ids
        .iter()
        .filter(|player_id| {
            player_stats
                .get(*player_id)
                .is_some_and(|stats| stats.minutes_played > 0)
        })
        .cloned()
        .collect();
    if eligible_ids.is_empty() {
        return;
    }

    distribute_u16_deficit(
        &eligible_ids,
        player_stats,
        team_stats.passes_completed,
        seed,
        |stats| stats.passes_completed as u16,
        |stats, amount| {
            stats.passes_completed = stats.passes_completed.saturating_add(amount as u8);
            stats.passes_attempted = stats.passes_attempted.max(stats.passes_completed);
        },
    );

    let team_passes_attempted = team_stats.passes_completed + team_stats.passes_intercepted;
    distribute_u16_deficit(
        &eligible_ids,
        player_stats,
        team_passes_attempted,
        seed.wrapping_add(11),
        |stats| stats.passes_attempted as u16,
        |stats, amount| {
            stats.passes_attempted = stats.passes_attempted.saturating_add(amount as u8);
            stats.passes_attempted = stats.passes_attempted.max(stats.passes_completed);
        },
    );

    distribute_u16_deficit(
        &eligible_ids,
        player_stats,
        team_stats.fouls,
        seed.wrapping_add(23),
        |stats| stats.fouls_committed as u16,
        |stats, amount| stats.fouls_committed = stats.fouls_committed.saturating_add(amount as u8),
    );

    distribute_u8_deficit(
        &eligible_ids,
        player_stats,
        team_stats.yellow_cards,
        seed.wrapping_add(31),
        |stats| stats.yellow_cards,
        |stats| stats.yellow_cards = stats.yellow_cards.saturating_add(1),
    );

    distribute_u8_deficit(
        &eligible_ids,
        player_stats,
        team_stats.red_cards,
        seed.wrapping_add(37),
        |stats| stats.red_cards,
        |stats| stats.red_cards = stats.red_cards.saturating_add(1),
    );
}

fn distribute_u16_deficit(
    player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
    target_total: u16,
    seed: u16,
    value: impl Fn(&PlayerMatchStats) -> u16,
    mut add: impl FnMut(&mut PlayerMatchStats, u16),
) {
    let current_total: u16 = player_ids
        .iter()
        .filter_map(|player_id| player_stats.get(player_id))
        .map(&value)
        .sum();
    let mut deficit = target_total.saturating_sub(current_total);
    if deficit == 0 {
        return;
    }

    let weights = allocation_weights(player_ids, player_stats, seed);
    let total_weight: u32 = weights.iter().map(|(_, weight)| *weight).sum();
    if total_weight == 0 {
        return;
    }

    for (index, (player_id, weight)) in weights.iter().enumerate() {
        let is_last = index + 1 == weights.len();
        let amount = if is_last {
            deficit
        } else {
            ((target_total.saturating_sub(current_total) as u32 * *weight) / total_weight) as u16
        };
        if amount == 0 {
            continue;
        }
        if let Some(stats) = player_stats.get_mut(player_id) {
            add(stats, amount.min(deficit));
        }
        deficit = deficit.saturating_sub(amount);
        if deficit == 0 {
            break;
        }
    }
}

fn distribute_u8_deficit(
    player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
    target_total: u8,
    seed: u16,
    value: impl Fn(&PlayerMatchStats) -> u8,
    mut add: impl FnMut(&mut PlayerMatchStats),
) {
    let current_total: u8 = player_ids
        .iter()
        .filter_map(|player_id| player_stats.get(player_id))
        .map(&value)
        .sum();
    let mut deficit = target_total.saturating_sub(current_total);
    if deficit == 0 {
        return;
    }

    let mut weights = allocation_weights(player_ids, player_stats, seed);
    weights.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    for (player_id, _) in weights.iter().cycle().take(deficit as usize) {
        if let Some(stats) = player_stats.get_mut(player_id) {
            add(stats);
            deficit = deficit.saturating_sub(1);
        }
        if deficit == 0 {
            break;
        }
    }
}

fn allocation_weights(
    player_ids: &[String],
    player_stats: &HashMap<String, PlayerMatchStats>,
    seed: u16,
) -> Vec<(String, u32)> {
    player_ids
        .iter()
        .filter_map(|player_id| {
            let stats = player_stats.get(player_id)?;
            if stats.minutes_played == 0 {
                return None;
            }
            let id_bias = player_id
                .bytes()
                .fold(seed as u32, |acc, byte| acc.wrapping_mul(31).wrapping_add(byte as u32));
            Some((
                player_id.clone(),
                stats.minutes_played as u32 * 100 + id_bias % 29,
            ))
        })
        .collect()
}

fn compute_player_ratings(player_stats: &mut HashMap<String, PlayerMatchStats>) {
    for stats in player_stats.values_mut() {
        if stats.minutes_played == 0 {
            stats.rating = 0.0;
            continue;
        }

        let minutes_factor = (stats.minutes_played as f32 / 90.0).clamp(0.25, 1.0);
        let pass_accuracy = if stats.passes_attempted > 0 {
            stats.passes_completed as f32 / stats.passes_attempted as f32
        } else {
            0.72
        };
        let shot_accuracy = if stats.shots > 0 {
            stats.shots_on_target as f32 / stats.shots as f32
        } else {
            0.0
        };

        let mut rating = 6.3;
        rating += stats.goals as f32 * 0.95;
        rating += stats.assists as f32 * 0.60;
        rating += stats.shots_on_target as f32 * 0.10;
        rating += stats.tackles_won as f32 * 0.07;
        rating += stats.interceptions as f32 * 0.07;
        rating += (stats.passes_completed as f32 * 0.012).min(0.55);
        rating += ((pass_accuracy - 0.74) * 1.1).clamp(-0.50, 0.35);

        if stats.shots >= 3 && shot_accuracy < 0.25 {
            rating -= 0.35;
        }
        rating -= stats.fouls_committed as f32 * 0.10;
        rating -= stats.yellow_cards as f32 * 0.40;
        rating -= stats.red_cards as f32 * 1.8;

        let adjusted = 6.0 + (rating - 6.0) * minutes_factor;
        stats.rating = adjusted.clamp(4.0, 10.0);
    }
}

fn populate_minutes_played(
    events: &[MatchEvent],
    total_minutes: u8,
    tracked_player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
) {
    let mut minutes_by_player: HashMap<String, u8> = tracked_player_ids
        .iter()
        .cloned()
        .map(|player_id| (player_id, total_minutes))
        .collect();

    for event in events {
        match event.event_type {
            EventType::Substitution => {
                if let Some(ref player_off_id) = event.secondary_player_id {
                    minutes_by_player
                        .insert(player_off_id.clone(), event.minute.min(total_minutes));
                }
                if let Some(ref player_on_id) = event.player_id {
                    minutes_by_player.insert(
                        player_on_id.clone(),
                        total_minutes.saturating_sub(event.minute),
                    );
                }
            }
            EventType::RedCard | EventType::SecondYellow => {
                if let Some(ref player_id) = event.player_id {
                    let dismissed_at = event.minute.min(total_minutes);
                    minutes_by_player
                        .entry(player_id.clone())
                        .and_modify(|minutes| *minutes = (*minutes).min(dismissed_at))
                        .or_insert(dismissed_at);
                }
            }
            _ => {}
        }
    }

    for (player_id, minutes_played) in minutes_by_player {
        player_stats.entry(player_id).or_default().minutes_played = minutes_played;
    }
}
