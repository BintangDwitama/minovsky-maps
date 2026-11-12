import type { Point } from '../../domain/hex';

export interface ElevationBadgeProps {
  center: Point;
  size: number;
  level: number;
}

/** Small numbered badge in the upper-left of a hex, shown for levels >= 1. */
export function ElevationBadge({ center, size, level }: ElevationBadgeProps) {
  if (level <= 0) return null;
  const x = center.x - size * 0.48;
  const y = center.y - size * 0.5;
  const r = size * 0.24;
  return (
    <g aria-label={`Elevation ${level}`}>
      <circle cx={x} cy={y} r={r} fill="#1b1d21" fillOpacity="0.85" stroke="#ffffff" strokeWidth="1" />
      <text
        x={x}
        y={y}
        dy="0.35em"
        textAnchor="middle"
        fontSize={size * 0.32}
        fontWeight="700"
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        {level}
      </text>
    </g>
  );
}
