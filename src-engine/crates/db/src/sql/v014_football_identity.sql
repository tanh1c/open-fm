ALTER TABLE managers ADD COLUMN football_nation TEXT NOT NULL DEFAULT '';
ALTER TABLE managers ADD COLUMN birth_country TEXT;

ALTER TABLE teams ADD COLUMN football_nation TEXT NOT NULL DEFAULT '';

ALTER TABLE players ADD COLUMN football_nation TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN birth_country TEXT;

ALTER TABLE staff ADD COLUMN football_nation TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN birth_country TEXT;