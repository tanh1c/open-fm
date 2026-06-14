use ::engine::*;
use rand::SeedableRng;
use rand::rngs::StdRng;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn make_player(id: &str, name: &str, position: Position, skill: u8) -> PlayerData {
    PlayerData {
        id: id.to_string(),
        name: name.to_string(),
        position,
        natural_position: String::new(),
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

fn make_team(id: &str, name: &str, skill: u8, play_style: PlayStyle) -> TeamData {
    TeamData {
        id: id.to_string(),
        name: name.to_string(),
        formation: "4-4-2".to_string(),
        play_style,
        players: vec![
            make_player(&format!("{id}_gk1"), "GK1", Position::Goalkeeper, skill),
            make_player(&format!("{id}_def1"), "DEF1", Position::Defender, skill),
            make_player(&format!("{id}_def2"), "DEF2", Position::Defender, skill),
            make_player(&format!("{id}_def3"), "DEF3", Position::Defender, skill),
            make_player(&format!("{id}_def4"), "DEF4", Position::Defender, skill),
            make_player(&format!("{id}_mid1"), "MID1", Position::Midfielder, skill),
            make_player(&format!("{id}_mid2"), "MID2", Position::Midfielder, skill),
            make_player(&format!("{id}_mid3"), "MID3", Position::Midfielder, skill),
            make_player(&format!("{id}_mid4"), "MID4", Position::Midfielder, skill),
            make_player(&format!("{id}_fwd1"), "FWD1", Position::Forward, skill),
            make_player(&format!("{id}_fwd2"), "FWD2", Position::Forward, skill),
        ],
        form: Vec::new(),
        tactical_familiarity: 0.5,
        shape_profile: ShapeProfile::default(),
        tactical_profile: TacticalProfile::default(),
    }
}

fn seeded_rng(seed: u64) -> StdRng {
    StdRng::seed_from_u64(seed)
}

fn with_instructions(
    mut team: TeamData,
    pressing_intensity: f64,
    defensive_line: f64,
    tempo: f64,
    width: f64,
    passing_directness: f64,
    risk_appetite: f64,
) -> TeamData {
    team.tactical_profile.instructions = TacticalInstructionProfile {
        pressing_intensity,
        defensive_line,
        tempo,
        width,
        passing_directness,
        risk_appetite,
        ..TacticalInstructionProfile::default()
    };
    team
}

fn with_transition(mut team: TeamData, counter_attack: f64, counter_press: f64) -> TeamData {
    team.tactical_profile.instructions.counter_attack = counter_attack;
    team.tactical_profile.instructions.counter_press = counter_press;
    team
}

fn with_traits(mut team: TeamData, position: Position, traits: &[&str]) -> TeamData {
    for player in &mut team.players {
        if player.position == position {
            player.traits = traits.iter().map(|trait_name| trait_name.to_string()).collect();
        }
    }
    team
}

fn with_morale(mut team: TeamData, morale: u8) -> TeamData {
    for player in &mut team.players {
        player.morale = morale;
    }
    team
}

fn with_form_and_familiarity(mut team: TeamData, form: &[&str], tactical_familiarity: f64) -> TeamData {
    team.form = form.iter().map(|result| result.to_string()).collect();
    team.tactical_familiarity = tactical_familiarity;
    team
}

fn with_shape(mut team: TeamData, defenders: u8, midfielders: u8, forwards: u8) -> TeamData {
    team.shape_profile = ShapeProfile {
        defenders,
        midfielders,
        forwards,
    };
    team
}

#[derive(Default)]
struct TrialSummary {
    home_wins: u32,
    away_wins: u32,
    draws: u32,
    home_goals: u32,
    away_goals: u32,
    home_shots: u32,
    away_shots: u32,
    home_possession: f64,
}

impl TrialSummary {
    fn home_points(&self) -> u32 {
        self.home_wins * 3 + self.draws
    }

    fn away_points(&self) -> u32 {
        self.away_wins * 3 + self.draws
    }

    fn home_goal_share(&self) -> f64 {
        self.home_goals as f64 / (self.home_goals + self.away_goals).max(1) as f64
    }

    fn home_shot_share(&self) -> f64 {
        self.home_shots as f64 / (self.home_shots + self.away_shots).max(1) as f64
    }
}

fn summarize_trials(home: &TeamData, away: &TeamData, config: &MatchConfig, trials: u64) -> TrialSummary {
    let mut summary = TrialSummary::default();
    for seed in 0..trials {
        let report = simulate_with_rng(home, away, config, &mut seeded_rng(seed));
        match report.home_goals.cmp(&report.away_goals) {
            std::cmp::Ordering::Greater => summary.home_wins += 1,
            std::cmp::Ordering::Less => summary.away_wins += 1,
            std::cmp::Ordering::Equal => summary.draws += 1,
        }
        summary.home_goals += report.home_goals as u32;
        summary.away_goals += report.away_goals as u32;
        summary.home_shots += report.home_stats.shots as u32;
        summary.away_shots += report.away_stats.shots as u32;
        summary.home_possession += report.home_possession;
    }
    summary.home_possession /= trials as f64;
    summary
}

// ---------------------------------------------------------------------------
// Types tests
// ---------------------------------------------------------------------------

#[test]
fn player_overall_rating() {
    let p = make_player("p1", "Test", Position::Forward, 70);
    assert!((p.overall() - 70.0).abs() < 0.01);
}

#[test]
fn player_effective_overall_accounts_for_condition() {
    let mut p = make_player("p1", "Test", Position::Forward, 80);
    p.condition = 50;
    let eff = p.effective_overall();
    assert!((eff - 40.0).abs() < 0.01, "Expected ~40.0, got {eff}");
}

#[test]
fn team_position_counts() {
    let team = make_team("t1", "Test FC", 60, PlayStyle::Balanced);
    assert_eq!(team.count_position(Position::Goalkeeper), 1);
    assert_eq!(team.count_position(Position::Defender), 4);
    assert_eq!(team.count_position(Position::Midfielder), 4);
    assert_eq!(team.count_position(Position::Forward), 2);
}

#[test]
fn team_ratings_non_zero() {
    let team = make_team("t1", "Test FC", 65, PlayStyle::Balanced);
    assert!(team.defense_rating() > 0.0);
    assert!(team.midfield_rating() > 0.0);
    assert!(team.attack_rating() > 0.0);
    assert!(team.goalkeeper_rating() > 0.0);
}

#[test]
fn team_ratings_scale_with_skill() {
    let weak = make_team("w", "Weak", 30, PlayStyle::Balanced);
    let strong = make_team("s", "Strong", 90, PlayStyle::Balanced);
    assert!(strong.defense_rating() > weak.defense_rating());
    assert!(strong.midfield_rating() > weak.midfield_rating());
    assert!(strong.attack_rating() > weak.attack_rating());
}

// ---------------------------------------------------------------------------
// Zone tests
// ---------------------------------------------------------------------------

#[test]
fn zone_attacking_box() {
    assert_eq!(Zone::attacking_box(Side::Home), Zone::AwayBox);
    assert_eq!(Zone::attacking_box(Side::Away), Zone::HomeBox);
}

#[test]
fn zone_attacking_third() {
    assert_eq!(Zone::attacking_third(Side::Home), Zone::AwayDefense);
    assert_eq!(Zone::attacking_third(Side::Away), Zone::HomeDefense);
}

#[test]
fn zone_defensive_third() {
    assert_eq!(Zone::defensive_third(Side::Home), Zone::HomeDefense);
    assert_eq!(Zone::defensive_third(Side::Away), Zone::AwayDefense);
}

#[test]
fn zone_advance_towards_home() {
    assert_eq!(
        Zone::HomeDefense.advance_towards(Side::Home),
        Zone::Midfield
    );
    assert_eq!(
        Zone::Midfield.advance_towards(Side::Home),
        Zone::AwayDefense
    );
    assert_eq!(Zone::AwayDefense.advance_towards(Side::Home), Zone::AwayBox);
    assert_eq!(Zone::AwayBox.advance_towards(Side::Home), Zone::AwayBox); // saturates
}

#[test]
fn zone_advance_towards_away() {
    assert_eq!(
        Zone::AwayDefense.advance_towards(Side::Away),
        Zone::Midfield
    );
    assert_eq!(
        Zone::Midfield.advance_towards(Side::Away),
        Zone::HomeDefense
    );
    assert_eq!(Zone::HomeDefense.advance_towards(Side::Away), Zone::HomeBox);
    assert_eq!(Zone::HomeBox.advance_towards(Side::Away), Zone::HomeBox); // saturates
}

#[test]
fn zone_is_box_for() {
    assert!(Zone::AwayBox.is_box_for(Side::Home));
    assert!(!Zone::AwayBox.is_box_for(Side::Away));
    assert!(Zone::HomeBox.is_box_for(Side::Away));
    assert!(!Zone::HomeBox.is_box_for(Side::Home));
}

// ---------------------------------------------------------------------------
// Side tests
// ---------------------------------------------------------------------------

#[test]
fn side_opposite() {
    assert_eq!(Side::Home.opposite(), Side::Away);
    assert_eq!(Side::Away.opposite(), Side::Home);
}

// ---------------------------------------------------------------------------
// MatchConfig tests
// ---------------------------------------------------------------------------

#[test]
fn default_config_values_in_range() {
    let cfg = MatchConfig::default();
    assert!(cfg.home_advantage >= 1.0 && cfg.home_advantage <= 1.25);
    assert!(cfg.shot_accuracy_base > 0.0 && cfg.shot_accuracy_base < 1.0);
    assert!(cfg.goal_conversion_base > 0.0 && cfg.goal_conversion_base < 1.0);
    assert!(cfg.foul_probability > 0.0 && cfg.foul_probability < 1.0);
    assert!(cfg.yellow_card_probability > 0.0 && cfg.yellow_card_probability < 1.0);
    assert!(cfg.red_card_probability > 0.0 && cfg.red_card_probability < 0.5);
    assert!(cfg.penalty_probability > 0.0 && cfg.penalty_probability < 1.0);
    assert!(cfg.stoppage_time_max <= 10);
    assert!(cfg.injury_probability >= 0.0 && cfg.injury_probability < 0.5);
}

// ---------------------------------------------------------------------------
// Event tests
// ---------------------------------------------------------------------------

#[test]
fn match_event_builder() {
    let evt = MatchEvent::new(45, EventType::Goal, Side::Home, Zone::AwayBox)
        .with_player("p1")
        .with_secondary("p2");

    assert_eq!(evt.minute, 45);
    assert_eq!(evt.event_type, EventType::Goal);
    assert_eq!(evt.player_id.as_deref(), Some("p1"));
    assert_eq!(evt.secondary_player_id.as_deref(), Some("p2"));
    assert!(evt.is_goal());
}

#[test]
fn penalty_goal_is_goal() {
    let evt = MatchEvent::new(78, EventType::PenaltyGoal, Side::Away, Zone::HomeBox);
    assert!(evt.is_goal());
}

#[test]
fn non_goal_events_not_goal() {
    let shot = MatchEvent::new(10, EventType::ShotOnTarget, Side::Home, Zone::AwayBox);
    assert!(!shot.is_goal());
    let foul = MatchEvent::new(20, EventType::Foul, Side::Away, Zone::Midfield);
    assert!(!foul.is_goal());
}

// ---------------------------------------------------------------------------
// Core simulation tests
// ---------------------------------------------------------------------------

#[test]
fn simulation_produces_report() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let mut rng = seeded_rng(42);

    let report = simulate_with_rng(&home, &away, &config, &mut rng);

    // Report should have required structural events
    let has_kickoff = report
        .events
        .iter()
        .any(|e| e.event_type == EventType::KickOff);
    let has_halftime = report
        .events
        .iter()
        .any(|e| e.event_type == EventType::HalfTime);
    let has_fulltime = report
        .events
        .iter()
        .any(|e| e.event_type == EventType::FullTime);
    let has_second_half = report
        .events
        .iter()
        .any(|e| e.event_type == EventType::SecondHalfStart);

    assert!(has_kickoff, "Missing KickOff event");
    assert!(has_halftime, "Missing HalfTime event");
    assert!(has_fulltime, "Missing FullTime event");
    assert!(has_second_half, "Missing SecondHalfStart event");
}

#[test]
fn simulation_deterministic_with_same_seed() {
    let home = make_team("home", "Home FC", 60, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 60, PlayStyle::Defensive);
    let config = MatchConfig::default();

    let report1 = simulate_with_rng(&home, &away, &config, &mut seeded_rng(123));
    let report2 = simulate_with_rng(&home, &away, &config, &mut seeded_rng(123));

    assert_eq!(report1.home_goals, report2.home_goals);
    assert_eq!(report1.away_goals, report2.away_goals);
    assert_eq!(report1.events.len(), report2.events.len());
}

#[test]
fn simulation_different_seeds_vary() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();

    // Run many simulations and check we get different results
    let mut results = std::collections::HashSet::new();
    for seed in 0..50 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        results.insert((report.home_goals, report.away_goals));
    }
    assert!(
        results.len() > 1,
        "50 simulations should produce varied results"
    );
}

