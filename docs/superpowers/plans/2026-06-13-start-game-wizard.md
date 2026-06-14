# Start Game Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat new-game world selector with a wizard flow: Manager → Game Mode → Data Source → Team Selection.

**Architecture:** Keep backend world-source IDs unchanged and map the new frontend choices to existing sources in `MainMenu.tsx`. Split the setup UI into focused menu components, then simplify `TeamSelection.tsx` so World Cup saves use `Confederation → National Team` while club saves keep `Country → Division → Club`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri invoke bridge, Zustand game store, Tailwind utility classes.

---

## File Structure

- Modify: `src/pages/MainMenu.tsx`
  - Owns high-level menu state, manager form state, selected game mode, selected data source, imported custom JSON, and start-game command invocation.
- Create: `src/components/menu/GameModeSelect.tsx`
  - Displays `Club Career` and `World Cup 2026` cards.
- Create: `src/components/menu/DataSourceSelect.tsx`
  - Displays `Generated` and `FC26 Real` cards, mode-specific descriptions, and Club-only custom import.
- Keep: `src/components/menu/WorldSelect.tsx`
  - Do not delete in this pass. It may still be useful for old references or future cleanup, but `MainMenu.tsx` should stop using it for built-in new-game flow.
- Modify: `src/pages/MainMenu.test.tsx`
  - Replace mocked `WorldSelect` assumptions with wizard assertions and world-source mapping tests.
- Modify: `src/pages/TeamSelection.tsx`
  - Preserve club flow, add direct World Cup confederation-to-team rendering, and de-emphasize club-only stats for World Cup cards.
- Create: `src/pages/TeamSelection.test.tsx`
  - Cover club flow, World Cup shortened flow, and World Cup FC26 call-up transition.

---

### Task 1: Add focused wizard components

**Files:**
- Create: `src/components/menu/GameModeSelect.tsx`
- Create: `src/components/menu/DataSourceSelect.tsx`

- [ ] **Step 1: Create `GameModeSelect.tsx`**

Write this file:

```tsx
import { ArrowLeft, BriefcaseBusiness, ChevronRight, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";

export type GameMode = "club" | "worldcup";

interface GameModeSelectProps {
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
  onClose: () => void;
  onContinue: () => void;
}

const GAME_MODE_OPTIONS: Array<{
  id: GameMode;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "club",
    title: "Club Career",
    description: "Long-term club management with leagues, transfers, finances, youth, and staff.",
    icon: BriefcaseBusiness,
  },
  {
    id: "worldcup",
    title: "World Cup 2026",
    description: "Standalone 48-country national-team tournament.",
    icon: Trophy,
  },
];

export default function GameModeSelect({
  selectedMode,
  onSelectMode,
  onBack,
  onClose,
  onContinue,
}: GameModeSelectProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-surface-600 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.24em] text-primary-500">
              Step 2 / 4
            </p>
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-gray-900 transition-colors dark:text-white">
              Choose Game Mode
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-surface-600 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3">
        {GAME_MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedMode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectMode(option.id)}
              className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                selected
                  ? "border-primary-400 bg-primary-50 ring-1 ring-primary-400/30 dark:border-primary-500 dark:bg-primary-500/10"
                  : "border-gray-200 bg-white hover:border-primary-300 dark:border-surface-600 dark:bg-surface-700 dark:hover:border-primary-500/60"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  selected
                    ? "bg-primary-500 text-white"
                    : "bg-primary-500/10 text-primary-500 dark:text-primary-400"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-heading text-lg font-bold uppercase tracking-wide ${
                    selected ? "text-primary-700 dark:text-primary-300" : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {option.title}
                </span>
                <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                  {option.description}
                </span>
              </span>
              {selected && <span className="mt-1 h-3 w-3 rounded-full bg-primary-500" />}
            </button>
          );
        })}
      </div>

      <Button variant="primary" size="lg" className="w-full" iconRight={<ChevronRight />} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `DataSourceSelect.tsx`**

Write this file:

```tsx
import { useRef } from "react";
import { ArrowLeft, ChevronRight, Database, Loader2, Shuffle, Upload, X } from "lucide-react";
import { Button } from "../ui";
import type { GameMode } from "./GameModeSelect";

