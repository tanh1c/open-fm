use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct League {
    pub id: String,
    pub name: String,
    pub season: u32,
    pub fixtures: Vec<Fixture>,
    pub standings: Vec<StandingEntry>,
    #[serde(default)]
    pub transfer_log: Vec<CompletedTransfer>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CompetitionKind {
    DomesticLeague,
    DomesticCup,
    ContinentalLeague,
    Friendly,
    PreseasonTournament,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CompetitionFormat {
    RoundRobin,
    GroupStageKnockout,
    Knockout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competition {
    pub id: String,
    pub name: String,
    pub season: u32,
    pub kind: CompetitionKind,
    pub format: CompetitionFormat,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub tier: Option<u8>,
    #[serde(default)]
    pub team_ids: Vec<String>,
    #[serde(default)]
    pub fixtures: Vec<Fixture>,
    #[serde(default)]
    pub standings: Vec<CompetitionStanding>,
    #[serde(default)]
    pub transfer_log: Vec<CompletedTransfer>,
}

pub type CompetitionStanding = StandingEntry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CompletedTransfer {
    pub date: String,
    pub from_team_id: String,
    pub to_team_id: String,
    pub player_id: String,
    pub fee: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum FixtureCompetition {
    #[default]
    League,
    DomesticLeague,
    DomesticCup,
    ContinentalLeague,
    Friendly,
    PreseasonTournament,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Fixture {
    pub id: String,
    pub matchday: u32,
    pub date: String, // ISO 8601 date
    pub home_team_id: String,
    pub away_team_id: String,
    #[serde(default)]
    pub competition_id: Option<String>,
    #[serde(default)]
    pub season: Option<u32>,
    pub competition: FixtureCompetition,
    pub status: FixtureStatus,
    pub result: Option<MatchResult>,
    /// Knockout stage identifier (e.g. "playoff", "r16", "qf", "sf", "final",
    /// "round_1"). `None` for round-robin league matches.
    #[serde(default)]
    pub stage: Option<String>,
    /// Leg number within a two-legged knockout tie (1 or 2). `None` for
    /// single-match ties and league fixtures.
    #[serde(default)]
    pub leg: Option<u8>,
    /// Stable identifier grouping the two legs of a knockout tie together so the
    /// frontend can render them as one bracket node and the engine can compute
    /// aggregate scores.
    #[serde(default)]
    pub tie_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FixtureStatus {
    Scheduled,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchResult {
    pub home_goals: u8,
    pub away_goals: u8,
    pub home_scorers: Vec<GoalEvent>,
    pub away_scorers: Vec<GoalEvent>,
    #[serde(default)]
    pub report: Option<CompactMatchReport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalEvent {
    pub player_id: String,
    pub minute: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactMatchReport {
    pub total_minutes: u8,
    pub home_stats: CompactTeamMatchStats,
    pub away_stats: CompactTeamMatchStats,
    pub events: Vec<CompactMatchEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactTeamMatchStats {
    pub possession_pct: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub fouls: u16,
    pub corners: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompactMatchEvent {
    pub minute: u8,
    pub event_type: String,
    pub side: String,
    pub player_id: Option<String>,
    pub secondary_player_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandingEntry {
    pub team_id: String,
    pub played: u32,
    pub won: u32,
    pub drawn: u32,
    pub lost: u32,
    pub goals_for: u32,
    pub goals_against: u32,
    pub points: u32,
}

impl StandingEntry {
    pub fn new(team_id: String) -> Self {
        Self {
            team_id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goals_for: 0,
            goals_against: 0,
            points: 0,
        }
    }

    pub fn goal_difference(&self) -> i32 {
        self.goals_for as i32 - self.goals_against as i32
    }

    pub fn record_result(&mut self, goals_for: u8, goals_against: u8) {
        self.played += 1;
        self.goals_for += goals_for as u32;
        self.goals_against += goals_against as u32;
        if goals_for > goals_against {
            self.won += 1;
            self.points += 3;
        } else if goals_for == goals_against {
            self.drawn += 1;
            self.points += 1;
        } else {
            self.lost += 1;
        }
    }
}

impl Fixture {
    pub fn counts_for_league_standings(&self) -> bool {
        matches!(self.competition, FixtureCompetition::League | FixtureCompetition::DomesticLeague)
    }

    /// Whether this fixture should update its competition's standings table.
    /// Domestic-league matches always do; continental matches do **only** during
    /// the Swiss league phase (`stage == None`) — knockout legs don't feed a
    /// table. Pure knockout cups have no standings at all.
    pub fn counts_for_competition_standings(&self) -> bool {
        match self.competition {
            FixtureCompetition::League | FixtureCompetition::DomesticLeague => true,
            FixtureCompetition::ContinentalLeague => self.stage.is_none(),
            _ => false,
        }
    }

    pub fn generates_match_report_news(&self) -> bool {
        matches!(
            self.competition,
            FixtureCompetition::League
                | FixtureCompetition::DomesticLeague
                | FixtureCompetition::DomesticCup
                | FixtureCompetition::ContinentalLeague
                | FixtureCompetition::Friendly
                | FixtureCompetition::PreseasonTournament
        )
    }
}

impl League {
    pub fn new(id: String, name: String, season: u32, team_ids: &[String]) -> Self {
        let standings = team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.clone()))
            .collect();

        Self {
            id,
            name,
            season,
            fixtures: Vec::new(),
            standings,
            transfer_log: Vec::new(),
        }
    }

    /// Sort standings by points, then goal difference, then goals scored
    pub fn sorted_standings(&self) -> Vec<StandingEntry> {
        let mut sorted = self.standings.clone();
        sorted.sort_by(|a, b| {
            b.points
                .cmp(&a.points)
                .then(b.goal_difference().cmp(&a.goal_difference()))
                .then(b.goals_for.cmp(&a.goals_for))
        });
        sorted
    }
}

impl Default for Fixture {
    fn default() -> Self {
        Self {
            id: String::new(),
            matchday: 0,
            date: String::new(),
            home_team_id: String::new(),
            away_team_id: String::new(),
            competition_id: None,
            season: None,
            competition: FixtureCompetition::League,
            status: FixtureStatus::Scheduled,
            result: None,
            stage: None,
            leg: None,
            tie_id: None,
        }
    }
}
