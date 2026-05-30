import type { ReactNode } from "react";

export function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-app-card p-3 text-center">
      <p className="text-xs text-app-text-muted font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>
        {value}
      </p>
    </div>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-app-border/40 last:border-0">
      <div className="text-app-text-muted">{icon}</div>
      <span className="text-sm text-app-text-muted flex-1">
        {label}
      </span>
      <span className="text-sm font-semibold text-app-text">
        {value}
      </span>
    </div>
  );
}

export function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-0 p-2.5 rounded-lg ${highlight ? "bg-app-green/10 border border-app-green/20" : "bg-app-bg"}`}
    >
      <p
        className={`font-heading font-bold text-base tabular-nums truncate ${highlight ? "text-app-green" : "text-app-text"}`}
      >
        {value}
      </p>
      <p className="text-[10px] text-app-text-muted font-heading uppercase tracking-wider truncate">
        {label}
      </p>
    </div>
  );
}
