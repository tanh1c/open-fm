// game lifecycle commands — port of src-engine/src/commands/game.rs.
//
// Differences vs the Tauri original:
//   * `world_source` filesystem path is gone. The web UI uploads or pastes a
//     JSON world; the worker passes the raw JSON via `start_new_game_with_world`.
//   * SaveManager is held by &self (Mutex inside AppHandle) instead of a Tauri
//     State<SaveManagerState> wrapper.

use chrono::TimeZone;
use domain::manager::Manager;
use domain::stats::StatsState;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;
use wasm_bindgen::prelude::*;

use super::{AppHandle, SAVE_MANAGER_LOCK_ERROR, to_js, to_js_value};

const NO_ACTIVE_SAVE_ERROR: &str = "be.error.noActiveSaveSession";

fn default_league_name() -> String {
    "Premier Division".to_string()
}

fn long_date_format() -> String {
    "%B %d, %Y".to_string()
}

fn default_save_name(manager_name: &str) -> String {
    format!("{}'s Career", manager_name)
}

fn validate_manager_inputs(
    first_name: &str,
    last_name: &str,
    dob: &str,
    nationality: &str,
) -> Result<(), String> {
    if first_name.is_empty() || last_name.is_empty() {
        return Err("be.error.createManager.nameRequired".to_string());
    }
    if first_name.len() > 30 || last_name.len() > 30 {
        return Err("be.error.createManager.nameMaxLength".to_string());
    }
    if nationality.is_empty() {
        return Err("be.error.createManager.nationalityRequired".to_string());
    }

    let birth_date = chrono::NaiveDate::parse_from_str(dob, "%Y-%m-%d")
        .map_err(|_| "be.error.createManager.invalidDobFormat".to_string())?;
    let today = chrono::Utc::now().date_naive();
    let age = today.signed_duration_since(birth_date).num_days() / 365;
    if age < 30 {
        return Err("be.error.createManager.minAge".to_string());
    }
    if age > 99 {
        return Err("be.error.createManager.invalidDob".to_string());
    }
    Ok(())
}

fn build_new_game(
    first_name: String,
    last_name: String,
    dob: String,
    nationality: String,
    world_json: Option<&str>,
) -> Result<Game, String> {
    let first_name = first_name.trim().to_string();
    let last_name = last_name.trim().to_string();
    let nationality = nationality.trim().to_string();
    validate_manager_inputs(&first_name, &last_name, &dob, &nationality)?;

    let manager = Manager::new(
        "mgr_user".to_string(),
        first_name,
        last_name,
        dob,
        nationality,
    );
    let start_date = chrono::Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
    let clock = GameClock::new(start_date);

    let (teams, players, staff) = match world_json {
        Some(json) => {
            let world = ofm_core::generator::load_world_from_json(json)?;
            (world.teams, world.players, world.staff)
        }
        None => ofm_core::generator::generate_world(None),
    };

    Ok(Game::new(clock, manager, teams, players, staff, vec![]))
}

#[wasm_bindgen]
impl AppHandle {
    /// Create a manager and generate a random world. Returns the Game so the UI
    /// can show team selection.
    #[wasm_bindgen(js_name = startNewGame)]
    pub fn start_new_game(
        &self,
        first_name: String,
        last_name: String,
        dob: String,
        nationality: String,
    ) -> Result<JsValue, JsValue> {
        let new_game =
            build_new_game(first_name, last_name, dob, nationality, None).map_err(to_js)?;
        self.state.set_game(new_game.clone());
        self.state.set_stats_state(StatsState::default());
        to_js_value(&new_game)
    }

    /// Like `start_new_game` but uses a user-supplied world JSON string instead
    /// of the bundled random generator.
    #[wasm_bindgen(js_name = startNewGameWithWorld)]
    pub fn start_new_game_with_world(
        &self,
        first_name: String,
        last_name: String,
        dob: String,
        nationality: String,
        world_json: String,
    ) -> Result<JsValue, JsValue> {
        let new_game =
            build_new_game(first_name, last_name, dob, nationality, Some(&world_json))
                .map_err(to_js)?;
        self.state.set_game(new_game.clone());
        self.state.set_stats_state(StatsState::default());
        to_js_value(&new_game)
    }

