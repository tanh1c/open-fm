-- V3: Add alternate_positions JSON column to players table
ALTER TABLE players ADD COLUMN alternate_positions TEXT NOT NULL DEFAULT '[]';
