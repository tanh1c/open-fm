import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import type { GameStateData, PlayerData } from "../../store/gameStore";
import { CountryFlag } from "../ui";
import { calcAge, getPlayerOvr } from "../../lib/helpers";
import { setPlayerSquadNumber } from "../../services/squadService";
import { normalisePosition, translatePositionAbbreviation } from "./SquadTab.helpers";

interface SquadNumbersViewProps {
  roster: PlayerData[];
  onGameUpdate?: (g: GameStateData) => void;
}

const POS_ORDER: Record<string, number> = {
  Goalkeeper: 1,
  Defender: 2,
  Midfielder: 3,
  Forward: 4,
};

function positionChipClass(pos: string): string {
  const base = "px-1.5 py-0.5 rounded text-[9px] font-bold inline-block min-w-[28px] text-center";
  if (pos === "GK") return `${base} bg-[#40b07b]/20 text-[#40b07b]`;
  if (pos.includes("D")) return `${base} bg-[#5b75a1]/20 text-[#8baae0]`;
  if (pos.includes("M")) return `${base} bg-[#a062b0]/20 text-[#d48de8]`;
  return `${base} bg-red-500/20 text-red-300`;
}

// Numbers 1-99 already worn, used to flag clashes in the editor.
function buildTakenMap(roster: PlayerData[]): Map<number, string> {
  const taken = new Map<number, string>();
  for (const player of roster) {
    if (player.squad_number != null) {
      taken.set(player.squad_number, player.id);
    }
  }
  return taken;
}

export default function SquadNumbersView({ roster, onGameUpdate }: SquadNumbersViewProps) {
  const { t } = useTranslation();
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local draft values keyed by player id so typing feels instant before save.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () =>
      [...roster].sort(
        (a, b) =>
          (POS_ORDER[normalisePosition(a.position)] || 99) -
            (POS_ORDER[normalisePosition(b.position)] || 99) ||
          getPlayerOvr(b) - getPlayerOvr(a),
      ),
    [roster],
  );

  const takenMap = useMemo(() => buildTakenMap(roster), [roster]);
  const assignedCount = roster.filter((player) => player.squad_number != null).length;
  const lowNumbersUsed = Array.from({ length: 11 }, (_, idx) => idx + 1).filter((n) =>
    takenMap.has(n),
  ).length;

  const assign = async (player: PlayerData, raw: string) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number.parseInt(trimmed, 10);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 99)) {
      setError(t("squad.numberRange", "Squad numbers must be between 1 and 99."));
      return;
    }

    if (parsed === (player.squad_number ?? null)) {
      return;
    }

    if (parsed !== null) {
      const owner = takenMap.get(parsed);
      if (owner && owner !== player.id) {
        setError(t("squad.numberTaken", "That number is already taken by a team-mate."));
        return;
      }
    }

    setError(null);
    setSavingPlayerId(player.id);
    try {
      const updated = await setPlayerSquadNumber(player.id, parsed);
      onGameUpdate?.(updated);
      setDrafts((current) => {
        const next = { ...current };
        delete next[player.id];
        return next;
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSavingPlayerId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Players" value={roster.length} />
        <StatTile label="Numbered" value={assignedCount} />
        <StatTile label="1-11 Used" value={`${lowNumbersUsed}/11`} />
        <StatTile
          label="Unnumbered"
          value={roster.length - assignedCount}
          tone={roster.length - assignedCount > 0 ? "warning" : "neutral"}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      ) : null}

      <TemplateCard className="flex h-[600px] flex-col overflow-hidden">
        <div className="relative flex-1 overflow-auto custom-scrollbar">
          <table className="w-full min-w-[820px] whitespace-nowrap text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-app-card text-app-text-muted uppercase before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-app-border/50 before:content-['']">
              <tr>
                <th className="w-12 py-2.5 pl-4 font-semibold text-app-text-muted">POS</th>
                <th className="w-10 py-2.5 text-center font-semibold text-app-text-muted">#</th>
                <th className="min-w-[170px] py-2.5 font-semibold text-app-text-muted">PLAYER</th>
                <th className="w-10 py-2.5 text-center font-semibold text-app-text-muted">AGE</th>
                <th className="w-12 py-2.5 text-center font-semibold text-app-text-muted">NAT</th>
                <th className="w-12 py-2.5 text-center font-semibold text-app-text-muted">OVR</th>
                <th className="w-44 py-2.5 pr-4 text-right font-semibold text-app-text-muted">CHANGE NUMBER</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((player) => {
                const draft = drafts[player.id];
                const value =
                  draft != null ? draft : player.squad_number != null ? String(player.squad_number) : "";
                const pos = translatePositionAbbreviation(t, player.natural_position || player.position);
                const isSaving = savingPlayerId === player.id;
                const isDirty = draft != null && draft !== (player.squad_number != null ? String(player.squad_number) : "");
                return (
                  <tr
                    key={player.id}
                    className="border-b border-app-border/20 transition-colors last:border-0 hover:bg-white/5"
                  >
                    <td className="py-2.5 pl-4">
                      <span className={positionChipClass(pos)}>{pos}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      {player.squad_number != null ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-app-green/30 bg-app-green/15 text-[11px] font-bold text-app-green">
                          {player.squad_number}
                        </span>
                      ) : (
                        <span className="text-app-text-muted">-</span>
                      )}
                    </td>
                    <td className="py-2.5 font-medium text-app-text">
                      <span className="truncate">{player.full_name}</span>
                    </td>
                    <td className="py-2.5 text-center text-app-text-muted tabular-nums">
                      {calcAge(player.date_of_birth)}
                    </td>
                    <td className="py-2.5 text-center">
                      <CountryFlag code={player.nationality} className="text-sm leading-none" />
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold text-app-text-muted">
                      {getPlayerOvr(player)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          inputMode="numeric"
                          value={value}
                          disabled={isSaving}
                          onChange={(event) =>
                            setDrafts((current) => ({ ...current, [player.id]: event.target.value }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void assign(player, (event.target as HTMLInputElement).value);
                            }
                          }}
                          className="w-16 rounded border border-app-border bg-app-bg px-2 py-1.5 text-center text-sm font-bold text-app-text focus:border-app-green/60 focus:outline-none disabled:opacity-50"
                          placeholder="-"
                        />
                        <button
                          type="button"
                          disabled={isSaving || !isDirty}
                          onClick={() => void assign(player, value)}
                          className="flex items-center gap-1 rounded-lg bg-app-green px-2.5 py-1.5 text-[11px] font-bold text-app-bg transition-colors hover:bg-app-green/90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check className="h-3 w-3" />
                          {isSaving ? "..." : "Assign"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold uppercase tracking-wider text-app-text-muted">
              {t("squad.noPlayers")}
            </div>
          ) : null}
        </div>
      </TemplateCard>
    </div>
  );
}

function TemplateCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border border-app-border bg-app-card ${className}`}>{children}</div>;
}

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{label}</div>
      <div className={tone === "warning" ? "mt-1 text-xl font-bold text-warn-500" : "mt-1 text-xl font-bold text-app-text"}>
        {value}
      </div>
    </div>
  );
}