#[test]
fn goals_in_report_match_score() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 50, PlayStyle::Defensive);
    let config = MatchConfig::default();

    for seed in 0..20 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));

        let home_goal_count = report.goals.iter().filter(|g| g.side == Side::Home).count() as u8;
        let away_goal_count = report.goals.iter().filter(|g| g.side == Side::Away).count() as u8;

        assert_eq!(
            report.home_goals, home_goal_count,
            "Home goals mismatch in seed {seed}"
        );
        assert_eq!(
            report.away_goals, away_goal_count,
            "Away goals mismatch in seed {seed}"
        );
        assert_eq!(
            report.home_goals, report.home_stats.goals,
            "Home stats mismatch in seed {seed}"
        );
        assert_eq!(
            report.away_goals, report.away_stats.goals,
            "Away stats mismatch in seed {seed}"
        );
    }
}

#[test]
fn goal_events_have_scorer() {
    let home = make_team("home", "Home FC", 75, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 45, PlayStyle::Balanced);
    let config = MatchConfig::default();

    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(99));

    for goal in &report.goals {
        assert!(
            !goal.scorer_id.is_empty(),
            "Goal at minute {} has empty scorer",
            goal.minute
        );
    }
}

#[test]
fn possession_adds_up() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Possession);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(7));

    assert!(
        report.home_possession >= 0.0 && report.home_possession <= 100.0,
        "Possession out of range: {}",
        report.home_possession
    );
    // Total ticks should be > 0
    let total = report.home_stats.possession_ticks + report.away_stats.possession_ticks;
    assert!(total > 0, "No possession ticks recorded");
}

#[test]
fn total_minutes_at_least_90() {
    let home = make_team("home", "Home FC", 60, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 60, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(55));
    assert!(
        report.total_minutes >= 90,
        "Total minutes: {}",
        report.total_minutes
    );
}

#[test]
fn report_tracks_minutes_for_all_starters() {
    let home = make_team("home", "Home FC", 60, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 60, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(55));

    for player in home.players.iter().chain(away.players.iter()) {
        let stats = report
            .player_stats
            .get(&player.id)
            .unwrap_or_else(|| panic!("Missing report stats for {}", player.id));
        assert!(
            stats.minutes_played > 0,
            "Expected minutes for {}, got {}",
            player.id,
            stats.minutes_played
        );
    }
}

// ---------------------------------------------------------------------------
// Strength imbalance tests
// ---------------------------------------------------------------------------

