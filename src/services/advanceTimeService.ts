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

export interface VacationMatchResult {
  fixtureId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface VacationAssistantTransferAction {
  playerId: string;
  playerName: string;
  offerId: string;
  action: string;
  fee: number;
}

export interface VacationReport {
  startedAt: string;
  endedAt: string;
  daysAdvanced: number;
  stopReason: string;
  matchResults: VacationMatchResult[];
  transferOfferIds: string[];
  jobOfferMessageIds: string[];
  urgentMessageIds: string[];
  blockerIds: string[];
  delegatedRenewalReports?: unknown[];
  assistantTransferActions?: VacationAssistantTransferAction[];
}

export interface AdvanceToDateResponse {
  action: string;
  game?: GameStateData;
  blockers?: BlockerData[];
  days_advanced?: number;
  report?: VacationReport;
}

export interface VacationSettings {
  handleMatches: boolean;
  handleTraining: boolean;
  handleTransfers: boolean;
  handleContracts: boolean;
  handleScouting: boolean;
  ignoreSoftBlockers: boolean;
  returnForUserMatch: boolean;
  returnForJobOffer: boolean;
  returnForTransferOffer: boolean;
  returnForContractDecision: boolean;
  returnForInjuryCrisis: boolean;
  returnForUrgentMessage: boolean;
  contractMaxWageIncreasePct: number;
  contractMaxYears: number;
  transferMinimumValuePct: number;
  allowAssistantToSellKeyPlayers: boolean;
  applyForJobsWhileAway: boolean;
  jobMinimumReputation?: number | null;
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

// Advance day-by-day until the in-game date reaches targetDate (YYYY-MM-DD).
// Stops early on a scheduled user fixture ("match_day"), a firing ("fired"),
// or a blocking action ("blocked"); otherwise resolves "arrived".
export async function advanceToDate(
  targetDate: string,
  settings: VacationSettings,
): Promise<AdvanceToDateResponse> {
  return invoke<AdvanceToDateResponse>("advance_to_date", { targetDate, settings });
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