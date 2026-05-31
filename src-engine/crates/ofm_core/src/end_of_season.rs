use crate::game::Game;
use crate::schedule::{
    append_fixtures, domestic_pyramid_definition, generate_continental_group_stage,
    generate_domestic_competitions_by_country, generate_domestic_competitions_for_tier_memberships,
    generate_league, generate_preseason_friendlies,
};
use crate::season_awards::compute_season_awards;
use chrono::Duration;
use domain::league::{Competition, CompetitionKind, FixtureStatus, League};
use domain::message::*;
use domain::player::PlayerSeasonStats;
use domain::team::{FinancialTransaction, FinancialTransactionKind, TeamSeasonRecord};

pub fn expected_fixture_count(team_count: usize) -> Option<usize> {
    if team_count >= 2 && team_count % 2 == 0 {
        Some(team_count * (team_count - 1))
    } else {
        None
    }
}

pub fn has_full_schedule(league: &League) -> bool {
    match expected_fixture_count(league.standings.len()) {
        Some(expected_fixture_count) => {
            league
                .fixtures
                .iter()
                .filter(|fixture| fixture.counts_for_league_standings())
                .count()
                == expected_fixture_count
        }
        None => false,
    }
}

fn league_from_competition(competition: &Competition) -> League {
    League {
        id: competition.id.clone(),
        name: competition.name.clone(),
        season: competition.season,
        fixtures: competition.fixtures.clone(),
        standings: competition.standings.clone(),
        transfer_log: competition.transfer_log.clone(),
    }
}

fn sync_legacy_league_from_primary_competition(game: &mut Game) {
    game.league = game.primary_league_competition().map(league_from_competition);
}

fn free_agent_team_name() -> String {
    ["Free", "Agent"].join(" ")
}

/// Returns true if at least one competitive fixture has been completed or any
/// standing entry records a played match. Used as a guard to prevent premature
/// end-of-season processing for a season that has not yet kicked off.
pub fn season_has_started(league: &League) -> bool {
    league
        .fixtures
        .iter()
        .any(|f| f.counts_for_league_standings() && f.status == FixtureStatus::Completed)
        || league.standings.iter().any(|e| e.played > 0)
}

fn competition_season_has_started(competition: &Competition) -> bool {
    competition.fixtures.iter().any(|fixture| {
        fixture.counts_for_league_standings() && fixture.status == FixtureStatus::Completed
    }) || competition.standings.iter().any(|entry| entry.played > 0)
}

fn sorted_competition_standings(competition: &Competition) -> Vec<domain::league::StandingEntry> {
    let league = league_from_competition(competition);
    league.sorted_standings()
}

fn apply_promotion_and_relegation(
    country: &str,
    domestic_leagues: &[Competition],
) -> Option<Vec<(u8, Vec<String>)>> {
    let definition = domestic_pyramid_definition(country)?;
    let mut tier_memberships: Vec<(u8, Vec<String>)> = definition
        .leagues
        .iter()
        .filter_map(|league_definition| {
            let competition = domestic_leagues.iter().find(|competition| {
                competition.country.as_deref() == Some(country)
                    && competition.tier == Some(league_definition.tier)
            })?;
            Some((
                league_definition.tier,
                sorted_competition_standings(competition)
                    .into_iter()
                    .map(|standing| standing.team_id)
                    .collect(),
            ))
        })
        .collect();

    if tier_memberships.len() < 2 {
        return None;
    }

    tier_memberships.sort_by_key(|(tier, _)| *tier);

    for pair_index in 0..definition.leagues.len().saturating_sub(1) {
        let upper_definition = &definition.leagues[pair_index];
        let lower_definition = &definition.leagues[pair_index + 1];
        let upper_index = tier_memberships
            .iter()
            .position(|(tier, _)| *tier == upper_definition.tier)?;
        let lower_index = tier_memberships
            .iter()
            .position(|(tier, _)| *tier == lower_definition.tier)?;
        let movement_count = upper_definition
            .relegation_count
            .min(lower_definition.promotion_count)
            .min(tier_memberships[upper_index].1.len())
            .min(tier_memberships[lower_index].1.len())
            // Never relegate an entire division: the upper tier must retain at
            // least its champion. Only bites for degenerately small leagues
            // (e.g. a 2-team test tier); real pyramids relegate 3 of 20+.
            .min(tier_memberships[upper_index].1.len().saturating_sub(1));

        if movement_count == 0 {
            continue;
        }

        let upper_len = tier_memberships[upper_index].1.len();
        let relegated = tier_memberships[upper_index].1.split_off(upper_len - movement_count);
        let promoted: Vec<String> = tier_memberships[lower_index].1.drain(..movement_count).collect();
        tier_memberships[upper_index].1.extend(promoted);
        tier_memberships[lower_index].1.extend(relegated);
    }

    Some(tier_memberships)
}

