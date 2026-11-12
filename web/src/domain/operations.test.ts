import { describe, expect, it } from 'vitest';
import { offsetToAxial } from './hex';
import {
  addGoal,
  adjustElevation,
  clearTags,
  moveComponent,
  moveGoal,
  paintTags,
  placeComponent,
  planResize,
  removeComponent,
  removeGoal,
  rotateCarrier,
  setElevation,
  updateComponent,
  updateGoal,
  updateMeta,
  updateRules,
  type OpResult,
} from './operations';
import { createScenario, type Scenario } from './scenario';
import { buildIndex, elevationAt, tagsAt } from './scenarioIndex';

const at = (col: number, row: number) => offsetToAxial({ col, row });
const unwrap = (r: OpResult): Scenario => {
  if (!r.ok) throw new Error(r.reason);
  return r.scenario;
};

describe('terrain tags', () => {
  it('adds a tag to several hexes without touching other tags', () => {
    let s = createScenario();
    s = paintTags(s, [at(0, 0)], 'minovsky', 'add');
    const before = s;
    s = paintTags(s, [at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0)], 'water', 'add');
    const idx = buildIndex(s);
    expect(tagsAt(idx, at(0, 0))).toEqual(['minovsky', 'water']);
    expect(tagsAt(idx, at(4, 0))).toEqual(['water']);
    expect(tagsAt(buildIndex(before), at(1, 0))).toEqual([]); // input untouched
  });

  it('removes a tag and drops empty tag arrays', () => {
    let s = paintTags(createScenario(), [at(1, 1)], 'debris', 'add');
    s = paintTags(s, [at(1, 1)], 'debris', 'remove');
    expect(s.board.hexes.find((h) => h.q === at(1, 1).q && h.r === at(1, 1).r)).not.toHaveProperty('tags');
  });

  it('returns the same object when nothing changes', () => {
    const s = createScenario();
    expect(paintTags(s, [at(0, 0)], 'water', 'remove')).toBe(s);
  });

  it('clearTags removes everything', () => {
    let s = paintTags(createScenario(), [at(2, 2)], 'water', 'add');
    s = paintTags(s, [at(2, 2)], 'impassable', 'add');
    s = clearTags(s, [at(2, 2)]);
    expect(tagsAt(buildIndex(s), at(2, 2))).toEqual([]);
  });
});

describe('elevation', () => {
  it('raises twice to level 2', () => {
    let s = createScenario();
    s = adjustElevation(s, [at(3, 3)], 1);
    s = adjustElevation(s, [at(3, 3)], 1);
    expect(elevationAt(buildIndex(s), at(3, 3))).toBe(2);
  });

  it('never goes below 0 or above 9, and level 0 is not stored', () => {
    let s = adjustElevation(createScenario(), [at(0, 0)], -1);
    expect(s.elevation).toEqual([]);
    s = setElevation(s, [at(0, 0)], 42);
    expect(elevationAt(buildIndex(s), at(0, 0))).toBe(9);
    s = setElevation(s, [at(0, 0)], 0);
    expect(s.elevation).toEqual([]);
  });

  it('ignores off-board hexes', () => {
    const s = createScenario({ width: 2, height: 2 });
    expect(setElevation(s, [{ q: 10, r: 10 }], 3)).toBe(s);
  });
});

