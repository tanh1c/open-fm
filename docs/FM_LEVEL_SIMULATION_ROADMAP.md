# FM-Level Simulation Realism Roadmap

## Current baseline

The match engine is already statistically realistic enough for long-term career play:

- Generated-world benchmark goals/game is in the target range.
- Shots, shots on target, pass accuracy, and average ratings are stable.
- Forwards lead goals, midfielders lead assists, and defenders contribute occasionally.
- Generated squads now use granular roles such as center-back, fullback, defensive midfielder, central midfielder, attacking midfielder, winger, and striker.

Do not keep tuning raw goals/shots immediately. The next realism jump should come from deeper systemic layers, each with its own benchmark, so the simulation becomes richer without becoming random or unbalanced.

## Roadmap

### 1. Advanced tactical interaction

Add tactical controls and make them materially affect match outcomes.

Core dimensions:

- Pressing intensity.
- Defensive line.
- Tempo.
- Width.
- Passing directness.
- Risk appetite.

Expected engine effects:

- Shot quality.
- Turnovers.
- Fatigue drain.
- Space creation.
- Defensive exposure.
- Passing safety versus progression.

This should be the first layer because it makes matches feel meaningfully different instead of only statistically correct.

### 2. Player traits as behavioral modifiers

Traits should affect match decisions, not only appear as descriptive text.

Example traits:

- Cuts inside.
- Tries killer balls.
- Shoots from distance.
- Dives into tackles.
- Dictates tempo.
- Gets forward whenever possible.
- Stays back while attacking.

Expected engine effects:

- Pass selection.
- Shot selection.
- Dribble frequency.
- Tackle aggression.
- Foul/card risk.
- Positioning and movement choices.
- Chance creation style.

### 3. Tactical familiarity and role suitability

Add long-term cohesion and role comfort so team performance depends on tactical continuity.

Core ideas:

- Players perform worse when used in unsuitable roles.
- Teams lose cohesion when changing tactics too often.
- Familiarity improves through training and match minutes.
- Repeatedly using the same system should improve execution.

Expected engine effects:

- Passing accuracy.
- Defensive errors.
- Pressing synchronization.
- Attacking movement.
- Transition quality.
- Mistake risk under pressure.

### 4. Morale and form model

Build morale and form as persistent performance systems rather than random streaks.

Morale should be influenced by:

- Results.
- Playing time.
- Contracts.
- Conversations.
- Squad status.
- Board pressure.
- Media pressure.
- Rivalry matches.

Form should be a rolling signal based on recent performances, not a hidden random boost.

Expected engine effects:

- Composure.
- Decisions.
- Work rate.
- Confidence in risky actions.
- Mistake risk.
- Late-game resilience.

### 5. Smarter AI rotation, fatigue, and injury risk

AI teams should rotate intelligently over a season instead of always selecting the strongest XI.

AI selection should consider:

- Fixture congestion.
- Player condition.
- Player fatigue.
- Injury risk.
- Match importance.
- Opponent strength.
- Upcoming fixtures.
- Squad depth.
- Youth/development minutes.

Expected career effects:

- Better long-season realism.
- More believable AI lineups.
- Fewer unrealistic exhaustion spirals.
- More meaningful squad depth.
- More realistic injuries and availability.

### 6. Referee variance

Add referee profiles so discipline and match control vary naturally.

Referee dimensions:

- Leniency.
- Strictness.
- Card tendency.
- Foul threshold.
- Penalty tendency.
- Advantage tendency.
- Big-match temperament.

Expected engine effects:

- Fouls.
- Yellow/red cards.
- Penalties.
- Aggressive tactic risk.
- Derby/big-match volatility.

### 7. Weather and pitch conditions

Add environmental effects that influence match style and tactical choices.

Weather/pitch dimensions:

- Rain.
- Wind.
- Heat.
- Cold.
- Poor pitch.
- Excellent pitch.

Expected engine effects:

- Passing accuracy.
- Tempo.
- Fatigue.
- Injury risk.
- Long shots.
- Crosses.
- Aerial/direct play.
- Pressing sustainability.

