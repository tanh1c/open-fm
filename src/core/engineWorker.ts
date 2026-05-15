/// <reference lib="webworker" />
//
// engineWorker.ts — runs the Rust/WASM AppHandle off the UI thread.
//
// We expose a single `call(method, args)` dispatcher rather than enumerating
// every AppHandle method, so adding a new #[wasm_bindgen] export on the Rust
// side becomes zero-config. The main thread builds a typed Proxy on top.

import { expose } from "comlink";
import init, { AppHandle } from "../../wasm-pkg-app/openfootmanager_lib.js";

let handle: AppHandle | null = null;

const api = {
  /** Boot the engine. Idempotent — safe to call repeatedly. */
  async ready(): Promise<void> {
    if (handle) return;
    await init();
    handle = await AppHandle.init();
  },

  /**
   * Dispatch a call to AppHandle. The main thread's Proxy resolves a property
   * access to a function that posts `(method, args)` here.
   *
   * `method` is the JS-side camelCase name (matches `js_name` in #[wasm_bindgen]).
   * `args` is the positional argument list, in the order the Rust method declares.
   */
  async call(method: string, args: unknown[]): Promise<unknown> {
    if (!handle) {
      throw new Error("engineWorker.ready() must be awaited before commands");
    }
    const fn = (handle as unknown as Record<string, (...a: unknown[]) => unknown>)[method];
    if (typeof fn !== "function") {
      throw new Error(`engineWorker.call: unknown AppHandle method '${method}'`);
    }
    return fn.apply(handle, args);
  },
};

export type EngineApi = typeof api;

expose(api);
