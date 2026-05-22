ALTER TABLE teams
ADD COLUMN match_roles TEXT NOT NULL DEFAULT '{"captain":null,"vice_captain":null,"penalty_taker":null,"free_kick_taker":null,"corner_taker":null}';
