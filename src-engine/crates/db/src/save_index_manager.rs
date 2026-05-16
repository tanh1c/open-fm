use std::path::{Path, PathBuf};

use crate::app_db::{AppDatabase, SaveEntry};

/// Manages the save index, persisted in `app.db` (a small SQLite database
/// alongside the per-save game databases). Keeps a connection open for the
/// lifetime of the manager.
pub struct SaveIndexManager {
    saves_dir: PathBuf,
    app_db: AppDatabase,
}

impl SaveIndexManager {
    pub fn init(saves_dir: &Path) -> Result<Self, String> {
        let app_db_path = saves_dir.join("app.db");
        let app_db = AppDatabase::open(&app_db_path)?;
        Ok(Self {
            saves_dir: saves_dir.to_path_buf(),
            app_db,
        })
    }

    /// Compatibility no-op. The SQL backend is always ready after `init`,
    /// so callers no longer need a lazy-load step. Kept as a method to avoid
    /// churning every call-site.
    pub fn ensure_loaded(&mut self) -> Result<(), String> {
        Ok(())
    }

    pub fn saves_dir(&self) -> &Path {
        &self.saves_dir
    }

    pub fn list_saves(&self) -> Vec<SaveEntry> {
        self.app_db.list_saves().unwrap_or_default()
    }

    pub fn find(&self, save_id: &str) -> Option<SaveEntry> {
        self.app_db.find(save_id).ok().flatten()
    }

    pub fn record_new_save(&mut self, entry: SaveEntry) -> Result<(), String> {
        self.app_db.insert(&entry)
    }

    pub fn update_save(&mut self, entry: SaveEntry) -> Result<(), String> {
        self.app_db.update(&entry)
    }

    pub fn remove_save(&mut self, save_id: &str) -> Result<bool, String> {
        self.app_db.remove(save_id)
    }

    pub fn clear_all(&mut self) -> Result<(), String> {
        self.app_db.clear()
    }

    pub fn kv_get(&self, key: &str) -> Result<Option<String>, String> {
        self.app_db.kv_get(key)
    }

    pub fn kv_put(&self, key: &str, value: &str) -> Result<(), String> {
        self.app_db.kv_put(key, value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_entry(id: &str) -> SaveEntry {
        SaveEntry {
            id: id.to_string(),
            name: "Career".to_string(),
            manager_name: "John Smith".to_string(),
            db_filename: format!("{id}.db"),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            last_played_at: "2026-01-02T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn init_persists_across_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let saves_dir = dir.path().join("saves");
        std::fs::create_dir_all(&saves_dir).unwrap();

        {
            let mut manager = SaveIndexManager::init(&saves_dir).unwrap();
            manager.record_new_save(sample_entry("save-1")).unwrap();
        }

        let manager = SaveIndexManager::init(&saves_dir).unwrap();
        assert_eq!(manager.list_saves().len(), 1);
        assert_eq!(manager.find("save-1").unwrap().id, "save-1");
    }

    #[test]
    fn update_save_returns_err_when_entry_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        let saves_dir = dir.path().join("saves");
        std::fs::create_dir_all(&saves_dir).unwrap();
        let mut manager = SaveIndexManager::init(&saves_dir).unwrap();

        assert!(manager.update_save(sample_entry("ghost")).is_err());
    }

    #[test]
    fn remove_save_returns_outcome() {
        let dir = tempfile::tempdir().unwrap();
        let saves_dir = dir.path().join("saves");
        std::fs::create_dir_all(&saves_dir).unwrap();
        let mut manager = SaveIndexManager::init(&saves_dir).unwrap();

        manager.record_new_save(sample_entry("save-1")).unwrap();
        assert!(manager.remove_save("save-1").unwrap());
        assert!(!manager.remove_save("save-1").unwrap());
    }
}
