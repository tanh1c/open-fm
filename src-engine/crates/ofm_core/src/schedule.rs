use chrono::{DateTime, Duration, Utc};
use domain::league::{
    Competition, CompetitionFormat, CompetitionKind, Fixture, FixtureCompetition, FixtureStatus,
    League,
};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Copy)]
pub struct DomesticLeagueTierDefinition {
    pub name: &'static str,
    pub tier: u8,
    pub target_team_count: usize,
    pub promotion_count: usize,
    pub relegation_count: usize,
}

#[derive(Debug, Clone, Copy)]
pub struct DomesticCupDefinition {
    pub name: &'static str,
    pub eligible_tiers: &'static [u8],
}

#[derive(Debug, Clone, Copy)]
pub struct DomesticPyramidDefinition {
    pub country: &'static str,
    pub leagues: &'static [DomesticLeagueTierDefinition],
    pub cups: &'static [DomesticCupDefinition],
}

const ENGLAND_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[
    DomesticLeagueTierDefinition {
        name: "Premier League",
        tier: 1,
        target_team_count: 20,
        promotion_count: 0,
        relegation_count: 3,
    },
    DomesticLeagueTierDefinition {
        name: "EFL Championship",
        tier: 2,
        target_team_count: 20,
        promotion_count: 3,
        relegation_count: 0,
    },
];

const FRANCE_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[
    DomesticLeagueTierDefinition {
        name: "Ligue 1",
        tier: 1,
        target_team_count: 18,
        promotion_count: 0,
        relegation_count: 3,
    },
    DomesticLeagueTierDefinition {
        name: "Ligue 2",
        tier: 2,
        target_team_count: 18,
        promotion_count: 3,
        relegation_count: 0,
    },
];

const GERMANY_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[
    DomesticLeagueTierDefinition {
        name: "Bundesliga",
        tier: 1,
        target_team_count: 18,
        promotion_count: 0,
        relegation_count: 3,
    },
    DomesticLeagueTierDefinition {
        name: "2. Bundesliga",
        tier: 2,
        target_team_count: 18,
        promotion_count: 3,
        relegation_count: 0,
    },
];

const ITALY_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[
    DomesticLeagueTierDefinition {
        name: "Serie A",
        tier: 1,
        target_team_count: 20,
        promotion_count: 0,
        relegation_count: 3,
    },
    DomesticLeagueTierDefinition {
        name: "Serie B",
        tier: 2,
        target_team_count: 20,
        promotion_count: 3,
        relegation_count: 0,
    },
];

const SPAIN_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[
    DomesticLeagueTierDefinition {
        name: "LaLiga",
        tier: 1,
        target_team_count: 20,
        promotion_count: 0,
        relegation_count: 3,
    },
    DomesticLeagueTierDefinition {
        name: "Segunda División",
        tier: 2,
        target_team_count: 20,
        promotion_count: 3,
        relegation_count: 0,
    },
];

const PORTUGAL_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[DomesticLeagueTierDefinition {
    name: "Primeira Liga",
    tier: 1,
    target_team_count: 18,
    promotion_count: 0,
    relegation_count: 0,
}];

const NETHERLANDS_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[DomesticLeagueTierDefinition {
    name: "Eredivisie",
    tier: 1,
    target_team_count: 18,
    promotion_count: 0,
    relegation_count: 0,
}];

const BELGIUM_LEAGUE_TIERS: &[DomesticLeagueTierDefinition] = &[DomesticLeagueTierDefinition {
    name: "Belgian Pro League",
    tier: 1,
    target_team_count: 16,
    promotion_count: 0,
    relegation_count: 0,
}];

const ENGLAND_CUPS: &[DomesticCupDefinition] = &[
    DomesticCupDefinition {
        name: "FA Cup",
        eligible_tiers: &[1, 2],
    },
    DomesticCupDefinition {
        name: "EFL Cup",
        eligible_tiers: &[1, 2],
    },
];

const FRANCE_CUPS: &[DomesticCupDefinition] = &[
    DomesticCupDefinition {
        name: "Coupe de France",
        eligible_tiers: &[1, 2],
    },
    DomesticCupDefinition {
        name: "Trophée des Champions",
        eligible_tiers: &[1],
    },
];

const GERMANY_CUPS: &[DomesticCupDefinition] = &[
    DomesticCupDefinition {
        name: "DFB-Pokal",
        eligible_tiers: &[1, 2],
    },
    DomesticCupDefinition {
        name: "DFL-Supercup",
        eligible_tiers: &[1],
    },
];