fn generate_next_domestic_competitions(
    current_competitions: &[Competition],
    teams: &[domain::team::Team],
    next_season: u32,
    next_start: chrono::DateTime<chrono::Utc>,
) -> Vec<Competition> {
    let mut generated_competitions = Vec::new();
    let mut countries: Vec<String> = teams.iter().map(|team| team.country.clone()).collect();
    countries.sort();
    countries.dedup();

    for country in countries {
        let country_leagues: Vec<Competition> = current_competitions
            .iter()
            .filter(|competition| {
                competition.kind == CompetitionKind::DomesticLeague
                    && competition.country.as_deref() == Some(country.as_str())
            })
            .cloned()
            .collect();

        if let Some(tier_memberships) = apply_promotion_and_relegation(&country, &country_leagues) {
            if let Some(mut competitions) = generate_domestic_competitions_for_tier_memberships(
                &country,
                &tier_memberships,
                next_season,
                next_start,
            ) {
                generated_competitions.append(&mut competitions);
                continue;
            }
        }

        let country_teams: Vec<domain::team::Team> = teams
            .iter()
            .filter(|team| team.country == country)
            .cloned()
            .collect();
        generated_competitions.append(&mut generate_domestic_competitions_by_country(
            &country_teams,
            next_season,
            next_start,
        ));
    }

    generated_competitions
}

pub fn is_competition_league_complete(competition: &Competition) -> bool {
    competition.kind == CompetitionKind::DomesticLeague
        && competition_season_has_started(competition)
        && expected_fixture_count(competition.standings.len()).is_some_and(|expected| {
            competition
                .fixtures
                .iter()
                .filter(|fixture| fixture.counts_for_league_standings())
                .count()
                == expected
        })
        && competition
            .fixtures
            .iter()
            .filter(|fixture| fixture.counts_for_league_standings())
            .all(|fixture| fixture.status == FixtureStatus::Completed)
}

pub fn is_league_complete(league: &League) -> bool {
    season_has_started(league)
        && has_full_schedule(league)
        && league
            .fixtures
            .iter()
            .filter(|fixture| fixture.counts_for_league_standings())
            .all(|fixture| fixture.status == FixtureStatus::Completed)
}

/// Check if the season is complete (all fixtures played).
pub fn is_season_complete(game: &Game) -> bool {
    if !game.competitions.is_empty() {
        return game
            .primary_league_competition()
            .is_some_and(is_competition_league_complete);
    }

    game.league.as_ref().is_some_and(is_league_complete)
}

const PRIZE_MONEY_BY_POSITION: [i64; 10] = [
    5_000_000, 3_000_000, 1_500_000, 750_000, 400_000, 300_000, 250_000, 200_000, 175_000, 150_000,
];

const SEASON_PAYOUT_LEDGER_DESCRIPTION_KEY: &str = "be.msg.seasonPayout.ledgerDescription";

fn position_suffix(position: u32) -> &'static str {
    match position {
        1 => "st",
        2 => "nd",
        3 => "rd",
        _ => "th",
    }
}

fn backend_text_with_params(key: &str, params: [(&str, String); 3]) -> String {
    let mut text = String::from(key);

    for (index, (param_name, param_value)) in params.into_iter().enumerate() {
        text.push(if index == 0 { '?' } else { '&' });
        text.push_str(param_name);
        text.push('=');
        text.push_str(&param_value);
    }

    text
}

fn prize_money_ledger_description(season: u32, position: u32, suffix: &str) -> String {
    backend_text_with_params(
        SEASON_PAYOUT_LEDGER_DESCRIPTION_KEY,
        [
            ("season", season.to_string()),
            ("position", position.to_string()),
            ("suffix", suffix.to_string()),
        ],
    )
}

fn prize_money_for_position(position: u32) -> i64 {
    if position == 0 {
        return 0;
    }

    PRIZE_MONEY_BY_POSITION
        .get(position.saturating_sub(1) as usize)
        .copied()
        .unwrap_or(150_000)
}

