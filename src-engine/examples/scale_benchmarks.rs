use chrono::{Duration, TimeZone, Utc};
use db::game_database::GameDatabase;
use db::game_persistence::{GamePersistenceReader, GamePersistenceWriter};
use domain::manager::Manager;
use domain::staff::{Staff, StaffAttributes, StaffRole};
use domain::team::{Team, TeamColors};
use ofm_core::clock::GameClock;
use ofm_core::end_of_season;
use ofm_core::game::Game;
use ofm_core::generator;
use ofm_core::schedule;
use ofm_core::turn;
use std::time::{Duration as StdDuration, Instant};

const TEAMS_PER_LEAGUE: usize = 4;
const PLAYERS_PER_TEAM: usize = 22;
const STAFF_PER_TEAM: usize = 4;
const PYRAMID_COUNTRY: &str = "England";

struct ScaleReport {
    leagues: usize,
    teams: usize,
    players: usize,
    competitions: usize,
    fixtures: usize,
    generation: StdDuration,
    advance_day: StdDuration,
    advance_week: StdDuration,
    advance_month: StdDuration,
    season_rollover: StdDuration,
    save: StdDuration,
    load: StdDuration,
}

fn main() {
    let league_counts = std::env::args()
        .skip(1)
        .map(|value| {
            value
                .parse::<usize>()
                .expect("league count must be numeric")
        })
        .collect::<Vec<_>>();
    let league_counts = if league_counts.is_empty() {
        vec![5, 20, 50]
    } else {
        league_counts
    };

    println!("=== Open FM scale benchmarks ===");
    println!("leagues,teams,players,competitions,fixtures,generation_ms,day_ms,week_ms,month_ms,rollover_ms,save_ms,load_ms");

    for leagues in league_counts {
        let report = bench_scale(leagues);
        println!(
            "{},{},{},{},{},{:.2},{:.2},{:.2},{:.2},{:.2},{:.2},{:.2}",
            report.leagues,
            report.teams,
            report.players,
            report.competitions,
            report.fixtures,
            report.generation.as_secs_f64() * 1000.0,
            report.advance_day.as_secs_f64() * 1000.0,
            report.advance_week.as_secs_f64() * 1000.0,
            report.advance_month.as_secs_f64() * 1000.0,
            report.season_rollover.as_secs_f64() * 1000.0,
            report.save.as_secs_f64() * 1000.0,
            report.load.as_secs_f64() * 1000.0,
        );
    }
}

fn bench_scale(leagues: usize) -> ScaleReport {
    let season_start = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
    let generation_start = Instant::now();
    let mut game = generate_scale_game(leagues, season_start);
    let generation = generation_start.elapsed();

    let teams = game.teams.len();
    let players = game.players.len();
    let competitions = game.competitions.len();
    let fixtures = game
        .competitions
        .iter()
        .map(|competition| competition.fixtures.len())
        .sum();

    let advance_day = measure(|| advance_days(&mut game, 1));
    let advance_week = measure(|| advance_days(&mut game, 7));
    let advance_month = measure(|| advance_days(&mut game, 30));
    let mut rollover_game = game.clone();
    complete_domestic_leagues(&mut rollover_game);
    let season_rollover = measure(|| {
        let _summary = end_of_season::process_end_of_season(&mut rollover_game);
    });

    let db = GameDatabase::open_in_memory().expect("open in-memory benchmark db");
    let save = measure(|| {
        GamePersistenceWriter::write_game(&db, &game, "scale-bench", "Scale Benchmark")
            .expect("write benchmark game");
    });
    let mut loaded_game = None;
    let load = measure(|| {
        loaded_game = Some(GamePersistenceReader::read_game(&db).expect("read benchmark game"));
    });
    let loaded_game = loaded_game.expect("loaded game should be present");
    assert_eq!(loaded_game.teams.len(), teams);
    assert_eq!(loaded_game.competitions.len(), competitions);

    ScaleReport {
        leagues,
        teams,
        players,
        competitions,
        fixtures,
        generation,
        advance_day,
        advance_week,
        advance_month,
        season_rollover,
        save,
        load,
    }
}

fn measure(run: impl FnOnce()) -> StdDuration {
    let start = Instant::now();
    run();
    start.elapsed()
}

fn advance_days(game: &mut Game, days: usize) {
    for _ in 0..days {
        turn::process_day(game);
    }
}

