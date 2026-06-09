type PlayerWithOvr = {
  alternate_positions?: string[] | null;
  natural_position?: string | null;
  ovr?: number | null;
  position?: string | null;
  position_ratings?: Partial<Record<string, number>> | null;
};

const CANONICAL_POSITION_MAP: Record<string, string> = {
  gk: "Goalkeeper",
  goalkeeper: "Goalkeeper",
  defender: "CenterBack",
  def: "CenterBack",
  midfielder: "CentralMidfielder",
  mid: "CentralMidfielder",
  forward: "Striker",
  fwd: "Striker",
  rb: "RightBack",
  rightback: "RightBack",
  cb: "CenterBack",
  centerback: "CenterBack",
  centreback: "CenterBack",
  lb: "LeftBack",
  leftback: "LeftBack",
  rwb: "RightWingBack",
  rightwingback: "RightWingBack",
  lwb: "LeftWingBack",
  leftwingback: "LeftWingBack",
  dm: "DefensiveMidfielder",
  defensivemidfielder: "DefensiveMidfielder",
  cm: "CentralMidfielder",
  centralmidfielder: "CentralMidfielder",
  am: "AttackingMidfielder",
  attackingmidfielder: "AttackingMidfielder",
  rm: "RightMidfielder",
  rightmidfielder: "RightMidfielder",
  lm: "LeftMidfielder",
  leftmidfielder: "LeftMidfielder",
  rw: "RightWinger",
  rightwinger: "RightWinger",
  lw: "LeftWinger",
  leftwinger: "LeftWinger",
  st: "Striker",
  striker: "Striker",
};

const POSITION_GROUPS: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defender: "Defender",
  Midfielder: "Midfielder",
  Forward: "Forward",
  RightBack: "Defender",
  CenterBack: "Defender",
  LeftBack: "Defender",
  RightWingBack: "Defender",
  LeftWingBack: "Defender",
  DefensiveMidfielder: "Midfielder",
  CentralMidfielder: "Midfielder",
  AttackingMidfielder: "Midfielder",
  RightMidfielder: "Midfielder",
  LeftMidfielder: "Midfielder",
  RightWinger: "Forward",
  LeftWinger: "Forward",
  Striker: "Forward",
};

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function canonicalPosition(position: string | null | undefined): string {
  const trimmed = position?.trim() ?? "";
  if (!trimmed) return "";

  return CANONICAL_POSITION_MAP[normaliseKey(trimmed)] || trimmed;
}

function normalisePosition(position: string): string {
  const canonical = canonicalPosition(position);
  return POSITION_GROUPS[canonical] || canonical;
}

export function getPlayerOvr(player: PlayerWithOvr): number {
  return player.ovr ?? 0;
}

export function getPlayerOvrForPosition(
  player: PlayerWithOvr,
  slotPosition: string | null | undefined,
): number {
  const naturalOvr = getPlayerOvr(player);
  const canonicalSlot = canonicalPosition(slotPosition);
  if (!canonicalSlot) return naturalOvr;

  const importedRating = player.position_ratings?.[canonicalSlot];
  if (typeof importedRating === "number" && Number.isFinite(importedRating)) {
    return Math.max(1, Math.min(99, Math.round(importedRating)));
  }

  const preferredPositions = [
    player.natural_position || player.position,
    ...(player.alternate_positions ?? []),
  ]
    .filter(Boolean)
    .map((position) => canonicalPosition(position as string));

  if (preferredPositions.includes(canonicalSlot)) return naturalOvr;

  const slotGroup = normalisePosition(canonicalSlot);
  const naturalGroup = normalisePosition(canonicalPosition(player.natural_position || player.position));
  if (preferredPositions.some((position) => normalisePosition(position) === slotGroup)) {
    return Math.max(1, naturalOvr - 4);
  }
  if (naturalGroup === slotGroup) return Math.max(1, naturalOvr - 8);
  return Math.max(1, naturalOvr - 14);
}
