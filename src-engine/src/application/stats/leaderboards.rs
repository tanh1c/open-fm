use ofm_core::leaderboards::{
    compute_global_player_leaderboards, GlobalPlayerLeaderboardQuery, GlobalPlayerLeaderboards,
};
use ofm_core::state::StateManager;

pub fn get_global_player_leaderboards_internal(
    state: &StateManager,
    query: GlobalPlayerLeaderboardQuery,
) -> Result<GlobalPlayerLeaderboards, String> {
    let game = state
        .get_game(|game| game.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;
    let stats = state
        .get_stats_state(|stats| stats.clone())
        .unwrap_or_default();

    Ok(compute_global_player_leaderboards(&game, &stats, query))
}
