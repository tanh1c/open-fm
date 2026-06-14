# Export Active Save DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings button that downloads the currently active web save as a raw SQLite `.db` file for inspection.

**Architecture:** Expose a WASM AppHandle command that reads the active save database bytes from SaveManager, then download those bytes from the Settings page using a Blob. Keep the existing JSON world export unchanged.

**Tech Stack:** Rust/WASM via `wasm_bindgen`, existing SaveManager/OPFS SQLite storage, React/TypeScript Settings page, generated engine command map.

---

### Task 1: Add raw save DB export in backend

**Files:**
- Modify: `src-engine/crates/db/src/save_manager.rs`
- Modify: `src-engine/crates/db/src/opfs.rs`
- Modify: `src-engine/src/app_handle/game.rs`

- [ ] Add `SaveManager::export_save_database(&mut self, save_id: &str) -> Result<Vec<u8>, String>`.
  - Native path reads `self.saves_dir.join(&entry.db_filename)`.
  - Wasm path reads from OPFS via a new `crate::opfs::export_db(&entry.db_filename)` helper.
  - Missing save returns `be.error.save.notFound`.

- [ ] Add `opfs::export_db(filename: &str) -> Result<Vec<u8>, String>` for wasm builds using the installed sahpool utility if supported by the current `sqlite_wasm_vfs` API.

- [ ] Add `#[wasm_bindgen(js_name = exportCurrentSaveDatabase)] pub fn export_current_save_database(&self) -> Result<JsValue, JsValue>` in `src-engine/src/app_handle/game.rs`.
  - It gets the current save id from `self.state.get_save_id()`.
  - It locks SaveManager and calls `export_save_database`.
  - It returns bytes as `js_sys::Uint8Array` or a serde-compatible byte vector.

### Task 2: Wire command and Settings download UI

**Files:**
- Modify: `src/core/engineCommands.generated.ts` or regenerate it if build tooling is available.
- Modify: `src/pages/Settings.tsx`
- Modify: `src/i18n/index.ts`

- [ ] Add command mapping: `export_current_save_database: { method: "exportCurrentSaveDatabase", args: [] as const }`.

- [ ] Add Settings state for DB export success/error/loading.

- [ ] Add `handleExportSaveDb()` that calls `invoke<number[] | Uint8Array>("export_current_save_database")`, creates `new Blob([bytes], { type: "application/vnd.sqlite3" })`, and downloads `ofm-save-<timestamp>.db`.

- [ ] Add a second row in Saves & Data labelled `Export Save DB`, leaving `Export World JSON` unchanged.

- [ ] Add i18n keys for English/Vietnamese if the existing file stores both languages inline.

### Task 3: Verify

**Files:**
- Test/verify existing build outputs.

- [ ] Run `npm run build:engine` if needed to regenerate WASM bindings and engine command map.

- [ ] Run `npm run build` to verify frontend TypeScript/build.

- [ ] If Rust-only compile is needed, run `cargo check --manifest-path "src-engine/Cargo.toml"`.

- [ ] Manually verify `/settings` shows both export buttons and the DB button downloads a `.db` file.

---

## Self-review

- Spec coverage: active save `.db` export is covered backend-to-frontend.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: frontend command name maps to `exportCurrentSaveDatabase`; snake-case invoke name is `export_current_save_database`.
