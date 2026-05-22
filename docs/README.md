# OpenFoot Manager — Documentation Index

This directory contains the technical documentation for OpenFoot Manager, a desktop football management simulation built with Tauri (Rust) and React (TypeScript).

---

## Documents

### [GETTING_STARTED.md](GETTING_STARTED.md)

Player-facing gameplay guide. Walks through creating a new game (manager profile, world selection, team choice), navigating the Dashboard and its tabs, advancing time and match day options, setting up tactics (formations, play styles), the training system (focus, intensity, schedules), managing staff, the full match day experience (pre-match setup, live simulation controls, half-time, post-match, press conference), reading the league standings and news, and 10 practical tips for new managers.

### [ARCHITECTURE.md](ARCHITECTURE.md)

Project structure and architectural overview. Covers the technology stack, crate dependency graph (`domain` → `engine` → `ofm_core` → Tauri), state management on both backend (Mutex-based) and frontend (Zustand stores), the full Tauri command interface (IPC), data flow diagrams for new-game and daily-turn processing, frontend routing and component architecture (Dashboard tabs, match day stages), and key architectural decisions such as engine isolation, backward-compatible serialization, and the `PlayerSnap` borrow-checker pattern.

### [MATCH_SIMULATION.md](MATCH_SIMULATION.md)

Deep dive into the match simulation engine (`engine` crate). Explains the 5-zone pitch model, minute-by-minute action resolution, shot/foul/card/penalty/injury mechanics, player attributes (18 total), trait bonuses across 7 contexts, composite team ratings, play style modifiers, home advantage, and tuneable `MatchConfig` parameters. Also documents the live match system (11 phases, tactical commands, stamina depletion, penalty shootout), AI manager decision logic, domain↔engine type conversion, and test coverage (69 tests).

### [GAME_SYSTEMS.md](GAME_SYSTEMS.md)

All gameplay systems beyond match simulation. Includes turn processing flow, the training system (6 focus areas, 3 intensity levels, 3 weekly schedules, probabilistic attribute gains with age/staff modifiers, condition recovery, fitness warnings), staff system (4 roles, coaching bonuses, 7 specializations), player traits (20 traits with attribute requirements), league and schedule generation (double round-robin circle method, standings), inbox messages (13 categories with randomized templates and deduplication), news articles (8 categories), world generation (player/staff/team creation from definition files or hardcoded fallbacks), finances, and the transfer market framework.

### [DEFINITIONS.md](DEFINITIONS.md)

Schema documentation for external definition files used by the world generator. Describes the JSON format for `default_names.json` (nationality-keyed name pools with ISO alpha-2 country codes) and `default_teams.json` (team templates with name, city, country, colors, play style, reputation and finance ranges). Includes a country codes reference table, the world database export format, and tips for creating custom definition files.

---

## Legacy

The `legacy/` directory contains earlier design documents from previous implementations:

- **`legacy/simulation.rst`** — Original simulation design with 15-zone transition matrices and detailed event chains. Kept for historical reference; the current engine uses a simplified 5-zone model documented in [MATCH_SIMULATION.md](MATCH_SIMULATION.md).
