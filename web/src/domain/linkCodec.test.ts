import { describe, expect, it } from 'vitest';
import { offsetToAxial } from './hex';
import { canonicalize, fromCompact, toCompact } from './linkCodec';
import { addGoal, paintTags, placeComponent, setElevation, updateMeta } from './operations';
import { createScenario, type Scenario } from './scenario';
import { loadScenario } from './serialization';
import { readFixture } from './testing/fixtures';

const at = (col: number, row: number) => offsetToAxial({ col, row });

const fixture = (name: string): Scenario => {
  const r = loadScenario(readFixture(name));
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.scenario;
};

/** Through JSON, as in a real link. */
const roundTrip = (s: Scenario): Scenario => {
  const expanded = fromCompact(JSON.parse(JSON.stringify(toCompact(s))));
  if (!expanded.ok) throw new Error(expanded.error);
  const r = loadScenario(expanded.doc);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.scenario;
};

const busyScenario = (): Scenario => {
  let s = updateMeta(createScenario({ width: 12, height: 9 }), {
    name: 'Ünïcode & "quotes"',
    author: 'tester',
  });
  s = paintTags(s, [at(1, 1), at(2, 1)], 'water', 'add');
  s = paintTags(s, [at(2, 1), at(5, 5)], 'minovsky', 'add');
  s = paintTags(s, [at(6, 6)], 'impassable', 'add');
  s = setElevation(s, [at(3, 3), at(3, 4)], 2);
  s = setElevation(s, [at(8, 2)], 9);
  const place = (
    kind: Parameters<typeof placeComponent>[1],
    p: Parameters<typeof placeComponent>[2],
  ) => {
    const r = placeComponent(s, kind, p);
    if (!r.ok) throw new Error(r.reason);
    s = r.scenario;
  };
  place('base', { id: 'x1', hex: at(0, 4), owner: 'A' });
  place('carrier', { id: 'x2', hex: at(5, 2), owner: 'B', facing: 4 });
  place('upgrade', { id: 'x3', hex: at(4, 4), upgradeType: 'speed' });
  place('objective', { id: 'x4', hex: at(6, 4), objectiveType: 'carryable' });
  place('objective', { id: 'x5', hex: at(7, 4), objectiveType: 'controllable', label: 'Relay' });
  place('token', { id: 'x6', hex: at(9, 7), owner: 'neutral', label: 'Supply', note: 'Heals 1' });
  place('structure', { id: 'x7', hex: at(10, 7), owner: 'A', label: 'Wall' });
  s = addGoal(s, { id: 'gx', text: 'Hold the relay', vp: 3, scoring: 'phase2' });
  return { ...s, rules: { ...s.rules, massProducedLimit: 2 } };
};

describe('link codec v1', () => {
  it.each(['minimal.scenario.json', 'full.scenario.json', 'sample-mesa.scenario.json'])(
    'round-trips %s',
    (name) => {
      const s = fixture(name);
      expect(canonicalize(roundTrip(s))).toEqual(canonicalize(s));
    },
  );

  it('round-trips every component kind, terrain overlap, elevation and optional fields', () => {
    const s = busyScenario();
    expect(canonicalize(roundTrip(s))).toEqual(canonicalize(s));
  });

  it('stores a rectangular board as its size and an irregular one as a hex list', () => {
    expect(toCompact(fixture('sample-mesa.scenario.json')).b).toEqual([15, 15]);
    const full = fixture('full.scenario.json');
    const b = toCompact(full).b;
    expect(Array.isArray(b)).toBe(false);
    expect((b as { x: unknown[] }).x).toHaveLength(full.board.hexes.length);
  });

  it('omits ids, defaults and empty sections', () => {
    const c = toCompact(createScenario({ width: 3, height: 3 }));
    expect(c).toEqual({ v: 1, m: { name: 'Untitled scenario' }, b: [3, 3], r: c.r });
    expect(JSON.stringify(toCompact(busyScenario()))).not.toContain('"x1"');
  });

  it('assigns fresh sequential ids', () => {
    const r = roundTrip(busyScenario());
    expect(r.components.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
    expect(r.goals.map((g) => g.id)).toEqual(['g1']);
  });

  it.each([
    ['not an object', [1, 2]],
    ['bad board', { v: 1, m: { name: 'x' }, b: [0, 3], r: {} }],
    ['huge board', { v: 1, m: { name: 'x' }, b: [1000, 1000], r: {} }],
    ['index out of range', { v: 1, m: { name: 'x' }, b: [2, 2], t: { water: [4] }, r: {} }],
    ['unknown tag', { v: 1, m: { name: 'x' }, b: [2, 2], t: { lava: [0] }, r: {} }],
    ['unknown kind', { v: 1, m: { name: 'x' }, b: [2, 2], c: [['mech', 0]], r: {} }],
    ['bad goal', { v: 1, m: { name: 'x' }, b: [2, 2], g: [['x', 1]], r: {} }],
  ])('rejects malformed data without throwing: %s', (_label, value) => {
    const r = fromCompact(value);
    expect(r.ok).toBe(false);
  });

  it('leaves semantic checks to loadScenario', () => {
    const bad = {
      v: 1,
      m: { name: '' },
      b: [2, 2],
      r: { deployment: 'bases', squadSize: 3, terrainSetup: 'fixed' },
    };
    const r = fromCompact(bad);
    expect(r.ok).toBe(true);
    if (r.ok) expect(loadScenario(r.doc).ok).toBe(false);
  });
});
