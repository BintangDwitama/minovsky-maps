/**
 * Line of sight from a probe (a hypothetical unit of one side) following the core rules,
 * restated: draw a line between hex centres. With P = probe elevation, T = target elevation and
 * H = the higher of the two, a hex on the line blocks when
 *   - its terrain is higher than both (e > H), or, if P ≠ T, level with the higher one (e == H);
 *   - it holds an enemy obstacle level with both (P == T == e), or, if P ≠ T, level with H.
 * Allied and neutral pieces never block; adjacent targets need no line of sight; a line along a
 * hex edge may use whichever neighbouring hex keeps it clear.
 */
import { type Axial, distance, hexEquals, hexKey, type HexKey } from '../hex';
import type { AnalysisIndex, Side } from './analysisIndex';
import { lineTraces } from './hexLine';

export interface Blocker {
  readonly hex: Axial;
  readonly reason: 'terrain' | 'enemy';
  readonly elevation: number;
}

export interface SightLine {
  readonly visible: boolean;
  /** Intermediate hexes of the trace used (the clear one when there was a choice). */
  readonly line: readonly Axial[];
  readonly blocker: Blocker | null;
}

const firstBlocker = (
  ai: AnalysisIndex,
  side: Side,
  p: number,
  t: number,
  line: readonly Axial[],
): Blocker | null => {
  const high = Math.max(p, t);
  for (const hex of line) {
    const e = ai.elevation(hex);
    if (e > high || (p !== t && e === high)) return { hex, reason: 'terrain', elevation: e };
    if (ai.enemyObstacle(hex, side) && (p === t ? e === p : e === high)) {
      return { hex, reason: 'enemy', elevation: e };
    }
  }
  return null;
};

/** Sight line from the probe to one target hex (a hypothetical unit standing there). */
export const traceSightLine = (
  ai: AnalysisIndex,
  probe: Axial,
  side: Side,
  target: Axial,
): SightLine => {
  if (hexEquals(probe, target) || distance(probe, target) <= 1) {
    return { visible: true, line: [], blocker: null };
  }
  const p = ai.elevation(probe);
  const t = ai.elevation(target);
  const traces = lineTraces(probe, target);
  let first: SightLine | null = null;
  for (const line of traces) {
    const blocker = firstBlocker(ai, side, p, t, line);
    if (!blocker) return { visible: true, line, blocker: null };
    first ??= { visible: false, line, blocker };
  }
  return first!;
};

/** Visibility of every board hex (except the probe's own) from the probe. */
export const lineOfSight = (
  ai: AnalysisIndex,
  hexes: readonly Axial[],
  probe: Axial,
  side: Side,
): Map<HexKey, boolean> => {
  const out = new Map<HexKey, boolean>();
  for (const h of hexes) {
    if (hexEquals(h, probe)) continue;
    out.set(hexKey(h), traceSightLine(ai, probe, side, h).visible);
  }
  return out;
};
