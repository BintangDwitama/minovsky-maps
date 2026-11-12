import { describe, expect, it } from 'vitest';
import { offsetToAxial } from './hex';
import { paintTags, placeComponent, setElevation, updateRules, type OpResult } from './operations';
import { createScenario, type Scenario } from './scenario';
import { computeWarnings, pillarCount, WARNING_RULES, type WarningRule } from './warnings';

const at = (col: number, row: number) => offsetToAxial({ col, row });
const unwrap = (r: OpResult): Scenario => {
  if (!r.ok) throw new Error(r.reason);
  return r.scenario;
};
const codes = (s: Scenario) => computeWarnings(s).map((w) => w.code);

/** Both sides have a base, nothing else: should be warning-free. */
const clean = (): Scenario => {
  let s = createScenario();
  s = unwrap(placeComponent(s, 'base', { id: 'a', hex: at(0, 7), owner: 'A' }));
  s = unwrap(placeComponent(s, 'base', { id: 'b', hex: at(14, 7), owner: 'B' }));
  return s;
};

describe('warning rules', () => {
  it('clean scenario has no warnings', () => {
    expect(computeWarnings(clean())).toEqual([]);
  });

  it('component-on-impassable: positive and negative', () => {
    let s = unwrap(placeComponent(clean(), 'objective', { id: 'o', hex: at(7, 7) }));
    expect(codes(s)).not.toContain('component-on-impassable');
    s = paintTags(s, [at(7, 7)], 'impassable', 'add');
    const w = computeWarnings(s).find((x) => x.code === 'component-on-impassable');
    expect(w?.componentIds).toEqual(['o']);
    expect(w?.hexes).toEqual([at(7, 7)]);
  });

  it('stacked-components: positive and negative (carrier hexes count)', () => {
    let s = unwrap(placeComponent(clean(), 'energy', { id: 'e', hex: at(5, 5) }));
    expect(codes(s)).not.toContain('stacked-components');
    s = updateRules(s, { deployment: 'bases' });
    s = unwrap(placeComponent(s, 'carrier', { id: 'c', hex: at(5, 6), facing: 0, owner: 'A' })); // front = (5,5)
    const w = computeWarnings(s).find((x) => x.code === 'stacked-components');
    expect(w?.componentIds.slice().sort()).toEqual(['c', 'e']);
  });

  it('carrier-uneven-elevation: positive and negative', () => {
    let s = updateRules(createScenario(), { deployment: 'carriers' });
    s = unwrap(placeComponent(s, 'carrier', { id: 'c', hex: at(5, 5), facing: 0, owner: 'A' }));
    expect(codes(s)).not.toContain('carrier-uneven-elevation');
    s = setElevation(s, [at(5, 5)], 1);
    const w = computeWarnings(s).find((x) => x.code === 'carrier-uneven-elevation');
    expect(w?.componentIds).toEqual(['c']);
    expect(w?.hexes).toHaveLength(3);
  });

  it('deployment-mismatch: positive and negative', () => {
    expect(codes(clean())).not.toContain('deployment-mismatch');
    const s = updateRules(clean(), { deployment: 'carriers' });
    expect(codes(s)).toContain('deployment-mismatch');
  });

  it('missing-deployment-point names the side', () => {
    expect(codes(clean())).not.toContain('missing-deployment-point');
    const s = unwrap(placeComponent(createScenario(), 'base', { id: 'a', hex: at(0, 7), owner: 'A' }));
    const ws = computeWarnings(s).filter((w) => w.code === 'missing-deployment-point');
    expect(ws).toHaveLength(1);
    expect(ws[0]?.message).toMatch(/Side B/);
  });

  it('accepts a custom rule list (open/closed)', () => {
    const custom: WarningRule = {
      code: 'always',
      check: () => [{ code: 'always', message: 'hi', hexes: [], componentIds: [] }],
    };
    expect(computeWarnings(clean(), [...WARNING_RULES, custom]).map((w) => w.code)).toEqual(['always']);
  });
});

describe('pillarCount', () => {
  it('sums levels and breaks down by level', () => {
    let s = createScenario();
    s = setElevation(s, [at(0, 0), at(1, 0), at(2, 0), at(3, 0)], 1);
    s = setElevation(s, [at(5, 5), at(6, 6)], 2);
    expect(pillarCount(s)).toEqual({
      total: 8,
      byLevel: [
        { level: 1, hexes: 4 },
        { level: 2, hexes: 2 },
      ],
    });
  });

  it('is zero for a flat board', () => {
    expect(pillarCount(createScenario())).toEqual({ total: 0, byLevel: [] });
  });
});
