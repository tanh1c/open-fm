use std::collections::HashMap;

use chrono::{TimeZone, Utc};
use domain::league::{FixtureStatus, MatchResult};
use domain::manager::Manager;
use domain::player::Position;
use ofm_core::clock::GameClock;
use ofm_core::end_of_season::{is_season_complete, process_end_of_season};
use ofm_core::game::Game;
use ofm_core::generator::generate_world;
use ofm_core::schedule::generate_domestic_competitions_by_country;
use ofm_core::turn::process_day;

#[derive(Debug, Clone, Copy)]
struct Args {
    worlds: u32,
    seasons: u32,
    max_days: u32,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            worlds: 3,
            seasons: 3,
            max_days: 1500,
        }
    }
}

#[derive(Default)]
struct MatchTotals {
    matches: u32,
    goals: u32,
    shots: u32,
    shots_on_target: u32,
    passes_completed: u32,
    passes_attempted: u32,
    rating_sum: f64,
    rating_count: u32,
    home_wins: u32,
    draws: u32,
    away_wins: u32,
    scorers_by_group: HashMap<Position, u32>,
    assists_by_group: HashMap<Position, u32>,
}

#[derive(Default)]
struct AttributeTotals {
    count: u32,
    ovr: u32,
    shooting: u32,
    passing: u32,
    vision: u32,
    defending: u32,
    tackling: u32,
    aerial: u32,
}

impl AttributeTotals {
    fn add(&mut self, player: &domain::player::Player) {
        self.count += 1;
        self.ovr += player.ovr as u32;
        self.shooting += player.attributes.shooting as u32;
        self.passing += player.attributes.passing as u32;
        self.vision += player.attributes.vision as u32;
        self.defending += player.attributes.defending as u32;
        self.tackling += player.attributes.tackling as u32;
        self.aerial += player.attributes.aerial as u32;
    }

    fn avg(&self, value: u32) -> f64 {
        value as f64 / self.count.max(1) as f64
    }
}

fn parse_args() -> Args {
    let mut args = Args::default();
    let mut raw = std::env::args().skip(1);

    while let Some(arg) = raw.next() {
        let value = match arg.as_str() {
            "--worlds" => raw.next().and_then(|value| value.parse().ok()),
            "--seasons" => raw.next().and_then(|value| value.parse().ok()),
            "--max-days" => raw.next().and_then(|value| value.parse().ok()),
            _ => None,
        };

        if let Some(value) = value {
            match arg.as_str() {
                "--worlds" => args.worlds = value,
                "--seasons" => args.seasons = value,
                "--max-days" => args.max_days = value,
                _ => {}
            }
        }
    }

    args
}

fn make_game(world_index: u32) -> Game {
    let (teams, players, staff) = generate_world(None);
    let user_team_id = teams
        .first()
        .map(|team| team.id.clone())
        .expect("generated world should contain teams");
    let mut manager = Manager::new(
        format!("benchmark-manager-{world_index}"),
        "Bench".to_string(),
        "Manager".to_string(),
        "1980-01-01".to_string(),
        "ENG".to_string(),
    );
    manager.hire(user_team_id);

    let start = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
    let mut game = Game::new(
        GameClock::new(start),
        manager,
        teams,
        players,
        staff,
        vec![],
    );
    game.competitions = generate_domestic_competitions_by_country(&game.teams, 2026, start);
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
    game
}

fn collect_match_result(totals: &mut MatchTotals, result: &MatchResult) {
    let Some(report) = result.report.as_ref() else {
        return;
    };

    totals.matches += 1;
    totals.goals += result.home_goals as u32 + result.away_goals as u32;
    totals.shots += report.home_stats.shots as u32 + report.away_stats.shots as u32;
    totals.shots_on_target +=
        report.home_stats.shots_on_target as u32 + report.away_stats.shots_on_target as u32;
    if result.home_goals > result.away_goals {
        totals.home_wins += 1;
    } else if result.home_goals == result.away_goals {
        totals.draws += 1;
    } else {
        totals.away_wins += 1;
    }
}

fn collect_completed_matches(game: &Game, totals: &mut MatchTotals) {
    if let Some(league) = game.league.as_ref() {
        for fixture in &league.fixtures {
            if fixture.status == FixtureStatus::Completed {
                if let Some(result) = fixture.result.as_ref() {
                    collect_match_result(totals, result);
                }
            }
        }
    }
}

