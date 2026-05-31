import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";

export interface PlayerAttributeEdits {
    pace?: number;
    stamina?: number;
    strength?: number;
    agility?: number;
    passing?: number;
    shooting?: number;
    tackling?: number;
    dribbling?: number;
    defending?: number;
    positioning?: number;
    vision?: number;
    decisions?: number;
    composure?: number;
    aggression?: number;
    teamwork?: number;
    leadership?: number;
    handling?: number;
    reflexes?: number;
    aerial?: number;
}

export interface PlayerEdits {
    attributes?: PlayerAttributeEdits;
    condition?: number;
    morale?: number;
    fitness?: number;
    potential?: number;
    position?: string;
    natural_position?: string;
    date_of_birth?: string;
    wage?: number;
    market_value?: number;
    team_id?: string | null;
    contract_end?: string | null;
}

export interface EditPlayerResponseData {
    game: GameStateData;
}

export async function editPlayer(
    playerId: string,
    edits: PlayerEdits,
): Promise<EditPlayerResponseData> {
    return invoke<EditPlayerResponseData>("edit_player", {
        playerId,
        edits,
    });
}
