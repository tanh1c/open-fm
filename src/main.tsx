import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import { bootstrap as bootstrapEngine } from "./core/wasmCore";
import { i18nReady } from "./i18n";
import App from "./App";

const rootElement = document.getElementById("root") as HTMLElement | null;

if (!rootElement) {
  throw new Error("Missing root element");
}

const root = ReactDOM.createRoot(rootElement);

function dismissSplash() {
  const splash = document.getElementById("ofm-splash");
  if (!splash) return;
  splash.classList.add("is-leaving");
  // Remove after the CSS transition completes so it doesn't intercept clicks.
  setTimeout(() => splash.remove(), 280);
}

function renderApp() {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}

// Engine bootstrap runs in parallel with i18n. We wait for *both* before
// rendering so service calls from the first screen don't race the worker init —
// the engine bundle is much larger than the i18n chunk, so this is the gating
// step. The HTML splash stays visible until React mounts.
//
// Bootstrap errors are NOT swallowed: if the engine fails to start (OPFS not
// supported, COOP/COEP missing, etc.) we still render so the user can see the
// app shell, but each service call will reject with the original error so the
// failure is visible in the UI rather than producing a cryptic "ready not
// awaited" downstream.
void Promise.all([
  i18nReady.catch((error) => {
    console.error("[bootstrap] i18n init failed:", error);
  }),
  bootstrapEngine().catch((error) => {
    console.error(
      "[bootstrap] engine WASM init failed — service calls will reject:",
      error,
    );
  }),
]).finally(() => {
  renderApp();
  dismissSplash();
});
