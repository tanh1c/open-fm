use crate::game::Game;
use crate::messages;
use domain::league::{
    CompactMatchEvent, CompactMatchReport, CompactTeamMatchStats, FixtureCompetition, FixtureStatus,
    GoalEvent, MatchResult,
};
use domain::player::{
    Injury, PlayerIssue, PlayerIssueCategory, PlayerPromiseKind, Position as DomainPosition,
};
use domain::stats::{PlayerMatchStatsRecord, StatsState, TeamMatchStatsRecord};

fn compact_team_stats(stats: &engine::TeamStats, possession_pct: u8) -> CompactTeamMatchStats {
    CompactTeamMatchStats {
        possession_pct,
        shots: stats.shots,
        shots_on_target: stats.shots_on_target,
        passes_completed: stats.passes_completed,
        passes_intercepted: stats.passes_intercepted,
        tackles: stats.tackles,
        interceptions: stats.interceptions,
        fouls: stats.fouls,
        corners: stats.corners,
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
    }
}

fn should_keep_fixture_report(
    game: &Game,
    fixture: &domain::league::Fixture,
    home_team_id: &str,
    away_team_id: &str,
) -> bool {
    let is_user_match = game
        .manager
        .team_id
        .as_deref()
        .is_some_and(|team_id| team_id == home_team_id || team_id == away_team_id);

    is_user_match || fixture.stage.is_some() || !fixture.counts_for_league_standings()
}

fn compact_match_report(report: &engine::MatchReport) -> CompactMatchReport {
    let home_possession_pct = report.home_possession.round().clamp(0.0, 100.0) as u8;
    let away_possession_pct = (100.0 - report.home_possession).round().clamp(0.0, 100.0) as u8;

    let events = report
        .events
        .iter()
        .filter(|event| {
            matches!(
                event.event_type,
                engine::EventType::Goal
                    | engine::EventType::PenaltyGoal
                    | engine::EventType::PenaltyMiss
                    | engine::EventType::YellowCard
                    | engine::EventType::RedCard
                    | engine::EventType::SecondYellow
                    | engine::EventType::Injury
                    | engine::EventType::Substitution
            )
        })
        .map(|event| CompactMatchEvent {
            minute: event.minute,
            event_type: format!("{:?}", event.event_type),
            side: format!("{:?}", event.side),
            player_id: event.player_id.clone(),
            secondary_player_id: event.secondary_player_id.clone(),
        })
        .collect();

    CompactMatchReport {
        total_minutes: report.total_minutes,
        home_stats: compact_team_stats(&report.home_stats, home_possession_pct),
        away_stats: compact_team_stats(&report.away_stats, away_possession_pct),
        events,
    }
}

/// Apply a completed match report to the game state: update fixture, standings,
/// player stats, stamina, and generate messages. Public so Tauri can call it
/// after a live match finishes.
pub fn apply_match_report(
    game: &mut Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
) {
    apply_match_report_with_capture(
        game,
        fixture_index,
        home_team_id,
        away_team_id,
        report,
        &mut |_| {},
    );
}

