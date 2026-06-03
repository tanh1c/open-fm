import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CountryFlag } from "../../ui";
import { TemplateCard } from "../Card";
import { cn } from "../templateUtils";

export interface TemplateSquadRow {
  id: string;
  position: string;
  number: number;
  matchName: string;
  fullName?: string;
  age: number;
  nationality: string;
  condition: number;
  morale: number;
  appearances: number;
  goals: number;
  assists: number;
  avgRating: number;
  ovr?: number;
  potential?: number | null;
  wage?: number;
  marketValue?: number;
  contractEnd?: string | null;
  injury?: string | null;
}

interface TemplateSquadOverviewProps {
  players: TemplateSquadRow[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onPlayerClick?: (id: string) => void;
  onViewFullSquad?: () => void;
}

const tabs = ["Overview", "Stats", "Contract", "Fitness"];

type SquadTab = (typeof tabs)[number];

type SortKey = keyof Pick<
  TemplateSquadRow,
  | "position"
  | "number"
  | "matchName"
  | "age"
  | "nationality"
  | "condition"
  | "morale"
  | "appearances"
  | "goals"
  | "assists"
  | "avgRating"
  | "ovr"
  | "potential"
  | "wage"
  | "marketValue"
  | "contractEnd"
  | "injury"
>;

type SortDirection = "asc" | "desc";

type ColumnKey =
  | "position"
  | "number"
  | "matchName"
  | "age"
  | "nationality"
  | "condition"
  | "sharpness"
  | "morale"
  | "appearances"
  | "goals"
  | "assists"
  | "avgRating"
  | "ovr"
  | "potential"
  | "wage"
  | "marketValue"
  | "contractEnd"
  | "injury";

interface SquadColumn {
  key: ColumnKey;
  sortKey: SortKey;
  label: string;
  className: string;
}

const COLUMNS_BY_TAB: Record<SquadTab, SquadColumn[]> = {
  Overview: [
    { key: "position", sortKey: "position", label: "POS", className: "pl-4 w-14" },
    { key: "number", sortKey: "number", label: "#", className: "w-12 pl-3" },
    { key: "matchName", sortKey: "matchName", label: "PLAYER", className: "min-w-[240px]" },
    { key: "age", sortKey: "age", label: "AGE", className: "w-12 text-center" },
    { key: "nationality", sortKey: "nationality", label: "NAT", className: "w-12 text-center" },
    { key: "ovr", sortKey: "ovr", label: "OVR", className: "w-14 text-center" },
    { key: "potential", sortKey: "potential", label: "POT", className: "w-14 text-center" },
    { key: "condition", sortKey: "condition", label: "CON", className: "w-16 text-center" },
    { key: "morale", sortKey: "morale", label: "MORALE", className: "w-24 text-center" },
    { key: "avgRating", sortKey: "avgRating", label: "AV RAT", className: "w-16 pr-4 text-center" },
  ],
  Stats: [
    { key: "position", sortKey: "position", label: "POS", className: "pl-4 w-16" },
    { key: "matchName", sortKey: "matchName", label: "PLAYER", className: "min-w-[240px]" },
    { key: "appearances", sortKey: "appearances", label: "APPS", className: "w-16 text-center" },
    { key: "goals", sortKey: "goals", label: "GLS", className: "w-16 text-center" },
    { key: "assists", sortKey: "assists", label: "AST", className: "w-16 text-center" },
    { key: "avgRating", sortKey: "avgRating", label: "AV RAT", className: "w-20 pr-4 text-right" },
  ],
  Contract: [
    { key: "position", sortKey: "position", label: "POS", className: "pl-4 w-16" },
    { key: "matchName", sortKey: "matchName", label: "PLAYER", className: "min-w-[240px]" },
    { key: "age", sortKey: "age", label: "AGE", className: "w-12" },
    { key: "wage", sortKey: "wage", label: "WAGE", className: "w-24 text-right" },
    { key: "marketValue", sortKey: "marketValue", label: "VALUE", className: "w-24 text-right" },
    { key: "contractEnd", sortKey: "contractEnd", label: "EXPIRES", className: "w-28 pr-4 text-right" },
  ],
  Fitness: [
    { key: "position", sortKey: "position", label: "POS", className: "pl-4 w-16" },
    { key: "matchName", sortKey: "matchName", label: "PLAYER", className: "min-w-[240px]" },
    { key: "condition", sortKey: "condition", label: "CON", className: "w-20" },
    { key: "sharpness", sortKey: "condition", label: "SHP", className: "w-20" },
    { key: "morale", sortKey: "morale", label: "MORALE", className: "w-28" },
    { key: "injury", sortKey: "injury", label: "STATUS", className: "w-32 pr-4 text-right" },
  ],
};

export function TemplateSquadOverview({ players, activeTab, onTabChange, onPlayerClick, onViewFullSquad }: TemplateSquadOverviewProps) {
  const normalizedTab = tabs.find((tab) => tab.toLowerCase() === activeTab.toLowerCase()) ?? "Overview";
  const columns = COLUMNS_BY_TAB[normalizedTab];
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const activeSortKey = columns.some((column) => column.sortKey === sortKey) ? sortKey : columns[0].sortKey;
  const sortedPlayers = useMemo(
    () => sortPlayers(players, activeSortKey, sortDirection),
    [players, sortDirection, activeSortKey],
  );

  function handleSort(nextKey: SortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(defaultSortDirection(nextKey));
  }

  return (
    <TemplateCard className="flex flex-col h-full">
      <div className="px-5 pt-4 flex items-center gap-6 border-b border-app-border/50">
        <h2 className="text-[11px] font-bold text-app-text-muted tracking-widest uppercase mb-3">SQUAD OVERVIEW</h2>
        <div className="flex items-center gap-4 text-xs">
          {tabs.map((tab) => {
            const isActive = tab.toLowerCase() === activeTab.toLowerCase();
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={
                  isActive
                    ? "text-app-green font-semibold border-b-2 border-app-green pb-3 -mb-[2px]"
                    : "text-app-text-muted hover:text-white pb-3 -mb-[2px]"
                }
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 p-0 overflow-x-auto min-h-0 min-w-0">
        <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
          <thead>
            <tr className="text-app-text-muted border-b border-app-border/30">
              {columns.map((column) => (
                <th key={`${column.label}-${column.key}`} className={cn("font-semibold py-3", column.className)}>
                  <button
                    type="button"
                    onClick={() => handleSort(column.sortKey)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-app-text transition-colors",
                      column.className.includes("text-center") && "justify-center w-full",
                      column.className.includes("text-right") && "justify-end w-full",
                    )}
                  >
                    <span>{column.label}</span>
                    <span className={activeSortKey === column.sortKey ? "text-app-green" : "text-app-text-muted/40"}>
                      {activeSortKey === column.sortKey ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => (
              <tr key={player.id} data-testid={`squad-overview-player-${player.id}`} onClick={() => onPlayerClick?.(player.id)} className="border-b border-app-border/20 last:border-0 hover:bg-white/5 transition-colors cursor-pointer">
                {columns.map((column) => (
                  <td key={`${player.id}-${column.key}`} className={cn("py-2.5", cellClassName(column))}>
                    {renderCell(player, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onViewFullSquad} className="h-10 border-t border-app-border/50 flex items-center justify-end pr-4 gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>View Full Squad</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </TemplateCard>
  );
}

function renderCell(player: TemplateSquadRow, key: ColumnKey) {
  if (key === "position") {
    return (
      <span
        className={cn(
          "px-1.5 py-0.5 rounded text-[9px] font-bold inline-block min-w-[28px] text-center",
          player.position === "GK"
            ? "bg-[#40b07b]/20 text-[#40b07b]"
            : player.position.includes("D") || (player.position.includes("R") || player.position.includes("L")) && !player.position.includes("M")
              ? "bg-[#5b75a1]/20 text-[#5b75a1]"
              : "text-app-text-muted bg-white/5",
        )}
      >
        {player.position}
      </span>
    );
  }

  if (key === "number") return player.number;
  if (key === "matchName") return <span className="font-medium text-app-text">{player.fullName || player.matchName}</span>;
  if (key === "age") return player.age;
  if (key === "nationality") return <CountryFlag code={player.nationality} className="text-sm leading-none" />;
  if (key === "condition" || key === "sharpness") return <FitnessValue value={player.condition} />;
  if (key === "morale") return <MoraleValue value={player.morale} />;
  if (key === "appearances") return player.appearances;
  if (key === "goals") return player.goals;
  if (key === "assists") return player.assists;
  if (key === "avgRating") return <RatingValue value={player.avgRating} />;
  if (key === "ovr") return <RatingBadge value={player.ovr ?? 0} />;
  if (key === "potential") return player.potential ? <RatingBadge value={player.potential} /> : <span className="text-app-text-muted/60">--</span>;
  if (key === "wage") return formatCurrency(player.wage ?? 0);
  if (key === "marketValue") return formatCurrency(player.marketValue ?? 0);
  if (key === "contractEnd") return formatContractEnd(player.contractEnd);
  if (key === "injury") return player.injury ? injuryLabel(player.injury) : "Fit";
  return null;
}

function cellClassName(column: SquadColumn): string {
  return cn(
    column.className.includes("pl-4") && "pl-4",
    column.className.includes("pl-3") && "pl-3",
    column.className.includes("pl-2") && "pl-2",
    column.className.includes("pr-4") && "pr-4",
    column.className.includes("text-center") && "text-center",
    column.className.includes("text-right") && "text-right",
    !column.className.includes("text-right") && !column.className.includes("text-center") && "text-app-text-muted",
  );
}

function sortPlayers(
  players: TemplateSquadRow[],
  sortKey: SortKey,
  sortDirection: SortDirection,
): TemplateSquadRow[] {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...players].sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}

function defaultSortDirection(sortKey: SortKey): SortDirection {
  return ["condition", "morale", "appearances", "goals", "assists", "avgRating"].includes(sortKey)
    ? "desc"
    : "asc";
}

function FitnessValue({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <CircleChart pct={value} color="var(--color-primary-500)" />
      <span className="text-app-green">{value}%</span>
    </div>
  );
}

function MoraleValue({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-[10px] text-app-green">☺</span>
      <span className="text-app-green font-medium">{moraleLabel(value)}</span>
    </div>
  );
}

function RatingValue({ value }: { value: number }) {
  return <span className="bg-app-bg px-2 py-1 rounded text-app-text font-medium border border-app-border/50">{value.toFixed(2)}</span>;
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span className={cn("inline-flex min-w-9 justify-center rounded-md border px-2 py-1 text-[11px] font-bold", ratingColor(value))}>
      {value}
    </span>
  );
}

function ratingColor(value: number): string {
  if (value >= 80) return "rating-cell-elite";
  if (value >= 70) return "rating-cell-good";
  if (value >= 60) return "rating-cell-avg";
  if (value >= 50) return "border-warn-500/40 bg-warn-500/10 text-warn-500";
  return "rating-cell-poor";
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function formatContractEnd(value: string | null | undefined): string {
  if (!value) return "--";
  return value.slice(0, 10);
}

function injuryLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CircleChart({ pct, color }: { pct: number; color: string }) {
  const r = 4;
  const circ = 2 * Math.PI * r;
  const strokePct = ((100 - pct) * circ) / 100;
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="transform -rotate-90">
      <circle r={r} cx="6" cy="6" fill="transparent" stroke="#232d3b" strokeWidth="2.5" />
      <circle r={r} cx="6" cy="6" fill="transparent" stroke={color} strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={strokePct} />
    </svg>
  );
}

function moraleLabel(value: number): string {
  if (value >= 85) return "Very Good";
  if (value >= 65) return "Good";
  if (value >= 45) return "Okay";
  return "Poor";
}