fn collect_player_season_stats(game: &Game, totals: &mut MatchTotals) {
    for player in &game.players {
        let stats = &player.stats;
        if stats.minutes_played == 0 {
            continue;
        }

        totals.passes_completed += stats.passes_completed;
        totals.passes_attempted += stats.passes_attempted;
        totals.rating_sum += stats.avg_rating as f64 * stats.appearances as f64;
        totals.rating_count += stats.appearances;

        let group = player.position.to_group_position();
        if stats.goals > 0 {
            *totals.scorers_by_group.entry(group.clone()).or_default() += stats.goals;
        }
        if stats.assists > 0 {
            *totals.assists_by_group.entry(group).or_default() += stats.assists;
        }
    }
}

fn collect_attributes(game: &Game, by_granular: &mut HashMap<Position, AttributeTotals>) {
    for player in &game.players {
        by_granular
            .entry(player.position.clone())
            .or_default()
            .add(player);
    }
}

fn run_world(
    world_index: u32,
    args: Args,
    totals: &mut MatchTotals,
    attrs: &mut HashMap<Position, AttributeTotals>,
) {
    let mut game = make_game(world_index);
    collect_attributes(&game, attrs);

    let mut completed_seasons = 0;
    let mut days = 0;

    while completed_seasons < args.seasons && days < args.max_days {
        process_day(&mut game);
        days += 1;

        if is_season_complete(&game) {
            collect_completed_matches(&game, totals);
            collect_player_season_stats(&game, totals);
            process_end_of_season(&mut game);
            completed_seasons += 1;
        }
    }

    if completed_seasons < args.seasons {
        eprintln!(
            "world {world_index}: stopped after {days} days with only {completed_seasons}/{} seasons complete",
            args.seasons
        );
    }
}

fn print_group_counts(label: &str, counts: &HashMap<Position, u32>) {
    println!("{label}:");
    for group in [
        Position::Goalkeeper,
        Position::Defender,
        Position::Midfielder,
        Position::Forward,
    ] {
        println!(
            "  {:?}: {}",
            group,
            counts.get(&group).copied().unwrap_or(0)
        );
    }
}

fn print_attribute_summary(attrs: &HashMap<Position, AttributeTotals>) {
    println!("\n=== Generated granular attribute averages ===");
    let mut entries = attrs.iter().collect::<Vec<_>>();
    entries.sort_by_key(|(position, _)| format!("{:?}", position));

    for (position, totals) in entries {
        println!(
            "{:?}: n={} ovr={:.1} sho={:.1} pass={:.1} vis={:.1} def={:.1} tack={:.1} aer={:.1}",
            position,
            totals.count,
            totals.avg(totals.ovr),
            totals.avg(totals.shooting),
            totals.avg(totals.passing),
            totals.avg(totals.vision),
            totals.avg(totals.defending),
            totals.avg(totals.tackling),
            totals.avg(totals.aerial),
        );
    }
}

fn main() {
    let args = parse_args();
    let mut totals = MatchTotals::default();
    let mut attrs = HashMap::new();

    for world_index in 0..args.worlds {
        run_world(world_index, args, &mut totals, &mut attrs);
    }

    let pass_attempts = totals.passes_attempted;
    println!("=== Generated-world realism benchmark ===");
    println!("worlds: {}", args.worlds);
    println!("target seasons/world: {}", args.seasons);
    println!("matches: {}", totals.matches);
    println!(
        "avg goals/game: {:.2}",
        totals.goals as f64 / totals.matches.max(1) as f64
    );
    println!(
        "avg shots/game: {:.2}",
        totals.shots as f64 / totals.matches.max(1) as f64
    );
    println!(
        "SOT rate: {:.1}%",
        totals.shots_on_target as f64 * 100.0 / totals.shots.max(1) as f64
    );
    println!(
        "pass accuracy: {:.1}%",
        totals.passes_completed as f64 * 100.0 / pass_attempts.max(1) as f64
    );
    println!(
        "avg rating: {:.2}",
        totals.rating_sum / totals.rating_count.max(1) as f64
    );
    println!(
        "results: home={} draw={} away={}",
        totals.home_wins, totals.draws, totals.away_wins
    );
    print_group_counts("scorers by group", &totals.scorers_by_group);
    print_group_counts("assists by group", &totals.assists_by_group);
    print_attribute_summary(&attrs);
}