export type DataSource = "generated" | "fc26";

interface DataSourceSelectProps {
  selectedMode: GameMode;
  selectedDataSource: DataSource;
  importedWorldName: string | null;
  isStarting: boolean;
  onSelectDataSource: (dataSource: DataSource) => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImport: () => void;
  onBack: () => void;
  onClose: () => void;
  onStart: () => void;
}

const DATA_SOURCE_OPTIONS: Array<{
  id: DataSource;
  title: string;
  icon: typeof Shuffle;
}> = [
  { id: "generated", title: "Generated", icon: Shuffle },
  { id: "fc26", title: "FC26 Real", icon: Database },
];

function dataSourceDescription(mode: GameMode, dataSource: DataSource): string {
  if (mode === "club" && dataSource === "generated") {
    return "Generated football world with fictional players and clubs.";
  }
  if (mode === "club" && dataSource === "fc26") {
    return "Real FC26 player dataset and club squads.";
  }
  if (mode === "worldcup" && dataSource === "generated") {
    return "Generated national-team squads for all 48 countries.";
  }
  return "FC26 real players plus call-up selection for countries with deep pools.";
}

export default function DataSourceSelect({
  selectedMode,
  selectedDataSource,
  importedWorldName,
  isStarting,
  onSelectDataSource,
  onImportFile,
  onClearImport,
  onBack,
  onClose,
  onStart,
}: DataSourceSelectProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showImport = selectedMode === "club";

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-surface-600 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.24em] text-primary-500">
              Step 3 / 4
            </p>
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-gray-900 transition-colors dark:text-white">
              Choose Data Source
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-surface-600 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3">
        {DATA_SOURCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedDataSource === option.id && !importedWorldName;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectDataSource(option.id)}
              className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                selected
                  ? "border-primary-400 bg-primary-50 ring-1 ring-primary-400/30 dark:border-primary-500 dark:bg-primary-500/10"
                  : "border-gray-200 bg-white hover:border-primary-300 dark:border-surface-600 dark:bg-surface-700 dark:hover:border-primary-500/60"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  selected
                    ? "bg-primary-500 text-white"
                    : "bg-primary-500/10 text-primary-500 dark:text-primary-400"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-heading text-lg font-bold uppercase tracking-wide ${
                    selected ? "text-primary-700 dark:text-primary-300" : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {option.title}
                </span>
                <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                  {dataSourceDescription(selectedMode, option.id)}
                </span>
              </span>
              {selected && <span className="mt-1 h-3 w-3 rounded-full bg-primary-500" />}
            </button>
          );
        })}
      </div>

      {showImport && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 dark:border-surface-600 dark:bg-surface-700/70">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.24em] text-gray-400">
            Advanced
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-surface-600 dark:text-gray-400 dark:hover:border-primary-500 dark:hover:text-primary-400"
            >
              <Upload className="h-4 w-4" />
              <span className="font-heading font-bold uppercase tracking-wider">
                {importedWorldName ? `Imported: ${importedWorldName}` : "Import custom world JSON"}
              </span>
            </button>
            {importedWorldName && (
              <button
                type="button"
                onClick={onClearImport}
                className="text-xs font-heading font-bold uppercase tracking-wider text-gray-400 hover:text-red-500"
              >
                Clear imported world
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onImportFile} />
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        iconRight={isStarting ? <Loader2 className="animate-spin" /> : <ChevronRight />}
        onClick={onStart}
        disabled={isStarting}
      >
        {isStarting ? "Creating World" : "Start Game"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript for new files**

Run:

```bash
npx tsc --noEmit
```

Expected: it may fail because `MainMenu.tsx` does not use the new components yet, but it must not report syntax/type errors inside the two new component files.

---

### Task 2: Refactor MainMenu to use the wizard

**Files:**
- Modify: `src/pages/MainMenu.tsx`
- Modify: `src/pages/MainMenu.test.tsx`

- [ ] **Step 1: Update `MainMenu.test.tsx` to expect wizard mapping**

Remove the `WorldSelect` mock block:

```tsx
vi.mock("../components/menu/WorldSelect", () => ({
  default: ({
    onSelectWorld,
    onStart,
  }: {
    onSelectWorld: (id: string) => void;
    onStart: () => void;
  }) => (
    <div data-testid="world-select">
      <button type="button" onClick={() => onSelectWorld("fc26_real")}>
        select-fc26
      </button>
      <button type="button" onClick={onStart}>
        start-world
      </button>
    </div>
  ),
}));
```

Add helpers below `selectNationality`:

```tsx
async function completeManagerStep(nationalityCode = "ENG"): Promise<void> {
  await openCreateManagerForm();
  fillManagerDetails();
  await selectNationality("en", nationalityCode);
  fireEvent.click(screen.getByText("createManager.chooseWorld"));
}

async function chooseModeAndData(modeLabel: RegExp, dataLabel: RegExp): Promise<void> {
  await screen.findByText("Choose Game Mode");
  fireEvent.click(screen.getByRole("button", { name: modeLabel }));
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
  await screen.findByText("Choose Data Source");
  fireEvent.click(screen.getByRole("button", { name: dataLabel }));
  fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));
}
```

Replace the old `stores the nationality as an ISO code...` continuation assertions with:

```tsx
fireEvent.click(screen.getByText("createManager.chooseWorld"));
expect(await screen.findByText("Choose Game Mode")).toBeInTheDocument();

await chooseModeAndData(/Club Career/i, /Generated/i);

await waitFor(() => {
  expect(mockedInvoke).toHaveBeenCalledWith(
    "start_new_game",
    expect.objectContaining({
      firstName: "Ada",
      lastName: "Lovelace",
      dob: "1980-01-01",
      nationality: "ES",
      worldSource: "random",
    }),
  );
});
```

Replace the test named `passes the selected built-in world source when starting a game` with parameterized coverage:

```tsx
it.each([
  { mode: /Club Career/i, data: /Generated/i, worldSource: "random" },
  { mode: /Club Career/i, data: /FC26 Real/i, worldSource: "fc26_real" },
  { mode: /World Cup 2026/i, data: /Generated/i, worldSource: "worldcup2026" },
  { mode: /World Cup 2026/i, data: /FC26 Real/i, worldSource: "worldcup2026_fc26" },
])("maps $worldSource from the setup wizard", async ({ mode, data, worldSource }) => {
  render(<MainMenu />);

  await completeManagerStep("ENG");
  await chooseModeAndData(mode, data);

  await waitFor(() => {
    expect(mockedInvoke).toHaveBeenCalledWith(
      "start_new_game",
      expect.objectContaining({
        nationality: "ENG",
        worldSource,
      }),
    );
  });
});
```

Update expectations that currently reference `list_world_databases` or `world-select`:

```tsx
expect(mockedInvoke).not.toHaveBeenCalledWith("list_world_databases");
expect(screen.queryByText("Choose Game Mode")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the MainMenu test to verify failure**

Run:

```bash
npx vitest run src/pages/MainMenu.test.tsx
```

Expected: FAIL because `MainMenu.tsx` still renders `WorldSelect` and does not expose `Choose Game Mode` / `Choose Data Source`.

- [ ] **Step 3: Update `MainMenu.tsx` imports and state**

Replace the WorldSelect import/type usage:

```tsx
import type { WorldDatabaseInfo } from "../components/menu/WorldSelect";
const WorldSelect = lazy(() => import("../components/menu/WorldSelect"));
```

with:

```tsx
import GameModeSelect, { type GameMode } from "../components/menu/GameModeSelect";
import DataSourceSelect, { type DataSource } from "../components/menu/DataSourceSelect";
```

Change state definitions:

```tsx
const [menuState, setMenuState] = useState<"main" | "create" | "load">("main");
const [newGameStep, setNewGameStep] = useState<"manager" | "mode" | "data">("manager");
const [selectedGameMode, setSelectedGameMode] = useState<GameMode>("club");
const [selectedDataSource, setSelectedDataSource] = useState<DataSource>("generated");
const [importedWorldName, setImportedWorldName] = useState<string | null>(null);
```

Remove:

```tsx
const [worldDatabases, setWorldDatabases] = useState<WorldDatabaseInfo[]>([]);
const [selectedWorldId, setSelectedWorldId] = useState<string>("random");
const [isLoadingWorlds, setIsLoadingWorlds] = useState(false);
```

Add resolver near constants:

```tsx
function resolveWorldSource(mode: GameMode, dataSource: DataSource): string {
  if (mode === "club" && dataSource === "generated") return "random";
  if (mode === "club" && dataSource === "fc26") return "fc26_real";
  if (mode === "worldcup" && dataSource === "generated") return "worldcup2026";
  return "worldcup2026_fc26";
}
```

- [ ] **Step 4: Update wizard transitions in `MainMenu.tsx`**

Replace `handleGoToWorldSelect` body end:

```tsx
setMenuState("world");
loadWorldDatabases();
```

with:

```tsx
setMenuState("create");
setNewGameStep("mode");
```

Delete the entire `loadWorldDatabases` function.

Add reset helper:

```tsx
const closeNewGameFlow = () => {
  setMenuState("main");
  setNewGameStep("manager");
  setFormErrors({});
  setImportedWorldName(null);
  sessionStorage.removeItem("imported_world_json");
};
```

- [ ] **Step 5: Update import handling in `MainMenu.tsx`**

In `handleImportFile`, after `sessionStorage.setItem("imported_world_json", json);`, replace world database updates:

```tsx
setWorldDatabases((prev) => {
  const filtered = prev.filter((d) => d.source !== "imported");
  return [...filtered, info];
});
setSelectedWorldId(info.id);
```

with:

```tsx
setImportedWorldName(info.name);
```

Add:

```tsx
const clearImportedWorld = () => {
  sessionStorage.removeItem("imported_world_json");
  setImportedWorldName(null);
};
```

- [ ] **Step 6: Update `handleStartGame` in `MainMenu.tsx`**

Replace the imported JSON check:

```tsx
const importedJson =
  selectedWorldId.startsWith("file:") &&
  sessionStorage.getItem("imported_world_json");
```

with:

```tsx
const importedJson = selectedGameMode === "club" && sessionStorage.getItem("imported_world_json");
const worldSource = resolveWorldSource(selectedGameMode, selectedDataSource);
```

Replace `worldSource: selectedWorldId` with:

```tsx
worldSource,
```

After `sessionStorage.removeItem("imported_world_json");`, add:

```tsx
setImportedWorldName(null);
```

- [ ] **Step 7: Update `MainMenu.tsx` render branches**

Replace:

```tsx
{menuState === "create" && (
  <Suspense fallback={<MenuPanelFallback />}>
    <CreateManagerForm ... />
  </Suspense>
)}

{menuState === "world" && (
  <Suspense fallback={<MenuPanelFallback />}>
    <WorldSelect ... />
  </Suspense>
)}
```

with:

```tsx
{menuState === "create" && newGameStep === "manager" && (
  <Suspense fallback={<MenuPanelFallback />}>
    <CreateManagerForm
      formData={formData}
      formErrors={formErrors}
      dobError={dobDisplayedError}
      onChange={updateFormField}
      onClearError={clearFormError}
      onRandomize={randomizeManager}
      onClose={closeNewGameFlow}
      onSubmit={handleGoToWorldSelect}
    />
  </Suspense>
)}

{menuState === "create" && newGameStep === "mode" && (
  <GameModeSelect
    selectedMode={selectedGameMode}
    onSelectMode={(mode) => {
      setSelectedGameMode(mode);
      if (mode === "worldcup") {
        clearImportedWorld();
      }
    }}
    onBack={() => setNewGameStep("manager")}
    onClose={closeNewGameFlow}
    onContinue={() => setNewGameStep("data")}
  />
)}

{menuState === "create" && newGameStep === "data" && (
  <DataSourceSelect
    selectedMode={selectedGameMode}
    selectedDataSource={selectedDataSource}
    importedWorldName={importedWorldName}
    isStarting={isStarting}
    onSelectDataSource={(dataSource) => {
      setSelectedDataSource(dataSource);
      clearImportedWorld();
    }}
    onImportFile={handleImportFile}
    onClearImport={clearImportedWorld}
    onBack={() => setNewGameStep("mode")}
    onClose={closeNewGameFlow}
    onStart={handleStartGame}
  />
)}
```

- [ ] **Step 8: Run MainMenu test**

Run:

```bash
npx vitest run src/pages/MainMenu.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

---

### Task 3: Simplify World Cup TeamSelection flow

**Files:**
- Modify: `src/pages/TeamSelection.tsx`
- Create: `src/pages/TeamSelection.test.tsx`

- [ ] **Step 1: Create `TeamSelection.test.tsx` with desired behavior**

Write this file:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { GameStateData } from "../store/gameStore";
import TeamSelection from "./TeamSelection";

const navigateMock = vi.fn();
const setGameStateMock = vi.fn();
const setGameActiveMock = vi.fn();
let gameState: GameStateData | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "teamSelect.manage") return `Manage ${params?.name}`;
      if (key === "teamSelect.seats") return "stadium seats";
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../components/ui", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TeamLocation: ({ city }: { city: string }) => <span>{city}</span>,
  ThemeToggle: () => <div data-testid="theme-toggle" />,
  CountryFlag: ({ code }: { code: string }) => <span data-testid={`flag-${code}`} />,
}));

