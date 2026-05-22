import { GameStateData, PlayerSelectionOptions } from "../../store/gameStore";
import SquadRosterView from "./SquadRosterView";

interface SquadTabProps {
  gameState: GameStateData;
  managerId: string;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onGameUpdate?: (g: GameStateData) => void;
}

export default function SquadTab({
  gameState,
  managerId,
  onSelectPlayer,
  onGameUpdate,
}: SquadTabProps) {
  return (
    <SquadRosterView
      gameState={gameState}
      managerId={managerId}
      onSelectPlayer={onSelectPlayer}
      onGameUpdate={onGameUpdate}
    />
  );
}
