use chrono::{Duration, TimeZone, Utc};
use db::game_database::GameDatabase;
use db::game_persistence::{GamePersistenceReader, GamePersistenceWriter};
use domain::league::{CompetitionKind, FixtureStatus};
use domain::manager::Manager;
use domain::stats::StatsState;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;
use ofm_core::{ai_hiring, generator, schedule, season_context, turn};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration as StdDuration, Instant};

const SAVE_ID: &str = "fc26-benchmark";
const SAVE_NAME: &str = "FC26 Benchmark";

struct BenchArgs {
    days: usize,
    output_path: PathBuf,
    autosave_daily: bool,
}

#[derive(Default)]
struct FixtureReportCounts {
    fixtures: usize,
    completed: usize,
    completed_with_report: usize,
    completed_without_report: usize,
}

fn main() {
    let args = parse_args();
    cleanup_database_files(&args.output_path);

    println!("=== FC26 save + sim benchmark ===");
    println!("days: {}", args.days);
    println!("save_path: {}", args.output_path.display());
    println!("autosave_daily: {}", args.autosave_daily);

    let generation = measure(|| build_fc26_game());
    let mut game = generation.value;
    let mut stats = StatsState::default();

    println!("\n[world]");
    println!("teams: {}", game.teams.len());
    println!("players: {}", game.players.len());
    println!("staff: {}", game.staff.len());
    println!("competitions: {}", game.competitions.len());
    println!("fixtures: {}", fixture_counts(&game).fixtures);
    println!("generation_ms: {:.2}", ms(generation.elapsed));

    let initial_save = save_and_measure(&args.output_path, &game, &stats);
    println!("\n[initial_save]");
    print_save_report(&initial_save);

    let (day_1, week_rest, month_rest, remaining, autosave_report) = if args.autosave_daily {
        advance_save_daily_and_capture(&args.output_path, &mut game, &mut stats, args.days)
    } else {
        (
            advance_and_capture(&mut game, &mut stats, args.days.min(1)),
            advance_and_capture(&mut game, &mut stats, args.days.saturating_sub(1).min(6)),
            advance_and_capture(&mut game, &mut stats, args.days.saturating_sub(7).min(23)),
            advance_and_capture(&mut game, &mut stats, args.days.saturating_sub(30)),
            AutosaveReport::default(),
        )
    };

    println!("\n[simulation]");
    println!("day_1_ms: {:.2}", ms(day_1));
    println!("days_2_to_7_ms: {:.2}", ms(week_rest));
    println!("days_8_to_30_ms: {:.2}", ms(month_rest));
    println!("days_31_to_{}_ms: {:.2}", args.days, ms(remaining));
    println!(
        "total_advance_ms: {:.2}",
        ms(day_1 + week_rest + month_rest + remaining)
    );
    println!(
        "current_date: {}",
        game.clock.current_date.format("%Y-%m-%d")
    );

    if args.autosave_daily {
        println!("\n[autosave_daily]");
        println!("saves: {}", autosave_report.saves);
        println!("total_save_ms: {:.2}", ms(autosave_report.elapsed));
        println!("avg_save_ms: {:.2}", autosave_report.avg_ms());
    }

    let counts = fixture_counts(&game);
    println!("\n[fixture_reports]");
    println!("fixtures: {}", counts.fixtures);
    println!("completed: {}", counts.completed);
    println!("completed_with_report: {}", counts.completed_with_report);
    println!(
        "completed_without_report: {}",
        counts.completed_without_report
    );

    println!("\n[stats]");
    println!("player_match_rows: {}", stats.player_matches.len());
    println!("team_match_rows: {}", stats.team_matches.len());

    let final_save = save_and_measure(&args.output_path, &game, &stats);
    println!("\n[final_save]");
    print_save_report(&final_save);

    let load = measure(|| {
        let db = GameDatabase::open(&args.output_path).expect("open benchmark save for load");
        let loaded_game = GamePersistenceReader::read_game(&db).expect("load benchmark game");
        let loaded_stats =
            GamePersistenceReader::read_stats_state(&db).expect("load benchmark stats");
        (loaded_game, loaded_stats)
    });
    println!("\n[load]");
    println!("load_ms: {:.2}", ms(load.elapsed));
    println!("loaded_teams: {}", load.value.0.teams.len());
    println!(
        "loaded_player_match_rows: {}",
        load.value.1.player_matches.len()
    );
    println!(
        "loaded_team_match_rows: {}",
        load.value.1.team_matches.len()
    );

    println!("\n[csv]");
    println!("days,teams,players,competitions,fixtures,completed,completed_with_report,completed_without_report,player_match_rows,team_match_rows,generation_ms,total_advance_ms,save_ms,load_ms,save_bytes,save_mb");
    println!(
        "{},{},{},{},{},{},{},{},{},{},{:.2},{:.2},{:.2},{:.2},{},{:.2}",
        args.days,
        game.teams.len(),
        game.players.len(),
        game.competitions.len(),
        counts.fixtures,
        counts.completed,
        counts.completed_with_report,
        counts.completed_without_report,
        stats.player_matches.len(),
        stats.team_matches.len(),
        ms(generation.elapsed),
        ms(day_1 + week_rest + month_rest + remaining),
        ms(final_save.elapsed),
        ms(load.elapsed),
        final_save.bytes,
        mb(final_save.bytes),
    );
}

