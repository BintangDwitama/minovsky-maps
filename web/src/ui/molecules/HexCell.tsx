import { memo } from 'react';
import type { Point } from '../../domain/hex';
import type { TerrainTag } from '../../domain/scenario';
import { ElevationBadge } from '../atoms/ElevationBadge';
import { HexPolygon } from '../atoms/HexPolygon';
import { TERRAIN_DRAW_ORDER, terrainPatternId } from '../atoms/TerrainPattern';
import { BOARD, elevationFill } from '../theme';

export interface HexCellProps {
  center: Point;
  size: number;
  tags: readonly TerrainTag[];
  level: number;
}

/** One board hex: elevation-shaded base, stacked terrain pattern overlays, elevation badge. */
export const HexCell = memo(function HexCell({ center, size, tags, level }: HexCellProps) {
  const inner = size - 1;
  return (
    <g>
      <HexPolygon center={center} size={inner} fill={elevationFill(level)} stroke={BOARD.stroke} strokeWidth={1} />
      {TERRAIN_DRAW_ORDER.filter((t) => tags.includes(t)).map((t) => (
        <HexPolygon key={t} center={center} size={inner} fill={`url(#${terrainPatternId(t)})`} />
      ))}
      {level > 0 ? (
        <HexPolygon center={center} size={inner - level * 1.5} fill="none" stroke="#000000" strokeWidth={1} />
      ) : null}
      <ElevationBadge center={center} size={size} level={level} />
    </g>
  );
});