pub fn apply_match_report_with_capture<F>(
    game: &mut Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    // Convert engine GoalDetails → domain GoalEvents
    let home_scorers: Vec<GoalEvent> = report
        .goals
        .iter()
        .filter(|g| g.side == engine::Side::Home)
        .map(|g| GoalEvent {
            player_id: g.scorer_id.clone(),
            minute: g.minute,
        })
        .collect();
    let away_scorers: Vec<GoalEvent> = report
        .goals
        .iter()
        .filter(|g| g.side == engine::Side::Away)
        .map(|g| GoalEvent {
            player_id: g.scorer_id.clone(),
            minute: g.minute,
        })
        .collect();

    let keep_report = game.league.as_ref().is_some_and(|league| {
        league.fixtures.get(fixture_index).is_some_and(|fixture| {
            should_keep_fixture_report(game, fixture, home_team_id, away_team_id)
        })
    });
    let result = MatchResult {
        home_goals: report.home_goals,
        away_goals: report.away_goals,
        home_scorers,
        away_scorers,
        report: keep_report.then(|| compact_match_report(report)),
        winner_team_id: None,
        resolution: None,
        home_penalties: None,
        away_penalties: None,
    };
    let mut counts_for_standings = false;
    let mut generates_match_news = false;

    // Update fixture status, standings
    if let Some(league) = game.league.as_mut() {
        let fixture = &mut league.fixtures[fixture_index];
        fixture.status = FixtureStatus::Completed;
        counts_for_standings = fixture.counts_for_league_standings();
        generates_match_news = fixture.generates_match_report_news();

        if counts_for_standings {
            if let Some(entry) = league
                .standings
                .iter_mut()
                .find(|e| e.team_id == home_team_id)
            {
                entry.record_result(result.home_goals, result.away_goals);
            }
            if let Some(entry) = league
                .standings
                .iter_mut()
                .find(|e| e.team_id == away_team_id)
            {
                entry.record_result(result.away_goals, result.home_goals);
            }
        }

        fixture.result = Some(result);
    }

    let stats_capture = build_stats_state_capture(
        game,
        fixture_index,
        home_team_id,
        away_team_id,
        report,
    );
    let counts_for_official_player_stats = stats_capture
        .player_matches
        .first()
        .is_some_and(|record| is_competitive_fixture(&record.competition));
    on_capture(stats_capture);

    if counts_for_official_player_stats {
        apply_player_stats(game, report, home_team_id, away_team_id);
    }
    resolve_post_match_promises(game, report, home_team_id, away_team_id);

    // Deplete stamina for players who played, scaled by minutes on pitch
    deplete_match_stamina(game, home_team_id, report);
    deplete_match_stamina(game, away_team_id, report);
    persist_match_injuries(game, report, home_team_id, away_team_id);

    // Update morale based on result and individual performance
    update_post_match_morale(game, report, home_team_id, away_team_id);
    improve_tactical_familiarity_from_match(game, home_team_id, away_team_id);

    // Update team form (last 5 results)
    if counts_for_standings {
        update_team_form(game, report, home_team_id, away_team_id);
    }

    // Update board satisfaction based on match result
    if counts_for_standings
        && let Some(user_team_id) = &game.manager.team_id
        && (*user_team_id == home_team_id || *user_team_id == away_team_id)
    {
        let user_goals = if *user_team_id == home_team_id {
            report.home_goals
        } else {
            report.away_goals
        };
        let opp_goals = if *user_team_id == home_team_id {
            report.away_goals
        } else {
            report.home_goals
        };
        let sat_delta: i8 = if user_goals > opp_goals {
            2
        }
        // win: +2
        else if user_goals == opp_goals {
            -1
        }
        // draw: -1
        else {
            -3
        }; // loss: -3
        let new_sat = (game.manager.satisfaction as i16 + sat_delta as i16).clamp(0, 100) as u8;
        game.manager.satisfaction = new_sat;

        // Fan approval — fans react more emotionally
        let fan_delta: i8 = if user_goals > opp_goals {
            5
        }
        // win: +5
        else if user_goals == opp_goals {
            -2
        }
        // draw: -2
        else {
            -8
        }; // loss: -8
        // Extra bonus for big wins, extra penalty for heavy losses
        let goal_diff = (user_goals as i8) - (opp_goals as i8);
        let fan_bonus: i8 = if goal_diff >= 3 {
            3
        } else if goal_diff <= -3 {
            -3
        } else {
            0
        };
        let new_fan = (game.manager.fan_approval as i16 + fan_delta as i16 + fan_bonus as i16)
            .clamp(0, 100) as u8;
        game.manager.fan_approval = new_fan;
    }

    // Generate match result message for user's team
    if counts_for_standings
        && let Some(user_team_id) = &game.manager.team_id
        && (*user_team_id == home_team_id || *user_team_id == away_team_id)
    {
        let fixture = &game.league.as_ref().unwrap().fixtures[fixture_index];
        let res = fixture.result.as_ref().unwrap();
        let home_name = game
            .teams
            .iter()
            .find(|t| t.id == home_team_id)
            .map(|t| t.name.as_str())
            .unwrap_or("Home");
        let away_name = game
            .teams
            .iter()
            .find(|t| t.id == away_team_id)
            .map(|t| t.name.as_str())
            .unwrap_or("Away");

        let msg = messages::match_result_message(
            &fixture.id,
            home_name,
            away_name,
            res.home_goals,
            res.away_goals,
            home_team_id,
            away_team_id,
            user_team_id,
            fixture.matchday,
            &game.clock.current_date.to_rfc3339(),
        );
        game.messages.push(msg);
    }

    // Generate match report news article
    if generates_match_news {
        super::news::generate_match_news(game, fixture_index, home_team_id, away_team_id, report);
    }
}

