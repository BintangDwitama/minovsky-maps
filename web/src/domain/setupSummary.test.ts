import { describe, expect, it } from 'vitest';
import { createScenario, type Scenario } from './scenario';
import { loadScenario } from './serialization';
import { countText, setupSummary } from './setupSummary';
import { readFixture } from './testing/fixtures';

const fixture = (name: string): Scenario => {
  const r = loadScenario(readFixture(name));
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.scenario;
};

describe('setupSummary', () => {
  it('summarises the sample scenario', () => {
    const s = fixture('sample-mesa.scenario.json');
    const sum = setupSummary(s);
    expect(sum.pillars.total).toBe(38);
    expect(sum.pillars.byLevel).toEqual([
      { level: 1, hexes: 22 },
      { level: 2, hexes: 8 },
    ]);
    expect(sum.sides.map((x) => x.owner)).toEqual(['A', 'B', 'neutral']);
    const total = sum.sides.flatMap((x) => x.kinds).reduce((n, k) => n + k.count, 0);
    expect(total).toBe(s.components.length);
    const sideA = sum.sides.find((x) => x.owner === 'A')!;
    expect(sideA.kinds.find((k) => k.kind === 'base')?.text).toBe(
      countText('base', s.components.filter((c) => c.owner === 'A' && c.kind === 'base').length),
    );
    expect(sum.labelled.map((l) => l.label)).toEqual(
      expect.arrayContaining(['Data core', 'West relay', 'East relay', 'South outpost']),
    );
  });

  it('lists kinds in registry order and skips empty sides', () => {
    const sum = setupSummary(fixture('full.scenario.json'));
    for (const side of sum.sides) expect(side.kinds.every((k) => k.count > 0)).toBe(true);
  });

  it('reports a flat empty board as needing nothing', () => {
    const sum = setupSummary(createScenario());
    expect(sum.pillars.total).toBe(0);
    expect(sum.sides).toEqual([]);
    expect(sum.labelled).toEqual([]);
  });

  it('pluralises with the registry labels', () => {
    expect(countText('base', 1)).toBe('1 base');
    expect(countText('base', 2)).toBe('2 bases');
    expect(countText('token', 3)).toBe('3 scenario tokens');
    expect(countText('energy', 2)).toBe('2 energy');
  });
});
