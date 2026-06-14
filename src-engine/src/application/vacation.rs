use domain::player::TransferOfferStatus;
use ofm_core::contracts::{DelegatedRenewalOptions, DelegatedRenewalReport};
use ofm_core::game::Game;
use ofm_core::state::StateManager;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::application::time_blockers::compute_blocking_actions as compute_blocking_actions_service;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VacationSettings {
    #[serde(default = "default_true")]
    pub handle_matches: bool,
    #[serde(default = "default_true")]
    pub handle_training: bool,
    #[serde(default = "default_true")]
    pub handle_transfers: bool,
    #[serde(default = "default_true")]
    pub handle_contracts: bool,
    #[serde(default = "default_true")]
    pub handle_scouting: bool,
    #[serde(default = "default_true")]
    pub ignore_soft_blockers: bool,
    #[serde(default)]
    pub return_for_user_match: bool,
    #[serde(default = "default_true")]
    pub return_for_job_offer: bool,
    #[serde(default = "default_true")]
    pub return_for_transfer_offer: bool,
    #[serde(default = "default_true")]
    pub return_for_contract_decision: bool,
    #[serde(default = "default_true")]
    pub return_for_injury_crisis: bool,
    #[serde(default = "default_true")]
    pub return_for_urgent_message: bool,
    #[serde(default = "default_contract_wage_increase_pct")]
    pub contract_max_wage_increase_pct: u32,
    #[serde(default = "default_contract_years")]
    pub contract_max_years: u32,
    #[serde(default = "default_transfer_minimum_value_pct")]
    pub transfer_minimum_value_pct: u32,
    #[serde(default)]
    pub allow_assistant_to_sell_key_players: bool,
    #[serde(default)]
    pub apply_for_jobs_while_away: bool,
    #[serde(default)]
    pub job_minimum_reputation: Option<u32>,
}

