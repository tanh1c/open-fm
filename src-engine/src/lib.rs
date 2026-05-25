// openfootmanager — WASM-only library entry point.
//
// `application/` holds business logic services that are reused across multiple
// commands. `app_handle/` is the single #[wasm_bindgen] entry surface exposed
// to JS. Per-domain command bindings live in submodules and are added through
// additional `#[wasm_bindgen] impl AppHandle` blocks.

#[cfg(target_arch = "wasm32")]
pub mod app_handle;
pub mod application;
