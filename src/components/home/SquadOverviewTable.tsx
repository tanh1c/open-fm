import type { ReactNode } from "react";
import { Card, CardHeader, Tabs, type TabItem } from "../ui";
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

const TABS: TabItem[] = [
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
      <CardHeader
        action={
          <Tabs
            items={TABS}
            activeId={activeTab}
            onChange={(id) => onTabChange(id as SquadOverviewTab)}
            className="border-none gap-1"
          />
        }
      >
        Squad Overview
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-surface-200 font-heading uppercase tracking-wider text-[10px]">
            <tr className="border-b border-surface-700/60">
              <th className="text-left px-3 py-2 font-semibold w-14">POS</th>
              <th className="text-left px-2 py-2 font-semibold w-8">#</th>
              <th className="text-left px-2 py-2 font-semibold">Player</th>
              <th className="text-right px-2 py-2 font-semibold">Age</th>
              <th className="text-left px-2 py-2 font-semibold">Nat</th>
              <th className="text-right px-2 py-2 font-semibold">Con</th>
              <th className="text-right px-2 py-2 font-semibold">Mor</th>
              <th className="text-right px-2 py-2 font-semibold">Apps</th>
              <th className="text-right px-2 py-2 font-semibold">Gls</th>
              <th className="text-right px-2 py-2 font-semibold">Ast</th>
              <th className="text-right px-3 py-2 font-semibold">Av Rat</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                onClick={() => onPlayerClick?.(p.id)}
                className={`border-b border-surface-800 hover:bg-surface-800/50 transition-colors ${
                  onPlayerClick ? "cursor-pointer" : ""
                }`}
              >
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center justify-center min-w-9 h-5 px-2 rounded bg-surface-700 font-stat text-[10px] font-semibold text-white">
                    {p.position}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-stat text-surface-100">
                  {p.number ?? ""}
                </td>
                <td className="px-2 py-1.5 font-heading font-semibold text-white">
                  {p.matchName}
                </td>
                <td className="px-2 py-1.5 text-right font-stat text-surface-100">
                  {p.age}
                </td>
                <td className="px-2 py-1.5 text-surface-100">
                  <span className="font-stat text-[10px] uppercase tracking-wider">
                    {p.nationality}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <ConditionRing value={p.condition} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <ConditionRing value={p.morale} />
                </td>
                <td className="px-2 py-1.5 text-right font-stat text-surface-100">
                  {p.appearances}
                </td>
                <td className="px-2 py-1.5 text-right font-stat text-surface-100">
                  {p.goals}
                </td>
                <td className="px-2 py-1.5 text-right font-stat text-surface-100">
                  {p.assists}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span
                    data-cell="avgRating"
                    className={`inline-block min-w-12 px-1.5 py-0.5 rounded font-stat text-xs font-semibold text-center ${ratingClass(p.avgRating * 10)}`}
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

/** Inline 0-100 ring + numeric label, FM-style "92%" with arc. */
function ConditionRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 7;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const ringColor =
    clamped >= 85
      ? "var(--color-success-500)"
      : clamped >= 70
        ? "var(--color-accent-500)"
        : clamped >= 50
          ? "var(--color-warn-500)"
          : "var(--color-danger-500)";

  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--color-surface-700)" strokeWidth={2} />
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
      <span className="font-stat text-[10px] text-surface-100">{clamped}%</span>
    </span>
  );
}
