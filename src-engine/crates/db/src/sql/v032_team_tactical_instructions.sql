ALTER TABLE teams ADD COLUMN tactical_instructions TEXT NOT NULL DEFAULT '{"pressing_intensity":0.5,"defensive_line":0.5,"tempo":0.5,"width":0.5,"passing_directness":0.5,"risk_appetite":0.5}';