/// Process end-of-season: record history, compute awards, reset stats, generate next season.
/// Returns a summary struct for the frontend to display.
pub fn process_end_of_season(game: &mut Game) -> EndOfSeasonSummary {
    if !game.competitions.is_empty() {
        sync_legacy_league_from_primary_competition(game);
    }

    let league = match &game.league {
        Some(l) => l,
        None => return EndOfSeasonSummary::default(),
    };

    let season = league.season;
    let league_name = league.name.clone();
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    // Messages should be dated on the last match day, not on the clock date
    // (which may already be one day ahead due to process_day advancing the clock).
    let last_fixture_date = league
        .fixtures
        .iter()
        .filter(|f| f.counts_for_league_standings() && f.status == FixtureStatus::Completed)
        .map(|f| f.date.as_str())
        .max()
        .unwrap_or(today.as_str())
        .to_string();

    // 1. Compute final standings
    let final_standings = league.sorted_standings();

    // 2. Compute awards before resetting stats
    let awards = compute_season_awards(game);

    // 3. Build summary
    let user_team_id = game.manager.team_id.clone().unwrap_or_default();
    let user_position = final_standings
        .iter()
        .position(|s| s.team_id == user_team_id)
        .map(|i| i + 1)
        .unwrap_or(0) as u32;
    let user_standing = final_standings
        .iter()
        .find(|s| s.team_id == user_team_id)
        .cloned();

    let champion_id = final_standings
        .first()
        .map(|s| s.team_id.clone())
        .unwrap_or_default();
    let champion_name = game
        .teams
        .iter()
        .find(|t| t.id == champion_id)
        .map(|t| t.name.clone())
        .unwrap_or_default();

    let summary = EndOfSeasonSummary {
        season,
        league_name: league_name.clone(),
        champion_id: champion_id.clone(),
        champion_name,
        user_position,
        user_points: user_standing.as_ref().map(|s| s.points).unwrap_or(0),
        user_won: user_standing.as_ref().map(|s| s.won).unwrap_or(0),
        user_drawn: user_standing.as_ref().map(|s| s.drawn).unwrap_or(0),
        user_lost: user_standing.as_ref().map(|s| s.lost).unwrap_or(0),
        user_goals_for: user_standing.as_ref().map(|s| s.goals_for).unwrap_or(0),
        user_goals_against: user_standing.as_ref().map(|s| s.goals_against).unwrap_or(0),
        golden_boot_player: awards
            .golden_boot
            .first()
            .map(|e| e.player_name.clone())
            .unwrap_or_default(),
        golden_boot_goals: awards
            .golden_boot
            .first()
            .map(|e| e.value as u32)
            .unwrap_or(0),
        poty_player: awards
            .player_of_year
            .first()
            .map(|e| e.player_name.clone())
            .unwrap_or_default(),
        poty_rating: awards
            .player_of_year
            .first()
            .map(|e| e.value)
            .unwrap_or(0.0),
        total_teams: final_standings.len() as u32,
    };

    // 4. Record team season history
    for (idx, standing) in final_standings.iter().enumerate() {
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == standing.team_id) {
            let position = (idx + 1) as u32;
            let prize_money = prize_money_for_position(position);

            team.history.push(TeamSeasonRecord {
                season,
                league_position: position,
                played: standing.played,
                won: standing.won,
                drawn: standing.drawn,
                lost: standing.lost,
                goals_for: standing.goals_for,
                goals_against: standing.goals_against,
            });
            // Reset form
            team.form.clear();

            if prize_money > 0 {
                team.finance += prize_money;
                team.season_income += prize_money;
                team.financial_ledger.push(FinancialTransaction {
                    date: last_fixture_date.clone(),
                    description: prize_money_ledger_description(
                        season,
                        position,
                        position_suffix(position),
                    ),
                    amount: prize_money,
                    kind: FinancialTransactionKind::PrizeMoney,
                });
            }
        }
    }

    crate::reputation::update_team_reputation(game, &final_standings);

    // 5. Record player career entries and reset stats
    for player in game.players.iter_mut() {
        if player.stats.appearances > 0 {
            let team_name = player
                .team_id
                .as_ref()
                .and_then(|tid| game.teams.iter().find(|t| &t.id == tid))
                .map(|t| t.name.clone())
                .unwrap_or_else(free_agent_team_name);
            let team_id = player.team_id.clone().unwrap_or_default();

            player.career.push(domain::player::CareerEntry {
                season,
                team_id,
                team_name,
                appearances: player.stats.appearances,
                goals: player.stats.goals,
                assists: player.stats.assists,
            });
        }
        // Reset stats for next season
        player.stats = PlayerSeasonStats::default();
    }

    // 6. Update manager career stats
    if let Some(standing) = &user_standing {
        let total_matches = standing.won + standing.drawn + standing.lost;
        game.manager.career_stats.matches_managed += total_matches;
        game.manager.career_stats.wins += standing.won;
        game.manager.career_stats.draws += standing.drawn;
        game.manager.career_stats.losses += standing.lost;
        if user_position == 1 {
            game.manager.career_stats.trophies += 1;
        }
        let best = game.manager.career_stats.best_finish;
        if best.is_none() || best.unwrap() > user_position {
            game.manager.career_stats.best_finish = Some(user_position);
        }
        // Update or create career history entry for current team
        let team_name = game
            .teams
            .iter()
            .find(|t| t.id == user_team_id)
            .map(|t| t.name.clone())
            .unwrap_or_default();
        let today_str = game.clock.current_date.format("%Y-%m-%d").to_string();
        // Check if there's an existing open entry for this team
        let existing = game
            .manager
            .career_history
            .iter_mut()
            .find(|e| e.team_id == user_team_id && e.end_date.is_none());
        if let Some(entry) = existing {
            entry.matches += total_matches;
            entry.wins += standing.won;
            entry.draws += standing.drawn;
            entry.losses += standing.lost;
            let prev_best = entry.best_league_position;
            if prev_best.is_none() || prev_best.unwrap() > user_position {
                entry.best_league_position = Some(user_position);
            }
        } else {
            game.manager
                .career_history
                .push(domain::manager::ManagerCareerEntry {
                    team_id: user_team_id.clone(),
                    team_name,
                    start_date: today_str,
                    end_date: None,
                    matches: total_matches,
                    wins: standing.won,
                    draws: standing.drawn,
                    losses: standing.lost,
                    best_league_position: Some(user_position),
                });
        }
    }

    // 6b. Evaluate board objectives and adjust satisfaction
    let obj_delta = crate::board_objectives::evaluate_objectives(game);
    let new_sat = (game.manager.satisfaction as i16 + obj_delta as i16).clamp(0, 100) as u8;
    game.manager.satisfaction = new_sat;
    // Clear objectives for next season (will be regenerated on first process_day)
    game.board_objectives.clear();

    // 6c. Clear old news articles from the previous season
    game.news.clear();

    // 6d. Publish the season awards ceremony article (skipped when no marquee winners)
    if let Some(article) = crate::news::season_awards_article(&awards, season, &last_fixture_date) {
        game.news.push(article);
    }

    // 7. Generate next season schedule
    let next_season = season + 1;
    let user_league_team_ids: Vec<String> = final_standings
        .iter()
        .map(|standing| standing.team_id.clone())
        .collect();
    let all_team_ids: Vec<String> = game.teams.iter().map(|team| team.id.clone()).collect();
    // Start date: roughly a year after current start, or a few weeks from now
    let next_start = game.clock.current_date + Duration::days(28); // 4 weeks break

    if game.competitions.is_empty() {
        let mut new_league = generate_league(&league_name, next_season, &all_team_ids, next_start);
        let friendlies = generate_preseason_friendlies(&all_team_ids, next_start, 4);
        append_fixtures(&mut new_league, friendlies);
        game.league = Some(new_league);
    } else {
        let continental_competition = generate_continental_group_stage(
            "Champions League",
            next_season,
            &game.competitions,
            &game.teams,
            next_start + Duration::days(45),
        );
        game.competitions = generate_next_domestic_competitions(
            &game.competitions,
            &game.teams,
            next_season,
            next_start,
        );
        if let Some(competition) = continental_competition {
            game.competitions.push(competition);
        }
        if let Some(user_competition) = game.primary_league_competition() {
            let mut user_league = league_from_competition(user_competition);
            let friendlies = generate_preseason_friendlies(&user_league_team_ids, next_start, 4);
            append_fixtures(&mut user_league, friendlies);
            game.league = Some(user_league);
        }
    }

    let preview_date = game.clock.current_date.to_rfc3339();
    let team_names: Vec<String> = game.teams.iter().map(|team| team.name.clone()).collect();
    game.news.push(crate::news::season_preview_article(
        &team_names,
        &preview_date,
    ));

    // 8. Send end-of-season messages
    let pos_suffix = position_suffix(user_position);

    let user_team_name = game
        .teams
        .iter()
        .find(|t| t.id == user_team_id)
        .map(|t| t.name.clone())
        .unwrap_or_default();

    let existing_ids: std::collections::HashSet<String> =
        game.messages.iter().map(|m| m.id.clone()).collect();

    let payout_msg_id = format!("season_payout_{}", season);
    let user_prize_money = prize_money_for_position(user_position);
    if user_prize_money > 0 && !existing_ids.contains(&payout_msg_id) {
        let payout_message = InboxMessage::new(
            payout_msg_id,
            String::new(),
            String::new(),
            String::new(),
            last_fixture_date.clone(),
        )
        .with_category(MessageCategory::Finance)
        .with_priority(MessagePriority::High)
        .with_sender_role("")
        .with_i18n("be.msg.seasonPayout.subject", "be.msg.seasonPayout.body", {
            let mut params = std::collections::HashMap::new();
            params.insert("season".to_string(), season.to_string());
            params.insert("amount".to_string(), user_prize_money.to_string());
            params.insert("position".to_string(), user_position.to_string());
            params
        })
        .with_sender_i18n("be.sender.boardOfDirectors", "be.role.chairman");
        game.messages.push(payout_message);
    }

    let msg_id = format!("season_end_{}", season);
    if !existing_ids.contains(&msg_id) {
        let (body_key, mut i18n_params) = if user_position == 1 {
            let mut p = std::collections::HashMap::new();
            p.insert("team".to_string(), user_team_name.clone());
            p.insert("points".to_string(), summary.user_points.to_string());
            ("be.msg.seasonReview.body.champion", p)
        } else if user_position <= 4 {
            let mut p = std::collections::HashMap::new();
            p.insert("team".to_string(), user_team_name.clone());
            p.insert("position".to_string(), user_position.to_string());
            p.insert("suffix".to_string(), pos_suffix.to_string());
            p.insert("points".to_string(), summary.user_points.to_string());
            ("be.msg.seasonReview.body.topFour", p)
        } else if user_position <= summary.total_teams / 2 {
            let mut p = std::collections::HashMap::new();
            p.insert("team".to_string(), user_team_name.clone());
            p.insert("position".to_string(), user_position.to_string());
            p.insert("suffix".to_string(), pos_suffix.to_string());
            p.insert("points".to_string(), summary.user_points.to_string());
            ("be.msg.seasonReview.body.midTable", p)
        } else {
            let mut p = std::collections::HashMap::new();
            p.insert("team".to_string(), user_team_name.clone());
            p.insert("position".to_string(), user_position.to_string());
            p.insert("suffix".to_string(), pos_suffix.to_string());
            p.insert("points".to_string(), summary.user_points.to_string());
            ("be.msg.seasonReview.body.lowerHalf", p)
        };
        i18n_params.insert("season".to_string(), season.to_string());

        let msg = InboxMessage::new(
            msg_id,
            String::new(),
            String::new(),
            String::new(),
            last_fixture_date.clone(),
        )
        .with_category(MessageCategory::BoardDirective)
        .with_priority(MessagePriority::High)
        .with_sender_role("")
        .with_i18n("be.msg.seasonReview.subject", body_key, i18n_params)
        .with_sender_i18n("be.sender.boardOfDirectors", "be.role.chairman");
        game.messages.push(msg);
    }

    let sched_msg_id = format!("new_season_{}", next_season);
    if !existing_ids.contains(&sched_msg_id) {
        let mut sched_params = std::collections::HashMap::new();
        sched_params.insert("season".to_string(), next_season.to_string());
        let sched_msg = InboxMessage::new(
            sched_msg_id,
            String::new(),
            String::new(),
            String::new(),
            last_fixture_date,
        )
        .with_category(MessageCategory::LeagueInfo)
        .with_priority(MessagePriority::Normal)
        .with_sender_role("")
        .with_i18n(
            "be.msg.newSeasonSchedule.subject",
            "be.msg.newSeasonSchedule.body",
            sched_params,
        )
        .with_sender_i18n("be.sender.leagueOffice", "be.role.competitionSecretary");
        game.messages.push(sched_msg);
    }

    crate::season_context::refresh_game_context(game);

    summary
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct EndOfSeasonSummary {
    pub season: u32,
    pub league_name: String,
    pub champion_id: String,
    pub champion_name: String,
    pub user_position: u32,
    pub user_points: u32,
    pub user_won: u32,
    pub user_drawn: u32,
    pub user_lost: u32,
    pub user_goals_for: u32,
    pub user_goals_against: u32,
    pub golden_boot_player: String,
    pub golden_boot_goals: u32,
    pub poty_player: String,
    pub poty_rating: f64,
    pub total_teams: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use crate::schedule::generate_domestic_competitions_by_country;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::team::Team;

    fn test_team(id: &str, name: &str, reputation: u32) -> Team {
        test_team_in_country(id, name, "England", reputation)
    }

    fn test_team_in_country(id: &str, name: &str, country: &str, reputation: u32) -> Team {
        let mut team = Team::new(
            id.to_string(),
            name.to_string(),
            name.chars().take(2).collect(),
            country.to_string(),
            country.to_string(),
            "Ground".to_string(),
            40_000,
        );
        team.reputation = reputation;
        team
    }

    fn completed_multi_competition_game(user_team_id: &str) -> Game {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
        let mut manager = Manager::new(
            "manager".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire(user_team_id.to_string());
        let teams = vec![
            test_team("eng-1", "English One", 900),
            test_team("eng-2", "English Two", 800),
            test_team("eng-3", "English Three", 700),
            test_team("eng-4", "English Four", 600),
            // A second country so two tier-1 leagues supply enough
            // continental qualifiers (2 per league) to form a group of four.
            test_team_in_country("esp-1", "Spanish One", "Spain", 850),
            test_team_in_country("esp-2", "Spanish Two", "Spain", 750),
            test_team_in_country("esp-3", "Spanish Three", "Spain", 650),
            test_team_in_country("esp-4", "Spanish Four", "Spain", 550),
        ];
        let mut game = Game::new(
            GameClock::new(start + Duration::days(14)),
            manager,
            teams,
            vec![],
            vec![],
            vec![],
        );
        game.competitions = generate_domestic_competitions_by_country(&game.teams, 2026, start);

        for competition in game.competitions.iter_mut() {
            if competition.kind != CompetitionKind::DomesticLeague {
                continue;
            }

            for fixture in competition.fixtures.iter_mut() {
                fixture.status = FixtureStatus::Completed;
                fixture.result = Some(domain::league::MatchResult {
                    home_goals: 1,
                    away_goals: 0,
                    home_scorers: vec![],
                    away_scorers: vec![],
                    report: None,
                });
            }

            for standing in competition.standings.iter_mut() {
                standing.played = 2;
            }
        }

        sync_legacy_league_from_primary_competition(&mut game);
        game
    }

    #[test]
    fn season_complete_uses_user_domestic_competition() {
        let game = completed_multi_competition_game("eng-3");

        assert!(is_season_complete(&game));
        assert_eq!(
            game.primary_league_competition().unwrap().name,
            "EFL Championship"
        );
        assert_eq!(game.league.as_ref().unwrap().name, "EFL Championship");
    }

    #[test]
    fn process_end_of_season_regenerates_competitions_and_syncs_legacy_league() {
        let mut game = completed_multi_competition_game("eng-3");

        let summary = process_end_of_season(&mut game);

        assert_eq!(summary.season, 2026);
        assert_eq!(summary.league_name, "EFL Championship");
        assert!(game.competitions.iter().any(|competition| {
            competition.name == "Premier League" && competition.season == 2027
        }));
        assert!(game.competitions.iter().any(|competition| {
            competition.name == "EFL Championship" && competition.season == 2027
        }));
        assert!(game.competitions.iter().any(|competition| {
            competition.name == "FA Cup" && competition.season == 2027
        }));
        assert!(game.competitions.iter().any(|competition| {
            competition.name == "Champions League" && competition.season == 2027
        }));
        let premier_league = game
            .competitions
            .iter()
            .find(|competition| competition.name == "Premier League")
            .unwrap();
        let championship = game
            .competitions
            .iter()
            .find(|competition| competition.name == "EFL Championship")
            .unwrap();
        assert_eq!(premier_league.team_ids, vec!["eng-1", "eng-3"]);
        assert_eq!(championship.team_ids, vec!["eng-4", "eng-2"]);
        assert_eq!(game.league.as_ref().unwrap().name, "Premier League");
        assert!(game
            .league
            .as_ref()
            .unwrap()
            .fixtures
            .iter()
            .any(|fixture| fixture.competition == domain::league::FixtureCompetition::Friendly));
    }
}
