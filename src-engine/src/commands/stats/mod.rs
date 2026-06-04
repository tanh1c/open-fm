mod dto;
mod leaderboards;
mod player;
mod shared;
mod team;

#[cfg(test)]
mod tests;

use ofm_core::state::StateManager;
use tauri::State;

use ofm_core::leaderboards::{GlobalPlayerLeaderboardQuery, GlobalPlayerLeaderboards};

use self::dto::{
    PlayerMatchHistoryEntryDto, PlayerStatsOverviewDto, TeamMatchHistoryEntryDto,
    TeamStatsOverviewDto,
};
use self::leaderboards::get_global_player_leaderboards_internal;
use self::player::{get_player_match_history_internal, get_player_stats_overview_internal};
use self::team::{get_team_match_history_internal, get_team_stats_overview_internal};
use crate::application::stats::{dto::MatchDetailDto, get_match_detail_internal};

#[tauri::command]
pub fn get_player_match_history(
    state: State<'_, StateManager>,
    player_id: String,
    limit: Option<usize>,
) -> Result<Vec<PlayerMatchHistoryEntryDto>, String> {
    get_player_match_history_internal(&state, &player_id, limit)
}

#[tauri::command]
pub fn get_player_stats_overview(
    state: State<'_, StateManager>,
    player_id: String,
) -> Result<PlayerStatsOverviewDto, String> {
    get_player_stats_overview_internal(&state, &player_id)
}

#[tauri::command]
pub fn get_team_stats_overview(
    state: State<'_, StateManager>,
    team_id: String,
) -> Result<Option<TeamStatsOverviewDto>, String> {
    get_team_stats_overview_internal(&state, &team_id)
}

#[tauri::command]
pub fn get_team_match_history(
    state: State<'_, StateManager>,
    team_id: String,
    limit: Option<usize>,
) -> Result<Vec<TeamMatchHistoryEntryDto>, String> {
    get_team_match_history_internal(&state, &team_id, limit)
}

#[tauri::command]
pub fn get_match_detail(
    state: State<'_, StateManager>,
    fixture_id: String,
) -> Result<Option<MatchDetailDto>, String> {
    get_match_detail_internal(&state, &fixture_id)
}

#[tauri::command]
pub fn get_global_player_leaderboards(
    state: State<'_, StateManager>,
    query: GlobalPlayerLeaderboardQuery,
) -> Result<GlobalPlayerLeaderboards, String> {
    get_global_player_leaderboards_internal(&state, query)
}
