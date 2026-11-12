import type { TerrainTag } from '../../domain/scenario';
import { TERRAIN_COLORS } from '../theme';

export const terrainPatternId = (tag: TerrainTag): string => `mm-terrain-${tag}`;

/**
 * SVG <pattern> definitions: each terrain type has a distinct texture as well as a tint,
 * so terrain is readable without colour (water = waves, debris = dots, impassable = cross-hatch,
 * minovsky = sparse speckle overlay that can sit on top of other terrain).
 */
export function TerrainPatternDefs() {
  const c = TERRAIN_COLORS;
  return (
    <defs>
      <pattern id={terrainPatternId('water')} width="12" height="8" patternUnits="userSpaceOnUse">
        <rect width="12" height="8" fill={c.water} fillOpacity="0.75" />
        <path d="M0 4 Q3 1 6 4 T12 4" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.2" />
      </pattern>
      <pattern id={terrainPatternId('debris')} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={c.debris} fillOpacity="0.55" />
        <circle cx="2" cy="2" r="1.3" fill="#3a2f22" />
        <circle cx="6" cy="6" r="1" fill="#3a2f22" />
      </pattern>
      <pattern id={terrainPatternId('impassable')} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={c.impassable} fillOpacity="0.85" />
        <path d="M0 0 L8 8 M8 0 L0 8" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" />
      </pattern>
      <pattern id={terrainPatternId('minovsky')} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={c.minovsky} fillOpacity="0.28" />
        <circle cx="2" cy="3" r="1.1" fill={c.minovsky} />
        <circle cx="7" cy="8" r="1.1" fill={c.minovsky} />
        <circle cx="8" cy="2" r="0.7" fill="#ffffff" fillOpacity="0.9" />
      </pattern>
    </defs>
  );
}

/** Tags drawn bottom-to-top; minovsky is an overlay so it goes last. */
export const TERRAIN_DRAW_ORDER: readonly TerrainTag[] = ['water', 'debris', 'impassable', 'minovsky'];
