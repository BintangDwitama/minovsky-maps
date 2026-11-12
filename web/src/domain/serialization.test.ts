import { describe, expect, it } from 'vitest';
import { offsetToAxial } from './hex';
import type { Migration } from './migrations';
import { addGoal, paintTags, placeComponent, setElevation, updateMeta } from './operations';
import { createScenario, type Scenario } from './scenario';
import { validateSchema } from './schemaValidator';
import { imageFileName, loadScenario, scenarioFileName, serializeScenario, slugify } from './serialization';
import { listFixtures, readFixture } from './testing/fixtures';
import { computeWarnings, pillarCount } from './warnings';

const at = (col: number, row: number) => offsetToAxial({ col, row });

describe('schema validation of fixtures', () => {
  it.each(['minimal.scenario.json', 'full.scenario.json', 'sample-mesa.scenario.json'])('%s is valid', (f) => {
    expect(validateSchema(readFixture(f))).toMatchObject({ ok: true });
  });

  it('sample mesa loads, is warning-free and needs 38 pillars', () => {
    const r = loadScenario(readFixture('sample-mesa.scenario.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(computeWarnings(r.scenario)).toEqual([]);
    expect(pillarCount(r.scenario)).toEqual({
      total: 38,
      byLevel: [
        { level: 1, hexes: 22 },
        { level: 2, hexes: 8 },
      ],
    });
  });

  it('every invalid fixture is rejected by the full loader', () => {
    for (const f of listFixtures('invalid')) {
      const r = loadScenario(readFixture(`invalid/${f}`));
      expect(r.ok, f).toBe(false);
    }
  });

  it('gives a readable error for an unknown tag', () => {
    const r = loadScenario(readFixture('invalid/unknown-tag.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/board\/hexes\/0\/tags\/0: must be one of "water"/);
  });

  it('focuses oneOf errors on the component kind branch', () => {
    const r = loadScenario(readFixture('invalid/neutral-base.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(['/components/0/owner: must be one of "A", "B"']);
  });

  it('missing name is rejected', () => {
    const r = loadScenario(readFixture('invalid/missing-name.json'));
    if (!r.ok) expect(r.errors[0]).toMatch(/\/meta\/name/);
  });

  it('names component and hex when off board', () => {
    const r = loadScenario(readFixture('invalid/off-board-carrier.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Carrier "c" occupies .* not on the board/);
  });
});

describe('load pipeline', () => {
  it('rejects non-JSON and non-objects', () => {
    expect(loadScenario('{nope').ok).toBe(false);
    expect(loadScenario('[1,2]').ok).toBe(false);
  });

  it('rejects files from a newer format version', () => {
    const r = loadScenario(readFixture('invalid/future-version.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer version/);
  });

  it('runs migrations in order before validating (test-only v0 -> v1)', () => {
    const v0toV1: Migration = {
      from: 0,
      to: 1,
      migrate: (d) => {
        const { title, ...rest } = d as { title: string } & Record<string, unknown>;
        return { ...rest, meta: { name: title } };
      },
    };
    const v1 = createScenario({ width: 1, height: 1 });
    const { meta: _m, ...withoutMeta } = v1;
    const v0 = { ...withoutMeta, schemaVersion: 0, title: 'Old file' };
    const r = loadScenario(v0, { migrations: [v0toV1] });
    expect(r).toMatchObject({ ok: true, migratedFrom: 0 });
    if (r.ok) expect(r.scenario.meta.name).toBe('Old file');
  });

  it('fails clearly when no migration path exists', () => {
    const r = loadScenario({ schemaVersion: 0 });
    if (!r.ok) expect(r.errors[0]).toMatch(/No upgrade path/);
  });
});

describe('round trip', () => {
  it('save -> load returns an equal scenario', () => {
    let s: Scenario = updateMeta(createScenario(), { name: 'Desert Mesa', author: 'tester' });
    s = paintTags(s, [at(3, 3), at(4, 3)], 'water', 'add');
    s = setElevation(s, [at(7, 7), at(7, 8)], 2);
    const r1 = placeComponent(s, 'carrier', { id: 'c1', hex: at(2, 6), facing: 0, owner: 'A' });
    if (!r1.ok) throw new Error(r1.reason);
    s = addGoal(r1.scenario, { id: 'g1', text: 'Hold the mesa', vp: 3, scoring: 'each-phase' });
    const r = loadScenario(serializeScenario(s));
    expect(r).toMatchObject({ ok: true, migratedFrom: null });
    if (r.ok) expect(r.scenario).toEqual(s);
  });
});

describe('file names', () => {
  it('slugifies names', () => {
    expect(slugify('Desert Mesa')).toBe('desert-mesa');
    expect(slugify('  Ä Bao Qu!  ')).toBe('a-bao-qu');
    expect(slugify('!!!')).toBe('scenario');
  });

  it('builds file names', () => {
    const s = updateMeta(createScenario(), { name: 'Desert Mesa' });
    expect(scenarioFileName(s)).toBe('desert-mesa.scenario.json');
    expect(imageFileName(s)).toBe('desert-mesa.png');
  });
});