Tactical choices should react to conditions instead of conditions being cosmetic only.

### 8. Meta-layer realism

Build the broader career systems that make simulation feel FM-level beyond the 90 minutes.

Key systems:

- Injury model.
- Training load.
- Squad happiness.
- Promises.
- Playing-time expectations.
- Media pressure.
- Board pressure.
- Rivalries.
- Dressing-room hierarchy.
- Mentoring and leadership.

This layer turns realistic match stats into a realistic football management ecosystem.

### 9. Long-save data retention and match-history performance

Keep long careers fast without losing the historical information managers expect.

Core retention policy:

- Keep permanent season totals, career totals, honours, awards, records, standings history, and trophy history.
- Keep full match detail for the current season and recent seasons, including compact timeline events, scorers, assists, substitutions, cards, and team stats.
- Prune or archive old per-player per-match records after a configurable number of seasons.
- Preserve lightweight historical fixture results so schedules, team histories, competition histories, and player career summaries remain meaningful.
- Add save-size and season-rollover benchmarks for 10+ and 20+ season careers.

Expected effects:

- Save files grow predictably instead of unboundedly.
- Season rollover can clean old detailed data safely.
- Completed match detail stays rich for recent matches while older seasons remain available as lightweight history.
- Long-term simulation speed remains stable as careers advance.

## Recommended implementation phases

### Phase 1: Tactical model v2

Expand tactic/team profiles and match-engine resolution so tactics materially change how matches play out.

Deliverables:

- Add richer tactical settings to team tactics.
- Thread tactical settings into match simulation.
- Create benchmark scenarios for low block, high press, direct play, possession play, wide play, and narrow play.
- Verify tactics affect shot quality, turnovers, pass accuracy, fatigue, and chance profile without breaking baseline realism.

### Phase 2: Player traits as behavioral modifiers

Convert player traits into concrete engine modifiers.

Deliverables:

- Map each trait to decision modifiers.
- Add trait influence to pass, shot, tackle, dribble, and positioning decisions.
- Add tests for trait-specific behavioral changes.
- Add benchmark comparison between trait-heavy and neutral teams.

### Phase 3: Morale, form, and familiarity model

Add persistent team/player state that influences match performance.

Deliverables:

- Add morale and form state.
- Add tactical familiarity state.
- Update training/match flows to evolve these values.
- Apply controlled modifiers in the match engine.
- Add benchmarks for high morale, low morale, familiar tactic, and unfamiliar tactic scenarios.

### Phase 4: AI squad rotation, fatigue, and injury risk

Improve AI season management so long-term simulation stays believable.

Deliverables:

- Add AI lineup selection based on condition, fatigue, match importance, and fixture congestion.
- Add injury-risk model tied to fatigue, match load, training load, and weather/pitch later.
- Add rotation benchmarks across congested schedules.
- Verify generated-world multi-season stats remain realistic.

### Phase 5: Referee, weather, and pitch variance

Add controlled match-to-match variance and tactical context.

Deliverables:

- Add referee profiles.
- Add weather and pitch state to fixtures/matches.
- Apply modifiers to fouls, cards, penalties, passing, fatigue, injury risk, and play style.
- Add benchmarks for strict referee, lenient referee, rain, heat, wind, and poor pitch.

## Benchmarking principles

Every realism layer should have its own benchmark before broad tuning.

Required checks:

- Goals/game stays roughly in target range.
- Shots/game stays realistic.
- SOT rate stays realistic.
- Pass accuracy stays realistic.
- Average ratings stay stable.
- Scorer and assister distribution remains plausible.
- Tactical/trait/state changes create directional differences without extreme outliers.

Do not tune one metric in isolation. A change that improves goals/game but breaks pass accuracy, ratings, fatigue, cards, or role distribution is not a realism improvement.

## Guiding principle

The current statistical baseline is good. To reach FM-level realism, build layered systems that interact with tactics, players, morale, fatigue, referees, weather, and long-term squad management. Each layer should be measurable, benchmarked, and introduced gradually so the simulation becomes deeper without becoming noisy or unbalanced.
