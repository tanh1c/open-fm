ALTER TABLE game_meta ADD COLUMN season_honours_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE game_meta ADD COLUMN records_json TEXT NOT NULL DEFAULT '{}';
