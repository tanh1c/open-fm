// OPFS sahpool VFS bootstrap — only compiled for wasm32 targets.
//
// `install_opfs_sahpool().await` mounts the VFS once at startup. Subsequent
// calls are no-ops. Must be invoked from a Web Worker because the sahpool VFS
// uses FileSystemSyncAccessHandle which would block the main thread.
//
// We keep the returned `OpfsSAHPoolUtil` in a thread-local so admin actions
// (delete a save, clear all saves) can call back into it. wasm32 is
// single-threaded so `thread_local!` here is just a static cell; the underlying
// JS object is not Send anyway, which is why we can't use a plain OnceLock.

use std::cell::RefCell;

use sqlite_wasm_rs::WasmOsCallback;
use sqlite_wasm_vfs::sahpool::{OpfsSAHPoolCfg, OpfsSAHPoolUtil, install};

thread_local! {
    static POOL_UTIL: RefCell<Option<OpfsSAHPoolUtil>> = const { RefCell::new(None) };
}

pub async fn install_opfs_sahpool() -> Result<(), String> {
    let already_installed = POOL_UTIL.with(|cell| cell.borrow().is_some());
    if already_installed {
        return Ok(());
    }
    let util = install::<WasmOsCallback>(&OpfsSAHPoolCfg::default(), true)
        .await
        .map_err(|e| format!("be.error.opfs.installFailed:{e}"))?;
    POOL_UTIL.with(|cell| *cell.borrow_mut() = Some(util));
    Ok(())
}

/// Delete a single database file from the pool. Returns Ok(false) if the file
/// did not exist. Used by SaveManager::delete_save.
pub fn delete_db(filename: &str) -> Result<bool, String> {
    POOL_UTIL.with(|cell| {
        let cell = cell.borrow();
        let util = cell
            .as_ref()
            .ok_or_else(|| "be.error.opfs.notInstalled".to_string())?;
        util.delete_db(filename)
            .map_err(|e| format!("be.error.opfs.deleteFailed:{e}"))
    })
}

pub fn export_db(filename: &str) -> Result<Vec<u8>, String> {
    POOL_UTIL.with(|cell| {
        let cell = cell.borrow();
        let util = cell
            .as_ref()
            .ok_or_else(|| "be.error.opfs.notInstalled".to_string())?;
        util.export_db(filename)
            .map_err(|e| format!("be.error.opfs.exportFailed:{e}"))
    })
}
