use rand::{Rng, RngExt};

use crate::shared::{
    PlayStylePhase, PlayerSnap, compress_skill, home_mod, match_state_adapted_team,
    play_style_modifier, tactical_fatigue_modifier, tactical_press_modifier, weather_fatigue_modifier,
};
use crate::types::{PlayerData, Position, Side, TeamData};

use super::{LiveMatchState, SetPieceTakers};

// ---------------------------------------------------------------------------
// Stamina system
// ---------------------------------------------------------------------------

impl LiveMatchState {
    pub(super) fn deplete_stamina_tick(&mut self) {
        let fatigue_rate = self.config.fatigue_per_minute;
        // Iterate over all on-pitch players
        for p in self.home.players.iter().chain(self.away.players.iter()) {
            if self.sent_off.contains(&p.id) {
                continue;
            }
            let stamina_factor = p.stamina as f64 / 100.0;
            let fitness_factor = p.fitness as f64 / 100.0;
            // Higher stamina → less depletion; higher fitness → less depletion.
            // Fitness scales the base depletion more aggressively (unfit players tire much faster).
            let tactical_factor = if self.home.players.iter().any(|player| player.id == p.id) {
                tactical_fatigue_modifier(&self.home)
            } else {
                tactical_fatigue_modifier(&self.away)
            };
            let position_factor = if matches!(p.position, Position::Goalkeeper) {
                0.35
            } else {
                1.0
            };
            let depletion = fatigue_rate
                * (1.0 - stamina_factor * 0.5)
                * (1.3 - fitness_factor * 0.6)
                * tactical_factor
                * weather_fatigue_modifier(&self.config)
                * position_factor;
            if let Some(cond) = self.player_conditions.get_mut(&p.id) {
                *cond = (*cond - depletion).max(5.0);
            }
        }
    }

    /// Adjust a skill value based on the player's current in-match condition.
    pub(super) fn condition_adjusted_skill(&self, player_id: &str, base_skill: f64) -> f64 {
        let condition = self
            .player_conditions
            .get(player_id)
            .copied()
            .unwrap_or(50.0);
        // At 100% condition: full skill. At 50%: ~80% skill. At 0%: ~60% skill.
        let factor = 0.6 + 0.4 * (condition / 100.0);
        base_skill * factor
    }

    // -----------------------------------------------------------------------
    // Player selection helpers
    // -----------------------------------------------------------------------

    pub(super) fn snap_player<R: Rng>(
        &self,
        side: Side,
        preferred: Position,
        rng: &mut R,
    ) -> PlayerSnap {
        let team = self.team_ref(side);
        let available: Vec<&PlayerData> = team
            .players
            .iter()
            .filter(|p| !self.sent_off.contains(&p.id))
            .collect();

        let candidates: Vec<&PlayerData> = available
            .iter()
            .filter(|p| p.position == preferred)
            .copied()
            .collect();

        let pool = if candidates.is_empty() {
            &available
        } else {
            &candidates
        };
        if pool.is_empty() {
            return PlayerSnap::from(&team.players[0]);
        }
        PlayerSnap::from(pool[rng.random_range(0..pool.len())])
    }

    pub(super) fn snap_player_by_id(&self, player_id: &str, side: Side) -> PlayerSnap {
        let team = self.team_ref(side);
        if let Some(p) = team.players.iter().find(|p| p.id == player_id) {
            PlayerSnap::from(p)
        } else {
            PlayerSnap::from(&team.players[0])
        }
    }

    pub(super) fn pick_penalty_taker<R: Rng>(&self, side: Side, rng: &mut R) -> PlayerSnap {
        let team = self.team_ref(side);
        let previous_takers = match side {
            Side::Home => &self.penalty_state.home_takers,
            Side::Away => &self.penalty_state.away_takers,
        };
        let mut candidates: Vec<&PlayerData> = team
            .players
            .iter()
            .filter(|p| !self.sent_off.contains(&p.id))
            .collect();
        let fresh_candidates = candidates
            .iter()
            .copied()
            .filter(|p| !previous_takers.iter().any(|id| id == &p.id))
            .collect::<Vec<_>>();
        if !fresh_candidates.is_empty() {
            candidates = fresh_candidates;
        }
        candidates.sort_by(|a, b| {
            let left = u16::from(a.shooting) + u16::from(a.composure);
            let right = u16::from(b.shooting) + u16::from(b.composure);
            right.cmp(&left)
        });
        if let Some(p) = candidates.first() {
            PlayerSnap::from(p)
        } else {
            self.snap_player(side, Position::Forward, rng)
        }
    }

