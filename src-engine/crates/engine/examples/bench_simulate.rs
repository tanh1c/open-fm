// Native benchmark: simulate N matches and print elapsed time + throughput.
// Run with: cargo run --release -p engine --example bench_simulate

use engine::{
    MatchConfig, PlayStyle, PlayerData, Position, ShapeProfile, TacticalProfile, TeamData,
    simulate_with_rng,
};
use rand::SeedableRng;
use rand::rngs::StdRng;
use std::time::Instant;

fn make_player(id: &str, position: Position, skill: u8) -> PlayerData {
    PlayerData {
        id: id.to_string(),
        name: id.to_string(),
        position,
        ovr: skill,
        condition: 90,
        morale: 50,
        fitness: 75,
        pace: skill,
        stamina: skill,
        strength: skill,
        agility: skill,
        passing: skill,
        shooting: skill,
        tackling: skill,
        dribbling: skill,
        defending: skill,
        positioning: skill,
        vision: skill,
        decisions: skill,
        composure: skill,
        aggression: skill,
        teamwork: skill,
        leadership: skill,
        handling: skill,
        reflexes: skill,
        aerial: skill,
        traits: vec![],
    }
}

fn make_team(id: &str, skill: u8) -> TeamData {
    let mut players = vec![make_player(&format!("{id}_gk"), Position::Goalkeeper, skill)];
    for i in 0..4 {
        players.push(make_player(&format!("{id}_def{i}"), Position::Defender, skill));
    }
    for i in 0..4 {
        players.push(make_player(&format!("{id}_mid{i}"), Position::Midfielder, skill));
    }
    for i in 0..2 {
        players.push(make_player(&format!("{id}_fwd{i}"), Position::Forward, skill));
    }
    TeamData {
        id: id.to_string(),
        name: id.to_string(),
        formation: "4-4-2".to_string(),
        play_style: PlayStyle::Balanced,
        players,
        form: Vec::new(),
        tactical_familiarity: 0.5,
        shape_profile: ShapeProfile::default(),
        tactical_profile: TacticalProfile::default(),
    }
}

fn main() {
    let n: u32 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(10_000);

    let home = make_team("HOM", 75);
    let away = make_team("AWY", 70);
    let config = MatchConfig::default();

    // Warmup
    let mut rng = StdRng::seed_from_u64(1);
    for _ in 0..100 {
        let _ = simulate_with_rng(&home, &away, &config, &mut rng);
    }

    let mut rng = StdRng::seed_from_u64(42);
    let mut total_home = 0u64;
    let mut total_away = 0u64;
    let start = Instant::now();
    for _ in 0..n {
        let r = simulate_with_rng(&home, &away, &config, &mut rng);
        total_home += r.home_goals as u64;
        total_away += r.away_goals as u64;
    }
    let elapsed = start.elapsed();
    let ms = elapsed.as_secs_f64() * 1000.0;
    let per_match_us = ms * 1000.0 / n as f64;

    println!("=== Native engine benchmark ===");
    println!("matches:        {}", n);
    println!("total elapsed:  {:.2} ms", ms);
    println!("per match:      {:.2} µs", per_match_us);
    println!("throughput:     {:.0} matches/sec", n as f64 / elapsed.as_secs_f64());
    println!("home_goals_sum: {}", total_home);
    println!("away_goals_sum: {}", total_away);
}
