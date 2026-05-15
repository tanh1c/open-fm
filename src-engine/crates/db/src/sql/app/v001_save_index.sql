CREATE TABLE save_index (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    manager_name    TEXT NOT NULL,
    db_filename     TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL,
    last_played_at  TEXT NOT NULL
);

CREATE INDEX idx_save_index_last_played ON save_index(last_played_at DESC);
