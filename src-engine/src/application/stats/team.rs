use std::collections::{HashMap, HashSet};

use domain::stats::{PlayerMatchStatsRecord, TeamMatchStatsRecord};
use ofm_core::state::StateManager;

use super::dto::{
    PlayerSeasonTotalsDto, TeamAdvancedMetricDto, TeamAdvancedPassMetricDto,
    TeamMatchHistoryEntryDto, TeamProfileStatsDto, TeamStatsOverviewDto,
    TeamStatsOverviewMetricsDto,
};
use super::shared::{
    calculate_average, calculate_pass_accuracy, competition_label, ensure_team_exists,
    opponent_name,
};

#[derive(Debug, Clone, Default)]
struct TeamAggregate {
    matches_played: u32,
    goals_for: u32,
    goals_against: u32,
    possession_total: u32,
    shots: u32,
    shots_on_target: u32,
    passes_completed: u32,
    passes_attempted: u32,
    tackles_won: u32,
    interceptions: u32,
    fouls_committed: u32,
}

#[derive(Debug, Clone, Default)]
struct PlayerTotalsAccumulator {
    appearances: u32,
    goals: u32,
    assists: u32,
    yellow_cards: u32,
    red_cards: u32,
    rating_total: f32,
    rating_count: u32,
    minutes_played: u32,
    shots: u32,
    shots_on_target: u32,
    passes_completed: u32,
    passes_attempted: u32,
    tackles_won: u32,
    interceptions: u32,
    fouls_committed: u32,
}

fn aggregate_team_history(records: &[TeamMatchStatsRecord]) -> Option<TeamAggregate> {
    if records.is_empty() {
        return None;
    }

    let mut aggregate = TeamAggregate::default();
    for record in records {
        aggregate.matches_played += 1;
        aggregate.goals_for += record.goals_for as u32;
        aggregate.goals_against += record.goals_against as u32;
        aggregate.possession_total += record.possession_pct as u32;
        aggregate.shots += record.shots as u32;
        aggregate.shots_on_target += record.shots_on_target as u32;
        aggregate.passes_completed += record.passes_completed as u32;
        aggregate.passes_attempted += record.passes_attempted as u32;
        aggregate.tackles_won += record.tackles_won as u32;
        aggregate.interceptions += record.interceptions as u32;
        aggregate.fouls_committed += record.fouls_committed as u32;
    }

    Some(aggregate)
}

fn build_team_overview(aggregate: &TeamAggregate) -> TeamStatsOverviewDto {
    TeamStatsOverviewDto {
        matches_played: aggregate.matches_played,
        goals_for: aggregate.goals_for,
        goals_against: aggregate.goals_against,
        goal_difference: aggregate.goals_for as i32 - aggregate.goals_against as i32,
        possession_average: calculate_average(aggregate.possession_total, aggregate.matches_played),
        metrics: TeamStatsOverviewMetricsDto {
            shots: TeamAdvancedMetricDto {
                total: aggregate.shots,
                per_match: calculate_average(aggregate.shots, aggregate.matches_played),
            },
            shots_on_target: TeamAdvancedMetricDto {
                total: aggregate.shots_on_target,
                per_match: calculate_average(aggregate.shots_on_target, aggregate.matches_played),
            },
            passes: TeamAdvancedPassMetricDto {
                completed: aggregate.passes_completed,
                attempted: aggregate.passes_attempted,
                accuracy: calculate_pass_accuracy(
                    aggregate.passes_completed,
                    aggregate.passes_attempted,
                ),
            },
            tackles_won: TeamAdvancedMetricDto {
                total: aggregate.tackles_won,
                per_match: calculate_average(aggregate.tackles_won, aggregate.matches_played),
            },
            interceptions: TeamAdvancedMetricDto {
                total: aggregate.interceptions,
                per_match: calculate_average(aggregate.interceptions, aggregate.matches_played),
            },
            fouls_committed: TeamAdvancedMetricDto {
                total: aggregate.fouls_committed,
                per_match: calculate_average(aggregate.fouls_committed, aggregate.matches_played),
            },
        },
    }
}

fn add_player_record_to_totals(
    totals: &mut PlayerTotalsAccumulator,
    record: &PlayerMatchStatsRecord,
) {
    if record.minutes_played > 0 {
        totals.appearances += 1;
    }
    totals.goals += record.goals as u32;
    totals.assists += record.assists as u32;
    totals.yellow_cards += record.yellow_cards as u32;
    totals.red_cards += record.red_cards as u32;
    if record.rating > 0.0 && record.minutes_played > 0 {
        totals.rating_total += record.rating;
        totals.rating_count += 1;
    }
    totals.minutes_played += record.minutes_played as u32;
    totals.shots += record.shots as u32;
    totals.shots_on_target += record.shots_on_target as u32;
    totals.passes_completed += record.passes_completed as u32;
    totals.passes_attempted += record.passes_attempted as u32;
    totals.tackles_won += record.tackles_won as u32;
    totals.interceptions += record.interceptions as u32;
    totals.fouls_committed += record.fouls_committed as u32;
}

