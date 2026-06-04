use std::collections::HashMap;

use domain::player::{Player, PlayerSeasonStats, Position};
use domain::stats::PlayerMatchStatsRecord;
use ofm_core::state::StateManager;

use super::dto::{
    PlayerAdvancedMetricDto, PlayerAdvancedPassMetricDto, PlayerCompetitionStatsDto,
    PlayerMatchHistoryEntryDto, PlayerSeasonTotalsDto, PlayerStatsOverviewDto,
    PlayerStatsOverviewMetricsDto, PlayerTransferHistoryDto,
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

fn is_competitive_fixture(competition: &domain::league::FixtureCompetition) -> bool {
    !matches!(
        competition,
        domain::league::FixtureCompetition::Friendly
            | domain::league::FixtureCompetition::PreseasonTournament
    )
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

    let appearances = records
        .iter()
        .filter(|record| record.minutes_played > 0)
        .count() as u32;
    let rating_count = records.iter().filter(|record| record.rating > 0.0).count() as f32;
    let rating_total = records.iter().map(|record| record.rating).sum::<f32>();

    Some(PlayerSeasonTotalsDto {
        appearances,
        goals: records.iter().map(|record| record.goals as u32).sum(),
        assists: records.iter().map(|record| record.assists as u32).sum(),
        clean_sheets: 0,
        yellow_cards: records
            .iter()
            .map(|record| record.yellow_cards as u32)
            .sum(),
        red_cards: records.iter().map(|record| record.red_cards as u32).sum(),
        avg_rating: if rating_count > 0.0 {
            rating_total / rating_count
        } else {
            0.0
        },
        minutes_played: records
            .iter()
            .map(|record| record.minutes_played as u32)
            .sum(),
        shots: records.iter().map(|record| record.shots as u32).sum(),
        shots_on_target: records
            .iter()
            .map(|record| record.shots_on_target as u32)
            .sum(),
        passes_completed: records
            .iter()
            .map(|record| record.passes_completed as u32)
            .sum(),
        passes_attempted: records
            .iter()
            .map(|record| record.passes_attempted as u32)
            .sum(),
        tackles_won: records.iter().map(|record| record.tackles_won as u32).sum(),
        interceptions: records
            .iter()
            .map(|record| record.interceptions as u32)
            .sum(),
        fouls_committed: records
            .iter()
            .map(|record| record.fouls_committed as u32)
            .sum(),
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

fn add_record_to_totals(totals: &mut PlayerSeasonTotalsDto, record: &PlayerMatchStatsRecord) {
    let previous_rating_matches = if totals.avg_rating > 0.0 {
        totals.appearances
    } else {
        0
    };
    let record_played = u32::from(record.minutes_played > 0);
    let rating_matches =
        previous_rating_matches + u32::from(record.rating > 0.0 && record_played > 0);
    let rating_total = totals.avg_rating * previous_rating_matches as f32
        + if record.rating > 0.0 && record_played > 0 {
            record.rating
        } else {
            0.0
        };

    totals.appearances += record_played;
    totals.goals += record.goals as u32;
    totals.assists += record.assists as u32;
    totals.yellow_cards += record.yellow_cards as u32;
    totals.red_cards += record.red_cards as u32;
    totals.minutes_played += record.minutes_played as u32;
    totals.shots += record.shots as u32;
    totals.shots_on_target += record.shots_on_target as u32;
    totals.passes_completed += record.passes_completed as u32;
    totals.passes_attempted += record.passes_attempted as u32;
    totals.tackles_won += record.tackles_won as u32;
    totals.interceptions += record.interceptions as u32;
    totals.fouls_committed += record.fouls_committed as u32;
    totals.avg_rating = if rating_matches > 0 {
        rating_total / rating_matches as f32
    } else {
        0.0
    };
}

fn team_name(state: &StateManager, team_id: &str) -> String {
    state
        .get_game(|game| {
            game.teams
                .iter()
                .find(|team| team.id == team_id)
                .map(|team| team.name.clone())
        })
        .flatten()
        .unwrap_or_else(|| team_id.to_string())
}

fn competition_name(state: &StateManager, record: &PlayerMatchStatsRecord) -> String {
    state
        .get_game(|game| {
            game.competitions
                .iter()
                .find(|competition| {
                    competition
                        .fixtures
                        .iter()
                        .any(|fixture| fixture.id == record.fixture_id)
                })
                .map(|competition| competition.name.clone())
                .or_else(|| {
                    game.league.as_ref().and_then(|league| {
                        league
                            .fixtures
                            .iter()
                            .any(|fixture| fixture.id == record.fixture_id)
                            .then(|| league.name.clone())
                    })
                })
        })
        .flatten()
        .unwrap_or_else(|| competition_label(&record.competition))
}

fn competition_stats_from_history(
    state: &StateManager,
    records: &[PlayerMatchStatsRecord],
) -> Vec<PlayerCompetitionStatsDto> {
    let mut grouped: HashMap<(String, String), PlayerCompetitionStatsDto> = HashMap::new();

    for record in records {
        let competition = competition_name(state, record);
        let key = (competition.clone(), record.team_id.clone());
        let entry = grouped
            .entry(key)
            .or_insert_with(|| PlayerCompetitionStatsDto {
                competition: competition.clone(),
                team_id: record.team_id.clone(),
                team_name: team_name(state, &record.team_id),
                totals: PlayerSeasonTotalsDto {
                    appearances: 0,
                    goals: 0,
                    assists: 0,
                    clean_sheets: 0,
                    yellow_cards: 0,
                    red_cards: 0,
                    avg_rating: 0.0,
                    minutes_played: 0,
                    shots: 0,
                    shots_on_target: 0,
                    passes_completed: 0,
                    passes_attempted: 0,
                    tackles_won: 0,
                    interceptions: 0,
                    fouls_committed: 0,
                },
            });
        add_record_to_totals(&mut entry.totals, record);
    }

    let mut rows = grouped.into_values().collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        left.competition
            .cmp(&right.competition)
            .then(left.team_name.cmp(&right.team_name))
    });
    rows
}

fn transfer_history_for_player(
    state: &StateManager,
    player_id: &str,
) -> Vec<PlayerTransferHistoryDto> {
    let Some(transfers) = state.get_game(|game| {
        let mut rows = game
            .competitions
            .iter()
            .flat_map(|competition| competition.transfer_log.iter())
            .filter(|transfer| transfer.player_id == player_id)
            .map(|transfer| PlayerTransferHistoryDto {
                date: transfer.date.clone(),
                from_team_id: transfer.from_team_id.clone(),
                from_team_name: game
                    .teams
                    .iter()
                    .find(|team| team.id == transfer.from_team_id)
                    .map(|team| team.name.clone())
                    .unwrap_or_else(|| transfer.from_team_id.clone()),
                to_team_id: transfer.to_team_id.clone(),
                to_team_name: game
                    .teams
                    .iter()
                    .find(|team| team.id == transfer.to_team_id)
                    .map(|team| team.name.clone())
                    .unwrap_or_else(|| transfer.to_team_id.clone()),
                fee: transfer.fee,
            })
            .collect::<Vec<_>>();

        if let Some(league) = &game.league {
            rows.extend(
                league
                    .transfer_log
                    .iter()
                    .filter(|transfer| transfer.player_id == player_id)
                    .map(|transfer| PlayerTransferHistoryDto {
                        date: transfer.date.clone(),
                        from_team_id: transfer.from_team_id.clone(),
                        from_team_name: game
                            .teams
                            .iter()
                            .find(|team| team.id == transfer.from_team_id)
                            .map(|team| team.name.clone())
                            .unwrap_or_else(|| transfer.from_team_id.clone()),
                        to_team_id: transfer.to_team_id.clone(),
                        to_team_name: game
                            .teams
                            .iter()
                            .find(|team| team.id == transfer.to_team_id)
                            .map(|team| team.name.clone())
                            .unwrap_or_else(|| transfer.to_team_id.clone()),
                        fee: transfer.fee,
                    }),
            );
        }

        rows.sort_by(|left, right| right.date.cmp(&left.date));
        rows.dedup_by(|left, right| {
            left.date == right.date
                && left.from_team_id == right.from_team_id
                && left.to_team_id == right.to_team_id
                && left.fee == right.fee
        });
        rows
    }) else {
        return Vec::new();
    };

    transfers
}

fn build_overview_from_aggregate(
    player_aggregate: &PlayerAggregate,
    peers: &[PlayerAggregate],
    season_totals: Option<PlayerSeasonTotalsDto>,
    competition_stats: Vec<PlayerCompetitionStatsDto>,
    transfer_history: Vec<PlayerTransferHistoryDto>,
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
        competition_stats,
        transfer_history,
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

        let player_records = records_by_player
            .get(player_id)
            .cloned()
            .unwrap_or_default();
        let aggregates = records_by_player
            .into_iter()
            .filter_map(|(candidate_id, records)| {
                let competitive_records = records
                    .into_iter()
                    .filter(|record| is_competitive_fixture(&record.competition))
                    .collect::<Vec<_>>();
                aggregate_from_history(&competitive_records)
                    .map(|aggregate| (candidate_id, aggregate))
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

    let competitive_player_records = player_records
        .iter()
        .filter(|record| is_competitive_fixture(&record.competition))
        .cloned()
        .collect::<Vec<_>>();

    Ok(Some(build_overview_from_aggregate(
        player_aggregate,
        &peers,
        season_totals_from_history(&competitive_player_records),
        competition_stats_from_history(state, &player_records),
        transfer_history_for_player(state, player_id),
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

    let season_totals = season_totals_from_season_stats(&player.stats);

    Ok(build_overview_from_aggregate(
        &aggregate_from_season_stats(&player.stats),
        &peers,
        Some(season_totals.clone()),
        vec![PlayerCompetitionStatsDto {
            competition: "All Competitions".to_string(),
            team_id: player.team_id.clone().unwrap_or_default(),
            team_name: player
                .team_id
                .as_deref()
                .map(|team_id| team_name(state, team_id))
                .unwrap_or_else(|| "Free Agent".to_string()),
            totals: season_totals,
        }],
        transfer_history_for_player(state, player_id),
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
        competition: competition_name(state, record),
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

pub fn get_player_match_history_internal(
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

pub fn get_player_stats_overview_internal(
    state: &StateManager,
    player_id: &str,
) -> Result<PlayerStatsOverviewDto, String> {
    if let Some(overview) = build_history_overview(state, player_id)? {
        return Ok(overview);
    }

    build_legacy_overview(state, player_id)
}