fn build_stats_state_capture(
    game: &Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
) -> StatsState {
    let Some(league) = game.league.as_ref() else {
        return StatsState::default();
    };
    let Some(fixture) = league.fixtures.get(fixture_index) else {
        return StatsState::default();
    };

    let home_possession_pct = report.home_possession.round().clamp(0.0, 100.0) as u8;
    let away_possession_pct = (100.0 - report.home_possession).round().clamp(0.0, 100.0) as u8;
    let team_by_player_id: std::collections::HashMap<&str, &str> = game
        .players
        .iter()
        .filter_map(|player| {
            player
                .team_id
                .as_deref()
                .map(|team_id| (player.id.as_str(), team_id))
        })
        .collect();

    let player_matches = report
        .player_stats
        .iter()
        .filter_map(|(player_id, stats)| {
            let team_id = *team_by_player_id.get(player_id.as_str())?;
            if team_id != home_team_id && team_id != away_team_id {
                return None;
            }

            let opponent_team_id = if team_id == home_team_id {
                away_team_id
            } else {
                home_team_id
            };

            Some(PlayerMatchStatsRecord {
                fixture_id: fixture.id.clone(),
                season: league.season,
                matchday: fixture.matchday,
                date: fixture.date.clone(),
                competition: fixture.competition.clone(),
                player_id: player_id.clone(),
                team_id: team_id.to_string(),
                opponent_team_id: opponent_team_id.to_string(),
                home_team_id: home_team_id.to_string(),
                away_team_id: away_team_id.to_string(),
                home_goals: report.home_goals,
                away_goals: report.away_goals,
                minutes_played: stats.minutes_played,
                goals: stats.goals,
                assists: stats.assists,
                shots: stats.shots,
                shots_on_target: stats.shots_on_target,
                passes_completed: stats.passes_completed,
                passes_attempted: stats.passes_attempted,
                tackles_won: stats.tackles_won,
                interceptions: stats.interceptions,
                fouls_committed: stats.fouls_committed,
                yellow_cards: stats.yellow_cards,
                red_cards: stats.red_cards,
                rating: stats.rating,
            })
        })
        .collect();

    let team_matches = vec![
        TeamMatchStatsRecord {
            fixture_id: fixture.id.clone(),
            season: league.season,
            matchday: fixture.matchday,
            date: fixture.date.clone(),
            competition: fixture.competition.clone(),
            team_id: home_team_id.to_string(),
            opponent_team_id: away_team_id.to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            goals_for: report.home_goals,
            goals_against: report.away_goals,
            possession_pct: home_possession_pct,
            shots: report.home_stats.shots,
            shots_on_target: report.home_stats.shots_on_target,
            passes_completed: report.home_stats.passes_completed,
            passes_attempted: report.home_stats.passes_completed
                + report.home_stats.passes_intercepted,
            tackles_won: report.home_stats.tackles,
            interceptions: report.home_stats.interceptions,
            fouls_committed: report.home_stats.fouls,
            yellow_cards: report.home_stats.yellow_cards,
            red_cards: report.home_stats.red_cards,
        },
        TeamMatchStatsRecord {
            fixture_id: fixture.id.clone(),
            season: league.season,
            matchday: fixture.matchday,
            date: fixture.date.clone(),
            competition: fixture.competition.clone(),
            team_id: away_team_id.to_string(),
            opponent_team_id: home_team_id.to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            goals_for: report.away_goals,
            goals_against: report.home_goals,
            possession_pct: away_possession_pct,
            shots: report.away_stats.shots,
            shots_on_target: report.away_stats.shots_on_target,
            passes_completed: report.away_stats.passes_completed,
            passes_attempted: report.away_stats.passes_completed
                + report.away_stats.passes_intercepted,
            tackles_won: report.away_stats.tackles,
            interceptions: report.away_stats.interceptions,
            fouls_committed: report.away_stats.fouls,
            yellow_cards: report.away_stats.yellow_cards,
            red_cards: report.away_stats.red_cards,
        },
    ];

    StatsState {
        player_matches,
        team_matches,
    }
}

