// Verify the rusqlite-on-wasm spike actually works at runtime.
import * as wasm from "../src-tauri/db-wasm-pkg/db_wasm_spike.js";

const t0 = performance.now();
const count = wasm.spike_open_and_query();
const t1 = performance.now();

console.log("=== rusqlite WASM spike ===");
console.log(`row count: ${count}`);
console.log(`elapsed:   ${(t1 - t0).toFixed(2)} ms`);
