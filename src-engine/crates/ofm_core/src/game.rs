use crate::clock::GameClock;
use domain::league::{Competition, CompetitionFormat, CompetitionKind, League};
use domain::manager::Manager;
use domain::message::InboxMessage;
use domain::news::NewsArticle;
use domain::player::{Player, Position};
use domain::season::SeasonContext;
use domain::staff::Staff;
use domain::team::Team;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObjectiveType {
    LeaguePosition,
    Wins,
    GoalsScored,
    FinancialStability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardObjective {
    pub id: String,
    pub description: String,
    pub target: u32,
    pub objective_type: ObjectiveType,
    pub met: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoutingAssignment {
    pub id: String,
    pub scout_id: String,
    pub player_id: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum YouthScoutingRegion {
    #[default]
    Domestic,
    International,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum YouthScoutingObjective {
    #[default]
    Balanced,
    HighPotential,
    ReadySoon,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouthScoutingAssignment {
    pub id: String,
    pub scout_id: String,
    #[serde(default)]
    pub region: YouthScoutingRegion,
    #[serde(default)]
    pub objective: YouthScoutingObjective,
    pub target_position: Option<Position>,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub clock: GameClock,
    pub manager: Manager,
    #[serde(default)]
    pub manager_id: String,
    #[serde(default)]
    pub managers: Vec<Manager>,
    pub teams: Vec<Team>,
    pub players: Vec<Player>,
    pub staff: Vec<Staff>,
    pub messages: Vec<InboxMessage>,
    #[serde(default)]
    pub news: Vec<NewsArticle>,
    pub league: Option<League>,
    #[serde(default)]
    pub competitions: Vec<Competition>,
    #[serde(default)]
    pub scouting_assignments: Vec<ScoutingAssignment>,
    #[serde(default)]
    pub youth_scouting_assignments: Vec<YouthScoutingAssignment>,
    #[serde(default)]
    pub board_objectives: Vec<BoardObjective>,
    #[serde(default)]
    pub season_context: SeasonContext,
    #[serde(default)]
    pub days_since_last_job_offer: Option<u32>,
    #[serde(default)]
    pub vacant_team_days: HashMap<String, u32>,
}

impl Game {
    pub fn new(
        clock: GameClock,
        manager: Manager,
        teams: Vec<Team>,
        players: Vec<Player>,
        staff: Vec<Staff>,
        messages: Vec<InboxMessage>,
    ) -> Self {
        let manager_id = manager.id.clone();
        let managers = vec![manager.clone()];
        let mut game = Self {
            clock,
            manager,
            manager_id,
            managers,
            teams,
            players,
            staff,
            messages,
            news: vec![],
            league: None,
            competitions: vec![],
            scouting_assignments: vec![],
            youth_scouting_assignments: vec![],
            board_objectives: vec![],
            season_context: SeasonContext::default(),
            days_since_last_job_offer: None,
            vacant_team_days: HashMap::new(),
        };
        crate::football_identity::upgrade_game_football_identities(&mut game);
        crate::season_context::refresh_game_context(&mut game);
        game
    }

    pub fn sync_user_manager_record(&mut self) {
        let user_manager_id = self.manager_id.clone();
        if let Some(existing) = self
            .managers
            .iter_mut()
            .find(|manager| manager.id == user_manager_id)
        {
            *existing = self.manager.clone();
        } else {
            self.managers.push(self.manager.clone());
        }
    }

    pub fn sync_competitions_from_legacy_league(&mut self) {
        if !self.competitions.is_empty() {
            return;
        }

        let Some(league) = self.league.as_ref() else {
            return;
        };

        self.competitions.push(Competition {
            id: league.id.clone(),
            name: league.name.clone(),
            season: league.season,
            kind: CompetitionKind::DomesticLeague,
            format: CompetitionFormat::RoundRobin,
            country: None,
            tier: Some(1),
            team_ids: league
                .standings
                .iter()
                .map(|standing| standing.team_id.clone())
                .collect(),
            fixtures: league
                .fixtures
                .iter()
                .cloned()
                .map(|mut fixture| {
                    fixture.competition_id = Some(league.id.clone());
                    fixture.season = Some(league.season);
                    fixture
                })
                .collect(),
            standings: league.standings.clone(),
            transfer_log: league.transfer_log.clone(),
        });
    }

    pub fn primary_league_competition(&self) -> Option<&Competition> {
        let user_team_id = self.manager.team_id.as_deref();
        self.competitions
            .iter()
            .find(|competition| {
                competition.kind == CompetitionKind::DomesticLeague
                    && user_team_id.is_some_and(|team_id| competition.team_ids.iter().any(|id| id == team_id))
            })
            .or_else(|| {
                self.competitions
                    .iter()
                    .find(|competition| competition.kind == CompetitionKind::DomesticLeague)
            })
    }

    pub fn primary_league_competition_mut(&mut self) -> Option<&mut Competition> {
        let user_team_id = self.manager.team_id.clone();
        let competition_index = self
            .competitions
            .iter()
            .position(|competition| {
                competition.kind == CompetitionKind::DomesticLeague
                    && user_team_id
                        .as_ref()
                        .is_some_and(|team_id| competition.team_ids.iter().any(|id| id == team_id))
            })
            .or_else(|| {
                self.competitions
                    .iter()
                    .position(|competition| competition.kind == CompetitionKind::DomesticLeague)
            })?;

        self.competitions.get_mut(competition_index)
    }
}