const ITALY_CUPS: &[DomesticCupDefinition] = &[
    DomesticCupDefinition {
        name: "Coppa Italia",
        eligible_tiers: &[1, 2],
    },
    DomesticCupDefinition {
        name: "Supercoppa Italiana",
        eligible_tiers: &[1],
    },
];

const SPAIN_CUPS: &[DomesticCupDefinition] = &[
    DomesticCupDefinition {
        name: "Copa del Rey",
        eligible_tiers: &[1, 2],
    },
    DomesticCupDefinition {
        name: "Supercopa de España",
        eligible_tiers: &[1],
    },
];

const PORTUGAL_CUPS: &[DomesticCupDefinition] = &[DomesticCupDefinition {
    name: "Taça de Portugal",
    eligible_tiers: &[1],
}];

const NETHERLANDS_CUPS: &[DomesticCupDefinition] = &[DomesticCupDefinition {
    name: "KNVB Cup",
    eligible_tiers: &[1],
}];

const BELGIUM_CUPS: &[DomesticCupDefinition] = &[DomesticCupDefinition {
    name: "Belgian Cup",
    eligible_tiers: &[1],
}];

pub const DOMESTIC_PYRAMID_DEFINITIONS: &[DomesticPyramidDefinition] = &[
    DomesticPyramidDefinition {
        country: "England",
        leagues: ENGLAND_LEAGUE_TIERS,
        cups: ENGLAND_CUPS,
    },
    DomesticPyramidDefinition {
        country: "France",
        leagues: FRANCE_LEAGUE_TIERS,
        cups: FRANCE_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Germany",
        leagues: GERMANY_LEAGUE_TIERS,
        cups: GERMANY_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Italy",
        leagues: ITALY_LEAGUE_TIERS,
        cups: ITALY_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Spain",
        leagues: SPAIN_LEAGUE_TIERS,
        cups: SPAIN_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Portugal",
        leagues: PORTUGAL_LEAGUE_TIERS,
        cups: PORTUGAL_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Netherlands",
        leagues: NETHERLANDS_LEAGUE_TIERS,
        cups: NETHERLANDS_CUPS,
    },
    DomesticPyramidDefinition {
        country: "Belgium",
        leagues: BELGIUM_LEAGUE_TIERS,
        cups: BELGIUM_CUPS,
    },
];

pub fn domestic_pyramid_definition(country: &str) -> Option<&'static DomesticPyramidDefinition> {
    DOMESTIC_PYRAMID_DEFINITIONS
        .iter()
        .find(|definition| definition.country == country)
}

/// Generate a full double round-robin schedule (home & away) for the given teams.
/// Matchdays are spaced 7 days apart starting from `start_date`.
/// Uses a rotation-based algorithm for balanced scheduling.
pub fn generate_league(
    name: &str,
    season: u32,
    team_ids: &[String],
    start_date: DateTime<Utc>,
) -> League {
    let n = team_ids.len();
    assert!(n >= 2);

    let league_id = Uuid::new_v4().to_string();
    let mut league = League::new(league_id, name.to_string(), season, team_ids);

    // For round-robin with n teams (n must be even; if odd, add a "bye" — we assume even here)
    // Number of rounds in a single round-robin = n - 1
    // Each round has n / 2 matches
    let rounds = n - 1;
    let half = n / 2;

    // Build a mutable list of team indices (fix index 0, rotate the rest)
    let mut indices: Vec<usize> = (0..n).collect();

    let mut matchday: u32 = 1;

    // First leg (home)
    for _round in 0..rounds {
        let round_date = start_date + Duration::days((matchday as i64 - 1) * 7);
        let date_str = round_date.format("%Y-%m-%d").to_string();

        for i in 0..half {
            let home_idx = indices[i];
            let away_idx = indices[n - 1 - i];

            let fixture = Fixture {
                id: Uuid::new_v4().to_string(),
                matchday,
                date: date_str.clone(),
                home_team_id: team_ids[home_idx].clone(),
                away_team_id: team_ids[away_idx].clone(),
                competition_id: Some(league.id.clone()),
                season: Some(season),
                competition: FixtureCompetition::League,
                status: FixtureStatus::Scheduled,
                result: None,
            };
            league.fixtures.push(fixture);
        }

        matchday += 1;

        // Rotate: keep index 0 fixed, rotate the rest
        let last = indices.pop().unwrap();
        indices.insert(1, last);
    }

    // Second leg (reverse home/away)
    let mut indices2: Vec<usize> = (0..n).collect();

    for _round in 0..rounds {
        let round_date = start_date + Duration::days((matchday as i64 - 1) * 7);
        let date_str = round_date.format("%Y-%m-%d").to_string();

        for i in 0..half {
            let home_idx = indices2[n - 1 - i]; // Reversed
            let away_idx = indices2[i];

            let fixture = Fixture {
                id: Uuid::new_v4().to_string(),
                matchday,
                date: date_str.clone(),
                home_team_id: team_ids[home_idx].clone(),
                away_team_id: team_ids[away_idx].clone(),
                competition_id: Some(league.id.clone()),
                season: Some(season),
                competition: FixtureCompetition::League,
                status: FixtureStatus::Scheduled,
                result: None,
            };
            league.fixtures.push(fixture);
        }

        matchday += 1;

        let last = indices2.pop().unwrap();
        indices2.insert(1, last);
    }

    league
}