// ---------------------------------------------------------------------------
// Post-match: feed engine report stats back into domain Player models
// ---------------------------------------------------------------------------

fn is_competitive_fixture(competition: &FixtureCompetition) -> bool {
    !matches!(
        competition,
        FixtureCompetition::Friendly | FixtureCompetition::PreseasonTournament
    )
}

fn apply_player_stats(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    for player in game.players.iter_mut() {
        if let Some(ps) = report.player_stats.get(&player.id) {
            player.stats.appearances += 1;
            player.stats.goals += ps.goals as u32;
            player.stats.assists += ps.assists as u32;
            player.stats.yellow_cards += ps.yellow_cards as u32;
            player.stats.red_cards += ps.red_cards as u32;
            player.stats.minutes_played += ps.minutes_played as u32;
            player.stats.shots += ps.shots as u32;
            player.stats.shots_on_target += ps.shots_on_target as u32;
            player.stats.passes_completed += ps.passes_completed as u32;
            player.stats.passes_attempted += ps.passes_attempted as u32;
            player.stats.tackles_won += ps.tackles_won as u32;
            player.stats.interceptions += ps.interceptions as u32;
            player.stats.fouls_committed += ps.fouls_committed as u32;

            // Update average rating (running average)
            if player.stats.appearances == 1 {
                player.stats.avg_rating = ps.rating;
            } else {
                let n = player.stats.appearances as f32;
                player.stats.avg_rating = (player.stats.avg_rating * (n - 1.0) + ps.rating) / n;
            }

            // Clean sheet for goalkeepers
            if matches!(player.position, DomainPosition::Goalkeeper) {
                let tid = player.team_id.as_deref().unwrap_or("");
                let conceded_zero = if tid == home_team_id {
                    report.away_goals == 0
                } else if tid == away_team_id {
                    report.home_goals == 0
                } else {
                    false
                };
                if conceded_zero {
                    player.stats.clean_sheets += 1;
                }
            }
        }
    }
}

