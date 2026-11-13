/**
 * Keyboard cursor on the board. Arrow keys move by offset column/row (the coordinates shown in the
 * hex readout); gaps in custom-shaped boards are skipped. Pure; never stored.
 */
import { type Axial, axialToOffset, offsetToAxial, parseHexKey } from './hex';
import { isOnBoard, type ScenarioIndex } from './scenarioIndex';

export type CursorDirection = 'up' | 'down' | 'left' | 'right';

export interface CursorStep {
  readonly hex: Axial;
  /** True when there is no board hex further in that direction (the cursor stays). */
  readonly edge: boolean;
}

const DELTA: Record<CursorDirection, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

const offsets = (idx: ScenarioIndex) => [...idx.hexes].map((k) => axialToOffset(parseHexKey(k)));

const bounds = (idx: ScenarioIndex) => {
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const { col, row } of offsets(idx)) {
    minC = Math.min(minC, col);
    maxC = Math.max(maxC, col);
    minR = Math.min(minR, row);
    maxR = Math.max(maxR, row);
  }
  return { minC, maxC, minR, maxR };
};

export function stepCursor(idx: ScenarioIndex, cursor: Axial, dir: CursorDirection): CursorStep {
  const { dc, dr } = DELTA[dir];
  const b = bounds(idx);
  let { col, row } = axialToOffset(cursor);
  for (;;) {
    col += dc;
    row += dr;
    if (col < b.minC || col > b.maxC || row < b.minR || row > b.maxR) {
      return { hex: cursor, edge: true };
    }
    const h = offsetToAxial({ col, row });
    if (isOnBoard(idx, h)) return { hex: h, edge: false };
  }
}

/** Where the cursor starts: `preferred` if it is on the board, else the hex nearest the centre. */
export function startCursor(idx: ScenarioIndex, preferred?: Axial | null): Axial {
  if (preferred && isOnBoard(idx, preferred)) return preferred;
  const all = offsets(idx);
  const b = bounds(idx);
  const cc = (b.minC + b.maxC) / 2;
  const cr = (b.minR + b.maxR) / 2;
  let best = all[0]!;
  let bestD = Infinity;
  for (const o of all) {
    const d = (o.col - cc) ** 2 + (o.row - cr) ** 2;
    if (
      d < bestD ||
      (d === bestD && (o.col < best.col || (o.col === best.col && o.row < best.row)))
    ) {
      best = o;
      bestD = d;
    }
  }
  return offsetToAxial(best);
}