fn parse_args() -> BenchArgs {
    let mut days = 365;
    let mut output_path = std::env::temp_dir().join("openfootmanager-fc26-benchmark.db");
    let mut autosave_daily = false;
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--days" => {
                let value = args.next().expect("--days requires a number");
                days = value.parse::<usize>().expect("--days must be numeric");
            }
            "--out" => {
                output_path = PathBuf::from(args.next().expect("--out requires a file path"));
            }
            "--autosave-daily" => {
                autosave_daily = true;
            }
            _ => {
                if let Ok(value) = arg.parse::<usize>() {
                    days = value;
                } else {
                    output_path = PathBuf::from(arg);
                }
            }
        }
    }

    BenchArgs {
        days,
        output_path,
        autosave_daily,
    }
}

fn build_fc26_game() -> Game {
    let start_date = Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
    let season_start = start_date + Duration::days(30);
    let (teams, players, staff) = generator::generate_fc26_world().expect("generate FC26 world");
    let mut manager = Manager::new(
        "bench-manager".to_string(),
        "Benchmark".to_string(),
        "Manager".to_string(),
        "1985-01-01".to_string(),
        "England".to_string(),
    );
    let user_team_id = teams.first().expect("FC26 world has teams").id.clone();
    manager.hire(user_team_id.clone());

    let mut game = Game::new(
        GameClock::new(start_date),
        manager,
        teams,
        players,
        staff,
        vec![],
    );
    if let Some(team) = game.teams.iter_mut().find(|team| team.id == user_team_id) {
        team.manager_id = Some(game.manager.id.clone());
    }
    game.manager_id = game.manager.id.clone();
    ai_hiring::seed_ai_managers(&mut game);

    game.competitions =
        schedule::generate_domestic_competitions_by_country(&game.teams, 2026, season_start);
    let primary_competition = game
        .competitions
        .iter()
        .find(|competition| {
            competition.kind == CompetitionKind::DomesticLeague
                && competition
                    .team_ids
                    .iter()
                    .any(|team_id| team_id == &user_team_id)
        })
        .cloned()
        .or_else(|| game.primary_league_competition().cloned())
        .expect("FC26 world has a primary league");
    let mut league = domain::league::League {
        id: primary_competition.id.clone(),
        name: primary_competition.name.clone(),
        season: primary_competition.season,
        fixtures: primary_competition.fixtures.clone(),
        standings: primary_competition.standings.clone(),
        transfer_log: primary_competition.transfer_log.clone(),
    };
    let league_team_ids = league
        .standings
        .iter()
        .map(|standing| standing.team_id.clone())
        .collect::<Vec<_>>();
    let friendlies = schedule::generate_preseason_friendlies(&league_team_ids, season_start, 4);
    schedule::append_fixtures(&mut league, friendlies);
    if let Some(primary) = game
        .competitions
        .iter_mut()
        .find(|competition| competition.id == league.id)
    {
        primary.fixtures = league.fixtures.clone();
    }
    if let Some(continental) = schedule::generate_continental_group_stage(
        "Champions League",
        2026,
        &game.competitions,
        &game.teams,
        season_start + Duration::days(45),
    ) {
        game.competitions.push(continental);
    }
    game.league = Some(league);
    season_context::refresh_game_context(&mut game);
    game
}

