use domain::league::{CompactTeamMatchStats, Fixture, FixtureStatus};
use domain::stats::{PlayerMatchStatsRecord, TeamMatchStatsRecord};
use ofm_core::game::Game;
use ofm_core::state::StateManager;

use super::dto::{
    MatchDetailDto, MatchDetailEventDto, MatchDetailPlayerStatsDto, MatchDetailTeamStatsDto,
};
use super::shared::competition_label;

pub fn get_match_detail_internal(
    state: &StateManager,
    fixture_id: &str,
) -> Result<Option<MatchDetailDto>, String> {
    let fixture_context = state
        .get_game(|game| {
            let fixture = find_fixture(game, fixture_id)?.clone();
            Some((
                fixture.clone(),
                team_name(game, &fixture.home_team_id),
                team_name(game, &fixture.away_team_id),
            ))
        })
        .ok_or("be.error.noActiveGameSession".to_string())?;

    let Some((fixture, home_team_name, away_team_name)) = fixture_context else {
        return Ok(None);
    };

    if fixture.status != FixtureStatus::Completed {
        return Ok(None);
    }

    let Some(result) = fixture.result.as_ref() else {
        return Ok(None);
    };

    let (team_records, mut player_records) = state
        .get_stats_state(|stats| {
            (
                stats
                    .team_matches
                    .iter()
                    .filter(|record| record.fixture_id == fixture_id)
                    .cloned()
                    .collect::<Vec<_>>(),
                stats
                    .player_matches
                    .iter()
                    .filter(|record| record.fixture_id == fixture_id)
                    .cloned()
                    .collect::<Vec<_>>(),
            )
        })
        .unwrap_or_default();

    player_records.sort_by(|left, right| {
        side_rank(&left.team_id, &fixture.home_team_id)
            .cmp(&side_rank(&right.team_id, &fixture.home_team_id))
            .then(right.minutes_played.cmp(&left.minutes_played))
            .then_with(|| {
                player_name(state, &left.player_id).cmp(&player_name(state, &right.player_id))
            })
    });

    let report = result.report.as_ref();
    let events = report
        .map(|report| {
            report
                .events
                .iter()
                .map(|event| MatchDetailEventDto {
                    minute: event.minute,
                    event_type: event.event_type.clone(),
                    side: event.side.clone(),
                    player_id: event.player_id.clone(),
                    player_name: event.player_id.as_deref().map(|id| player_name(state, id)),
                    secondary_player_id: event.secondary_player_id.clone(),
                    secondary_player_name: event
                        .secondary_player_id
                        .as_deref()
                        .map(|id| player_name(state, id)),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| fallback_goal_events(&fixture, state));

    let home_stats = report
        .map(|report| {
            team_stats_from_report(
                &fixture.home_team_id,
                &home_team_name,
                &report.home_stats,
                team_records
                    .iter()
                    .find(|record| record.team_id == fixture.home_team_id),
            )
        })
        .or_else(|| {
            team_records
                .iter()
                .find(|record| record.team_id == fixture.home_team_id)
                .map(|record| team_stats_from_record(record, &home_team_name))
        });

    let away_stats = report
        .map(|report| {
            team_stats_from_report(
                &fixture.away_team_id,
                &away_team_name,
                &report.away_stats,
                team_records
                    .iter()
                    .find(|record| record.team_id == fixture.away_team_id),
            )
        })
        .or_else(|| {
            team_records
                .iter()
                .find(|record| record.team_id == fixture.away_team_id)
                .map(|record| team_stats_from_record(record, &away_team_name))
        });

    Ok(Some(MatchDetailDto {
        fixture_id: fixture.id,
        date: fixture.date,
        competition: competition_label(&fixture.competition),
        matchday: fixture.matchday,
        stage: fixture.stage,
        leg: fixture.leg,
        home_team_id: fixture.home_team_id.clone(),
        home_team_name,
        away_team_id: fixture.away_team_id.clone(),
        away_team_name,
        home_goals: result.home_goals,
        away_goals: result.away_goals,
        resolution: result.resolution.as_ref().map(|value| format!("{value:?}")),
        home_penalties: result.home_penalties,
        away_penalties: result.away_penalties,
        total_minutes: report.map(|report| report.total_minutes),
        events,
        home_stats,
        away_stats,
        player_stats: player_records
            .iter()
            .map(|record| player_stats_dto(state, record, &fixture.home_team_id))
            .collect(),
    }))
}

fn find_fixture<'a>(game: &'a Game, fixture_id: &str) -> Option<&'a Fixture> {
    game.league
        .as_ref()
        .and_then(|league| {
            league
                .fixtures
                .iter()
                .find(|fixture| fixture.id == fixture_id)
        })
        .or_else(|| {
            game.competitions
                .iter()
                .flat_map(|competition| competition.fixtures.iter())
                .find(|fixture| fixture.id == fixture_id)
        })
}

fn fallback_goal_events(fixture: &Fixture, state: &StateManager) -> Vec<MatchDetailEventDto> {
    let Some(result) = fixture.result.as_ref() else {
        return Vec::new();
    };

    let mut events = result
        .home_scorers
        .iter()
        .map(|goal| MatchDetailEventDto {
            minute: goal.minute,
            event_type: "Goal".to_string(),
            side: "Home".to_string(),
            player_id: Some(goal.player_id.clone()),
            player_name: Some(player_name(state, &goal.player_id)),
            secondary_player_id: None,
            secondary_player_name: None,
        })
        .chain(result.away_scorers.iter().map(|goal| MatchDetailEventDto {
            minute: goal.minute,
            event_type: "Goal".to_string(),
            side: "Away".to_string(),
            player_id: Some(goal.player_id.clone()),
            player_name: Some(player_name(state, &goal.player_id)),
            secondary_player_id: None,
            secondary_player_name: None,
        }))
        .collect::<Vec<_>>();

    events.sort_by(|left, right| left.minute.cmp(&right.minute));
    events
}

fn team_stats_from_report(
    team_id: &str,
    team_name: &str,
    stats: &CompactTeamMatchStats,
    record: Option<&TeamMatchStatsRecord>,
) -> MatchDetailTeamStatsDto {
    MatchDetailTeamStatsDto {
        team_id: team_id.to_string(),
        team_name: team_name.to_string(),
        possession_pct: stats.possession_pct,
        shots: stats.shots,
        shots_on_target: stats.shots_on_target,
        passes_completed: record.map(|record| record.passes_completed),
        passes_attempted: record.map(|record| record.passes_attempted),
        tackles_won: record.map(|record| record.tackles_won),
        interceptions: record.map(|record| record.interceptions),
        fouls: stats.fouls,
        corners: Some(stats.corners),
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
    }
}

fn team_stats_from_record(
    record: &TeamMatchStatsRecord,
    team_name: &str,
) -> MatchDetailTeamStatsDto {
    MatchDetailTeamStatsDto {
        team_id: record.team_id.clone(),
        team_name: team_name.to_string(),
        possession_pct: record.possession_pct,
        shots: record.shots,
        shots_on_target: record.shots_on_target,
        passes_completed: Some(record.passes_completed),
        passes_attempted: Some(record.passes_attempted),
        tackles_won: Some(record.tackles_won),
        interceptions: Some(record.interceptions),
        fouls: record.fouls_committed,
        corners: None,
        yellow_cards: record.yellow_cards,
        red_cards: record.red_cards,
    }
}

fn player_stats_dto(
    state: &StateManager,
    record: &PlayerMatchStatsRecord,
    home_team_id: &str,
) -> MatchDetailPlayerStatsDto {
    MatchDetailPlayerStatsDto {
        player_id: record.player_id.clone(),
        player_name: player_name(state, &record.player_id),
        team_id: record.team_id.clone(),
        team_name: team_name_from_state(state, &record.team_id),
        side: if record.team_id == home_team_id {
            "Home"
        } else {
            "Away"
        }
        .to_string(),
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

fn side_rank(team_id: &str, home_team_id: &str) -> u8 {
    if team_id == home_team_id {
        0
    } else {
        1
    }
}

fn team_name(game: &Game, team_id: &str) -> String {
    game.teams
        .iter()
        .find(|team| team.id == team_id)
        .map(|team| team.name.clone())
        .unwrap_or_else(|| team_id.to_string())
}

fn team_name_from_state(state: &StateManager, team_id: &str) -> String {
    state
        .get_game(|game| team_name(game, team_id))
        .unwrap_or_else(|| team_id.to_string())
}

fn player_name(state: &StateManager, player_id: &str) -> String {
    state
        .get_game(|game| {
            game.players
                .iter()
                .find(|player| player.id == player_id)
                .map(|player| player.full_name.clone())
        })
        .flatten()
        .unwrap_or_else(|| player_id.to_string())
}
