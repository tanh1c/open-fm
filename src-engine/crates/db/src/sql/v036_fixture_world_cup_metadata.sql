-- V36: Neutral venue and group labels for World Cup fixtures.
ALTER TABLE fixtures ADD COLUMN venue_name TEXT;
ALTER TABLE fixtures ADD COLUMN venue_city TEXT;
ALTER TABLE fixtures ADD COLUMN venue_country TEXT;
ALTER TABLE fixtures ADD COLUMN group_label TEXT;
