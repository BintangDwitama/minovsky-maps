/**
 * The hexes a straight centre-to-centre line passes through.
 *
 * Interpolating in cube coordinates and rounding gives the usual hex line. When the line runs
 * exactly along an edge between two hexes, rounding is ambiguous, so we trace twice with a tiny
 * nudge to either side. If both traces agree the line is unambiguous; if they differ, the rules
 * let the acting player pick either hex, so callers accept whichever trace is more favourable.
 */
import { type Axial, distance, hexEquals, hexRound } from '../hex';

const EPS = 1e-6;

const trace = (a: Axial, b: Axial, nudge: number): Axial[] => {
  const n = distance(a, b);
  const out: Axial[] = [];
  // nudge q and r (s = -q - r follows) so the cube constraint still holds
  const aq = a.q + nudge;
  const ar = a.r + 2 * nudge;
  const bq = b.q + nudge;
  const br = b.r + 2 * nudge;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    out.push(hexRound({ q: aq + (bq - aq) * t, r: ar + (br - ar) * t }));
  }
  return out;
};

const sameTrace = (x: readonly Axial[], y: readonly Axial[]) =>
  x.length === y.length && x.every((h, i) => hexEquals(h, y[i]!));

/**
 * Intermediate hexes (excluding both ends) for each distinct way the line can be read:
 * one trace for ordinary lines, two when the line runs along hex edges.
 */
export const lineTraces = (from: Axial, to: Axial): Axial[][] => {
  const plus = trace(from, to, EPS);
  const minus = trace(from, to, -EPS);
  return sameTrace(plus, minus) ? [plus] : [plus, minus];
};
