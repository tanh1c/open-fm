// appWindow.ts — web shim for the Tauri @tauri-apps/api/window APIs we used.
//
// Tauri's getCurrentWindow() exposed `destroy()` (close native window) and
// `onCloseRequested()` (intercept close). On the web there's no app window —
// the closest equivalents are `window.close()` (only works when this tab was
// opened by script) and the `beforeunload` event (browser still owns the
// final UX, so we can only *warn*, not veto).
//
// Behaviour mapping:
//   destroy()             → window.close() — best-effort. Browser may ignore;
//                            the user-facing "exit" UI then degrades to a hint.
//   onCloseRequested(cb)  → beforeunload listener. The callback is fired with
//                            an event object that has .preventDefault(); when
//                            called we set returnValue so the browser shows
//                            its native "leave site?" prompt.
//
// Returns the same Promise<unlisten>() shape Tauri's API uses, so call-sites
// can stay unchanged.

export interface CloseRequestedEvent {
  preventDefault: () => void;
}

export interface AppWindow {
  destroy: () => Promise<void>;
  onCloseRequested: (
    handler: (event: CloseRequestedEvent) => void | Promise<void>,
  ) => Promise<() => void>;
}

class WebAppWindow implements AppWindow {
  async destroy(): Promise<void> {
    window.close();
  }

  onCloseRequested(
    handler: (event: CloseRequestedEvent) => void | Promise<void>,
  ): Promise<() => void> {
    const listener = (browserEvent: BeforeUnloadEvent) => {
      let blocked = false;
      const event: CloseRequestedEvent = {
        preventDefault: () => {
          blocked = true;
        },
      };
      // Don't await — beforeunload doesn't allow async work to delay close.
      void handler(event);
      if (blocked) {
        browserEvent.preventDefault();
        // Legacy browsers need a non-empty returnValue.
        browserEvent.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return Promise.resolve(() => {
      window.removeEventListener("beforeunload", listener);
    });
  }
}

const instance = new WebAppWindow();

export function getCurrentWindow(): AppWindow {
  return instance;
}
