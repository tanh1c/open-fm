import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./settingsStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const DEFAULT_SETTINGS = {
  theme: "dark",
  language: "en",
  currency: "EUR",
  default_match_mode: "live",
  auto_save: true,
  match_speed: "normal",
  show_match_commentary: true,
  confirm_advance: false,
  ui_scale: "normal",
  high_contrast: false,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    loaded: false,
  });
});

describe("useSettingsStore", () => {
  it("starts with default settings and an unloaded flag", () => {
    const state = useSettingsStore.getState();

    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.loaded).toBe(false);
  });

  it("loads settings from the backend and merges missing fields with defaults", async () => {
    vi.mocked(invoke).mockResolvedValue({
      language: "es",
      confirm_advance: true,
    });

    await useSettingsStore.getState().loadSettings();

    expect(invoke).toHaveBeenCalledWith("get_settings");
    expect(useSettingsStore.getState().loaded).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual({
      ...DEFAULT_SETTINGS,
      language: "es",
      confirm_advance: true,
    });
  });

  it("falls back to default settings when loading fails", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("boom"));

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().loaded).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it("optimistically merges updates and persists the merged settings", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        language: "pt",
      },
      loaded: true,
    });

    await useSettingsStore.getState().updateSettings({ currency: "USD", high_contrast: true });

    expect(useSettingsStore.getState().settings).toEqual({
      ...DEFAULT_SETTINGS,
      language: "pt",
      currency: "USD",
      high_contrast: true,
    });
    expect(invoke).toHaveBeenCalledWith("save_settings", {
      settings: {
        ...DEFAULT_SETTINGS,
        language: "pt",
        currency: "USD",
        high_contrast: true,
      },
    });
  });

  it("rolls back the local update when saving fails and reports the error", async () => {
    const error = new Error("save failed");
    vi.mocked(invoke).mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        match_speed: "normal",
      },
      loaded: true,
    });

    await useSettingsStore.getState().updateSettings({ match_speed: "fast" });

    expect(useSettingsStore.getState().settings.match_speed).toBe("normal");
    expect(consoleError).toHaveBeenCalledWith("Failed to save settings:", error);

    consoleError.mockRestore();
  });
});
