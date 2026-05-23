ALTER TABLE players ADD COLUMN shortlisted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN loan_parent_team_id TEXT;
ALTER TABLE players ADD COLUMN loan_until TEXT;
ALTER TABLE players ADD COLUMN loan_wage_share_percent INTEGER;