    pub(super) fn pick_goalkeeper(&self, side: Side) -> PlayerSnap {
        let team = self.team_ref(side);
        for p in &team.players {
            if p.position == Position::Goalkeeper && !self.sent_off.contains(&p.id) {
                return PlayerSnap::from(p);
            }
        }
        // No goalkeeper available — pick first available
        for p in &team.players {
            if !self.sent_off.contains(&p.id) {
                return PlayerSnap::from(p);
            }
        }
        PlayerSnap::from(&team.players[0])
    }

    // -----------------------------------------------------------------------
    // Rating helpers
    // -----------------------------------------------------------------------

    pub(super) fn effective_midfield(&self, side: Side) -> f64 {
        let team = self.adapted_team(side);
        let base = team.midfield_rating();
        let modifier = play_style_modifier(team.play_style, PlayStylePhase::Midfield, true);
        compress_skill(base) * modifier * home_mod(side, &self.config)
    }

    pub(super) fn effective_press(&self, pressing_side: Side) -> f64 {
        let team = self.adapted_team(pressing_side);
        let base = team.position_attr_avg(Position::Midfielder, |p| {
            ((p.stamina as u16 + p.tackling as u16 + p.pace as u16) / 3) as u8
        });
        let modifier = play_style_modifier(team.play_style, PlayStylePhase::Press, true);
        compress_skill(base) * modifier
            * shape_midfield_multiplier(&team)
            * tactical_press_modifier(&team)
            * home_mod(pressing_side, &self.config)
    }

    // -----------------------------------------------------------------------
    // Internal accessors
    // -----------------------------------------------------------------------

    pub(super) fn team_ref(&self, side: Side) -> &TeamData {
        match side {
            Side::Home => &self.home,
            Side::Away => &self.away,
        }
    }

    pub(super) fn adapted_team(&self, side: Side) -> TeamData {
        let sent_off_count = self
            .team_ref(side)
            .players
            .iter()
            .filter(|player| self.sent_off.contains(&player.id))
            .count();
        let available = self
            .team_ref(side)
            .players
            .iter()
            .filter(|player| !self.sent_off.contains(&player.id));
        let (condition_sum, condition_count) = available.fold((0.0, 0usize), |(sum, count), player| {
            let condition = self
                .player_conditions
                .get(&player.id)
                .copied()
                .unwrap_or(player.condition as f64);
            (sum + condition, count + 1)
        });
        let average_condition = if condition_count == 0 {
            100.0
        } else {
            condition_sum / condition_count as f64
        };
        match_state_adapted_team(
            self.team_ref(side),
            side,
            self.current_minute,
            self.home_score,
            self.away_score,
            sent_off_count,
            average_condition,
        )
    }

    pub(super) fn team_mut(&mut self, side: Side) -> &mut TeamData {
        match side {
            Side::Home => &mut self.home,
            Side::Away => &mut self.away,
        }
    }

    pub(super) fn set_pieces_ref(&self, side: Side) -> &SetPieceTakers {
        match side {
            Side::Home => &self.home_set_pieces,
            Side::Away => &self.away_set_pieces,
        }
    }

    pub(super) fn set_pieces_mut(&mut self, side: Side) -> &mut SetPieceTakers {
        match side {
            Side::Home => &mut self.home_set_pieces,
            Side::Away => &mut self.away_set_pieces,
        }
    }

    pub(super) fn add_goal(&mut self, side: Side) {
        match side {
            Side::Home => self.home_score += 1,
            Side::Away => self.away_score += 1,
        }
    }
}

pub(super) fn shape_defense_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.defenders as f64 - 4.0) * 0.045
        + profile.width.central_compactness * 0.035
        - profile.width.width * 0.025
        - (profile.lateral.left_weakness + profile.lateral.right_weakness) * 0.025)
        .clamp(0.82, 1.18)
}

pub(super) fn shape_midfield_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.midfielders as f64 - 4.0) * 0.035
        + profile.width.central_density * 0.04
        - profile.width.width * 0.015)
        .clamp(0.82, 1.18)
}

pub(super) fn shape_attack_multiplier(team: &TeamData) -> f64 {
    let profile = team.tactical_profile;
    (1.0 + (team.shape_profile.forwards as f64 - 2.0) * 0.05
        + profile.width.wing_threat * 0.035
        + (profile.lateral.left_overload + profile.lateral.right_overload) * 0.02
        - profile.width.central_density * 0.015)
        .clamp(0.82, 1.18)
}