pub fn competition_from_league(
    league: &League,
    name: String,
    country: Option<String>,
    tier: Option<u8>,
) -> Competition {
    Competition {
        id: league.id.clone(),
        name,
        season: league.season,
        kind: CompetitionKind::DomesticLeague,
        format: CompetitionFormat::RoundRobin,
        country,
        tier,
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
                fixture.competition = FixtureCompetition::DomesticLeague;
                fixture.competition_id = Some(league.id.clone());
                fixture.season = Some(league.season);
                fixture
            })
            .collect(),
        standings: league.standings.clone(),
        transfer_log: league.transfer_log.clone(),
    }
}

pub fn generate_domestic_competition(
    name: &str,
    season: u32,
    country: Option<String>,
    tier: Option<u8>,
    team_ids: &[String],
    start_date: DateTime<Utc>,
) -> Competition {
    let league = generate_league(name, season, team_ids, start_date);
    competition_from_league(&league, name.to_string(), country, tier)
}

pub fn generate_domestic_cup(
    name: &str,
    season: u32,
    country: Option<String>,
    team_ids: &[String],
    start_date: DateTime<Utc>,
) -> Competition {
    let competition_id = Uuid::new_v4().to_string();
    let mut fixtures = Vec::new();
    let mut round_team_ids = team_ids.to_vec();
    let mut matchday = 1;

    while round_team_ids.len() >= 2 {
        let round_date = start_date + Duration::days((matchday as i64 - 1) * 14);
        let date = round_date.format("%Y-%m-%d").to_string();
        let mut next_round_team_ids = Vec::new();

        for pairing in round_team_ids.chunks(2) {
            if pairing.len() == 1 {
                next_round_team_ids.push(pairing[0].clone());
                continue;
            }

            fixtures.push(Fixture {
                id: Uuid::new_v4().to_string(),
                matchday,
                date: date.clone(),
                home_team_id: pairing[0].clone(),
                away_team_id: pairing[1].clone(),
                competition_id: Some(competition_id.clone()),
                season: Some(season),
                competition: FixtureCompetition::DomesticCup,
                status: FixtureStatus::Scheduled,
                result: None,
            });
            next_round_team_ids.push(pairing[0].clone());
        }

        round_team_ids = next_round_team_ids;
        matchday += 1;
    }

    Competition {
        id: competition_id,
        name: name.to_string(),
        season,
        kind: CompetitionKind::DomesticCup,
        format: CompetitionFormat::Knockout,
        country,
        tier: None,
        team_ids: team_ids.to_vec(),
        fixtures,
        standings: Vec::new(),
        transfer_log: Vec::new(),
    }
}

fn split_country_teams_into_tiers(
    team_ids: &[String],
    definition: &DomesticPyramidDefinition,
) -> Vec<(&'static DomesticLeagueTierDefinition, Vec<String>)> {
    let mut remaining_team_ids = team_ids.to_vec();
    let mut tiers = Vec::new();

    for (index, league_definition) in definition.leagues.iter().enumerate() {
        if remaining_team_ids.len() < 2 {
            break;
        }

        let remaining_tiers = definition.leagues.len().saturating_sub(index + 1);
        let minimum_reserved = remaining_tiers * 2;
        let target = league_definition
            .target_team_count
            .min(remaining_team_ids.len().saturating_sub(minimum_reserved));
        let tier_size = target.max(2).min(remaining_team_ids.len());
        let tier_team_ids = remaining_team_ids.drain(..tier_size).collect();
        tiers.push((league_definition, tier_team_ids));
    }

    tiers
}