fn advance_and_capture(game: &mut Game, stats: &mut StatsState, days: usize) -> StdDuration {
    measure(|| {
        for _ in 0..days {
            turn::process_day_with_capture(game, &mut |capture| stats.append(capture));
        }
    })
    .elapsed
}

#[derive(Default)]
struct AutosaveReport {
    saves: usize,
    elapsed: StdDuration,
}

impl AutosaveReport {
    fn avg_ms(&self) -> f64 {
        if self.saves == 0 {
            0.0
        } else {
            ms(self.elapsed) / self.saves as f64
        }
    }
}

fn advance_save_daily_and_capture(
    path: &Path,
    game: &mut Game,
    stats: &mut StatsState,
    days: usize,
) -> (
    StdDuration,
    StdDuration,
    StdDuration,
    StdDuration,
    AutosaveReport,
) {
    let mut simulation = [StdDuration::default(); 4];
    let mut autosave = AutosaveReport::default();

    for day in 0..days {
        let elapsed = measure(|| {
            turn::process_day_with_capture(game, &mut |capture| stats.append(capture));
        })
        .elapsed;

        match day {
            0 => simulation[0] += elapsed,
            1..=6 => simulation[1] += elapsed,
            7..=29 => simulation[2] += elapsed,
            _ => simulation[3] += elapsed,
        }

        autosave.elapsed += save_and_measure(path, game, stats).elapsed;
        autosave.saves += 1;
    }

    (
        simulation[0],
        simulation[1],
        simulation[2],
        simulation[3],
        autosave,
    )
}

struct Measurement<T> {
    value: T,
    elapsed: StdDuration,
}

fn measure<T>(run: impl FnOnce() -> T) -> Measurement<T> {
    let start = Instant::now();
    let value = run();
    Measurement {
        value,
        elapsed: start.elapsed(),
    }
}

struct SaveReport {
    elapsed: StdDuration,
    bytes: u64,
    db_bytes: u64,
    wal_bytes: u64,
    shm_bytes: u64,
}

fn save_and_measure(path: &Path, game: &Game, stats: &StatsState) -> SaveReport {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create benchmark save directory");
    }

    let save = measure(|| {
        let db = GameDatabase::open(path).expect("open benchmark save");
        GamePersistenceWriter::write_game_and_stats(&db, game, stats, SAVE_ID, SAVE_NAME)
            .expect("write benchmark save");
        let _ = db.conn().execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
    });

    let db_bytes = file_len(path);
    let wal_bytes = file_len(&wal_path(path));
    let shm_bytes = file_len(&shm_path(path));

    SaveReport {
        elapsed: save.elapsed,
        bytes: db_bytes + wal_bytes + shm_bytes,
        db_bytes,
        wal_bytes,
        shm_bytes,
    }
}

fn fixture_counts(game: &Game) -> FixtureReportCounts {
    let mut counts = FixtureReportCounts::default();
    for fixture in game
        .league
        .iter()
        .flat_map(|league| league.fixtures.iter())
        .chain(
            game.competitions
                .iter()
                .flat_map(|competition| competition.fixtures.iter()),
        )
    {
        counts.fixtures += 1;
        if fixture.status == FixtureStatus::Completed {
            counts.completed += 1;
            if fixture
                .result
                .as_ref()
                .and_then(|result| result.report.as_ref())
                .is_some()
            {
                counts.completed_with_report += 1;
            } else {
                counts.completed_without_report += 1;
            }
        }
    }
    counts
}

fn print_save_report(report: &SaveReport) {
    println!("save_ms: {:.2}", ms(report.elapsed));
    println!("save_bytes: {}", report.bytes);
    println!("save_mb: {:.2}", mb(report.bytes));
    println!("db_bytes: {}", report.db_bytes);
    println!("wal_bytes: {}", report.wal_bytes);
    println!("shm_bytes: {}", report.shm_bytes);
}

fn cleanup_database_files(path: &Path) {
    let _ = fs::remove_file(path);
    let _ = fs::remove_file(wal_path(path));
    let _ = fs::remove_file(shm_path(path));
}

fn wal_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}-wal", path.display()))
}

fn shm_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}-shm", path.display()))
}

fn file_len(path: &Path) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn ms(duration: StdDuration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

fn mb(bytes: u64) -> f64 {
    bytes as f64 / 1024.0 / 1024.0
}
