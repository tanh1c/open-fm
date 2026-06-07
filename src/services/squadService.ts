import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";
import type { PlayerSquadRole } from "../store/types";

export async function setPlayerSquadRole(
    playerId: string,
    squadRole: PlayerSquadRole,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_player_squad_role", {
        playerId,
        squadRole,
    });
}

export async function setPlayerSquadNumber(
    playerId: string,
    squadNumber: number | null,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_player_squad_number", {
        playerId,
        squadNumber,
    });
}