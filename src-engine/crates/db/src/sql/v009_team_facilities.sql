ALTER TABLE teams
ADD COLUMN facilities TEXT NOT NULL DEFAULT '{"training":1,"medical":1,"scouting":1}';
