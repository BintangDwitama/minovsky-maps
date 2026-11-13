import { describe, expect, it } from 'vitest';
import { type Axial, hexKey, offsetToAxial } from '../hex';
import { paintTags, placeComponent, setElevation } from '../operations';
import { createScenario, type ComponentKind, type Owner, type Scenario } from '../scenario';
import { buildAnalysisIndex } from './analysisIndex';
import { lineTraces } from './hexLine';
import { lineOfSight, traceSightLine } from './lineOfSight';
import { isEngaged, reach, type ReachOptions } from './reach';

const at = (col: number, row: number) => offsetToAxial({ col, row });

/** Small board builder: elevations, tags and pieces by offset coordinates. */
const board = (
  width: number,
  height: number,
  opts: {
    levels?: [number, number, number][];
    tags?: [number, number, 'water' | 'debris' | 'impassable' | 'minovsky'][];
    pieces?: [ComponentKind, Owner, number, number][];
  } = {},
): Scenario => {
  let s = createScenario({ width, height });
  for (const [c, r, level] of opts.levels ?? []) s = setElevation(s, [at(c, r)], level);
  for (const [c, r, tag] of opts.tags ?? []) s = paintTags(s, [at(c, r)], tag, 'add');
  (opts.pieces ?? []).forEach(([kind, owner, c, r], i) => {
    const res = placeComponent(s, kind, { id: `p${i}`, hex: at(c, r), owner, label: 'x' });
    if (!res.ok) throw new Error(res.reason);
    s = res.scenario;
  });
  return s;
};

const sees = (s: Scenario, probe: Axial, target: Axial, side: 'A' | 'B' = 'A') =>
  traceSightLine(buildAnalysisIndex(s), probe, side, target).visible;

describe('hex line traces', () => {
  it('a straight line has one trace through the hexes between', () => {
    const traces = lineTraces(at(2, 0), at(2, 4));
    expect(traces).toHaveLength(1);
    expect(traces[0]).toEqual([at(2, 1), at(2, 2), at(2, 3)]);
  });

  it('a line along a hex edge offers both neighbouring hexes', () => {
    // (0,0) to (1,1) passes exactly between (1,0) and (0,1)
    const traces = lineTraces({ q: 0, r: 0 }, { q: 1, r: 1 });
    expect(traces).toHaveLength(2);
    expect(traces.flat().map(hexKey).sort()).toEqual(['0,1', '1,0']);
  });
});

