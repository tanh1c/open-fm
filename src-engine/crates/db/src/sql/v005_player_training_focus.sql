-- Add per-player training focus override; NULL means use group/team default
ALTER TABLE players ADD COLUMN training_focus TEXT DEFAULT NULL;