fn resolve_post_match_promises(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    for player in game.players.iter_mut() {
        let Some(team_id) = player.team_id.as_deref() else {
            continue;
        };
        if team_id != home_team_id && team_id != away_team_id {
            continue;
        }

        let Some(promise) = player.morale_core.pending_promise.clone() else {
            continue;
        };

        let played = report.player_stats.contains_key(&player.id);

        match promise.kind {
            PlayerPromiseKind::PlayingTime => {
                if played {
                    player.morale_core.pending_promise = None;
                    player.morale_core.manager_trust =
                        (i16::from(player.morale_core.manager_trust) + 3).clamp(0, 100) as u8;

                    if player
                        .morale_core
                        .unresolved_issue
                        .as_ref()
                        .is_some_and(|issue| issue.category == PlayerIssueCategory::PlayingTime)
                    {
                        player.morale_core.unresolved_issue = None;
                    }
                } else if promise.matches_remaining <= 1 {
                    player.morale_core.pending_promise = None;
                    player.morale_core.manager_trust =
                        (i16::from(player.morale_core.manager_trust) - 12).clamp(0, 100) as u8;
                    player.morale_core.unresolved_issue = Some(PlayerIssue {
                        category: PlayerIssueCategory::PlayingTime,
                        severity: 75,
                    });
                } else {
                    player.morale_core.pending_promise = Some(domain::player::PlayerPromise {
                        kind: PlayerPromiseKind::PlayingTime,
                        matches_remaining: promise.matches_remaining - 1,
                    });
                }
            }
        }
    }
}

fn capped_positive_recovery(delta: i16, player: &domain::player::Player) -> i16 {
    let Some(issue) = player.morale_core.unresolved_issue.as_ref() else {
        return delta;
    };

    if delta <= 0 {
        return delta;
    }

    if issue.severity >= 75 {
        return 0;
    }

    if issue.severity >= 50 {
        return ((delta + 1) / 2).max(1);
    }

    delta
}

fn realistic_morale_delta(current_morale: u8, delta: i16) -> i16 {
    if delta <= 0 {
        if current_morale >= 90 {
            return ((delta as f32) * 1.2).round() as i16;
        }
        return delta;
    }

    if current_morale >= 95 {
        0
    } else if current_morale >= 90 {
        (delta / 3).max(0)
    } else if current_morale >= 80 {
        (delta / 2).max(1)
    } else {
        delta
    }
}

fn apply_realistic_morale_delta(current_morale: u8, delta: i16) -> u8 {
    (i16::from(current_morale) + realistic_morale_delta(current_morale, delta)).clamp(10, 96) as u8
}

/// Update player morale based on match result and individual performance.
fn update_post_match_morale(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    use rand::RngExt;
    let mut rng = rand::rng();

    let home_won = report.home_goals > report.away_goals;
    let away_won = report.away_goals > report.home_goals;
    let is_draw = report.home_goals == report.away_goals;

    for player in game.players.iter_mut() {
        let tid = match player.team_id.as_deref() {
            Some(t) if t == home_team_id || t == away_team_id => t.to_string(),
            _ => continue,
        };

        let is_home = tid == home_team_id;
        let base_morale = player.morale as i16;

        // Team result effect — scale loss impact by goal difference
        let goal_diff = (report.home_goals as i16 - report.away_goals as i16).abs();
        let result_delta: i16 = if (is_home && home_won) || (!is_home && away_won) {
            rng.random_range(3..=8) // Win boost
        } else if is_draw {
            rng.random_range(-2..=3) // Draw: mild
        } else {
            // Base loss: -5 to -2, plus extra -3 per goal margin beyond 1
            let base_loss = rng.random_range(-5..=-2);
            let margin_penalty = (goal_diff - 1).max(0) * -3;
            base_loss + margin_penalty // e.g. 3-0 loss → -5..-2 + -6 = -11..-8
        };

        // Individual performance effect
        let mut individual_delta: i16 = 0;
        if let Some(ps) = report.player_stats.get(&player.id) {
            // Goals scored boost morale
            individual_delta += ps.goals as i16 * 3;
            // Assists boost morale
            individual_delta += ps.assists as i16 * 2;
            // Red card tanks morale
            if ps.red_cards > 0 {
                individual_delta -= 8;
            }
            // Poor rating lowers morale
            if ps.rating < 5.5 {
                individual_delta -= 3;
            } else if ps.rating > 7.5 {
                individual_delta += 2;
            }
        }

        let total_delta = capped_positive_recovery(result_delta + individual_delta, player);
        player.morale = apply_realistic_morale_delta(base_morale as u8, total_delta);
    }
}