describe('components', () => {
  it('places a garrison for side B', () => {
    const s = unwrap(placeComponent(createScenario(), 'garrison', { id: 'g', hex: at(4, 6), owner: 'B' }));
    expect(s.components).toEqual([{ id: 'g', kind: 'garrison', owner: 'B', hex: at(4, 6) }]);
  });

  it('refuses a carrier that would overhang the edge', () => {
    const r = placeComponent(createScenario(), 'carrier', { id: 'c', hex: at(0, 0), facing: 0, owner: 'A' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/off the board/);
  });

  it('refuses a token without a label', () => {
    expect(placeComponent(createScenario(), 'token', { id: 't', hex: at(1, 1) }).ok).toBe(false);
  });

  it('allows stacking (warnings, not errors)', () => {
    let s = unwrap(placeComponent(createScenario(), 'energy', { id: 'e', hex: at(2, 2) }));
    s = unwrap(placeComponent(s, 'upgrade', { id: 'u', hex: at(2, 2), upgradeType: 'speed' }));
    expect(s.components).toHaveLength(2);
  });

  it('moves a base', () => {
    let s = unwrap(placeComponent(createScenario(), 'base', { id: 'b', hex: at(1, 7), owner: 'A' }));
    s = unwrap(moveComponent(s, 'b', at(2, 7)));
    expect(s.components[0]?.hex).toEqual(at(2, 7));
  });

  it('rotates a carrier clockwise and blocks rotation off the board', () => {
    let s = unwrap(placeComponent(createScenario(), 'carrier', { id: 'c', hex: at(5, 5), facing: 0, owner: 'A' }));
    s = unwrap(rotateCarrier(s, 'c', 1));
    expect(s.components[0]).toMatchObject({ facing: 1 });
    s = unwrap(rotateCarrier(s, 'c', -2));
    expect(s.components[0]).toMatchObject({ facing: 5 });

    const edge = unwrap(placeComponent(createScenario(), 'carrier', { id: 'e', hex: at(0, 5), facing: 0, owner: 'B' }));
    expect(rotateCarrier(edge, 'e', 1).ok).toBe(false); // NE/SW axis leaves column 0
  });

  it('updates upgrade type and rejects disallowed owners', () => {
    let s = unwrap(placeComponent(createScenario(), 'upgrade', { id: 'u', hex: at(3, 3), upgradeType: 'shield' }));
    s = unwrap(updateComponent(s, 'u', { upgradeType: 'speed' }));
    expect(s.components[0]).toMatchObject({ upgradeType: 'speed', hex: at(3, 3) });
    expect(updateComponent(s, 'u', { owner: 'A' }).ok).toBe(false);
  });

  it('removes a component', () => {
    const s = unwrap(placeComponent(createScenario(), 'energy', { id: 'e', hex: at(0, 0) }));
    expect(removeComponent(s, 'e').components).toEqual([]);
  });
});

describe('resize', () => {
  it('keeps data on surviving hexes and reports removed components', () => {
    let s = createScenario();
    s = paintTags(s, [at(1, 1), at(14, 14)], 'water', 'add');
    s = setElevation(s, [at(1, 1), at(14, 14)], 2);
    s = unwrap(placeComponent(s, 'garrison', { id: 'far', hex: at(13, 13), owner: 'A' }));
    s = unwrap(placeComponent(s, 'garrison', { id: 'near', hex: at(2, 2), owner: 'B' }));

    const plan = planResize(s, 10, 10);
    expect(plan.scenario.board.hexes).toHaveLength(100);
    expect(plan.removedComponents.map((c) => c.id)).toEqual(['far']);
    const idx = buildIndex(plan.scenario);
    expect(tagsAt(idx, at(1, 1))).toEqual(['water']);
    expect(elevationAt(idx, at(1, 1))).toBe(2);
    expect(plan.scenario.elevation).toHaveLength(1);
  });

  it('growing keeps everything', () => {
    const s = unwrap(placeComponent(createScenario({ width: 5, height: 5 }), 'base', { id: 'b', hex: at(4, 4), owner: 'A' }));
    const plan = planResize(s, 8, 6);
    expect(plan.removedComponents).toEqual([]);
    expect(plan.scenario.board.hexes).toHaveLength(48);
  });
});

describe('meta, rules, goals', () => {
  it('updates meta and drops empty optionals', () => {
    let s = updateMeta(createScenario(), { name: 'Desert Mesa', author: 'x' });
    s = updateMeta(s, { author: '' });
    expect(s.meta).toEqual({ name: 'Desert Mesa' });
  });

  it('switches deployment without touching components', () => {
    const s0 = unwrap(placeComponent(createScenario(), 'base', { id: 'b', hex: at(1, 1), owner: 'A' }));
    const s = updateRules(s0, { deployment: 'carriers' });
    expect(s.rules.deployment).toBe('carriers');
    expect(s.components).toBe(s0.components);
  });

  it('clears mass-produced limit', () => {
    let s = updateRules(createScenario(), { massProducedLimit: 2 });
    s = updateRules(s, { massProducedLimit: undefined });
    expect(s.rules).not.toHaveProperty('massProducedLimit');
  });

  it('adds, edits, reorders and removes goals', () => {
    let s = addGoal(createScenario(), { id: 'g1', text: 'First', vp: 1, scoring: 'phase1' });
    s = addGoal(s, { id: 'g2', text: 'Hold the central objective', vp: 3, scoring: 'each-phase' });
    s = moveGoal(s, 'g2', 0);
    expect(s.goals.map((g) => g.id)).toEqual(['g2', 'g1']);
    s = updateGoal(s, 'g1', { vp: 5 });
    expect(s.goals[1]?.vp).toBe(5);
    s = removeGoal(s, 'g2');
    expect(s.goals.map((g) => g.id)).toEqual(['g1']);
  });
});
