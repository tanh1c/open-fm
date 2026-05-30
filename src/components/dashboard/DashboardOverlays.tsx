import type { FixtureData, GameStateData, TeamData } from "../../store/gameStore";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import type { BlockerModal } from "../../hooks/useAdvanceTime.helpers";
import DashboardBlockerModal from "./DashboardBlockerModal";
import DashboardCloseConfirmModal from "./DashboardCloseConfirmModal";
import DashboardExitConfirmModal from "./DashboardExitConfirmModal";
import DashboardExitSavingModal from "./DashboardExitSavingModal";
import { type DashboardMatchModeMeta } from "./DashboardHeader";
import DashboardMatchConfirmModal from "./DashboardMatchConfirmModal";
import DashboardVacationModal from "./DashboardVacationModal";

interface DashboardOverlaysProps {
  blockerModal: BlockerModal | null;
  currentModeMeta: DashboardMatchModeMeta;
  gameState: GameStateData;
  handleConfirmMatch: () => void;
  handleExitToMenu: () => void | Promise<void>;
  handleNavigate: (tab: string) => void;
  handleCloseQuit: (save: boolean) => void | Promise<void>;
  handleVacation: (targetDate: string) => void | Promise<void>;
  isExitingToMenu: boolean;
  matchMode: MatchModeType;
  setBlockerModal: (value: BlockerModal | null) => void;
  setShowCloseConfirm: (value: boolean) => void;
  setShowExitConfirm: (value: boolean) => void;
  setShowMatchConfirm: (value: boolean) => void;
  showCloseConfirm: boolean;
  showExitConfirm: boolean;
  showMatchConfirm: boolean;
  showVacationPicker: boolean;
  closeVacationPicker: () => void;
  teams: TeamData[];
  todayMatchFixture: FixtureData | null;
}

export default function DashboardOverlays({
  blockerModal,
  currentModeMeta,
  gameState,
  handleConfirmMatch,
  handleExitToMenu,
  handleNavigate,
  handleCloseQuit,
  handleVacation,
  isExitingToMenu,
  matchMode,
  setBlockerModal,
  setShowCloseConfirm,
  setShowExitConfirm,
  setShowMatchConfirm,
  showCloseConfirm,
  showExitConfirm,
  showMatchConfirm,
  showVacationPicker,
  closeVacationPicker,
  teams,
  todayMatchFixture,
}: DashboardOverlaysProps) {
  return (
    <>
      {isExitingToMenu ? <DashboardExitSavingModal /> : null}

      {showVacationPicker ? (
        <DashboardVacationModal
          gameState={gameState}
          onCancel={closeVacationPicker}
          onConfirm={(targetDate) => void handleVacation(targetDate)}
        />
      ) : null}

      {showExitConfirm ? (
        <DashboardExitConfirmModal
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={() => {
            setShowExitConfirm(false);
            void handleExitToMenu();
          }}
        />
      ) : null}

      {showCloseConfirm ? (
        <DashboardCloseConfirmModal
          onCancel={() => setShowCloseConfirm(false)}
          onQuitWithoutSave={() => void handleCloseQuit(false)}
          onSaveAndQuit={() => void handleCloseQuit(true)}
        />
      ) : null}

      {showMatchConfirm ? (
        <DashboardMatchConfirmModal
          matchMode={matchMode}
          modeMeta={currentModeMeta}
          onCancel={() => setShowMatchConfirm(false)}
          onConfirm={handleConfirmMatch}
          teams={teams}
          todayMatchFixture={todayMatchFixture}
        />
      ) : null}

      {blockerModal ? (
        <DashboardBlockerModal
          blockerModal={blockerModal}
          onClose={() => setBlockerModal(null)}
          onContinueAnyway={blockerModal.pendingAction ?? null}
          onNavigate={(tab) => {
            setBlockerModal(null);
            handleNavigate(tab);
          }}
        />
      ) : null}
    </>
  );
}