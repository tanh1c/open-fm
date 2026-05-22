ALTER TABLE players
ADD COLUMN morale_core TEXT NOT NULL DEFAULT '{"manager_trust":50,"unresolved_issue":null,"recent_treatment":null}';
