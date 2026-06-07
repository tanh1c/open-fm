-- V33: Persist player squad/shirt numbers. Existing players default to NULL and
-- get assigned lazily by the manager or on next squad-number backfill.
ALTER TABLE players ADD COLUMN squad_number INTEGER;
