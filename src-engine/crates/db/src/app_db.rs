// AppDatabase — a small SQLite database that lives alongside per-save game DBs
// and tracks the index of all saves. Replaces the old JSON-based save_index.json.
//
// Path conventions:
//   - native:  `<saves_dir>/app.db`
//   - wasm32:  `app.db` (sahpool VFS namespaces by URI; no real filesystem)

use log::{debug, error};
use rusqlite::{Connection, params};
use rusqlite_migration::{M, Migrations};
use std::path::Path;

const APP_DATABASE_OPEN_FAILED: &str = "be.error.appDatabase.openFailed";
const APP_DATABASE_MIGRATION_FAILED: &str = "be.error.appDatabase.migrationFailed";
const APP_DATABASE_QUERY_FAILED: &str = "be.error.appDatabase.queryFailed";

/// Schema migrations for the app database. Tracks both the save index
/// and a small key-value store used for app-wide settings.
fn app_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("sql/app/v001_save_index.sql")),
        M::up(include_str!("sql/app/v002_app_kv.sql")),
        M::up(include_str!("sql/app/v003_save_index_game_date.sql")),
    ])
}

/// SaveEntry as stored in the save_index table. No checksum — OPFS + SQLite
/// already guarantee write integrity, so we don't need to hash blobs ourselves.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SaveEntry {
    pub id: String,
    pub name: String,
    pub manager_name: String,
    pub db_filename: String,
    pub created_at: String,
    pub last_played_at: String,
    /// In-game calendar date (YYYY-MM-DD) at the time of the last save. None for
    /// legacy saves written before this column existed; backfilled on next save.
    #[serde(default)]
    pub game_date: Option<String>,
    #[serde(default)]
    pub size_bytes: Option<u64>,
}

/// AppDatabase manages the save_index table. One instance per process.
pub struct AppDatabase {
    conn: Connection,
}

impl AppDatabase {
    /// Open or create the app database at the given path and apply migrations.
    pub fn open(path: &Path) -> Result<Self, String> {
        debug!("[app_db] opening at {:?}", path);
        let mut conn = Connection::open(path).map_err(|e| {
            error!("[app_db] open failed at {:?}: {}", path, e);
            APP_DATABASE_OPEN_FAILED.to_string()
        })?;
        app_migrations().to_latest(&mut conn).map_err(|e| {
            error!("[app_db] migration failed: {}", e);
            APP_DATABASE_MIGRATION_FAILED.to_string()
        })?;
        Ok(Self { conn })
    }

    /// In-memory app database (tests only).
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        let mut conn = Connection::open_in_memory()
            .map_err(|_| APP_DATABASE_OPEN_FAILED.to_string())?;
        app_migrations()
            .to_latest(&mut conn)
            .map_err(|_| APP_DATABASE_MIGRATION_FAILED.to_string())?;
        Ok(Self { conn })
    }

    /// List all saves, most-recently-played first.
    pub fn list_saves(&self) -> Result<Vec<SaveEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, manager_name, db_filename, created_at, last_played_at, game_date
                 FROM save_index ORDER BY last_played_at DESC, id ASC",
            )
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        let rows = stmt
            .query_map([], row_to_save_entry)
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?);
        }
        Ok(out)
    }

    pub fn find(&self, save_id: &str) -> Result<Option<SaveEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, manager_name, db_filename, created_at, last_played_at, game_date
                 FROM save_index WHERE id = ?1",
            )
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        let mut rows = stmt
            .query_map(params![save_id], row_to_save_entry)
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        match rows.next() {
            Some(row) => Ok(Some(row.map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?)),
            None => Ok(None),
        }
    }

    pub fn insert(&self, entry: &SaveEntry) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO save_index (id, name, manager_name, db_filename, created_at, last_played_at, game_date)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    entry.id,
                    entry.name,
                    entry.manager_name,
                    entry.db_filename,
                    entry.created_at,
                    entry.last_played_at,
                    entry.game_date,
                ],
            )
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        Ok(())
    }

    /// Update an existing entry by id. Returns Err if no row matched.
    pub fn update(&self, entry: &SaveEntry) -> Result<(), String> {
        let n = self
            .conn
            .execute(
                "UPDATE save_index
                    SET name = ?2,
                        manager_name = ?3,
                        last_played_at = ?4,
                        game_date = ?5
                  WHERE id = ?1",
                params![
                    entry.id,
                    entry.name,
                    entry.manager_name,
                    entry.last_played_at,
                    entry.game_date,
                ],
            )
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        if n == 0 {
            return Err(APP_DATABASE_QUERY_FAILED.to_string());
        }
        Ok(())
    }

    /// Remove a save entry. Returns true if a row was deleted.
    pub fn remove(&self, save_id: &str) -> Result<bool, String> {
        let n = self
            .conn
            .execute("DELETE FROM save_index WHERE id = ?1", params![save_id])
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        Ok(n > 0)
    }

    /// Clear every save entry. Used by the "clear all saves" admin action.
    pub fn clear(&self) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM save_index", [])
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        Ok(())
    }

    /// Read a single key from the app-wide key/value store.
    pub fn kv_get(&self, key: &str) -> Result<Option<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM app_kv WHERE key = ?1")
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        let mut rows = stmt
            .query_map(params![key], |row| row.get::<_, String>(0))
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        match rows.next() {
            Some(row) => Ok(Some(row.map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?)),
            None => Ok(None),
        }
    }

    /// Upsert a key in the app-wide key/value store.
    pub fn kv_put(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO app_kv (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map_err(|_| APP_DATABASE_QUERY_FAILED.to_string())?;
        Ok(())
    }
}

