import { Crosshair, Flag, RefreshCw, Shield, Target, Zap } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  FORMATIONS,
  PLAY_STYLE_DESCRIPTION_FALLBACKS,
} from "./TacticsTab.helpers";

interface PlayStyleOption {
  icon: ReactNode;
  id: string;
}

interface TacticsSetupPanelProps {
  activePlayStyle: string;
  formation: string;
  onFormationChange: (formation: string) => void;
  onPlayStyleChange: (playStyle: string) => void;
}

const PLAY_STYLES: PlayStyleOption[] = [
  { id: "Balanced", icon: <Target className="h-3.5 w-3.5" /> },
  { id: "Attacking", icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "Defensive", icon: <Shield className="h-3.5 w-3.5" /> },
  { id: "Possession", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { id: "Counter", icon: <Crosshair className="h-3.5 w-3.5" /> },
  { id: "HighPress", icon: <Flag className="h-3.5 w-3.5" /> },
];

function getOptionButtonClassName(isActive: boolean): string {
  if (isActive) {
    return "rounded-lg border border-app-green/40 bg-app-green px-3 py-2 text-sm font-heading font-black text-app-bg shadow-sm transition-all";
  }

  return "rounded-lg border border-app-border bg-[#151d28] px-3 py-2 text-sm font-heading font-bold text-app-text-muted transition-all hover:border-primary-500/40 hover:text-app-text";
}

function getPlayStyleDescription(activePlayStyle: string): string {
  return PLAY_STYLE_DESCRIPTION_FALLBACKS[activePlayStyle] ?? "";
}

export default function TacticsSetupPanel({
  activePlayStyle,
  formation,
  onFormationChange,
  onPlayStyleChange,
}: TacticsSetupPanelProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-app-border bg-app-card overflow-hidden">
        <div className="border-b border-app-border/50 px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-app-text-muted">
            {t("tactics.formation")}
          </h3>
          <p className="mt-1 text-sm font-black text-app-text">{formation}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4">
          {FORMATIONS.map((nextFormation) => (
            <button
              key={nextFormation}
              type="button"
              onClick={() => onFormationChange(nextFormation)}
              className={getOptionButtonClassName(formation === nextFormation)}
            >
              {nextFormation}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-app-card overflow-hidden">
        <div className="border-b border-app-border/50 px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-app-text-muted">
            {t("tactics.playStyle")}
          </h3>
          <p className="mt-1 text-sm font-black text-app-text">
            {t(`tactics.playStyles.${activePlayStyle}`, activePlayStyle)}
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {PLAY_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onPlayStyleChange(style.id)}
                className={`flex items-center justify-center gap-1.5 ${getOptionButtonClassName(
                  activePlayStyle === style.id,
                )}`}
              >
                {style.icon}
                <span className="truncate">
                  {t(`tactics.playStyles.${style.id}`, style.id)}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-app-border bg-[#151d28] px-3 py-3">
            <div className="mb-1 text-[10px] font-heading font-bold uppercase tracking-wider text-app-text-muted">
              {t("squad.playStyleImpactTitle")}
            </div>
            <p className="text-sm leading-relaxed text-app-text-muted">
              {t(
                `squad.playStyleDescriptions.${activePlayStyle}`,
                getPlayStyleDescription(activePlayStyle),
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
