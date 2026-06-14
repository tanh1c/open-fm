use chrono::{DateTime, Datelike, Duration, Utc, Weekday};
use domain::league::{
    Competition, CompetitionFormat, CompetitionKind, Fixture, FixtureCompetition, FixtureStatus,
    League, StandingEntry,
};
use rand::SeedableRng;
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use std::collections::HashMap;
use uuid::Uuid;

/// Advance `date` forward to the next occurrence of `weekday` (or keep it if it
/// already falls on that weekday). Used to anchor league rounds to weekends and
/// cup rounds to midweek so a club isn't asked to play twice in two days.
fn on_or_after_weekday(date: DateTime<Utc>, weekday: Weekday) -> DateTime<Utc> {
    let current = date.weekday().num_days_from_monday() as i64;
    let target = weekday.num_days_from_monday() as i64;
    let delta = (target - current).rem_euclid(7);
    date + Duration::days(delta)
}

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
        target_team_count: 24,
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
        // Anchor each round to a weekend, alternating Saturday/Sunday so the
        // whole league isn't permanently locked to one weekday.
        let base = start_date + Duration::days((matchday as i64 - 1) * 7);
        let weekend_day = if matchday % 2 == 1 { Weekday::Sat } else { Weekday::Sun };
        let round_date = on_or_after_weekday(base, weekend_day);
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
                stage: None,
                leg: None,
                tie_id: None,
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
        let base = start_date + Duration::days((matchday as i64 - 1) * 7);
        let weekend_day = if matchday % 2 == 1 { Weekday::Sat } else { Weekday::Sun };
        let round_date = on_or_after_weekday(base, weekend_day);
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
                stage: None,
                leg: None,
                tie_id: None,
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

    // Seed a deterministic-yet-distinct bracket per cup. Without this, two cups
    // over the same teams (e.g. England's FA Cup + EFL Cup) pair `chunks(2)` in
    // identical order and produce the exact same bracket. Seeding from the cup
    // name + season keeps a given save reproducible while differing per cup.
    let seed = {
        let mut hash: u64 = 1469598103934665603; // FNV-1a offset basis
        for byte in name.bytes().chain(season.to_le_bytes()) {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(1099511628211);
        }
        hash
    };
    let mut rng = StdRng::seed_from_u64(seed);
    round_team_ids.shuffle(&mut rng);

    // Only the FIRST round is scheduled up front. Later rounds are generated by
    // `crate::knockout::process_knockout_progression` once a round's results are
    // known, so the bracket reflects the real winners instead of assuming the
    // higher-listed team always advances. With a non-power-of-two field, the
    // surplus teams play a preliminary first round and the rest receive byes
    // (they simply aren't scheduled and join round two via the alive-set logic).
    let n = round_team_ids.len();
    if n >= 2 {
        // A standard bracket with byes: `smallest_pow2_ge(n) - n` teams receive a
        // first-round bye, the rest play. So the first round has `(n - byes) / 2`
        // matches. For a power-of-two field that's a full round (n/2 matches);
        // otherwise it's a preliminary round that trims the field to a power of
        // two. Byed teams aren't scheduled — the progression's alive-set keeps
        // them in for round two.
        let byes = crate::knockout::smallest_pow2_ge(n) - n;
        let first_round_matches = (n - byes) / 2;
        let stage = crate::knockout::knockout_stage_label(crate::knockout::smallest_pow2_ge(n));
        let base = start_date;
        let round_date = on_or_after_weekday(base, Weekday::Wed);
        let date = round_date.format("%Y-%m-%d").to_string();
        for pair_index in 0..first_round_matches {
            let home = round_team_ids[pair_index * 2].clone();
            let away = round_team_ids[pair_index * 2 + 1].clone();
            fixtures.push(Fixture {
                id: Uuid::new_v4().to_string(),
                matchday: 1,
                date: date.clone(),
                home_team_id: home,
                away_team_id: away,
                competition_id: Some(competition_id.clone()),
                season: Some(season),
                competition: FixtureCompetition::DomesticCup,
                status: FixtureStatus::Scheduled,
                result: None,
                stage: Some(stage.clone()),
                leg: None,
                tie_id: None,
            });
        }
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

    for (cup_index, cup_definition) in definition.cups.iter().enumerate() {
        let cup_team_ids = eligible_cup_team_ids(tier_memberships, cup_definition);
        if cup_team_ids.len() < 2 {
            continue;
        }

        // Stagger each cup by a week so two cups (e.g. FA Cup + EFL Cup) never
        // schedule a round on the same midweek date, which previously forced a
        // club to play both cup ties on a single day.
        let cup_start = start_date + Duration::days(30 + cup_index as i64 * 7);
        competitions.push(generate_domestic_cup(
            cup_definition.name,
            season,
            Some(country.to_string()),
            &cup_team_ids,
            cup_start,
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

/// Champions League — 2024-25 "Swiss model" league phase.
///
/// Qualifies the strongest clubs from every tier-1 domestic league (3 per league
/// so a 12-country world reaches the 36-team target, capped at 36 and rounded to
/// an even count). All 36 sit in a single table and each plays 8 league-phase
/// matches against 8 distinct opponents (4 home, 4 away), built with the circle
/// method and truncated to 8 rounds. Standings are pre-seeded so the Standings
/// tab populates as results come in. The top 8 later seed straight into the
/// Round of 16, ranks 9–24 contest a two-legged playoff, ranks 25–36 are out —
/// all handled by `crate::knockout::process_knockout_progression`.
pub fn generate_continental_group_stage(
    name: &str,
    season: u32,
    domestic_competitions: &[Competition],
    teams: &[domain::team::Team],
    start_date: DateTime<Utc>,
) -> Option<Competition> {
    const TARGET_TEAMS: usize = 36;
    const MATCHES_PER_TEAM: usize = 8;

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
        // Up to 3 entrants per tier-1 league (modern UCL allocation).
        qualified_team_ids.extend(entrants.drain(..entrants.len().min(3)));
    }

    qualified_team_ids.sort();
    qualified_team_ids.dedup();

    // Order by reputation (strongest first) so seeding for the knockout draw is
    // meaningful, then cap to an even count up to 36.
    qualified_team_ids.sort_by(|left, right| {
        reputation_by_team
            .get(right.as_str())
            .unwrap_or(&0)
            .cmp(reputation_by_team.get(left.as_str()).unwrap_or(&0))
            .then(left.cmp(right))
    });
    let mut max_teams = qualified_team_ids.len().min(TARGET_TEAMS);
    if max_teams % 2 == 1 {
        max_teams -= 1;
    }
    if max_teams < 4 {
        return None;
    }
    qualified_team_ids.truncate(max_teams);

    let competition_id = Uuid::new_v4().to_string();
    let fixtures = build_swiss_league_phase(
        &competition_id,
        season,
        &qualified_team_ids,
        MATCHES_PER_TEAM,
        start_date,
    );

    let standings = qualified_team_ids
        .iter()
        .map(|team_id| domain::league::StandingEntry::new(team_id.clone()))
        .collect();

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
        standings,
        transfer_log: Vec::new(),
    })
}

/// Build a partial single round-robin (circle method) and keep the first
/// `matches_per_team` rounds, alternating home/away so each club has a balanced
/// split. Rounds are spaced two weeks apart, anchored midweek.
fn build_swiss_league_phase(
    competition_id: &str,
    season: u32,
    team_ids: &[String],
    matches_per_team: usize,
    start_date: DateTime<Utc>,
) -> Vec<Fixture> {
    let n = team_ids.len();
    if n < 2 {
        return Vec::new();
    }
    let rounds = matches_per_team.min(n - 1);
    let half = n / 2;
    let mut indices: Vec<usize> = (0..n).collect();
    let mut fixtures = Vec::new();

    for round in 0..rounds {
        let matchday = (round + 1) as u32;
        let base = start_date + Duration::days(round as i64 * 14);
        let date = on_or_after_weekday(base, Weekday::Tue)
            .format("%Y-%m-%d")
            .to_string();
        for i in 0..half {
            let a = indices[i];
            let b = indices[n - 1 - i];
            // Alternate home advantage by round so the home/away split stays even.
            let (home_idx, away_idx) = if round % 2 == 0 { (a, b) } else { (b, a) };
            fixtures.push(Fixture {
                id: Uuid::new_v4().to_string(),
                matchday,
                date: date.clone(),
                home_team_id: team_ids[home_idx].clone(),
                away_team_id: team_ids[away_idx].clone(),
                competition_id: Some(competition_id.to_string()),
                season: Some(season),
                competition: FixtureCompetition::ContinentalLeague,
                status: FixtureStatus::Scheduled,
                result: None,
                stage: None, // league-phase matches carry no knockout stage
                leg: None,
                tie_id: None,
            });
        }
        // Rotate all but the first index (circle method).
        let last = indices.pop().unwrap();
        indices.insert(1, last);
    }

    fixtures
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
                stage: None,
                leg: None,
                tie_id: None,
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

// ---------------------------------------------------------------------------
// World Cup 2026 scheduling
// ---------------------------------------------------------------------------

/// Generate the World Cup 2026 competition: 12 groups × 4 teams round-robin → 32-team knockout.
pub fn generate_world_cup_2026(
    teams: &[domain::team::Team],
    season: u32,
    start_date: DateTime<Utc>,
) -> Competition {
    const GROUP_SIZE: usize = 4;
    const NUM_GROUPS: usize = 12;
    let competition_id = Uuid::new_v4().to_string();
    let team_ids: Vec<String> = teams.iter().map(|t| t.id.clone()).collect();
    assert_eq!(team_ids.len(), NUM_GROUPS * GROUP_SIZE);

    // Seed groups by team reputation (best-first). Group A gets teams[0], teams[11], teams[23], teams[35] etc.
    let mut sorted_indices: Vec<usize> = (0..team_ids.len()).collect();
    sorted_indices.sort_by(|&a, &b| {
        teams[b].reputation.cmp(&teams[a].reputation).then(teams[a].id.cmp(&teams[b].id))
    });
    let mut groups: Vec<Vec<String>> = vec![Vec::new(); NUM_GROUPS];
    for (slot, &idx) in sorted_indices.iter().enumerate() {
        let group = slot % NUM_GROUPS;
        groups[group].push(team_ids[idx].clone());
    }

    // Single round-robin per group (3 matches per team)
    let mut fixtures = Vec::new();
    let mut standings = Vec::new();
    for (g, group_team_ids) in groups.iter().enumerate() {
        for team_id in group_team_ids {
            standings.push(StandingEntry::new(team_id.clone()));
        }
        // Round-robin scheduling: each group plays on consecutive days
        let group_base = start_date + Duration::days(g as i64 * 4);
        let n = group_team_ids.len();
        let mut indices: Vec<usize> = (0..n).collect();
        let half = n / 2;
        for round in 0..(n - 1) {
            let matchday = (g * (n - 1) + round) as u32 + 1;
            let round_date = (group_base + Duration::days(round as i64))
                .format("%Y-%m-%d")
                .to_string();
            for i in 0..half {
                let (home_idx, away_idx) = if round % 2 == 0 {
                    (indices[i], indices[n - 1 - i])
                } else {
                    (indices[n - 1 - i], indices[i])
                };
                fixtures.push(Fixture {
                    id: Uuid::new_v4().to_string(),
                    matchday,
                    date: round_date.clone(),
                    home_team_id: group_team_ids[home_idx].clone(),
                    away_team_id: group_team_ids[away_idx].clone(),
                    competition_id: Some(competition_id.clone()),
                    season: Some(season),
                    competition: FixtureCompetition::WorldCup,
                    status: FixtureStatus::Scheduled,
                    result: None,
                    stage: None,
                    leg: None,
                    tie_id: None,
                });
            }
            let last = indices.pop().unwrap();
            indices.insert(1, last);
        }
    }

    Competition {
        id: competition_id,
        name: "World Cup 2026".to_string(),
        season,
        kind: CompetitionKind::WorldCup,
        format: CompetitionFormat::GroupStageKnockout,
        country: None,
        tier: None,
        team_ids,
        fixtures,
        standings,
        transfer_log: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn two_cups_over_same_teams_get_different_brackets() {
        let teams: Vec<String> = (0..16).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();

        let fa_cup = generate_domestic_cup("FA Cup", 2026, Some("England".to_string()), &teams, start);
        let efl_cup = generate_domestic_cup("EFL Cup", 2026, Some("England".to_string()), &teams, start);

        // Same teams + rounds, but the first-round pairings must differ so the
        // two cups don't mirror each other (the original duplicate-fixtures bug).
        let fa_round1: Vec<(String, String)> = fa_cup
            .fixtures
            .iter()
            .filter(|fixture| fixture.matchday == 1)
            .map(|fixture| (fixture.home_team_id.clone(), fixture.away_team_id.clone()))
            .collect();
        let efl_round1: Vec<(String, String)> = efl_cup
            .fixtures
            .iter()
            .filter(|fixture| fixture.matchday == 1)
            .map(|fixture| (fixture.home_team_id.clone(), fixture.away_team_id.clone()))
            .collect();
        assert_eq!(fa_round1.len(), 8);
        assert_eq!(efl_round1.len(), 8);
        assert_ne!(fa_round1, efl_round1, "two cups should not share an identical bracket");

        // The same cup is reproducible across regenerations (deterministic seed).
        let fa_cup_again =
            generate_domestic_cup("FA Cup", 2026, Some("England".to_string()), &teams, start);
        let fa_round1_again: Vec<(String, String)> = fa_cup_again
            .fixtures
            .iter()
            .filter(|fixture| fixture.matchday == 1)
            .map(|fixture| (fixture.home_team_id.clone(), fixture.away_team_id.clone()))
            .collect();
        assert_eq!(fa_round1, fa_round1_again, "same cup should reproduce its bracket");
    }

    #[test]
    fn league_rounds_fall_on_weekends_and_cups_midweek() {
        let teams: Vec<String> = (0..8).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();

        // Every league round must land on a Saturday or Sunday, never all on the
        // same weekday (the original "every round is Friday" complaint).
        let league = generate_league("Test League", 2026, &teams, start);
        for fixture in &league.fixtures {
            let date = Utc
                .from_utc_datetime(
                    &chrono::NaiveDate::parse_from_str(&fixture.date, "%Y-%m-%d")
                        .unwrap()
                        .and_hms_opt(0, 0, 0)
                        .unwrap(),
                )
                .weekday();
            assert!(
                matches!(date, Weekday::Sat | Weekday::Sun),
                "league fixture on {} fell on {:?}, expected a weekend",
                fixture.date,
                date
            );
        }

        // Cup rounds must land midweek (Wednesday) so they avoid the weekend
        // league slot, preventing two matches on consecutive days.
        let cup = generate_domestic_cup("Test Cup", 2026, Some("Testland".to_string()), &teams, start);
        for fixture in &cup.fixtures {
            let date = Utc
                .from_utc_datetime(
                    &chrono::NaiveDate::parse_from_str(&fixture.date, "%Y-%m-%d")
                        .unwrap()
                        .and_hms_opt(0, 0, 0)
                        .unwrap(),
                )
                .weekday();
            assert_eq!(
                date,
                Weekday::Wed,
                "cup fixture on {} fell on {:?}, expected Wednesday",
                fixture.date,
                date
            );
        }
    }

    #[test]
    fn two_cups_never_schedule_a_round_on_the_same_day() {
        let teams: Vec<String> = (0..16).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();

        // The tier-membership generator staggers cups by a week. Simulate that by
        // offsetting the second cup's start, then confirm no shared fixture dates.
        let fa_cup = generate_domestic_cup("FA Cup", 2026, Some("England".to_string()), &teams, start);
        let efl_cup = generate_domestic_cup(
            "EFL Cup",
            2026,
            Some("England".to_string()),
            &teams,
            start + Duration::days(7),
        );

        let fa_dates: std::collections::HashSet<&str> =
            fa_cup.fixtures.iter().map(|f| f.date.as_str()).collect();
        for fixture in &efl_cup.fixtures {
            assert!(
                !fa_dates.contains(fixture.date.as_str()),
                "EFL Cup round shares date {} with the FA Cup",
                fixture.date
            );
        }
    }

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
    fn generate_world_cup_2026_uses_real_48_team_format() {
        let start = Utc.with_ymd_and_hms(2026, 6, 11, 0, 0, 0).unwrap();
        let teams: Vec<_> = (0..48)
            .map(|index| {
                test_team(
                    &format!("team-{index:02}"),
                    &format!("Team {index:02}"),
                    "Testland",
                    1_000 - index as u32,
                )
            })
            .collect();

        let competition = generate_world_cup_2026(&teams, 2026, start);

        assert_eq!(competition.kind, CompetitionKind::WorldCup);
        assert_eq!(competition.format, CompetitionFormat::GroupStageKnockout);
        assert_eq!(competition.team_ids.len(), 48);
        assert_eq!(competition.standings.len(), 48);
        assert_eq!(competition.fixtures.len(), 72);
        assert!(competition.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::WorldCup
                && fixture.competition_id.as_deref() == Some(competition.id.as_str())
                && fixture.stage.is_none()
        }));

        for group in competition.standings.chunks(4) {
            let group_team_ids: std::collections::HashSet<_> =
                group.iter().map(|entry| entry.team_id.as_str()).collect();
            let group_fixture_count = competition
                .fixtures
                .iter()
                .filter(|fixture| {
                    group_team_ids.contains(fixture.home_team_id.as_str())
                        && group_team_ids.contains(fixture.away_team_id.as_str())
                })
                .count();
            assert_eq!(group_fixture_count, 6);

            for team_id in group_team_ids {
                let appearances = competition
                    .fixtures
                    .iter()
                    .filter(|fixture| {
                        fixture.home_team_id == team_id || fixture.away_team_id == team_id
                    })
                    .count();
                assert_eq!(appearances, 3, "{team_id} should play 3 group matches");
            }
        }
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
        // Cups now schedule only round one up front (4 teams → 2 ties); later
        // rounds are drawn from real winners by the knockout-progression pass.
        assert_eq!(fa_cup.fixtures.len(), 2);
        assert!(fa_cup.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::DomesticCup
                && fixture.competition_id.as_deref() == Some(fa_cup.id.as_str())
                && fixture.stage.is_some()
                && !fixture.counts_for_league_standings()
        }));
        assert_eq!(league_cup.kind, CompetitionKind::DomesticCup);
        assert_eq!(league_cup.team_ids.len(), 4);
        assert_eq!(league_cup.fixtures.len(), 2);
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
        // Swiss league phase: a single table, pre-seeded standings, and each club
        // plays min(8, n-1) league-phase matches (7 here for an 8-team field).
        assert_eq!(competition.standings.len(), 8);
        assert_eq!(competition.fixtures.len(), 28);
        for team_id in &competition.team_ids {
            let played = competition
                .fixtures
                .iter()
                .filter(|fixture| {
                    fixture.home_team_id == *team_id || fixture.away_team_id == *team_id
                })
                .count();
            assert_eq!(played, 7, "team {team_id} should play 7 league-phase matches");
        }
        assert!(competition.fixtures.iter().all(|fixture| {
            fixture.competition == FixtureCompetition::ContinentalLeague
                && fixture.stage.is_none()
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
