import { Card, CardHeader, CardBody } from "../ui";

interface FormChartCardProps {
  /** Most-recent result last. Used to plot the line chart left-to-right. */
  results: Array<"W" | "D" | "L">;
  totals: { won: number; drawn: number; lost: number };
  pointsPerGame: number;
  className?: string;
}

const CHART_WIDTH = 240;
const CHART_HEIGHT = 96;
const PADDING_X = 12;
const PADDING_Y = 12;

const Y_FOR: Record<"W" | "D" | "L", number> = {
  W: PADDING_Y,
  D: CHART_HEIGHT / 2,
  L: CHART_HEIGHT - PADDING_Y,
};

const COLOR_FOR: Record<"W" | "D" | "L", string> = {
  W: "var(--color-success-500)",
  D: "var(--color-warn-500)",
  L: "var(--color-danger-500)",
};

/**
 * Compact line chart of recent results — tracks W (top) / D (mid) / L (bottom)
 * across a 240×96 SVG viewport with one circle per match.
 */
export function FormChartCard({
  results,
  totals,
  pointsPerGame,
  className = "",
}: FormChartCardProps) {
  const points = results.map((r, i) => {
    const x =
      results.length === 1
        ? CHART_WIDTH / 2
        : PADDING_X + ((CHART_WIDTH - PADDING_X * 2) * i) / (results.length - 1);
    return { x, y: Y_FOR[r], result: r };
  });

  return (
    <Card className={className}>
      <CardHeader>Team Form</CardHeader>
      <CardBody>
        <div className="flex items-center gap-4">
          {results.length === 0 ? (
            <p className="text-sm text-surface-200 italic">No recent matches</p>
          ) : (
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="flex-1 h-24"
              role="img"
              aria-label="Recent form line chart"
            >
              {/* Y-axis guide labels */}
              <g className="text-[10px]" fill="var(--color-surface-200)">
                <text x={2} y={Y_FOR.W + 3}>W</text>
                <text x={2} y={Y_FOR.D + 3}>D</text>
                <text x={2} y={Y_FOR.L + 3}>L</text>
              </g>

              {/* Connecting line */}
              <polyline
                fill="none"
                stroke="var(--color-primary-400)"
                strokeWidth={2}
                strokeLinejoin="round"
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              />

              {/* Per-match dots, color-graded by result */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  fill={COLOR_FOR[p.result]}
                  stroke="var(--color-surface-900)"
                  strokeWidth={1}
                />
              ))}
            </svg>
          )}

          <div className="flex flex-col gap-1 min-w-20 text-xs">
            <SummaryRow label="Won" value={totals.won} colorClass="text-success-500" />
            <SummaryRow label="Drawn" value={totals.drawn} colorClass="text-warn-500" />
            <SummaryRow label="Lost" value={totals.lost} colorClass="text-danger-500" />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-surface-700/60 text-center">
          <p className="text-[10px] font-heading uppercase tracking-wider text-surface-200">
            Form (last {results.length || 0})
          </p>
          <p className="font-stat font-semibold text-base text-white mt-0.5">
            {pointsPerGame.toFixed(2)}{" "}
            <span className="text-xs text-surface-200">PPG</span>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-surface-200">{label}</span>
      <span className={`font-stat font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}
