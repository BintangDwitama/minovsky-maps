import { describe, expect, it } from 'vitest';
import { startCursor, stepCursor } from './boardCursor';
import { describeBoard, describeHex } from './boardDescription';
import { axialToOffset, hexKey, offsetToAxial } from './hex';
import { createScenario, type Scenario } from './scenario';
import { buildIndex } from './scenarioIndex';
import { loadScenario } from './serialization';
import { readFixture } from './testing/fixtures';

const at = (col: number, row: number) => offsetToAxial({ col, row });
const off = (h: { q: number; r: number }) => axialToOffset(h);

const mesa = (): Scenario => {
  const r = loadScenario(readFixture('sample-mesa.scenario.json'));
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.scenario;
};

describe('board cursor', () => {
  const s = createScenario({ width: 5, height: 4 });
  const idx = buildIndex(s);

  it('moves by column and row', () => {
    expect(off(stepCursor(idx, at(2, 2), 'right').hex)).toEqual({ col: 3, row: 2 });
    expect(off(stepCursor(idx, at(2, 2), 'left').hex)).toEqual({ col: 1, row: 2 });
    expect(off(stepCursor(idx, at(2, 2), 'up').hex)).toEqual({ col: 2, row: 1 });
    expect(off(stepCursor(idx, at(2, 2), 'down').hex)).toEqual({ col: 2, row: 3 });
  });

  it('stays at the edge', () => {
    const first = off(startCursor(idx, at(0, 0)));
    const step = stepCursor(idx, at(first.col, first.row), 'up');
    expect(step.edge).toBe(true);
    expect(off(step.hex)).toEqual(first);
  });

  it('skips gaps in custom boards', () => {
    const holed: Scenario = {
      ...s,
      board: {
        ...s.board,
        hexes: s.board.hexes.filter(
          (h) => hexKey(h) !== hexKey(at(2, 2)),
        ) as Scenario['board']['hexes'],
      },
    };
    const i2 = buildIndex(holed);
    const step = stepCursor(i2, at(1, 2), 'right');
    expect(step.edge).toBe(false);
    expect(off(step.hex)).toEqual({ col: 3, row: 2 });
  });

  it('starts on the preferred hex, else the centre', () => {
    expect(off(startCursor(idx, at(4, 3)))).toEqual({ col: 4, row: 3 });
    expect(off(startCursor(idx, at(40, 40)))).toEqual({ col: 2, row: 1 });
    expect(off(startCursor(buildIndex(createScenario({ width: 15, height: 15 }))))).toEqual({
      col: 7,
      row: 7,
    });
  });
});

describe('board in words', () => {
  it('describes a hex', () => {
    const s = mesa();
    const idx = buildIndex(s);
    const relay = s.components.find((c) => c.kind === 'objective' && c.label === 'East relay')!;
    const text = describeHex(idx, relay.hex);
    expect(text).toMatch(/^\d+, \d+\. Level 1\. Objective “East relay”, Neutral\.$/);
  });

  it('describes terrain and components on one hex', () => {
    const base = createScenario({ width: 3, height: 3 });
    const h = at(1, 1);
    const s: Scenario = {
      ...base,
      board: {
        ...base.board,
        hexes: base.board.hexes.map((x) =>
          hexKey(x) === hexKey(h) ? { ...x, tags: ['water'] } : x,
        ) as Scenario['board']['hexes'],
      },
      elevation: [{ q: h.q, r: h.r, level: 2 }],
      components: [{ id: 'g', kind: 'garrison', owner: 'A', hex: h }],
    };
    expect(describeHex(buildIndex(s), h)).toBe('1, 1. Level 2. Water. Garrison, Side A.');
  });

  it('describes the Desert Mesa board', () => {
    const d = describeBoard(mesa());
    expect(d.size).toBe('15 × 15 hexes');
    expect(d.flat).toBe(false);
    expect(d.levels.map((l) => [l.level, l.hexes.length])).toEqual([
      [1, 22],
      [2, 8],
    ]);
    const a = d.sides.find((g) => g.side === 'A')!;
    expect(a.items.filter((t) => t.startsWith('Base on'))).toHaveLength(1);
    expect(a.items.filter((t) => t.startsWith('Garrison on'))).toHaveLength(3);
    const neutral = d.sides.find((g) => g.side === 'neutral')!.items;
    expect(neutral.some((t) => /^Objective “Data core” on \d+, \d+, level 2$/.test(t))).toBe(true);
  });

  it('orders hexes by column then row', () => {
    const d = describeBoard(mesa());
    const nums = d.levels[0]!.hexes.map((t) => t.split(', ').map(Number) as [number, number]);
    const sorted = [...nums].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    expect(nums).toEqual(sorted);
  });

  it('gives a carrier its middle hex and facing', () => {
    const base = createScenario({ width: 5, height: 5 });
    const s: Scenario = {
      ...base,
      components: [{ id: 'c', kind: 'carrier', owner: 'B', hex: at(2, 2), facing: 1 }],
    };
    expect(describeBoard(s).sides[0]!.items).toEqual(['Carrier facing NE, middle on 2, 2']);
  });

  it('says an empty board is flat with nothing on it', () => {
    const d = describeBoard(createScenario({ width: 4, height: 3 }));
    expect(d).toEqual({ size: '4 × 3 hexes', levels: [], terrain: [], sides: [], flat: true });
  });
});