fn row_to_save_entry(row: &rusqlite::Row) -> rusqlite::Result<SaveEntry> {
    Ok(SaveEntry {
        id: row.get(0)?,
        name: row.get(1)?,
        manager_name: row.get(2)?,
        db_filename: row.get(3)?,
        created_at: row.get(4)?,
        last_played_at: row.get(5)?,
        game_date: row.get(6)?,
        size_bytes: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, last_played: &str) -> SaveEntry {
        SaveEntry {
            id: id.to_string(),
            name: format!("Career {id}"),
            manager_name: "John Smith".to_string(),
            db_filename: format!("{id}.db"),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            last_played_at: last_played.to_string(),
            game_date: Some("2026-08-15".to_string()),
            size_bytes: None,
        }
    }

    #[test]
    fn insert_and_find_roundtrip() {
        let app = AppDatabase::open_in_memory().unwrap();
        let e = entry("save-1", "2026-01-02T00:00:00Z");
        app.insert(&e).unwrap();
        assert_eq!(app.find("save-1").unwrap().as_ref(), Some(&e));
        assert_eq!(app.find("missing").unwrap(), None);
    }

    #[test]
    fn list_saves_orders_by_last_played_desc() {
        let app = AppDatabase::open_in_memory().unwrap();
        app.insert(&entry("a", "2026-01-01T00:00:00Z")).unwrap();
        app.insert(&entry("b", "2026-03-01T00:00:00Z")).unwrap();
        app.insert(&entry("c", "2026-02-01T00:00:00Z")).unwrap();
        let ids: Vec<_> = app
            .list_saves()
            .unwrap()
            .into_iter()
            .map(|e| e.id)
            .collect();
        assert_eq!(ids, vec!["b", "c", "a"]);
    }

    #[test]
    fn update_modifies_existing_entry() {
        let app = AppDatabase::open_in_memory().unwrap();
        app.insert(&entry("save-1", "2026-01-01T00:00:00Z")).unwrap();
        let mut updated = entry("save-1", "2026-01-05T00:00:00Z");
        updated.name = "Renamed Career".to_string();
        app.update(&updated).unwrap();
        let got = app.find("save-1").unwrap().unwrap();
        assert_eq!(got.name, "Renamed Career");
        assert_eq!(got.last_played_at, "2026-01-05T00:00:00Z");
    }

    #[test]
    fn update_missing_id_returns_err() {
        let app = AppDatabase::open_in_memory().unwrap();
        let result = app.update(&entry("ghost", "2026-01-01T00:00:00Z"));
        assert!(result.is_err());
    }

    #[test]
    fn remove_deletes_and_reports_outcome() {
        let app = AppDatabase::open_in_memory().unwrap();
        app.insert(&entry("save-1", "2026-01-01T00:00:00Z")).unwrap();
        assert!(app.remove("save-1").unwrap());
        assert!(!app.remove("save-1").unwrap());
        assert_eq!(app.find("save-1").unwrap(), None);
    }

    #[test]
    fn clear_drops_every_row() {
        let app = AppDatabase::open_in_memory().unwrap();
        app.insert(&entry("a", "2026-01-01T00:00:00Z")).unwrap();
        app.insert(&entry("b", "2026-01-02T00:00:00Z")).unwrap();
        app.clear().unwrap();
        assert!(app.list_saves().unwrap().is_empty());
    }

    #[test]
    fn unique_db_filename_constraint() {
        let app = AppDatabase::open_in_memory().unwrap();
        app.insert(&entry("a", "2026-01-01T00:00:00Z")).unwrap();
        let mut clash = entry("b", "2026-01-02T00:00:00Z");
        clash.db_filename = "a.db".to_string();
        assert!(app.insert(&clash).is_err());
    }
}