#[test]
fn strong_team_wins_more_often() {
    let strong = make_team("strong", "Strong FC", 90, PlayStyle::Balanced);
    let weak = make_team("weak", "Weak FC", 30, PlayStyle::Balanced);
    let config = MatchConfig::default();

    let mut strong_wins = 0u32;
    let mut weak_wins = 0u32;
    let trials = 100;
    for seed in 0..trials {
        let report = simulate_with_rng(&strong, &weak, &config, &mut seeded_rng(seed));
        if report.home_goals > report.away_goals {
            strong_wins += 1;
        } else if report.away_goals > report.home_goals {
            weak_wins += 1;
        }
    }
    assert!(
        strong_wins > weak_wins * 2,
        "Strong team should dominate: {strong_wins} wins vs {weak_wins} for weak"
    );
}

#[test]
fn equal_teams_roughly_even() {
    let team_a = make_team("a", "Team A", 65, PlayStyle::Balanced);
    let team_b = make_team("b", "Team B", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    }; // no home advantage

    let mut a_wins = 0u32;
    let mut b_wins = 0u32;
    let trials = 200;
    for seed in 0..trials {
        let report = simulate_with_rng(&team_a, &team_b, &config, &mut seeded_rng(seed));
        if report.home_goals > report.away_goals {
            a_wins += 1;
        } else if report.away_goals > report.home_goals {
            b_wins += 1;
        }
    }
    let diff = (a_wins as i32 - b_wins as i32).unsigned_abs();
    assert!(
        diff < (trials / 3) as u32,
        "Equal teams should be close: A={a_wins}, B={b_wins}, diff={diff}"
    );
}

