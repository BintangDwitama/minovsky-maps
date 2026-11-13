/**
 * Lookups the analysis rules need, derived from a scenario. Scenarios hold no units, so the only
 * pieces that matter are the ones the core rules treat as obstacles: Bases, Garrisons, Carriers
 * and structures. Whether one blocks depends on whose side is asking (only enemy pieces block).
 */
import { type Axial, hexKey } from '../hex';
import type { ComponentKind, TerrainTag } from '../scenario';
import { buildIndex, componentsAt, elevationAt, isOnBoard, tagsAt } from '../scenarioIndex';
import type { Scenario } from '../scenario';

export type Side = 'A' | 'B';

/** Pieces that block enemies' movement and line of sight, and that no unit may end a move on. */
const OBSTACLE_KINDS: ReadonlySet<ComponentKind> = new Set([
  'base',
  'garrison',
  'carrier',
  'structure',
]);

export const opponent = (side: Side): Side => (side === 'A' ? 'B' : 'A');

export interface AnalysisIndex {
  onBoard(h: Axial): boolean;
  elevation(h: Axial): number;
  tags(h: Axial): readonly TerrainTag[];
  impassable(h: Axial): boolean;
  /** An obstacle belonging to the opponent of `side` is on this hex. */
  enemyObstacle(h: Axial, side: Side): boolean;
  /** An enemy Garrison is on this hex (causes Engagement). */
  enemyGarrison(h: Axial, side: Side): boolean;
  /** Any obstacle (any owner) is on this hex: no unit may end its move here. */
  occupied(h: Axial): boolean;
}

export const buildAnalysisIndex = (s: Scenario): AnalysisIndex => {
  const idx = buildIndex(s);
  const obstacles = (h: Axial) => componentsAt(idx, h).filter((c) => OBSTACLE_KINDS.has(c.kind));
  const memo = new Map<string, ReturnType<typeof obstacles>>();
  const at = (h: Axial) => {
    const k = hexKey(h);
    let v = memo.get(k);
    if (!v) {
      v = obstacles(h);
      memo.set(k, v);
    }
    return v;
  };
  return {
    onBoard: (h) => isOnBoard(idx, h),
    elevation: (h) => elevationAt(idx, h),
    tags: (h) => tagsAt(idx, h),
    impassable: (h) => tagsAt(idx, h).includes('impassable'),
    enemyObstacle: (h, side) => at(h).some((c) => c.owner === opponent(side)),
    enemyGarrison: (h, side) =>
      at(h).some((c) => c.kind === 'garrison' && c.owner === opponent(side)),
    occupied: (h) => at(h).length > 0,
  };
};
