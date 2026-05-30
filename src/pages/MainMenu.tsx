import { Suspense, lazy, useCallback, useState } from "react";
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
  game_date?: string | null;
}

/**
 * Minimum manager age (years) on create — historical rule, unchanged here on purpose.
 * Opinion (retraca, git 1631b76): this floor should probably be removed or lowered (~18);
 * leaving as-is until product agrees.
 */
const MANAGER_MINIMUM_AGE = 30;
const DEFAULT_WORLD_TEAM_COUNT = 248;
const DEFAULT_WORLD_PLAYER_COUNT = 5456;

const RANDOM_MANAGER_FIRST_NAMES = [
  "Alex",
  "Marco",
  "Daniel",
  "Lucas",
  "Julien",
  "Thomas",
  "Rafael",
  "Nico",
];
const RANDOM_MANAGER_LAST_NAMES = [
  "Morgan",
  "Silva",
  "Keller",
  "Moretti",
  "Dubois",
  "Santos",
  "Hughes",
  "Rossi",
];
const RANDOM_MANAGER_NATIONALITIES = ["ENG", "ES", "IT", "FR", "DE", "PT", "NL", "BE"];

function pickRandom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomManagerDob(): string {
  const today = new Date();
  const age = 30 + Math.floor(Math.random() * 36);
  const year = today.getFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
  const appName = t("app.name");

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

  // Memoised so DatePicker's useEffect doesn't see a fresh callback every
  // render — without useCallback, that effect re-runs forever and the form
  // hits React's "Maximum update depth exceeded" guard.
  const updateFormField = useCallback(
    (field: keyof CreateManagerFormData, value: string) => {
      setFormData((previous) => ({
        ...previous,
        [field]: value,
      }));
    },
    [],
  );

  const clearFormError = useCallback(
    (field: keyof CreateManagerFormData) => {
      setFormErrors((previous) => ({
        ...previous,
        [field]: "",
      }));
    },
    [],
  );

  const randomizeManager = useCallback(() => {
    setFormData({
      firstName: pickRandom(RANDOM_MANAGER_FIRST_NAMES),
      lastName: pickRandom(RANDOM_MANAGER_LAST_NAMES),
      dob: randomManagerDob(),
      nationality: pickRandom(RANDOM_MANAGER_NATIONALITIES),
    });
    setFormErrors({});
  }, []);

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
          team_count: DEFAULT_WORLD_TEAM_COUNT,
          player_count: DEFAULT_WORLD_PLAYER_COUNT,
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
      const importedJson =
        selectedWorldId.startsWith("file:") &&
        sessionStorage.getItem("imported_world_json");

      const game = importedJson
        ? await invoke<GameStateData>("start_new_game_with_world", {
            firstName: formData.firstName,
            lastName: formData.lastName,
            dob: formData.dob,
            nationality: formData.nationality,
            worldJson: importedJson,
          })
        : await invoke<GameStateData>("start_new_game", {
            firstName: formData.firstName,
            lastName: formData.lastName,
            dob: formData.dob,
            nationality: formData.nationality,
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
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-emerald-50 transition-colors duration-500 dark:bg-[#071510]">
      {/* Football pitch background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-70"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1440 900"
        >
          <defs>
            <linearGradient id="menuPitchGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="rgb(187 247 208)" className="dark:[stop-color:#052e1b]" />
              <stop offset="0.5" stopColor="rgb(34 197 94)" className="dark:[stop-color:#0f5f35]" />
              <stop offset="1" stopColor="rgb(220 252 231)" className="dark:[stop-color:#052516]" />
            </linearGradient>
            <pattern id="menuPitchStripes" width="180" height="900" patternUnits="userSpaceOnUse">
              <rect width="90" height="900" className="fill-white/22 dark:fill-white/[0.045]" />
              <rect x="90" width="90" height="900" className="fill-emerald-900/5 dark:fill-black/[0.06]" />
            </pattern>
          </defs>
          <rect width="1440" height="900" fill="url(#menuPitchGradient)" />
          <rect width="1440" height="900" fill="url(#menuPitchStripes)" />
          <g fill="none" className="stroke-emerald-950/22 dark:stroke-white/35" strokeWidth="4">
            <rect x="92" y="72" width="1256" height="756" rx="18" />
            <line x1="720" y1="72" x2="720" y2="828" />
            <circle cx="720" cy="450" r="112" />
            <circle cx="720" cy="450" r="7" className="fill-emerald-950/35 dark:fill-white/55" stroke="none" />
            <rect x="92" y="284" width="176" height="332" />
            <rect x="92" y="360" width="64" height="180" />
            <path d="M268 352a112 112 0 0 1 0 196" />
            <rect x="1172" y="284" width="176" height="332" />
            <rect x="1284" y="360" width="64" height="180" />
            <path d="M1172 352a112 112 0 0 0 0 196" />
          </g>
        </svg>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.34),transparent_34%),linear-gradient(90deg,rgba(236,253,245,0.82),rgba(255,255,255,0.22),rgba(236,253,245,0.82))] dark:bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.16),transparent_34%),linear-gradient(90deg,rgba(2,6,23,0.82),rgba(2,6,23,0.38),rgba(2,6,23,0.82))]" />
        <div className="absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-emerald-300/40 blur-3xl dark:bg-primary-400/20" />
        <div className="absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-lime-300/35 blur-3xl dark:bg-accent-400/20" />
      </div>

      {/* Theme Toggle */}
      <ThemeToggle className="absolute top-6 right-6 z-20" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="rounded-[2rem] border border-white/35 bg-white/90 p-2 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl dark:border-white/15 dark:bg-surface-900/86 dark:shadow-black/40">
          <div className="rounded-[1.45rem] border border-white/50 bg-white/85 p-8 shadow-inner shadow-white/20 transition-all duration-500 dark:border-white/10 dark:bg-surface-800/90">
          {/* Logo */}
          <div className="flex items-center justify-center gap-5 rounded-2xl border border-primary-500/15 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-400/10 p-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/80 shadow-lg shadow-primary-950/10 ring-1 ring-primary-500/15 dark:bg-white/10">
              <img
                src="/openfootlogo.svg"
                alt={appName}
                className="h-20 w-20 object-contain"
              />
            </div>
            <div>
              <h1 className="font-heading text-4xl font-semibold uppercase leading-none tracking-wider text-gray-900 dark:text-white">
                OPEN FUTBALL
              </h1>
              <h1 className="font-heading text-5xl font-bold uppercase leading-none tracking-wider text-accent-500 dark:text-accent-400">
                MANAGER
              </h1>
            </div>
          </div>

          <div className="my-7 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent transition-colors duration-500" />

          {/* Main Menu */}
          {menuState === "main" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMenuState("create")}
                className="group flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white shadow-lg shadow-primary-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-primary-400 hover:to-primary-600 hover:shadow-xl hover:shadow-primary-500/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <PlusCircle className="w-6 h-6" />
                  </span>
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.newGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={handleOpenLoadMenu}
                className="group flex w-full items-center justify-between rounded-2xl border border-gray-200/80 bg-white/80 p-4 text-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-400 hover:bg-white hover:shadow-lg dark:border-white/10 dark:bg-surface-700/80 dark:text-gray-200 dark:hover:border-accent-400 dark:hover:bg-surface-700"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 ring-1 ring-accent-500/20">
                    <FolderOpen className="w-6 h-6 text-accent-500 dark:text-accent-400" />
                  </span>
                  <span className="font-heading font-bold text-lg uppercase tracking-wide">
                    {t("menu.loadGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-accent-500" />
              </button>

              <button
                onClick={() => navigate("/settings", { state: { from: "/" } })}
                className="group flex w-full items-center justify-between rounded-2xl border border-gray-200/80 bg-white/80 p-4 text-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-white hover:shadow-lg dark:border-white/10 dark:bg-surface-700/80 dark:text-gray-200 dark:hover:border-surface-500 dark:hover:bg-surface-700"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-500/10 ring-1 ring-gray-500/15">
                    <Settings className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </span>
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
                className="group flex w-full items-center justify-between rounded-2xl border border-gray-200/80 bg-white/80 p-4 text-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:shadow-lg dark:border-white/10 dark:bg-surface-700/80 dark:text-gray-200 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/15">
                    <Power className="w-6 h-6 text-red-500 dark:text-red-400" />
                  </span>
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
                onRandomize={randomizeManager}
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
      </div>

      {/* Version */}
      <div className="absolute bottom-4 right-4 text-gray-400 dark:text-gray-600 text-xs font-heading uppercase tracking-widest transition-colors">
        {t("app.version")}
      </div>
    </div>
  );
}
