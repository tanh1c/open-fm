-- V30: Knockout stage metadata for cup + continental fixtures.
-- `stage` identifies the round (e.g. "round_1", "playoff", "r16", "qf", "sf",
-- "final"); `leg` is the leg number within a two-legged tie (1 or 2); `tie_id`
-- groups both legs of a tie so the bracket UI and aggregate scoring can pair them.
ALTER TABLE fixtures ADD COLUMN stage TEXT;
ALTER TABLE fixtures ADD COLUMN leg INTEGER;
ALTER TABLE fixtures ADD COLUMN tie_id TEXT;
