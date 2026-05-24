CREATE TABLE IF NOT EXISTS competitions (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    season          INTEGER NOT NULL,
    kind            TEXT NOT NULL,
    format          TEXT NOT NULL,
    country         TEXT,
    tier            INTEGER
);

CREATE TABLE IF NOT EXISTS competition_teams (
    competition_id  TEXT NOT NULL,
    team_id         TEXT NOT NULL,
    PRIMARY KEY (competition_id, team_id)
);

ALTER TABLE fixtures ADD COLUMN competition_id TEXT;
ALTER TABLE fixtures ADD COLUMN season INTEGER;

UPDATE fixtures
SET competition_id = league_id,
    season = (SELECT season FROM league WHERE league.id = fixtures.league_id)
WHERE competition_id IS NULL;

INSERT OR IGNORE INTO competitions (id, name, season, kind, format, country, tier)
SELECT id, name, season, 'DomesticLeague', 'RoundRobin', NULL, 1
FROM league;

INSERT OR IGNORE INTO competition_teams (competition_id, team_id)
SELECT league_id, team_id
FROM standings;

CREATE INDEX IF NOT EXISTS idx_fixtures_date_status ON fixtures(date, status);
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_matchday ON fixtures(competition_id, matchday);
CREATE INDEX IF NOT EXISTS idx_standings_competition_team ON standings(league_id, team_id);
