/**
 * Where a probe (a hypothetical unit) could end a move, and what it costs, following the core
 * movement rules restated:
 *   - each step costs 1, plus 1 per level climbed; going down is free;
 *   - a unit starting above ground level jumps: it measures climbs from the higher of its
 *     starting elevation and the hex it is on, may cross gaps, and may pass over enemies below it;
 *   - water and debris on the starting hex and being Engaged each cost 1 from the allowance;
 *   - impassable hexes can't be entered (Hover lifts this); enemy obstacles can't be passed;
 *   - no move may end on an obstacle (any owner), an impassable hex, or the starting hex.
 */
import { type Axial, hexKey, type HexKey, neighbors } from '../hex';
import type { AnalysisIndex, Side } from './analysisIndex';

export interface ReachOptions {
  readonly side: Side;
  /** Movement of the action, e.g. 3 for Advance. */
  readonly move: number;
  /** Speed bonus (Advance only). */
  readonly speed: number;
  /** Engaged, whether detected or set by hand. */
  readonly engaged: boolean;
  /** Hover: may move through impassable terrain. */
  readonly hover: boolean;
}

export type ReachPenalty = 'water' | 'debris' | 'engaged';

export interface Reach {
  readonly allowance: number;
  readonly penalties: readonly ReachPenalty[];
  /** Cheapest cost for every hex the move may end on. */
  readonly costs: ReadonlyMap<HexKey, number>;
}

/** Engaged: an enemy Garrison on an adjacent hex at the probe's elevation. */
export const isEngaged = (ai: AnalysisIndex, probe: Axial, side: Side): boolean => {
  const e = ai.elevation(probe);
  return neighbors(probe).some(
    (n) => ai.onBoard(n) && ai.enemyGarrison(n, side) && ai.elevation(n) === e,
  );
};

export const reach = (ai: AnalysisIndex, probe: Axial, opts: ReachOptions): Reach => {
  const penalties: ReachPenalty[] = [];
  const startTags = ai.tags(probe);
  if (startTags.includes('water')) penalties.push('water');
  if (startTags.includes('debris')) penalties.push('debris');
  if (opts.engaged) penalties.push('engaged');
  const allowance = Math.max(0, opts.move + opts.speed - penalties.length);

  const start = ai.elevation(probe);
  const jumping = start > 0;
  const refFor = (e: number) => (jumping ? Math.max(start, e) : e);
  const startKey = hexKey(probe);

  // Dijkstra over (hex, reference elevation); boards are small, a sorted frontier is plenty
  const best = new Map<string, number>();
  const frontier: { hex: Axial; ref: number; cost: number }[] = [
    { hex: probe, ref: refFor(start), cost: 0 },
  ];
  const costs = new Map<HexKey, number>();

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    const stateKey = `${hexKey(cur.hex)}|${cur.ref}`;
    if ((best.get(stateKey) ?? Infinity) < cur.cost) continue;

    for (const n of neighbors(cur.hex)) {
      if (!ai.onBoard(n)) continue;
      if (ai.impassable(n) && !opts.hover) continue;
      const e = ai.elevation(n);
      // enemy obstacles block the way, unless jumped over from above
      if (ai.enemyObstacle(n, opts.side) && !(jumping && e < cur.ref)) continue;

      const cost = cur.cost + 1 + Math.max(0, e - cur.ref);
      if (cost > allowance) continue;
      const ref = refFor(e);
      const key = `${hexKey(n)}|${ref}`;
      if ((best.get(key) ?? Infinity) <= cost) continue;
      best.set(key, cost);
      frontier.push({ hex: n, ref, cost });

      const k = hexKey(n);
      const canEnd = k !== startKey && !ai.occupied(n) && !ai.impassable(n);
      if (canEnd && cost < (costs.get(k) ?? Infinity)) costs.set(k, cost);
    }
  }
  return { allowance, penalties, costs };
};
