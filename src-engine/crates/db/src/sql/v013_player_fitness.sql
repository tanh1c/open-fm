-- V13: Add player fitness as a dynamic long-term physical shape value (0-100).
-- Existing players start at 75 (a reasonable mid-to-good baseline).
ALTER TABLE players ADD COLUMN fitness INTEGER NOT NULL DEFAULT 75;
