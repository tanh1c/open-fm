// OPFS sahpool VFS bootstrap — only compiled for wasm32 targets.
//
// Call `install_opfs_sahpool().await` once during app startup before opening any
// SQLite Connection. Idempotent: a second call is a no-op.
//
// Must be invoked from a Web Worker (sahpool relies on
// FileSystemSyncAccessHandle, which is main-thread-blocking).

use std::sync::OnceLock;

use sqlite_wasm_rs::WasmOsCallback;
use sqlite_wasm_vfs::sahpool::{OpfsSAHPoolCfg, install};

static INSTALLED: OnceLock<()> = OnceLock::new();

pub async fn install_opfs_sahpool() -> Result<(), String> {
    if INSTALLED.get().is_some() {
        return Ok(());
    }
    install::<WasmOsCallback>(&OpfsSAHPoolCfg::default(), true)
        .await
        .map_err(|e| format!("be.error.opfs.installFailed:{e}"))?;
    let _ = INSTALLED.set(());
    Ok(())
}
