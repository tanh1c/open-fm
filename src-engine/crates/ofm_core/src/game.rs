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
    /// Permanent end-of-season honours (champions + award standings), one entry
    /// per season. Small and kept for the whole career.
    #[serde(default)]
    pub season_honours: Vec<crate::honours::SeasonHonours>,
    /// All-time "best ever" records for the save.
    #[serde(default)]
    pub records: crate::honours::GameRecords,
    /// Hall of Fame: compact summaries of players who have retired. The full
    /// `Player` is removed from `players` on retirement to keep the roster bounded.
    #[serde(default)]
    pub retired_players: Vec<domain::player::RetiredPlayer>,
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
            season_honours: vec![],
            records: crate::honours::GameRecords::default(),
            retired_players: vec![],
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

    /// Propagate the legacy `league` fixtures/standings back into the mirrored
    /// competition that shares its id. Day simulation mutates only the legacy
    /// `game.league`, so without this the competition copy — which the frontend
    /// prefers when both exist — goes stale (e.g. friendlies never show a
    /// result, "next fixture" stays on a match already played). No-op when
    /// there is no legacy league or no competition mirrors it.
    pub fn sync_primary_competition_from_legacy_league(&mut self) {
        let Some(league) = self.league.as_ref() else {
            return;
        };
        let league_id = league.id.clone();
        let league_season = league.season;
        let synced_fixtures: Vec<_> = league
            .fixtures
            .iter()
            .cloned()
            .map(|mut fixture| {
                fixture.competition_id = Some(league_id.clone());
                fixture.season = Some(league_season);
                fixture
            })
            .collect();
        let synced_standings = league.standings.clone();
        let synced_transfer_log = league.transfer_log.clone();

        let Some(competition) = self
            .competitions
            .iter_mut()
            .find(|competition| competition.id == league_id)
        else {
            return;
        };
        competition.fixtures = synced_fixtures;
        competition.standings = synced_standings;
        competition.transfer_log = synced_transfer_log;
    }
}

#[cfg(test)]
mod sync_tests {
    use super::*;
    use domain::league::{
        Fixture, FixtureCompetition, FixtureStatus, MatchResult, StandingEntry,
    };

    fn scheduled_fixture(id: &str, home: &str, away: &str) -> Fixture {
        Fixture {
            id: id.to_string(),
            matchday: 1,
            date: "2026-07-03".to_string(),
            home_team_id: home.to_string(),
            away_team_id: away.to_string(),
            competition_id: Some("league-1".to_string()),
            season: Some(2026),
            competition: FixtureCompetition::Friendly,
            status: FixtureStatus::Scheduled,
            result: None,
        }
    }

    fn make_competition(fixtures: Vec<Fixture>) -> Competition {
        Competition {
            id: "league-1".to_string(),
            name: "League".to_string(),
            season: 2026,
            kind: CompetitionKind::DomesticLeague,
            format: CompetitionFormat::RoundRobin,
            country: None,
            tier: Some(1),
            team_ids: vec!["t1".to_string(), "t2".to_string()],
            fixtures,
            standings: vec![
                StandingEntry::new("t1".to_string()),
                StandingEntry::new("t2".to_string()),
            ],
            transfer_log: vec![],
        }
    }

    fn make_game(league: League, competitions: Vec<Competition>) -> Game {
        let clock = GameClock::new(chrono::Utc::now());
        let manager = Manager::new(
            "m1".to_string(),
            "Alex".to_string(),
            "Boss".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.league = Some(league);
        game.competitions = competitions;
        game
    }

    #[test]
    fn sync_copies_legacy_results_into_mirrored_competition() {
        let mut played = scheduled_fixture("fx-1", "t1", "t2");
        played.status = FixtureStatus::Completed;
        played.result = Some(MatchResult {
            home_goals: 2,
            away_goals: 1,
            home_scorers: vec![],
            away_scorers: vec![],
            report: None,
        });

        let league = League {
            id: "league-1".to_string(),
            name: "League".to_string(),
            season: 2026,
            fixtures: vec![played],
            standings: vec![
                StandingEntry::new("t1".to_string()),
                StandingEntry::new("t2".to_string()),
            ],
            transfer_log: vec![],
        };
        // Competition mirror still holds the stale scheduled copy.
        let competitions = vec![make_competition(vec![scheduled_fixture("fx-1", "t1", "t2")])];

        let mut game = make_game(league, competitions);
        game.sync_primary_competition_from_legacy_league();

        let mirrored = &game.competitions[0].fixtures[0];
        assert_eq!(mirrored.status, FixtureStatus::Completed);
        let result = mirrored.result.as_ref().expect("result synced");
        assert_eq!(result.home_goals, 2);
        assert_eq!(result.away_goals, 1);
    }

    #[test]
    fn sync_is_noop_without_a_matching_competition() {
        let league = League {
            id: "league-1".to_string(),
            name: "League".to_string(),
            season: 2026,
            fixtures: vec![scheduled_fixture("fx-1", "t1", "t2")],
            standings: vec![],
            transfer_log: vec![],
        };
        // A different competition id — must be left untouched.
        let mut other = make_competition(vec![scheduled_fixture("fx-1", "t1", "t2")]);
        other.id = "cup-1".to_string();

        let mut game = make_game(league, vec![other]);
        game.sync_primary_competition_from_legacy_league();

        assert_eq!(game.competitions[0].id, "cup-1");
        assert_eq!(game.competitions[0].fixtures[0].status, FixtureStatus::Scheduled);
    }
}