fn improve_tactical_familiarity_from_match(game: &mut Game, home_team_id: &str, away_team_id: &str) {
    for team_id in [home_team_id, away_team_id] {
        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.tactical_familiarity = team.tactical_familiarity.saturating_add(1).min(100);
        }
    }
}

/// Update team form vectors after a match result. Keeps last 5 results.
/// Also applies streak-based morale bonus/penalty to all players on teams with streaks.
fn update_team_form(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    use rand::RngExt;
    let mut rng = rand::rng();

    let home_result = if report.home_goals > report.away_goals {
        "W"
    } else if report.home_goals < report.away_goals {
        "L"
    } else {
        "D"
    };
    let away_result = if report.away_goals > report.home_goals {
        "W"
    } else if report.away_goals < report.home_goals {
        "L"
    } else {
        "D"
    };

    // Update form for both teams
    for (team_id_str, result) in [(home_team_id, home_result), (away_team_id, away_result)] {
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id_str) {
            team.form.push(result.to_string());
            if team.form.len() > 5 {
                team.form.remove(0);
            }
        }
    }

    // Track the all-time longest unbeaten run. Uses the game clock year as the
    // season stamp; the running streak per team lives in GameRecords so it
    // survives the 5-match `form` window and save/reload.
    {
        use chrono::Datelike;
        let season = game.clock.current_date.year() as u32;
        for (team_id_str, result) in [(home_team_id, home_result), (away_team_id, away_result)] {
            let team_name = game
                .teams
                .iter()
                .find(|t| t.id == team_id_str)
                .map(|t| t.name.clone())
                .unwrap_or_default();
            game.records.record_match_for_unbeaten_run(
                team_id_str,
                &team_name,
                result == "L",
                season,
            );
        }
    }

    // Apply streak-based morale bonus/penalty
    for team_id_str in [home_team_id, away_team_id] {
        let form = game
            .teams
            .iter()
            .find(|t| t.id == team_id_str)
            .map(|t| t.form.clone())
            .unwrap_or_default();

        if form.len() >= 3 {
            let last3: Vec<&str> = form.iter().rev().take(3).map(|s| s.as_str()).collect();
            let streak_delta: i16 = if last3.iter().all(|r| *r == "W") {
                rng.random_range(2..=5) // 3+ win streak: small global morale boost
            } else if last3.iter().all(|r| *r == "L") {
                rng.random_range(-10..=-5) // 3+ loss streak: significant morale drop
            } else {
                0
            };

            if streak_delta != 0 {
                for player in game.players.iter_mut() {
                    if player.team_id.as_deref() == Some(team_id_str) {
                        let adjusted_delta = capped_positive_recovery(streak_delta, player);
                        player.morale = apply_realistic_morale_delta(player.morale, adjusted_delta);
                    }
                }
            }
        }
    }
}

fn deplete_match_stamina(game: &mut Game, team_id: &str, report: &engine::MatchReport) {
    for player in game.players.iter_mut() {
        if player.team_id.as_deref() == Some(team_id) {
            let minutes = report
                .player_stats
                .get(&player.id)
                .map(|ps| ps.minutes_played)
                .unwrap_or(0);
            if minutes == 0 {
                continue;
            }
            let minutes_factor = minutes as f64 / 90.0;
            let stamina_factor = player.attributes.stamina as f64 / 100.0;
            let fitness_factor = player.fitness as f64 / 100.0;
            let is_goalkeeper = matches!(player.position, DomainPosition::Goalkeeper);
            let base_depletion = 26.0 * (1.0 - stamina_factor * 0.35);
            let position_modifier = if is_goalkeeper { 0.35 } else { 1.0 };
            let fitness_modifier = (1.12 - fitness_factor * 0.22).clamp(0.90, 1.12);
            let minimum_depletion = if is_goalkeeper {
                if minutes >= 85 { 3.0 } else { 1.0 }
            } else if minutes >= 85 {
                8.0
            } else {
                4.0
            };
            let depletion = (base_depletion * position_modifier * fitness_modifier * minutes_factor)
                .round()
                .max(minimum_depletion) as u8;
            player.condition = player.condition.saturating_sub(depletion);

            if minutes >= 60 {
                use rand::RngExt;
                let mut rng = rand::rng();
                if rng.random_bool(0.25) && player.fitness < 100 {
                    player.fitness = player.fitness.saturating_add(1);
                }
            }
        }
    }
}

