-- V2: Add training_groups JSON column to teams table
ALTER TABLE teams ADD COLUMN training_groups TEXT NOT NULL DEFAULT '[]';