fn eligible_cup_team_ids(
    tier_memberships: &[(&'static DomesticLeagueTierDefinition, Vec<String>)],
    cup_definition: &DomesticCupDefinition,
) -> Vec<String> {
    tier_memberships
        .iter()
        .filter(|(league_definition, _)| cup_definition.eligible_tiers.contains(&league_definition.tier))
        .flat_map(|(_, tier_team_ids)| tier_team_ids.iter().cloned())
        .collect()
}

fn generate_competitions_from_tier_memberships(
    country: &str,
    tier_memberships: &[(&'static DomesticLeagueTierDefinition, Vec<String>)],
    definition: &DomesticPyramidDefinition,
    season: u32,
    start_date: DateTime<Utc>,
) -> Vec<Competition> {
    let mut competitions: Vec<Competition> = tier_memberships
        .iter()
        .map(|(league_definition, tier_team_ids)| {
            generate_domestic_competition(
                league_definition.name,
                season,
                Some(country.to_string()),
                Some(league_definition.tier),
                tier_team_ids,
                start_date,
            )
        })
        .collect();

    for cup_definition in definition.cups {
        let cup_team_ids = eligible_cup_team_ids(tier_memberships, cup_definition);
        if cup_team_ids.len() < 2 {
            continue;
        }

        competitions.push(generate_domestic_cup(
            cup_definition.name,
            season,
            Some(country.to_string()),
            &cup_team_ids,
            start_date + Duration::days(30),
        ));
    }

    competitions
}

fn generate_pyramid_domestic_competitions(
    country: &str,
    teams: &[&domain::team::Team],
    definition: &DomesticPyramidDefinition,
    season: u32,
    start_date: DateTime<Utc>,
) -> Vec<Competition> {
    let explicit_tiers: Vec<(&'static DomesticLeagueTierDefinition, Vec<String>)> = definition
        .leagues
        .iter()
        .filter_map(|league_definition| {
            let team_ids: Vec<String> = teams
                .iter()
                .filter(|team| team.domestic_tier == Some(league_definition.tier))
                .map(|team| team.id.clone())
                .collect();
            (team_ids.len() >= 2).then_some((league_definition, team_ids))
        })
        .collect();

    let tier_memberships = if explicit_tiers.is_empty() {
        let team_ids: Vec<String> = teams.iter().map(|team| team.id.clone()).collect();
        split_country_teams_into_tiers(&team_ids, definition)
    } else {
        explicit_tiers
    };

    generate_competitions_from_tier_memberships(country, &tier_memberships, definition, season, start_date)
}

pub fn generate_domestic_competitions_for_tier_memberships(
    country: &str,
    tier_memberships: &[(u8, Vec<String>)],
    season: u32,
    start_date: DateTime<Utc>,
) -> Option<Vec<Competition>> {
    let definition = domestic_pyramid_definition(country)?;
    let resolved_memberships: Vec<(&'static DomesticLeagueTierDefinition, Vec<String>)> = definition
        .leagues
        .iter()
        .filter_map(|league_definition| {
            let team_ids = tier_memberships
                .iter()
                .find(|(tier, _)| *tier == league_definition.tier)
                .map(|(_, team_ids)| team_ids.clone())?;
            (team_ids.len() >= 2).then_some((league_definition, team_ids))
        })
        .collect();

    (!resolved_memberships.is_empty()).then(|| {
        generate_competitions_from_tier_memberships(
            country,
            &resolved_memberships,
            definition,
            season,
            start_date,
        )
    })
}

pub fn generate_domestic_competitions_by_country(
    teams: &[domain::team::Team],
    season: u32,
    start_date: DateTime<Utc>,
) -> Vec<Competition> {
    let mut countries: Vec<String> = teams.iter().map(|team| team.country.clone()).collect();
    countries.sort();
    countries.dedup();

    countries
        .into_iter()
        .flat_map(|country| {
            let mut country_teams: Vec<&domain::team::Team> = teams
                .iter()
                .filter(|team| team.country == country)
                .collect();
            country_teams.sort_by(|left, right| {
                right
                    .reputation
                    .cmp(&left.reputation)
                    .then(left.name.cmp(&right.name))
                    .then(left.id.cmp(&right.id))
            });
            if country_teams.len() < 2 {
                return Vec::new();
            }

            if let Some(definition) = domestic_pyramid_definition(&country) {
                let competitions = generate_pyramid_domestic_competitions(
                    &country,
                    &country_teams,
                    definition,
                    season,
                    start_date,
                );
                if !competitions.is_empty() {
                    return competitions;
                }
            }

            let team_ids: Vec<String> = country_teams
                .into_iter()
                .map(|team| team.id.clone())
                .collect();
            vec![generate_domestic_competition(
                &format!("{} Premier Division", country),
                season,
                Some(country),
                Some(1),
                &team_ids,
                start_date,
            )]
        })
        .collect()
}

pub fn generate_continental_group_stage(
    name: &str,
    season: u32,
    domestic_competitions: &[Competition],
    teams: &[domain::team::Team],
    start_date: DateTime<Utc>,
) -> Option<Competition> {
    let reputation_by_team: HashMap<&str, u32> = teams
        .iter()
        .map(|team| (team.id.as_str(), team.reputation))
        .collect();
    let mut qualified_team_ids = Vec::new();

    for competition in domestic_competitions.iter().filter(|competition| {
        competition.kind == CompetitionKind::DomesticLeague && competition.tier == Some(1)
    }) {
        let has_finished_standings = competition.standings.iter().any(|standing| standing.played > 0);
        let mut entrants: Vec<String> = if has_finished_standings {
            let mut standings = competition.standings.clone();
            standings.sort_by(|left, right| {
                right
                    .points
                    .cmp(&left.points)
                    .then(right.goal_difference().cmp(&left.goal_difference()))
                    .then(right.goals_for.cmp(&left.goals_for))
                    .then(left.team_id.cmp(&right.team_id))
            });
            standings
                .into_iter()
                .map(|standing| standing.team_id)
                .collect()
        } else {
            let mut entrants = competition.team_ids.clone();
            entrants.sort_by(|left, right| {
                reputation_by_team
                    .get(right.as_str())
                    .unwrap_or(&0)
                    .cmp(reputation_by_team.get(left.as_str()).unwrap_or(&0))
                    .then(left.cmp(right))
            });
            entrants
        };
        qualified_team_ids.extend(entrants.drain(..entrants.len().min(2)));
    }

    qualified_team_ids.sort();
    qualified_team_ids.dedup();

    if qualified_team_ids.len() < 4 {
        return None;
    }

    let max_teams = qualified_team_ids.len().min(16);
    qualified_team_ids.truncate(max_teams - (max_teams % 4));
    if qualified_team_ids.len() < 4 {
        return None;
    }

    let competition_id = Uuid::new_v4().to_string();
    let mut fixtures = Vec::new();
    let mut matchday = 1;

    for group in qualified_team_ids.chunks(4) {
        for round in 0..3 {
            let date = (start_date + Duration::days((matchday as i64 - 1) * 14))
                .format("%Y-%m-%d")
                .to_string();
            let pairings = match round {
                0 => [(0, 1), (2, 3)],
                1 => [(0, 2), (1, 3)],
                _ => [(0, 3), (1, 2)],
            };

            for (left, right) in pairings {
                fixtures.push(Fixture {
                    id: Uuid::new_v4().to_string(),
                    matchday,
                    date: date.clone(),
                    home_team_id: group[left].clone(),
                    away_team_id: group[right].clone(),
                    competition_id: Some(competition_id.clone()),
                    season: Some(season),
                    competition: FixtureCompetition::ContinentalLeague,
                    status: FixtureStatus::Scheduled,
                    result: None,
                });
            }
            matchday += 1;
        }
    }

    Some(Competition {
        id: competition_id,
        name: name.to_string(),
        season,
        kind: CompetitionKind::ContinentalLeague,
        format: CompetitionFormat::GroupStageKnockout,
        country: None,
        tier: None,
        team_ids: qualified_team_ids,
        fixtures,
        standings: Vec::new(),
        transfer_log: Vec::new(),
    })
}

pub fn generate_preseason_friendlies(
    team_ids: &[String],
    season_start: DateTime<Utc>,
    max_friendlies: usize,
) -> Vec<Fixture> {
    if team_ids.len() < 2 || max_friendlies == 0 {
        return Vec::new();
    }

    let mut rotation: Vec<Option<usize>> = (0..team_ids.len()).map(Some).collect();
    if rotation.len() % 2 != 0 {
        rotation.push(None);
    }

    let rounds_available = rotation.len().saturating_sub(1);
    let rounds_to_schedule = max_friendlies.min(rounds_available);
    if rounds_to_schedule == 0 {
        return Vec::new();
    }

    let half = rotation.len() / 2;
    let mut fixtures = Vec::with_capacity(rounds_to_schedule * half);

    for round in 0..rounds_to_schedule {
        let weeks_before_start = (rounds_to_schedule.saturating_sub(round)) as i64;
        let date = (season_start - Duration::days(weeks_before_start * 7))
            .format("%Y-%m-%d")
            .to_string();

        for i in 0..half {
            let Some(left_idx) = rotation[i] else {
                continue;
            };
            let Some(right_idx) = rotation[rotation.len() - 1 - i] else {
                continue;
            };

            let (home_idx, away_idx) = if (round + i) % 2 == 0 {
                (left_idx, right_idx)
            } else {
                (right_idx, left_idx)
            };

            fixtures.push(Fixture {
                id: Uuid::new_v4().to_string(),
                matchday: 0,
                date: date.clone(),
                home_team_id: team_ids[home_idx].clone(),
                away_team_id: team_ids[away_idx].clone(),
                competition_id: None,
                season: None,
                competition: FixtureCompetition::Friendly,
                status: FixtureStatus::Scheduled,
                result: None,
            });
        }

        let last = rotation.pop().unwrap();
        rotation.insert(1, last);
    }

    fixtures
}

pub fn append_fixtures(league: &mut League, mut additional_fixtures: Vec<Fixture>) {
    league.fixtures.append(&mut additional_fixtures);
    league.fixtures.sort_by(|left, right| {
        left.date
            .cmp(&right.date)
            .then(left.matchday.cmp(&right.matchday))
            .then(left.id.cmp(&right.id))
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_generate_league_8_teams() {
        let teams: Vec<String> = (0..8).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let league = generate_league("Test League", 2026, &teams, start);

        // 8 teams: 7 rounds * 4 matches * 2 legs = 56 fixtures
        assert_eq!(league.fixtures.len(), 56);

        // 14 matchdays (7 per leg)
        let max_md = league.fixtures.iter().map(|f| f.matchday).max().unwrap();
        assert_eq!(max_md, 14);

        // Each team plays 14 matches total
        for team in &teams {
            let count = league
                .fixtures
                .iter()
                .filter(|f| f.home_team_id == *team || f.away_team_id == *team)
                .count();
            assert_eq!(count, 14, "Team {} plays {} matches", team, count);
        }

        // 8 standings entries
        assert_eq!(league.standings.len(), 8);
    }

    #[test]
    fn test_generate_league_16_teams() {
        let teams: Vec<String> = (0..16).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let league = generate_league("Premier Division", 2026, &teams, start);

        // 16 teams: 15 rounds * 8 matches * 2 legs = 240 fixtures
        assert_eq!(league.fixtures.len(), 240);

        // 30 matchdays (15 per leg)
        let max_md = league.fixtures.iter().map(|f| f.matchday).max().unwrap();
        assert_eq!(max_md, 30);

        // Each team plays 30 matches total (15 home + 15 away)
        for team in &teams {
            let count = league
                .fixtures
                .iter()
                .filter(|f| f.home_team_id == *team || f.away_team_id == *team)
                .count();
            assert_eq!(count, 30, "Team {} plays {} matches", team, count);
        }

        // 16 standings entries
        assert_eq!(league.standings.len(), 16);

        // No team plays itself
        for f in &league.fixtures {
            assert_ne!(f.home_team_id, f.away_team_id);
        }
    }

    fn test_team(
        id: &str,
        name: &str,
        country: &str,
        reputation: u32,
    ) -> domain::team::Team {
        let mut team = domain::team::Team::new(
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

    #[test]
    fn generate_domestic_competitions_uses_pyramid_for_defined_country() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let mut teams = vec![
            test_team("eng-1", "English One", "England", 900),
            test_team("eng-2", "English Two", "England", 800),
            test_team("eng-3", "English Three", "England", 700),
            test_team("eng-4", "English Four", "England", 600),
        ];
        teams[0].domestic_tier = Some(1);
        teams[1].domestic_tier = Some(1);
        teams[2].domestic_tier = Some(2);
        teams[3].domestic_tier = Some(2);

        let competitions = generate_domestic_competitions_by_country(&teams, 2026, start);

        assert_eq!(competitions.len(), 4);
        let premier_league = competitions
            .iter()
            .find(|competition| competition.name == "Premier League")
            .expect("Premier League should be generated");
        let championship = competitions
            .iter()
            .find(|competition| competition.name == "EFL Championship")
            .expect("EFL Championship should be generated");
        let fa_cup = competitions
            .iter()
            .find(|competition| competition.name == "FA Cup")
            .expect("FA Cup should be generated");
        let league_cup = competitions
            .iter()
            .find(|competition| competition.name == "EFL Cup")
            .expect("EFL Cup should be generated");

        assert_eq!(premier_league.country.as_deref(), Some("England"));
        assert_eq!(premier_league.kind, CompetitionKind::DomesticLeague);
        assert_eq!(premier_league.tier, Some(1));
        assert_eq!(premier_league.team_ids, vec!["eng-1", "eng-2"]);
        assert_eq!(premier_league.fixtures.len(), 2);
        assert_eq!(championship.country.as_deref(), Some("England"));
        assert_eq!(championship.kind, CompetitionKind::DomesticLeague);
        assert_eq!(championship.tier, Some(2));
        assert_eq!(championship.team_ids, vec!["eng-3", "eng-4"]);
        assert_eq!(championship.fixtures.len(), 2);
        assert_eq!(fa_cup.kind, CompetitionKind::DomesticCup);
        assert_eq!(fa_cup.format, CompetitionFormat::Knockout);
        assert_eq!(fa_cup.team_ids.len(), 4);
        assert_eq!(fa_cup.fixtures.len(), 3);
        assert!(fa_cup.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::DomesticCup
                && fixture.competition_id.as_deref() == Some(fa_cup.id.as_str())
                && !fixture.counts_for_league_standings()
        }));
        assert_eq!(league_cup.kind, CompetitionKind::DomesticCup);
        assert_eq!(league_cup.team_ids.len(), 4);
        assert_eq!(league_cup.fixtures.len(), 3);
        assert!(competitions
            .iter()
            .filter(|competition| competition.kind == CompetitionKind::DomesticLeague)
            .all(|competition| {
                competition.format == CompetitionFormat::RoundRobin
                    && competition.fixtures.iter().all(|fixture| {
                        fixture.competition == FixtureCompetition::DomesticLeague
                            && fixture.competition_id.as_deref() == Some(competition.id.as_str())
                    })
            }));
    }

    #[test]
    fn generate_domestic_competitions_matches_realistic_default_world() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let (teams, _, _) = crate::generator::generate_world(None);
        let competitions = generate_domestic_competitions_by_country(&teams, 2026, start);

        for country in ["England", "France", "Germany", "Italy", "Spain"] {
            assert_eq!(
                competitions
                    .iter()
                    .filter(|competition| competition.country.as_deref() == Some(country)
                        && competition.kind == CompetitionKind::DomesticLeague)
                    .count(),
                2,
                "{country} should have two domestic leagues",
            );
            assert_eq!(
                competitions
                    .iter()
                    .filter(|competition| competition.country.as_deref() == Some(country)
                        && competition.kind == CompetitionKind::DomesticCup)
                    .count(),
                2,
                "{country} should have two domestic cups",
            );
        }

        for country in ["Portugal", "Netherlands", "Belgium"] {
            assert_eq!(
                competitions
                    .iter()
                    .filter(|competition| competition.country.as_deref() == Some(country)
                        && competition.kind == CompetitionKind::DomesticLeague)
                    .count(),
                1,
                "{country} should have one domestic league",
            );
            assert_eq!(
                competitions
                    .iter()
                    .filter(|competition| competition.country.as_deref() == Some(country)
                        && competition.kind == CompetitionKind::DomesticCup)
                    .count(),
                1,
                "{country} should have one domestic cup",
            );
        }
    }

    #[test]
    fn generate_continental_group_stage_qualifies_top_domestic_clubs() {
        let start = Utc.with_ymd_and_hms(2026, 9, 15, 0, 0, 0).unwrap();
        let mut teams = Vec::new();
        for (index, country) in ["England", "Spain", "Germany", "France"].iter().enumerate() {
            for slot in 0..4 {
                let mut team = domain::team::Team::new(
                    format!("team-{index}-{slot}"),
                    format!("{country} {slot}"),
                    format!("{index}{slot}"),
                    country.to_string(),
                    country.to_string(),
                    "Ground".to_string(),
                    40_000,
                );
                team.reputation = 900 - slot as u32;
                teams.push(team);
            }
        }
        let domestic_competitions = generate_domestic_competitions_by_country(&teams, 2026, start);

        let competition = generate_continental_group_stage(
            "Champions League",
            2026,
            &domestic_competitions,
            &teams,
            start,
        )
        .expect("continental competition should be generated");

        assert_eq!(competition.kind, CompetitionKind::ContinentalLeague);
        assert_eq!(competition.format, CompetitionFormat::GroupStageKnockout);
        assert_eq!(competition.team_ids.len(), 8);
        assert!(competition.team_ids.contains(&"team-0-0".to_string()));
        assert!(competition.team_ids.contains(&"team-0-1".to_string()));
        assert!(!competition.team_ids.contains(&"team-0-2".to_string()));
        assert!(!competition.team_ids.contains(&"team-0-3".to_string()));
        assert_eq!(competition.fixtures.len(), 12);
        assert!(competition.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::ContinentalLeague
                && fixture.competition_id.as_deref() == Some(competition.id.as_str())
        }));
    }

    #[test]
    fn generate_continental_group_stage_uses_finished_top_tier_standings() {
        let start = Utc.with_ymd_and_hms(2026, 9, 15, 0, 0, 0).unwrap();
        let mut teams = Vec::new();
        for country in ["England", "Spain", "Germany", "France"] {
            for slot in 0..4 {
                let mut team = test_team(
                    &format!("{country}-{slot}"),
                    &format!("{country} {slot}"),
                    country,
                    900 - slot as u32,
                );
                team.domestic_tier = Some(if slot < 2 { 1 } else { 2 });
                if slot >= 2 {
                    team.reputation = 1_000;
                }
                teams.push(team);
            }
        }
        let mut domestic_competitions = generate_domestic_competitions_by_country(&teams, 2026, start);

        for competition in domestic_competitions.iter_mut().filter(|competition| {
            competition.kind == CompetitionKind::DomesticLeague && competition.tier == Some(1)
        }) {
            for (index, standing) in competition.standings.iter_mut().enumerate() {
                standing.played = 2;
                standing.points = if index == 0 { 1 } else { 6 };
            }
        }

        let competition = generate_continental_group_stage(
            "Champions League",
            2027,
            &domestic_competitions,
            &teams,
            start,
        )
        .expect("continental competition should be generated");

        assert!(competition.team_ids.contains(&"England-1".to_string()));
        assert!(competition.team_ids.contains(&"England-0".to_string()));
        assert!(!competition.team_ids.contains(&"England-2".to_string()));
        assert!(!competition.team_ids.contains(&"England-3".to_string()));
    }

    #[test]
    fn generate_preseason_friendlies_marks_fixtures_as_friendlies() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let friendlies = generate_preseason_friendlies(
            &[
                "team_1".to_string(),
                "team_2".to_string(),
                "team_3".to_string(),
                "team_4".to_string(),
            ],
            start,
            3,
        );

        assert_eq!(friendlies.len(), 6);
        assert!(
            friendlies
                .iter()
                .all(|fixture| fixture.competition == FixtureCompetition::Friendly)
        );
        assert!(friendlies.iter().all(|fixture| fixture.matchday == 0));
        assert_eq!(friendlies[0].date, "2026-07-11");
        assert_eq!(friendlies[5].date, "2026-07-25");
    }

    #[test]
    fn generate_preseason_friendlies_gives_each_team_a_fixture_each_week() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let teams: Vec<String> = (1..=8).map(|n| format!("team_{}", n)).collect();
        let friendlies = generate_preseason_friendlies(&teams, start, 4);

        assert_eq!(friendlies.len(), 16);

        for team in &teams {
            let appearances = friendlies
                .iter()
                .filter(|fixture| fixture.home_team_id == *team || fixture.away_team_id == *team)
                .count();
            assert_eq!(
                appearances, 4,
                "{team} should get one fixture per preseason week"
            );
        }
    }

    #[test]
    fn generate_preseason_friendlies_does_not_double_book_teams_on_same_day() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let teams: Vec<String> = (1..=16).map(|n| format!("team_{}", n)).collect();
        let friendlies = generate_preseason_friendlies(&teams, start, 4);

        let unique_dates: std::collections::HashSet<_> = friendlies
            .iter()
            .map(|fixture| fixture.date.clone())
            .collect();
        assert_eq!(unique_dates.len(), 4);

        for date in unique_dates {
            for team in &teams {
                let appearances = friendlies
                    .iter()
                    .filter(|fixture| {
                        fixture.date == date
                            && (fixture.home_team_id == *team || fixture.away_team_id == *team)
                    })
                    .count();
                assert!(appearances <= 1, "{team} is double-booked on {date}");
            }
        }
    }
}