fn persist_match_injuries(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    for event in report
        .events
        .iter()
        .filter(|event| event.event_type == engine::EventType::Injury)
    {
        let Some(player_id) = event.player_id.as_ref() else {
            continue;
        };
        let Some(player) = game.players.iter_mut().find(|player| {
            player.id == *player_id
                && player.injury.is_none()
                && matches!(
                    player.team_id.as_deref(),
                    Some(team_id) if team_id == home_team_id || team_id == away_team_id
                )
        }) else {
            continue;
        };

        let seed = deterministic_injury_seed(&player.id, event.minute);
        let base_days = 3 + seed % 12;
        let condition_extra = if player.condition < 35 {
            6
        } else if player.condition < 55 {
            3
        } else {
            0
        };
        let fitness_extra = if player.fitness < 35 {
            5
        } else if player.fitness < 55 {
            2
        } else {
            0
        };
        let names = ["Knock", "Muscle strain", "Ankle sprain", "Bruise"];
        player.injury = Some(Injury {
            name: names[(seed as usize) % names.len()].to_string(),
            days_remaining: (base_days + condition_extra + fitness_extra).clamp(2, 28),
        });
    }
}

fn deterministic_injury_seed(player_id: &str, minute: u8) -> u32 {
    player_id
        .bytes()
        .fold(minute as u32, |acc, byte| acc.wrapping_mul(31).wrapping_add(byte as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use chrono::TimeZone;
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes};
    use std::collections::HashMap;

    fn attributes(stamina: u8) -> PlayerAttributes {
        PlayerAttributes {
            pace: 60,
            stamina,
            strength: 60,
            agility: 60,
            passing: 60,
            shooting: 60,
            tackling: 60,
            dribbling: 60,
            defending: 60,
            positioning: 60,
            vision: 60,
            decisions: 60,
            composure: 60,
            aggression: 60,
            teamwork: 60,
            leadership: 60,
            handling: 60,
            reflexes: 60,
            aerial: 60,
        }
    }

    fn player(id: &str, position: DomainPosition) -> Player {
        let mut player = Player::new(
            id.to_string(),
            id.to_string(),
            id.to_string(),
            "2000-01-01".to_string(),
            "GB".to_string(),
            position,
            attributes(60),
        );
        player.team_id = Some("team-1".to_string());
        player.condition = 100;
        player.fitness = 75;
        player
    }

    fn game_with_players(players: Vec<Player>) -> Game {
        let mut manager = Manager::new(
            "manager-1".to_string(),
            "Jane".to_string(),
            "Doe".to_string(),
            "1980-01-01".to_string(),
            "GB".to_string(),
        );
        manager.hire("team-1".to_string());

        Game::new(
            GameClock::new(chrono::Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap()),
            manager,
            vec![],
            players,
            vec![],
            vec![],
        )
    }

    fn report_with_minutes(player_ids: &[&str], minutes: u8) -> engine::MatchReport {
        let player_stats = player_ids
            .iter()
            .map(|player_id| {
                (
                    (*player_id).to_string(),
                    engine::PlayerMatchStats {
                        minutes_played: minutes,
                        rating: 6.8,
                        ..Default::default()
                    },
                )
            })
            .collect::<HashMap<_, _>>();

        engine::MatchReport {
            home_goals: 0,
            away_goals: 0,
            home_stats: engine::TeamStats::default(),
            away_stats: engine::TeamStats::default(),
            events: vec![],
            goals: vec![],
            player_stats,
            home_possession: 50.0,
            total_minutes: 90,
        }
    }

    fn league_fixture(home_team_id: &str, away_team_id: &str) -> domain::league::Fixture {
        domain::league::Fixture {
            id: "fixture-1".to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            competition: FixtureCompetition::League,
            ..Default::default()
        }
    }

    #[test]
    fn ai_league_match_skips_compact_report_but_captures_stats() {
        let mut game = game_with_players(vec![
            player("home-1", DomainPosition::CenterBack),
            player("away-1", DomainPosition::CenterBack),
        ]);
        game.manager.team_id = Some("user-team".to_string());
        game.players[0].team_id = Some("home-team".to_string());
        game.players[1].team_id = Some("away-team".to_string());
        game.league = Some(domain::league::League {
            id: "league-1".to_string(),
            name: "League".to_string(),
            season: 2026,
            fixtures: vec![league_fixture("home-team", "away-team")],
            standings: vec![],
            transfer_log: vec![],
        });
        let report = report_with_minutes(&["home-1", "away-1"], 90);
        let mut captures = Vec::new();

        apply_match_report_with_capture(
            &mut game,
            0,
            "home-team",
            "away-team",
            &report,
            &mut |stats| captures.push(stats),
        );

        let result = game.league.as_ref().unwrap().fixtures[0].result.as_ref().unwrap();
        assert!(result.report.is_none());
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].player_matches.len(), 2);
        assert_eq!(captures[0].team_matches.len(), 2);
    }

    #[test]
    fn user_league_match_keeps_compact_report() {
        let mut game = game_with_players(vec![
            player("home-1", DomainPosition::CenterBack),
            player("away-1", DomainPosition::CenterBack),
        ]);
        game.manager.team_id = Some("home-team".to_string());
        game.players[0].team_id = Some("home-team".to_string());
        game.players[1].team_id = Some("away-team".to_string());
        game.league = Some(domain::league::League {
            id: "league-1".to_string(),
            name: "League".to_string(),
            season: 2026,
            fixtures: vec![league_fixture("home-team", "away-team")],
            standings: vec![],
            transfer_log: vec![],
        });
        let report = report_with_minutes(&["home-1", "away-1"], 90);

        apply_match_report_with_capture(
            &mut game,
            0,
            "home-team",
            "away-team",
            &report,
            &mut |_| {},
        );

        let result = game.league.as_ref().unwrap().fixtures[0].result.as_ref().unwrap();
        assert!(result.report.is_some());
    }

    #[test]
    fn realistic_morale_delta_soft_caps_high_morale() {
        assert_eq!(apply_realistic_morale_delta(95, 8), 95);
        assert_eq!(apply_realistic_morale_delta(93, 8), 95);
        assert_eq!(apply_realistic_morale_delta(82, 8), 86);
        assert_eq!(apply_realistic_morale_delta(94, 12), 96);
    }

    #[test]
    fn goalkeeper_condition_depletes_less_than_outfield_player() {
        let mut game = game_with_players(vec![
            player("gk-1", DomainPosition::Goalkeeper),
            player("cb-1", DomainPosition::CenterBack),
        ]);
        let report = report_with_minutes(&["gk-1", "cb-1"], 90);

        deplete_match_stamina(&mut game, "team-1", &report);

        let goalkeeper = game.players.iter().find(|player| player.id == "gk-1").unwrap();
        let outfielder = game.players.iter().find(|player| player.id == "cb-1").unwrap();
        let goalkeeper_depletion = 100 - goalkeeper.condition;
        let outfielder_depletion = 100 - outfielder.condition;

        assert!(goalkeeper_depletion <= 8);
        assert!(outfielder_depletion >= 18);
        assert!(goalkeeper_depletion < outfielder_depletion);
    }
}
