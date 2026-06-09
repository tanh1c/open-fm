use std::collections::HashMap;

use chrono::{TimeZone, Utc};
use domain::league::{FixtureStatus, MatchResult};
use domain::manager::Manager;
use domain::player::Position;
use domain::stats::PlayerMatchStatsRecord;
use ofm_core::clock::GameClock;
use ofm_core::end_of_season::{is_season_complete, process_end_of_season};
use ofm_core::game::Game;
use ofm_core::generator::{generate_fc26_world, generate_world};
use ofm_core::schedule::generate_domestic_competitions_by_country;
use ofm_core::turn::process_day_with_capture;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WorldSource {
    Generated,
    Fc26,
}

#[derive(Debug, Clone, Copy)]
struct Args {
    worlds: u32,
    seasons: u32,
    max_days: u32,
    world_source: WorldSource,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            worlds: 3,
            seasons: 3,
            max_days: 1500,
            world_source: WorldSource::Generated,
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
    tackles: u32,
    interceptions: u32,
    corners: u32,
    fouls: u32,
    yellow_cards: u32,
    red_cards: u32,
    possession_sum: f64,
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

#[derive(Default)]
struct SeasonPeakTotals {
    seasons: u32,
    top_goals_sum: u32,
    top_assists_sum: u32,
    top_five_goals_sum: u32,
    top_five_assists_sum: u32,
    top_goals_max: u32,
    top_assists_max: u32,
    top_goal_entries: Vec<SeasonPeakEntry>,
    top_assist_entries: Vec<SeasonPeakEntry>,
}

#[derive(Clone)]
struct SeasonPeakEntry {
    world: u32,
    season_index: u32,
    player_name: String,
    team_name: String,
    position: Position,
    value: u32,
    ovr: u8,
    appearances: u32,
    minutes: u32,
}

#[derive(Default)]
struct AllCompetitionTally {
    goals: u32,
    assists: u32,
    appearances: u32,
    minutes: u32,
    team_id: String,
}

#[derive(Default)]
struct TierOvrTotals {
    teams: u32,
    players: u32,
    team_avg_sum: f64,
    top_three_sum: f64,
    bottom_three_sum: f64,
    min_team_avg: f64,
    max_team_avg: f64,
}

impl SeasonPeakTotals {
    fn add_season(&mut self, top_goals: Vec<SeasonPeakEntry>, top_assists: Vec<SeasonPeakEntry>) {
        self.seasons += 1;

        self.top_five_goals_sum += top_goals.iter().map(|entry| entry.value).sum::<u32>();
        self.top_five_assists_sum += top_assists.iter().map(|entry| entry.value).sum::<u32>();

        if let Some(entry) = top_goals.first() {
            self.top_goals_sum += entry.value;
            self.top_goals_max = self.top_goals_max.max(entry.value);
        }
        if let Some(entry) = top_assists.first() {
            self.top_assists_sum += entry.value;
            self.top_assists_max = self.top_assists_max.max(entry.value);
        }

        self.top_goal_entries.extend(top_goals);
        self.top_assist_entries.extend(top_assists);
    }
}

impl TierOvrTotals {
    fn add_team(&mut self, players: &[&domain::player::Player]) {
        if players.is_empty() {
            return;
        }

        let mut ovrs = players.iter().map(|player| player.ovr).collect::<Vec<_>>();
        ovrs.sort_unstable();
        let team_avg = ovrs.iter().map(|ovr| *ovr as u32).sum::<u32>() as f64 / ovrs.len() as f64;
        let top_count = ovrs.len().min(3);
        let top_three = ovrs.iter().rev().take(top_count).map(|ovr| *ovr as u32).sum::<u32>() as f64
            / top_count as f64;
        let bottom_three = ovrs.iter().take(top_count).map(|ovr| *ovr as u32).sum::<u32>() as f64
            / top_count as f64;

        self.teams += 1;
        self.players += ovrs.len() as u32;
        self.team_avg_sum += team_avg;
        self.top_three_sum += top_three;
        self.bottom_three_sum += bottom_three;
        self.min_team_avg = if self.teams == 1 {
            team_avg
        } else {
            self.min_team_avg.min(team_avg)
        };
        self.max_team_avg = self.max_team_avg.max(team_avg);
    }
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
            "--world" => {
                args.world_source = match raw.next().as_deref() {
                    Some("fc26") | Some("real-fc26") => WorldSource::Fc26,
                    _ => WorldSource::Generated,
                };
                None
            }
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

fn make_game(world_index: u32, world_source: WorldSource) -> Game {
    let (teams, players, staff) = match world_source {
        WorldSource::Generated => generate_world(None),
        WorldSource::Fc26 => generate_fc26_world().expect("FC26 world should generate"),
    };
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
    totals.passes_completed += report.home_stats.passes_completed as u32 + report.away_stats.passes_completed as u32;
    totals.passes_attempted += report.home_stats.passes_completed as u32
        + report.home_stats.passes_intercepted as u32
        + report.away_stats.passes_completed as u32
        + report.away_stats.passes_intercepted as u32;
    totals.tackles += report.home_stats.tackles as u32 + report.away_stats.tackles as u32;
    totals.interceptions += report.home_stats.interceptions as u32 + report.away_stats.interceptions as u32;
    totals.corners += report.home_stats.corners as u32 + report.away_stats.corners as u32;
    totals.fouls += report.home_stats.fouls as u32 + report.away_stats.fouls as u32;
    totals.yellow_cards += report.home_stats.yellow_cards as u32 + report.away_stats.yellow_cards as u32;
    totals.red_cards += report.home_stats.red_cards as u32 + report.away_stats.red_cards as u32;
    totals.possession_sum += report.home_stats.possession_pct as f64;
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

fn collect_tier_ovr_spread(game: &Game, tiers: &mut HashMap<u8, TierOvrTotals>) {
    for team in &game.teams {
        let players = game
            .players
            .iter()
            .filter(|player| player.team_id.as_deref() == Some(team.id.as_str()))
            .collect::<Vec<_>>();
        tiers
            .entry(team.domestic_tier.unwrap_or(0))
            .or_default()
            .add_team(&players);
    }
}

fn season_peak_entries(
    game: &Game,
    world_index: u32,
    season_index: u32,
    value_fn: impl Fn(&domain::player::Player) -> u32,
) -> Vec<SeasonPeakEntry> {
    let mut entries = game
        .players
        .iter()
        .filter(|player| player.stats.minutes_played > 0)
        .map(|player| {
            let team_name = player
                .team_id
                .as_ref()
                .and_then(|team_id| game.teams.iter().find(|team| team.id == *team_id))
                .map(|team| team.name.clone())
                .unwrap_or_else(|| "Free Agent".to_string());

            SeasonPeakEntry {
                world: world_index,
                season_index,
                player_name: player.full_name.clone(),
                team_name,
                position: player.position.clone(),
                value: value_fn(player),
                ovr: player.ovr,
                appearances: player.stats.appearances,
                minutes: player.stats.minutes_played,
            }
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.value.cmp(&left.value).then_with(|| left.player_name.cmp(&right.player_name)));
    entries.truncate(5);
    entries
}

fn collect_season_peaks(game: &Game, world_index: u32, season_index: u32, peaks: &mut SeasonPeakTotals) {
    let top_goals = season_peak_entries(game, world_index, season_index, |player| player.stats.goals);
    let top_assists = season_peak_entries(game, world_index, season_index, |player| player.stats.assists);
    peaks.add_season(top_goals, top_assists);
}

fn collect_all_competition_records(tallies: &mut HashMap<(u32, String), AllCompetitionTally>, records: Vec<PlayerMatchStatsRecord>) {
    for record in records {
        let tally = tallies
            .entry((record.season, record.player_id.clone()))
            .or_default();
        tally.goals += record.goals as u32;
        tally.assists += record.assists as u32;
        tally.appearances += u32::from(record.minutes_played > 0);
        tally.minutes += record.minutes_played as u32;
        tally.team_id = record.team_id;
    }
}

fn all_competition_peak_entries(
    game: &Game,
    world_index: u32,
    season_index: u32,
    tallies: &HashMap<(u32, String), AllCompetitionTally>,
    value_fn: impl Fn(&AllCompetitionTally) -> u32,
) -> Vec<SeasonPeakEntry> {
    let season = game
        .primary_league_competition()
        .map(|competition| competition.season)
        .or_else(|| game.league.as_ref().map(|league| league.season))
        .unwrap_or_default();

    let mut entries = tallies
        .iter()
        .filter(|((record_season, _), tally)| *record_season == season && tally.minutes > 0)
        .filter_map(|((_, player_id), tally)| {
            let player = game.players.iter().find(|player| player.id == *player_id)?;
            let team_name = game
                .teams
                .iter()
                .find(|team| team.id == tally.team_id)
                .map(|team| team.name.clone())
                .unwrap_or_else(|| "Free Agent".to_string());

            Some(SeasonPeakEntry {
                world: world_index,
                season_index,
                player_name: player.full_name.clone(),
                team_name,
                position: player.position.clone(),
                value: value_fn(tally),
                ovr: player.ovr,
                appearances: tally.appearances,
                minutes: tally.minutes,
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| right.value.cmp(&left.value).then_with(|| left.player_name.cmp(&right.player_name)));
    entries.truncate(5);
    entries
}

fn collect_all_competition_season_peaks(
    game: &Game,
    world_index: u32,
    season_index: u32,
    tallies: &HashMap<(u32, String), AllCompetitionTally>,
    peaks: &mut SeasonPeakTotals,
) {
    let top_goals = all_competition_peak_entries(game, world_index, season_index, tallies, |tally| tally.goals);
    let top_assists = all_competition_peak_entries(game, world_index, season_index, tallies, |tally| tally.assists);
    peaks.add_season(top_goals, top_assists);
}

fn run_world(
    world_index: u32,
    args: Args,
    totals: &mut MatchTotals,
    attrs: &mut HashMap<Position, AttributeTotals>,
    peaks: &mut SeasonPeakTotals,
    all_competition_peaks: &mut SeasonPeakTotals,
    tiers: &mut HashMap<u8, TierOvrTotals>,
) {
    let mut game = make_game(world_index, args.world_source);
    collect_attributes(&game, attrs);
    collect_tier_ovr_spread(&game, tiers);

    let mut completed_seasons = 0;
    let mut days = 0;
    let mut all_competition_tallies = HashMap::new();

    while completed_seasons < args.seasons && days < args.max_days {
        process_day_with_capture(&mut game, &mut |stats| {
            collect_all_competition_records(&mut all_competition_tallies, stats.player_matches);
        });
        days += 1;

        if is_season_complete(&game) {
            collect_completed_matches(&game, totals);
            collect_player_season_stats(&game, totals);
            collect_season_peaks(&game, world_index, completed_seasons + 1, peaks);
            collect_all_competition_season_peaks(
                &game,
                world_index,
                completed_seasons + 1,
                &all_competition_tallies,
                all_competition_peaks,
            );
            process_end_of_season(&mut game);
            all_competition_tallies.clear();
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
    let total = counts.values().copied().sum::<u32>().max(1);
    for group in [
        Position::Goalkeeper,
        Position::Defender,
        Position::Midfielder,
        Position::Forward,
    ] {
        let count = counts.get(&group).copied().unwrap_or(0);
        println!("  {:?}: {} ({:.1}%)", group, count, count as f64 * 100.0 / total as f64);
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

fn print_peak_entries(label: &str, entries: &[SeasonPeakEntry]) {
    println!("{label}:");
    let mut entries = entries.to_vec();
    entries.sort_by_key(|entry| entry.value);
    for entry in entries.iter().rev().take(8) {
        println!(
            "  world={} season={} {} ({:?}, {}, OVR {}, apps {}, mins {}) = {}",
            entry.world,
            entry.season_index,
            entry.player_name,
            entry.position,
            entry.team_name,
            entry.ovr,
            entry.appearances,
            entry.minutes,
            entry.value
        );
    }
}

fn print_season_peak_summary(label: &str, peaks: &SeasonPeakTotals) {
    println!("\n=== {label} top scorer/top assist peaks ===");
    println!("completed seasons: {}", peaks.seasons);
    println!(
        "top goals: avg={:.1} top5_avg={:.1} max={}",
        peaks.top_goals_sum as f64 / peaks.seasons.max(1) as f64,
        peaks.top_five_goals_sum as f64 / (peaks.seasons.max(1) * 5) as f64,
        peaks.top_goals_max
    );
    println!(
        "top assists: avg={:.1} top5_avg={:.1} max={}",
        peaks.top_assists_sum as f64 / peaks.seasons.max(1) as f64,
        peaks.top_five_assists_sum as f64 / (peaks.seasons.max(1) * 5) as f64,
        peaks.top_assists_max
    );
    print_peak_entries("highest goal seasons", &peaks.top_goal_entries);
    print_peak_entries("highest assist seasons", &peaks.top_assist_entries);
}

fn print_tier_ovr_summary(tiers: &HashMap<u8, TierOvrTotals>) {
    println!("\n=== Generated OVR spread by domestic tier ===");
    let mut entries = tiers.iter().collect::<Vec<_>>();
    entries.sort_by_key(|(tier, _)| **tier);

    for (tier, totals) in entries {
        println!(
            "tier {}: teams={} players={} team_avg={:.1} top3={:.1} bottom3={:.1} min_team={:.1} max_team={:.1}",
            tier,
            totals.teams,
            totals.players,
            totals.team_avg_sum / totals.teams.max(1) as f64,
            totals.top_three_sum / totals.teams.max(1) as f64,
            totals.bottom_three_sum / totals.teams.max(1) as f64,
            totals.min_team_avg,
            totals.max_team_avg,
        );
    }
}

fn main() {
    let args = parse_args();
    let mut totals = MatchTotals::default();
    let mut attrs = HashMap::new();
    let mut peaks = SeasonPeakTotals::default();
    let mut all_competition_peaks = SeasonPeakTotals::default();
    let mut tiers = HashMap::new();

    for world_index in 0..args.worlds {
        run_world(
            world_index,
            args,
            &mut totals,
            &mut attrs,
            &mut peaks,
            &mut all_competition_peaks,
            &mut tiers,
        );
    }

    let pass_attempts = totals.passes_attempted;
    let world_label = match args.world_source {
        WorldSource::Generated => "Generated-world",
        WorldSource::Fc26 => "FC26 Real World",
    };
    println!("=== {world_label} realism benchmark ===");
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
        "avg passes/team: completed={:.1} attempted={:.1}",
        totals.passes_completed as f64 / (totals.matches.max(1) * 2) as f64,
        totals.passes_attempted as f64 / (totals.matches.max(1) * 2) as f64
    );
    println!(
        "avg defensive actions/game: tackles={:.2} interceptions={:.2}",
        totals.tackles as f64 / totals.matches.max(1) as f64,
        totals.interceptions as f64 / totals.matches.max(1) as f64
    );
    println!(
        "avg set pieces/game: corners={:.2} fouls={:.2}",
        totals.corners as f64 / totals.matches.max(1) as f64,
        totals.fouls as f64 / totals.matches.max(1) as f64
    );
    println!(
        "avg cards/game: yellow={:.2} red={:.2}",
        totals.yellow_cards as f64 / totals.matches.max(1) as f64,
        totals.red_cards as f64 / totals.matches.max(1) as f64
    );
    println!(
        "avg home possession: {:.1}%",
        totals.possession_sum / totals.matches.max(1) as f64
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
    print_season_peak_summary("League-only", &peaks);
    print_season_peak_summary("All-competitions", &all_competition_peaks);
    print_tier_ovr_summary(&tiers);
    print_attribute_summary(&attrs);
}
