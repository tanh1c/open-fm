import { ArrowLeft, BriefcaseBusiness, ChevronRight, Trophy, X } from "lucide-react";
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
