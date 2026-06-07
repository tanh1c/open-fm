import { createPortal } from "react-dom";
import { useEffect, type ReactElement } from "react";
import { X } from "lucide-react";
import type { PlayerData } from "../../store/gameStore";
import TacticsPlayerFocusPanel from "./TacticsPlayerFocusPanel";

interface PlayerComparisonModalProps {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData;
  selectedPlayer: PlayerData;
  onConfirmSwap: () => void;
  onClose: () => void;
}

// Centered, dismissible modal that shows the two-player comparison instead of a
// tall sidebar card. Reuses TacticsPlayerFocusPanel for the stat layout.
export default function PlayerComparisonModal({
  canConfirmSwap,
  comparePlayer,
  selectedPlayer,
  onConfirmSwap,
  onClose,
}: PlayerComparisonModalProps): ReactElement {
  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto custom-scrollbar rounded-xl border border-app-border bg-app-bg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-app-border bg-app-card text-app-text-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <TacticsPlayerFocusPanel
          canConfirmSwap={canConfirmSwap}
          comparePlayer={comparePlayer}
          selectedPlayer={selectedPlayer}
          onConfirmSwap={onConfirmSwap}
        />
      </div>
    </div>,
    document.body,
  );
}
