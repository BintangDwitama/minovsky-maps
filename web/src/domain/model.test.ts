import { describe, expect, it } from 'vitest';
import { COMPONENT_KINDS, carrierHexes, footprint, kindDef } from './components/registry';
import { neighbor } from './hex';
import { checkIntegrity } from './integrity';
import { createScenario, DEFAULT_RULES, rectangleSize } from './scenario';
import { buildIndex, componentsAt, elevationAt, tagsAt } from './scenarioIndex';
import { readScenarioFixture } from './testing/fixtures';

describe('createScenario', () => {
  it('defaults to an empty 15x15 board with default rules', () => {
    const s = createScenario();
    expect(s.schemaVersion).toBe(1);
    expect(s.board.hexes).toHaveLength(225);
    expect(s.elevation).toEqual([]);
    expect(s.components).toEqual([]);
    expect(s.goals).toEqual([]);
    expect(s.rules).toEqual(DEFAULT_RULES);
    expect(rectangleSize(s)).toEqual({ width: 15, height: 15 });
  });

  it('supports custom sizes and rejects out-of-range sizes', () => {
    expect(createScenario({ width: 12, height: 18 }).board.hexes).toHaveLength(216);
    expect(() => createScenario({ width: 0 })).toThrow(RangeError);
    expect(() => createScenario({ height: 41 })).toThrow(RangeError);
  });
});

describe('component registry', () => {
  it('knows all eight kinds', () => {
    expect(COMPONENT_KINDS).toEqual([
      'base', 'carrier', 'garrison', 'upgrade', 'energy', 'objective', 'token', 'structure',
    ]);
  });

  it('carrier footprint is front, middle, back along facing', () => {
    const c = kindDef('carrier').create({ id: 'c', hex: { q: 5, r: 5 }, facing: 0, owner: 'A' });
    expect(footprint(c)).toEqual([
      neighbor({ q: 5, r: 5 }, 0),
      { q: 5, r: 5 },
      neighbor({ q: 5, r: 5 }, 3),
    ]);
    expect(carrierHexes({ q: 0, r: 0 }, 2).front).toEqual({ q: 1, r: 0 });
  });

  it('owner rules per kind', () => {
    expect(kindDef('base').allowedOwners).toEqual(['A', 'B']);
    expect(kindDef('upgrade').allowedOwners).toEqual(['neutral']);
    expect(kindDef('token').allowedOwners).toEqual(['A', 'B', 'neutral']);
  });

  it('create() coerces owners to what the kind allows', () => {
    expect(kindDef('energy').create({ id: 'e', hex: { q: 0, r: 0 }, owner: 'A' }).owner).toBe('neutral');
    expect(kindDef('garrison').create({ id: 'g', hex: { q: 0, r: 0 }, owner: 'B' }).owner).toBe('B');
  });
});

describe('buildIndex', () => {
  it('indexes tags, elevation and components (carrier on all three hexes)', () => {
    const s = readScenarioFixture('full.scenario.json');
    const idx = buildIndex(s);
    expect(idx.hexes.size).toBe(7);
    expect(tagsAt(idx, { q: 1, r: 0 })).toEqual(['water', 'minovsky']);
    expect(elevationAt(idx, { q: 1, r: -1 })).toBe(2);
    expect(elevationAt(idx, { q: -1, r: 0 })).toBe(0);
    const north = componentsAt(idx, { q: 0, r: -1 }).map((c) => c.id);
    expect(north).toContain('c-carrier');
    expect(idx.componentById.get('c-base')?.kind).toBe('base');
  });

  it('is memoised per scenario object', () => {
    const s = createScenario();
    expect(buildIndex(s)).toBe(buildIndex(s));
  });
});

describe('checkIntegrity', () => {
  it('accepts the valid fixtures', () => {
    expect(checkIntegrity(readScenarioFixture('minimal.scenario.json'))).toEqual([]);
    expect(checkIntegrity(readScenarioFixture('full.scenario.json'))).toEqual([]);
  });

  it.each([
    ['duplicate-hex.json', 'duplicate-hex'],
    ['off-board-carrier.json', 'component-off-board'],
    ['off-board-elevation.json', 'elevation-off-board'],
    ['neutral-base.json', 'owner-not-allowed'],
  ])('%s -> %s', (file, code) => {
    const errors = checkIntegrity(readScenarioFixture(`invalid/${file}`));
    expect(errors.map((e) => e.code)).toContain(code);
  });

  it('names the component and hex for off-board components', () => {
    const [err] = checkIntegrity(readScenarioFixture('invalid/off-board-carrier.json'));
    expect(err?.componentId).toBe('c');
    expect(err?.message).toMatch(/\(0, -1\)|\(0, 1\)/);
  });

  it('flags tokens without labels', () => {
    const s = createScenario({ width: 2, height: 2 });
    s.components.push({ id: 't', kind: 'token', owner: 'neutral', hex: { q: 0, r: 0 }, label: ' ' });
    expect(checkIntegrity(s).map((e) => e.code)).toEqual(['label-required']);
  });
});
