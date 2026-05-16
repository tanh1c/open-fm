import { ChevronRight } from "lucide-react";
import { CountryFlag } from "../../ui";
import { TemplateCard } from "../Card";
import { cn } from "../templateUtils";

export interface TemplateSquadRow {
  id: string;
  position: string;
  number: number;
  matchName: string;
  age: number;
  nationality: string;
  condition: number;
  morale: number;
  appearances: number;
  goals: number;
  assists: number;
  avgRating: number;
}

interface TemplateSquadOverviewProps {
  players: TemplateSquadRow[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onPlayerClick?: (id: string) => void;
  onViewFullSquad?: () => void;
}

const tabs = ["Overview", "Stats", "Contract", "Fitness"];

export function TemplateSquadOverview({ players, activeTab, onTabChange, onPlayerClick, onViewFullSquad }: TemplateSquadOverviewProps) {
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
                className={isActive ? "text-app-green font-semibold border-b-2 border-app-green pb-3 -mb-[2px]" : "text-app-text-muted hover:text-white pb-3 -mb-[2px]"}
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
              <th className="font-semibold py-3 pl-4 w-12">POS</th>
              <th className="font-semibold py-3 w-8">#</th>
              <th className="font-semibold py-3 min-w-[140px]">PLAYER</th>
              <th className="font-semibold py-3 w-12">AGE</th>
              <th className="font-semibold py-3 w-12">NAT</th>
              <th className="font-semibold py-3 w-16">CON</th>
              <th className="font-semibold py-3 w-16">SHP</th>
              <th className="font-semibold py-3 w-28">MORALE</th>
              <th className="font-semibold py-3 w-12">APPS</th>
              <th className="font-semibold py-3 w-12 text-center">GLS</th>
              <th className="font-semibold py-3 w-12 text-center">AST</th>
              <th className="font-semibold py-3 w-16 pr-4 text-right">AV RAT</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} onClick={() => onPlayerClick?.(player.id)} className="border-b border-app-border/20 last:border-0 hover:bg-white/5 transition-colors cursor-pointer">
                <td className="py-2.5 pl-4">
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
                </td>
                <td className="py-2.5 text-app-text-muted">{player.number}</td>
                <td className="py-2.5 font-medium text-app-text">{player.matchName}</td>
                <td className="py-2.5 text-app-text-muted">{player.age}</td>
                <td className="py-2.5 text-app-text-muted">
                  <CountryFlag code={player.nationality} className="text-sm leading-none" />
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <CircleChart pct={player.condition} color="#2dd4bf" />
                    <span className="text-app-green">{player.condition}%</span>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <CircleChart pct={player.condition} color="#2dd4bf" />
                    <span className="text-app-green">{player.condition}%</span>
                  </div>
                </td>
                <td className="py-2.5 flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-app-green">☺</span>
                  <span className="text-app-green font-medium">{moraleLabel(player.morale)}</span>
                </td>
                <td className="py-2.5 text-app-text-muted">{player.appearances}</td>
                <td className="py-2.5 text-app-text-muted text-center">{player.goals}</td>
                <td className="py-2.5 text-app-text-muted text-center">{player.assists}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="bg-app-bg px-2 py-1 rounded text-app-text font-medium border border-app-border/50">{player.avgRating.toFixed(2)}</span>
                </td>
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
