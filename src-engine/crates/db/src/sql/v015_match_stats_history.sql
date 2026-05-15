CREATE TABLE player_match_stats (
    fixture_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    matchday INTEGER NOT NULL,
    date TEXT NOT NULL,
    competition TEXT NOT NULL DEFAULT 'League',
    player_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    opponent_team_id TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_goals INTEGER NOT NULL DEFAULT 0,
    away_goals INTEGER NOT NULL DEFAULT 0,
    minutes_played INTEGER NOT NULL DEFAULT 0,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    shots INTEGER NOT NULL DEFAULT 0,
    shots_on_target INTEGER NOT NULL DEFAULT 0,
    passes_completed INTEGER NOT NULL DEFAULT 0,
    passes_attempted INTEGER NOT NULL DEFAULT 0,
    tackles_won INTEGER NOT NULL DEFAULT 0,
    interceptions INTEGER NOT NULL DEFAULT 0,
    fouls_committed INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (fixture_id, player_id)
);

CREATE INDEX idx_player_match_stats_player_date
    ON player_match_stats(player_id, date DESC, matchday DESC);

CREATE TABLE team_match_stats (
    fixture_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    matchday INTEGER NOT NULL,
    date TEXT NOT NULL,
    competition TEXT NOT NULL DEFAULT 'League',
    team_id TEXT NOT NULL,
    opponent_team_id TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    possession_pct INTEGER NOT NULL DEFAULT 0,
    shots INTEGER NOT NULL DEFAULT 0,
    shots_on_target INTEGER NOT NULL DEFAULT 0,
    passes_completed INTEGER NOT NULL DEFAULT 0,
    passes_attempted INTEGER NOT NULL DEFAULT 0,
    tackles_won INTEGER NOT NULL DEFAULT 0,
    interceptions INTEGER NOT NULL DEFAULT 0,
    fouls_committed INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (fixture_id, team_id)
);

CREATE INDEX idx_team_match_stats_team_date
    ON team_match_stats(team_id, date DESC, matchday DESC);