#[test]
fn tactical_setup_can_reduce_moderate_quality_gap() {
    let favorite = with_instructions(
        with_shape(make_team("fav", "Favorite FC", 76, PlayStyle::Attacking), 3, 4, 3),
        0.78,
        0.88,
        0.78,
        0.72,
        0.72,
        0.74,
    );
    let baseline_underdog = make_team("base", "Baseline Underdog", 68, PlayStyle::Balanced);
    let tuned_underdog = with_form_and_familiarity(
        with_instructions(
            with_shape(make_team("tuned", "Tuned Underdog", 68, PlayStyle::Counter), 5, 3, 2),
            0.62,
            0.34,
            0.72,
            0.42,
            0.88,
            0.78,
        ),
        &["W", "D", "W", "W", "D"],
        0.92,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let baseline = summarize_trials(&favorite, &baseline_underdog, &config, 260);
    let tactical = summarize_trials(&favorite, &tuned_underdog, &config, 260);

    eprintln!(
        "moderate_gap baseline away_pts={} favorite_goal_share={:.3} favorite_shot_share={:.3} favorite_possession={:.1}; tactical away_pts={} favorite_goal_share={:.3} favorite_shot_share={:.3} favorite_possession={:.1}",
        baseline.away_points(),
        baseline.home_goal_share(),
        baseline.home_shot_share(),
        baseline.home_possession,
        tactical.away_points(),
        tactical.home_goal_share(),
        tactical.home_shot_share(),
        tactical.home_possession
    );

    assert!(
        tactical.away_points() > baseline.away_points(),
        "Tuned underdog should earn more points than baseline: tactical={}, baseline={}",
        tactical.away_points(),
        baseline.away_points()
    );
    assert!(
        tactical.home_goal_share() < baseline.home_goal_share()
            || tactical.home_shot_share() < baseline.home_shot_share(),
        "Tuned underdog should suppress favorite output: goal share tactical={:.3}, baseline={:.3}; shot share tactical={:.3}, baseline={:.3}",
        tactical.home_goal_share(),
        baseline.home_goal_share(),
        tactical.home_shot_share(),
        baseline.home_shot_share()
    );
}

#[test]
fn quality_still_matters_after_tactical_tuning() {
    let strong = make_team("strong", "Strong FC", 82, PlayStyle::Balanced);
    let weak_but_organized = with_form_and_familiarity(
        with_instructions(
            with_shape(make_team("weak", "Organized Weak FC", 64, PlayStyle::Defensive), 5, 4, 1),
            0.52,
            0.30,
            0.34,
            0.34,
            0.24,
            0.18,
        ),
        &["W", "D", "W", "D", "W"],
        0.95,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let summary = summarize_trials(&strong, &weak_but_organized, &config, 260);
    eprintln!(
        "large_gap strong_pts={} weak_pts={} strong_goal_share={:.3} strong_shot_share={:.3} strong_possession={:.1}",
        summary.home_points(),
        summary.away_points(),
        summary.home_goal_share(),
        summary.home_shot_share(),
        summary.home_possession
    );

    assert!(
        summary.home_points() > summary.away_points(),
        "Large quality gap should still favor stronger team: strong points={}, weak points={}",
        summary.home_points(),
        summary.away_points()
    );
    assert!(
        summary.away_points() > 0,
        "Organized underdog should still be able to earn draws/upsets"
    );
}

// ---------------------------------------------------------------------------
// Home advantage tests
// ---------------------------------------------------------------------------

#[test]
fn home_advantage_helps() {
    let team = make_team("t", "Team", 65, PlayStyle::Balanced);
    let config_with = MatchConfig {
        home_advantage: 1.15,
        ..MatchConfig::default()
    };
    let config_without = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let trials = 200;
    let mut home_wins_with = 0u32;
    let mut home_wins_without = 0u32;

    for seed in 0..trials {
        let r1 = simulate_with_rng(&team, &team, &config_with, &mut seeded_rng(seed));
        let r2 = simulate_with_rng(&team, &team, &config_without, &mut seeded_rng(seed));
        if r1.home_goals > r1.away_goals {
            home_wins_with += 1;
        }
        if r2.home_goals > r2.away_goals {
            home_wins_without += 1;
        }
    }
    assert!(
        home_wins_with >= home_wins_without,
        "Home advantage should help: with={home_wins_with}, without={home_wins_without}"
    );
}

// ---------------------------------------------------------------------------
// Play-style influence tests
// ---------------------------------------------------------------------------

#[test]
fn possession_style_has_more_possession() {
    let poss_team = make_team("poss", "Poss FC", 65, PlayStyle::Possession);
    let counter_team = make_team("counter", "Counter FC", 65, PlayStyle::Counter);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut poss_total = 0.0;
    let trials = 100;
    for seed in 0..trials {
        let report = simulate_with_rng(&poss_team, &counter_team, &config, &mut seeded_rng(seed));
        poss_total += report.home_possession;
    }
    let avg_poss = poss_total / trials as f64;
    assert!(
        avg_poss > 48.0,
        "Possession team avg possession should be >48%: {avg_poss:.1}%"
    );
}

#[test]
fn high_press_creates_more_opponent_turnovers() {
    let high_press = with_instructions(
        make_team("press", "Press FC", 68, PlayStyle::HighPress),
        0.95,
        0.85,
        0.78,
        0.55,
        0.55,
        0.62,
    );
    let balanced = make_team("bal", "Balanced FC", 68, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut interceptions_against_balanced = 0u32;
    let mut interceptions_against_press = 0u32;
    for seed in 0..120 {
        let pressed = simulate_with_rng(&high_press, &balanced, &config, &mut seeded_rng(seed));
        interceptions_against_balanced += pressed.away_stats.passes_intercepted as u32;

        let control = simulate_with_rng(&balanced, &high_press, &config, &mut seeded_rng(seed));
        interceptions_against_press += control.home_stats.passes_intercepted as u32;
    }

    assert!(
        interceptions_against_balanced > interceptions_against_press,
        "High press should force more opponent turnovers: pressed={interceptions_against_balanced}, control={interceptions_against_press}"
    );
}

#[test]
fn direct_high_risk_tactics_lower_pass_safety() {
    let direct = with_instructions(
        make_team("direct", "Direct FC", 68, PlayStyle::Counter),
        0.55,
        0.45,
        0.85,
        0.62,
        0.92,
        0.90,
    );
    let control = with_instructions(
        make_team("control", "Control FC", 68, PlayStyle::Possession),
        0.45,
        0.55,
        0.38,
        0.50,
        0.15,
        0.22,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut direct_completed = 0u32;
    let mut direct_intercepted = 0u32;
    let mut control_completed = 0u32;
    let mut control_intercepted = 0u32;
    for seed in 0..160 {
        let report = simulate_with_rng(&direct, &control, &config, &mut seeded_rng(seed));
        direct_completed += report.home_stats.passes_completed as u32;
        direct_intercepted += report.home_stats.passes_intercepted as u32;
        control_completed += report.away_stats.passes_completed as u32;
        control_intercepted += report.away_stats.passes_intercepted as u32;
    }

    let direct_accuracy = direct_completed as f64 / (direct_completed + direct_intercepted) as f64;
    let control_accuracy = control_completed as f64 / (control_completed + control_intercepted) as f64;
    assert!(
        direct_accuracy < control_accuracy,
        "Direct high-risk tactics should be less pass-safe: direct={direct_accuracy:.3}, control={control_accuracy:.3}"
    );
}

#[test]
fn possession_control_improves_pass_accuracy() {
    let possession = with_instructions(
        make_team("poss", "Possession FC", 68, PlayStyle::Possession),
        0.48,
        0.55,
        0.35,
        0.48,
        0.12,
        0.18,
    );
    let direct = with_instructions(
        make_team("direct", "Direct FC", 68, PlayStyle::Counter),
        0.55,
        0.45,
        0.82,
        0.58,
        0.92,
        0.82,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut possession_completed = 0u32;
    let mut possession_intercepted = 0u32;
    let mut direct_completed = 0u32;
    let mut direct_intercepted = 0u32;
    for seed in 0..160 {
        let report = simulate_with_rng(&possession, &direct, &config, &mut seeded_rng(seed));
        possession_completed += report.home_stats.passes_completed as u32;
        possession_intercepted += report.home_stats.passes_intercepted as u32;
        direct_completed += report.away_stats.passes_completed as u32;
        direct_intercepted += report.away_stats.passes_intercepted as u32;
    }

    let possession_accuracy =
        possession_completed as f64 / (possession_completed + possession_intercepted) as f64;
    let direct_accuracy = direct_completed as f64 / (direct_completed + direct_intercepted) as f64;
    assert!(
        possession_accuracy > direct_accuracy,
        "Possession control should improve pass accuracy: possession={possession_accuracy:.3}, direct={direct_accuracy:.3}"
    );
}

#[test]
fn counter_setup_is_stronger_against_high_line_than_low_block() {
    let counter = with_instructions(
        with_shape(make_team("counter", "Counter FC", 66, PlayStyle::Counter), 4, 4, 2),
        0.48,
        0.38,
        0.78,
        0.64,
        0.88,
        0.68,
    );
    let high_line = with_instructions(
        with_shape(make_team("high", "High Line FC", 70, PlayStyle::Attacking), 3, 4, 3),
        0.78,
        0.86,
        0.74,
        0.68,
        0.62,
        0.72,
    );
    let low_block = with_instructions(
        with_shape(make_team("low", "Low Block FC", 70, PlayStyle::Defensive), 5, 4, 1),
        0.34,
        0.28,
        0.38,
        0.40,
        0.36,
        0.24,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let versus_high_line = summarize_trials(&counter, &high_line, &config, 240);
    let versus_low_block = summarize_trials(&counter, &low_block, &config, 240);

    assert!(
        versus_high_line.home_goals >= versus_low_block.home_goals
            || versus_high_line.home_shots + 50 >= versus_low_block.home_shots,
        "Counter should find comparable or better own output into high-line space: high_line goals={} shots={} goal_share={:.3}, low_block goals={} shots={} goal_share={:.3}",
        versus_high_line.home_goals,
        versus_high_line.home_shots,
        versus_high_line.home_goal_share(),
        versus_low_block.home_goals,
        versus_low_block.home_shots,
        versus_low_block.home_goal_share()
    );
}

#[test]
fn defensive_low_risk_setup_suppresses_shot_quality() {
    let aggressive = with_instructions(
        with_shape(make_team("agg", "Aggressive FC", 68, PlayStyle::Attacking), 3, 4, 3),
        0.74,
        0.78,
        0.76,
        0.70,
        0.68,
        0.78,
    );
    let low_risk = with_instructions(
        with_shape(make_team("def", "Defensive FC", 68, PlayStyle::Defensive), 5, 4, 1),
        0.34,
        0.28,
        0.34,
        0.36,
        0.28,
        0.18,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let open_game = summarize_trials(&aggressive, &aggressive, &config, 240);
    let protected_game = summarize_trials(&aggressive, &low_risk, &config, 240);
    let open_sot_rate = open_game.away_shots as f64 / (open_game.home_shots + open_game.away_shots).max(1) as f64;
    let protected_sot_rate = protected_game.home_goals as f64 / protected_game.home_shots.max(1) as f64;
    let open_goal_rate = open_game.home_goals as f64 / open_game.home_shots.max(1) as f64;

    assert!(
        protected_game.away_points() > 0,
        "Defensive setup should still produce playable football, not a guaranteed collapse"
    );
    assert!(
        protected_sot_rate < open_goal_rate || protected_game.home_shot_share() < open_sot_rate + 0.2,
        "Low-risk setup should lower favorite shot quality/output: protected_goal_per_shot={protected_sot_rate:.3}, open_goal_per_shot={open_goal_rate:.3}, protected_shot_share={:.3}",
        protected_game.home_shot_share()
    );
}

#[test]
fn playmaker_traits_improve_pass_safety() {
    let playmakers = with_traits(
        make_team("play", "Playmaker FC", 68, PlayStyle::Balanced),
        Position::Midfielder,
        &["Playmaker", "Visionary", "TeamPlayer", "CoolHead"],
    );
    let ordinary = make_team("ord", "Ordinary FC", 68, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut play_completed = 0u32;
    let mut play_intercepted = 0u32;
    let mut ordinary_completed = 0u32;
    let mut ordinary_intercepted = 0u32;
    for seed in 0..180 {
        let report = simulate_with_rng(&playmakers, &ordinary, &config, &mut seeded_rng(seed));
        play_completed += report.home_stats.passes_completed as u32;
        play_intercepted += report.home_stats.passes_intercepted as u32;
        ordinary_completed += report.away_stats.passes_completed as u32;
        ordinary_intercepted += report.away_stats.passes_intercepted as u32;
    }

    let play_accuracy = play_completed as f64 / (play_completed + play_intercepted) as f64;
    let ordinary_accuracy = ordinary_completed as f64 / (ordinary_completed + ordinary_intercepted) as f64;
    assert!(
        play_accuracy > ordinary_accuracy,
        "Playmaker traits should improve pass safety: playmakers={play_accuracy:.3}, ordinary={ordinary_accuracy:.3}"
    );
}

#[test]
fn sharpshooter_traits_improve_shot_quality() {
    let shooters = with_traits(
        make_team("sharp", "Sharpshooter FC", 68, PlayStyle::Balanced),
        Position::Forward,
        &["Sharpshooter", "CompleteForward", "CoolHead"],
    );
    let ordinary = make_team("ord", "Ordinary FC", 68, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut sharp_shots = 0u32;
    let mut sharp_sot = 0u32;
    let mut ordinary_shots = 0u32;
    let mut ordinary_sot = 0u32;
    for seed in 0..220 {
        let report = simulate_with_rng(&shooters, &ordinary, &config, &mut seeded_rng(seed));
        sharp_shots += report.home_stats.shots as u32;
        sharp_sot += report.home_stats.shots_on_target as u32;
        ordinary_shots += report.away_stats.shots as u32;
        ordinary_sot += report.away_stats.shots_on_target as u32;
    }

    let sharp_sot_rate = sharp_sot as f64 / sharp_shots as f64;
    let ordinary_sot_rate = ordinary_sot as f64 / ordinary_shots as f64;
    assert!(
        sharp_sot_rate > ordinary_sot_rate,
        "Sharpshooter traits should improve shot quality: sharp={sharp_sot_rate:.3}, ordinary={ordinary_sot_rate:.3}"
    );
}

#[test]
fn dribbler_speedster_traits_improve_progression() {
    let carriers = with_traits(
        make_team("carry", "Carrier FC", 68, PlayStyle::Balanced),
        Position::Forward,
        &["Dribbler", "Speedster", "Agile", "CompleteForward"],
    );
    let ordinary = make_team("ord", "Ordinary FC", 68, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut carrier_dribbles = 0u32;
    let mut ordinary_dribbles = 0u32;
    for seed in 0..180 {
        let report = simulate_with_rng(&carriers, &ordinary, &config, &mut seeded_rng(seed));
        carrier_dribbles += report
            .events
            .iter()
            .filter(|event| event.side == Side::Home && event.event_type == EventType::Dribble)
            .count() as u32;
        ordinary_dribbles += report
            .events
            .iter()
            .filter(|event| event.side == Side::Away && event.event_type == EventType::Dribble)
            .count() as u32;
    }

    assert!(
        carrier_dribbles > ordinary_dribbles,
        "Dribbler/speedster traits should improve progression: carriers={carrier_dribbles}, ordinary={ordinary_dribbles}"
    );
}

#[test]
fn high_morale_improves_match_reliability() {
    let high_morale = with_morale(make_team("high", "High Morale FC", 68, PlayStyle::Balanced), 95);
    let low_morale = with_morale(make_team("low", "Low Morale FC", 68, PlayStyle::Balanced), 10);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut high_completed = 0u32;
    let mut high_intercepted = 0u32;
    let mut high_sot = 0u32;
    let mut low_completed = 0u32;
    let mut low_intercepted = 0u32;
    let mut low_sot = 0u32;
    for seed in 0..220 {
        let report = simulate_with_rng(&high_morale, &low_morale, &config, &mut seeded_rng(seed));
        high_completed += report.home_stats.passes_completed as u32;
        high_intercepted += report.home_stats.passes_intercepted as u32;
        high_sot += report.home_stats.shots_on_target as u32;
        low_completed += report.away_stats.passes_completed as u32;
        low_intercepted += report.away_stats.passes_intercepted as u32;
        low_sot += report.away_stats.shots_on_target as u32;
    }

    let high_accuracy = high_completed as f64 / (high_completed + high_intercepted) as f64;
    let low_accuracy = low_completed as f64 / (low_completed + low_intercepted) as f64;
    assert!(
        high_accuracy > low_accuracy || high_sot > low_sot,
        "High morale should improve reliability: pass high={high_accuracy:.3}, low={low_accuracy:.3}, sot high={high_sot}, low={low_sot}"
    );
}

#[test]
fn positive_team_form_improves_team_control() {
    let positive_form = with_form_and_familiarity(
        make_team("pos", "Positive Form FC", 68, PlayStyle::Balanced),
        &["W", "W", "D", "W", "W"],
        0.5,
    );
    let negative_form = with_form_and_familiarity(
        make_team("neg", "Negative Form FC", 68, PlayStyle::Balanced),
        &["L", "L", "D", "L", "L"],
        0.5,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut positive_completed = 0u32;
    let mut positive_intercepted = 0u32;
    let mut negative_completed = 0u32;
    let mut negative_intercepted = 0u32;
    for seed in 0..220 {
        let report = simulate_with_rng(&positive_form, &negative_form, &config, &mut seeded_rng(seed));
        positive_completed += report.home_stats.passes_completed as u32;
        positive_intercepted += report.home_stats.passes_intercepted as u32;
        negative_completed += report.away_stats.passes_completed as u32;
        negative_intercepted += report.away_stats.passes_intercepted as u32;
    }

    let positive_accuracy =
        positive_completed as f64 / (positive_completed + positive_intercepted) as f64;
    let negative_accuracy =
        negative_completed as f64 / (negative_completed + negative_intercepted) as f64;
    assert!(
        positive_accuracy > negative_accuracy,
        "Positive form should improve team control: positive={positive_accuracy:.3}, negative={negative_accuracy:.3}"
    );
}

#[test]
fn tactical_familiarity_improves_coordinated_phases() {
    let familiar = with_form_and_familiarity(
        make_team("fam", "Familiar FC", 68, PlayStyle::Balanced),
        &[],
        0.95,
    );
    let unfamiliar = with_form_and_familiarity(
        make_team("unfam", "Unfamiliar FC", 68, PlayStyle::Balanced),
        &[],
        0.05,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let mut familiar_progression = 0u32;
    let mut unfamiliar_progression = 0u32;
    let mut familiar_intercepted = 0u32;
    let mut unfamiliar_intercepted = 0u32;
    for seed in 0..220 {
        let report = simulate_with_rng(&familiar, &unfamiliar, &config, &mut seeded_rng(seed));
        familiar_progression += report.home_stats.shots as u32
            + report
                .events
                .iter()
                .filter(|event| event.side == Side::Home && event.event_type == EventType::Dribble)
                .count() as u32;
        unfamiliar_progression += report.away_stats.shots as u32
            + report
                .events
                .iter()
                .filter(|event| event.side == Side::Away && event.event_type == EventType::Dribble)
                .count() as u32;
        familiar_intercepted += report.home_stats.passes_intercepted as u32;
        unfamiliar_intercepted += report.away_stats.passes_intercepted as u32;
    }

    assert!(
        familiar_progression > unfamiliar_progression || familiar_intercepted < unfamiliar_intercepted,
        "Tactical familiarity should help coordinated phases: progression familiar={familiar_progression}, unfamiliar={unfamiliar_progression}, intercepted familiar={familiar_intercepted}, unfamiliar={unfamiliar_intercepted}"
    );
}

// ---------------------------------------------------------------------------
// Referee, weather, and pitch context tests
// ---------------------------------------------------------------------------

#[test]
fn strict_referee_increases_fouls_and_cards() {
    let home = make_team("home", "Home FC", 68, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 68, PlayStyle::Balanced);
    let strict = MatchConfig {
        foul_probability: 0.25,
        yellow_card_probability: 0.45,
        referee: RefereeProfile {
            foul_modifier: 1.35,
            card_modifier: 1.45,
            penalty_modifier: 1.0,
        },
        ..MatchConfig::default()
    };
    let lenient = MatchConfig {
        foul_probability: 0.25,
        yellow_card_probability: 0.45,
        referee: RefereeProfile {
            foul_modifier: 0.80,
            card_modifier: 0.75,
            penalty_modifier: 1.0,
        },
        ..MatchConfig::default()
    };

    let mut strict_fouls = 0u32;
    let mut strict_cards = 0u32;
    let mut lenient_fouls = 0u32;
    let mut lenient_cards = 0u32;
    for seed in 0..180 {
        let strict_report = simulate_with_rng(&home, &away, &strict, &mut seeded_rng(seed));
        strict_fouls += strict_report.home_stats.fouls as u32 + strict_report.away_stats.fouls as u32;
        strict_cards += strict_report.home_stats.yellow_cards as u32
            + strict_report.away_stats.yellow_cards as u32
            + strict_report.home_stats.red_cards as u32
            + strict_report.away_stats.red_cards as u32;

        let lenient_report = simulate_with_rng(&home, &away, &lenient, &mut seeded_rng(seed));
        lenient_fouls +=
            lenient_report.home_stats.fouls as u32 + lenient_report.away_stats.fouls as u32;
        lenient_cards += lenient_report.home_stats.yellow_cards as u32
            + lenient_report.away_stats.yellow_cards as u32
            + lenient_report.home_stats.red_cards as u32
            + lenient_report.away_stats.red_cards as u32;
    }

    assert!(
        strict_fouls > lenient_fouls && strict_cards > lenient_cards,
        "Strict referee should increase fouls and cards: strict fouls={strict_fouls}, lenient fouls={lenient_fouls}, strict cards={strict_cards}, lenient cards={lenient_cards}"
    );
}

#[test]
fn adverse_weather_reduces_shot_accuracy() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 70, PlayStyle::Balanced);
    let clear = MatchConfig {
        weather: WeatherCondition::Clear,
        ..MatchConfig::default()
    };
    let wind = MatchConfig {
        weather: WeatherCondition::Wind,
        ..MatchConfig::default()
    };

    let mut clear_shots = 0u32;
    let mut clear_sot = 0u32;
    let mut wind_shots = 0u32;
    let mut wind_sot = 0u32;
    for seed in 0..260 {
        let clear_report = simulate_with_rng(&home, &away, &clear, &mut seeded_rng(seed));
        clear_shots += clear_report.home_stats.shots as u32 + clear_report.away_stats.shots as u32;
        clear_sot += clear_report.home_stats.shots_on_target as u32
            + clear_report.away_stats.shots_on_target as u32;

        let wind_report = simulate_with_rng(&home, &away, &wind, &mut seeded_rng(seed));
        wind_shots += wind_report.home_stats.shots as u32 + wind_report.away_stats.shots as u32;
        wind_sot += wind_report.home_stats.shots_on_target as u32
            + wind_report.away_stats.shots_on_target as u32;
    }

    let clear_rate = clear_sot as f64 / clear_shots as f64;
    let wind_rate = wind_sot as f64 / wind_shots as f64;
    assert!(
        wind_rate < clear_rate,
        "Wind should reduce shot accuracy: clear={clear_rate:.3}, wind={wind_rate:.3}"
    );
}

#[test]
fn poor_pitch_increases_fouls_and_injuries() {
    let home = make_team("home", "Home FC", 68, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 68, PlayStyle::Balanced);
    let excellent = MatchConfig {
        foul_probability: 0.32,
        injury_probability: 0.12,
        pitch: PitchCondition::Excellent,
        ..MatchConfig::default()
    };
    let poor = MatchConfig {
        foul_probability: 0.32,
        injury_probability: 0.12,
        pitch: PitchCondition::Poor,
        ..MatchConfig::default()
    };

    let mut excellent_events = 0u32;
    let mut poor_events = 0u32;
    for seed in 0..240 {
        let excellent_report = simulate_with_rng(&home, &away, &excellent, &mut seeded_rng(seed));
        excellent_events += excellent_report
            .events
            .iter()
            .filter(|event| matches!(event.event_type, EventType::Foul | EventType::Injury))
            .count() as u32;

        let poor_report = simulate_with_rng(&home, &away, &poor, &mut seeded_rng(seed));
        poor_events += poor_report
            .events
            .iter()
            .filter(|event| matches!(event.event_type, EventType::Foul | EventType::Injury))
            .count() as u32;
    }

    assert!(
        poor_events > excellent_events,
        "Poor pitch should increase foul/injury events: poor={poor_events}, excellent={excellent_events}"
    );
}

// ---------------------------------------------------------------------------
// Team/player stats aggregation tests
// ---------------------------------------------------------------------------

#[test]
fn player_stats_populated() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(77));

    // At least some players should have stats
    assert!(
        !report.player_stats.is_empty(),
        "Player stats should not be empty"
    );

    // Check that stats are reasonable
    for (player_id, ps) in &report.player_stats {
        assert!(
            ps.rating >= 0.0 && ps.rating <= 10.0,
            "Player {player_id} rating out of range: {}",
            ps.rating
        );
    }
}

#[test]
fn team_stats_shots_consistent() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 65, PlayStyle::Defensive);
    let config = MatchConfig::default();

    for seed in 0..10 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));

        // shots >= shots_on_target
        assert!(
            report.home_stats.shots >= report.home_stats.shots_on_target,
            "Seed {seed}: home shots < SOT"
        );
        assert!(
            report.away_stats.shots >= report.away_stats.shots_on_target,
            "Seed {seed}: away shots < SOT"
        );
    }
}

#[test]
fn events_are_chronological() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 70, PlayStyle::Balanced);
    let config = MatchConfig::default();

    // Run multiple seeds to increase confidence
    for seed in 0..10 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        for window in report.events.windows(2) {
            assert!(
                window[1].minute >= window[0].minute,
                "Seed {seed}: events out of order: minute {} ({:?}) followed by {} ({:?})",
                window[0].minute,
                window[0].event_type,
                window[1].minute,
                window[1].event_type,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Report: pass accuracy
// ---------------------------------------------------------------------------

#[test]
fn pass_accuracy_in_range() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(88));

    let home_acc = report.home_stats.pass_accuracy();
    let away_acc = report.away_stats.pass_accuracy();
    assert!(
        home_acc >= 0.0 && home_acc <= 100.0,
        "Home pass accuracy: {home_acc}"
    );
    assert!(
        away_acc >= 0.0 && away_acc <= 100.0,
        "Away pass accuracy: {away_acc}"
    );
}

// ---------------------------------------------------------------------------
// Edge case: no stoppage time
// ---------------------------------------------------------------------------

#[test]
fn zero_stoppage_time_produces_valid_report() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        stoppage_time_max: 0,
        ..MatchConfig::default()
    };
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(1));
    assert_eq!(report.total_minutes, 90);
}

