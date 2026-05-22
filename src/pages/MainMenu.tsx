import { Suspense, lazy, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore, GameStateData } from "../store/gameStore";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import type { CreateManagerFormData } from "../components/menu/CreateManagerForm";
import type { WorldDatabaseInfo } from "../components/menu/WorldSelect";
import { resolveBackendError } from "../utils/backendI18n";
import {
  FolderOpen,
  Settings,
  PlusCircle,
  ChevronRight,
  Power,
} from "lucide-react";

const CreateManagerForm = lazy(
  () => import("../components/menu/CreateManagerForm"),
);
const SavesList = lazy(() => import("../components/menu/SavesList"));
const WorldSelect = lazy(() => import("../components/menu/WorldSelect"));

interface SaveEntry {
  id: string;
  name: string;
  manager_name: string;
  db_filename: string;
  checksum: string;
  created_at: string;
  last_played_at: string;
}

/**
 * Minimum manager age (years) on create — historical rule, unchanged here on purpose.
 * Opinion (retraca, git 1631b76): this floor should probably be removed or lowered (~18);
 * leaving as-is until product agrees.
 */
const MANAGER_MINIMUM_AGE = 30;

function flooredAgeFromIsoDate(isoDob: string): number | null {
  if (!isoDob) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDob);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() > month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return Number.isNaN(age) ? null : age;
}

