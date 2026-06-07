import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GameStateData, PlayerData } from "../../store/gameStore";
import { getPlayerOvr } from "../../lib/helpers";
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

// Numbers 1-99: which are already worn, used to flag clashes in the editor.
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

  const commit = async (player: PlayerData, raw: string) => {
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
        <StatTile label="Unnumbered" value={roster.length - assignedCount} tone={roster.length - assignedCount > 0 ? "warning" : "neutral"} />
      </div>

      {error ? (
        <div className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-app-border bg-app-card overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-app-card sticky top-0 z-10 text-app-text-muted uppercase before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-app-border/50">
            <tr>
              <th className="font-semibold py-3 pl-4 w-16">POS</th>
              <th className="font-semibold py-3 min-w-[180px]">PLAYER</th>
              <th className="font-semibold py-3 w-14 text-center">OVR</th>
              <th className="font-semibold py-3 w-28 pr-4 text-right">NUMBER</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => {
              const draft = drafts[player.id];
              const value = draft != null ? draft : player.squad_number != null ? String(player.squad_number) : "";
              const pos = translatePositionAbbreviation(t, player.position);
              return (
                <tr key={player.id} className="border-b border-app-border/20 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-2.5 pl-4">
                    <span className="inline-flex items-center rounded bg-app-bg border border-app-border px-2 py-0.5 text-[10px] font-semibold uppercase text-app-text-muted">
                      {pos}
                    </span>
                  </td>
                  <td className="py-2.5 font-medium text-app-text">{player.match_name}</td>
                  <td className="py-2.5 text-center font-mono font-bold text-app-text-muted">{getPlayerOvr(player)}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex justify-end">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        value={value}
                        disabled={savingPlayerId === player.id}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [player.id]: event.target.value }))
                        }
                        onBlur={(event) => void commit(player, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        className="w-20 rounded bg-app-bg border border-app-border px-2.5 py-1.5 text-center text-sm font-bold text-app-text focus:outline-none focus:border-app-green/60 disabled:opacity-50"
                        placeholder="-"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "warning" }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{label}</div>
      <div className={tone === "warning" ? "mt-1 text-xl font-bold text-warn-500" : "mt-1 text-xl font-bold text-app-text"}>{value}</div>
    </div>
  );
}
