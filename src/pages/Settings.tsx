import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettingsStore, AppSettings } from "../store/settingsStore";
import { useGameStore } from "../store/gameStore";
import { useTheme } from "../context/ThemeContext";
import { Select, ThemeToggle } from "../components/ui";
import { SUPPORTED_LANGUAGES, changeAppLanguage } from "../i18n";
import {
  ArrowLeft,
  Download,
  Gamepad2,
  Globe,
  HardDrive,
  Maximize,
  Minimize,
  Monitor,
  Moon,
  Save,
  Sun,
  Trash2,
  Type,
  Zap,
} from "lucide-react";

const CURRENCY_OPTIONS = [
  { value: "EUR", labelKey: "settings.currencyOptions.eur", symbol: "€" },
  { value: "GBP", labelKey: "settings.currencyOptions.gbp", symbol: "£" },
  { value: "USD", labelKey: "settings.currencyOptions.usd", symbol: "$" },
] as const;

const MATCH_MODE_KEYS = ["live", "spectator", "delegate"] as const;
const MATCH_SPEED_KEYS = ["slow", "normal", "fast"] as const;
const COLOR_PRESET_KEYS = ["default", "template"] as const;

interface SettingsProps {
  embedded?: boolean;
}

type SettingsViewTab = "Display" | "Gameplay" | "Saves & Data" | "About";

interface SaveEntry {
  id: string;
  manager_name: string;
  last_played_at: string;
  size_bytes?: number | null;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatSaveSize(bytes?: number | null): string | null {
  if (bytes === undefined || bytes === null) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function parseSaveTime(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function findCurrentSave(saves: SaveEntry[], managerName: string | null): SaveEntry | null {
  const candidates = managerName
    ? saves.filter((save) => save.manager_name === managerName)
    : saves;

  return candidates.reduce<SaveEntry | null>((latest, save) => {
    if (!latest || parseSaveTime(save.last_played_at) > parseSaveTime(latest.last_played_at)) {
      return save;
    }
    return latest;
  }, null);
}

export default function Settings({ embedded = false }: SettingsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { settings, loaded, loadSettings, updateSettings } = useSettingsStore();
  const managerName = useGameStore((state) => state.managerName);
  const { theme, toggleTheme } = useTheme();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [saveDbExportPath, setSaveDbExportPath] = useState<string | null>(null);
  const [isExportingSaveDb, setIsExportingSaveDb] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsViewTab>("Display");
  const [currentSaveSize, setCurrentSaveSize] = useState<string | null>(null);
  const [isLoadingSaveSize, setIsLoadingSaveSize] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );
  const returnTo = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (loaded && settings.language && settings.language !== i18n.language) {
      void changeAppLanguage(settings.language);
    }
  }, [loaded, settings.language, i18n]);

