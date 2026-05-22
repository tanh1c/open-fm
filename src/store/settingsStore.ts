import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  theme: "dark" | "light" | "system";
  language: string;
  currency: "EUR" | "GBP" | "USD";
  default_match_mode: "live" | "spectator" | "delegate";
  auto_save: boolean;
  match_speed: "slow" | "normal" | "fast";
  show_match_commentary: boolean;
  confirm_advance: boolean;
  ui_scale: "small" | "normal" | "large" | "xlarge";
  high_contrast: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
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
};

function mergeWithDefaultSettings(settings: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function persistSettings(settings: AppSettings) {
  await invoke("save_settings", { settings });
}

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: mergeWithDefaultSettings(),
  loaded: false,

  loadSettings: async () => {
    try {
      const s = await invoke<Partial<AppSettings>>("get_settings");
      set({ settings: mergeWithDefaultSettings(s), loaded: true });
    } catch {
      set({ settings: mergeWithDefaultSettings(), loaded: true });
    }
  },

  updateSettings: async (partial) => {
    const previousSettings = get().settings;
    const merged = mergeWithDefaultSettings({ ...previousSettings, ...partial });
    set({ settings: merged });
    try {
      await persistSettings(merged);
    } catch (err) {
      set({ settings: previousSettings });
      console.error("Failed to save settings:", err);
    }
  },
}));
