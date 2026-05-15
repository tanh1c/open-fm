// SaveEntry is now owned by `app_db` so the SQL backend has direct access to it.
// This file is kept as a re-export shim for back-compat with existing imports
// (`crate::save_index::SaveEntry`) so we don't have to touch every call-site.

pub use crate::app_db::SaveEntry;
