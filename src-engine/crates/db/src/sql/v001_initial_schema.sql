-- V1: Initial schema for per-save game databases

CREATE TABLE game_meta (
    id              TEXT PRIMARY KEY DEFAULT 'singleton',
    save_id         TEXT NOT NULL,
    save_name       TEXT NOT NULL,
    manager_id      TEXT NOT NULL,
    start_date      TEXT NOT NULL,
    game_date       TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_played_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE managers (
    id              TEXT PRIMARY KEY,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    date_of_birth   TEXT NOT NULL,
    nationality     TEXT NOT NULL,
    reputation      INTEGER NOT NULL DEFAULT 500,
    satisfaction    INTEGER NOT NULL DEFAULT 100,
    fan_approval    INTEGER NOT NULL DEFAULT 50,
    team_id         TEXT,
    career_stats    TEXT NOT NULL DEFAULT '{}',
    career_history  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE teams (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    short_name          TEXT NOT NULL,
    country             TEXT NOT NULL,
    city                TEXT NOT NULL,
    stadium_name        TEXT NOT NULL,
    stadium_capacity    INTEGER NOT NULL,
    finance             INTEGER NOT NULL DEFAULT 1000000,
    manager_id          TEXT,
    reputation          INTEGER NOT NULL DEFAULT 500,
    wage_budget         INTEGER NOT NULL,
    transfer_budget     INTEGER NOT NULL,
    season_income       INTEGER NOT NULL DEFAULT 0,
    season_expenses     INTEGER NOT NULL DEFAULT 0,
    formation           TEXT NOT NULL DEFAULT '4-4-2',
    play_style          TEXT NOT NULL DEFAULT 'Balanced',
    training_focus      TEXT NOT NULL DEFAULT 'Physical',
    training_intensity  TEXT NOT NULL DEFAULT 'Medium',
    training_schedule   TEXT NOT NULL DEFAULT 'Balanced',
    founded_year        INTEGER NOT NULL DEFAULT 1900,
    colors_primary      TEXT NOT NULL DEFAULT '#10b981',
    colors_secondary    TEXT NOT NULL DEFAULT '#ffffff',
    starting_xi_ids     TEXT NOT NULL DEFAULT '[]',
    form                TEXT NOT NULL DEFAULT '[]',
    history             TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE players (
    id                  TEXT PRIMARY KEY,
    match_name          TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    position            TEXT NOT NULL,
    attributes          TEXT NOT NULL,
    condition           INTEGER NOT NULL DEFAULT 100,
    morale              INTEGER NOT NULL DEFAULT 100,
    injury              TEXT,
    team_id             TEXT,
    traits              TEXT NOT NULL DEFAULT '[]',
    contract_end        TEXT,
    wage                INTEGER NOT NULL DEFAULT 0,
    market_value        INTEGER NOT NULL DEFAULT 0,
    stats               TEXT NOT NULL DEFAULT '{}',
    career              TEXT NOT NULL DEFAULT '[]',
    transfer_listed     INTEGER NOT NULL DEFAULT 0,
    loan_listed         INTEGER NOT NULL DEFAULT 0,
    transfer_offers     TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE staff (
    id                  TEXT PRIMARY KEY,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    nationality         TEXT NOT NULL,
    role                TEXT NOT NULL,
    attributes          TEXT NOT NULL,
    team_id             TEXT,
    specialization      TEXT,
    wage                INTEGER NOT NULL DEFAULT 0,
    contract_end        TEXT
);

CREATE TABLE league (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    season          INTEGER NOT NULL
);

CREATE TABLE fixtures (
    id              TEXT PRIMARY KEY,
    league_id       TEXT NOT NULL,
    matchday        INTEGER NOT NULL,
    date            TEXT NOT NULL,
    home_team_id    TEXT NOT NULL,
    away_team_id    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Scheduled',
    result          TEXT
);

CREATE TABLE standings (
    league_id       TEXT NOT NULL,
    team_id         TEXT NOT NULL,
    played          INTEGER NOT NULL DEFAULT 0,
    won             INTEGER NOT NULL DEFAULT 0,
    drawn           INTEGER NOT NULL DEFAULT 0,
    lost            INTEGER NOT NULL DEFAULT 0,
    goals_for       INTEGER NOT NULL DEFAULT 0,
    goals_against   INTEGER NOT NULL DEFAULT 0,
    points          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (league_id, team_id)
);

CREATE TABLE messages (
    id              TEXT PRIMARY KEY,
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,
    sender          TEXT NOT NULL,
    sender_role     TEXT NOT NULL DEFAULT '',
    date            TEXT NOT NULL,
    read            INTEGER NOT NULL DEFAULT 0,
    category        TEXT NOT NULL DEFAULT 'System',
    priority        TEXT NOT NULL DEFAULT 'Normal',
    actions         TEXT NOT NULL DEFAULT '[]',
    context         TEXT NOT NULL DEFAULT '{}',
    i18n            TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE news (
    id              TEXT PRIMARY KEY,
    headline        TEXT NOT NULL,
    body            TEXT NOT NULL,
    source          TEXT NOT NULL,
    date            TEXT NOT NULL,
    category        TEXT NOT NULL,
    team_ids        TEXT NOT NULL DEFAULT '[]',
    player_ids      TEXT NOT NULL DEFAULT '[]',
    match_score     TEXT,
    read            INTEGER NOT NULL DEFAULT 0,
    i18n            TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE board_objectives (
    id              TEXT PRIMARY KEY,
    description     TEXT NOT NULL,
    target          INTEGER NOT NULL,
    objective_type  TEXT NOT NULL,
    met             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scouting_assignments (
    id              TEXT PRIMARY KEY,
    scout_id        TEXT NOT NULL,
    player_id       TEXT NOT NULL,
    days_remaining  INTEGER NOT NULL
);