describe('line of sight', () => {
  // probe at the top of column 2, target four hexes below; the hexes between are rows 1–3
  const probe = at(2, 0);
  const target = at(2, 4);

  it('a ridge between two units at ground level blocks', () => {
    expect(sees(board(5, 5, { levels: [[2, 2, 1]] }), probe, target)).toBe(false);
  });

  it('a plateau at the same level as both units does not block', () => {
    const s = board(5, 5, {
      levels: [0, 1, 2, 3, 4].map((r) => [2, r, 2] as [number, number, number]),
    });
    expect(sees(s, probe, target)).toBe(true);
  });

  it('terrain higher than both blocks even on a plateau', () => {
    const s = board(5, 5, {
      levels: [
        [2, 0, 2],
        [2, 2, 3],
        [2, 4, 2],
      ],
    });
    expect(sees(s, probe, target)).toBe(false);
  });

  it('from high ground, terrain level with the shooter blocks a lower target', () => {
    const s = board(5, 5, {
      levels: [
        [2, 0, 2],
        [2, 2, 2],
      ],
    });
    expect(sees(s, probe, target)).toBe(false);
  });

  it('from high ground, lower terrain on the way does not block', () => {
    const s = board(5, 5, {
      levels: [
        [2, 0, 2],
        [2, 2, 1],
      ],
    });
    expect(sees(s, probe, target)).toBe(true);
  });

  it('works the same looking up: a ledge level with the higher target blocks', () => {
    const s = board(5, 5, {
      levels: [
        [2, 4, 1],
        [2, 2, 1],
      ],
    });
    expect(sees(s, probe, target)).toBe(false);
  });

  it('an enemy piece at the same level as both blocks; for its owner it does not', () => {
    const s = board(5, 5, { pieces: [['garrison', 'B', 2, 2]] });
    expect(sees(s, probe, target, 'A')).toBe(false);
    expect(sees(s, probe, target, 'B')).toBe(true);
  });

  it('enemy bases, carriers and structures block too', () => {
    expect(sees(board(5, 5, { pieces: [['base', 'B', 2, 2]] }), probe, target)).toBe(false);
    expect(sees(board(5, 5, { pieces: [['structure', 'B', 2, 2]] }), probe, target)).toBe(false);
    // carrier in column 4 rows 1–3 (middle at row 2, facing north); probe looks down column 4
    expect(sees(board(5, 5, { pieces: [['carrier', 'B', 4, 2]] }), at(4, 0), at(4, 4))).toBe(false);
  });

  it('neutral pieces and objectives never block', () => {
    expect(sees(board(5, 5, { pieces: [['structure', 'neutral', 2, 2]] }), probe, target)).toBe(
      true,
    );
    expect(sees(board(5, 5, { pieces: [['objective', 'neutral', 2, 2]] }), probe, target)).toBe(
      true,
    );
  });

  it('shooting over a lower enemy is clear', () => {
    const s = board(5, 5, {
      levels: [
        [2, 0, 1],
        [2, 4, 1],
      ],
      pieces: [['base', 'B', 2, 2]],
    });
    expect(sees(s, probe, target)).toBe(true);
  });

  it('from high ground, an enemy at the lower target’s level does not block', () => {
    const s = board(5, 5, { levels: [[2, 0, 1]], pieces: [['garrison', 'B', 2, 2]] });
    expect(sees(s, probe, target)).toBe(true);
  });

  it('a line along a hex edge is clear if either side is clear', () => {
    const p = { q: 0, r: 0 };
    const t = { q: 1, r: 1 };
    const oneSide = board(4, 4, { levels: [[1, 0, 1]] }); // (1,0) is col 1 row 0
    expect(sees(oneSide, p, t)).toBe(true);
    const bothSides = board(4, 4, {
      levels: [
        [1, 0, 1],
        [0, 1, 1],
      ],
    });
    expect(sees(bothSides, p, t)).toBe(false);
  });

  it('adjacent targets are always visible', () => {
    const s = board(5, 5, { levels: [[2, 1, 5]] });
    expect(sees(s, probe, at(2, 1))).toBe(true);
  });

  it('reports the first blocker and its reason', () => {
    const s = board(5, 5, { levels: [[2, 3, 2]], pieces: [['garrison', 'B', 2, 2]] });
    const r = traceSightLine(buildAnalysisIndex(s), probe, 'A', target);
    expect(r.blocker).toMatchObject({ hex: at(2, 2), reason: 'enemy', elevation: 0 });
  });

  it('maps visibility for every hex except the probe', () => {
    const s = board(5, 5, { levels: [[2, 2, 1]] });
    const map = lineOfSight(buildAnalysisIndex(s), s.board.hexes, probe, 'A');
    expect(map.size).toBe(24);
    expect(map.get(hexKey(target))).toBe(false);
    expect(map.get(hexKey(at(2, 1)))).toBe(true);
  });
});

