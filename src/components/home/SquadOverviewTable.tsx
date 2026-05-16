import type { ReactNode } from "react";
import { Card } from "../ui";
import { ratingClass } from "../../lib/ratings";

export type SquadOverviewTab = "overview" | "stats" | "contract" | "fitness";

export interface SquadOverviewPlayer {
  id: string;
  /** Display abbreviation, e.g. "GK", "RB", "DCR". */
  position: string;
  number?: number;
  matchName: string;
  age: number;
  /** ISO code (3 letter) or label rendered as a tag. */
  nationality: string;
  /** 0-100 condition. */
  condition: number;
  /** 0-100 morale. */
  morale: number;
  appearances: number;
  goals: number;
  assists: number;
  avgRating: number;
}

interface SquadOverviewTableProps {
  players: SquadOverviewPlayer[];
  activeTab: SquadOverviewTab;
  onTabChange: (tab: SquadOverviewTab) => void;
  onPlayerClick?: (id: string) => void;
  className?: string;
  /** Optional footer slot rendered below the table (e.g. "View Full Squad"). */
  footer?: ReactNode;
}

const TABS: Array<{ id: SquadOverviewTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "contract", label: "Contract" },
  { id: "fitness", label: "Fitness" },
];

/**
 * FM25-style dense squad table. Header tabs let the viewer flip between
 * overview/stats/contract/fitness slices without remounting; the data rows
 * stay the same and the cells just shift.
 */
export function SquadOverviewTable({
  players,
  activeTab,
  onTabChange,
  onPlayerClick,
  className = "",
  footer,
}: SquadOverviewTableProps) {
  return (
    <Card className={className}>
      <div className="px-5 pt-4 flex items-center gap-6 border-b border-app-border/50">
        <h2 className="text-[11px] font-bold text-app-text-muted tracking-widest uppercase mb-3">
          Squad Overview
        </h2>
        <div role="tablist" className="flex items-center gap-4 text-xs">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`font-semibold transition-colors ${
                  isActive
                    ? "text-app-green border-b-2 border-app-green pb-3 -mb-[2px]"
                    : "text-app-text-muted hover:text-white pb-3 -mb-[2px]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-0 overflow-x-auto min-h-0 min-w-0">
        <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
          <thead className="text-app-text-muted uppercase tracking-widest text-[10px]">
            <tr className="border-b border-app-border/30">
              <th className="font-semibold py-3 pl-4 w-12 text-left">POS</th>
              <th className="font-semibold py-3 w-8 text-left">#</th>
              <th className="font-semibold py-3 min-w-[140px] text-left">Player</th>
              <th className="font-semibold py-3 w-12 text-right">Age</th>
              <th className="font-semibold py-3 w-12 text-left">Nat</th>
              <th className="font-semibold py-3 w-16 text-right">Con</th>
              <th className="font-semibold py-3 w-16 text-right">Mor</th>
              <th className="font-semibold py-3 w-12 text-right">Apps</th>
              <th className="font-semibold py-3 w-12 text-center">Gls</th>
              <th className="font-semibold py-3 w-12 text-center">Ast</th>
              <th className="font-semibold py-3 w-16 pr-4 text-right">Av Rat</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                onClick={() => onPlayerClick?.(p.id)}
                className={`border-b border-app-border/20 last:border-0 hover:bg-white/5 transition-colors ${
                  onPlayerClick ? "cursor-pointer" : ""
                }`}
              >
                <td className="py-2.5 pl-4">
                  <span className={`inline-flex items-center justify-center min-w-9 h-5 px-2 rounded font-stat text-[10px] font-semibold ${positionPillClass(p.position)}`}>
                    {p.position}
                  </span>
                </td>
                <td className="py-2.5 font-stat text-app-text">
                  {p.number ?? ""}
                </td>
                <td className="py-2.5 font-semibold text-app-text">
                  {p.matchName}
                </td>
                <td className="py-2.5 text-right font-stat text-app-text">
                  {p.age}
                </td>
                <td className="py-2.5 text-app-text">
                  <span className="font-stat text-[10px] uppercase tracking-wider">
                    {p.nationality}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <ConditionRing value={p.condition} />
                </td>
                <td className="py-2.5 text-right">
                  <ConditionRing value={p.morale} />
                </td>
                <td className="py-2.5 text-right font-stat text-app-text">
                  {p.appearances}
                </td>
                <td className="py-2.5 text-right font-stat text-app-text">
                  {p.goals}
                </td>
                <td className="py-2.5 text-right font-stat text-app-text">
                  {p.assists}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    data-cell="avgRating"
                    className={`inline-block min-w-12 px-2 py-1 rounded font-stat text-[11px] font-semibold text-center bg-app-bg border border-app-border/50 text-app-text ${ratingClass(p.avgRating * 10)}`}
                  >
                    {p.avgRating.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </Card>
  );
}

function positionPillClass(position: string): string {
  if (position === "GK") {
    return "bg-app-green/15 text-app-green border border-app-green/30";
  }

  if (["D", "B", "W"].some((prefix) => position.startsWith(prefix))) {
    return "bg-blue-500/15 text-blue-300 border border-blue-500/30";
  }

  return "bg-app-bg text-app-text-muted border border-app-border/50";
}

/** Inline 0-100 ring + numeric label, FM-style "92%" with arc. */
function ConditionRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 7;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const ringColor =
    clamped >= 85
      ? "var(--color-app-green)"
      : clamped >= 70
        ? "var(--color-success-500)"
        : clamped >= 50
          ? "var(--color-warn-500)"
          : "var(--color-app-red)";

  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--color-app-border)" strokeWidth={2} />
        <circle
          cx={9}
          cy={9}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={2}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 9 9)"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-stat text-[10px] text-app-text">{clamped}%</span>
    </span>
  );
}
