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
                clean_sheets: player.stats.clean_sheets,
                avg_rating: player.stats.avg_rating,
                yellow_cards: player.stats.yellow_cards,
                red_cards: player.stats.red_cards,
                minutes_played: player.stats.minutes_played,
                shots: player.stats.shots,
                shots_on_target: player.stats.shots_on_target,
                tackles_won: player.stats.tackles_won,
                interceptions: player.stats.interceptions,
            });
        }
        // Reset stats for next season
        player.stats = PlayerSeasonStats::default();
    }

    // 5b. Record permanent honours (champions + awards) and update all-time
    // records. Done before season regeneration wipes competition standings.
    record_season_honours_and_records(game, season, &awards);

    // 5c. Player lifecycle (run after stats/career are recorded, before schedule
    // regeneration). Order matters: veterans decline first, then the oldest
    // retire into the Hall of Fame, then fresh youth refill the world so the
    // total roster stays bounded over many seasons.
    crate::aging::process_player_decline(game);
    let retirements = crate::aging::process_retirements(game, season);
    crate::aging::process_youth_intake(game);

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

    // 6e. Publish a retirement roundup led by the most notable retiree.
    if let Some(headliner) = retirements.first() {
        if let Some(article) = crate::news::retirement_roundup_article(
            season,
            &headliner.id,
            &headliner.full_name,
            &headliner.last_team_name,
            headliner.age_at_retirement,
            retirements.len().saturating_sub(1) as u32,
            &last_fixture_date,
        ) {
            game.news.push(article);
        }
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

/// Record permanent end-of-season honours and update all-time records.
///
/// Reads from competition standings, player career history (just pushed) and
/// team history, all of which still describe the season that just finished.
/// Everything stored here is a small per-season summary kept for the whole
/// career, independent of per-match stat pruning.
fn record_season_honours_and_records(
    game: &mut Game,
    season: u32,
    awards: &crate::season_awards::SeasonAwards,
) {
    use crate::honours::{
        CompetitionChampion, GameRecords, PlayerRecord, SeasonHonours, TeamRecord, TransferRecord,
    };

    let team_name = |game: &Game, team_id: &str| {
        game.teams
            .iter()
            .find(|team| team.id == team_id)
            .map(|team| team.name.clone())
            .unwrap_or_default()
    };

    // Champions: winner (top of sorted standings) of each league competition.
    let mut champions: Vec<CompetitionChampion> = Vec::new();
    if game.competitions.is_empty() {
        if let Some(league) = &game.league {
            if let Some(top) = league.sorted_standings().first() {
                champions.push(CompetitionChampion {
                    competition_id: league.id.clone(),
                    competition_name: league.name.clone(),
                    team_id: top.team_id.clone(),
                    team_name: team_name(game, &top.team_id),
                });
            }
        }
    } else {
        for competition in &game.competitions {
            if competition.kind != CompetitionKind::DomesticLeague {
                continue;
            }
            if let Some(top) = sorted_competition_standings(competition).first() {
                champions.push(CompetitionChampion {
                    competition_id: competition.id.clone(),
                    competition_name: competition.name.clone(),
                    team_id: top.team_id.clone(),
                    team_name: team_name(game, &top.team_id),
                });
            }
        }
    }

    game.season_honours.push(SeasonHonours {
        season,
        champions,
        awards: awards.clone(),
    });

    // All-time records from this season's freshly-pushed career entries.
    // Take records out so it can be mutated while `game` is read immutably,
    // then put the updated value back.
    let mut records = std::mem::take(&mut game.records);
    for player in &game.players {
        let Some(entry) = player.career.iter().find(|entry| entry.season == season) else {
            continue;
        };
        GameRecords::promote_player_record(
            &mut records.most_goals_in_season,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: entry.team_name.clone(),
                value: entry.goals,
                season,
            },
        );
        GameRecords::promote_player_record(
            &mut records.most_assists_in_season,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: entry.team_name.clone(),
                value: entry.assists,
                season,
            },
        );
        GameRecords::promote_player_record(
            &mut records.most_clean_sheets_in_season,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: entry.team_name.clone(),
                value: entry.clean_sheets,
                season,
            },
        );

        // Career totals across all recorded seasons.
        let career_goals: u32 = player.career.iter().map(|entry| entry.goals).sum();
        let career_assists: u32 = player.career.iter().map(|entry| entry.assists).sum();
        let career_clean_sheets: u32 = player.career.iter().map(|entry| entry.clean_sheets).sum();
        let latest_team = player
            .career
            .last()
            .map(|entry| entry.team_name.clone())
            .unwrap_or_default();
        GameRecords::promote_player_record(
            &mut records.most_career_goals,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: latest_team.clone(),
                value: career_goals,
                season,
            },
        );
        GameRecords::promote_player_record(
            &mut records.most_career_assists,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: latest_team.clone(),
                value: career_assists,
                season,
            },
        );
        GameRecords::promote_player_record(
            &mut records.most_career_clean_sheets,
            PlayerRecord {
                player_id: player.id.clone(),
                player_name: player.full_name.clone(),
                team_name: latest_team,
                value: career_clean_sheets,
                season,
            },
        );
    }

    // Team records from this season's history entry.
    for team in &game.teams {
        let Some(record) = team.history.iter().find(|record| record.season == season) else {
            continue;
        };
        let points = record.won * 3 + record.drawn;
        GameRecords::promote_team_record(
            &mut records.highest_points_in_season,
            TeamRecord {
                team_id: team.id.clone(),
                team_name: team.name.clone(),
                value: points,
                season,
            },
        );
        GameRecords::promote_team_record(
            &mut records.most_goals_team_in_season,
            TeamRecord {
                team_id: team.id.clone(),
                team_name: team.name.clone(),
                value: record.goals_for,
                season,
            },
        );
    }

    // Record transfer fee from this season's completed transfers.
    let mut transfer_logs: Vec<&domain::league::CompletedTransfer> = Vec::new();
    if let Some(league) = &game.league {
        transfer_logs.extend(league.transfer_log.iter());
    }
    for competition in &game.competitions {
        transfer_logs.extend(competition.transfer_log.iter());
    }
    if let Some(top_transfer) = transfer_logs.iter().max_by_key(|transfer| transfer.fee) {
        let player_name = game
            .players
            .iter()
            .find(|player| player.id == top_transfer.player_id)
            .map(|player| player.full_name.clone())
            .unwrap_or_default();
        GameRecords::promote_transfer_record(
            &mut records.record_transfer_fee,
            TransferRecord {
                player_id: top_transfer.player_id.clone(),
                player_name,
                from_team_name: team_name(game, &top_transfer.from_team_id),
                to_team_name: team_name(game, &top_transfer.to_team_id),
                fee: top_transfer.fee,
                season,
            },
        );
    }

    game.records = records;
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

    #[test]
    fn process_end_of_season_records_honours_and_champion() {
        let mut game = completed_multi_competition_game("eng-3");

        process_end_of_season(&mut game);

        // One honours entry for the season that just finished (2026).
        let honours = game
            .season_honours
            .iter()
            .find(|entry| entry.season == 2026)
            .expect("season honours recorded for completed season");
        // The user's domestic league (EFL Championship) should have a champion.
        assert!(honours
            .champions
            .iter()
            .any(|champion| champion.competition_name == "EFL Championship"
                && !champion.team_id.is_empty()));
    }

    fn lifecycle_player(id: &str, team_id: &str, birth_year: u32) -> domain::player::Player {
        use domain::player::{Player, PlayerAttributes, Position};
        let mut p = Player::new(
            id.to_string(),
            id.to_string(),
            format!("Player {id}"),
            format!("{birth_year:04}-01-01"),
            "England".to_string(),
            Position::Striker,
            PlayerAttributes {
                pace: 70,
                stamina: 70,
                strength: 70,
                agility: 70,
                passing: 70,
                shooting: 70,
                tackling: 50,
                dribbling: 70,
                defending: 40,
                positioning: 70,
                vision: 70,
                decisions: 70,
                composure: 70,
                aggression: 60,
                teamwork: 70,
                leadership: 60,
                handling: 20,
                reflexes: 20,
                aerial: 60,
            },
        );
        p.team_id = Some(team_id.to_string());
        p.contract_end = Some("2030-06-30".to_string());
        // Give a season of career history so the Hall of Fame record has totals.
        p.career.push(domain::player::CareerEntry {
            season: 2026,
            team_id: team_id.to_string(),
            team_name: "English Three".to_string(),
            appearances: 30,
            goals: 12,
            assists: 5,
            clean_sheets: 0,
            avg_rating: 7.0,
            yellow_cards: 0,
            red_cards: 0,
            minutes_played: 2700,
            shots: 0,
            shots_on_target: 0,
            tackles_won: 0,
            interceptions: 0,
        });
        p
    }

    #[test]
    fn process_end_of_season_retires_old_players_and_refills_youth() {
        let mut game = completed_multi_competition_game("eng-3");

        // One ancient player (certain to retire) and one young player (must stay).
        let ancient = lifecycle_player("ancient", "eng-3", 1983); // age ~43
        let prospect = lifecycle_player("prospect", "eng-3", 2004); // age ~22
        game.teams
            .iter_mut()
            .find(|t| t.id == "eng-3")
            .unwrap()
            .starting_xi_ids = vec!["ancient".to_string(), "prospect".to_string()];
        game.players.push(ancient);
        game.players.push(prospect);

        let players_before = game.players.len();
        process_end_of_season(&mut game);

        // The ancient player is gone from the active roster but recorded in the HoF.
        assert!(!game.players.iter().any(|p| p.id == "ancient"));
        assert!(game.retired_players.iter().any(|r| r.id == "ancient"));
        let record = game
            .retired_players
            .iter()
            .find(|r| r.id == "ancient")
            .unwrap();
        assert_eq!(record.total_goals, 12);
        assert_eq!(record.total_appearances, 30);

        // The young prospect survives.
        assert!(game.players.iter().any(|p| p.id == "prospect"));

        // Retired ids are scrubbed from the team lineup.
        let eng3 = game.teams.iter().find(|t| t.id == "eng-3").unwrap();
        assert!(!eng3.starting_xi_ids.contains(&"ancient".to_string()));

        // Youth intake refilled the world: there are new youth-role players and
        // the roster did not collapse despite the retirement.
        let youth_count = game
            .players
            .iter()
            .filter(|p| p.squad_role == domain::player::SquadRole::Youth)
            .count();
        assert!(youth_count > 0, "youth intake should add prospects");
        assert!(
            game.players.len() >= players_before,
            "intake should offset retirements"
        );
    }
}