vi.mock("../components/common/DivisionLogo", () => ({
  default: () => <div data-testid="division-logo" />,
}));

vi.mock("../components/common/TeamLogo", () => ({
  default: ({ team }: any) => <div data-testid={`team-logo-${team.id}`} />,
}));

vi.mock("../store/gameStore", () => ({
  useGameStore: () => ({
    gameState,
    setGameState: setGameStateMock,
    setGameActive: setGameActiveMock,
  }),
}));

const mockedInvoke = vi.mocked(invoke);

function createGameState(worldSource?: string): GameStateData {
  return {
    world_source: worldSource,
    clock: {
      current_date: "2026-07-10T12:00:00Z",
      start_date: "2026-07-01T12:00:00Z",
    },
    manager: {
      id: "manager-1",
      first_name: "Ada",
      last_name: "Lovelace",
      date_of_birth: "1980-01-01",
      nationality: "ENG",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: null,
      career_stats: { matches_managed: 0, wins: 0, draws: 0, losses: 0, trophies: 0, best_finish: null },
      career_history: [],
    },
    teams: [
      {
        id: worldSource?.startsWith("worldcup2026") ? "wc26-uefa-eng" : "club-1",
        name: worldSource?.startsWith("worldcup2026") ? "England" : "Alpha FC",
        short_name: worldSource?.startsWith("worldcup2026") ? "ENG" : "ALP",
        country: "ENG",
        city: worldSource?.startsWith("worldcup2026") ? "England" : "London",
        stadium_name: "National Stadium",
        stadium_capacity: 60000,
        finance: 1000000,
        manager_id: null,
        reputation: 800,
        wage_budget: 0,
        transfer_budget: 0,
        season_income: 0,
        season_expenses: 0,
        formation: "4-4-2",
        play_style: "Balanced",
        training_focus: "General",
        training_intensity: "Balanced",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#000", secondary: "#fff" },
        starting_xi_ids: [],
        form: [],
        history: [],
      },
    ],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  };
}