  useEffect(() => {
    if (activeTab !== "Saves & Data") return;

    let cancelled = false;
    setIsLoadingSaveSize(true);

    invoke<SaveEntry[]>("get_saves")
      .then((saves) => {
        if (cancelled) return;
        const currentSave = findCurrentSave(saves, managerName);
        setCurrentSaveSize(formatSaveSize(currentSave?.size_bytes));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load current save size:", err);
        setCurrentSaveSize(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSaveSize(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, managerName]);

  function handleUpdate(partial: Partial<AppSettings>): void {
    updateSettings(partial);

    if (partial.theme) {
      const desired =
        partial.theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : partial.theme;
      if (desired !== theme) toggleTheme();
    }

    if (partial.language) {
      void changeAppLanguage(partial.language);
    }
  }

  async function toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  async function handleClearSaves(): Promise<void> {
    try {
      await invoke("clear_all_saves");
      setClearSuccess(true);
      setConfirmClear(false);
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to clear saves:", err);
    }
  }

  async function handleExportWorld(): Promise<void> {
    try {
      const json = await invoke<string>("export_world_database");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `ofm-world-${stamp}.json`;
      downloadBlob(new Blob([json], { type: "application/json" }), filename);
      setExportPath(filename);
      setTimeout(() => setExportPath(null), 5000);
    } catch (err) {
      console.error("Failed to export world:", err);
    }
  }

  async function handleExportSaveDb(): Promise<void> {
    setIsExportingSaveDb(true);
    try {
      const bytes = await invoke<Uint8Array | number[]>("export_current_save_database");
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const blobBytes = new ArrayBuffer(data.byteLength);
      new Uint8Array(blobBytes).set(data);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `ofm-save-${stamp}.db`;
      downloadBlob(new Blob([blobBytes], { type: "application/vnd.sqlite3" }), filename);
      setSaveDbExportPath(filename);
      setTimeout(() => setSaveDbExportPath(null), 5000);
    } catch (err) {
      console.error("Failed to export save DB:", err);
    } finally {
      setIsExportingSaveDb(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-app-green border-t-transparent" />
      </div>
    );
  }

  const settingsTabs: Array<{ id: SettingsViewTab; label: string }> = [
    { id: "Display", label: t("settings.display") },
    { id: "Gameplay", label: t("settings.gameplay") },
    { id: "Saves & Data", label: t("settings.savesData") },
    { id: "About", label: t("settings.about") },
  ];

  const content = (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          {!embedded ? (
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="rounded-lg p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-app-text">
              {t("settings.title").toUpperCase()}
            </h1>
            <p className="text-sm text-app-text-muted">
              {t("settings.display")} • {t("settings.gameplay")} • {t("settings.savesData")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderChip label={t("settings.theme")} value={t(`settings.themes.${settings.theme}`, { defaultValue: settings.theme })} />
          <HeaderChip label={t("settings.language")} value={settings.language.toUpperCase()} />
          <HeaderChip label={t("settings.currency")} value={settings.currency} />
          {!embedded ? <ThemeToggle /> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              "pb-3 text-[11px] uppercase tracking-wider transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-app-green font-semibold text-app-green"
                : "font-medium text-app-text-muted hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden flex-col gap-4 xl:flex">
          <SummaryCard
            title={t("settings.display")}
            rows={[
              [t("settings.colorPreset"), t(`settings.colorPresets.${settings.color_preset}`)],
              [t("settings.uiScale"), settings.ui_scale.toUpperCase()],
              [t("settings.highContrast"), settings.high_contrast ? t("common.yes", { defaultValue: "On" }) : t("common.no", { defaultValue: "Off" })],
            ]}
          />
          <SummaryCard
            title={t("settings.gameplay")}
            rows={[
              [t("settings.defaultMatchMode"), t(`settings.matchModes.${settings.default_match_mode}`)],
              [t("settings.matchSpeed"), t(`settings.speeds.${settings.match_speed}`)],
              [t("settings.autoSave"), t(`settings.autoSaveModes.${settings.auto_save_mode}`, { defaultValue: settings.auto_save_mode })],
            ]}
          />
          <SummaryCard
            title={t("settings.about")}
            rows={[
              [t("app.name"), t("app.version")],
              [t("app.publisher"), "OpenFM"],
            ]}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          {activeTab === "Display" ? (
          <Section title={t("settings.display")} icon={<Monitor className="h-5 w-5" />}>
            <SettingRow label={t("settings.theme")} description={t("settings.themeDesc")}>
              <SegmentedControl
                options={[
                  { value: "light", icon: <Sun className="h-4 w-4" /> },
                  { value: "dark", icon: <Moon className="h-4 w-4" /> },
                  { value: "system", icon: <Monitor className="h-4 w-4" /> },
                ]}
                value={settings.theme}
                onChange={(v) => handleUpdate({ theme: v as AppSettings["theme"] })}
              />
            </SettingRow>

            <SettingRow label={t("settings.colorPreset")} description={t("settings.colorPresetDesc")}>
              <Select
                value={settings.color_preset}
                onChange={(e) => handleUpdate({ color_preset: e.target.value as AppSettings["color_preset"] })}
                className="min-w-48"
              >
                {COLOR_PRESET_KEYS.map((preset) => (
                  <option key={preset} value={preset}>{t(`settings.colorPresets.${preset}`)}</option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow label={t("settings.language")} description={t("settings.languageDesc")}>
              <Select
                value={settings.language}
                onChange={(e) => handleUpdate({ language: e.target.value })}
                icon={<Globe className="h-4 w-4" />}
                className="min-w-48"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{t(lang.labelKey)}</option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow label={t("settings.currency")} description={t("settings.currencyDesc")}>
              <Select
                value={settings.currency}
                onChange={(e) => handleUpdate({ currency: e.target.value as AppSettings["currency"] })}
                className="min-w-48"
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency.value} value={currency.value}>{currency.symbol} {t(currency.labelKey)}</option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow label={t("settings.uiScale")} description={t("settings.uiScaleDesc")}>
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-app-text-muted" />
                <SegmentedControl
                  options={[
                    { value: "small", label: "S" },
                    { value: "normal", label: "M" },
                    { value: "large", label: "L" },
                    { value: "xlarge", label: "XL" },
                  ]}
                  value={settings.ui_scale}
                  onChange={(v) => handleUpdate({ ui_scale: v as AppSettings["ui_scale"] })}
                />
              </div>
            </SettingRow>

            <SettingRow label={t("settings.highContrast")} description={t("settings.highContrastDesc")}>
              <Toggle checked={settings.high_contrast} onChange={(v) => handleUpdate({ high_contrast: v })} />
            </SettingRow>

            <SettingRow label={t("settings.fullscreen")} description={t("settings.fullscreenDesc")}>
              <ActionButton onClick={() => void toggleFullscreen()}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                {isFullscreen ? t("settings.exitFullscreen") : t("settings.enterFullscreen")}
              </ActionButton>
            </SettingRow>
          </Section>
          ) : null}

          {activeTab === "Gameplay" ? (
          <Section title={t("settings.gameplay")} icon={<Gamepad2 className="h-5 w-5" />}>
            <SettingRow label={t("settings.defaultMatchMode")} description={t("settings.defaultMatchModeDesc")}>
              <Select
                value={settings.default_match_mode}
                onChange={(e) => handleUpdate({ default_match_mode: e.target.value as AppSettings["default_match_mode"] })}
                className="min-w-48"
              >
                {MATCH_MODE_KEYS.map((mode) => (
                  <option key={mode} value={mode}>{t(`settings.matchModes.${mode}`)}</option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow label={t("settings.matchSpeed")} description={t("settings.matchSpeedDesc")}>
              <SegmentedControl
                options={MATCH_SPEED_KEYS.map((speed) => ({ value: speed, label: t(`settings.speeds.${speed}`) }))}
                value={settings.match_speed}
                onChange={(v) => handleUpdate({ match_speed: v as AppSettings["match_speed"] })}
              />
            </SettingRow>

            <SettingRow label={t("settings.matchCommentary")} description={t("settings.matchCommentaryDesc")}>
              <Toggle checked={settings.show_match_commentary} onChange={(v) => handleUpdate({ show_match_commentary: v })} />
            </SettingRow>

            <SettingRow label={t("settings.confirmAdvance")} description={t("settings.confirmAdvanceDesc")}>
              <Toggle checked={settings.confirm_advance} onChange={(v) => handleUpdate({ confirm_advance: v })} />
            </SettingRow>

            <SettingRow label={t("settings.godMode", { defaultValue: "God Mode" })} description={t("settings.godModeDesc", { defaultValue: "Reveal every player's real attributes and unlock player editing." })}>
              <Toggle checked={settings.god_mode} onChange={(v) => handleUpdate({ god_mode: v })} />
            </SettingRow>
          </Section>
          ) : null}

          {activeTab === "Saves & Data" ? (
          <Section title={t("settings.savesData")} icon={<Save className="h-5 w-5" />}>
            <SettingRow label={t("settings.autoSave")} description={t("settings.autoSaveDesc")}>
              <SegmentedControl
                options={[
                  { value: "off", label: t("settings.autoSaveModes.off", { defaultValue: "Off" }) },
                  { value: "matchday", label: t("settings.autoSaveModes.matchday", { defaultValue: "Matchday" }) },
                  { value: "always", label: t("settings.autoSaveModes.always", { defaultValue: "Always" }) },
                ]}
                value={settings.auto_save_mode}
                onChange={(v) => handleUpdate({ auto_save_mode: v as AppSettings["auto_save_mode"] })}
              />
            </SettingRow>

            <SettingRow
              label={t("settings.currentSaveSize", { defaultValue: "Current save size" })}
              description={t("settings.currentSaveSizeDesc", { defaultValue: "Storage used by the save file for the active career." })}
            >
              <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider text-app-text">
                <HardDrive className="h-4 w-4 text-app-green" />
                {isLoadingSaveSize
                  ? t("common.loading", { defaultValue: "Loading" })
                  : currentSaveSize ?? t("common.unavailable", { defaultValue: "Unavailable" })}
              </div>
            </SettingRow>

            <SettingRow
              label={t("settings.exportSaveDb", { defaultValue: "Export Save DB" })}
              description={t("settings.exportSaveDbDesc", { defaultValue: "Download the active career as a raw SQLite database for diagnostics or backup." })}
            >
              <ActionButton onClick={() => void handleExportSaveDb()} tone="success" disabled={isExportingSaveDb}>
                <Download className="h-4 w-4" />
                {isExportingSaveDb
                  ? t("common.loading", { defaultValue: "Loading" })
                  : t("settings.exportDb", { defaultValue: "Export DB" })}
              </ActionButton>
            </SettingRow>
            {saveDbExportPath ? (
              <p className="-mt-2 ml-1 text-xs text-app-green">
                {t("settings.exportedTo", { path: saveDbExportPath })}
              </p>
            ) : null}

            <SettingRow label={t("settings.exportWorld")} description={t("settings.exportWorldDesc")}>
              <ActionButton onClick={() => void handleExportWorld()} tone="success">
                <Download className="h-4 w-4" />
                {t("settings.export")}
              </ActionButton>
            </SettingRow>
            {exportPath ? (
              <p className="-mt-2 ml-1 text-xs text-app-green">
                {t("settings.exportedTo", { path: exportPath })}
              </p>
            ) : null}

            <div className="mt-2 border-t border-app-border pt-4">
              <SettingRow label={t("settings.clearSaves")} description={t("settings.clearSavesDesc")} danger>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleClearSaves()}
                      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600"
                    >
                      {t("common.confirm")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg border border-app-border bg-app-bg px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : clearSuccess ? (
                  <span className="text-sm font-heading font-bold uppercase tracking-wider text-app-green">
                    {t("settings.savesCleared")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("settings.clear")}
                  </button>
                )}
              </SettingRow>
            </div>
          </Section>
          ) : null}

          {activeTab === "About" ? (
          <Section title={t("settings.about")} icon={<Zap className="h-5 w-5" />}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-app-text">{t("app.name")}</p>
                <p className="mt-0.5 text-xs text-app-text-muted">{t("app.version")}</p>
              </div>
              <span className="text-[10px] font-heading uppercase tracking-widest text-app-text-muted">
                {t("app.publisher")}
              </span>
            </div>
          </Section>
          ) : null}
        </section>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <div className="min-h-screen bg-app-bg p-6 text-app-text">{content}</div>;
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
      {label} <span className="font-bold text-app-text">{value}</span>
    </div>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-card p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-app-text-muted">{label}</span>
            <span className="font-bold text-app-text">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card">
      <div className="flex items-center gap-2 border-b border-app-border px-5 py-4">
        <span className="text-app-green">{icon}</span>
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-app-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-5 px-5 py-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, danger, children }: { label: string; description: string; danger?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-app-border/50 bg-app-bg px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <p className={cx("text-sm font-medium", danger ? "text-red-500" : "text-app-text")}>{label}</p>
        <p className="mt-0.5 text-xs text-app-text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ActionButton({ children, onClick, tone = "neutral", disabled = false }: { children: ReactNode; onClick: () => void; tone?: "neutral" | "success"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        tone === "success"
          ? "bg-app-green/10 text-app-green hover:bg-app-green/20 disabled:hover:bg-app-green/10"
          : "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text disabled:hover:bg-app-card disabled:hover:text-app-text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 rounded-full transition-colors duration-200",
        checked ? "bg-app-green" : "bg-app-border",
      )}
    >
      <div
        className={cx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SegmentedControl({ options, value, onChange }: { options: Array<{ value: string; label?: string; icon?: ReactNode }>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-app-border bg-app-bg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wider transition-all",
            value === option.value
              ? "bg-app-green/10 text-app-green shadow-sm"
              : "text-app-text-muted hover:text-app-text",
          )}
        >
          {option.icon}
          {option.label || option.value}
        </button>
      ))}
    </div>
  );
}
