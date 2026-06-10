# Save Size and FC26 Simulation Performance Roadmap

This roadmap tracks the remaining save-size and simulation-speed improvements after compacting normal AI-vs-AI match report retention.

## 1. Reduce legacy league persistence duplication

Current issue:
- The save currently persists both legacy `game.league` fixture data and newer `game.competitions` fixture data.
- With FC26-scale worlds, this duplicates fixture/result JSON and adds extra write work each save.

Target direction:
- Make `game.competitions` the primary source for fixture storage where possible.
- Keep legacy `game.league` only as a compatibility bridge for systems that still depend on it.
- Gradually move remaining reads/writes away from legacy league paths before removing or shrinking legacy persistence.

Expected result:
- Smaller save files.
- Less duplicated fixture/result data.
- Lower risk of stale fixture state between legacy league and competitions.

## 2. Incremental fixture persistence

Current issue:
- Competition persistence rewrites broad fixture sets even when only a small number of fixtures changed on the current day.
- FC26 worlds multiply this cost across many competitions and fixtures.

Target direction:
- Track or infer changed fixtures during day simulation.
- Upsert only fixtures whose status/result/stage fields changed.
- Avoid deleting and reinserting full competition fixture lists during normal autosave.

Expected result:
- Faster autosaves after matchdays.
- Less SQLite write amplification.
- Better scaling as the world size grows.

## 3. Fast or hybrid primary-league AI-vs-AI simulation

Current issue:
- Primary/legacy league AI-vs-AI matches still use the live-minute engine, including minute-by-minute state updates and AI decisions.
- This is much heavier than synthetic fast simulation and becomes visible in FC26-scale worlds.

Target direction:
- Use fast simulation for normal AI-vs-AI league matches.
- Use hybrid/full live simulation only for user matches, watched matches, derbies, title/relegation-deciding matches, finals, or other important fixtures.
- Preserve aggregate player/team stats for fast-sim matches so leaderboards and Match Center stats continue to work.

Expected result:
- Much faster day advancement.
- Important matches can still have rich reports and realistic event detail.
- Normal background matches stay lightweight.

## 4. Index players by team during matchday simulation

Current issue:
- Repeated squad building scans the full `game.players` list for each fixture.
- FC26 worlds have many more players, so repeated full scans are expensive.

Target direction:
- Build a `players_by_team` index once per simulated day.
- Reuse that index when building AI lineups and benches for all fixtures on that day.
- Keep the index local to matchday simulation so it cannot become stale across transfers, injuries, or day changes.

Expected result:
- Faster lineup building.
- Lower CPU cost for large worlds.
- No gameplay behavior change if implemented as a pure lookup optimization.
