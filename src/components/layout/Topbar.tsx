import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

interface TopbarProps {
  teamName: string;
  /** Pre-formatted human-readable date, e.g. "15 May 2026". */
  gameDate: string;
  /** Pre-formatted finance balance, color-styled by caller via className. */
  financeDisplay: string;
  /** Caller-provided color class for the finance text. Defaults to neutral. */
  financeColorClass?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Optional crest slot. Caller renders an <img> or icon. */
  crest?: ReactNode;
}

/**
 * FM25-style top bar. Always shows team name + date + finance, and a Continue
 * CTA pinned to the right corner — that button is the FM trademark.
 */
export function Topbar({
  teamName,
  gameDate,
  financeDisplay,
  financeColorClass = "text-surface-100",
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  crest,
}: TopbarProps) {
  return (
    <div className="flex items-center justify-between w-full gap-6">
      <div className="flex items-center gap-3 min-w-0">
        {crest && <div className="w-7 h-7 flex-shrink-0">{crest}</div>}
        <span className="font-heading uppercase tracking-wider text-sm font-semibold text-white truncate">
          {teamName}
        </span>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0">
        <span className="font-heading uppercase tracking-wider text-xs text-surface-200">
          {gameDate}
        </span>
        <span className={`font-stat text-sm font-semibold ${financeColorClass}`}>
          {financeDisplay}
        </span>
      </div>

      {onContinue && (
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={continueDisabled}
          iconRight={<ChevronRight />}
        >
          {continueLabel}
        </Button>
      )}
    </div>
  );
}
