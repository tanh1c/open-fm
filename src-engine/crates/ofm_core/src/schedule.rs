use chrono::{DateTime, Duration, Utc};
use domain::league::{
    Competition, CompetitionFormat, CompetitionKind, Fixture, FixtureCompetition, FixtureStatus,
    League,
};
use std::collections::HashMap;
use uuid::Uuid;

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
        .filter_map(|country| {
            let team_ids: Vec<String> = teams
                .iter()
                .filter(|team| team.country == country)
                .map(|team| team.id.clone())
                .collect();

            if team_ids.len() < 2 {
                return None;
            }

            Some(generate_domestic_competition(
                &format!("{} Premier Division", country),
                season,
                Some(country),
                Some(1),
                &team_ids,
                start_date,
            ))
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

    for competition in domestic_competitions
        .iter()
        .filter(|competition| competition.kind == CompetitionKind::DomesticLeague)
    {
        let mut entrants = competition.team_ids.clone();
        entrants.sort_by(|left, right| {
            reputation_by_team
                .get(right.as_str())
                .unwrap_or(&0)
                .cmp(reputation_by_team.get(left.as_str()).unwrap_or(&0))
                .then(left.cmp(right))
        });
        qualified_team_ids.extend(entrants.into_iter().take(2));
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

    #[test]
    fn generate_domestic_competitions_groups_teams_by_country() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let teams = vec![
            domain::team::Team::new(
                "eng-1".to_string(),
                "English One".to_string(),
                "EO".to_string(),
                "England".to_string(),
                "London".to_string(),
                "Ground".to_string(),
                40_000,
            ),
            domain::team::Team::new(
                "eng-2".to_string(),
                "English Two".to_string(),
                "ET".to_string(),
                "England".to_string(),
                "Manchester".to_string(),
                "Ground".to_string(),
                40_000,
            ),
            domain::team::Team::new(
                "de-1".to_string(),
                "German One".to_string(),
                "GO".to_string(),
                "Germany".to_string(),
                "Berlin".to_string(),
                "Ground".to_string(),
                40_000,
            ),
            domain::team::Team::new(
                "de-2".to_string(),
                "German Two".to_string(),
                "GT".to_string(),
                "Germany".to_string(),
                "Munich".to_string(),
                "Ground".to_string(),
                40_000,
            ),
        ];

        let competitions = generate_domestic_competitions_by_country(&teams, 2026, start);

        assert_eq!(competitions.len(), 2);
        assert!(competitions.iter().all(|competition| {
            competition.kind == CompetitionKind::DomesticLeague
                && competition.format == CompetitionFormat::RoundRobin
                && competition.fixtures.len() == 2
                && competition.fixtures.iter().all(|fixture| {
                    fixture.competition == FixtureCompetition::DomesticLeague
                        && fixture.competition_id.as_deref() == Some(competition.id.as_str())
                })
        }));
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
        assert_eq!(competition.fixtures.len(), 12);
        assert!(competition.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::ContinentalLeague
                && fixture.competition_id.as_deref() == Some(competition.id.as_str())
        }));
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
