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
  W: "var(--color-app-green)",
  D: "var(--color-warn-500)",
  L: "var(--color-app-red)",
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
        <div className="flex flex-col gap-4">
          <div
            data-testid="form-chart-panel"
            className="bg-app-bg/50 border border-app-border/50 rounded-xl p-3"
          >
            {results.length === 0 ? (
              <p className="text-sm text-app-text-muted italic py-8 text-center">
                No recent matches
              </p>
            ) : (
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="w-full h-24"
                role="img"
                aria-label="Recent form line chart"
              >
                <g className="text-[10px]" fill="var(--color-app-text-muted)">
                  <text x={2} y={Y_FOR.W + 3}>W</text>
                  <text x={2} y={Y_FOR.D + 3}>D</text>
                  <text x={2} y={Y_FOR.L + 3}>L</text>
                </g>

                <g stroke="var(--color-app-border)" strokeWidth={0.6} opacity={0.7}>
                  <line x1={PADDING_X} y1={Y_FOR.W} x2={CHART_WIDTH - PADDING_X} y2={Y_FOR.W} />
                  <line x1={PADDING_X} y1={Y_FOR.D} x2={CHART_WIDTH - PADDING_X} y2={Y_FOR.D} />
                  <line x1={PADDING_X} y1={Y_FOR.L} x2={CHART_WIDTH - PADDING_X} y2={Y_FOR.L} />
                </g>

                <polyline
                  fill="none"
                  stroke="var(--color-app-green)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                />

                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill={COLOR_FOR[p.result]}
                    stroke="var(--color-app-bg)"
                    strokeWidth={1.5}
                  />
                ))}
              </svg>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <SummaryRow label="Won" value={totals.won} colorClass="text-app-green" />
            <SummaryRow label="Drawn" value={totals.drawn} colorClass="text-warn-500" />
            <SummaryRow label="Lost" value={totals.lost} colorClass="text-app-red" />
          </div>

          <div className="pt-3 border-t border-app-border/50 text-center">
            <p className="text-[10px] font-heading uppercase tracking-wider text-app-text-muted">
              Form (last {results.length || 0})
            </p>
            <p className="font-stat font-semibold text-base text-app-text mt-0.5">
              {pointsPerGame.toFixed(2)}{" "}
              <span className="text-xs text-app-text-muted">PPG</span>
            </p>
          </div>
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
    <div className="rounded-lg border border-app-border/50 bg-app-bg/60 px-3 py-2 text-center">
      <span className="block text-[10px] uppercase tracking-wider text-app-text-muted">
        {label}
      </span>
      <span className={`block font-stat font-semibold text-sm ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}
