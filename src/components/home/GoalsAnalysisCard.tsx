import { Card, CardHeader, CardBody } from "../ui";

export type GoalKind = "open_play" | "set_piece" | "counter" | "penalty";

export interface GoalSegment {
  kind: GoalKind;
  count: number;
}

interface GoalsAnalysisCardProps {
  segments: GoalSegment[];
  className?: string;
}

const SIZE = 140;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SEGMENT_META: Record<GoalKind, { label: string; color: string }> = {
  open_play: { label: "Open Play", color: "var(--color-primary-500)" },
  set_piece: { label: "Set Pieces", color: "var(--color-accent-500)" },
  counter: { label: "Counter Attacks", color: "var(--color-success-500)" },
  penalty: { label: "Penalties", color: "var(--color-warn-500)" },
};

/**
 * FM25-style donut chart breaking down goal sources. The SVG renders one
 * `<circle>` arc per segment using stroke-dasharray, so there's no path math
 * needed and the chart scales cleanly with parent size.
 */
export function GoalsAnalysisCard({ segments, className = "" }: GoalsAnalysisCardProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const isEmpty = total === 0;

  // Pre-compute each arc's offset along the donut.
  let cumulative = 0;
  const arcs = segments.map((segment) => {
    const fraction = segment.count / Math.max(total, 1);
    const length = fraction * CIRCUMFERENCE;
    const offset = -cumulative * CIRCUMFERENCE;
    cumulative += fraction;
    return { ...segment, length, offset };
  });

  return (
    <Card className={className}>
      <CardHeader>Goals Analysis</CardHeader>
      <CardBody>
        {isEmpty ? (
          <p className="text-sm text-surface-200 italic text-center py-4">
            No goals yet this season.
          </p>
        ) : (
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                width={SIZE}
                height={SIZE}
                role="img"
                aria-label="Goal source breakdown"
              >
                {/* Background ring */}
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--color-surface-700)"
                  strokeWidth={STROKE}
                />
                {/* Each segment uses dashoffset to slot into the ring */}
                <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                  {arcs.map((arc, i) => (
                    <path
                      key={i}
                      data-segment={arc.kind}
                      d={describeArc(SIZE / 2, SIZE / 2, RADIUS, arc.length, arc.offset)}
                      fill="none"
                      stroke={SEGMENT_META[arc.kind].color}
                      strokeWidth={STROKE}
                    />
                  ))}
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-stat font-bold text-2xl text-white">{total}</span>
                <span className="text-[10px] font-heading uppercase tracking-wider text-surface-200">
                  Total Goals
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {arcs.map((arc) => {
                const pct = Math.round((arc.count / total) * 100);
                return (
                  <div key={arc.kind} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: SEGMENT_META[arc.kind].color }}
                    />
                    <span className="flex-1 text-surface-200 truncate">
                      {SEGMENT_META[arc.kind].label}
                    </span>
                    <span className="font-stat text-white">
                      {arc.count} <span className="text-surface-200">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Produce an SVG arc path for a slice of length `arcLength` starting `offset`
 * pixels along the circle. Note: offset is negative because we run clockwise.
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  arcLength: number,
  offset: number,
): string {
  // Use stroke-dasharray + dashoffset would be simpler, but giving each arc
  // its own <path> lets the SVG be queried with [data-segment].
  const angleSpan = (arcLength / CIRCUMFERENCE) * 2 * Math.PI;
  const startAngle = (-offset / CIRCUMFERENCE) * 2 * Math.PI;
  const endAngle = startAngle + angleSpan;
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);
  const largeArc = angleSpan > Math.PI ? 1 : 0;
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}
