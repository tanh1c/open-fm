import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";

export interface BlockerData {
  id: string;
  severity: string;
  text: string;
  text_key?: string;
  text_params?: Record<string, string>;
  tab: string;
}

export interface AdvanceTimeWithModeResponse {
  action: string;
  game?: GameStateData;
  snapshot?: unknown;
  fixture_index?: number;
  mode?: string;
  round_summary?: unknown;
}

export interface SkipToMatchDayResponse {
  action: string;
  game?: GameStateData;
  blockers?: BlockerData[];
  days_skipped?: number;
}

export async function advanceTimeWithMode(
  mode: string,
): Promise<AdvanceTimeWithModeResponse> {
  return invoke<AdvanceTimeWithModeResponse>("advance_time_with_mode", {
    mode,
  });
}

export async function checkBlockingActions(
  logContext: string,
): Promise<BlockerData[]> {
  try {
    const blockers = await invoke<BlockerData[]>("check_blocking_actions");
    console.info(`[useAdvanceTime] ${logContext}:blockers`, {
      count: blockers.length,
      blockers,
    });
    return blockers;
  } catch (err) {
    console.warn(`[useAdvanceTime] ${logContext}:blockerCheckFailed`, err);
    return [];
  }
}

export async function skipToMatchDay(): Promise<SkipToMatchDayResponse> {
  return invoke<SkipToMatchDayResponse>("skip_to_match_day");
}

// Persist the current in-memory game to its save slot. Called once per advance
// action (never inside a multi-day skip loop) so it adds a single disk write per
// user action without affecting simulation speed. Failures are swallowed so a
// transient save error never blocks gameplay.
export async function autoSaveGame(): Promise<void> {
  try {
    await invoke("save_game");
  } catch (err) {
    console.error("[advanceTime] auto-save failed:", err);
  }
}