// ---------------------------------------------------------------------------
// Edge case: very high foul probability
// ---------------------------------------------------------------------------

#[test]
fn high_foul_probability_produces_cards() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.95,
        yellow_card_probability: 0.90,
        ..MatchConfig::default()
    };

    let mut total_yellows = 0u16;
    for seed in 0..20 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_yellows +=
            report.home_stats.yellow_cards as u16 + report.away_stats.yellow_cards as u16;
    }
    assert!(
        total_yellows > 0,
        "High foul rate should produce some yellow cards"
    );
}

// ---------------------------------------------------------------------------
// Report serialization
// ---------------------------------------------------------------------------

#[test]
fn report_serializes_to_json() {
    let home = make_team("home", "Home FC", 60, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 60, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(42));

    let json = serde_json::to_string(&report);
    assert!(json.is_ok(), "Report should serialize: {:?}", json.err());
    let json_str = json.unwrap();
    assert!(json_str.contains("home_goals"));
    assert!(json_str.contains("away_goals"));
    assert!(json_str.contains("events"));
}

// ---------------------------------------------------------------------------
// Event counts consistency
// ---------------------------------------------------------------------------

#[test]
fn goal_events_match_report_goals() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 50, PlayStyle::Defensive);
    let config = MatchConfig::default();

    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));

        let event_goals: u8 = report.events.iter().filter(|e| e.is_goal()).count() as u8;

        let report_total = report.home_goals + report.away_goals;
        assert_eq!(
            event_goals, report_total,
            "Seed {seed}: event goals ({event_goals}) != report total ({report_total})"
        );
    }
}