impl Default for VacationSettings {
    fn default() -> Self {
        Self {
            handle_matches: true,
            handle_training: true,
            handle_transfers: true,
            handle_contracts: true,
            handle_scouting: true,
            ignore_soft_blockers: true,
            return_for_user_match: false,
            return_for_job_offer: true,
            return_for_transfer_offer: true,
            return_for_contract_decision: true,
            return_for_injury_crisis: true,
            return_for_urgent_message: true,
            contract_max_wage_increase_pct: default_contract_wage_increase_pct(),
            contract_max_years: default_contract_years(),
            transfer_minimum_value_pct: default_transfer_minimum_value_pct(),
            allow_assistant_to_sell_key_players: false,
            apply_for_jobs_while_away: false,
            job_minimum_reputation: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct VacationAdvanceResponse {
    pub action: String,
    pub game: Game,
    pub days_advanced: u32,
    pub report: VacationReport,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub blockers: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VacationReport {
    pub started_at: String,
    pub ended_at: String,
    pub days_advanced: u32,
    pub stop_reason: String,
    pub match_results: Vec<VacationMatchResult>,
    pub transfer_offer_ids: Vec<String>,
    pub job_offer_message_ids: Vec<String>,
    pub urgent_message_ids: Vec<String>,
    pub blocker_ids: Vec<String>,
    pub delegated_renewal_reports: Vec<DelegatedRenewalReport>,
    pub assistant_transfer_actions: Vec<AssistantTransferAction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantTransferAction {
    pub player_id: String,
    pub player_name: String,
    pub offer_id: String,
    pub action: String,
    pub fee: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VacationMatchResult {
    pub fixture_id: String,
    pub date: String,
    pub home_team_id: String,
    pub away_team_id: String,
    pub home_goals: u8,
    pub away_goals: u8,
}

#[derive(Debug, Clone)]
struct VacationDaySnapshot {
    user_match_today: bool,
    pending_transfer_offer_ids: HashSet<String>,
    job_offer_message_ids: HashSet<String>,
    urgent_message_ids: HashSet<String>,
    blocker_ids: HashSet<String>,
    blockers: Vec<serde_json::Value>,
}

fn default_true() -> bool {
    true
}

fn default_contract_wage_increase_pct() -> u32 {
    15
}

fn default_contract_years() -> u32 {
    3
}

fn default_transfer_minimum_value_pct() -> u32 {
    120
}

pub fn advance_to_date(
    state: &StateManager,
    target_date: &str,
    settings: VacationSettings,
) -> Result<VacationAdvanceResponse, String> {
    let mut game = state
        .get_game(|g| g.clone())
        .ok_or("be.error.noActiveGameSession")?;
    let user_team_id = game
        .manager
        .team_id
        .clone()
        .ok_or("be.error.noTeamAssigned")?;
    let started_at = game.clock.current_date.format("%Y-%m-%d").to_string();
    let mut days_advanced = 0u32;
    prepare_vacation_day(&mut game);
    let mut initial_snapshot = capture_snapshot(&game, &user_team_id);
    let mut match_results = Vec::new();
    let mut delegated_renewal_reports = Vec::new();
    let mut assistant_transfer_actions = Vec::new();
    let mut last_contract_delegate_day: Option<u32> = None;
    let max_days = 400u32;

    run_assistant_actions(
        &mut game,
        &settings,
        days_advanced,
        &mut last_contract_delegate_day,
        &mut delegated_renewal_reports,
        &mut assistant_transfer_actions,
    );

    loop {
        prepare_vacation_day(&mut game);
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();
        if today.as_str() > target_date || days_advanced >= max_days {
            break;
        }

        let before = capture_snapshot(&game, &user_team_id);
        if (!settings.handle_matches || settings.return_for_user_match) && before.user_match_today {
            return finish(
                state,
                game,
                started_at,
                days_advanced,
                "match_day",
                match_results,
                initial_snapshot,
                before.blockers,
                delegated_renewal_reports,
                assistant_transfer_actions,
            );
        }

        if !settings.ignore_soft_blockers && !before.blockers.is_empty() {
            return finish(
                state,
                game,
                started_at,
                days_advanced,
                "blocked",
                match_results,
                initial_snapshot,
                before.blockers,
                delegated_renewal_reports,
                assistant_transfer_actions,
            );
        }

        let mut captures = Vec::new();
        ofm_core::turn::process_day_with_capture(&mut game, &mut |capture| {
            captures.push(capture);
        });
        prepare_vacation_day(&mut game);
        for capture in captures {
            state.append_stats_state(capture);
        }
        days_advanced += 1;

        match_results.extend(collect_new_match_results(
            &game,
            &user_team_id,
            &match_results,
        ));

        if game.manager.team_id.is_none() {
            let blockers = compute_blocking_actions_service(&game);
            return finish(
                state,
                game,
                started_at,
                days_advanced,
                "fired",
                match_results,
                initial_snapshot,
                blockers,
                delegated_renewal_reports,
                assistant_transfer_actions,
            );
        }

        run_assistant_actions(
            &mut game,
            &settings,
            days_advanced,
            &mut last_contract_delegate_day,
            &mut delegated_renewal_reports,
            &mut assistant_transfer_actions,
        );

        let after = capture_snapshot(&game, &user_team_id);
        if settings.return_for_contract_decision
            && delegated_renewal_reports
                .iter()
                .any(|report| report.stalled_count > 0)
        {
            return finish(
                state,
                game,
                started_at,
                days_advanced,
                "contract_decision",
                match_results,
                initial_snapshot,
                after.blockers,
                delegated_renewal_reports,
                assistant_transfer_actions,
            );
        }
        if let Some(reason) = stop_reason_after_day(&settings, &before, &after) {
            return finish(
                state,
                game,
                started_at,
                days_advanced,
                reason,
                match_results,
                initial_snapshot,
                after.blockers,
                delegated_renewal_reports,
                assistant_transfer_actions,
            );
        }
        initial_snapshot = merge_seen_snapshot(initial_snapshot, &after);
    }

    let blockers = compute_blocking_actions_service(&game);
    finish(
        state,
        game,
        started_at,
        days_advanced,
        "arrived",
        match_results,
        initial_snapshot,
        blockers,
        delegated_renewal_reports,
        assistant_transfer_actions,
    )
}

pub fn has_scheduled_user_match(game: &Game, date: &str, user_team_id: &str) -> bool {
    let has_legacy_match = game.league.as_ref().is_some_and(|league| {
        league.fixtures.iter().any(|fixture| {
            fixture.date == date
                && fixture.status == domain::league::FixtureStatus::Scheduled
                && (fixture.home_team_id == user_team_id || fixture.away_team_id == user_team_id)
        })
    });

    has_legacy_match
        || game.competitions.iter().any(|competition| {
            competition.fixtures.iter().any(|fixture| {
                fixture.date == date
                    && fixture.status == domain::league::FixtureStatus::Scheduled
                    && (fixture.home_team_id == user_team_id
                        || fixture.away_team_id == user_team_id)
            })
        })
}

fn prepare_vacation_day(game: &mut Game) {
    game.repair_legacy_league_from_primary_competition();
    game.sync_primary_competition_from_legacy_league();
}

fn capture_snapshot(game: &Game, user_team_id: &str) -> VacationDaySnapshot {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    let blockers = compute_blocking_actions_service(game);
    VacationDaySnapshot {
        user_match_today: has_scheduled_user_match(game, &today, user_team_id),
        pending_transfer_offer_ids: pending_transfer_offer_ids(game, user_team_id),
        job_offer_message_ids: game
            .messages
            .iter()
            .filter(|message| message.category == domain::message::MessageCategory::JobOffer)
            .map(|message| message.id.clone())
            .collect(),
        urgent_message_ids: game
            .messages
            .iter()
            .filter(|message| {
                !message.read && message.priority == domain::message::MessagePriority::Urgent
            })
            .map(|message| message.id.clone())
            .collect(),
        blocker_ids: blockers
            .iter()
            .filter_map(|blocker| {
                blocker
                    .get("id")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string)
            })
            .collect(),
        blockers,
    }
}

fn pending_transfer_offer_ids(game: &Game, user_team_id: &str) -> HashSet<String> {
    game.players
        .iter()
        .filter(|player| player.team_id.as_deref() == Some(user_team_id))
        .flat_map(|player| {
            player
                .transfer_offers
                .iter()
                .filter(|offer| offer.status == domain::player::TransferOfferStatus::Pending)
                .map(|offer| offer.id.clone())
        })
        .collect()
}

fn stop_reason_after_day(
    settings: &VacationSettings,
    before: &VacationDaySnapshot,
    after: &VacationDaySnapshot,
) -> Option<&'static str> {
    if settings.return_for_job_offer
        && has_new_items(&before.job_offer_message_ids, &after.job_offer_message_ids)
    {
        return Some("job_offer");
    }

    if settings.return_for_transfer_offer
        && has_new_items(
            &before.pending_transfer_offer_ids,
            &after.pending_transfer_offer_ids,
        )
    {
        return Some("transfer_offer");
    }

    if settings.return_for_urgent_message
        && has_new_items(&before.urgent_message_ids, &after.urgent_message_ids)
    {
        return Some("urgent_message");
    }

    if !settings.ignore_soft_blockers {
        if settings.return_for_injury_crisis
            && has_new_crisis_blocker(&before.blocker_ids, &after.blocker_ids)
        {
            return Some("injury_crisis");
        }

        if settings.return_for_contract_decision
            && after
                .blocker_ids
                .iter()
                .any(|id| id == "key_contract_risk" || id == "contract_wage_risk")
        {
            return Some("contract_decision");
        }
    }

    None
}

fn has_new_items(before: &HashSet<String>, after: &HashSet<String>) -> bool {
    after.iter().any(|id| !before.contains(id))
}

fn has_new_crisis_blocker(before: &HashSet<String>, after: &HashSet<String>) -> bool {
    ["injured_xi", "incomplete_xi", "squad_size_crisis"]
        .iter()
        .any(|id| after.contains(*id) && !before.contains(*id))
}

fn merge_seen_snapshot(
    mut seen: VacationDaySnapshot,
    snapshot: &VacationDaySnapshot,
) -> VacationDaySnapshot {
    seen.pending_transfer_offer_ids
        .extend(snapshot.pending_transfer_offer_ids.iter().cloned());
    seen.job_offer_message_ids
        .extend(snapshot.job_offer_message_ids.iter().cloned());
    seen.urgent_message_ids
        .extend(snapshot.urgent_message_ids.iter().cloned());
    seen.blocker_ids
        .extend(snapshot.blocker_ids.iter().cloned());
    seen
}

fn run_assistant_actions(
    game: &mut Game,
    settings: &VacationSettings,
    days_advanced: u32,
    last_contract_delegate_day: &mut Option<u32>,
    delegated_renewal_reports: &mut Vec<DelegatedRenewalReport>,
    assistant_transfer_actions: &mut Vec<AssistantTransferAction>,
) {
    if settings.handle_contracts
        && last_contract_delegate_day
            .map(|day| days_advanced.saturating_sub(day) >= 7)
            .unwrap_or(true)
    {
        if let Ok(report) = ofm_core::contracts::delegate_renewals(
            game,
            DelegatedRenewalOptions {
                player_ids: None,
                max_wage_increase_pct: settings.contract_max_wage_increase_pct,
                max_contract_years: settings.contract_max_years,
            },
        ) {
            if !report.cases.is_empty() {
                delegated_renewal_reports.push(report);
            }
        }
        *last_contract_delegate_day = Some(days_advanced);
    }

    if settings.handle_transfers {
        assistant_transfer_actions.extend(review_incoming_transfer_offers(game, settings));
    }
}

fn review_incoming_transfer_offers(
    game: &mut Game,
    settings: &VacationSettings,
) -> Vec<AssistantTransferAction> {
    let Some(user_team_id) = game.manager.team_id.clone() else {
        return Vec::new();
    };
    let key_player_ids: HashSet<String> = game
        .teams
        .iter()
        .find(|team| team.id == user_team_id)
        .map(|team| team.starting_xi_ids.iter().cloned().collect())
        .unwrap_or_default();
    let pending: Vec<(String, String, String, u64, bool, bool)> = game
        .players
        .iter()
        .filter(|player| player.team_id.as_deref() == Some(user_team_id.as_str()))
        .flat_map(|player| {
            let is_key_player = key_player_ids.contains(&player.id);
            player
                .transfer_offers
                .iter()
                .filter(|offer| offer.status == TransferOfferStatus::Pending)
                .map(move |offer| {
                    let threshold = player
                        .market_value
                        .saturating_mul(settings.transfer_minimum_value_pct as u64)
                        / 100;
                    (
                        player.id.clone(),
                        player.match_name.clone(),
                        offer.id.clone(),
                        offer.fee,
                        is_key_player,
                        offer.fee < threshold,
                    )
                })
        })
        .collect();
    let mut actions = Vec::new();

    for (player_id, player_name, offer_id, fee, is_key_player, below_threshold) in pending {
        if is_key_player && !settings.allow_assistant_to_sell_key_players {
            continue;
        }

        if below_threshold {
            if ofm_core::transfers::respond_to_offer(game, &player_id, &offer_id, false).is_ok() {
                actions.push(AssistantTransferAction {
                    player_id,
                    player_name,
                    offer_id,
                    action: "rejected".to_string(),
                    fee,
                });
            }
        }
    }

    actions
}

fn collect_new_match_results(
    game: &Game,
    user_team_id: &str,
    existing: &[VacationMatchResult],
) -> Vec<VacationMatchResult> {
    let known: HashSet<&str> = existing
        .iter()
        .map(|result| result.fixture_id.as_str())
        .collect();
    game.league
        .as_ref()
        .map(|league| {
            league
                .fixtures
                .iter()
                .filter(|fixture| {
                    !known.contains(fixture.id.as_str())
                        && (fixture.home_team_id == user_team_id
                            || fixture.away_team_id == user_team_id)
                        && fixture.status == domain::league::FixtureStatus::Completed
                })
                .filter_map(|fixture| {
                    let result = fixture.result.as_ref()?;
                    Some(VacationMatchResult {
                        fixture_id: fixture.id.clone(),
                        date: fixture.date.clone(),
                        home_team_id: fixture.home_team_id.clone(),
                        away_team_id: fixture.away_team_id.clone(),
                        home_goals: result.home_goals,
                        away_goals: result.away_goals,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn finish(
    state: &StateManager,
    game: Game,
    started_at: String,
    days_advanced: u32,
    stop_reason: &str,
    match_results: Vec<VacationMatchResult>,
    seen: VacationDaySnapshot,
    blockers: Vec<serde_json::Value>,
    delegated_renewal_reports: Vec<DelegatedRenewalReport>,
    assistant_transfer_actions: Vec<AssistantTransferAction>,
) -> Result<VacationAdvanceResponse, String> {
    let ended_at = game.clock.current_date.format("%Y-%m-%d").to_string();
    let blocker_ids = blockers
        .iter()
        .filter_map(|blocker| {
            blocker
                .get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .collect();
    let report = VacationReport {
        started_at,
        ended_at,
        days_advanced,
        stop_reason: stop_reason.to_string(),
        match_results,
        transfer_offer_ids: seen.pending_transfer_offer_ids.into_iter().collect(),
        job_offer_message_ids: seen.job_offer_message_ids.into_iter().collect(),
        urgent_message_ids: seen.urgent_message_ids.into_iter().collect(),
        blocker_ids,
        delegated_renewal_reports,
        assistant_transfer_actions,
    };
    state.set_game(game.clone());
    Ok(VacationAdvanceResponse {
        action: stop_reason.to_string(),
        game,
        days_advanced,
        report,
        blockers,
    })
}

#[cfg(test)]
mod tests {
    use super::{advance_to_date, VacationSettings};
    use chrono::{TimeZone, Utc};
    use domain::league::{
        Competition, CompetitionFormat, CompetitionKind, Fixture, FixtureCompetition,
        FixtureStatus, League, StandingEntry,
    };
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::stats::StatsState;
    use domain::team::Team;
    use ofm_core::clock::GameClock;
    use ofm_core::game::Game;
    use ofm_core::state::StateManager;

    fn attrs() -> PlayerAttributes {
        PlayerAttributes {
            pace: 60,
            stamina: 60,
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

    fn player(id: &str, team_id: &str, position: Position) -> Player {
        let mut player = Player::new(
            id.to_string(),
            id.to_string(),
            id.to_string(),
            "2000-01-01".to_string(),
            "England".to_string(),
            position,
            attrs(),
        );
        player.team_id = Some(team_id.to_string());
        player
    }

    fn worldcup_r32_game(start_date: (i32, u32, u32), legacy_has_fixture: bool) -> Game {
        let clock = GameClock::new(
            Utc.with_ymd_and_hms(start_date.0, start_date.1, start_date.2, 12, 0, 0)
                .unwrap(),
        );
        let mut manager = Manager::new(
            "mgr1".to_string(),
            "Alex".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team1".to_string());

        let mut players = Vec::new();
        for team_id in ["team1", "team2"] {
            players.push(player(
                &format!("{team_id}-gk"),
                team_id,
                Position::Goalkeeper,
            ));
            for idx in 0..4 {
                players.push(player(
                    &format!("{team_id}-d{idx}"),
                    team_id,
                    Position::Defender,
                ));
            }
            for idx in 0..4 {
                players.push(player(
                    &format!("{team_id}-m{idx}"),
                    team_id,
                    Position::Midfielder,
                ));
            }
            for idx in 0..2 {
                players.push(player(
                    &format!("{team_id}-f{idx}"),
                    team_id,
                    Position::Forward,
                ));
            }
        }

        let mut team1 = Team::new(
            "team1".to_string(),
            "Team One".to_string(),
            "ONE".to_string(),
            "England".to_string(),
            "City".to_string(),
            "Ground".to_string(),
            20_000,
        );
        team1.starting_xi_ids = players
            .iter()
            .filter(|player| player.team_id.as_deref() == Some("team1"))
            .map(|player| player.id.clone())
            .collect();
        let mut team2 = Team::new(
            "team2".to_string(),
            "Team Two".to_string(),
            "TWO".to_string(),
            "England".to_string(),
            "Town".to_string(),
            "Arena".to_string(),
            20_000,
        );
        team2.starting_xi_ids = players
            .iter()
            .filter(|player| player.team_id.as_deref() == Some("team2"))
            .map(|player| player.id.clone())
            .collect();

        let fixture = Fixture {
            id: "wc-r32-73".to_string(),
            matchday: 73,
            date: "2026-06-28".to_string(),
            home_team_id: "team1".to_string(),
            away_team_id: "team2".to_string(),
            competition_id: Some("world-cup-2026".to_string()),
            season: Some(2026),
            competition: FixtureCompetition::WorldCup,
            stage: Some("r32".to_string()),
            ..Fixture::default()
        };
        let standings = vec![
            StandingEntry::new("team1".to_string()),
            StandingEntry::new("team2".to_string()),
        ];
        let league = League {
            id: "world-cup-2026".to_string(),
            name: "World Cup 2026".to_string(),
            season: 2026,
            fixtures: if legacy_has_fixture {
                vec![fixture.clone()]
            } else {
                Vec::new()
            },
            standings: standings.clone(),
            transfer_log: Vec::new(),
        };
        let competition = Competition {
            id: "world-cup-2026".to_string(),
            name: "World Cup 2026".to_string(),
            season: 2026,
            kind: CompetitionKind::WorldCup,
            format: CompetitionFormat::GroupStageKnockout,
            country: None,
            tier: None,
            team_ids: vec!["team1".to_string(), "team2".to_string()],
            fixtures: vec![fixture],
            standings,
            transfer_log: Vec::new(),
        };

        let mut game = Game::new(
            clock,
            manager,
            vec![team1, team2],
            players,
            Vec::new(),
            Vec::new(),
        );
        game.league = Some(league);
        game.competitions = vec![competition];
        game
    }

    #[test]
    fn vacation_processes_worldcup_knockout_fixture_on_target_date() {
        let state = StateManager::new();
        state.set_game(worldcup_r32_game((2026, 6, 27), true));
        state.set_stats_state(StatsState::default());

        let response = advance_to_date(
            &state,
            "2026-06-28",
            VacationSettings {
                handle_matches: true,
                return_for_user_match: false,
                ignore_soft_blockers: true,
                ..VacationSettings::default()
            },
        )
        .unwrap();
        let saved = state.get_game(|current| current.clone()).unwrap();
        let legacy_fixture = saved
            .league
            .as_ref()
            .unwrap()
            .fixtures
            .iter()
            .find(|fixture| fixture.id == "wc-r32-73")
            .unwrap();
        let competition_fixture = saved
            .competitions
            .iter()
            .flat_map(|competition| competition.fixtures.iter())
            .find(|fixture| fixture.id == "wc-r32-73")
            .unwrap();

        assert_eq!(response.action, "arrived");
        assert_eq!(response.days_advanced, 2);
        assert_eq!(response.report.ended_at, "2026-06-29");
        assert_eq!(legacy_fixture.status, FixtureStatus::Completed);
        assert_eq!(competition_fixture.status, FixtureStatus::Completed);
        assert!(legacy_fixture
            .result
            .as_ref()
            .unwrap()
            .winner_team_id
            .is_some());
        assert!(competition_fixture
            .result
            .as_ref()
            .unwrap()
            .winner_team_id
            .is_some());
        assert_eq!(response.report.match_results[0].fixture_id, "wc-r32-73");
    }

    #[test]
    fn vacation_repairs_missing_legacy_worldcup_fixture_before_processing_target_date() {
        let state = StateManager::new();
        state.set_game(worldcup_r32_game((2026, 5, 25), false));
        state.set_stats_state(StatsState::default());

        let response = advance_to_date(
            &state,
            "2026-06-28",
            VacationSettings {
                handle_matches: true,
                return_for_user_match: false,
                ignore_soft_blockers: true,
                ..VacationSettings::default()
            },
        )
        .unwrap();
        let saved = state.get_game(|current| current.clone()).unwrap();
        let legacy_fixture = saved
            .league
            .as_ref()
            .unwrap()
            .fixtures
            .iter()
            .find(|fixture| fixture.id == "wc-r32-73")
            .expect("legacy R32 fixture");
        let competition_fixture = saved
            .competitions
            .iter()
            .flat_map(|competition| competition.fixtures.iter())
            .find(|fixture| fixture.id == "wc-r32-73")
            .expect("competition R32 fixture");

        assert_eq!(response.action, "arrived");
        assert_eq!(response.report.ended_at, "2026-06-29");
        assert_eq!(legacy_fixture.status, FixtureStatus::Completed);
        assert_eq!(competition_fixture.status, FixtureStatus::Completed);
        assert!(legacy_fixture.result.is_some());
        assert!(competition_fixture.result.is_some());
        assert_eq!(response.report.match_results[0].fixture_id, "wc-r32-73");
    }
}
