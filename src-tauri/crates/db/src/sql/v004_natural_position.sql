-- Add natural_position column; default to current position for existing players
ALTER TABLE players ADD COLUMN natural_position TEXT NOT NULL DEFAULT '';
UPDATE players SET natural_position = position WHERE natural_position = '';
