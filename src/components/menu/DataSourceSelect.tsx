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
