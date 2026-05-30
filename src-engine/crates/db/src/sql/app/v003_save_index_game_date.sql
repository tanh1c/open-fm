-- Track the in-game date of each save so the load menu can show where the
-- player is in their career, not just the real-world last-played timestamp.
-- Nullable for existing saves; backfilled on next save.
ALTER TABLE save_index ADD COLUMN game_date TEXT;