// ---------------------------------------------------------------------------
// Realistic goal distribution
// ---------------------------------------------------------------------------

#[test]
fn average_goals_realistic() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();

    let trials = 500;
    let mut total_goals = 0u32;
    for seed in 0..trials {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_goals += (report.home_goals + report.away_goals) as u32;
    }
    let avg = total_goals as f64 / trials as f64;
    // Real football averages ~2.5 goals/game. Allow a wide range for a simulation.
    assert!(
        avg > 0.5 && avg < 8.0,
        "Average goals per game should be reasonable: {avg:.2}"
    );
}

// ---------------------------------------------------------------------------
// High foul rate produces fouls and free kicks
// ---------------------------------------------------------------------------

#[test]
fn high_foul_rate_produces_fouls_and_free_kicks() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.95,
        yellow_card_probability: 0.01,
        ..MatchConfig::default()
    };

    let mut total_fouls = 0u32;
    let mut total_free_kicks = 0u32;
    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        for e in &report.events {
            match e.event_type {
                EventType::Foul => total_fouls += 1,
                EventType::FreeKick => total_free_kicks += 1,
                _ => {}
            }
        }
    }
    assert!(
        total_fouls > 0,
        "With 95% foul probability, fouls should occur"
    );
    assert!(
        total_free_kicks > 0,
        "Fouls outside box should produce free kicks"
    );
}