fn player_totals_to_dto(totals: PlayerTotalsAccumulator) -> PlayerSeasonTotalsDto {
    PlayerSeasonTotalsDto {
        appearances: totals.appearances,
        goals: totals.goals,
        assists: totals.assists,
        clean_sheets: 0,
        yellow_cards: totals.yellow_cards,
        red_cards: totals.red_cards,
        avg_rating: if totals.rating_count > 0 {
            totals.rating_total / totals.rating_count as f32
        } else {
            0.0
        },
        minutes_played: totals.minutes_played,
        shots: totals.shots,
        shots_on_target: totals.shots_on_target,
        passes_completed: totals.passes_completed,
        passes_attempted: totals.passes_attempted,
        tackles_won: totals.tackles_won,
        interceptions: totals.interceptions,
        fouls_committed: totals.fouls_committed,
    }
}

fn to_team_history_dto(
    state: &StateManager,
    record: &TeamMatchStatsRecord,
) -> TeamMatchHistoryEntryDto {
    TeamMatchHistoryEntryDto {
        fixture_id: record.fixture_id.clone(),
        date: record.date.clone(),
        competition: competition_label(&record.competition),
        matchday: record.matchday,
        opponent_team_id: record.opponent_team_id.clone(),
        opponent_name: opponent_name(state, &record.opponent_team_id),
        goals_for: record.goals_for,
        goals_against: record.goals_against,
        possession_pct: record.possession_pct,
        shots: record.shots,
        shots_on_target: record.shots_on_target,
    }
}

pub fn get_team_stats_overview_internal(
    state: &StateManager,
    team_id: &str,
) -> Result<Option<TeamStatsOverviewDto>, String> {
    ensure_team_exists(state, team_id)?;

    let Some(records) = state.get_stats_state(|stats| {
        stats
            .team_matches
            .iter()
            .filter(|record| record.team_id == team_id)
            .cloned()
            .collect::<Vec<_>>()
    }) else {
        return Ok(None);
    };

    Ok(aggregate_team_history(&records).map(|aggregate| build_team_overview(&aggregate)))
}

pub fn get_team_match_history_internal(
    state: &StateManager,
    team_id: &str,
    limit: Option<usize>,
) -> Result<Vec<TeamMatchHistoryEntryDto>, String> {
    ensure_team_exists(state, team_id)?;

    let Some(mut history) = state.get_stats_state(|stats| {
        stats
            .team_matches
            .iter()
            .filter(|record| record.team_id == team_id)
            .cloned()
            .collect::<Vec<_>>()
    }) else {
        return Ok(Vec::new());
    };

    history.sort_by(|left, right| {
        right
            .date
            .cmp(&left.date)
            .then(right.matchday.cmp(&left.matchday))
            .then(right.fixture_id.cmp(&left.fixture_id))
    });

    let limit = limit.unwrap_or(5);
    Ok(history
        .into_iter()
        .take(limit)
        .map(|record| to_team_history_dto(state, &record))
        .collect())
}

pub fn get_team_profile_stats_internal(
    state: &StateManager,
    team_id: &str,
) -> Result<TeamProfileStatsDto, String> {
    ensure_team_exists(state, team_id)?;

    let roster_ids = state
        .get_game(|game| {
            game.players
                .iter()
                .filter(|player| player.team_id.as_deref() == Some(team_id))
                .map(|player| player.id.clone())
                .collect::<HashSet<_>>()
        })
        .ok_or("be.error.noActiveGameSession".to_string())?;

    let Some((team_records, roster_totals)) = state.get_stats_state(|stats| {
        let team_records = stats
            .team_matches
            .iter()
            .filter(|record| record.team_id == team_id)
            .cloned()
            .collect::<Vec<_>>();
        let mut roster_totals = HashMap::<String, PlayerTotalsAccumulator>::new();
        for record in &stats.player_matches {
            if roster_ids.contains(&record.player_id) {
                add_player_record_to_totals(
                    roster_totals.entry(record.player_id.clone()).or_default(),
                    record,
                );
            }
        }
        (team_records, roster_totals)
    }) else {
        return Ok(TeamProfileStatsDto {
            team_stats_overview: None,
            recent_matches: Vec::new(),
            roster_stats_by_player_id: HashMap::new(),
        });
    };

    let mut recent_records = team_records.clone();
    recent_records.sort_by(|left, right| {
        right
            .date
            .cmp(&left.date)
            .then(right.matchday.cmp(&left.matchday))
            .then(right.fixture_id.cmp(&left.fixture_id))
    });

    Ok(TeamProfileStatsDto {
        team_stats_overview: aggregate_team_history(&team_records)
            .map(|aggregate| build_team_overview(&aggregate)),
        recent_matches: recent_records
            .into_iter()
            .take(5)
            .map(|record| to_team_history_dto(state, &record))
            .collect(),
        roster_stats_by_player_id: roster_totals
            .into_iter()
            .map(|(player_id, totals)| (player_id, player_totals_to_dto(totals)))
            .collect(),
    })
}