fn complete_domestic_leagues(game: &mut Game) {
    for competition in game.competitions.iter_mut() {
        if competition.kind != domain::league::CompetitionKind::DomesticLeague {
            continue;
        }

        for fixture in competition.fixtures.iter_mut() {
            fixture.status = domain::league::FixtureStatus::Completed;
            fixture.result = Some(domain::league::MatchResult {
                home_goals: 1,
                away_goals: 0,
                home_scorers: vec![],
                away_scorers: vec![],
                report: None,
            });
        }

        for standing in competition.standings.iter_mut() {
            standing.played = competition.team_ids.len().saturating_sub(1) as u32 * 2;
            standing.won = 1;
            standing.points = 3;
        }
    }

    if !game.competitions.is_empty() {
        game.league = game
            .primary_league_competition()
            .map(|competition| domain::league::League {
                id: competition.id.clone(),
                name: competition.name.clone(),
                season: competition.season,
                fixtures: competition.fixtures.clone(),
                standings: competition.standings.clone(),
                transfer_log: competition.transfer_log.clone(),
            });
    }
}

fn generate_scale_game(leagues: usize, season_start: chrono::DateTime<Utc>) -> Game {
    let mut teams = Vec::with_capacity(leagues * TEAMS_PER_LEAGUE);
    let mut players = Vec::with_capacity(leagues * TEAMS_PER_LEAGUE * PLAYERS_PER_TEAM);
    let mut staff = Vec::with_capacity(leagues * TEAMS_PER_LEAGUE * STAFF_PER_TEAM);

    for league_index in 0..leagues {
        let country = if league_index == 0 {
            PYRAMID_COUNTRY.to_string()
        } else {
            format!("Benchmark Nation {:02}", league_index + 1)
        };
        for team_index in 0..TEAMS_PER_LEAGUE {
            let team_id = format!("bench-team-{league_index}-{team_index}");
            let mut team = Team::new(
                team_id.clone(),
                format!("Bench FC {}-{}", league_index + 1, team_index + 1),
                format!("B{:02}{:02}", league_index + 1, team_index + 1),
                country.clone(),
                format!("Bench City {}", team_index + 1),
                format!("Bench Stadium {}", team_index + 1),
                30_000,
            );
            team.reputation = 450 + (team_index as u32 * 40);
            team.finance = 30_000_000;
            team.wage_budget = 12_000_000;
            team.transfer_budget = 8_000_000;
            team.colors = TeamColors {
                primary: "#047857".to_string(),
                secondary: "#0f172a".to_string(),
            };
            teams.push(team);

            for player_index in 0..PLAYERS_PER_TEAM {
                let mut player =
                    generator::generate_youth_academy_recruit(&teams.last().unwrap(), None);
                player.id = format!("bench-player-{league_index}-{team_index}-{player_index}");
                player.team_id = Some(team_id.clone());
                player.condition = 95;
                player.fitness = 85;
                player.morale = 70;
                players.push(player);
            }

            for staff_index in 0..STAFF_PER_TEAM {
                let role = match staff_index {
                    0 => StaffRole::AssistantManager,
                    1 => StaffRole::Coach,
                    2 => StaffRole::Scout,
                    _ => StaffRole::Physio,
                };
                let mut staff_member = Staff::new(
                    format!("bench-staff-{league_index}-{team_index}-{staff_index}"),
                    "Bench".to_string(),
                    format!("Staff {staff_index}"),
                    "1980-01-01".to_string(),
                    role,
                    StaffAttributes {
                        coaching: 60,
                        judging_ability: 60,
                        judging_potential: 60,
                        physiotherapy: 60,
                    },
                );
                staff_member.nationality = "ENG".to_string();
                staff_member.football_nation = "ENG".to_string();
                staff_member.team_id = Some(team_id.clone());
                staff.push(staff_member);
            }
        }
    }

    let mut manager = Manager::new(
        "bench-manager".to_string(),
        "Scale".to_string(),
        "Manager".to_string(),
        "1985-01-01".to_string(),
        "England".to_string(),
    );
    let user_team_id = teams[0].id.clone();
    manager.hire(user_team_id.clone());

    let mut game = Game::new(
        GameClock::new(season_start),
        manager,
        teams,
        players,
        staff,
        vec![],
    );
    let user_country = game.teams[0].country.clone();
    game.competitions =
        schedule::generate_domestic_competitions_by_country(&game.teams, 2026, season_start);
    if let Some(user_competition) = game
        .competitions
        .iter()
        .find(|competition| competition.country.as_deref() == Some(user_country.as_str()))
    {
        let mut league = schedule::generate_league(
            &user_competition.name,
            user_competition.season,
            &user_competition.team_ids,
            season_start,
        );
        league.id = user_competition.id.clone();
        game.league = Some(league);
    }
    if let Some(continental) = schedule::generate_continental_group_stage(
        "Benchmark Champions League",
        2026,
        &game.competitions,
        &game.teams,
        season_start + Duration::days(45),
    ) {
        game.competitions.push(continental);
    }
    game
}