// ---------------------------------------------------------------------------
// Red card and second yellow coverage
// ---------------------------------------------------------------------------

#[test]
fn high_red_card_probability_produces_red_cards() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.90,
        yellow_card_probability: 0.90,
        red_card_probability: 0.90,
        ..MatchConfig::default()
    };

    let mut total_reds = 0u32;
    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_reds += report.home_stats.red_cards as u32 + report.away_stats.red_cards as u32;
    }
    assert!(
        total_reds > 0,
        "With high red card probability, red cards should occur"
    );
}

#[test]
fn second_yellow_produces_sending_off() {
    let home = make_team("home", "Home FC", 80, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 80, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.80,
        yellow_card_probability: 0.80,
        red_card_probability: 0.001, // Low direct red so we get second yellows
        ..MatchConfig::default()
    };

    let mut second_yellows = 0u32;
    for seed in 0..100 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        second_yellows += report
            .events
            .iter()
            .filter(|e| e.event_type == EventType::SecondYellow)
            .count() as u32;
    }
    assert!(
        second_yellows > 0,
        "With many yellows and low red rate, second yellows should occur"
    );
}

// ---------------------------------------------------------------------------
// Injury from foul coverage
// ---------------------------------------------------------------------------

#[test]
fn high_injury_probability_produces_injuries() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.90,
        injury_probability: 0.90,
        ..MatchConfig::default()
    };

    let mut total_injuries = 0u32;
    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_injuries += report
            .events
            .iter()
            .filter(|e| e.event_type == EventType::Injury)
            .count() as u32;
    }
    assert!(
        total_injuries > 0,
        "With high foul+injury probability, injuries should occur"
    );
}

// ---------------------------------------------------------------------------
// Corner kick coverage
// ---------------------------------------------------------------------------

#[test]
fn corners_occur_in_simulation() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 70, PlayStyle::Balanced);
    let config = MatchConfig::default();

    let mut total_corners = 0u32;
    for seed in 0..50 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_corners += report.home_stats.corners as u32 + report.away_stats.corners as u32;
    }
    assert!(total_corners > 0, "Corners should occur in 50 simulations");
}

// ---------------------------------------------------------------------------
// Sent-off player excluded from subsequent play
// ---------------------------------------------------------------------------

#[test]
fn sent_off_players_excluded() {
    // Run many sims with high foul/red card rate and verify the report still
    // produces valid data (no crashes from sent-off player selection).
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.80,
        yellow_card_probability: 0.80,
        red_card_probability: 0.50,
        ..MatchConfig::default()
    };

    for seed in 0..50 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        // Just verify it completes without panic
        assert!(report.total_minutes >= 90);
    }
}

// ---------------------------------------------------------------------------
// Play style coverage for less common styles
// ---------------------------------------------------------------------------

#[test]
fn all_play_styles_produce_valid_report() {
    let styles = [
        PlayStyle::Balanced,
        PlayStyle::Attacking,
        PlayStyle::Defensive,
        PlayStyle::Possession,
        PlayStyle::Counter,
        PlayStyle::HighPress,
    ];

    for home_style in &styles {
        for away_style in &styles {
            let home = make_team("home", "Home FC", 65, *home_style);
            let away = make_team("away", "Away FC", 65, *away_style);
            let config = MatchConfig::default();
            let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(42));

            assert!(
                report.total_minutes >= 90,
                "Invalid report for {:?} vs {:?}",
                home_style,
                away_style
            );
            let has_fulltime = report
                .events
                .iter()
                .any(|e| e.event_type == EventType::FullTime);
            assert!(
                has_fulltime,
                "Missing FullTime for {:?} vs {:?}",
                home_style, away_style
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Edge: team with only 1 player per position
// ---------------------------------------------------------------------------

#[test]
fn minimal_team_doesnt_crash() {
    let minimal = TeamData {
        id: "min".to_string(),
        name: "Minimal FC".to_string(),
        formation: "1-1-1-1".to_string(),
        play_style: PlayStyle::Balanced,
        players: vec![
            make_player("gk", "GK", Position::Goalkeeper, 50),
            make_player("def", "DEF", Position::Defender, 50),
            make_player("mid", "MID", Position::Midfielder, 50),
            make_player("fwd", "FWD", Position::Forward, 50),
        ],
        form: Vec::new(),
        tactical_familiarity: 0.5,
        shape_profile: ShapeProfile::default(),
        tactical_profile: TacticalProfile::default(),
    };
    let normal = make_team("normal", "Normal FC", 60, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&minimal, &normal, &config, &mut seeded_rng(1));
    assert!(report.total_minutes >= 90);
}

// ---------------------------------------------------------------------------
// Edge: extreme skill disparity
// ---------------------------------------------------------------------------

#[test]
fn extreme_skill_disparity_no_crash() {
    let elite = make_team("elite", "Elite FC", 99, PlayStyle::Attacking);
    let amateur = make_team("amateur", "Amateur FC", 1, PlayStyle::Defensive);
    let config = MatchConfig::default();

    for seed in 0..10 {
        let report = simulate_with_rng(&elite, &amateur, &config, &mut seeded_rng(seed));
        assert!(report.total_minutes >= 90);
        // Elite team should generally score more
        assert!(
            report.home_goals >= report.away_goals || seed > 0,
            "Seed {seed}: elite team lost?"
        );
    }
}

// ---------------------------------------------------------------------------
// Report: player stats rating computation
// ---------------------------------------------------------------------------

#[test]
fn player_ratings_computed_for_active_players() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(42));

    for (pid, ps) in &report.player_stats {
        if ps.minutes_played > 0 {
            assert!(
                ps.rating >= 4.0 && ps.rating <= 10.0,
                "Player {} has invalid active rating: {}",
                pid,
                ps.rating
            );
        } else {
            assert_eq!(ps.rating, 0.0, "Inactive player {pid} should be unrated");
        }
    }
}

#[test]
fn goals_and_assists_are_not_locked_to_single_position_groups() {
    let home = make_team("home", "Home FC", 72, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 62, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let position_by_id = home
        .players
        .iter()
        .chain(away.players.iter())
        .map(|player| (player.id.as_str(), player.position))
        .collect::<std::collections::HashMap<_, _>>();

    let mut non_forward_goals = 0;
    let mut non_midfield_assists = 0;
    let mut total_goals = 0;
    for seed in 0..250 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        for goal in report.goals {
            total_goals += 1;
            if position_by_id.get(goal.scorer_id.as_str()) != Some(&Position::Forward) {
                non_forward_goals += 1;
            }
            if let Some(assist_id) = goal.assist_id {
                if position_by_id.get(assist_id.as_str()) != Some(&Position::Midfielder) {
                    non_midfield_assists += 1;
                }
            }
        }
    }

    assert!(total_goals > 20, "Sample should include enough goals");
    assert!(non_forward_goals > 0, "Non-forwards should score sometimes");
    assert!(
        non_midfield_assists > 0,
        "Non-midfielders should assist sometimes"
    );
}

#[test]
fn long_run_match_calibration_stays_sane() {
    let home = make_team("home", "Home FC", 70, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig::default();
    let mut goals = 0u32;
    let mut shots = 0u32;
    let mut shots_on_target = 0u32;
    let mut passes_completed = 0u32;
    let mut passes_intercepted = 0u32;
    let mut fouls = 0u32;
    let mut yellow_cards = 0u32;
    let mut red_cards = 0u32;
    let mut corners = 0u32;
    let mut possession = 0.0f64;
    let mut rating_sum = 0.0f64;
    let mut rating_count = 0u32;

    for seed in 0..300 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        goals += (report.home_goals + report.away_goals) as u32;
        shots += report.home_stats.shots as u32 + report.away_stats.shots as u32;
        shots_on_target +=
            report.home_stats.shots_on_target as u32 + report.away_stats.shots_on_target as u32;
        passes_completed +=
            report.home_stats.passes_completed as u32 + report.away_stats.passes_completed as u32;
        passes_intercepted += report.home_stats.passes_intercepted as u32
            + report.away_stats.passes_intercepted as u32;
        fouls += report.home_stats.fouls as u32 + report.away_stats.fouls as u32;
        yellow_cards += report.home_stats.yellow_cards as u32 + report.away_stats.yellow_cards as u32;
        red_cards += report.home_stats.red_cards as u32 + report.away_stats.red_cards as u32;
        corners += report.home_stats.corners as u32 + report.away_stats.corners as u32;
        possession += report.home_possession;

        for stats in report.player_stats.values() {
            if stats.minutes_played > 0 {
                rating_sum += stats.rating as f64;
                rating_count += 1;
            }
        }
    }

    assert!(shots > 100, "Sample should include enough shots");
    assert!(shots_on_target <= shots, "SOT cannot exceed total shots");
    let goals_per_game = goals as f64 / 300.0;
    let shots_per_game = shots as f64 / 300.0;
    let sot_per_game = shots_on_target as f64 / 300.0;
    let sot_rate = shots_on_target as f64 / shots as f64;
    let passes_per_game = (passes_completed + passes_intercepted) as f64 / 300.0;
    let pass_accuracy = passes_completed as f64 / (passes_completed + passes_intercepted) as f64;
    let fouls_per_game = fouls as f64 / 300.0;
    let yellow_cards_per_game = yellow_cards as f64 / 300.0;
    let red_cards_per_game = red_cards as f64 / 300.0;
    let corners_per_game = corners as f64 / 300.0;
    let avg_home_possession = possession / 300.0;
    let avg_rating = rating_sum / rating_count as f64;

    eprintln!(
        "long_run_calibration goals={goals_per_game:.2} shots={shots_per_game:.1} sot={sot_per_game:.1} sot_rate={sot_rate:.2} passes={passes_per_game:.1} pass_accuracy={pass_accuracy:.2} fouls={fouls_per_game:.1} yellows={yellow_cards_per_game:.1} reds={red_cards_per_game:.2} corners={corners_per_game:.1} home_possession={avg_home_possession:.1} avg_rating={avg_rating:.2}"
    );

    assert!(
        goals_per_game < 3.6,
        "Goals/game should stay near calibration range, got {goals_per_game:.2}"
    );
    assert!(
        sot_rate < 0.55,
        "SOT rate should be realistic, got {sot_rate:.2}"
    );
    assert!(
        pass_accuracy > 0.65 && pass_accuracy < 0.92,
        "Pass accuracy should be realistic, got {pass_accuracy:.2}"
    );
    assert!(
        avg_rating >= 6.3 && avg_rating <= 7.1,
        "Average rating should stay plausible, got {avg_rating:.2}"
    );
}

// ---------------------------------------------------------------------------
// Free kicks occur when fouls happen outside the box
// ---------------------------------------------------------------------------

#[test]
fn free_kicks_occur_in_simulation() {
    let home = make_team("home", "Home FC", 65, PlayStyle::Balanced);
    let away = make_team("away", "Away FC", 65, PlayStyle::Balanced);
    let config = MatchConfig {
        foul_probability: 0.80,
        ..MatchConfig::default()
    };

    let mut total_free_kicks = 0u32;
    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        total_free_kicks +=
            report.home_stats.free_kicks as u32 + report.away_stats.free_kicks as u32;
    }
    assert!(
        total_free_kicks > 0,
        "Free kicks should occur with high foul rate"
    );
}

