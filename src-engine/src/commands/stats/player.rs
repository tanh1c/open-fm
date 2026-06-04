use std::collections::HashMap;

use domain::player::{Player, PlayerSeasonStats, Position};
use domain::stats::PlayerMatchStatsRecord;
use ofm_core::state::StateManager;

use super::dto::{
    PlayerAdvancedMetricDto, PlayerAdvancedPassMetricDto, PlayerMatchHistoryEntryDto,
    PlayerSeasonTotalsDto, PlayerStatsOverviewDto, PlayerStatsOverviewMetricsDto,
};
use super::shared::{
    calculate_pass_accuracy, calculate_per90, competition_label, opponent_name, percentile_rank,
};

const DEFAULT_MINIMUM_MINUTES: u32 = 180;
const DEFAULT_MINIMUM_COHORT_SIZE: usize = 3;

#[derive(Debug, Clone, Default)]
struct PlayerAggregate {
    minutes_played: u32,
    shots: u32,
    shots_on_target: u32,
    passes_completed: u32,
    passes_attempted: u32,
    tackles_won: u32,
    interceptions: u32,
    fouls_committed: u32,
}

fn position_key(player: &Player) -> &Position {
    &player.natural_position
}

fn aggregate_from_history(records: &[PlayerMatchStatsRecord]) -> Option<PlayerAggregate> {
    if records.is_empty() {
        return None;
    }

    let mut aggregate = PlayerAggregate::default();
    for record in records {
        aggregate.minutes_played += record.minutes_played as u32;
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

fn aggregate_from_season_stats(stats: &PlayerSeasonStats) -> PlayerAggregate {
    PlayerAggregate {
        minutes_played: stats.minutes_played,
        shots: stats.shots,
        shots_on_target: stats.shots_on_target,
        passes_completed: stats.passes_completed,
        passes_attempted: stats.passes_attempted,
        tackles_won: stats.tackles_won,
        interceptions: stats.interceptions,
        fouls_committed: stats.fouls_committed,
    }
}

fn metric_percentile<F>(
    peers: &[&PlayerAggregate],
    selector: F,
    player_aggregate: &PlayerAggregate,
) -> Option<u32>
where
    F: Fn(&PlayerAggregate) -> Option<f32>,
{
    let values = peers
        .iter()
        .filter_map(|aggregate| selector(aggregate))
        .collect::<Vec<_>>();

    percentile_rank(&values, selector(player_aggregate))
}

fn season_totals_from_history(records: &[PlayerMatchStatsRecord]) -> Option<PlayerSeasonTotalsDto> {
    if records.is_empty() {
        return None;
    }

    let appearances = records.iter().filter(|record| record.minutes_played > 0).count() as u32;
    let rating_count = records.iter().filter(|record| record.rating > 0.0).count() as f32;
    let rating_total = records.iter().map(|record| record.rating).sum::<f32>();

    Some(PlayerSeasonTotalsDto {
        appearances,
        goals: records.iter().map(|record| record.goals as u32).sum(),
        assists: records.iter().map(|record| record.assists as u32).sum(),
        clean_sheets: 0,
        yellow_cards: records.iter().map(|record| record.yellow_cards as u32).sum(),
        red_cards: records.iter().map(|record| record.red_cards as u32).sum(),
        avg_rating: if rating_count > 0.0 { rating_total / rating_count } else { 0.0 },
        minutes_played: records.iter().map(|record| record.minutes_played as u32).sum(),
        shots: records.iter().map(|record| record.shots as u32).sum(),
        shots_on_target: records.iter().map(|record| record.shots_on_target as u32).sum(),
        passes_completed: records.iter().map(|record| record.passes_completed as u32).sum(),
        passes_attempted: records.iter().map(|record| record.passes_attempted as u32).sum(),
        tackles_won: records.iter().map(|record| record.tackles_won as u32).sum(),
        interceptions: records.iter().map(|record| record.interceptions as u32).sum(),
        fouls_committed: records.iter().map(|record| record.fouls_committed as u32).sum(),
    })
}

fn season_totals_from_season_stats(stats: &PlayerSeasonStats) -> PlayerSeasonTotalsDto {
    PlayerSeasonTotalsDto {
        appearances: stats.appearances,
        goals: stats.goals,
        assists: stats.assists,
        clean_sheets: stats.clean_sheets,
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
        avg_rating: stats.avg_rating,
        minutes_played: stats.minutes_played,
        shots: stats.shots,
        shots_on_target: stats.shots_on_target,
        passes_completed: stats.passes_completed,
        passes_attempted: stats.passes_attempted,
        tackles_won: stats.tackles_won,
        interceptions: stats.interceptions,
        fouls_committed: stats.fouls_committed,
    }
}

fn build_overview_from_aggregate(
    player_aggregate: &PlayerAggregate,
    peers: &[PlayerAggregate],
    season_totals: Option<PlayerSeasonTotalsDto>,
) -> PlayerStatsOverviewDto {
    let eligible_peers = peers
        .iter()
        .filter(|aggregate| aggregate.minutes_played >= DEFAULT_MINIMUM_MINUTES)
        .collect::<Vec<_>>();
    let can_compute_percentiles = player_aggregate.minutes_played >= DEFAULT_MINIMUM_MINUTES
        && eligible_peers.len() >= DEFAULT_MINIMUM_COHORT_SIZE;

    PlayerStatsOverviewDto {
        percentile_eligible: can_compute_percentiles,
        season_totals,
        metrics: PlayerStatsOverviewMetricsDto {
            shots: PlayerAdvancedMetricDto {
                total: player_aggregate.shots,
                per90: calculate_per90(player_aggregate.shots, player_aggregate.minutes_played),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| calculate_per90(aggregate.shots, aggregate.minutes_played),
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
            shots_on_target: PlayerAdvancedMetricDto {
                total: player_aggregate.shots_on_target,
                per90: calculate_per90(
                    player_aggregate.shots_on_target,
                    player_aggregate.minutes_played,
                ),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| {
                            calculate_per90(aggregate.shots_on_target, aggregate.minutes_played)
                        },
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
            passes: PlayerAdvancedPassMetricDto {
                completed: player_aggregate.passes_completed,
                attempted: player_aggregate.passes_attempted,
                accuracy: calculate_pass_accuracy(
                    player_aggregate.passes_completed,
                    player_aggregate.passes_attempted,
                ),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| {
                            calculate_pass_accuracy(
                                aggregate.passes_completed,
                                aggregate.passes_attempted,
                            )
                        },
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
            tackles_won: PlayerAdvancedMetricDto {
                total: player_aggregate.tackles_won,
                per90: calculate_per90(
                    player_aggregate.tackles_won,
                    player_aggregate.minutes_played,
                ),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| {
                            calculate_per90(aggregate.tackles_won, aggregate.minutes_played)
                        },
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
            interceptions: PlayerAdvancedMetricDto {
                total: player_aggregate.interceptions,
                per90: calculate_per90(
                    player_aggregate.interceptions,
                    player_aggregate.minutes_played,
                ),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| {
                            calculate_per90(aggregate.interceptions, aggregate.minutes_played)
                        },
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
            fouls_committed: PlayerAdvancedMetricDto {
                total: player_aggregate.fouls_committed,
                per90: calculate_per90(
                    player_aggregate.fouls_committed,
                    player_aggregate.minutes_played,
                ),
                percentile: if can_compute_percentiles {
                    metric_percentile(
                        &eligible_peers,
                        |aggregate| {
                            calculate_per90(aggregate.fouls_committed, aggregate.minutes_played)
                        },
                        player_aggregate,
                    )
                } else {
                    None
                },
            },
        },
    }
}

fn build_history_overview(
    state: &StateManager,
    player_id: &str,
) -> Result<Option<PlayerStatsOverviewDto>, String> {
    let game = state
        .get_game(|game| game.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;
    let Some(player) = game
        .players
        .iter()
        .find(|candidate| candidate.id == player_id)
    else {
        return Err("be.error.playerNotFound".to_string());
    };
    let target_position = position_key(player).clone();
    let same_position_ids = game
        .players
        .iter()
        .filter(|candidate| *position_key(candidate) == target_position)
        .map(|candidate| candidate.id.clone())
        .collect::<Vec<_>>();

    let Some((history_aggregates, player_records)) = state.get_stats_state(|stats| {
        let mut records_by_player: HashMap<String, Vec<PlayerMatchStatsRecord>> = HashMap::new();

        for record in &stats.player_matches {
            if same_position_ids
                .iter()
                .any(|candidate_id| candidate_id == &record.player_id)
            {
                records_by_player
                    .entry(record.player_id.clone())
                    .or_default()
                    .push(record.clone());
            }
        }

        let player_records = records_by_player.get(player_id).cloned().unwrap_or_default();
        let aggregates = records_by_player
            .into_iter()
            .filter_map(|(candidate_id, records)| {
                aggregate_from_history(&records).map(|aggregate| (candidate_id, aggregate))
            })
            .collect::<HashMap<_, _>>();

        (aggregates, player_records)
    }) else {
        return Ok(None);
    };

    let Some(player_aggregate) = history_aggregates.get(player_id) else {
        return Ok(None);
    };

    let peers = same_position_ids
        .iter()
        .filter_map(|candidate_id| history_aggregates.get(candidate_id).cloned())
        .collect::<Vec<_>>();

    Ok(Some(build_overview_from_aggregate(
        player_aggregate,
        &peers,
        season_totals_from_history(&player_records),
    )))
}

fn build_legacy_overview(
    state: &StateManager,
    player_id: &str,
) -> Result<PlayerStatsOverviewDto, String> {
    let game = state
        .get_game(|game| game.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;
    let Some(player) = game
        .players
        .iter()
        .find(|candidate| candidate.id == player_id)
    else {
        return Err("be.error.playerNotFound".to_string());
    };
    let target_position = position_key(player).clone();
    let peers = game
        .players
        .iter()
        .filter(|candidate| *position_key(candidate) == target_position)
        .map(|candidate| aggregate_from_season_stats(&candidate.stats))
        .collect::<Vec<_>>();

    Ok(build_overview_from_aggregate(
        &aggregate_from_season_stats(&player.stats),
        &peers,
        Some(season_totals_from_season_stats(&player.stats)),
    ))
}

fn to_dto(state: &StateManager, record: &PlayerMatchStatsRecord) -> PlayerMatchHistoryEntryDto {
    let team_goals = if record.team_id == record.home_team_id {
        record.home_goals
    } else {
        record.away_goals
    };
    let opponent_goals = if record.team_id == record.home_team_id {
        record.away_goals
    } else {
        record.home_goals
    };

    PlayerMatchHistoryEntryDto {
        fixture_id: record.fixture_id.clone(),
        date: record.date.clone(),
        competition: competition_label(&record.competition),
        matchday: record.matchday,
        opponent_team_id: record.opponent_team_id.clone(),
        opponent_name: opponent_name(state, &record.opponent_team_id),
        team_goals,
        opponent_goals,
        minutes_played: record.minutes_played,
        goals: record.goals,
        assists: record.assists,
        shots: record.shots,
        shots_on_target: record.shots_on_target,
        passes_completed: record.passes_completed,
        passes_attempted: record.passes_attempted,
        tackles_won: record.tackles_won,
        interceptions: record.interceptions,
        fouls_committed: record.fouls_committed,
        yellow_cards: record.yellow_cards,
        red_cards: record.red_cards,
        rating: record.rating,
    }
}

pub(super) fn get_player_match_history_internal(
    state: &StateManager,
    player_id: &str,
    limit: Option<usize>,
) -> Result<Vec<PlayerMatchHistoryEntryDto>, String> {
    let Some(mut history) = state.get_stats_state(|stats| {
        stats
            .player_matches
            .iter()
            .filter(|record| record.player_id == player_id)
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
        .map(|record| to_dto(state, &record))
        .collect())
}

pub(super) fn get_player_stats_overview_internal(
    state: &StateManager,
    player_id: &str,
) -> Result<PlayerStatsOverviewDto, String> {
    if let Some(overview) = build_history_overview(state, player_id)? {
        return Ok(overview);
    }

    build_legacy_overview(state, player_id)
}
