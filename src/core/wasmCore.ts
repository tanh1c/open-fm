// wasmCore.ts — main-thread shim for the engine Web Worker.
//
// Two surfaces:
//   1. `engine` — a typed Proxy. Use this from new code:
//        const { engine } = await import("@/core/wasmCore");
//        const game = await engine.startNewGame(firstName, lastName, dob, nationality);
//   2. `invoke()` — a Tauri-compatible shim that forwards
//        invoke('snake_case_cmd', { camelCaseArg })
//      to the worker via auto-derived camelCase method + positional argv.
//      Lets existing services (50+ files) keep their imports unchanged.
//
// Lifecycle: `await bootstrap()` once at app start (main.tsx). Every call
// dispatched here awaits `bootstrapPromise` first so callers don't have to
// guess about timing — if the worker init failed, callers get the underlying
// error instead of a cryptic "must be awaited" message from the worker.

import { wrap, type Remote } from "comlink";
import type { EngineApi } from "./engineWorker";
import { ENGINE_COMMANDS } from "./engineCommands.generated";

let workerProxy: Remote<EngineApi> | null = null;
let bootstrapPromise: Promise<void> | null = null;

const ENGINE_WORKER_KEY = "__ofmEngineWorker";

type WindowWithEngineWorker = Window & {
  [ENGINE_WORKER_KEY]?: Worker;
};

function terminateExistingWorker(): void {
  const globalWindow = typeof window === "undefined" ? null : (window as WindowWithEngineWorker);
  globalWindow?.[ENGINE_WORKER_KEY]?.terminate();
  if (globalWindow) {
    delete globalWindow[ENGINE_WORKER_KEY];
  }
}

function spawnWorker(): Worker {
  terminateExistingWorker();
  const worker = new Worker(new URL("./engineWorker.ts", import.meta.url), {
    type: "module",
    name: "ofm-engine",
  });
  if (typeof window !== "undefined") {
    (window as WindowWithEngineWorker)[ENGINE_WORKER_KEY] = worker;
  }
  return worker;
}

export async function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const worker = spawnWorker();
    const proxy = wrap<EngineApi>(worker);
    // Only publish the proxy *after* ready() succeeds — if init fails (no OPFS,
    // FileSystemSyncAccessHandle missing, etc.) we want callers to see the
    // original error, not a worker-side "handle is null" downstream.
    await proxy.ready();
    workerProxy = proxy;
  })();
  return bootstrapPromise;
}

export function isReady(): boolean {
  return workerProxy !== null;
}

// ---------------------------------------------------------------------------
// Generic call dispatcher
// ---------------------------------------------------------------------------

export async function callEngine<T = unknown>(
  method: string,
  args: unknown[] = [],
): Promise<T> {
  if (!bootstrapPromise) {
    throw new Error(
      "engine not bootstrapped — call bootstrap() in main.tsx before any service",
    );
  }
  // Await the in-flight bootstrap so we surface its real error if it failed,
  // and so calls issued before bootstrap finishes queue up correctly.
  await bootstrapPromise;
  if (!workerProxy) {
    throw new Error("engine bootstrap reported success but worker proxy is missing");
  }
  const result = await workerProxy.call(method, args);
  return result as T;
}

// ---------------------------------------------------------------------------
// Typed engine.* proxy
// ---------------------------------------------------------------------------

type AnyMethod = (...args: unknown[]) => Promise<unknown>;

/**
 * `engine.someMethodName(...args)` calls AppHandle.someMethodName on the worker.
 * Method names match the `js_name` in #[wasm_bindgen] (camelCase).
 */
export const engine = new Proxy({} as Record<string, AnyMethod>, {
  get(_target, prop): AnyMethod {
    if (typeof prop !== "string" || prop === "then") {
      // `then` is probed by JS engines when the proxy is awaited; return undefined
      // so it doesn't get treated as a thenable.
      return undefined as unknown as AnyMethod;
    }
    return (...args) => callEngine(prop, args);
  },
});

// ---------------------------------------------------------------------------
// Tauri-compatible invoke() shim
// ---------------------------------------------------------------------------

/**
 * Tauri's invoke() takes a flat object of named args:
 *   invoke('start_new_game', { firstName, lastName, dob, nationality })
 * Our AppHandle method takes positional args, so we look up the canonical
 * argument order from the generated `ENGINE_COMMANDS` map.
 *
 * `ENGINE_COMMANDS` is auto-derived from the wasm-pack `.d.ts` by
 * `scripts/generate-engine-commands.mjs` and is regenerated as part of every
 * engine build, so adding a new Rust command is zero-config on the JS side
 * after the next build.
 */
export async function invoke<T = unknown>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const spec = ENGINE_COMMANDS[command];
  if (!spec) {
    throw new Error(
      `invoke('${command}'): unknown engine command. Run \`npm run build:engine\` to refresh src/core/engineCommands.generated.ts.`,
    );
  }
  const argv = spec.args.map((key) => args[key]);
  return callEngine<T>(spec.method, argv);
}