const CREATE_MANAGER_FIELD_ORDER = [
  "firstName",
  "lastName",
  "dob",
  "nationality",
] as const satisfies ReadonlyArray<keyof CreateManagerFormData>;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusFirstCreateManagerError(
  errors: Partial<Record<keyof CreateManagerFormData, string>>,
): void {
  const first = CREATE_MANAGER_FIELD_ORDER.find((k) => errors[k]);
  if (!first) return;
  const root = document.getElementById(`create-manager-field-${first}`);
  root?.scrollIntoView?.({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  const focusable = root?.querySelector<HTMLElement>(
    "input:not([type=hidden]), button:not([disabled]), select, textarea",
  );
  focusable?.focus({ preventScroll: true });
}

function MenuPanelFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const setGameActive = useGameStore((state) => state.setGameActive);
  const setGameState = useGameStore((state) => state.setGameState);
  const { t } = useTranslation();

  const [menuState, setMenuState] = useState<
    "main" | "create" | "world" | "load"
  >("main");
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const [formData, setFormData] = useState<CreateManagerFormData>({
    firstName: "",
    lastName: "",
    dob: "",
    nationality: "",
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CreateManagerFormData, string>>
  >({});

  // World database state
  const [worldDatabases, setWorldDatabases] = useState<WorldDatabaseInfo[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("random");
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(false);

  /** Same messages as `validateForm` for DOB, so the age rule surfaces as the user edits. */
  const dobLiveRuleMessage = (() => {
    if (!formData.dob) return null;
    const age = flooredAgeFromIsoDate(formData.dob);
    if (age === null) return t("validation.invalidDate");
    if (age < MANAGER_MINIMUM_AGE)
      return t("validation.minAge", { min: MANAGER_MINIMUM_AGE });
    if (age > 99) return t("validation.invalidDob");
    return null;
  })();
  const dobDisplayedError = formErrors.dob || dobLiveRuleMessage;

  const updateFormField = (field: keyof CreateManagerFormData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const clearFormError = (field: keyof CreateManagerFormData) => {
    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const validateForm = (): {
    ok: boolean;
    errors: Partial<Record<keyof CreateManagerFormData, string>>;
  } => {
    const errors: Partial<Record<keyof CreateManagerFormData, string>> = {};
    if (!formData.firstName.trim()) {
      errors.firstName = t("validation.required", {
        field: t("createManager.firstName"),
      });
    } else if (formData.firstName.length > 30) {
      errors.firstName = t("validation.maxLength", {
        field: t("createManager.firstName"),
        max: 30,
      });
    }

    if (!formData.lastName.trim()) {
      errors.lastName = t("validation.required", {
        field: t("createManager.lastName"),
      });
    } else if (formData.lastName.length > 30) {
      errors.lastName = t("validation.maxLength", {
        field: t("createManager.lastName"),
        max: 30,
      });
    }

    if (!formData.dob) {
      errors.dob = t("validation.required", { field: t("createManager.dob") });
    } else {
      const age = flooredAgeFromIsoDate(formData.dob);
      if (age === null) {
        errors.dob = t("validation.invalidDate");
      } else if (age < MANAGER_MINIMUM_AGE) {
        errors.dob = t("validation.minAge", { min: MANAGER_MINIMUM_AGE });
      } else if (age > 99) {
        errors.dob = t("validation.invalidDob");
      }
    }
    if (!formData.nationality)
      errors.nationality = t("validation.required", {
        field: t("createManager.countryOfOrigin"),
      });
    setFormErrors(errors);
    return {
      ok: Object.keys(errors).length === 0,
      errors,
    };
  };

  const handleGoToWorldSelect = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm();
    if (!validation.ok) {
      requestAnimationFrame(() =>
        focusFirstCreateManagerError(validation.errors),
      );
      return;
    }
    setMenuState("world");
    loadWorldDatabases();
  };

  const loadWorldDatabases = async () => {
    setIsLoadingWorlds(true);
    try {
      const dbs = await invoke<WorldDatabaseInfo[]>("list_world_databases");
      setWorldDatabases(dbs);
    } catch (error) {
      console.error("Failed to load world databases:", error);
      // Always have random available even if scan fails
      setWorldDatabases([
        {
          id: "random",
          name: t("worldSelect.randomWorld"),
          description: t("worldSelect.randomDescription"),
          team_count: 8,
          player_count: 160,
          source: "builtin",
          path: "",
        },
      ]);
    } finally {
      setIsLoadingWorlds(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = reader.result as string;
        const parsed = JSON.parse(json);
        const info: WorldDatabaseInfo = {
          id: `file:${file.name}`,
          name: parsed.name || file.name.replace(".json", ""),
          description: parsed.description || t("menu.importedDescription"),
          team_count: parsed.teams?.length ?? 0,
          player_count: parsed.players?.length ?? 0,
          source: "imported",
          path: "", // will use the parsed data directly
        };
        // Store the raw JSON in sessionStorage so we can write it to a temp path
        sessionStorage.setItem("imported_world_json", json);
        setWorldDatabases((prev) => {
          const filtered = prev.filter((d) => d.source !== "imported");
          return [...filtered, info];
        });
        setSelectedWorldId(info.id);
      } catch (err) {
        alert(t("menu.invalidWorldDb", { error: String(err) }));
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      // Determine world source
      let worldSource: string | undefined = selectedWorldId;
      if (selectedWorldId === "random") {
        worldSource = undefined;
      } else if (
        selectedWorldId.startsWith("file:") &&
        sessionStorage.getItem("imported_world_json")
      ) {
        // For imported files, write to a temp location first
        const json = sessionStorage.getItem("imported_world_json")!;
        // Write it via a temp file approach — just pass "random" and override
        // Actually, better to write the file to user databases dir first
        const path = await invoke<string>("write_temp_database", {
          json,
        }).catch(() => null);
        if (path) {
          worldSource = `file:${path}`;
        } else {
          // Fallback: pass the imported data inline — won't work with current backend
          // So fall back to random
          worldSource = undefined;
          console.warn(
            "Could not write imported database, falling back to random",
          );
        }
      }

      const game = await invoke<GameStateData>("start_new_game", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        nationality: formData.nationality,
        worldSource,
      });
      sessionStorage.removeItem("imported_world_json");
      setGameState(game);
      navigate("/select-team");
    } catch (error) {
      console.error("Failed to start game:", error);
      alert(
        t("menu.failedStartGame", {
          error: resolveBackendError(error),
        }),
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleOpenLoadMenu = async () => {
    setMenuState("load");
    setIsLoadingSaves(true);
    try {
      const dbSaves = await invoke<SaveEntry[]>("get_saves");
      setSaves(dbSaves);
    } catch (error) {
      console.error("Failed to load saves:", error);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleLoadGame = async (saveId: string) => {
    setLoadingSaveId(saveId);
    try {
      const managerName = await invoke<string>("load_game", { saveId });
      setGameActive(true, managerName);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to load game:", error);
      setLoadingSaveId(null);
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      await invoke<boolean>("delete_save", { saveId });
      setSaves((prev) => prev.filter((s) => s.id !== saveId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete save:", error);
    }
  };

  const handleExitApp = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await getCurrentWindow().destroy();
    } catch (error) {
      console.error("Failed to exit app:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-navy-900 transition-colors duration-500 relative overflow-x-hidden">
      {/* Background gradient accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-400/10 dark:bg-accent-400/5 rounded-full blur-3xl" />
      </div>

      {/* Theme Toggle */}
      <ThemeToggle className="absolute top-6 right-6 z-20" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary-500 via-accent-400 to-primary-500 rounded-t-2xl" />

        <div className="bg-white dark:bg-navy-800 p-8 rounded-b-2xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-navy-600 border-t-0 transition-all duration-500">
          {/* Logo */}
          <img
            src="/openfootlogo.svg"
            alt={t("app.name")}
            className="text-center w-full h-full object-cover"
          />

          <div className="border-t border-gray-200 dark:border-navy-600 my-8 transition-colors duration-500" />

          {/* Main Menu */}
          {menuState === "main" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMenuState("create")}
                className="group flex items-center justify-between w-full p-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-primary-500/20"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-6 h-6" />
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.newGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={handleOpenLoadMenu}
                className="group flex items-center justify-between w-full p-4 bg-white dark:bg-navy-700 hover:bg-gray-50 dark:hover:bg-navy-600 text-gray-800 dark:text-gray-200 rounded-xl transition-all duration-300 border border-gray-200 dark:border-navy-600 hover:border-accent-400 dark:hover:border-accent-400 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-accent-500 dark:text-accent-400" />
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.loadGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-accent-500" />
              </button>

              <button
                onClick={() => navigate("/settings", { state: { from: "/" } })}
                className="group flex items-center justify-between w-full p-4 bg-white dark:bg-navy-700 hover:bg-gray-50 dark:hover:bg-navy-600 text-gray-800 dark:text-gray-200 rounded-xl transition-all duration-300 border border-gray-200 dark:border-navy-600 hover:border-gray-300 dark:hover:border-navy-600 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.settings")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-gray-400" />
              </button>

              <button
                onClick={() => {
                  void handleExitApp();
                }}
                className="group flex items-center justify-between w-full p-4 bg-white dark:bg-navy-700 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-800 dark:text-gray-200 rounded-xl transition-all duration-300 border border-gray-200 dark:border-navy-600 hover:border-red-200 dark:hover:border-red-500/30 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Power className="w-6 h-6 text-red-500 dark:text-red-400" />
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.exitGame")}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Step 1: Create Manager Form */}
          {menuState === "create" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <CreateManagerForm
                formData={formData}
                formErrors={formErrors}
                dobError={dobDisplayedError}
                onChange={updateFormField}
                onClearError={clearFormError}
                onClose={() => {
                  setMenuState("main");
                  setFormErrors({});
                }}
                onSubmit={handleGoToWorldSelect}
              />
            </Suspense>
          )}

          {/* Step 2: World Database Selection */}
          {menuState === "world" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <WorldSelect
                worldDatabases={worldDatabases}
                selectedWorldId={selectedWorldId}
                isLoadingWorlds={isLoadingWorlds}
                isStarting={isStarting}
                onSelectWorld={setSelectedWorldId}
                onImportFile={handleImportFile}
                onStart={handleStartGame}
                onBack={() => setMenuState("create")}
                onClose={() => setMenuState("main")}
              />
            </Suspense>
          )}

          {/* Load Game List */}
          {menuState === "load" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <SavesList
                loadingSaveId={loadingSaveId}
                saves={saves}
                isLoading={isLoadingSaves}
                confirmDeleteId={confirmDeleteId}
                onLoad={handleLoadGame}
                onDelete={handleDeleteSave}
                onConfirmDelete={setConfirmDeleteId}
                onClose={() => setMenuState("main")}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-4 right-4 text-gray-400 dark:text-gray-600 text-xs font-heading uppercase tracking-widest transition-colors">
        {t("app.version")}
      </div>
    </div>
  );
}