describe('reach', () => {
  const opts = (o: Partial<ReachOptions> = {}): ReachOptions => ({
    side: 'A',
    move: 3,
    speed: 0,
    engaged: false,
    hover: false,
    ...o,
  });
  const run = (s: Scenario, probe: Axial, o?: Partial<ReachOptions>) =>
    reach(buildAnalysisIndex(s), probe, opts(o));
  const cost = (r: ReturnType<typeof run>, h: Axial) => r.costs.get(hexKey(h));

  it('flat ground: up to 3 hexes away, never the start hex', () => {
    const r = run(board(9, 9), at(4, 4));
    expect(r.allowance).toBe(3);
    expect(cost(r, at(4, 1))).toBe(3);
    expect(cost(r, at(4, 0))).toBeUndefined();
    expect(cost(r, at(4, 4))).toBeUndefined();
  });

  it('climbing costs one extra per level; descending is free', () => {
    const s = board(1, 5, {
      levels: [
        [0, 1, 1],
        [0, 2, 1],
      ],
    });
    const r = run(s, at(0, 0));
    expect(cost(r, at(0, 1))).toBe(2);
    expect(cost(r, at(0, 2))).toBe(3);
    const down = run(board(1, 5, { levels: [[0, 0, 2]] }), at(0, 0));
    expect(cost(down, at(0, 1))).toBe(1);
  });

  it('two levels in one step costs two extra', () => {
    const r = run(board(1, 5, { levels: [[0, 1, 2]] }), at(0, 0));
    expect(cost(r, at(0, 1))).toBe(3);
  });

  it('starting in water or debris costs 1 each from the allowance', () => {
    expect(run(board(9, 9, { tags: [[4, 4, 'water']] }), at(4, 4)).allowance).toBe(2);
    const both = run(
      board(9, 9, {
        tags: [
          [4, 4, 'water'],
          [4, 4, 'debris'],
        ],
      }),
      at(4, 4),
    );
    expect(both.allowance).toBe(1);
    expect(both.penalties).toEqual(['water', 'debris']);
  });

  it('Speed adds to the allowance; Engaged takes one away', () => {
    expect(run(board(9, 9), at(4, 4), { speed: 2 }).allowance).toBe(5);
    expect(run(board(9, 9), at(4, 4), { engaged: true }).allowance).toBe(2);
  });

  it('jumping from high ground crosses a gap without paying to climb back', () => {
    const s = board(1, 5, {
      levels: [
        [0, 0, 1],
        [0, 2, 1],
      ],
    });
    const r = run(s, at(0, 0));
    expect(cost(r, at(0, 2))).toBe(2);
    // the same gap from the ground pays for the climb
    const ground = board(1, 5, { levels: [[0, 2, 1]] });
    expect(cost(run(ground, at(0, 0)), at(0, 2))).toBe(3);
  });

  it('jumping pays only for levels above the start', () => {
    const s = board(1, 5, {
      levels: [
        [0, 0, 1],
        [0, 1, 2],
        [0, 2, 2],
      ],
    });
    const r = run(s, at(0, 0));
    expect(cost(r, at(0, 1))).toBe(2);
    expect(cost(r, at(0, 2))).toBe(3);
  });

  it('enemy obstacles cannot be passed; allies can be passed but not ended on', () => {
    const enemy = run(board(1, 6, { pieces: [['base', 'B', 0, 2]] }), at(0, 0));
    expect(cost(enemy, at(0, 1))).toBe(1);
    expect(cost(enemy, at(0, 2))).toBeUndefined();
    expect(cost(enemy, at(0, 3))).toBeUndefined();
    const ally = run(board(1, 6, { pieces: [['base', 'A', 0, 2]] }), at(0, 0));
    expect(cost(ally, at(0, 2))).toBeUndefined();
    expect(cost(ally, at(0, 3))).toBe(3);
  });

  it('a jumping unit passes over a lower enemy', () => {
    const s = board(1, 5, {
      levels: [
        [0, 0, 1],
        [0, 2, 1],
      ],
      pieces: [['garrison', 'B', 0, 1]],
    });
    const r = run(s, at(0, 0));
    expect(cost(r, at(0, 1))).toBeUndefined();
    expect(cost(r, at(0, 2))).toBe(2);
  });

  it('impassable terrain needs Hover, and is never an end hex', () => {
    const s = board(1, 5, { tags: [[0, 1, 'impassable']] });
    expect(cost(run(s, at(0, 0)), at(0, 2))).toBeUndefined();
    const hover = run(s, at(0, 0), { hover: true });
    expect(cost(hover, at(0, 1))).toBeUndefined();
    expect(cost(hover, at(0, 2))).toBe(2);
  });

  it('pieces that are not obstacles can be ended on', () => {
    const r = run(board(1, 4, { pieces: [['energy', 'neutral', 0, 1]] }), at(0, 0));
    expect(cost(r, at(0, 1))).toBe(1);
  });
});

describe('engagement', () => {
  it('an adjacent enemy garrison at the same level engages', () => {
    const s = board(5, 5, { pieces: [['garrison', 'B', 2, 3]] });
    expect(isEngaged(buildAnalysisIndex(s), at(2, 2), 'A')).toBe(true);
    expect(isEngaged(buildAnalysisIndex(s), at(2, 2), 'B')).toBe(false);
  });

  it('a garrison at another level, a base, or a distant garrison does not', () => {
    const higher = board(5, 5, { levels: [[2, 3, 1]], pieces: [['garrison', 'B', 2, 3]] });
    expect(isEngaged(buildAnalysisIndex(higher), at(2, 2), 'A')).toBe(false);
    const base = board(5, 5, { pieces: [['base', 'B', 2, 3]] });
    expect(isEngaged(buildAnalysisIndex(base), at(2, 2), 'A')).toBe(false);
    const far = board(5, 5, { pieces: [['garrison', 'B', 2, 4]] });
    expect(isEngaged(buildAnalysisIndex(far), at(2, 2), 'A')).toBe(false);
  });
});