describe("TeamSelection", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setGameStateMock.mockReset();
    setGameActiveMock.mockReset();
    mockedInvoke.mockReset();
    gameState = createGameState();
  });

  it("keeps the club career country to division to club flow", () => {
    render(<TeamSelection />);

    expect(screen.getByText("Country")).toBeInTheDocument();
    expect(screen.getByText("Division")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Choose country")).toBeInTheDocument();

    fireEvent.click(screen.getByText("England"));
    expect(screen.getByText("Choose division")).toBeInTheDocument();
  });

  it("uses a direct confederation to national team flow for World Cup mode", () => {
    gameState = createGameState("worldcup2026");

    render(<TeamSelection />);

    expect(screen.getByText("Confederation")).toBeInTheDocument();
    expect(screen.getByText("National Team")).toBeInTheDocument();
    expect(screen.queryByText("Tournament")).not.toBeInTheDocument();
    expect(screen.getByText("Choose confederation")).toBeInTheDocument();

    fireEvent.click(screen.getByText("UEFA"));

    expect(screen.getByText("Choose national team")).toBeInTheDocument();
    expect(screen.getByText("England")).toBeInTheDocument();
    expect(screen.queryByText("Choose group")).not.toBeInTheDocument();
  });

  it("opens call-up selection after selecting a World Cup FC26 national team", async () => {
    gameState = createGameState("worldcup2026_fc26");
    mockedInvoke.mockResolvedValue([
      ...Array.from({ length: 27 }, (_, index) => ({
        id: `player-${index}`,
        full_name: `Player ${index}`,
        match_name: `P${index}`,
        position: index < 3 ? "Goalkeeper" : "Striker",
        ovr: 70,
        age: 24,
        club: "Club",
        nationality: "England",
      })),
    ]);

    render(<TeamSelection />);

    fireEvent.click(screen.getByText("UEFA"));
    fireEvent.click(screen.getByText("England"));
    fireEvent.click(screen.getByRole("button", { name: /Manage ENG/i }));

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("get_worldcup_callup_pool", { teamId: "wc26-uefa-eng" });
    });
    expect(await screen.findByText(/World Cup call-up/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run TeamSelection test to verify failure**

Run:

```bash
npx vitest run src/pages/TeamSelection.test.tsx
```

Expected: FAIL because World Cup mode still includes the intermediate tournament/division step.

- [ ] **Step 3: Add direct World Cup selection helpers in `TeamSelection.tsx`**

After `selectedCountryGroup`, add:

```tsx
const worldCupTeams = selectedCountryGroup?.tiers.flatMap((group) => group.teams) ?? [];
const showWorldCupTeams = isWorldCupMode && selectedCountryGroup && !callupPool;
const showClubDivisions = selectedCountryGroup && !selectedTierGroup && !isWorldCupMode;
const showClubTeams = !isWorldCupMode && selectedTierGroup;
```

Update `SelectionSteps` props:

```tsx
<SelectionSteps
  country={selectedCountryGroup?.country ?? null}
  division={isWorldCupMode ? null : selectedTierGroup?.leagueName ?? null}
  team={selectedTeam?.name ?? null}
  countryLabel={isWorldCupMode ? "Confederation" : "Country"}
  divisionLabel={isWorldCupMode ? null : "Division"}
  teamLabel={isWorldCupMode ? "National Team" : "Team"}
  onCountryClick={resetToCountries}
  onDivisionClick={isWorldCupMode ? undefined : resetToDivisions}
/>
```

Change `SelectionSteps` signature to allow null division:

```tsx
function SelectionSteps({
  country,
  division,
  team,
  countryLabel,
  divisionLabel,
  teamLabel,
  onCountryClick,
  onDivisionClick,
}: {
  country: string | null;
  division: string | null;
  team: string | null;
  countryLabel: string;
  divisionLabel: string | null;
  teamLabel: string;
  onCountryClick: () => void;
  onDivisionClick?: () => void;
}) {
  const columns = divisionLabel ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-800">
      <div className={`grid grid-cols-1 gap-3 ${columns}`}>
        <StepButton label={countryLabel} value={country ?? `Choose ${countryLabel.toLowerCase()}`} active={!country} complete={Boolean(country)} onClick={onCountryClick} />
        {divisionLabel && (
          <StepButton label={divisionLabel} value={division ?? `Choose ${divisionLabel.toLowerCase()}`} active={Boolean(country && !division)} complete={Boolean(division)} onClick={country ? onDivisionClick : undefined} />
        )}
        <StepButton label={teamLabel} value={team ?? `Choose ${teamLabel.toLowerCase()}`} active={Boolean(country && (!divisionLabel || division) && !team)} complete={Boolean(team)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace World Cup intermediate tier rendering**

Change this condition:

```tsx
{selectedCountryGroup && !selectedTierGroup && (
```

To:

```tsx
{showClubDivisions && (
```

Add a new section before the call-up panel condition:

```tsx
{showWorldCupTeams && (
  <section className="space-y-4">
    <SectionHeading
      eyebrow="Step 2"
      title="Choose national team"
      subtitle={`Select the country you want to manage from ${selectedCountryGroup.country}.`}
    />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {worldCupTeams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const avgOvr = getTeamAvgOvr(team.id);
        const repInfo = getReputationLabel(team.reputation);
        const playerCount = getTeamPlayers(team.id).length;

        return (
          <button
            key={team.id}
            onClick={() => setSelectedTeamId(team.id)}
            className={`rounded-xl text-left transition-all duration-200 ${
              isSelected ? "scale-[1.02] ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-surface-900" : "hover:scale-[1.01]"
            }`}
          >
            <Card accent={isSelected ? "primary" : "none"} className="h-full !bg-white dark:!bg-app-card">
              <div className={`rounded-t-xl p-4 ${isSelected ? "bg-gradient-to-r from-primary-600 to-primary-700" : "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-surface-700 dark:to-surface-800"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TeamLogo team={team} selected={isSelected} />
                    <div>
                      <h3 className={`font-heading text-sm font-bold uppercase tracking-wide ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                        {team.name}
                      </h3>
                      <TeamLocation
                        city={team.city}
                        countryCode={team.country}
                        locale={i18n.language}
                        className={`mt-0.5 text-xs ${isSelected ? "text-gray-300" : "text-gray-500 dark:text-gray-300"}`}
                        iconClassName="h-3 w-3"
                        flagClassName="text-xs leading-none"
                      />
                    </div>
                  </div>
                  {isSelected && <Star className="h-5 w-5 fill-current text-accent-400" />}
                </div>
              </div>
              <CardBody className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatItem icon={<Trophy className="h-3.5 w-3.5" />} label={t("teamSelect.reputation")} value={<Badge variant={repInfo.variant} size="sm">{repInfo.label}</Badge>} />
                  <StatItem icon={<Users className="h-3.5 w-3.5" />} label={t("teamSelect.squad")} value={<span className="font-heading font-bold text-gray-800 dark:text-gray-200">{playerCount}</span>} />
                  <StatItem icon={<Database className="h-3.5 w-3.5" />} label="Data" value={<Badge variant="primary" size="sm">{isWorldCupFc26 ? "FC26 Real" : "Generated"}</Badge>} />
                  <StatItem icon={<Star className="h-3.5 w-3.5" />} label={t("teamSelect.avgOvr")} value={<span className={`font-heading text-lg font-bold ${avgOvr >= 70 ? "text-primary-500" : avgOvr >= 55 ? "text-accent-600 dark:text-accent-400" : "text-gray-500"}`}>{avgOvr}</span>} />
                </div>
              </CardBody>
            </Card>
          </button>
        );
      })}
    </div>
  </section>
)}
```

Add `Database` to the lucide import list at the top.

- [ ] **Step 5: Restrict existing team section to club mode**

Change:

```tsx
) : selectedTierGroup && (
```

To:

```tsx
) : showClubTeams && (
```

- [ ] **Step 6: Run TeamSelection test**

Run:

```bash
npx vitest run src/pages/TeamSelection.test.tsx
```

Expected: PASS.

---

### Task 4: Full frontend verification

**Files:**
- Modify only if tests reveal necessary fixes:
  - `src/pages/MainMenu.tsx`
  - `src/components/menu/GameModeSelect.tsx`
  - `src/components/menu/DataSourceSelect.tsx`
  - `src/pages/TeamSelection.tsx`
  - `src/pages/MainMenu.test.tsx`
  - `src/pages/TeamSelection.test.tsx`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npx vitest run src/pages/MainMenu.test.tsx src/pages/TeamSelection.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual UI smoke test**

Run:

```bash
npm run dev
```

Expected: Vite starts and prints a local URL.

Manually verify:

1. New Game → manager form → Club Career → Generated → reaches `/select-team` with club flow.
2. New Game → manager form → Club Career → FC26 Real → reaches `/select-team` with club flow.
3. New Game → manager form → World Cup 2026 → Generated → reaches `/select-team` with `Confederation → National Team` flow.
4. New Game → manager form → World Cup 2026 → FC26 Real → reaches `/select-team`, selecting a deep national team opens call-up selection.
5. Club Career data step shows custom import; World Cup data step does not show custom import.

Stop the dev server after the smoke test.

---

## Self-Review

- Spec coverage: The plan covers MainMenu wizard flow, world-source mapping, custom import preservation, TeamSelection World Cup simplification, FC26 call-up preservation, and verification.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `GameMode` and `DataSource` are defined in menu components and imported by MainMenu; `world_source` IDs match the approved spec exactly.