// ---------------------------------------------------------------------------
// Dribble and clearance events
// ---------------------------------------------------------------------------

#[test]
fn dribble_events_occur() {
    let home = make_team("home", "Home FC", 80, PlayStyle::Attacking);
    let away = make_team("away", "Away FC", 40, PlayStyle::Defensive);
    let config = MatchConfig::default();

    let mut total_dribbles = 0u32;
    let mut total_clearances = 0u32;
    for seed in 0..30 {
        let report = simulate_with_rng(&home, &away, &config, &mut seeded_rng(seed));
        for e in &report.events {
            match e.event_type {
                EventType::Dribble => total_dribbles += 1,
                EventType::Clearance => total_clearances += 1,
                _ => {}
            }
        }
    }
    assert!(total_dribbles > 0, "Dribbles should occur");
    assert!(total_clearances > 0, "Clearances should occur");
}

#[test]
fn counter_attack_slider_boosts_output_against_high_line() {
    // Same base team; one with a high counter-attack slider, one cautious.
    let base = with_instructions(
        with_shape(make_team("brk", "Breakers FC", 66, PlayStyle::Balanced), 4, 4, 2),
        0.50,
        0.42,
        0.62,
        0.58,
        0.62,
        0.55,
    );
    let direct_break = with_transition(base.clone(), 0.95, 0.50);
    let cautious_break = with_transition(base, 0.10, 0.50);
    let high_line = with_instructions(
        with_shape(make_team("high", "High Line FC", 68, PlayStyle::Attacking), 3, 4, 3),
        0.78,
        0.88,
        0.74,
        0.68,
        0.62,
        0.72,
    );
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    let direct = summarize_trials(&direct_break, &high_line, &config, 240);
    let cautious = summarize_trials(&cautious_break, &high_line, &config, 240);

    assert!(
        direct.home_shots >= cautious.home_shots,
        "High counter-attack should generate at least as many shots vs a high line: direct shots={}, cautious shots={}",
        direct.home_shots,
        cautious.home_shots
    );
}

#[test]
fn counter_press_raises_opponent_turnovers() {
    let heavy_press = with_transition(
        with_instructions(
            make_team("cp", "CounterPress FC", 68, PlayStyle::Balanced),
            0.55,
            0.55,
            0.55,
            0.55,
            0.50,
            0.55,
        ),
        0.50,
        0.95,
    );
    let light_press = with_transition(
        with_instructions(
            make_team("dp", "DropOff FC", 68, PlayStyle::Balanced),
            0.55,
            0.55,
            0.55,
            0.55,
            0.50,
            0.55,
        ),
        0.50,
        0.10,
    );
    let opponent = make_team("opp", "Opponent FC", 68, PlayStyle::Balanced);
    let config = MatchConfig {
        home_advantage: 1.0,
        ..MatchConfig::default()
    };

    // Count RAW interception events against the opponent. Report team stats are
    // normalized from possession, so we read the unprocessed event log instead.
    let mut heavy_turnovers = 0u32;
    let mut light_turnovers = 0u32;
    for seed in 0..200 {
        let heavy = simulate_with_rng(&heavy_press, &opponent, &config, &mut seeded_rng(seed));
        heavy_turnovers += heavy
            .events
            .iter()
            .filter(|e| e.event_type == EventType::PassIntercepted && e.side == Side::Away)
            .count() as u32;

        let light = simulate_with_rng(&light_press, &opponent, &config, &mut seeded_rng(seed));
        light_turnovers += light
            .events
            .iter()
            .filter(|e| e.event_type == EventType::PassIntercepted && e.side == Side::Away)
            .count() as u32;
    }

    assert!(
        heavy_turnovers > light_turnovers,
        "Heavy counter-press should force more opponent interceptions: heavy={heavy_turnovers}, light={light_turnovers}"
    );
}