    /// Step 2: user picks a team. Hires manager, generates schedule + welcome
    /// messages, persists a new save row, returns the Game.
    #[wasm_bindgen(js_name = selectTeam)]
    pub fn select_team(&self, team_id: String) -> Result<JsValue, JsValue> {
        let mut game = self.snapshot_game()?;
        let team = game
            .teams
            .iter()
            .find(|t| t.id == team_id)
            .ok_or_else(|| to_js("be.error.teamNotFound".to_string()))?;
        let team_name = team.name.clone();
        let team_country = team.country.clone();

        game.manager.hire(team_id.clone());
        if let Some(t) = game.teams.iter_mut().find(|t| t.id == team_id) {
            t.manager_id = Some(game.manager.id.clone());
        }
        game.manager_id = game.manager.id.clone();
        ofm_core::ai_hiring::seed_ai_managers(&mut game);

        use chrono::Duration;
        let season_start = game.clock.current_date + Duration::days(30);
        let team_ids: Vec<String> = game.teams.iter().map(|t| t.id.clone()).collect();
        let user_domestic_team_ids: Vec<String> = game
            .teams
            .iter()
            .filter(|team| team.country == team_country)
            .map(|team| team.id.clone())
            .collect();
        let league_team_ids = if user_domestic_team_ids.len() >= 2 {
            user_domestic_team_ids.as_slice()
        } else {
            team_ids.as_slice()
        };
        let league_name = if user_domestic_team_ids.len() >= 2 {
            format!("{} Premier Division", team_country)
        } else {
            default_league_name()
        };
        let mut league =
            ofm_core::schedule::generate_league(&league_name, 2026, league_team_ids, season_start);
        let friendlies =
            ofm_core::schedule::generate_preseason_friendlies(league_team_ids, season_start, 4);
        ofm_core::schedule::append_fixtures(&mut league, friendlies);
        game.competitions = ofm_core::schedule::generate_domestic_competitions_by_country(
            &game.teams,
            2026,
            season_start,
        );
        if let Some(primary_competition) = game
            .competitions
            .iter_mut()
            .find(|competition| competition.country.as_deref() == Some(team_country.as_str()))
        {
            primary_competition.id = league.id.clone();
            primary_competition.name = league_name.clone();
            primary_competition.team_ids = league_team_ids.to_vec();
            primary_competition.fixtures = league
                .fixtures
                .iter()
                .cloned()
                .map(|mut fixture| {
                    fixture.competition = domain::league::FixtureCompetition::DomesticLeague;
                    fixture.competition_id = Some(league.id.clone());
                    fixture
                })
                .collect();
            primary_competition.standings = league.standings.clone();
            primary_competition.transfer_log = league.transfer_log.clone();
        } else {
            game.competitions.push(ofm_core::schedule::competition_from_league(
                &league,
                league_name.clone(),
                Some(team_country.clone()),
                Some(1),
            ));
        }
        if let Some(continental_competition) = ofm_core::schedule::generate_continental_group_stage(
            "Champions League",
            2026,
            &game.competitions,
            &game.teams,
            season_start + Duration::days(45),
        ) {
            game.competitions.push(continental_competition);
        }
        game.league = Some(league);
        ofm_core::season_context::refresh_game_context(&mut game);

        let date_str = game.clock.current_date.to_rfc3339();
        let welcome_msg = ofm_core::messages::welcome_message(&team_name, &team_id, &date_str);
        game.messages.push(welcome_msg);

        let season_msg = ofm_core::messages::season_schedule_message(
            &league_name,
            &season_start.format(&long_date_format()).to_string(),
            &date_str,
        );
        game.messages.push(season_msg);

        let team_names: Vec<String> = game.teams.iter().map(|team| team.name.clone()).collect();
        game.news
            .push(ofm_core::news::season_preview_article(&team_names, &date_str));

        let staff_msg = ofm_core::messages::staff_advice_message(&team_name, &team_id, &date_str);
        game.messages.push(staff_msg);

        ofm_core::player_events::generate_takeover_contract_review_message(&mut game);

        let manager_name = format!("{} {}", game.manager.first_name, game.manager.last_name);
        let save_name = default_save_name(&manager_name);

        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        let save_id = sm.create_save(&game, &save_name).map_err(to_js)?;
        drop(sm);

        self.state.set_save_id(save_id);
        self.state.set_game(game.clone());
        self.state.set_stats_state(StatsState::default());
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = getSaves)]
    pub fn get_saves(&self) -> Result<JsValue, JsValue> {
        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        let saves = sm.load_saves().map_err(to_js)?;
        to_js_value(&saves)
    }

    #[wasm_bindgen(js_name = deleteSave)]
    pub fn delete_save(&self, save_id: String) -> Result<JsValue, JsValue> {
        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        let removed = sm.delete_save(&save_id).map_err(to_js)?;
        to_js_value(&removed)
    }

    #[wasm_bindgen(js_name = loadGame)]
    pub fn load_game(&self, save_id: String) -> Result<JsValue, JsValue> {
        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        let mut game = sm.load_game(&save_id).map_err(to_js)?;
        let stats_state = sm.load_stats_state(&save_id).map_err(to_js)?;
        drop(sm);

        ofm_core::ai_hiring::seed_ai_managers(&mut game);
        ofm_core::season_context::refresh_game_context(&mut game);

        let mgr_name = format!("{} {}", game.manager.first_name, game.manager.last_name);

        self.state.set_save_id(save_id);
        self.state.set_game(game);
        self.state.set_stats_state(stats_state);
        to_js_value(&mgr_name)
    }

    #[wasm_bindgen(js_name = getActiveGame)]
    pub fn get_active_game(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        to_js_value(&game)
    }

    #[wasm_bindgen(js_name = saveGame)]
    pub fn save_game(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        let save_id = self
            .state
            .get_save_id()
            .ok_or_else(|| to_js(NO_ACTIVE_SAVE_ERROR.to_string()))?;

        let mut sm = self
            .save_manager
            .lock()
            .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
        sm.save_game(&game, &save_id).map_err(to_js)?;
        let stats_state = self
            .state
            .get_stats_state(|stats| stats.clone())
            .unwrap_or_default();
        sm.save_stats_state(&stats_state, &save_id).map_err(to_js)?;
        Ok(JsValue::NULL)
    }

    #[wasm_bindgen(js_name = exitToMenu)]
    pub fn exit_to_menu(&self) -> Result<JsValue, JsValue> {
        let game = self.snapshot_game()?;
        if let Some(save_id) = self.state.get_save_id() {
            let mut sm = self
                .save_manager
                .lock()
                .map_err(|_| to_js(SAVE_MANAGER_LOCK_ERROR.to_string()))?;
            sm.save_game(&game, &save_id).map_err(to_js)?;
            let stats_state = self
                .state
                .get_stats_state(|stats| stats.clone())
                .unwrap_or_default();
            sm.save_stats_state(&stats_state, &save_id).map_err(to_js)?;
        }
        self.state.clear_game();
        self.state.clear_save_id();
        Ok(JsValue::NULL)
    }
}
