import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";

export async function hireStaff(staffId: string): Promise<GameStateData> {
  return invoke<GameStateData>("hire_staff", { staffId });
}

export async function releaseStaff(staffId: string): Promise<GameStateData> {
  return invoke<GameStateData>("release_staff", { staffId });
}