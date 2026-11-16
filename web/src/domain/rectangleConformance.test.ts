import { describe, expect, it } from 'vitest';
import { type Axial, offsetToAxial } from './hex';
import { createScenario, rectangleSize, type Scenario } from './scenario';

/**
 * The same board shapes as server/internal/scenario/facets_test.go (TestRectangleRuleMatchesTheWeb):
 * the server's Browse size filter and the web's size labels must agree.
 */
const board = (w: number, h: number, drop: boolean, extra?: Axial): Scenario => {
  const hexes: Axial[] = [];
  for (let col = 0; col < w; col++) {
    for (let row = 0; row < h; row++) {
      if (drop && col === 1 && row === 1) continue;
      hexes.push(offsetToAxial({ col, row }));
    }
  }
  if (extra) hexes.push(extra);
  const s = createScenario({ width: 1, height: 1 });
  return {
    ...s,
    board: {
      ...s.board,
      hexes: hexes.map((h) => ({ q: h.q, r: h.r })) as Scenario['board']['hexes'],
    },
  };
};

describe('rectangleSize matches the server facets', () => {
  it.each([
    [board(15, 15, false), { width: 15, height: 15 }],
    [board(12, 18, false), { width: 12, height: 18 }],
    [board(5, 4, true), null],
    [board(3, 3, false, { q: -1, r: 0 }), null],
  ])('case %#', (s, want) => {
    expect(rectangleSize(s)).toEqual(want);
  });
});
