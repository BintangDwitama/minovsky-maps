import { hexCorners, type Point } from '../../domain/hex';

export interface HexPolygonProps {
  center: Point;
  size: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

export const hexPoints = (center: Point, size: number): string =>
  hexCorners(center, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

export function HexPolygon({ center, size, fill, stroke, strokeWidth = 1, className }: HexPolygonProps) {
  return (
    <polygon
      className={className}
      points={hexPoints(center, size)}
      fill={fill}
      stroke={stroke ?? 'none'}
      strokeWidth={strokeWidth}
    />
  );
}
